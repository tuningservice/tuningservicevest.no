// Logical message IDs survive network errors and explicit retries.
export function nearChatBottom({scrollHeight,scrollTop,clientHeight},threshold=90){return scrollHeight-scrollTop-clientHeight<=threshold;}
export function createChatTurns({send,onUser=()=>{},onWaiting=()=>{},onAnswer=()=>{},onFailure=()=>{},onSlow=()=>{},onChange=()=>{},uuid=()=>crypto.randomUUID(),schedule=setTimeout,clear=clearTimeout,slowMs=6500,deadlineMs=45000}){
 const turns=new Map();
 const changed=()=>onChange([...turns.values()].some(t=>t.state==='pending'));
 function stop(t){clear(t.slow);clear(t.deadline);}
 function fail(t,error){if(t.state==='cancelled'||t.state==='done')return;stop(t);t.state='failed';onFailure(t,error);changed();}
 function run(t,retry=false){t.state='pending';onWaiting(t);changed();t.slow=schedule(()=>{if(t.state==='pending')onSlow(t);},slowMs);t.deadline=schedule(()=>fail(t,{code:'ai-timeout'}),deadlineMs);
  send(t.question,data=>{if(t.state==='cancelled'||t.state==='done')return;stop(t);if(data.mode==='error'||data.mode==='unavailable'){fail(t,{code:data.errorCode??'ai-unavailable',data});return;}t.state='done';onAnswer(t,data);changed();},{requestId:t.id,retry}).catch(e=>fail(t,e));return t;
 }
 function ask(question){if(!question.trim())return null;if([...turns.values()].filter(t=>t.state==='pending').length>=5)return null;const t={id:uuid(),question:question.trim(),state:'new'};turns.set(t.id,t);onUser(t);return run(t);}
 function retry(id){const t=turns.get(id);if(!t||t.state!=='failed')return false;run(t,true);return true;}
 function cancel(){for(const t of turns.values())if(t.state==='pending'||t.state==='failed'){stop(t);t.state='cancelled';}changed();}
 return {ask,retry,cancel,pending:()=>[...turns.values()].filter(t=>t.state==='pending').length};
}
