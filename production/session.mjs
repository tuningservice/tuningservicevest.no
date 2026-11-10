import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {JournalError,digest} from '../server/chat-core.mjs';
export const SESSION_COOKIE='__Host-tsv-visitor',SESSION_SECONDS=8*60*60;
const mac=(key,value)=>createHmac('sha256',key).update(value).digest('base64url');
function keyOf(env){if(typeof env.ASSISTANT_SESSION_SECRET!=='string'||env.ASSISTANT_SESSION_SECRET.length<64)throw new JournalError('public-not-configured',503);return env.ASSISTANT_SESSION_SECRET;}
export function visitorCookie(env,{now=Date.now(),id=randomUUID()}={}){
 const payload=Buffer.from(JSON.stringify({v:1,id,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+SESSION_SECONDS})).toString('base64url');
 const value=payload+'.'+mac(keyOf(env),payload);
 return {owner:digest(['public-visitor',id]),cookie:SESSION_COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+SESSION_SECONDS};
}
export function verifyVisitor(request,env,{now=()=>Date.now()}={}){
 const key=keyOf(env),value=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 try{
  if(!value||value.length>1024)throw Error();const parts=value.split('.');if(parts.length!==2)throw Error();
  const expected=Buffer.from(mac(key,parts[0])),actual=Buffer.from(parts[1]);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();
  const p=JSON.parse(Buffer.from(parts[0],'base64url').toString());
  if(p.v!==1||!/^[a-f0-9-]{36}$/.test(p.id)||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.exp<=now()/1000||p.iat>now()/1000+60||p.exp-p.iat!==SESSION_SECONDS)throw Error();
  return {owner:digest(['public-visitor',p.id]),admin:false};
 }catch{throw new JournalError('visitor-session-required',401);}
}
export function requestRateIdentity(request,env,{now=Date.now()}={}){
 // Cloudflare overwrites this header at its edge. Never persist/log the IP.
 const address=request.headers.get('cf-connecting-ip');if(!address||address.length>64)throw new JournalError('edge-required',503);
 return mac(keyOf(env),new Date(now).toISOString().slice(0,10)+':'+address);
}
export async function verifyVisitorChallenge(token,request,env,{fetchImpl=fetch,now=Date.now()}={}){
 if(typeof env.TURNSTILE_SECRET_KEY!=='string'||!env.TURNSTILE_SECRET_KEY)throw new JournalError('public-not-configured',503);
 if(typeof token!=='string'||!token||token.length>2048)throw new JournalError('challenge-required',400);
 const response=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',redirect:'error',signal:AbortSignal.timeout(7000),headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,idempotency_key:randomUUID()})});
 const raw=await response.text();let data;try{if(raw.length>16384)throw Error();data=JSON.parse(raw);}catch{throw new JournalError('challenge-unavailable',503);}
 const stamp=Date.parse(data.challenge_ts),hostname=new URL(request.url).hostname;
 if(!response.ok||data.success!==true||data.hostname!==hostname||data.action!=='assistant_session'||!Number.isFinite(stamp)||stamp>now+60000||stamp<now-300000)throw new JournalError('challenge-required',400);
 return true;
}
