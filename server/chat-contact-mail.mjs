import {OFFER_RECIPIENT,OFFER_SITE} from './vehicle-offer.mjs';
import {customerText} from '../js/customer-presentation.mjs';
import {presentCompactMail,mailVehicleFields} from './chat-mail-presentation.mjs';
export const CHAT_CONTACT_TYPE='chat-contact.v1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,u)=>v==null?'Ikkje oppgitt':v+' '+u;
export function contextText(context,{customer=false}={}){
  if(!context)return 'Ingen bil vald / variant uavklart.';
  const t=context.technical??{},r=t.registered??{};
  const lines=[t.vehicle||'Bilvariant uavklart',context.registration?'Regnr: '+context.registration:'Regnr: ikkje oppgitt',
    'Registeropplysningar: '+[r.manufacturer,r.model,r.fuel,r.gearbox,r.engineCode?'Motorkode '+r.engineCode:null,r.engineCc?n(r.engineCc,'cm³'):null,r.powerHk?n(r.powerHk,'HK'):null].filter(Boolean).join(' · '),
    ...(customer?[]:['Identifikasjon: '+(t.confirmation??'uavklart'),'Datakjelde: '+(t.source??'uavklart')])];
  if(t.identity?.generation)lines.push('Dokumentert bilidentitet: '+t.identity.generation.label);
  if(r.firstRegistered)lines.push('Førstegongsregistrert: '+r.firstRegistered);
  if(r.simulated)lines.push('TESTDATA: syntetiske registeropplysningar, ikkje eit ekte registeroppslag.');
  if(t.ids&&!customer)lines.push('Katalog-ID-ar: '+JSON.stringify(t.ids));
  if(t.proposal&&!customer){lines.push('Katalogforslag (ikkje stadfesta bilidentitet): '+t.proposal.kind);for(const p of t.proposal.candidates)lines.push('Alternativ: '+p.generation+' / '+p.engine+' ['+p.generationId+'/'+p.engineId+']');}
  const stage=t.stages?.find(s=>s.stage===t.selectedStage);
  if(stage)lines.push('Valt steg: '+stage.stage,'Original: '+n(stage.original.powerHk,'HK')+' / '+n(stage.original.torqueNm,'Nm'),
    'Etter tuning: '+n(stage.tuned.powerHk,'HK')+' / '+n(stage.tuned.torqueNm,'Nm'),
    'Hardware/føresetnader: '+stage.requirements.map(r=>r.category+': '+r.items.join('; ')).join(' | '));
  else lines.push('Steg/effekt: uavklart eller ikkje valt.');
  const selected=context.selectedServices??(context.selectedService?[context.selectedService]:[]);if(selected.length)lines.push('Valt tilval: '+selected.map(o=>o.label).join(', ')+' — støtte ikkje stadfesta for bilen.');
  if(t.serviceOptions?.length)lines.push('Viste relevante tilval (må avklarast): '+t.serviceOptions.map(o=>o.label).join(', '));
  return customer?customerText(lines.join('\n')):lines.join('\n');
}
export function renderCustomerContactPreview(envelope){
 const lines=[envelope.production?'FRÅ TUNINGSERVICEVEST.NO':envelope.simulated===false?'LOKAL TEST – EKTE E-POSTLEVERING':'LOKAL TEST – INGEN E-POST ER SEND','Mottakar: '+envelope.to,'Samtale-ID: '+envelope.conversationId,
  'FØRESPURNADEN GJELD',contextText(envelope.requestContext,{customer:true}),'AKTIV BIL VED INNSENDING',contextText(envelope.activeContext,{customer:true}),
  'KORT OPPSUMMERING FRÅ SAMTALEN',customerText(envelope.summary),'Namn: '+(envelope.name||'Ikkje oppgitt'),envelope.contact.email?'E-post: '+envelope.contact.email:envelope.contact.phone?'Mobilnummer: '+envelope.contact.phone:'Kontakt: blir lagt til frå feltet ved sending.',
  'NY MELDING FRÅ KUNDEN',envelope.message||'Ikkje oppgitt.','HEILE SAMTALEN I KRONOLOGISK REKKJEFØLGJE'];
 let epoch=null;for(const e of envelope.events){if(epoch!==e.epoch){epoch=e.epoch;lines.push('\n=== BILKONTEKST '+epoch+' ===',contextText(e.context,{customer:true}));}
  lines.push('['+e.at+'] '+({user:'Kunden',assistant:'Assistent',event:'Bilval/hending'}[e.role]??e.role)+': '+(e.role==='user'?e.text:customerText(e.text)));
  if(['registered','selection','result','stage','service'].includes(e.kind))lines.push(contextText(e.context,{customer:true}));
 }return lines.join('\n\n');
}
// A concise customer projection. The complete envelope/email below is unchanged.
// Navigation/candidate audit events are not conversational messages.
export function customerContactOverview(envelope){
 const context=envelope.requestContext,t=context?.technical??{},registered=t.registered??{};
 const stage=t.stages?.find(s=>s.stage===t.selectedStage),groups=new Map();
 for(const e of envelope.events){
  if(!groups.has(e.epoch))groups.set(e.epoch,{epoch:e.epoch,vehicle:null,messages:[]});
  const group=groups.get(e.epoch);if(e.context?.technical?.vehicle)group.vehicle=customerText(e.context.technical.vehicle);
  if(['question','answer','ai-interrupted','contact-receipt'].includes(e.kind)&&['user','assistant'].includes(e.role))group.messages.push({speaker:e.role==='user'?'Du':'AI-assistent',text:e.role==='user'?e.text:customerText(e.text)});
 }
 const requestEpoch=envelope.requestEpoch??context?.epoch??0;
 const conversations=[...groups.values()].filter(g=>g.messages.length).map(g=>({...g,vehicle:g.vehicle??'Utan vald bil',forThisRequest:g.epoch===requestEpoch}));
 const latestQuestion=envelope.events.filter(e=>e.kind==='question'&&e.epoch===requestEpoch).at(-1);
 const hasVehicle=!!t.vehicle&&!/^(?:Bilvariant uavklart|Ingen bil vald)$/i.test(t.vehicle);
 return {to:envelope.to,hasVehicle,hasQuestion:!!latestQuestion,vehicle:customerText(t.vehicle||'Bilvariant uavklart'),registration:context?.registration??null,
  stage:t.selectedStage??null,services:(context?.selectedServices??(context?.selectedService?[context.selectedService]:[])).map(s=>customerText(s.label)),
  purpose:latestQuestion?.text??(hasVehicle?'Eg ønskjer eit individuelt tilbod eller ei avklaring.':'Kunden ønskjer å bli kontakta.'),
  vehicleFacts:[registered.fuel,registered.gearbox,registered.firstRegistered?'Førstegongsregistrert '+registered.firstRegistered:null].filter(Boolean),
  performance:stage?{original:stage.original,tuned:stage.tuned}:null,
  otherActiveVehicle:envelope.activeContext&&envelope.activeContext.epoch!==requestEpoch?customerText(envelope.activeContext.technical?.vehicle??'Ein annan bil'):null,
  conversations,messageCount:conversations.reduce((n,g)=>n+g.messages.length,0)};
}
export function buildChatEnvelope(snapshot,{id,contact,name='',message='',createdAt,simulated=true,production=false}){
  const questions=snapshot.events.filter(e=>e.kind==='question');
  const requestEpoch=snapshot.requestEpoch??snapshot.context?.epoch??0;
  const relevant=questions.filter(e=>e.epoch===requestEpoch);
  const question=relevant.at(-1);
  const earlier=questions.at(-1);
  const summary=[snapshot.context?.technical?.vehicle||'Kunden ønskjer å bli kontakta.',
    (snapshot.context?.selectedServices??(snapshot.context?.selectedService?[snapshot.context.selectedService]:[])).map(o=>o.label).join(', '),(message||question?.text)??(earlier?'Tidlegare spørsmål (før gjeldande bilval): '+earlier.text:'Kunden ønskjer å bli kontakta.')].filter((text,index,all)=>text&&all.indexOf(text)===index).map(t=>t.length>450?t.slice(0,450)+' … (full tekst i samtalen eller tilleggsmeldinga)':t).join('\n');
  const publicContext=c=>{if(!c)return null;const {ref,...rest}=c;return rest;};
  return {type:CHAT_CONTACT_TYPE,id,to:OFFER_RECIPIENT,site:OFFER_SITE,simulated,production,replyTo:contact.email??null,contact,name,message,createdAt,
    conversationId:snapshot.conversationId,revision:snapshot.revision,requestEpoch,summary,requestContext:publicContext(snapshot.context),activeContext:publicContext(snapshot.activeContext),events:snapshot.events.map(e=>({...e,context:publicContext(e.context)}))};
}
export function renderChatEmail(envelope){
  const summary=[envelope.production?'FRÅ TUNINGSERVICEVEST.NO':envelope.simulated===false?'LOKAL TEST – EKTE E-POSTLEVERING':'LOKAL TEST – INGEN E-POST ER SEND','Mottakar: '+envelope.to,'Nettside: '+envelope.site,'Tidspunkt (UTC): '+envelope.createdAt,
    'Referanse: '+envelope.id,'Samtale-ID: '+envelope.conversationId,'Namn: '+(envelope.name||'Ikkje oppgitt'),
    envelope.contact.email?'E-post: '+envelope.contact.email:envelope.contact.phone?'Mobilnummer: '+envelope.contact.phone:'Kontakt: blir lagt til frå feltet ved sending.',
    'Reply-To: '+(envelope.replyTo||(envelope.contact.phone?'Ikkje sett; berre mobilnummer er oppgitt':'Ikkje sett enno')),'','KORT OPPSUMMERING FRÅ SAMTALEN',envelope.summary,
    '', 'FØRESPURNADEN GJELD',contextText(envelope.requestContext),'','AKTIV BIL VED INNSENDING',contextText(envelope.activeContext),
    '', 'NY MELDING FRÅ KUNDEN',envelope.message||'Ikkje oppgitt.'].join('\n');
  let epoch=null;
  const transcript=envelope.events.map(e=>{
    const block=[];if(epoch!==e.epoch){epoch=e.epoch;block.push('\n=== BILKONTEKST '+epoch+' ===\n'+contextText(e.context));}
    block.push('['+e.at+'] '+({user:'Kunden',assistant:'Assistent',event:'Bilval/hending'}[e.role]??e.role)+': '+e.text);
    if(['registered','selection','result','stage','service'].includes(e.kind))block.push(contextText(e.context));
    return block.join('\n');
  }).join('\n\n');
  const fullText=summary+'\n\nHEILE SAMTALEN\n'+transcript;
  const overview=customerContactOverview(envelope);
  return presentCompactMail({title:'Førespurnad til Bjørn',to:envelope.to,replyTo:envelope.replyTo,subject:'[LOKAL TEST] Førespurnad til Bjørn — Tuningservice Vest',simulated:envelope.simulated,production:envelope.production,
    fields:[['Kontakt',envelope.contact.email||envelope.contact.phone],['Namn',envelope.name],...mailVehicleFields(envelope.requestContext)],message:envelope.message||overview.purpose,
    notes:overview.otherActiveVehicle?['Gjeld ein tidlegare vald bil. Aktiv bil ved innsending: '+overview.otherActiveVehicle+'.']:[],fullText,reference:envelope.id,createdAt:envelope.createdAt});
}
