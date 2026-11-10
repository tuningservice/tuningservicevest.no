import test from 'node:test';
import assert from 'node:assert/strict';
import {contactEntryMessage,combineContactMessage,mountContactEntries} from '../js/contact-entry.mjs';
import {compactContactSection} from '../production/contact-section.mjs';
test('compact footer retains phone/mail fallbacks and opens one shared contact flow without a second form',()=>{
 assert.match(compactContactSection,/tel:94809710/);assert.match(compactContactSection,/mailto:vest@tuningservice.no/);assert.match(compactContactSection,/data-open-contact>Send førespurnad/);assert.doesNotMatch(compactContactSection,/<form|<input/);
});
test('diagnose, rental and bearing links retain only approved topics and bounded equipment text',()=>{
 assert.equal(contactEntryMessage('?emne=Diagnose'),'Emne: Diagnose');
 assert.equal(contactEntryMessage('?emne=Utleige&utstyr=Launch+X431'),'Emne: Utleige\nUtstyr: Launch X431');
 assert.equal(contactEntryMessage('?emne=Byte+av+78+mm+hjullager'),'Emne: Byte av 78 mm hjullager');
 assert.equal(contactEntryMessage('?emne=arbitrary&contact=private'),'');
 assert.ok(contactEntryMessage('?emne=Utleige&utstyr='+('x'.repeat(500))).length<200);
});
test('opening from the footer never duplicates the topic or discards a draft when it is too long',()=>{
 const initial='Emne: Diagnose',once=combineContactMessage('Eiga melding',initial);assert.equal(once.value,initial+'\n\nEiga melding');assert.equal(combineContactMessage(once.value,initial).value,once.value);
 const full='x'.repeat(3000);assert.deepEqual(combineContactMessage(full,initial),{value:full,tooLong:true});
});
test('footer contact works without AI or a vehicle and legacy subject links open directly',()=>{
 let click;const calls=[],doc={querySelectorAll:()=>[{addEventListener:(event,handler)=>{assert.equal(event,'click');click=handler;}}]};
 mountContactEntries({open:m=>calls.push(m),doc,location:{search:'',hash:''}});assert.equal(calls.length,0);click();assert.deepEqual(calls,['']);
 mountContactEntries({open:m=>calls.push(m),doc,location:{search:'?emne=Utleige&utstyr=Launch',hash:'#contact'}});assert.equal(calls.at(-1),'Emne: Utleige\nUtstyr: Launch');
});
