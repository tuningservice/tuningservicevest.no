import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
const source=await readFile(new URL('../js/contact-context.js',import.meta.url),'utf8');
const data=JSON.parse(await readFile(new URL('../data/tilbod.json',import.meta.url),'utf8'));
function open(params,initialMessage=''){
 const events={};
 const form={addEventListener:(name,fn)=>events[name]=fn};
 const topic={value:'Generell førespurnad',options:['Generell førespurnad','Diagnose','Utleige','Byte av 78 mm hjullager'].map(value=>({value})),addEventListener:()=>{}};
 const message={value:initialMessage},registration={value:''},helper={textContent:''};
 const elements={kontaktskjema:form,emne:topic,melding:message,regnr:registration,'melding-hjelp':helper};
 runInNewContext(source,{document:{getElementById:id=>elements[id]},window:{location:{search:'?'+new URLSearchParams(params)}},URLSearchParams,setTimeout});
 return {topic,message,registration,helper,submit(){const formData=new FormData();formData.set('package',topic.value);formData.set('message',message.value);events.formdata({formData});return formData;}};
}
for(const product of data.utstyr)test('Rental preserves product, model and period without registration: '+product.namn,()=>{
 const page=open({emne:'Utleige',utstyr:product.namn});
 assert.equal(page.topic.value,'Utleige');
 assert.ok(page.message.value.includes(product.namn));
 assert.ok(page.message.value.includes('Bilmodell og årsmodell:'));
 assert.ok(page.message.value.includes('Ønskt leigeperiode:'));
 page.message.value+=' fredag–søndag\nVolvo V50 2008';
 const body=page.submit();
 assert.equal(body.get('package'),'Utleige');
 assert.ok(body.get('message').includes('fredag–søndag'));
 assert.ok(!body.get('message').includes('Registreringsnummer:'));
});
test('Bearing replacement has a distinct subject and never a rental template',()=>{
 const page=open({emne:data.utstyr.find(item=>item.lagerbyte).lagerbyte.emne});
 assert.equal(page.topic.value,'Byte av 78 mm hjullager');
 assert.ok(page.message.value.includes('Stad:'));
 assert.ok(!page.message.value.includes('leige'));
 assert.ok(page.submit().get('message').startsWith('Emne: Byte av 78 mm hjullager'));
});
test('Optional registration is forwarded with an existing customer message',()=>{
 const page=open({emne:'Utleige',utstyr:'Launch'},'Mi eiga melding');
 page.registration.value=' AB12345 ';
 const message=page.submit().get('message');
 assert.ok(message.endsWith('Mi eiga melding'));
 assert.ok(message.includes('Registreringsnummer: AB12345'));
});
test('Unknown URL subject cannot become a form topic',()=>{
 const page=open({emne:'Ukjent',utstyr:'Vil ikkje bli førehandsfylt'});
 assert.equal(page.topic.value,'Generell førespurnad');
 assert.equal(page.message.value,'');
});
