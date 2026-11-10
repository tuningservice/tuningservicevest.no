import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {JournalError,validUuid,digest} from './chat-core.mjs';
export {JournalError,validUuid,digest} from './chat-core.mjs';
const clone=v=>structuredClone(v);
// Private local storage. No request bodies, contact data or identifiers are logged.
export function createChatJournal({filename=':memory:',now=()=>Date.now(),maxConversationBytes=10*1024*1024}={}){
  const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,created TEXT,updated TEXT,epoch INTEGER DEFAULT 0,context TEXT,revision INTEGER DEFAULT 0,bytes INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,conversation TEXT REFERENCES conversations(id),event_id TEXT,at TEXT,epoch INTEGER,kind TEXT,role TEXT,text TEXT,context TEXT,UNIQUE(conversation,event_id));
    CREATE TABLE IF NOT EXISTS chat_requests(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,context TEXT,status TEXT,result TEXT);
    CREATE TABLE IF NOT EXISTS contact_requests(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,envelope TEXT,mail TEXT,status TEXT);
    CREATE TABLE IF NOT EXISTS simulated_deliveries(id TEXT PRIMARY KEY,accepted TEXT); `);
  db.exec('CREATE TABLE IF NOT EXISTS event_requests(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,result TEXT)');
  // A process interruption is recorded rather than silently losing a question.
  for(const row of db.prepare("SELECT * FROM chat_requests WHERE status='pending'").all()){
    db.prepare("UPDATE chat_requests SET status='interrupted' WHERE id=?").run(row.id);
    const c=JSON.parse(row.context);append(row.conversation,row.id+':interrupted','ai-interrupted','assistant','AI-svaret vart avbrote ved lokal serveromstart.',c);
  }
  function stamp(){return new Date(now()).toISOString();}
  function create(){
    if(db.prepare('SELECT count(*) AS n FROM conversations').get().n>=1000)throw new JournalError('conversation-storage-full',503);
    const id=randomUUID(),at=stamp();db.prepare('INSERT INTO conversations(id,created,updated) VALUES(?,?,?)').run(id,at,at);return {conversationId:id,revision:0};
  }
  function get(id){
    if(!validUuid(id))throw new JournalError('invalid-conversation');
    const row=db.prepare('SELECT * FROM conversations WHERE id=?').get(id);if(!row)throw new JournalError('conversation-expired',409);
    return {...row,context:row.context?JSON.parse(row.context):null};
  }
  function append(id,eventId,kind,role,text,context){
    const old=db.prepare('SELECT * FROM events WHERE conversation=? AND event_id=?').get(id,eventId);
    if(old)return {...old,context:old.context?JSON.parse(old.context):null};
    const c=get(id),ctx=context===undefined?c.context:context;
    const bytes=Buffer.byteLength(text+JSON.stringify(ctx??null));
    if(c.bytes+bytes>maxConversationBytes)throw new JournalError('conversation-too-large',413);
    const at=stamp(),epoch=ctx?.epoch??c.epoch;
    const result=db.prepare('INSERT INTO events(conversation,event_id,at,epoch,kind,role,text,context) VALUES(?,?,?,?,?,?,?,?)').run(id,eventId,at,epoch,kind,role,text,ctx?JSON.stringify(ctx):null);
    const seq=Number(result.lastInsertRowid);
    db.prepare('UPDATE conversations SET updated=?,revision=?,bytes=bytes+? WHERE id=?').run(at,seq,bytes,id);
    return {seq,at,epoch,kind,role,text,context:clone(ctx)};
  }
  function mutate(id,eventId,kind,text,context,{reset=false}={}){
    const old=db.prepare('SELECT seq FROM events WHERE conversation=? AND event_id=?').get(id,eventId);
    if(old)return {conversationId:id,revision:get(id).revision};
    const c=get(id),epoch=c.epoch+(reset?1:0),ctx=context?{...context,epoch}:null;
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('UPDATE conversations SET epoch=?,context=? WHERE id=?').run(epoch,ctx?JSON.stringify(ctx):null,id);
      append(id,eventId,kind,'event',text,ctx);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
    return {conversationId:id,revision:get(id).revision};
  }
  function events(id){get(id);return db.prepare('SELECT seq,at,epoch,kind,role,text,context FROM events WHERE conversation=? ORDER BY seq').all(id).map(row=>({...row,context:row.context?JSON.parse(row.context):null}));}
  function beginChat(id,requestId,question,{retry=false}={}){
    const c=get(id),fingerprint=digest([id,question,c.context]),old=db.prepare('SELECT * FROM chat_requests WHERE id=?').get(requestId);
    if(old){if(old.conversation!==id||old.fingerprint!==fingerprint)throw new JournalError('request-changed',409);if(old.status==='done'){const result=JSON.parse(old.result);if(!retry||!['error','unavailable'].includes(result.mode))return {cached:result};}if(old.status==='pending')throw new JournalError('conversation-busy',409);}
    db.exec('BEGIN IMMEDIATE');
    try{db.prepare("INSERT OR REPLACE INTO chat_requests VALUES(?,?,?,?,'pending',NULL)").run(requestId,id,fingerprint,JSON.stringify(c.context));
      append(id,requestId+':question','question','user',question,c.context);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}return {context:clone(c.context)};
  }
  function finishChat(id,requestId,result,context){
    const count=db.prepare("SELECT count(*) n FROM events WHERE conversation=? AND (event_id=? OR event_id LIKE ?)").get(id,requestId+':answer',requestId+':answer:%').n;
    const event=append(id,requestId+':answer'+(count?':'+(count+1):''),'answer','assistant',result.answer,context);
    const actions=result.handoff?[{type:'contact_bjorn',label:'Send førespurnad til Bjørn',anchorEventId:event.seq}]:[];
    const full={...result,conversationId:id,revision:get(id).revision,replyEventId:event.seq,actions};
    db.prepare("UPDATE chat_requests SET status='done',result=? WHERE id=?").run(JSON.stringify(full),requestId);return full;
  }
  function snapshot(id,anchorEventId=null){
    const c=get(id);if(db.prepare("SELECT 1 FROM chat_requests WHERE conversation=? AND status='pending'").get(id))throw new JournalError('conversation-busy',409);
    const log=events(id);let context=c.context,requestEpoch=c.epoch;
    if(anchorEventId!=null){if(!Number.isSafeInteger(anchorEventId))throw new JournalError('invalid-anchor');const anchor=log.find(e=>e.seq===anchorEventId);if(!anchor)throw new JournalError('invalid-anchor');context=anchor.context;requestEpoch=anchor.epoch;}
    return {conversationId:id,revision:c.revision,createdAt:c.created,requestEpoch,context:clone(context),activeContext:clone(c.context),events:log};
  }
  function history(id){try{const c=get(id),log=events(id).filter(e=>e.epoch===c.epoch&&['question','answer'].includes(e.kind));if(log.at(-1)?.kind==='question')log.pop();return log.map(e=>({role:e.role,content:e.text})).slice(-12);}catch{return null;}}
  return {create,get,append,mutate,events,beginChat,finishChat,snapshot,history,db,close:()=>db.close()};
}
