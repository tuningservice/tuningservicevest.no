import {CHAT_CONTACT_TYPE,renderChatEmail} from './chat-contact-mail.mjs';
// Implements the existing private binding's fetch interface for a NEW type/route.
// It deliberately has no Mailjet credentials, public send route or live fallback.
export function createLocalChatMailWorker({journal,delayMs=600,now=()=>Date.now()}){
  let failNext=false;
  return {mode:'local-simulated',failNext(){failNext=true;},async fetch(url,init){
    if(url!=='https://internal/chat-contact'||init?.method!=='POST')return Response.json({ok:false},{status:400});
    let envelope;try{envelope=JSON.parse(init.body);}catch{return Response.json({ok:false},{status:400});}
    if(envelope?.type!==CHAT_CONTACT_TYPE||envelope.to!=='vest@tuningservice.no'||!Array.isArray(envelope.events)||!envelope.contact?.email&&!envelope.contact?.phone)return Response.json({ok:false},{status:400});
    renderChatEmail(envelope);
    if(journal.db.prepare('SELECT id FROM simulated_deliveries WHERE id=?').get(envelope.id))return Response.json({ok:true,accepted:true,simulated:true});
    if(delayMs)await new Promise(r=>setTimeout(r,delayMs));
    if(failNext){failNext=false;return Response.json({ok:false,simulated:true},{status:502});}
    journal.db.prepare('INSERT OR IGNORE INTO simulated_deliveries VALUES(?,?)').run(envelope.id,new Date(now()).toISOString());
    return Response.json({ok:true,accepted:true,simulated:true});
  }};
}
