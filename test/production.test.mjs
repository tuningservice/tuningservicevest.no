import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {visitorCookie,verifyVisitor,verifyVisitorChallenge,requestRateIdentity} from '../production/session.mjs';
import {createProductionWorker} from '../production/worker.mjs';
import {budgetedFetch} from '../cloud-preview/budget.mjs';
import {cloudRepository} from '../cloud-preview/repository.mjs';
import {assistantApiPath} from '../js/assistant-api-path.mjs';
import {assertAssistantResponse} from '../js/assistant-response.mjs';
import {renderNotificationEmail} from '../server/chat-notification-mail.mjs';
const schema=await readFile(new URL('../cloud-preview/schema/0002-cloud-state.sql',import.meta.url),'utf8');
const secret='synthetic-session-key-'.repeat(4);
function dbFor(t){
 const sql=new DatabaseSync(':memory:');sql.exec(schema);t.after(()=>sql.close());
 const prepared=(query,args=[])=>({bind:(...a)=>prepared(query,a),async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return this._run();},_run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}});
 const db={prepare:prepared,withSession(){return db;},async batch(rows){sql.exec('BEGIN');try{const result=rows.map(r=>r._run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {sql,db};
}
test('public session cookie is signed, expires, cannot become admin and does not contain an IP',()=>{
 const env={ASSISTANT_SESSION_SECRET:secret},time=Date.now(),{cookie,owner}=visitorCookie(env,{now:time});
 assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);assert.match(cookie,/Path=\//);
 const req=new Request('https://tuningservicevest.no/',{headers:{Cookie:cookie.split(';')[0]}});
 assert.deepEqual(verifyVisitor(req,env,{now:()=>time}),{owner,admin:false});
 assert.throws(()=>verifyVisitor(req,env,{now:()=>time+8*3600000+1}),/visitor-session-required/);
 assert.throws(()=>verifyVisitor(new Request(req,{headers:{Cookie:cookie.replace(/visitor=./,'visitor=x')}}),env),/visitor-session-required/);
 assert.throws(()=>verifyVisitor(req,{}),/public-not-configured/);
 const ip=requestRateIdentity(new Request(req,{headers:{'cf-connecting-ip':'198.51.100.5'}}),env,{now:time});
 assert.doesNotMatch(ip,/198\.51/);assert.notEqual(ip,requestRateIdentity(new Request(req,{headers:{'cf-connecting-ip':'198.51.100.5'}}),env,{now:time+86400000}));
});
test('Turnstile validates success, exact hostname, action and five-minute age',async()=>{
 const env={TURNSTILE_SECRET_KEY:'synthetic'},req=new Request('https://tuningservicevest.no/'),time=Date.now();
 const valid={success:true,hostname:'tuningservicevest.no',action:'assistant_session',challenge_ts:new Date(time).toISOString()};
 for(const change of [{success:false},{hostname:'evil.invalid'},{action:'contact'},{challenge_ts:new Date(time-301000).toISOString()}]){
  await assert.rejects(verifyVisitorChallenge('synthetic-token',req,env,{now:time,fetchImpl:async()=>Response.json({...valid,...change})}),/challenge-required/);
 }
 assert.equal(await verifyVisitorChallenge('synthetic-token',req,env,{now:time,fetchImpl:async()=>Response.json(valid)}),true);
});
test('public routing requires session, denies admin/test endpoints and isolates visitors even when the conversation ID is known',async t=>{
 const {db}=dbFor(t),env={TEST_HOSTNAME:'tuningservicevest.no',ASSISTANT_SESSION_SECRET:secret,CHAT_DB:db,ASSETS:{fetch:async()=>Response.json({delivery:'brand-chunks',brands:[],vehicleBrands:{}})}};
 const worker=createProductionWorker(),ctx={waitUntil(){}};
 const call=(name,input,cookie)=>worker.fetch(new Request('https://tuningservicevest.no/api/assistant/'+name,{method:input?'POST':'GET',headers:{'cf-connecting-ip':'198.51.100.5',Origin:'https://tuningservicevest.no',...(cookie?{Cookie:cookie}:{}),...(input?{'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})}),env,ctx);
 assert.equal((await call('chat-status')).status,401);
 const a=visitorCookie(env).cookie.split(';')[0],b=visitorCookie(env).cookie.split(';')[0];
 assert.equal((await call('cloud-admin',{action:'search'},a)).status,404);
 assert.equal((await call('vehicle-demo',{scenario:'x'},a)).status,404);
 const first=await call('chat-session',{},a);assert.equal(first.status,200);const session=await first.json();
 assert.equal((await call('chat-event',{conversationId:session.conversationId,eventId:randomUUID(),kind:'reset',payload:{}},b)).status,409);
 const evil=new Request('https://tuningservicevest.no/api/assistant/chat-session',{method:'POST',headers:{Cookie:a,Origin:'https://evil.invalid','cf-connecting-ip':'198.51.100.5','Content-Type':'application/json'},body:'{}'});
 assert.equal((await worker.fetch(evil,env,ctx)).status,403);
 assert.equal((await worker.fetch(new Request('https://other.invalid/api/assistant/chat-status'),env,ctx)).status,404);
});
test('bootstrap issues the cookie only after challenge and enforces shared IP limits',async t=>{
 const {db}=dbFor(t),time=Date.now(),env={TEST_HOSTNAME:'tuningservicevest.no',ASSISTANT_SESSION_SECRET:secret,TURNSTILE_SECRET_KEY:'synthetic',CHAT_DB:db,ASSETS:{}};
 let calls=0;const worker=createProductionWorker({now:()=>time,fetchImpl:async()=>{calls++;return Response.json({success:true,hostname:env.TEST_HOSTNAME,action:'assistant_session',challenge_ts:new Date(time).toISOString()});}});
 const req=token=>new Request('https://tuningservicevest.no/api/assistant/session',{method:'POST',headers:{Origin:'https://tuningservicevest.no','cf-connecting-ip':'198.51.100.5','Content-Type':'application/json'},body:JSON.stringify(token?{token}:{})});
 const denied=await worker.fetch(req(),env,{});assert.equal(denied.status,400);assert.equal(denied.headers.get('set-cookie'),null);
 const ok=await worker.fetch(req('synthetic'),env,{});assert.equal(ok.status,200);assert.ok(ok.headers.get('set-cookie'));
 for(let i=0;i<3;i++)await worker.fetch(req(),env,{});
 assert.equal((await worker.fetch(req(),env,{})).status,429);assert.equal(calls,1);
});
test('monthly AI reservation survives new instances, stops before provider, and rolls over at a UTC month boundary',async t=>{
 const {db,sql}=dbFor(t);let time=Date.UTC(2026,10,30,23,59),calls=0;const repo=cloudRepository(db,{now:()=>time}),env={OPENAI_MODEL:'gpt-6-luna',AI_BUDGET_PERIOD:'monthly'};
 const options={body:JSON.stringify({model:'gpt-6-luna',max_output_tokens:1200})},provider=async()=>{calls++;return Response.json({usage:{total_tokens:10}});};
 await budgetedFetch(repo,'a',env,provider)('https://api.openai.com/v1/responses',options);
 assert.equal(sql.prepare("SELECT reserved FROM cloud_budget WHERE id='production-ai:2026-11'").get().reserved,10);
 sql.prepare("UPDATE cloud_budget SET reserved=5000000 WHERE id='production-ai:2026-11'").run();
 await assert.rejects(budgetedFetch(cloudRepository(db,{now:()=>time}),'a',env,provider)('https://api.openai.com/v1/responses',options),/ai-local-budget/);assert.equal(calls,1);
 time+=120000;await budgetedFetch(repo,'a',env,provider)('https://api.openai.com/v1/responses',options);assert.equal(calls,2);
 assert.equal(sql.prepare("SELECT ceiling FROM cloud_budget WHERE id='production-ai:2026-12'").get().ceiling,5000000);
});
test('production API path mapping leaves existing contact endpoint unchanged',()=>{
 assert.equal(assistantApiPath('/api/chat','/api/assistant'),'/api/assistant/chat');
 assert.equal(assistantApiPath('/data/cloud/abc.json','/api/assistant'),'/api/assistant/catalogue/abc.json');
 assert.equal(assistantApiPath('/data/chat/dvx-snapshot.json','/api/assistant'),'/api/assistant/catalogue-manifest');
 assert.equal(assistantApiPath('/api/chat','/release-preview/api/assistant'),'/release-preview/api/assistant/chat');
 assert.equal(assistantApiPath('/api/contact',''),'/api/contact');
 assert.throws(()=>assistantApiPath('/api/chat','https://evil.invalid'));
});

test('expired private Access is distinguished from AI errors, without discarding the question',()=>{
 for(const response of [{type:'opaqueredirect'}, {redirected:true}])assert.throws(()=>assertAssistantResponse(response),e=>e.code==='private-login-expired'&&e.data.answer.includes('Meldinga di er bevart'));
 assert.doesNotThrow(()=>assertAssistantResponse({type:'basic',redirected:false,status:503}));
});

test('public release stays disabled while private candidate and admin still require Access',async()=>{
 const env={DEPLOYMENT_ENV:'production',PUBLIC_RELEASE_APPROVED:'false',ASSISTANT_ENABLED:'false',TEST_HOSTNAME:'tuningservicevest.no',ADMIN_HOSTNAME:'skytest.tuningservicevest.no'};
 const worker=createProductionWorker({access:async()=>{throw new (await import('../server/chat-core.mjs')).JournalError('access-required',401);}});
 const publicResponse=await worker.fetch(new Request('https://tuningservicevest.no/api/assistant/chat-status'),env,{});
 assert.equal(publicResponse.status,503);assert.equal((await publicResponse.json()).error.code,'assistant-paused');
 for(const path of ['/release-preview/','/release-preview/js/chat-preview.mjs','/release-preview/api/assistant/chat-status','/production-admin/'])assert.equal((await worker.fetch(new Request('https://skytest.tuningservicevest.no'+path),env,{})).status,401);
});

test('production notification has no test subject, keeps a compact body and attaches every original message',()=>{
 const events=Array.from({length:120},(_,i)=>({at:'2026-11-09T10:00:00Z',epoch:i<60?1:2,role:'user',kind:'question',text:'Melding '+i+' '+('ø'.repeat(900))}));
 const mail=renderNotificationEmail({production:true,simulated:false,to:'vest@tuningservice.no',site:'https://tuningservicevest.no',id:'synthetic',createdAt:'2026-11-09T10:00:00Z',type:'usage.conversation.v1',reason:'idle',events,context:null});
 assert.doesNotMatch(mail.subject,/TEST/);assert.doesNotMatch(mail.text,/Lokal test/);assert.ok(mail.text.length<3000);
 const attached=Buffer.from(mail.attachments[0].contentBase64,'base64').toString();assert.match(attached,/Melding 0 /);assert.match(attached,/Melding 119 /);assert.match(attached,/BILKONTEKST 1/);assert.match(attached,/BILKONTEKST 2/);
});

test('the exact www alias preserves path/query while redirecting to the working canonical host',async()=>{
 const env={TEST_HOSTNAME:'tuningservicevest.no',REDIRECT_HOSTNAME:'www.tuningservicevest.no'};
 const worker=createProductionWorker();
 const r=await worker.fetch(new Request('https://www.tuningservicevest.no/diagnose/?emne=Diagnose'),env,{});
 assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://tuningservicevest.no/diagnose/?emne=Diagnose');
 assert.equal((await worker.fetch(new Request('https://www.evil.invalid/'),env,{})).status,404);
});
