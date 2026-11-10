import {assistantApiPath} from './assistant-api-path.mjs';
import {assertAssistantResponse} from './assistant-response.mjs';
let started=null;
export function ensurePublicAssistantSession(){
 if(typeof document==='undefined'||!document.querySelector('meta[name="assistant-api-base"]'))return Promise.resolve();
 return started??=(async()=>{
  const mount=document.getElementById('assistant-security-status');if(!mount)throw Error('Missing security status');
  mount.hidden=false;mount.textContent='Klargjer trygg tilkopling …';
  const send=async token=>{
   const response=await fetch(assistantApiPath('/api/session'),{method:'POST',redirect:'manual',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(token?{token}:{})});
   assertAssistantResponse(response);
   const data=await response.json();return {response,data};
  };
  const existing=await send();if(existing.response.ok){mount.hidden=true;return;}
  if(existing.data.error?.code!=='challenge-required')throw Error('Trygg tilkopling er ikkje tilgjengeleg. Du kan framleis bruke kontaktskjemaet eller ringje Bjørn.');
  const sitekey=document.querySelector('meta[name="assistant-turnstile-sitekey"]')?.content;if(!sitekey)throw Error('Robotvernet er ikkje konfigurert.');
  await new Promise((resolve,reject)=>{
   if(window.turnstile){resolve();return;}
   const present=document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
   if(present){const began=Date.now(),timer=setInterval(()=>{if(window.turnstile){clearInterval(timer);resolve();}else if(Date.now()-began>15000){clearInterval(timer);reject(Error('Robotvernet svarar ikkje.'));}},100);return;}
   // Keep implicit rendering enabled for the existing independent contact
   // form. The assistant widget itself is rendered explicitly below.
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js';script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(Error('Robotvernet svarar ikkje.'));document.head.append(script);
  });
  mount.textContent='Stadfest trygg tilkopling om du blir beden om det.';
  const widget=document.createElement('div');mount.append(widget);
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Tilkoplinga tok for lang tid. Last sida på nytt eller kontakt Bjørn.')),90000);
   window.turnstile.render(widget,{sitekey,action:'assistant_session',size:'flexible',theme:'dark',
    callback:async token=>{try{const result=await send(token);if(!result.response.ok)throw Error('Kunne ikkje stadfeste tilkoplinga. Last sida på nytt eller kontakt Bjørn.');clearTimeout(timeout);resolve();}catch(e){clearTimeout(timeout);reject(e);}},
    'error-callback':()=>{clearTimeout(timeout);reject(Error('Robotvernet svarar ikkje. Last sida på nytt eller kontakt Bjørn.'));},
    'expired-callback':()=>{clearTimeout(timeout);reject(Error('Stadfestinga gjekk ut. Last sida på nytt for å prøve igjen.'));}
   });
  });
  mount.hidden=true;mount.replaceChildren();
 })().catch(error=>{const node=document.getElementById('assistant-security-status');if(node){node.hidden=false;node.textContent=error.message;}throw error;});
}
