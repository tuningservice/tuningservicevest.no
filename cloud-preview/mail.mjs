import {randomUUID} from 'node:crypto';
import {JournalError,digest} from '../server/chat-core.mjs';
import {renderNotificationEmail} from '../server/chat-notification-mail.mjs';
import {stateJournal} from './state-journal.mjs';
export const recipient='vest@tuningservice.no',site='https://tuningservicevest.no';
export async function mailMode(repo){return (await repo.p("SELECT value FROM cloud_control WHERE id='mail-mode'").first())?.value==='live-test'?'live-test':'simulated';}
export function usageMail(state,{id,kind,mode,now=Date.now(),lookup=null,reason='idle',production=false}={}){
 const envelope={id,to:recipient,site,production,simulated:mode!=='live-test',createdAt:new Date(now).toISOString(),conversationId:state.id,
  ...(kind==='lookup'?{type:'usage.lookup.v1',...lookup}:{type:'usage.conversation.v1',revision:state.revision,reason,context:state.context,events:state.events})};
 return {id,kind,mode,revision:state.revision,mail:renderNotificationEmail(envelope)};
}
export async function drainMail(repo,env,{fetchImpl=fetch,max=15}={}){
 // Never resend a live attempt whose acknowledgement could have been lost.
 await repo.p("UPDATE cloud_outbox SET status=CASE WHEN mode='live-test' THEN 'needs-review' ELSE 'retry' END,error_code='interrupted-delivery' WHERE status='sending' AND lease_until<=?",repo.now()).run();
 const mode=await mailMode(repo);
 for(let i=0;i<max;i++){
  const claim=randomUUID(),row=await repo.p("UPDATE cloud_outbox SET status='sending',claim=?,attempts=attempts+1,lease_until=? WHERE id=(SELECT id FROM cloud_outbox WHERE status IN ('pending','retry') AND next_attempt<=? ORDER BY CASE kind WHEN 'contact' THEN 0 ELSE 1 END,created,id LIMIT 1) AND status IN ('pending','retry') RETURNING *",claim,repo.now()+60000,repo.now()).first();
  if(!row)break;
  let status='accepted',provider=null,errorCode=null,next=repo.now();
  try{
   if(row.mode!==mode){status='suppressed';errorCode='mail-mode-changed';}
   else if(mode==='live-test'){
    if(!env.MAILJET_API_KEY||!env.MAILJET_API_SECRET)throw Object.assign(new Error(),{code:'mail-not-configured',retry:true});
    try{await repo.limit('mail-daily',env.DEPLOYMENT_ENV==='production'?100:25,86400000);}catch{throw Object.assign(new Error(),{code:'mail-daily-limit',retry:true,wait:(Math.floor(repo.now()/86400000)+1)*86400000-repo.now()+1000});}
    const mail=JSON.parse(row.mail);if(mail.to!==recipient||!(mail.production===true&&env.DEPLOYMENT_ENV==='production'||mail.subject?.startsWith('[LOKAL TEST]')))throw Object.assign(new Error(),{code:'invalid-mail-envelope'});
    const message={From:{Email:'skjema@meldingar.vevsmia.no',Name:'Tuningservice Vest'},To:[{Email:recipient}],Subject:mail.production?mail.subject:mail.subject.replace('[LOKAL TEST]','[PRIVAT SKYTEST]'),TextPart:mail.text,HTMLPart:mail.html,TrackOpens:'disabled',TrackClicks:'disabled',CustomID:'tsv-skytest-'+digest(row.id).slice(0,40)};
    if(mail.replyTo)message.ReplyTo={Email:mail.replyTo};
    if(mail.attachments?.length)message.Attachments=mail.attachments.map(a=>({ContentType:a.contentType,Filename:a.filename,Base64Content:a.contentBase64}));
    const body=JSON.stringify({Messages:[message]});if(new TextEncoder().encode(body).length>8*1024*1024)throw Object.assign(new Error(),{code:'mail-too-large'});
    let response;
    try{response=await fetchImpl('https://api.mailjet.com/v3.1/send',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Basic '+btoa(env.MAILJET_API_KEY+':'+env.MAILJET_API_SECRET)},body,signal:AbortSignal.timeout(8000)});}
    catch{throw Object.assign(new Error(),{code:'mail-delivery-uncertain',uncertain:true});}
    if(response.status===429){const raw=response.headers.get('retry-after'),seconds=Number(raw),wait=raw?(Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-repo.now()):60000;await response.body?.cancel();throw Object.assign(new Error(),{code:'mail-quota',retry:true,wait:Number.isFinite(wait)?Math.max(1000,wait):60000});}
    if(response.status>=500){await response.body?.cancel();throw Object.assign(new Error(),{code:'mail-delivery-uncertain',uncertain:true});}
    if(!response.ok){await response.body?.cancel();throw Object.assign(new Error(),{code:[401,403].includes(response.status)?'mail-access-denied':'mail-provider-rejected'});}
    const text=await response.text();let item;try{if(text.length>100000)throw Error();item=JSON.parse(text).Messages?.[0];}catch{}
    provider=item?.To?.[0]?.MessageUUID;
    if(item?.Status!=='success'||typeof provider!=='string'||!provider)throw Object.assign(new Error(),{code:'mail-delivery-uncertain',uncertain:true});
   }
  }catch(error){errorCode=error.code??'delivery-failed';status=error.uncertain?'needs-review':error.retry&&row.attempts<8?'retry':'failed';next=repo.now()+Math.max(error.wait??0,Math.min(3600000,1000*2**row.attempts));}
  await repo.p('UPDATE cloud_outbox SET status=?,provider_id=?,error_code=?,next_attempt=?,lease_until=0 WHERE id=? AND claim=?',status,provider,errorCode,next,row.id,claim).run();
 }
}
export async function scheduledWork(repo,env,options={}){
 const mode=await mailMode(repo),rows=await repo.p('SELECT id,owner FROM cloud_conversations WHERE due<=? AND expires>? ORDER BY due LIMIT 30',repo.now(),repo.now()).all();
 for(const row of rows.results){
  await repo.mutate(row.id,row.owner,(state)=>{
   const journal=stateJournal(state,{now:repo.now});
   for(const [id,r]of Object.entries(state.requests))if(r.status==='pending'&&r.started+90000<=repo.now())journal.finishChat(state.id,id,{answer:'Svaret vart avbrote. Prøv igjen eller send spørsmålet til Bjørn.',mode:'error',handoff:'other'},r.context);
   for(const [id,r]of Object.entries(state.lookupRequests))if(!r.response&&r.started+60000<=repo.now())r.response={status:503,data:{error:{code:'interrupted'}}};
   const mails=[];
   for(const [id,r]of Object.entries(state.lookupRequests))if(r.response&&!r.notified){mails.push(usageMail(state,{id:'lookup:'+state.id+':'+id,kind:'lookup',mode:r.mode,now:repo.now(),production:env.DEPLOYMENT_ENV==='production',lookup:{registration:r.registration,outcome:{status:r.response.status,code:r.response.data.error?.code??'found'},vehicle:r.response.data.vehicle??null,candidates:r.response.data.candidates?.map(c=>c.vehicle)??[]}}));r.notified=true;}
   const pending=Object.values(state.requests).some(r=>r.status==='pending')||Object.values(state.lookupRequests).some(r=>!r.response);
   if(!pending&&state.revision>state.covered&&(state.ended||state.lastActivity!=null&&state.lastActivity+300000<=repo.now())){
    mails.push(usageMail(state,{id:'conversation:'+state.id+':'+state.revision,kind:'conversation',mode:state.activityMailMode??'simulated',now:repo.now(),production:env.DEPLOYMENT_ENV==='production',reason:state.ended?'explicit-end':'idle'}));state.covered=state.revision;
   }
   return {mails};
  });
 }
 await drainMail(repo,env,options);
 // New test data only, 30 days. D1 recovery retention is handled separately.
 await repo.p('DELETE FROM cloud_conversations WHERE expires<=?',repo.now()).run();
 await repo.p('DELETE FROM cloud_limits WHERE expires<=?',repo.now()).run();
}
