import {randomUUID} from 'node:crypto';
import {ChatError} from '../server/chat-ai.mjs';
// $5 AI reserve, in micro-USD; the other $5 of the agreed envelope is reserved
// for a possible base Workers subscription. Not an account-wide billing cap.
export function budgetedFetch(repository,owner,env,fetchImpl=fetch){
 return async function guardedFetch(url,options){
  if(url!=='https://api.openai.com/v1/responses')return fetchImpl(url,options);
  const body=JSON.parse(options.body);
  if(body.model!=='gpt-6-luna'||env.OPENAI_MODEL!=='gpt-6-luna'||body.max_output_tokens>1200)throw new ChatError('ai-account-limit',503);
  await repository.limit('ai:'+owner,20,60000);
  const budgetId=env.AI_BUDGET_PERIOD==='monthly'?'production-ai:'+new Date(repository.now()).toISOString().slice(0,7):'private-test-ai';
  if(env.AI_BUDGET_PERIOD==='monthly')await repository.p('INSERT OR IGNORE INTO cloud_budget(id,ceiling) VALUES(?,5000000)',budgetId).run();
  // One micro-dollar per possible token is deliberately above the verified
  // input/output rate for this model. UTF-8 bytes + output limit + overhead is
  // an upper reservation. Failed/uncertain calls retain the reservation.
  const amount=new TextEncoder().encode(options.body).length+body.max_output_tokens+8192,id=randomUUID();
  const row=await repository.p("UPDATE cloud_budget SET reserved=reserved+? WHERE id=? AND reserved+?<=ceiling RETURNING reserved",amount,budgetId,amount).first();
  if(!row)throw new ChatError('ai-local-budget',429);
  await repository.p('INSERT INTO cloud_budget_calls VALUES(?,?,?)',id,amount,repository.now()).run();
  const response=await fetchImpl(url,options);
  if(response.ok){
   try{
    const raw=await response.clone().text();if(raw.length<=131072){const actual=JSON.parse(raw).usage?.total_tokens;
     if(Number.isSafeInteger(actual)&&actual>0&&actual<amount){
      // Conditional debit refund FIRST, then close that exact reservation in
      // the same D1 transaction. Retrying the batch cannot refund it twice.
      await repository.db.batch([
       repository.p("UPDATE cloud_budget SET reserved=reserved-? WHERE id=? AND EXISTS(SELECT 1 FROM cloud_budget_calls WHERE id=? AND amount=?)",amount-actual,budgetId,id,amount),
       repository.p('UPDATE cloud_budget_calls SET amount=? WHERE id=? AND amount=?',actual,id,amount)
      ]);
     }
    }
   }catch{/* Uncertain accounting keeps the full safe reservation. */}
  }
  return response;
 };
}
