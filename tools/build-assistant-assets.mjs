// Run in the published source checkout before deploying its separate Worker.
// Copy only public website assets and the pinned catalogue; never local journals.
import {readFile,readdir,mkdir,copyFile,writeFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('.chat-preview-tmp/production-assets/',root);
const html=await readFile(new URL('index.html',root),'utf8');
if(!html.includes('name="assistant-api-base"')||html.includes('id="effektkalkulator"'))throw Error('Build from the reviewed production source, not the development homepage');
await mkdir(out,{recursive:true});
for(const file of ['index.html','robots.txt','sitemap.xml'])await copyFile(new URL(file,root),new URL(file,out));
for(const directory of ['css','js','img','diagnose','utleige','personvern'])await cp(new URL(directory+'/',root),new URL(directory+'/',out),{recursive:true,force:true});
await mkdir(new URL('data/cloud/',out),{recursive:true});
for(const f of await readdir(new URL('production/catalogue/',root))){if(!/^(?:index|[a-f0-9]{16}-\d+)\.json$/.test(f))throw Error('Unexpected catalogue asset');await copyFile(new URL('production/catalogue/'+f,root),new URL('data/cloud/'+f,out));}
await mkdir(new URL('test/admin/',out),{recursive:true});
const admin=(await readFile(new URL('cloud-preview/admin.html',root),'utf8')).replaceAll('Privat skytest','Produksjon – loggar').replaceAll('testloggar','loggar').replaceAll('test-e-post','e-post').replace('/js/cloud-admin.mjs','/production-admin/js/cloud-admin.mjs').replace('/test/chat/','https://tuningservicevest.no/');
await writeFile(new URL('test/admin/index.html',out),admin);
await writeFile(new URL('js/cloud-admin.mjs',out),(await readFile(new URL('cloud-preview/admin.mjs',root),'utf8')).replace("'/api/cloud-admin'","'/production-admin/api/cloud-admin'").replace('teststatus','driftsstatus'));
console.log(JSON.stringify({assets:fileURLToPath(out),secretsCopied:false,publicSourceOnly:true}));
