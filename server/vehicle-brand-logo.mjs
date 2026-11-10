const HOST='d1etxasddeekf8.cloudfront.net';
export function allowedBrandLogo(value){
  if(typeof value!=='string')return null;
  try{const u=new URL(value);return u.protocol==='https:'&&u.hostname===HOST&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/app-assets\/vdb\/logos\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/.test(u.pathname)?u.href:null;}catch{return null;}
}
export function createBrandLogoService({loadManufacturers,fetchImage=fetch,now=()=>Date.now(),maxBytes=512*1024}={}){
  const cache=new Map(),pending=new Map();
  return async function logo(typeId,id){
    if(!/^[1-9]\d{0,11}$/.test(typeId)||!/^[1-9]\d{0,11}$/.test(id))return null;
    const key=typeId+':'+id,entry=cache.get(key);if(entry?.expires>now())return entry.value;
    if(pending.has(key))return pending.get(key);
    const work=(async()=>{
      let value=null;
      try{
        const rows=await loadManufacturers(typeId),manufacturer=rows.find(r=>String(r.id)===id),url=allowedBrandLogo(manufacturer?.brandLogo);
        if(url){
          const response=await fetchImage(url,{redirect:'error',headers:{Accept:'image/png,image/jpeg,image/webp'},signal:AbortSignal.timeout(8000)});
          const type=(response.headers.get('content-type')||'').split(';')[0];
          if(response.ok&&['image/png','image/jpeg','image/webp'].includes(type)&&Number(response.headers.get('content-length')||0)<=maxBytes){
            const reader=response.body.getReader(),chunks=[];let size=0;
            for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maxBytes){await reader.cancel();throw new Error('oversize');}chunks.push(part.value);}
            const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
            const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpg=bytes[0]===255&&bytes[1]===216,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
            if(type==='image/png'&&png||type==='image/jpeg'&&jpg||type==='image/webp'&&webp)value={bytes,type};
          }else await response.body?.cancel();
        }
      }catch{} // Logo is optional. Never expose upstream errors or headers.
      while(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{expires:now()+(value?21600000:600000),value});return value;
    })();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
  };
}
