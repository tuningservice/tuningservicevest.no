import {JournalError,validUuid} from './chat-journal.mjs';
// Local full-page preview only. Production /api/contact and Turnstile are untouched.
export function createLocalSiteContact({journal,contacts,notifications}){
  return async function submit(input){
    const allowed=['conversationId','requestId','name','email','phone','company','message'];
    if(!input||Object.keys(input).some(k=>!allowed.includes(k))||!validUuid(input.requestId))throw new JournalError('invalid-contact-request');
    for(const [key,max] of [['name',100],['email',254],['phone',30],['company',100],['message',3000]]){
      if(typeof input[key]!=='string'||input[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input[key])||(key!=='message'&&/[\r\n]/.test(input[key])))throw new JournalError('invalid-contact');
    }
    if(!input.name.trim()||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))throw new JournalError('invalid-contact');
    journal.get(input.conversationId);
    const details=['Førespurnad frå det vanlege kontaktskjemaet.','Namn: '+input.name,'Bedrift: '+(input.company||'Ikkje oppgitt'),'Telefon: '+(input.phone||'Ikkje oppgitt'),input.message].join('\n');
    const existing=journal.db.prepare('SELECT envelope FROM contact_requests WHERE id=?').get(input.requestId);
    const previousEvent=journal.db.prepare('SELECT text FROM events WHERE conversation=? AND event_id=?').get(input.conversationId,input.requestId+':site-form');
    if(previousEvent&&previousEvent.text!==details)throw new JournalError('request-changed',409);
    journal.append(input.conversationId,input.requestId+':site-form','question','user',details);
    const revision=existing?JSON.parse(existing.envelope).revision:journal.get(input.conversationId).revision;
    const result=await contacts.submit({conversationId:input.conversationId,requestId:input.requestId,revision,contact:input.email,name:input.name,message:input.message});
    notifications.coverContact(input.conversationId,revision);return result;
  };
}
