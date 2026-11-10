import {randomUUID} from 'node:crypto';
import {cloudFetch} from './fetch.mjs';
import {verifyAccess} from './access.mjs';
import {cloudRepository} from './repository.mjs';
import {stateJournal} from './state-journal.mjs';
import {cloudCatalogue} from './catalogue.mjs';
import {budgetedFetch} from './budget.mjs';
import {mailMode,usageMail,drainMail,scheduledWork,recipient,site} from './mail.mjs';
import {JournalError,validUuid,digest} from '../server/chat-core.mjs';
import {createChatAi,ChatError} from '../server/chat-ai.mjs';
import {createChatRuntime} from '../server/chat-runtime.mjs';
import {createChatLookupContext} from '../server/chat-lookup-context.mjs';
import {createVehicleService,VehicleError,handleVehicleRequest} from '../server/vehicle-service.mjs';
import {createBrandLogoService} from '../server/vehicle-brand-logo.mjs';
import {resolveCustomerVehicle} from '../server/vehicle-resolution.mjs';
import {groupVariants} from '../js/dvx-model.mjs';
import {suggestCandidates} from '../js/vehicle-matching.mjs';
import {parseOfferContact} from '../js/vehicle-offer-state.mjs';
import {buildChatEnvelope,renderChatEmail,renderCustomerContactPreview,customerContactOverview} from '../server/chat-contact-mail.mjs';
import {CHAT_WELCOME} from '../js/chat-copy.mjs';
const only=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>fields.includes(k));
const policy={
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'"
};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...policy,'Content-Type':'application/json; charset=utf-8'}});
async function bodyOf(request){
 if(!(request.headers.get('content-type')??'').startsWith('application/json'))throw new JournalError('invalid-input');
 const reader=request.body?.getReader();if(!reader)throw new JournalError('invalid-input');const chunks=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();throw new JournalError('payload-too-large',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new JournalError('invalid-input');}
}
export function createSkyWorker({authenticate=verifyAccess,fetchImpl=cloudFetch,now=()=>Date.now()}={}){
 const resources=new WeakMap();
 function services(env){
  if(resources.has(env))return resources.get(env);
  const vehicle=createVehicleService(env,{fetchImpl,now}),catalog=vehicle.catalog,cat=cloudCatalogue(env.ASSETS);
  const logo=createBrandLogoService({loadManufacturers:id=>catalog('manufacturers',id),fetchImage:fetchImpl,now});
  async function facts(record){
   let value={};try{
    const type=(await catalog('types')).find(t=>/^Cars\s*&\s*LCV$/i.test(t.name));if(!type)return value;
    const rows=await catalog('manufacturers',type.id),ids=suggestCandidates('manufacturers',rows,{manufacturer:record.brand}).ids;if(ids.length!==1)return value;
    const make=rows.find(r=>String(r.id)===ids[0]);value.brand={namespace:'tuningfiles',manufacturerId:String(make.id),typeId:String(type.id),name:make.name,logoAvailable:!!make.brandLogo,association:'verified-manufacturer-only',dvxBrand:record.brand};
    if(suggestCandidates('models',await catalog('models',make.id),{manufacturer:record.brand,model:record.model}).ids.length)value.vehicleType=type.name;
   }catch{}return value;
  }
  const result={vehicle,catalog,cat,logo,facts};resources.set(env,result);return result;
 }
 function helpers(row,repo,env,owner,records,s){
  const journal=stateJournal(row.state,{now}),lookup=createChatLookupContext({now,savedEntries:row.state.lookups});
  const ai=createChatAi({env,catalog:s.catalog,lookupContext:lookup.get,restoreHistory:journal.history,dvxFacts:s.facts,dvxRecords:records,snapshot:env.CATALOGUE_PIN,fetchImpl:budgetedFetch(repo,owner,env,fetchImpl),now});
  const runtime=createChatRuntime({journal,ai,catalog:s.catalog,lookupContexts:lookup,dvxRecords:records});
  return {journal,lookup,ai,runtime,saveLookups(){row.state.lookups=lookup.snapshot();}};
 }
 async function contextRecords(s,state,input){
  const p=input?.payload,ref=p?.vehicle;
  if(p?.source==='dvx'&&p.selection?.brand)return s.cat.brand(p.selection.brand);
  if(ref?.source==='dvx')return s.cat.recordVehicle(ref.selection?.vehicleId);
  if(state.context?.ref?.source==='dvx')return s.cat.recordVehicle(state.context.ref.selection?.vehicleId);
  return [];
 }
 async function contact(repo,row,input,mode,production=false){
  if(!only(input,['conversationId','requestId','revision','anchorEventId','contact','name','message','website'])||!validUuid(input.requestId)||!Number.isSafeInteger(input.revision))throw new JournalError('invalid-contact-request');
  if(input.website)throw new JournalError('spam-rejected');const contact=parseOfferContact(input.contact);if(!contact)throw new JournalError('invalid-contact');
  for(const [key,max]of [['name',100],['message',3000]])if(input[key]!=null&&(typeof input[key]!=='string'||input[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input[key])))throw new JournalError('invalid-contact-request');
  const fingerprint=digest([input.conversationId,input.revision,input.anchorEventId??null,contact,input.name??'',input.message??'']);
  const old=row.state.contacts[input.requestId];if(old){if(old.fingerprint!==fingerprint)throw new JournalError('request-changed',409);return old.receipt;}
  const journal=stateJournal(row.state,{now}),snap=journal.snapshot(row.id,input.anchorEventId??null);if(snap.revision!==input.revision)throw new JournalError('conversation-changed',409);
  const envelope=buildChatEnvelope(snap,{id:input.requestId,contact,name:input.name?.trim()??'',message:input.message?.trim()??'',createdAt:new Date(now()).toISOString(),simulated:mode!=='live-test',production}),mail=renderChatEmail(envelope);
  const message=mode==='live-test'?'Førespurnaden er registrert og lagd i kø for sending til Bjørn.':'Testførespurnad registrert – ingen e-post er send';
  journal.append(row.id,input.requestId+':receipt','contact-receipt','assistant',message,envelope.requestContext);
  const receipt={ok:true,accepted:true,simulated:mode!=='live-test',queued:mode==='live-test',id:input.requestId,revision:row.state.revision,message};
  row.state.contacts[input.requestId]={fingerprint,receipt};row.state.covered=row.state.revision;
  await repo.commit(row,[{id:'contact:'+row.id+':'+input.requestId,kind:'contact',revision:snap.revision,mode,mail}]);return receipt;
 }
 return {
  async fetch(request,env,execution){
   try{
    const url=new URL(request.url);
    if(url.hostname!==env.TEST_HOSTNAME)throw new JournalError('access-required',401);
    const user=await authenticate(request,env,{fetchImpl,now});
    if(!env.CHAT_DB||!env.ASSETS)throw new JournalError('cloud-not-configured',503);
    if(request.method==='POST'&&request.headers.get('origin')!==url.origin)throw new JournalError('invalid-origin',403);
    const repo=cloudRepository(env.CHAT_DB,{now}),s=services(env);
    if(url.pathname.startsWith('/api/'))await repo.limit('api:'+user.owner,120,60000);
    const mode=await mailMode(repo),mailConfigured=!!env.MAILJET_API_KEY&&!!env.MAILJET_API_SECRET;
    if(url.pathname==='/api/chat-status'&&request.method==='GET'){
     return json({cloud:true,production:env.DEPLOYMENT_ENV==='production',scenarios:[],svvConfigured:!!env.SVV_API_KEY,lookupMode:env.SVV_API_KEY?'live':'unavailable',vdbMode:env.TUNINGFILES_VDB_API_KEY?'live':'unavailable',aiMode:env.OPENAI_API_KEY&&env.OPENAI_MODEL?'live':'unavailable',missing:[],snapshot:env.CATALOGUE_PIN,mail:{mode,configured:mode==='live-test'&&mailConfigured,dailyLimit:env.DEPLOYMENT_ENV==='production'?100:25},notifications:{mode:mode==='live-test'?'live-test':'cloud-simulated',idleSeconds:300,healthy:true},retentionDays:30});
    }
    if(url.pathname==='/data/chat/dvx-snapshot.json'&&request.method==='GET'){
     const {vehicleBrands,...index}=await s.cat.index();return json({...index,delivery:'brand-chunks'});
    }
    if(url.pathname==='/api/vehicle-catalog'){
     const result=await handleVehicleRequest(request,s.vehicle);return new Response(result.body,{status:result.status,headers:{...policy,'Content-Type':'application/json'}});
    }
    if(url.pathname==='/api/vehicle-brand-logo'&&request.method==='GET'){
     const image=await s.logo(url.searchParams.get('typeId'),url.searchParams.get('id'));return image?new Response(image.bytes,{headers:{...policy,'Content-Type':image.type}}):json({error:{code:'logo-unavailable'}},404);
    }
    if(url.pathname==='/api/cloud-admin'&&request.method==='POST'){
     if(!user.admin)throw new JournalError('access-required',403);const input=await bodyOf(request);
     if(only(input,['action','mode'])&&input.action==='mail-mode'&&['simulated','live-test'].includes(input.mode)){
      if(input.mode==='live-test'&&!mailConfigured)throw new JournalError('mail-not-configured',503);
      // Activation never mails old test sessions or previously simulated jobs.
      if(input.mode==='live-test'&&mode!=='live-test')await repo.p("UPDATE cloud_conversations SET version=version+1,body=json_set(body,'$.covered',json_extract(body,'$.revision')),due=NULL").run();
      await repo.p("UPDATE cloud_control SET value=? WHERE id='mail-mode'",input.mode).run();return json({ok:true,mode:input.mode});
     }
     if(only(input,['action','query'])&&input.action==='search'&&typeof(input.query??'')==='string'&&(input.query??'').length<=100){
      const fields="SELECT id,updated,json_extract(body,'$.context.technical.vehicle') AS vehicle,json_extract(body,'$.context.registration') AS registration FROM cloud_conversations WHERE expires>? AND ";
      const rows=env.ADMIN_ALL_OWNERS==='true'?await repo.p(fields+'body LIKE ? ORDER BY updated DESC LIMIT 30',now(),'%'+(input.query??'')+'%').all():await repo.p(fields+'owner=? AND body LIKE ? ORDER BY updated DESC LIMIT 30',now(),user.owner,'%'+(input.query??'')+'%').all();
      const budgetId=env.AI_BUDGET_PERIOD==='monthly'?'production-ai:'+new Date(now()).toISOString().slice(0,7):'private-test-ai';
      return json({items:rows.results,mode,budget:await repo.p('SELECT reserved,ceiling FROM cloud_budget WHERE id=?',budgetId).first()??{reserved:0,ceiling:5000000}});
     }
     if(only(input,['action','id'])&&['read','delete'].includes(input.action)&&validUuid(input.id)){
      const owner=env.ADMIN_ALL_OWNERS==='true'?(await repo.p('SELECT owner FROM cloud_conversations WHERE id=? AND expires>?',input.id,now()).first())?.owner:user.owner;
      if(!owner)throw new JournalError('conversation-expired',409);
      const row=await repo.read(input.id,owner);
      if(input.action==='delete'){await repo.p('DELETE FROM cloud_conversations WHERE id=? AND owner=?',input.id,owner).run();return json({ok:true});}
      const snap=stateJournal(row.state,{now}).snapshot(row.id),envelope=buildChatEnvelope(snap,{id:row.id,contact:{email:null,phone:null},createdAt:new Date(now()).toISOString(),simulated:mode!=='live-test',production:env.DEPLOYMENT_ENV==='production'});
      const pending=await repo.p("SELECT kind,status,error_code,attempts FROM cloud_outbox WHERE conversation=? ORDER BY created DESC",row.id).all();
      return json({id:row.id,updated:row.updated,previewText:renderCustomerContactPreview(envelope),deliveries:pending.results});
     }
     throw new JournalError('invalid-input');
    }
    if(url.pathname.startsWith('/api/')&&request.method==='POST'){
     const input=await bodyOf(request);
     if(url.pathname==='/api/chat-session'){
      if(!only(input,[])||Object.keys(input).length)throw new JournalError('invalid-input');await repo.limit('session:'+user.owner,30,3600000);
      const row=await repo.create(user.owner);stateJournal(row.state,{now}).append(row.id,'intro','intro','assistant',CHAT_WELCOME,null);await repo.commit(row);return json({conversationId:row.id,revision:row.state.revision});
     }
     const id=input.conversationId??request.headers.get('x-chat-conversation'),row=await repo.read(id,user.owner);
     if(input.conversationId&&request.headers.has('x-chat-conversation')&&input.conversationId!==request.headers.get('x-chat-conversation'))throw new JournalError('invalid-conversation');
     if(url.pathname==='/api/vehicle-lookup'){
      if(!only(input,['registration'])||typeof input.registration!=='string'||!/^[A-Z0-9]{2,7}$/.test(input.registration))throw new JournalError('invalid-registration');
      const requestId=request.headers.get('x-chat-lookup-id');if(!validUuid(requestId))throw new JournalError('invalid-input');
      const fingerprint=digest([id,input.registration]),previous=row.state.lookupRequests[requestId];
      if(previous){if(previous.fingerprint!==fingerprint)throw new JournalError('request-changed',409);if(previous.response)return json(previous.response.data,previous.response.status);throw new JournalError('lookup-busy',409);}
      await repo.limit('lookup:'+user.owner,30,60000);
      row.state.lookupRequests[requestId]={fingerprint,registration:input.registration,mode,started:now(),response:null};stateJournal(row.state,{now}).append(id,requestId+':lookup','lookup-start','event','Eit teknisk oppslag er starta.');await repo.commit(row);
      let answer;try{answer={status:200,data:await s.vehicle.lookup(input.registration)};}catch(error){answer={status:error instanceof VehicleError?error.status:502,data:{error:{code:error instanceof VehicleError?error.code:'upstream-unavailable'},...(error.candidates?{candidates:error.candidates}:{})}};}
      const value=await repo.mutate(id,user.owner,(state,current)=>{
       const contexts=createChatLookupContext({now,savedEntries:state.lookups});
       if(answer.data.vehicle)answer.data=contexts.remember(answer.data,input.registration);
       if(answer.data.candidates)answer.data.candidates=answer.data.candidates.map(vehicle=>contexts.remember({vehicle,source:'svv',simulated:false},input.registration));
       state.lookups=contexts.snapshot();const record=state.lookupRequests[requestId];record.response=answer;record.notified=true;
       const mail=usageMail(state,{id:'lookup:'+state.id+':'+requestId,kind:'lookup',mode:record.mode,now:now(),production:env.DEPLOYMENT_ENV==='production',lookup:{registration:record.registration,outcome:{status:answer.status,code:answer.data.error?.code??'found'},vehicle:answer.data.vehicle??null,candidates:answer.data.candidates?.map(c=>c.vehicle)??[]}});
       return {value:answer,mails:[mail]};
      });execution.waitUntil(drainMail(repo,env,{fetchImpl}));return json(value.data,value.status);
     }
     if(url.pathname==='/api/chat-vehicle-proposal'||url.pathname==='/api/chat-base-vehicle'){
      const contexts=createChatLookupContext({now,savedEntries:row.state.lookups}),found=contexts.getPrivate(input.lookupToken);if(!found)throw new JournalError('lookup-expired',409);
      if(url.pathname==='/api/chat-base-vehicle'){
       if(!only(input,['lookupToken','baseId']))throw new JournalError('invalid-input');const result=contexts.confirmBase(input.lookupToken,input.baseId);if(!result)throw new JournalError('invalid-base-vehicle');row.state.lookups=contexts.snapshot();await repo.commit(row);return json(result);
      }
      if(!only(input,['lookupToken']))throw new JournalError('invalid-input');const records=await s.cat.recordsForVehicle(found.vehicle);return json(await resolveCustomerVehicle(found.vehicle,{groups:groupVariants(records),loadCatalog:s.catalog}));
     }
     if(url.pathname==='/api/chat-dvx-facts'){
      if(!only(input,['vehicleId']))throw new JournalError('invalid-input');const records=await s.cat.recordVehicle(input.vehicleId);if(!records.length)throw new JournalError('invalid-vehicle');return json(await s.facts(records[0]));
     }
     if(url.pathname==='/api/chat-event'){
      const records=await contextRecords(s,row.state,input),h=helpers(row,repo,{...env,CHAT_MAIL_MODE:mode},user.owner,records,s),value=await h.runtime.event(input);h.saveLookups();if(row.state.lastActivity)row.state.activityMailMode=mode;await repo.commit(row);return json(value);
     }
     if(url.pathname==='/api/chat'){
      if(!only(input,['conversationId','requestId','question','retry'])||!validUuid(input.requestId)||typeof input.question!=='string'||!input.question.trim()||input.question.length>2000||input.retry!==undefined&&typeof input.retry!=='boolean')throw new JournalError('invalid-input');
      const records=await contextRecords(s,row.state,input),h=helpers(row,repo,{...env,CHAT_MAIL_MODE:mode},user.owner,records,s),begun=h.journal.beginChat(id,input.requestId,input.question.trim(),{retry:input.retry===true});if(begun.cached)return json(begun.cached);
      row.state.activityMailMode=mode;await repo.commit(row);
      const ctx=begun.context,technical=ctx?{...ctx.technical,vehicleEpoch:ctx.epoch,selectedServices:ctx.selectedServices??[]}:null;let result;
      try{result=await h.ai.reply({conversationId:id,requestId:input.requestId,question:input.question.trim(),vehicle:ctx?.ref??null},technical);}
      catch(error){const code=['ai-local-budget','ai-not-configured','ai-rate-limit','ai-timeout','ai-credit-unavailable','ai-account-limit'].includes(error.code)?error.code:'ai-unavailable';result={answer:code==='ai-local-budget'?(env.DEPLOYMENT_ENV==='production'?'AI-assistenten er mellombels utilgjengeleg. Du kan framleis få tilbod frå Bjørn.':'AI-testgrensa er nådd. Du kan framleis få tilbod frå Bjørn.'):'Eg fekk ikkje henta svaret. Prøv igjen, eller send spørsmålet til Bjørn.',handoff:'other',mode:'error',errorCode:code};}
      const value=await repo.mutate(id,user.owner,state=>({value:stateJournal(state,{now}).finishChat(id,input.requestId,result,ctx)}));return json(value);
     }
     if(url.pathname==='/api/chat-contact-preview'){
      if(!only(input,['conversationId','anchorEventId']))throw new JournalError('invalid-input');const snap=stateJournal(row.state,{now}).snapshot(id,input.anchorEventId??null),envelope=buildChatEnvelope(snap,{id:'Førehandsvisning',contact:{email:null,phone:null},createdAt:new Date(now()).toISOString(),simulated:mode!=='live-test',production:env.DEPLOYMENT_ENV==='production'});
      return json({simulated:mode!=='live-test',revision:snap.revision,conversationId:id,to:recipient,site,context:envelope.requestContext,overview:customerContactOverview(envelope),previewText:renderCustomerContactPreview(envelope),vehicleText:snap.context?.technical?.vehicle??'Val uavklart',transcript:snap.events.map(e=>({at:e.at,epoch:e.epoch,kind:e.kind,role:e.role,text:e.text}))});
     }
     if(url.pathname==='/api/chat-contact'){
      await repo.limit('contact:'+user.owner,10,60000);const value=await contact(repo,row,input,mode,env.DEPLOYMENT_ENV==='production');execution.waitUntil(drainMail(repo,env,{fetchImpl}));return json(value);
     }
     if(url.pathname==='/api/chat-end'){
      if(!only(input,['conversationId','requestId'])||!validUuid(input.requestId))throw new JournalError('invalid-input');stateJournal(row.state,{now}).append(id,input.requestId+':end','conversation-end','event','Kunden avslutta samtalen.');await repo.commit(row);execution.waitUntil(scheduledWork(repo,env,{fetchImpl}));return json({ok:true,simulated:mode!=='live-test',revision:row.state.revision,message:'Samtalen er avslutta. Loggen er lagd i utsendingskøen.'});
     }
     if(url.pathname==='/api/chat-notifications'){
      if(!only(input,['conversationId','before']))throw new JournalError('invalid-input');const before=input.before??Number.MAX_SAFE_INTEGER;if(!Number.isSafeInteger(before))throw new JournalError('invalid-input');
      const rows=await repo.p('SELECT rowid AS cursor,id,kind,created,status,attempts,next_attempt,error_code,revision,mode FROM cloud_outbox WHERE conversation=? AND rowid<? ORDER BY rowid DESC LIMIT 21',id,before).all();const more=rows.results.length>20,items=rows.results.slice(0,20);return json({items:items.map(r=>({...r,createdAt:r.created,simulated:r.mode!=='live-test'})),nextBefore:more?items.at(-1).cursor:null,simulated:mode!=='live-test',healthy:true});
     }
     if(url.pathname==='/api/chat-notification-preview'){
      if(!only(input,['conversationId','id'])||typeof input.id!=='string')throw new JournalError('invalid-input');const mail=await repo.p('SELECT mail FROM cloud_outbox WHERE conversation=? AND id=?',id,input.id).first();if(!mail)throw new JournalError('notification-not-found',404);return json(JSON.parse(mail.mail));
     }
     // No synthetic fault injection or production-contact forwarding in cloud.
     throw new JournalError('not-found',404);
    }
    if(url.pathname.startsWith('/api/'))throw new JournalError('not-found',404);
    if(!['GET','HEAD'].includes(request.method))throw new JournalError('method-not-allowed',405);
    if(url.pathname==='/test/admin/'&&!user.admin)throw new JournalError('access-required',403);
    if(!/^\/(?:$|test\/(?:chat|home|admin)\/$|(?:css|js|img|data\/cloud)\/[A-Za-z0-9_./-]+$)/.test(url.pathname)||url.pathname.includes('..'))throw new JournalError('not-found',404);
    const target=new URL(request.url);if(['/', '/test/home/'].includes(target.pathname))target.pathname='/test/chat/';
    const response=await env.ASSETS.fetch(new Request(target,request)),headers=new Headers(response.headers);for(const [key,value]of Object.entries(policy))headers.set(key,value);return new Response(response.body,{status:response.status,headers});
   }catch(error){const safe=error instanceof JournalError||error instanceof ChatError||error instanceof VehicleError;return json({error:{code:safe?error.code:'cloud-unavailable'}},safe?error.status:503);}
  },
  async scheduled(event,env,execution){const repo=cloudRepository(env.CHAT_DB,{now});execution.waitUntil(scheduledWork(repo,env,{fetchImpl}));}
 };
}
export default createSkyWorker();
