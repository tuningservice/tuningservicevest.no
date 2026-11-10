import {createSkyWorker} from '../cloud-preview/worker.mjs';
import {cloudFetch} from '../cloud-preview/fetch.mjs';
import {verifyAccess} from '../cloud-preview/access.mjs';
import {cloudRepository} from '../cloud-preview/repository.mjs';
import {JournalError} from '../server/chat-core.mjs';
import {verifyVisitor,visitorCookie,requestRateIdentity,verifyVisitorChallenge} from './session.mjs';
const answer=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
const publicApi=new Set(['chat-status','chat-session','chat','chat-event','chat-end','chat-contact','chat-contact-preview','vehicle-catalog','vehicle-lookup','vehicle-brand-logo','chat-vehicle-proposal','chat-base-vehicle','chat-dvx-facts']);
export function createProductionWorker({fetchImpl=cloudFetch,now=()=>Date.now(),access=verifyAccess}={}){
 const inner=createSkyWorker({authenticate:(request,env)=>verifyVisitor(request,env,{now}),fetchImpl,now});
 const admin=createSkyWorker({authenticate:access,fetchImpl,now}),adminEnvs=new WeakMap(),previewEnvs=new WeakMap();
 return {
  async fetch(request,env,execution){
   try{
    const url=new URL(request.url);
    if(env.REDIRECT_HOSTNAME&&url.hostname===env.REDIRECT_HOSTNAME){url.hostname=env.TEST_HOSTNAME;return Response.redirect(url.href,308);}
    if(url.hostname===env.ADMIN_HOSTNAME&&url.pathname.startsWith('/release-preview/')&&env.RELEASE_PRIVATE!=='true'){
     let preview=previewEnvs.get(env);if(!preview){preview={...env,TEST_HOSTNAME:env.ADMIN_HOSTNAME,RELEASE_PRIVATE:'true',PUBLIC_BASE_PATH:'/release-preview'};previewEnvs.set(env,preview);}env=preview;
    }
    const prefix=env.PUBLIC_BASE_PATH??'',apiBase=prefix+'/api/assistant';
    if(env.RELEASE_PRIVATE==='true')await access(request,env,{fetchImpl,now});
    // Admin reuses the existing Access-protected skytest host, under its own
    // production route. A visitor cookie can never grant administration.
    if(url.hostname===env.ADMIN_HOSTNAME&&url.pathname.startsWith('/production-admin/')){
     await access(request,env,{fetchImpl,now});
     let adminEnv=adminEnvs.get(env);if(!adminEnv){adminEnv={...env,TEST_HOSTNAME:env.ADMIN_HOSTNAME,ADMIN_ALL_OWNERS:'true'};adminEnvs.set(env,adminEnv);}
     url.pathname=url.pathname.slice('/production-admin'.length);if(url.pathname==='/')url.pathname='/test/admin/';
     return admin.fetch(new Request(url,request),adminEnv,execution);
    }
    if(url.hostname!==env.TEST_HOSTNAME||!url.pathname.startsWith(prefix+'/'))throw new JournalError('not-found',404);
    if(env.DEPLOYMENT_ENV==='production'&&env.RELEASE_PRIVATE!=='true'&&(env.PUBLIC_RELEASE_APPROVED!=='true'||env.ASSISTANT_ENABLED!=='true'))throw new JournalError('assistant-paused',503);
    if(url.pathname===apiBase+'/session'){
     if(request.method!=='POST')throw new JournalError('method-not-allowed',405);
     if(request.headers.get('origin')!==url.origin)throw new JournalError('invalid-origin',403);
     if(!env.CHAT_DB||!env.ASSETS)throw new JournalError('public-not-configured',503);
     const repo=cloudRepository(env.CHAT_DB,{now}),ip=requestRateIdentity(request,env,{now:now()});
     await repo.limit('session-ip:'+ip,5,60000);await repo.limit('session-day:'+ip,30,86400000);
     // Returning a valid existing session does not consume a fresh challenge.
     try{verifyVisitor(request,env,{now});return answer({ok:true});}catch(error){if(error.code!=='visitor-session-required')throw error;}
     if(!request.headers.get('content-type')?.startsWith('application/json'))throw new JournalError('invalid-input');
     const reader=request.body?.getReader();let bytes=0,chunks=[];if(!reader)throw new JournalError('invalid-input');
     for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>4096){await reader.cancel();throw new JournalError('payload-too-large',413);}chunks.push(next.value);}
     let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new JournalError('invalid-input');}
     if(!input||Object.keys(input).some(k=>k!=='token'))throw new JournalError('invalid-input');
     await verifyVisitorChallenge(input.token,request,env,{fetchImpl,now:now()});
     return answer({ok:true},200,{'Set-Cookie':visitorCookie(env,{now:now()}).cookie});
    }
    if(url.pathname.startsWith(apiBase+'/')){
     const name=url.pathname.slice(apiBase.length+1),user=verifyVisitor(request,env,{now}),repo=cloudRepository(env.CHAT_DB,{now}),ip=requestRateIdentity(request,env,{now:now()});
     await repo.limit('public-api-ip:'+ip,180,60000);
     if(name==='chat'){await repo.limit('ai-ip:'+ip,10,60000);await repo.limit('ai-day:'+ip,60,86400000);}
     if(name==='vehicle-lookup'){await repo.limit('lookup-ip:'+ip,10,60000);await repo.limit('lookup-day:'+ip,50,86400000);}
     if(name==='chat-contact'){await repo.limit('contact-ip:'+ip,3,60000);await repo.limit('contact-day:'+ip,10,86400000);}
     if(name.startsWith('catalogue/')&&/^[a-f0-9]{16}-\d+\.json$/.test(name.slice(10)))url.pathname='/data/cloud/'+name.slice(10);
     else if(name==='catalogue-manifest')url.pathname='/data/chat/dvx-snapshot.json';
     else if(publicApi.has(name))url.pathname='/api/'+name;
     else throw new JournalError('not-found',404);
     const response=await inner.fetch(new Request(url,request),env,execution);
     return response;
    }
    if(env.RELEASE_PRIVATE==='true'&&['GET','HEAD'].includes(request.method)){
     url.pathname=url.pathname.slice(prefix.length)||'/';
     const response=await env.ASSETS.fetch(new Request(url,request)),headers=new Headers(response.headers);
     headers.set('X-Robots-Tag','noindex, nofollow');headers.set('Cache-Control','no-store');
     if(response.headers.get('content-type')?.startsWith('text/html')){
      let html=await response.text();
      html=html.replaceAll('content="/api/assistant"','content="'+apiBase+'"').replace(/(href|src|action)="\/(?!\/)/g,'$1="'+prefix+'/');
      html=html.replace(/(<body[^>]*>)/,'$1<p class="release-preview-note">Privat publiseringsprøve – ikkje offentleg lansert. E-postmodus blir vist ved kontakt.</p>');
      return new Response(html,{status:response.status,headers});
     }
     return new Response(response.body,{status:response.status,headers});
    }
    throw new JournalError('not-found',404);
   }catch(error){return answer({error:{code:error instanceof JournalError?error.code:'public-unavailable'}},error instanceof JournalError?error.status:503);}
  },
  scheduled:(event,env,execution)=>inner.scheduled(event,env,execution)
 };
}
export default createProductionWorker();
