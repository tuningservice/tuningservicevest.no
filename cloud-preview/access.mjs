import {digest,JournalError} from '../server/chat-core.mjs';
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const json=value=>JSON.parse(new TextDecoder().decode(decode(value)));
const keys=new Map();
export async function verifyAccess(request,env,{fetchImpl=fetch,now=()=>Date.now()}={}){
 const domain=env.ACCESS_TEAM_DOMAIN,audience=env.ACCESS_AUD;
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain??'')||typeof audience!=='string'||!audience)throw new JournalError('access-not-configured',503);
 const token=request.headers.get('cf-access-jwt-assertion');
 if(!token||token.length>16384)throw new JournalError('access-required',401);
 try{
  const parts=token.split('.');if(parts.length!==3)throw Error();const header=json(parts[0]),claims=json(parts[1]);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200||claims.iss!=='https://'+domain||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=now()/1000||!Number.isFinite(claims.iat)||claims.iat>now()/1000+60||claims.nbf>now()/1000+60||typeof claims.sub!=='string'||!claims.sub||typeof claims.email!=='string')throw Error();
  let jwks=keys.get(domain);
  if(!jwks||jwks.expires<now()){
   const response=await fetchImpl('https://'+domain+'/cdn-cgi/access/certs',{redirect:'manual',signal:AbortSignal.timeout(6000)});
   const raw=await response.text();if(!response.ok||raw.length>100000)throw Error();
   jwks={keys:JSON.parse(raw).keys,expires:now()+300000};if(!Array.isArray(jwks.keys)||jwks.keys.length>30)throw Error();keys.set(domain,jwks);
  }
  const jwk=jwks.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error();
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error();
  const email=claims.email.toLowerCase(),allowed=String(env.TESTER_EMAILS??'').split(',').map(e=>e.trim().toLowerCase());
  if(!allowed.includes(email))throw Error();
  return {owner:digest([domain,claims.sub,email]),admin:String(env.ADMIN_EMAILS??'').split(',').map(e=>e.trim().toLowerCase()).includes(email)};
 }catch{throw new JournalError('access-required',401);}
}
