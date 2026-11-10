// Empty for the existing local/private app; production mounts an isolated API.
export function assistantApiPath(path,base=typeof document==='undefined'?'':document.querySelector('meta[name="assistant-api-base"]')?.content??''){
 if(!base)return path;
 if(!/^\/(?:[a-z0-9-]+\/)*api\/assistant$/.test(base))throw Error('Invalid assistant API mount');
 if(path.startsWith('/api/'))return base+path.slice(4);
 if(path.startsWith('/data/cloud/'))return base+'/catalogue/'+path.slice(12);
 if(path==='/data/chat/dvx-snapshot.json')return base+'/catalogue-manifest';
 return path;
}
