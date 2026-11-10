import {JournalError,validUuid,digest} from './chat-core.mjs';
import {kwToHk} from '../js/vehicle-units.mjs';
import {serviceFacts,offeredServiceOptions} from '../js/vehicle-service-options.mjs';
import {resolveVehicleProposal} from '../js/vehicle-matching.mjs';
import {generationQuestion} from '../js/vehicle-generation-identity.mjs';
import {establishVehicleIdentity} from '../js/vehicle-identity-registry.mjs';
import {registrationMessageIntent} from '../js/chat-registration.mjs';
const only=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const levels=['types','manufacturers','models','generations','engines'];
export function createChatRuntime({journal,ai,catalog,lookupContexts,dvxRecords=[]}){
  const getRequest=id=>journal.getEventRequest?journal.getEventRequest(id):journal.db.prepare('SELECT * FROM event_requests WHERE id=?').get(id);
  const putRequest=(id,conversation,fingerprint,result)=>journal.putEventRequest?journal.putEventRequest(id,conversation,fingerprint,result):journal.db.prepare('INSERT INTO event_requests VALUES(?,?,?,?)').run(id,conversation,fingerprint,JSON.stringify(result));
  const atomic=fn=>{if(journal.atomic)return journal.atomic(fn);journal.db.exec('BEGIN IMMEDIATE');try{const result=fn();journal.db.exec('COMMIT');return result;}catch(error){journal.db.exec('ROLLBACK');throw error;}};
  async function event(input){
    if(!only(input,['conversationId','eventId','kind','payload'])||!validUuid(input.eventId)||typeof input.kind!=='string'||!only(input.payload??{},['selection','source','lookupToken','vehicle','serviceId','serviceIds','registration','message']))throw new JournalError('invalid-event');
    const fingerprint=digest(input),old=getRequest(input.eventId);
    if(old){if(old.fingerprint!==fingerprint)throw new JournalError('request-changed',409);return JSON.parse(old.result);}
    if(input.kind==='registration-message'){
      const p=input.payload;if(!only(p,['message'])||typeof p.message!=='string'||!p.message.trim()||p.message.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(p.message))throw new JournalError('invalid-event');
      const intent=registrationMessageIntent(p.message);if(intent.kind==='none')throw new JournalError('invalid-registration-message');
      journal.get(input.conversationId);return atomic(()=>{
        journal.append(input.conversationId,input.eventId+':question','question','user',p.message.trim());
        const answer=journal.append(input.conversationId,input.eventId+':answer','answer','assistant',intent.answer);
        const result={conversationId:input.conversationId,revision:answer.seq,intent};
        putRequest(input.eventId,input.conversationId,fingerprint,result);return result;
      });
    }
    const c=journal.get(input.conversationId),p=input.payload??{};let context=c.context,text;
    function privateLookup(token){const result=lookupContexts.getPrivate(token);if(!result)throw new JournalError('lookup-expired',409);return result;}
    if(input.kind==='reset'){context=null;text='Kunden startar eit nytt bilval. Tidlegare bilar er berre historikk.';}
    else if(input.kind==='lookup-input'){
      if(!only(p,['registration'])||typeof p.registration!=='string'||! /^[A-Z0-9]{2,7}$/.test(p.registration))throw new JournalError('invalid-registration');
      context={ref:null,registration:p.registration,registrationSource:'customer-unverified',selectedService:null,technical:{vehicle:'Bilvariant uavklart',confirmation:'registration-provided-unverified',source:'customer-input',registrationProvided:true,selectedStage:null,stages:[],serviceOptions:[]}};
      text='Kunden har oppgitt regnr for eit teknisk oppslag. Bilen er ikkje identifisert enno.';
    }
    else if(input.kind==='registered'){
      if(!only(p,['lookupToken']))throw new JournalError('invalid-event');const r=privateLookup(p.lookupToken);
      const technical=await ai.describeContext({source:'registered',lookupToken:p.lookupToken});
      const previous=context?.ref?.lookupToken?lookupContexts.getPrivate(context.ref.lookupToken):null;
      const sameOriginal=previous&&(r.vehicle.baseVehicle||context.ref.lookupToken===p.lookupToken)&&['manufacturer','model','engineKw','engineCc','firstRegistered'].every(k=>r.vehicle[k]===previous.vehicle[k])&&r.registration===previous.registration;
      const selectedServices=sameOriginal?(context.selectedServices??(context.selectedService?[context.selectedService]:[])).map(o=>technical.serviceOptions.find(s=>s.id===o.id)).filter(Boolean):[];
      context={ref:{source:'registered',lookupToken:p.lookupToken},technical,registration:r.registration,selectedService:selectedServices.at(-1)??null,...(sameOriginal?{selectedServices}:{})};text=technical.identity?.baseVehicle?(technical.identity.baseVehicle.status==='customer-confirmed'?'Kunden har stadfesta grunnbil: ':'Dokumentert grunnbil frå modell og tekniske registeropplysningar: ')+technical.identity.baseVehicle.label+'. Registeridentiteten er framleis '+technical.vehicle+'.':'Tekniske registeropplysningar er henta: '+technical.vehicle+'. Katalogvarianten er ikkje avklart.';
    }else if(input.kind==='selection'){
      if(!only(p,['source','selection','lookupToken'])||!p.selection)throw new JournalError('invalid-selection');
      let label='',ids=null;
      if(p.source==='vdb'){
        if(!only(p.selection,levels))throw new JournalError('invalid-selection');let parent,gap=false;const names=[];
        for(const level of levels){const id=p.selection[level];if(!id){gap=true;continue;}if(gap||typeof id!=='string'||!/^\d{1,12}$/.test(id))throw new JournalError('invalid-selection');
          const row=(await catalog(level,parent)).find(r=>String(r.id)===id);if(!row)throw new JournalError('invalid-selection');if(level!=='types')names.push(row.name);parent=id;}
        label=names.join(' · ');ids={namespace:'tuningfiles',selection:p.selection};
      }else if(p.source==='dvx'){
        if(!only(p.selection,['brand','model','generation','variant']))throw new JournalError('invalid-selection');
        const matching=dvxRecords.filter(r=>(!p.selection.brand||r.brand===p.selection.brand)&&(!p.selection.model||r.model===p.selection.model)&&(!p.selection.generation||r.generation===p.selection.generation)&&(!p.selection.variant||r.vehicleId===p.selection.variant));
        if(!matching.length)throw new JournalError('invalid-selection');label=[p.selection.brand,p.selection.model,p.selection.generation,p.selection.variant?matching[0].engineDesignation:null].filter(Boolean).join(' · ');
        ids={namespace:'dvx',selection:p.selection};
      }else throw new JournalError('invalid-selection');
      let registered=null,registration=null,ref=null;
      if(p.lookupToken){const r=privateLookup(p.lookupToken);registered={...r.vehicle,powerHk:kwToHk(r.vehicle.engineKw),simulated:r.simulated};delete registered.engineKw;registration=r.registration;ref={source:'registered',lookupToken:p.lookupToken};}
      const identified=registered?establishVehicleIdentity(registered):null,{matchingVehicle,...identity}=identified??{},facts=serviceFacts({registered:matchingVehicle??registered}),options=offeredServiceOptions(facts),retained=p.lookupToken&&p.lookupToken===c.context?.ref?.lookupToken?options.find(o=>o.id===c.context?.selectedService?.id)??null:null;
      const retainedServices=retained?(c.context.selectedServices??[retained]).map(s=>options.find(o=>o.id===s.id)).filter(Boolean):[];
      context={ref,registration,selectedService:retained,selectedServices:retainedServices,technical:{source:p.source,ids,vehicle:label||[registered?.manufacturer,registered?.model].filter(Boolean).join(' ')||'Bilvariant uavklart',confirmation:'partial-selection-unconfirmed',registered,...(identified?{identity}:{}),selectedStage:null,stages:[],serviceFacts:facts,serviceOptions:options}};
      text='Bilval under arbeid: '+context.technical.vehicle+'. Motorvariant og steg er ikkje stadfesta.';
      if(p.lookupToken&&p.source==='vdb'){
        const r=privateLookup(p.lookupToken),proposal=await resolveVehicleProposal(r.vehicle,catalog);
        context.technical.proposal={kind:proposal.kind,selections:proposal.selections,candidates:proposal.paths.map(v=>({generation:v.generation.name,generationId:v.generation.id,engine:v.engine.name,engineId:v.engine.id}))};
        if(proposal.kind==='choose-generation'&&proposal.paths.length)text+=' '+generationQuestion(proposal.paths);
      }
    }else if(['result','stage'].includes(input.kind)){
      if(!only(p,['vehicle'])||!p.vehicle)throw new JournalError('invalid-event');const technical=await ai.describeContext(p.vehicle);
      const identity=ref=>ref?JSON.stringify([ref.source,ref.selection,ref.engineId,ref.lookupToken??null]):null;
      if(input.kind==='stage'&&identity(p.vehicle)!==identity(c.context?.ref))throw new JournalError('vehicle-context-changed',409);
      const r=p.vehicle.lookupToken?privateLookup(p.vehicle.lookupToken):null;
      const sameCar=p.vehicle.lookupToken&&p.vehicle.lookupToken===c.context?.ref?.lookupToken||input.kind==='stage';
      const selectedServices=sameCar?(c.context?.selectedServices??(c.context?.selectedService?[c.context.selectedService]:[])).map(s=>(technical.serviceOptions??[]).find(o=>o.id===s.id)).filter(Boolean):[];
      context={ref:p.vehicle,technical,registration:r?.registration??null,selectedService:selectedServices.at(-1)??null,selectedServices};
      text=(input.kind==='stage'?'Valt steg: ':'Viser serverkontrollert katalogvariant: ')+technical.vehicle+' · '+(technical.selectedStage??'ingen publiserte steg')+'. Varianten kan vere føreslått automatisk.';
    }else if(input.kind==='service'){
      if(!only(p,['serviceId','serviceIds'])||!context)throw new JournalError('invalid-service');
      const ids=p.serviceIds??[p.serviceId];if(!Array.isArray(ids)||ids.length>30||new Set(ids).size!==ids.length)throw new JournalError('invalid-service');
      const options=ids.map(id=>context.technical.serviceOptions?.find(o=>o.id===id));if(options.some(o=>!o))throw new JournalError('invalid-service');
      context={...context,selectedService:options.at(-1)??null,selectedServices:options};text=options.length?'Kunden har valt tilval: '+options.map(o=>o.label).join(', ')+'. Støtte for bilen må avklarast.':'Kunden har fjerna tilvala.';
    }else throw new JournalError('invalid-event');
    const result=journal.mutate(input.conversationId,input.eventId,input.kind,text,context,{reset:input.kind==='reset'});
    putRequest(input.eventId,input.conversationId,fingerprint,result);return result;
  }
  async function chat(input){
    if(!only(input,['conversationId','requestId','question','retry'])||input.retry!==undefined&&typeof input.retry!=='boolean'||!validUuid(input.requestId)||typeof input.question!=='string'||!input.question.trim()||input.question.length>2000)throw new JournalError('invalid-input');
    const begun=journal.beginChat(input.conversationId,input.requestId,input.question.trim(),{retry:input.retry===true});if(begun.cached)return begun.cached;
    const context=begun.context,technical=context?{...context.technical,vehicleEpoch:context.epoch,selectedServices:context.selectedServices??(context.selectedService?[context.selectedService]:[])}:null;
    let result;
    try{
      // Selected extras are retained quote context, not an instruction to make
      // every later question about the last selected service.
      result=await ai.reply({conversationId:input.conversationId,requestId:input.requestId,question:input.question.trim(),vehicle:context?.ref??null},technical);
    }catch(error){
      const unavailable=error.code==='ai-not-configured';
      const messages={'ai-local-budget':'Den lokale kostnadsgrensa er nådd. Du kan framleis sende førespurnaden til Bjørn.','ai-rate-limit':'Det kom mange spørsmål på kort tid. Vent litt og prøv igjen.','ai-timeout':'Svaret tok for lang tid. Prøv igjen eller spør Bjørn.'};
      result={answer:unavailable?'AI-samtalen er ikkje konfigurert. Du kan kontakte Bjørn her.':messages[error.code]??'Eg fekk ikkje henta svaret. Prøv igjen, eller send spørsmålet til Bjørn.',handoff:'other',mode:unavailable?'unavailable':'error',errorCode:['ai-local-budget','ai-rate-limit','ai-quota','ai-busy','ai-timeout','ai-not-configured','ai-credit-unavailable','ai-account-limit','ai-context-limit'].includes(error.code)?error.code:'ai-unavailable'};
    }
    return journal.finishChat(input.conversationId,input.requestId,result,context);
  }
  return {event,chat};
}
