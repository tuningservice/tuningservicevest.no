// A changed preview revision alone must NOT create a new request after a lost
// acknowledgement: the server may already have recorded our own receipt.
export function createContactAttempt({uuid=()=>crypto.randomUUID()}={}){
  let saved=null,key=null;
  function reset(){saved=null;key=null;}
  function prepare(values){
    const next=JSON.stringify([values.conversationId,values.anchorEventId??null,values.contact,values.name??'',values.message??'']);
    if(!saved||next!==key){saved={...values,requestId:uuid()};key=next;}
    return structuredClone(saved);
  }
  return {reset,prepare};
}
