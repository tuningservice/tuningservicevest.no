// Pure, per-conversation journal. The repository commits its WHOLE state with a
// D1 compare-and-swap; this module itself never performs network side effects.
import {JournalError,digest,validUuid} from '../server/chat-core.mjs';
export function newState(id,at=Date.now()){
 return {id,created:new Date(at).toISOString(),updated:new Date(at).toISOString(),epoch:0,context:null,revision:0,bytes:0,events:[],requests:{},eventRequests:{},contacts:{},lookups:[],lookupRequests:{},covered:0,lastActivity:null,ended:false};
}
export function stateJournal(state,{now=()=>Date.now(),maxBytes=600*1024}={}){
 const get=id=>{if(id!==state.id||!validUuid(id))throw new JournalError('conversation-expired',409);return structuredClone(state);};
 function append(id,eventId,kind,role,text,context){
  get(id);const old=state.events.find(e=>e.eventId===eventId);if(old)return structuredClone(old);
  const ctx=context===undefined?state.context:context,bytes=new TextEncoder().encode(text+JSON.stringify(ctx??null)).length;
  if(state.bytes+bytes>maxBytes)throw new JournalError('conversation-too-large',413);
  const at=new Date(now()).toISOString(),event={seq:++state.revision,eventId,at,epoch:ctx?.epoch??state.epoch,kind,role,text,context:structuredClone(ctx)};
  state.events.push(event);state.bytes+=bytes;state.updated=at;
  if(['question','reset','lookup-input','lookup-start','registered','selection','result','stage','service'].includes(kind)){state.lastActivity=now();state.ended=false;}
  if(kind==='conversation-end')state.ended=true;
  return structuredClone(event);
 }
 const events=id=>(get(id),structuredClone(state.events));
 function snapshot(id,anchor=null){
  get(id);if(Object.values(state.requests).some(r=>r.status==='pending'))throw new JournalError('conversation-busy',409);
  const e=anchor==null?null:state.events.find(e=>e.seq===anchor);if(anchor!=null&&!e)throw new JournalError('invalid-anchor');
  return {conversationId:id,revision:state.revision,createdAt:state.created,requestEpoch:e?.epoch??state.epoch,context:structuredClone(e?e.context:state.context),activeContext:structuredClone(state.context),events:events(id)};
 }
 function beginChat(id,requestId,question,{retry=false}={}){
  get(id);const fingerprint=digest([id,question,state.context]),old=state.requests[requestId];
  if(old){if(old.fingerprint!==fingerprint)throw new JournalError('request-changed',409);if(old.status==='done'&&(!retry||!['error','unavailable'].includes(old.result.mode)))return {cached:structuredClone(old.result)};if(old.status==='pending')throw new JournalError('conversation-busy',409);}
  if(Object.values(state.requests).some(r=>r.status==='pending'))throw new JournalError('conversation-busy',409);
  state.requests[requestId]={fingerprint,status:'pending',context:structuredClone(state.context),started:now()};
  append(id,requestId+':question','question','user',question);return {context:structuredClone(state.context)};
 }
 function finishChat(id,requestId,result,context){
  get(id);const row=state.requests[requestId];if(!row)throw new JournalError('invalid-input');if(row.status==='done')return structuredClone(row.result);
  const count=state.events.filter(e=>e.eventId===requestId+':answer'||e.eventId.startsWith(requestId+':answer:')).length;
  const e=append(id,requestId+':answer'+(count?':'+(count+1):''),'answer','assistant',result.answer,context);
  const full={...result,conversationId:id,revision:state.revision,replyEventId:e.seq,actions:result.handoff?[{type:'contact_bjorn',label:'Send førespurnad til Bjørn',anchorEventId:e.seq}]:[]};
  row.status='done';row.result=structuredClone(full);return full;
 }
 return {get,append,events,snapshot,beginChat,finishChat,
  mutate(id,eventId,kind,text,context,{reset=false}={}){get(id);if(state.events.some(e=>e.eventId===eventId))return {conversationId:id,revision:state.revision};if(reset)state.epoch++;state.context=context?{...structuredClone(context),epoch:state.epoch}:null;append(id,eventId,kind,'event',text,state.context);return {conversationId:id,revision:state.revision};},
  history(id){get(id);const log=state.events.filter(e=>e.epoch===state.epoch&&['question','answer'].includes(e.kind));if(log.at(-1)?.kind==='question')log.pop();return log.slice(-12).map(e=>({role:e.role,content:e.text}));},
  getEventRequest:id=>state.eventRequests[id]?{...state.eventRequests[id],result:JSON.stringify(state.eventRequests[id].result)}:null,
  putEventRequest(id,conversation,fingerprint,result){get(conversation);state.eventRequests[id]={fingerprint,result:structuredClone(result)};},
  atomic(fn){const copy=structuredClone(state);try{return fn();}catch(error){for(const key of Object.keys(state))delete state[key];Object.assign(state,copy);throw error;}}
 };
}
