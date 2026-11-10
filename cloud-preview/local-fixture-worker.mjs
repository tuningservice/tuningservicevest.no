// LOCAL WRANGLER ENTRY ONLY. Never referenced by the deployment configuration.
// All network providers are replaced; no real credentials are loaded here.
import {createSkyWorker} from './worker.mjs';
import {fixtureFetch,makeSvvFixture} from '../server/vehicle-fixtures.mjs';
const mockFetch=async(url,options)=>{
 if(url==='https://api.tuningfiles.com/vdb/manufacturers/1')return Response.json([{id:1088,name:'Audi'},{id:9000,name:'BMW'}]);
 if(url==='https://api.tuningfiles.com/vdb/models/9000')return Response.json([{id:9001,name:'3-Serie'}]);
 if(url.startsWith('https://api.tuningfiles.com/'))return fixtureFetch(url,options);
 if(url.startsWith('https://akfell-datautlevering.'))return Response.json({kjoretoydataListe:[makeSvvFixture()]});
 if(url==='https://api.openai.com/v1/responses')return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({answer:'Simulert testsvar: Bjørn kan avklare oppsettet og gi deg eit tilbod.',handoff:'quote'})}]}]});
 return new Response(null,{status:404});
};
const worker=createSkyWorker({authenticate:async()=>({owner:'local-fixture-only',admin:true}),fetchImpl:mockFetch});
export default {...worker,async fetch(request,env,ctx){
 const response=await worker.fetch(request,env,ctx),path=new URL(request.url).pathname;
 if(path==='/api/chat-status'&&response.ok){const data=await response.json();return Response.json({...data,aiMode:'simulated',lookupMode:'simulated',vdbMode:'simulated'});}
 if(path==='/api/vehicle-lookup'&&response.ok){const data=await response.json();return Response.json({...data,simulated:true,source:'synthetic-demo'});}
 if(path==='/api/chat'&&response.ok){const data=await response.json();return Response.json({...data,mode:'simulated'});}
 return response;
}};
