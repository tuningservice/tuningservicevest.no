import {parseOfferContact} from '../js/vehicle-offer-state.mjs';
import {customerEngineName} from '../js/vehicle-units.mjs';
import {JournalError,validUuid,digest} from './chat-journal.mjs';
import {buildChatEnvelope,renderChatEmail,renderCustomerContactPreview,customerContactOverview,CHAT_CONTACT_TYPE} from './chat-contact-mail.mjs';
import {createLocalChatMailWorker} from './chat-mail-worker.mjs';
import {isChatMailDelivery} from './chat-mail-delivery.mjs';
export function createChatContact({journal,now=()=>Date.now(),delayMs=150,transport=null}={}){
  const inflight=new Map(),worker=createLocalChatMailWorker({journal,delayMs,now});
  if(transport!==null&&!isChatMailDelivery(transport))throw new Error('Untrusted live mail transport is disabled.');
  const simulated=transport?.mode!=='live-test';
  function preview({conversationId,anchorEventId=null}){
    const snap=journal.snapshot(conversationId,anchorEventId);
    const envelope=buildChatEnvelope(snap,{id:'Førehandsvisning',contact:{email:null,phone:null},createdAt:new Date(now()).toISOString(),simulated});
    return {simulated,revision:snap.revision,conversationId,to:'vest@tuningservice.no',site:'https://tuningservicevest.no',context:envelope.requestContext,overview:customerContactOverview(envelope),previewText:renderCustomerContactPreview(envelope),
      transcript:snap.events.map(e=>({at:e.at,epoch:e.epoch,role:e.role,kind:e.kind,text:e.text})),vehicleText:renderVehicle(snap.context)};
  }
  function renderVehicle(c){return customerEngineName(c?.technical?.vehicle??'Bilvariant uavklart');}
  async function submit(body){
    const fields=['conversationId','requestId','revision','anchorEventId','contact','name','message','website'];
    if(!body||Object.keys(body).some(k=>!fields.includes(k))||!validUuid(body.requestId)||!Number.isSafeInteger(body.revision))throw new JournalError('invalid-contact-request');
    const contact=parseOfferContact(body.contact);if(!contact)throw new JournalError('invalid-contact');
    if(body.website)throw new JournalError('spam-rejected');
    for(const [k,max]of [['name',100],['message',3000]])if(body[k]!=null&&(typeof body[k]!=='string'||body[k].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body[k])))throw new JournalError('invalid-contact-request');
    const fingerprint=digest([body.conversationId,body.revision,body.anchorEventId??null,contact,body.name??'',body.message??'']);
    let row=journal.db.prepare('SELECT * FROM contact_requests WHERE id=?').get(body.requestId);
    if(row&&row.fingerprint!==fingerprint)throw new JournalError('request-changed',409);
    const receipt=()=>{const sim=JSON.parse(row.envelope).simulated!==false;return {ok:true,accepted:true,simulated:sim,id:body.requestId,revision:journal.get(body.conversationId).revision,message:sim?'Testførespurnad registrert – ingen e-post er send':'Førespurnaden er send til Bjørn.'};};
    if(row?.status==='accepted')return receipt();
    if(inflight.has(body.requestId))return inflight.get(body.requestId);
    if(!row){
      const snap=journal.snapshot(body.conversationId,body.anchorEventId??null);if(snap.revision!==body.revision)throw new JournalError('conversation-changed',409);
      const envelope=buildChatEnvelope(snap,{id:body.requestId,contact,name:body.name?.trim()??'',message:body.message?.trim()??'',createdAt:new Date(now()).toISOString(),simulated});
      const mail=renderChatEmail(envelope);
      journal.db.prepare("INSERT INTO contact_requests VALUES(?,?,?,?,?,'pending')").run(body.requestId,body.conversationId,fingerprint,JSON.stringify(envelope),JSON.stringify(mail));
      row={envelope:JSON.stringify(envelope),mail:JSON.stringify(mail)};
    }
    const pending=(async()=>{
      try{
        const envelope=JSON.parse(row.envelope);if(envelope.type!==CHAT_CONTACT_TYPE||envelope.to!=='vest@tuningservice.no')throw new JournalError('delivery-failed',502);
        if(envelope.simulated===false){
          if(!transport)throw new JournalError('mail-not-configured',503);
          await transport.send({id:envelope.id,mail:JSON.parse(row.mail)});
        }else{
          const upstream=await worker.fetch('https://internal/chat-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope)});
          const result=await upstream.json();if(!upstream.ok||result.ok!==true||result.accepted!==true||result.simulated!==true)throw new JournalError('delivery-failed',502);
        }
        journal.db.exec('BEGIN IMMEDIATE');
        try{
          journal.db.prepare("UPDATE contact_requests SET status='accepted' WHERE id=?").run(body.requestId);
          journal.append(body.conversationId,body.requestId+':receipt','contact-receipt','assistant',receipt().message,envelope.requestContext);journal.db.exec('COMMIT');
        }catch(e){journal.db.exec('ROLLBACK');throw e;}
        return receipt();
      }catch(e){journal.db.prepare("UPDATE contact_requests SET status='failed' WHERE id=?").run(body.requestId);throw e instanceof JournalError?e:new JournalError('delivery-failed',502);}
      finally{inflight.delete(body.requestId);}
    })();inflight.set(body.requestId,pending);return pending;
  }
  return {preview,submit,failNext(){worker.failNext();}};
}
