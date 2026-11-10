import {renderNotificationEmail} from './chat-notification-mail.mjs';
import {randomUUID} from 'node:crypto';
import {digest,validUuid,JournalError} from './chat-core.mjs';
import {contextText} from './chat-contact-mail.mjs';
import {OFFER_RECIPIENT,OFFER_SITE} from './vehicle-offer.mjs';
import {isChatMailDelivery} from './chat-mail-delivery.mjs';
import {presentCompactMail,mailVehicleFields} from './chat-mail-presentation.mjs';

const activityKinds=new Set(['question','reset','lookup-input','lookup-start','registered','selection','result','stage','service']);
const ignoredKinds=new Set(['intro','contact-receipt']);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=n=>new Date(n).toISOString();
// These tables contain private customer data, never application/console logs.
export function createChatNotifications({journal,now=()=>Date.now(),idleMs=300000,transport=null,deliveryDelayMs=0}={}){
  if(transport!==null&&!isChatMailDelivery(transport))throw new Error('Untrusted live notification delivery is disabled.');
  const simulated=transport?.mode!=='live-test';
  const db=journal.db,inflight=new Map();let draining=null,failMode=null;
  db.exec(`CREATE TABLE IF NOT EXISTS notification_meta(key TEXT PRIMARY KEY,value INTEGER);
    CREATE TABLE IF NOT EXISTS notification_sessions(conversation TEXT PRIMARY KEY,last_activity INTEGER,revision INTEGER,due INTEGER,covered INTEGER DEFAULT 0,ended INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS notification_lookups(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,registration TEXT,started INTEGER,deadline INTEGER,response TEXT);
    CREATE TABLE IF NOT EXISTS notification_outbox(id TEXT PRIMARY KEY,kind TEXT,conversation TEXT,revision INTEGER,created INTEGER,status TEXT,attempts INTEGER DEFAULT 0,next_attempt INTEGER,lease_until INTEGER DEFAULT 0,envelope TEXT,mail TEXT,error_code TEXT);
    CREATE INDEX IF NOT EXISTS notification_due ON notification_outbox(status,next_attempt);
    CREATE TABLE IF NOT EXISTS notification_receipts(id TEXT PRIMARY KEY,accepted INTEGER);`);
  // Do not retroactively notify for all historical local tests on first install.
  db.prepare("INSERT OR IGNORE INTO notification_meta VALUES('cursor',?)").run(db.prepare('SELECT COALESCE(MAX(seq),0) n FROM events').get().n);
  const previousMode=db.prepare("SELECT value FROM notification_meta WHERE key='delivery-mode'").get()?.value;
  if(!simulated&&previousMode!=='live-test'){
    // Activation starts with NEW activity only. Never mail old test history.
    db.prepare('UPDATE notification_sessions SET covered=MAX(covered,revision)').run();
    db.prepare("UPDATE notification_meta SET value=? WHERE key='cursor'").run(db.prepare('SELECT COALESCE(MAX(seq),0) n FROM events').get().n);
    db.prepare("INSERT OR REPLACE INTO notification_meta VALUES('live-since',?)").run(now());
  }
  db.prepare("INSERT OR REPLACE INTO notification_meta VALUES('delivery-mode',?)").run(simulated?'simulated':'live-test');
  const liveSince=db.prepare("SELECT value FROM notification_meta WHERE key='live-since'").get()?.value??Infinity;
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
  function enqueue(id,kind,conversation,revision,envelope){
    const mail=renderNotificationEmail(envelope);
    db.prepare("INSERT OR IGNORE INTO notification_outbox(id,kind,conversation,revision,created,status,next_attempt,envelope,mail) VALUES(?,?,?,?,?,'pending',?,?,?)").run(id,kind,conversation,revision,now(),now(),JSON.stringify(envelope),JSON.stringify(mail));
  }
  function scan(){return transaction(()=>{
    let cursor=db.prepare("SELECT value FROM notification_meta WHERE key='cursor'").get().value;
    for(const e of db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT 500').all(cursor)){
      cursor=e.seq;if(ignoredKinds.has(e.kind))continue;
      const old=db.prepare('SELECT * FROM notification_sessions WHERE conversation=?').get(e.conversation);
      if(!old&&!activityKinds.has(e.kind)&&e.kind!=='conversation-end')continue;
      const active=activityKinds.has(e.kind),at=Date.parse(e.at),last=active?Math.max(old?.last_activity??0,at):old?.last_activity??at;
      const ended=e.kind==='conversation-end'?1:active?0:old?.ended??0;
      const due=ended?now():last+idleMs;
      const revision=e.kind==='conversation-end'?(old?.revision??0):e.seq;
      db.prepare('INSERT INTO notification_sessions VALUES(?,?,?,?,?,?) ON CONFLICT(conversation) DO UPDATE SET last_activity=excluded.last_activity,revision=excluded.revision,due=excluded.due,ended=excluded.ended').run(e.conversation,last,revision,due,old?.covered??0,ended);
      // An unsent snapshot must not overtake newer activity. Rebuild after idle.
      db.prepare("UPDATE notification_outbox SET status='superseded' WHERE conversation=? AND kind='conversation' AND revision<? AND status IN ('pending','retry')").run(e.conversation,revision);
    }
    db.prepare("UPDATE notification_meta SET value=? WHERE key='cursor'").run(cursor);
    return !db.prepare('SELECT 1 FROM events WHERE seq>? LIMIT 1').get(cursor);
  });}
  function schedule(){
    if(!scan())return false;
    for(const s of db.prepare('SELECT * FROM notification_sessions WHERE due<=? AND revision>covered').all(now())){
      // Never mail an unfinished AI turn. Its answer will be picked up by scan.
      if(db.prepare("SELECT 1 FROM chat_requests WHERE conversation=? AND status='pending'").get(s.conversation))continue;
      const c=journal.get(s.conversation),events=journal.events(s.conversation);
      const envelope={type:'usage.conversation.v1',id:'conversation:'+s.conversation+':'+s.revision,to:OFFER_RECIPIENT,site:OFFER_SITE,simulated,createdAt:iso(now()),conversationId:s.conversation,revision:s.revision,reason:s.ended?'explicit-end':'idle',context:c.context,events};
      transaction(()=>{
        enqueue(envelope.id,'conversation',s.conversation,s.revision,envelope);
        db.prepare('UPDATE notification_sessions SET covered=MAX(covered,?) WHERE conversation=?').run(s.revision,s.conversation);
      });
    }
    // Interrupted upstream attempts become explicit failed attempts, not a new
    // register request. Resuming the browser uses the same request identity.
    for(const r of db.prepare('SELECT * FROM notification_lookups WHERE response IS NULL AND deadline<=?').all(now()))finishLookup(r,{status:503,data:{error:{code:'interrupted'}}});
    return true;
  }
  function finishLookup(row,response){
    transaction(()=>{
      if(db.prepare('SELECT response FROM notification_lookups WHERE id=?').get(row.id).response)return;
      db.prepare('UPDATE notification_lookups SET response=? WHERE id=?').run(JSON.stringify(response),row.id);
      const envelope={type:'usage.lookup.v1',id:'lookup:'+row.id,to:OFFER_RECIPIENT,site:OFFER_SITE,simulated:simulated||row.started<liveSince,createdAt:iso(now()),startedAt:iso(row.started),conversationId:row.conversation,registration:row.registration,outcome:{status:response.status,code:response.data?.error?.code??'found'},vehicle:response.data?.vehicle??null,candidates:response.data?.candidates??[],testData:response.data?.simulated===true};
      enqueue(envelope.id,'lookup',row.conversation,0,envelope);
    });
  }
  async function lookup({requestId=randomUUID(),conversationId=null,registration},perform){
    if(!validUuid(requestId)||typeof registration!=='string'||! /^[A-Z0-9]{2,7}$/.test(registration))throw new JournalError('invalid-registration');
    if(conversationId)journal.get(conversationId);
    const fingerprint=digest([conversationId,registration]);let row=db.prepare('SELECT * FROM notification_lookups WHERE id=?').get(requestId);
    if(row&&row.fingerprint!==fingerprint)throw new JournalError('request-changed',409);
    if(row?.response)return JSON.parse(row.response);
    if(inflight.has(requestId))return inflight.get(requestId);
    if(row){if(row.deadline<=now()){finishLookup(row,{status:503,data:{error:{code:'interrupted'}}});return JSON.parse(db.prepare('SELECT response FROM notification_lookups WHERE id=?').get(requestId).response);}throw new JournalError('lookup-busy',409);}
    row={id:requestId,conversation:conversationId,fingerprint,registration,started:now(),deadline:now()+30000};
    transaction(()=>{
      db.prepare('INSERT INTO notification_lookups VALUES(?,?,?,?,?,?,NULL)').run(row.id,row.conversation,row.fingerprint,row.registration,row.started,row.deadline);
      if(conversationId)journal.append(conversationId,requestId+':lookup','lookup-start','event','Eit teknisk regnr-oppslag er starta.',{registration,technical:{vehicle:'Oppslag under arbeid',confirmation:'registration-provided-unverified'}});
    });
    const promise=(async()=>{let response;try{response=await perform();}catch{response={status:503,data:{error:{code:'upstream-unavailable'}}};}
      finishLookup(row,response);return JSON.parse(db.prepare('SELECT response FROM notification_lookups WHERE id=?').get(requestId).response);
    })().finally(()=>inflight.delete(requestId));inflight.set(requestId,promise);return promise;
  }
  function end({conversationId,requestId}){
    if(!validUuid(requestId))throw new JournalError('invalid-input');
    journal.get(conversationId);scan();
    if(!db.prepare('SELECT ended FROM notification_sessions WHERE conversation=?').get(conversationId)?.ended)journal.append(conversationId,requestId+':end','conversation-end','event','Kunden avslutta samtalen uttrykkeleg.');
    schedule();return {ok:true,simulated,revision:journal.get(conversationId).revision,message:simulated?'Samtalen er avslutta. Loggen blir behandla i den lokale testkøen; ingen e-post blir send.':'Samtalen er avslutta. Loggen er lagd i utsendingskøen.'};
  }
  function coverContact(conversationId,revision){
    scan();transaction(()=>{
      db.prepare('UPDATE notification_sessions SET covered=MAX(covered,?) WHERE conversation=?').run(revision,conversationId);
      db.prepare("UPDATE notification_outbox SET status='superseded' WHERE conversation=? AND kind='conversation' AND revision<=? AND status IN ('pending','retry')").run(conversationId,revision);
    });
  }
  async function deliver(row){
    const e=JSON.parse(row.envelope);
    if(e.simulated===false){if(!transport)throw Object.assign(new Error('mail-not-configured'),{code:'mail-not-configured'});return transport.send({id:row.id,mail:JSON.parse(row.mail)});}
    if(deliveryDelayMs)await new Promise(r=>setTimeout(r,deliveryDelayMs));
    const already=db.prepare('SELECT 1 FROM notification_receipts WHERE id=?').get(row.id);
    if(!already){
      const mode=failMode;failMode=null;if(mode==='before')throw new Error('simulated-failure');
      const envelope=JSON.parse(row.envelope);if(envelope.to!==OFFER_RECIPIENT||envelope.simulated!==true)throw new Error('invalid-envelope');
      db.prepare('INSERT OR IGNORE INTO notification_receipts VALUES(?,?)').run(row.id,now());
      if(mode==='after')throw new Error('simulated-lost-receipt');
    }
    return {accepted:true,simulated:true};
  }
  function tick(){
    if(draining)return draining;
    draining=(async()=>{
      if(!schedule())return;
      db.prepare("UPDATE notification_outbox SET status='retry',next_attempt=? WHERE status='sending' AND lease_until<=?").run(now(),now());
      for(let n=0;n<20;n++){
        const row=transaction(()=>{
          const r=db.prepare("SELECT * FROM notification_outbox WHERE status IN ('pending','retry') AND next_attempt<=? ORDER BY created,id LIMIT 1").get(now());if(!r)return null;
          db.prepare("UPDATE notification_outbox SET status='sending',attempts=attempts+1,lease_until=? WHERE id=?").run(now()+60000,r.id);return {...r,attempts:r.attempts+1};
        });if(!row)break;
        try{await deliver(row);db.prepare("UPDATE notification_outbox SET status='accepted',lease_until=0,error_code=NULL WHERE id=?").run(row.id);}
        catch(error){const live=JSON.parse(row.envelope).simulated===false,failed=row.attempts>=8||(live&&!error.retry);db.prepare('UPDATE notification_outbox SET status=?,next_attempt=?,lease_until=0,error_code=? WHERE id=?').run(error.uncertain?'needs-review':failed?'failed':'retry',now()+Math.max(error.retryAfterMs??0,Math.min(3600000,1000*2**row.attempts)),error.code??'simulated-delivery-failed',row.id);}
      }
    })().finally(()=>draining=null);return draining;
  }
  function list(conversationId,{before=null}={}){
    journal.get(conversationId);if(before!==null&&(!Number.isSafeInteger(before)||before<0))throw new JournalError('invalid-input');
    const rows=db.prepare('SELECT rowid AS cursor,id,kind,created,status,attempts,next_attempt,error_code,revision,envelope FROM notification_outbox WHERE conversation=? AND rowid<? ORDER BY rowid DESC LIMIT 21').all(conversationId,before??Number.MAX_SAFE_INTEGER);
    const more=rows.length>20;return {simulated,items:rows.slice(0,20).map(({envelope,...r})=>({...r,simulated:JSON.parse(envelope).simulated!==false,createdAt:iso(r.created)})),nextCursor:more?rows[19].cursor:null};
  }
  function preview(conversationId,id){journal.get(conversationId);const row=db.prepare('SELECT mail FROM notification_outbox WHERE conversation=? AND id=?').get(conversationId,id);if(!row)throw new JournalError('notification-not-found',404);return JSON.parse(row.mail);}
  return {lookup,end,tick,coverContact,list,preview,failNext({afterAcceptance=false}={}){failMode=afterAcceptance?'after':'before';},async close(){await draining;}};
}

export {renderNotificationEmail} from './chat-notification-mail.mjs';
