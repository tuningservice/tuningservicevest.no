import {JournalError,digest} from './chat-journal.mjs';
const trusted=new WeakSet();
export const isChatMailDelivery=value=>trusted.has(value);
export class MailDeliveryError extends JournalError{
  constructor(code,{retry=false,retryAfterMs=0,uncertain=false}={}){super(code,503);Object.assign(this,{retry,retryAfterMs,uncertain});}
}
// Separate local test adapter. Does not change/deploy the shared production worker.
// A missing provider acknowledgement is NOT safe to retry automatically.
export function createChatMailDelivery({journal,env={},fetchImpl=fetch,now=()=>Date.now(),timeoutMs=8000}={}){
  const mode=env.CHAT_MAIL_MODE||'simulated';
  if(!['simulated','live-test'].includes(mode))throw new Error('Invalid CHAT_MAIL_MODE.');
  const missing=['MAILJET_API_KEY','MAILJET_API_SECRET'].filter(k=>!env[k]?.trim());
  const dailyLimit=Number(env.CHAT_MAIL_DAILY_LIMIT||25);
  if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>200)throw new Error('Invalid CHAT_MAIL_DAILY_LIMIT (1–200).');
  const db=journal.db,inflight=new Map();
  db.exec(`CREATE TABLE IF NOT EXISTS chat_mail_attempts(id TEXT PRIMARY KEY,fingerprint TEXT,state TEXT,attempted INTEGER,day TEXT,provider_uuid TEXT,error_code TEXT,next_attempt INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS chat_mail_daily(day TEXT PRIMARY KEY,attempts INTEGER);`);
  function status(){return {mode,configured:mode==='live-test'&&missing.length===0,missing:mode==='live-test'?missing:[],dailyLimit,attemptsToday:db.prepare('SELECT attempts FROM chat_mail_daily WHERE day=?').get(new Date(now()).toISOString().slice(0,10))?.attempts??0};}
  async function send({id,mail}){
    if(mode!=='live-test'||missing.length)throw new MailDeliveryError('mail-not-configured');
    if(typeof id!=='string'||mail?.to!=='vest@tuningservice.no'||!mail.subject?.startsWith('[LOKAL TEST]')||typeof mail.text!=='string')throw new MailDeliveryError('invalid-mail-envelope');
    const fingerprint=digest(mail),old=db.prepare('SELECT * FROM chat_mail_attempts WHERE id=?').get(id);
    if(old&&old.fingerprint!==fingerprint)throw new MailDeliveryError('request-changed');
    if(old?.state==='accepted')return {accepted:true,simulated:false};
    if(inflight.has(id))return inflight.get(id);
    if(['sending','uncertain'].includes(old?.state))throw new MailDeliveryError('mail-delivery-uncertain',{uncertain:true});
    if(old?.state==='failed'&&old.error_code!=='mail-access-denied')throw new MailDeliveryError(old.error_code||'mail-provider-rejected');
    if(old?.next_attempt>now())throw new MailDeliveryError(old.error_code,{retry:true,retryAfterMs:old.next_attempt-now()});
    const day=new Date(now()).toISOString().slice(0,10);
    if((db.prepare('SELECT attempts FROM chat_mail_daily WHERE day=?').get(day)?.attempts??0)>=dailyLimit)throw new MailDeliveryError('mail-daily-limit',{retry:true,retryAfterMs:86400000});
    db.prepare("INSERT INTO chat_mail_attempts VALUES(?,?,'sending',?,?,NULL,NULL,0) ON CONFLICT(id) DO UPDATE SET state='sending',attempted=excluded.attempted,day=excluded.day,error_code=NULL").run(id,fingerprint,now(),day);
    db.prepare('INSERT INTO chat_mail_daily VALUES(?,1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1').run(day);
    const pending=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const message={From:{Email:'skjema@meldingar.vevsmia.no',Name:'Tuningservice Vest'},To:[{Email:'vest@tuningservice.no',Name:'Tuningservice Vest'}],Subject:mail.subject,TextPart:mail.text,TrackOpens:'disabled',TrackClicks:'disabled',CustomID:'tsv-test-'+digest(id).slice(0,40)};
        if(mail.html)message.HTMLPart=mail.html;
        if(mail.replyTo)message.ReplyTo={Email:mail.replyTo};
        if(mail.attachments?.length)message.Attachments=mail.attachments.map(a=>({ContentType:a.contentType,Filename:a.filename,Base64Content:a.contentBase64}));
        const body=JSON.stringify({Messages:[message]});if(Buffer.byteLength(body)>8*1024*1024)throw new MailDeliveryError('mail-too-large');
        const response=await fetchImpl('https://api.mailjet.com/v3.1/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(env.MAILJET_API_KEY+':'+env.MAILJET_API_SECRET).toString('base64')},body,signal:controller.signal});
        if(response.status===429){const raw=response.headers.get('retry-after'),seconds=Number(raw),wait=Math.max(1000,raw?(Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-now()):60000);throw new MailDeliveryError('mail-quota',{retry:true,retryAfterMs:Number.isFinite(wait)?wait:60000});}
        // A 5xx can occur after acceptance. Hold rather than risk duplicate email.
        if(response.status>=500)throw new MailDeliveryError('mail-delivery-uncertain',{uncertain:true});
        if(!response.ok)throw new MailDeliveryError([401,403].includes(response.status)?'mail-access-denied':'mail-provider-rejected');
        const data=await response.json(),item=data?.Messages?.[0];
        if(item?.Status==='error')throw new MailDeliveryError('mail-provider-rejected');
        const uuid=item?.To?.[0]?.MessageUUID;
        if(item?.Status!=='success'||typeof uuid!=='string'||!uuid)throw new MailDeliveryError('mail-delivery-uncertain',{uncertain:true});
        db.prepare("UPDATE chat_mail_attempts SET state='accepted',provider_uuid=?,error_code=NULL WHERE id=?").run(uuid,id);
        return {accepted:true,simulated:false};
      }catch(error){
        const safe=error instanceof MailDeliveryError?error:new MailDeliveryError('mail-delivery-uncertain',{uncertain:true});
        db.prepare('UPDATE chat_mail_attempts SET state=?,error_code=?,next_attempt=? WHERE id=?').run(safe.uncertain?'uncertain':safe.retry?'retry':'failed',safe.code,now()+safe.retryAfterMs,id);
        throw safe;
      }finally{clearTimeout(timer);inflight.delete(id);}
    })();inflight.set(id,pending);return pending;
  }
  const adapter={mode,status,send};trusted.add(adapter);return adapter;
}
