import {randomUUID} from 'node:crypto';
import {JournalError,validUuid} from '../server/chat-core.mjs';
import {newState} from './state-journal.mjs';
export function cloudRepository(database,{now=()=>Date.now()}={}){
 // first-primary provides read-your-writes without trusting a replica for CAS.
 const db=database.withSession?database.withSession('first-primary'):database;
 const p=(sql,...args)=>db.prepare(sql).bind(...args);
 async function read(id,owner){
  if(!validUuid(id))throw new JournalError('invalid-conversation');
  const row=await p('SELECT * FROM cloud_conversations WHERE id=? AND owner=? AND expires>?',id,owner,now()).first();
  if(!row)throw new JournalError('conversation-expired',409);return {...row,state:JSON.parse(row.body)};
 }
 async function create(owner){
  const row={id:randomUUID(),owner,version:0,commit_id:randomUUID()},state=newState(row.id,now());
  await p('INSERT INTO cloud_conversations(id,owner,version,commit_id,updated,expires,body) VALUES(?,?,?,?,?,?,?)',row.id,owner,0,row.commit_id,now(),now()+30*86400000,JSON.stringify(state)).run();
  return {...row,state};
 }
 async function commit(row,mails=[]){
  const bytes=new TextEncoder().encode(JSON.stringify(row.state));if(bytes.length>1400000)throw new JournalError('conversation-too-large',413);
  const token=randomUUID(),due=row.state.lastActivity!=null&&row.state.revision>row.state.covered?(row.state.ended?now():row.state.lastActivity+300000):null;
  const statements=[p('UPDATE cloud_conversations SET version=version+1,commit_id=?,updated=?,expires=?,due=?,body=? WHERE id=? AND owner=? AND version=?',token,now(),now()+30*86400000,due,new TextDecoder().decode(bytes),row.id,row.owner,row.version)];
  // Every side-effect row is conditional on this exact winning CAS commit.
  for(const m of mails){const text=JSON.stringify(m.mail);if(new TextEncoder().encode(text).length>1900000)throw new JournalError('mail-too-large',413);statements.push(p("INSERT OR IGNORE INTO cloud_outbox(id,conversation,kind,revision,mode,created,next_attempt,mail) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cloud_conversations WHERE id=? AND commit_id=?)",m.id,row.id,m.kind,m.revision,m.mode,now(),now(),text,row.id,token));}
  statements.push(p("UPDATE cloud_outbox SET status='superseded' WHERE conversation=? AND kind='conversation' AND revision<? AND status IN ('pending','retry') AND EXISTS(SELECT 1 FROM cloud_conversations WHERE id=? AND commit_id=?)",row.id,row.state.revision,row.id,token));
  const result=await db.batch(statements);if(result[0].meta.changes!==1)throw new JournalError('conversation-busy',409);
  row.version++;row.commit_id=token;return row;
 }
 async function mutate(id,owner,fn){
  for(let attempt=0;attempt<4;attempt++){
   const row=await read(id,owner),result=await fn(row.state,row);
   try{await commit(row,result?.mails??[]);return result?.value;}catch(error){if(error.code!=='conversation-busy'||attempt===3)throw error;}
  }
 }
 async function limit(key,limit,windowMs){
  const bucket=Math.floor(now()/windowMs),id=key+':'+bucket;
  const row=await p('INSERT INTO cloud_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET n=n+1 WHERE n<? RETURNING n',id,(bucket+2)*windowMs,limit).first();
  if(!row)throw new JournalError('quota',429);
 }
 return {db,p,read,create,commit,mutate,limit,now};
}
