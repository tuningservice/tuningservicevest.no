// A single ordered, retryable stream: vehicle events and questions cannot pass
// each other. No transcript or contact data is accepted back from the browser.
export function createChatServerSync({api,uuid=()=>crypto.randomUUID(),onError=()=>{}}){
  let conversationId=null,revision=0,creating=null,running=null;const pending=[];
  async function ensure(){
    if(conversationId)return;
    if(!creating)creating=api('/api/chat-session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>{conversationId=r.conversationId;revision=r.revision;}).finally(()=>creating=null);
    await creating;
  }
  function flush(){
    if(running)return running.then(()=>pending.length?flush():{conversationId,revision});
    running=(async()=>{await ensure();while(pending.length){
      const op=pending[0];let result;
      try{result=await api(op.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId,...op.body})});}
      catch(error){throw error;}
      pending.shift();revision=Math.max(revision,result.revision??0);op.onSuccess?.(result);op.resolve(result);
    }return {conversationId,revision};})().catch(error=>{for(const op of pending)op.reject(error);onError(error);throw error;}).finally(()=>running=null);
    return running.then(()=>pending.length?flush():{conversationId,revision});
  }
  function enqueue(path,body,onSuccess){
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
    const existing=body.requestId&&pending.find(op=>op.body.requestId===body.requestId);
    if(existing){existing.resolve=resolve;existing.reject=reject;existing.onSuccess=onSuccess;existing.body={...existing.body,...body};flush().catch(()=>{});return promise;}
    pending.push({path,body:structuredClone(body),onSuccess,resolve,reject});flush().catch(()=>{});
    return promise;
  }
  function event(kind,payload={}){const promise=enqueue('/api/chat-event',{eventId:uuid(),kind,payload});promise.catch(()=>{});return promise;}
  function chat(question,onSuccess,{requestId=uuid(),retry=false}={}){return enqueue('/api/chat',{requestId,question,...(retry?{retry:true}:{})},onSuccess);}
  return {event,chat,flush,state:()=>({conversationId,revision,pending:pending.length})};
}
