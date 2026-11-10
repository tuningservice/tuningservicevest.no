import {createHash} from 'node:crypto';
import {JournalError} from '../server/chat-core.mjs';
import {suggestCandidates} from '../js/vehicle-matching.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export function cloudCatalogue(assets){
 let indexWork;const cache=new Map(),inflight=new Map();
 async function read(path){const r=await assets.fetch(new Request('https://assets.invalid'+path));if(!r.ok)throw new JournalError('catalogue-unavailable',503);return r;}
 const index=()=>indexWork??=(read('/data/cloud/index.json').then(r=>r.json()).catch(e=>{indexWork=null;throw e;}));
 async function brand(name){
  if(cache.has(name))return cache.get(name);
  if(inflight.has(name))return inflight.get(name);
  const work=(async()=>{
   const manifest=await index(),entry=manifest.brands.find(b=>b.name===name);if(!entry)throw new JournalError('invalid-selection');
   const records=[];
   // Sequential chunks bound memory and subrequests; no partially loaded brand
   // can ever be passed into deterministic matching as a unique result.
   for(const part of entry.files){
    if(!/^[a-f0-9]{16}-\d+\.json$/.test(part.file))throw new JournalError('catalogue-invalid',503);
    const bytes=new Uint8Array(await (await read('/data/cloud/'+part.file)).arrayBuffer());
    if(bytes.length!==part.bytes||sha(bytes)!==part.sha256)throw new JournalError('catalogue-invalid',503);
    const data=JSON.parse(new TextDecoder().decode(bytes));if(data.brand!==name||data.snapshotSha256!==manifest.snapshotSha256||data.records.length!==part.recordCount)throw new JournalError('catalogue-invalid',503);records.push(...data.records);
   }
   if(records.length!==entry.recordCount||new Set(records.map(r=>r.id)).size!==records.length)throw new JournalError('catalogue-invalid',503);
   // Only two complete brands remain resident in this isolate.
   while(cache.size>=2)cache.delete(cache.keys().next().value);cache.set(name,records);return records;
  })();inflight.set(name,work);try{return await work;}finally{inflight.delete(name);}
 }
 async function recordsForVehicle(vehicle){const m=await index(),rows=m.brands.map(b=>({id:b.name,name:b.name})),ids=suggestCandidates('manufacturers',rows,{manufacturer:vehicle.manufacturer}).ids;return ids.length===1?brand(ids[0]):[];}
 async function recordVehicle(id){const m=await index(),name=m.vehicleBrands?.[id];if(!name)throw new JournalError('invalid-vehicle');const records=await brand(name);return records.filter(r=>r.vehicleId===id);}
 return {index,brand,recordsForVehicle,recordVehicle};
}
