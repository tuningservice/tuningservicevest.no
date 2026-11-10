import {groupVariants} from './dvx-model.mjs';
import {assistantApiPath} from './assistant-api-path.mjs';
// The old local server still returns the full immutable snapshot. The cloud
// returns a manifest and loads a complete brand only when needed.
export function createChatCatalogueLoader(data,{fetchImpl=fetch}={}){
 const manifest=data.delivery==='brand-chunks'?data:null,loaded=new Map(),pending=new Map();
 let full=manifest?null:groupVariants(data.records);
 const groups=()=>full??manifest.brands.flatMap(b=>loaded.get(b.name)??[{id:'brand-only:'+b.name,stages:[{brand:b.name}]}]);
 async function ensureBrand(name){
  if(full||!name)return groups();if(loaded.has(name))return groups();if(pending.has(name))return pending.get(name);
  const entry=manifest.brands.find(b=>b.name===name);if(!entry)throw new Error('Unknown catalogue brand');
  const work=(async()=>{
   const records=[];
   for(const part of entry.files){
    if(!/^[a-f0-9]{16}-\d+\.json$/.test(part.file))throw new Error('Invalid catalogue file');
    const response=await fetchImpl(assistantApiPath('/data/cloud/'+part.file));if(!response.ok)throw new Error('Catalogue unavailable');
    const bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(bytes.byteLength!==part.bytes||hash!==part.sha256)throw new Error('Catalogue checksum mismatch');
    const data=JSON.parse(new TextDecoder().decode(bytes));if(data.brand!==name||data.records.length!==part.recordCount||data.snapshotSha256!==manifest.snapshotSha256)throw new Error('Incomplete catalogue brand');records.push(...data.records);
   }
   if(records.length!==entry.recordCount||new Set(records.map(r=>r.id)).size!==records.length)throw new Error('Incomplete catalogue brand');
   while(loaded.size>=3)loaded.delete(loaded.keys().next().value);loaded.set(name,groupVariants(records));return groups();
  })();pending.set(name,work);try{return await work;}finally{pending.delete(name);}
 }
 return {groups,ensureBrand};
}
