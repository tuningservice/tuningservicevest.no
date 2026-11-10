import {parseOfferContact} from './vehicle-offer-state.mjs';
import {defaultStageIndex,customerEngineName} from './vehicle-units.mjs';
import {preferredStage,requirementsView,dvxVariantFacts} from './dvx-model.mjs';
import {brandForDvx} from './vehicle-brand.mjs';
import {serviceFacts,offeredServiceOptions} from './vehicle-service-options.mjs';
import {identifiedResultLabel} from './customer-presentation.mjs';
const clone=value=>structuredClone(value);
export function vdbResult(details,label,selection,{simulated=false,brand=null,vehicleType=null,manufacturer=null,model=null,generation=null,registered=null}={}) {
  return {source:'vdb',sourceLabel:'Tuningfiles',label:identifiedResultLabel(registered,customerEngineName(details.name),label,{manufacturer,model,generation}),catalogLabel:label,brand:clone(brand),ids:{namespace:'tuningfiles',selection:clone(selection),engineId:String(details.id)},simulated,
    serviceFacts:serviceFacts({registered,catalog:{vehicleType,manufacturer,fuel:details.fuel,ecu:details.ecu,tcu:details.tcu,options:details.options,turbo:/\bturbo\b/i.test(details.engineType??'')?true:null}}),
    stages:details.remapStages.map((stage,index)=>({key:'vdb:'+index,source:'vdb',label:stage.stage==null?'Alternativ utan stegnummer':`Stage ${stage.stage}`,code:stage.stage==null?null:String(stage.stage),
      original:{powerHk:details.power,torqueNm:details.torque},tuned:{powerHk:stage.power,torqueNm:stage.torque},curves:{original:clone(details.curves??null),tuned:clone(stage.curves??null)},
      requirements:[['Krav til oppsett',stage.hardwareRequirements?[customerEngineName(stage.hardwareRequirements)]:[],'Ikkje oppgitt. Avklar oppsettet med Bjørn.']],sourceUrl:null})),
    defaultIndex:defaultStageIndex(details.remapStages)};
}
export function dvxResult(records,label,snapshot,{registered=null,brand=null,vehicleType=null}={}) {
  if(!records.length||records.some(r=>r.namespace!=='dvx'||r.vehicleId!==records[0].vehicleId))throw new Error('Mixed DVX variants.');
  const sorted=[...records].sort((a,b)=>a.stage.number-b.stage.number||Boolean(a.stage.qualifier)-Boolean(b.stage.qualifier));
  const preferred=preferredStage(sorted);
  return {source:'dvx',sourceLabel:'DVX Performance · fast snapshot',label:identifiedResultLabel(registered,sorted[0].engineDesignation,label),catalogLabel:label,brand:brand??brandForDvx(sorted[0].brand),ids:{namespace:'dvx',vehicleId:sorted[0].vehicleId,sourceIds:clone(sorted[0].sourceIds)},snapshot:clone(snapshot),simulated:false,
    serviceFacts:serviceFacts({registered,catalog:{vehicleType,...dvxVariantFacts(sorted[0])}}),
    stages:sorted.map(r=>({key:r.id,source:'dvx',label:'Stage '+(r.stage.code??r.stage.number),code:r.stage.code??String(r.stage.number),
      original:clone(r.original),tuned:clone(r.tuned),requirements:requirementsView(r),sourceUrl:/^https:\/\/dvxperformance\.com\/stage\//.test(r.source.url)?r.source.url:null,retrievedAt:r.source.retrievedAt,
      road:[...r.roadUse.items,...(r.roadUse.catalogNotices??[])].map(item=>item.nn),reviewFlags:clone(r.reviewFlags),
      optional:!!r.variantOfRecordId})),defaultIndex:sorted.findIndex(r=>r.id===preferred?.id)};
}
export function createChatSession({now=()=>new Date().toISOString(),uuid=()=>crypto.randomUUID()}={}) {
  let epoch=0;const messages=[];let active={epoch,source:null,registered:null,registration:null,result:null,stageKey:null,label:null,selection:null};let contactDraft=null,lastContact=null;
  function add(role,text,kind='text',data=null){const m={id:uuid(),at:now(),role,text,kind,data:clone(data),epoch};messages.push(m);return clone(m);}
  function reset(reason='new-vehicle'){
    for(const m of messages)if(['entry','selector','effect'].includes(m.kind)&&!m.retired)m.retired=true;
    epoch++;active={epoch,source:null,registered:null,registration:null,result:null,stageKey:null,label:null,selection:null};return epoch;
  }
  function invalidateResult(){active.result=null;active.stageKey=null;active.resultMessageId=null;active.selectedService=null;active.selectedServices=[];for(const m of messages)if(m.kind==='effect'&&!m.retired)m.retired=true;}
  function patch(values){active={...active,...clone(values),epoch};}
  function updateMessage(id,values){const m=messages.find(m=>m.id===id);if(m&&!m.retired){if(values.text!==undefined)m.text=values.text;if(values.data!==undefined)m.data=clone(values.data);}}
  function setResult(result){
    if(!['vdb','dvx','tsv'].includes(result.source)||result.stages.some(s=>s.source!==result.source))throw new Error('Mixed data sources.');
    if(active.source&&result.source!==active.source)throw new Error('Source changed without resetting vehicle.');
    const selected=active.selectedService,selectedServices=active.selectedServices??(selected?[selected]:[]);
    invalidateResult();active.source=result.source;active.label=result.label;active.result=clone(result);
    active.selectedService=selected?offeredServiceOptions(result.serviceFacts).find(o=>o.id===selected.id)??null:null;
    active.selectedServices=selectedServices.map(s=>offeredServiceOptions(result.serviceFacts).find(o=>o.id===s.id)).filter(Boolean);
    active.stageKey=result.stages[result.defaultIndex]?.key??null;
    const message=add('assistant',`Tuningalternativ for ${result.label}`,'effect',clone(result));active.resultMessageId=message.id;return message;
  }
  function chooseService(id,resultMessageId){
    if(!active.result||active.resultMessageId!==resultMessageId)throw new Error('Expired service selection.');
    const option=offeredServiceOptions(active.result.serviceFacts).find(o=>o.id===id);
    if(!option)throw new Error('Service is not relevant to the active vehicle.');
    active.selectedService=clone(option);return clone(option);
  }
  function chooseStage(key){
    const stage=active.result?.stages.find(s=>s.key===key);if(!stage)throw new Error('Stage unavailable for active vehicle.');
    if(active.stageKey!==key){active.stageKey=key;add('user',`Eg vel ${stage.label}.`,'stage-choice',{source:active.source,stage:clone(stage),ids:clone(active.result.ids)});}
    return clone(stage);
  }
  function packet(){return contactDraft?{type:'local-chat-contact-draft.v1',to:'vest@tuningservice.no',site:'https://tuningservicevest.no',delivery:'not-sent',
    contact:clone(contactDraft),conversation:clone(messages),vehicle:clone(active),stage:clone(active.result?.stages.find(s=>s.key===active.stageKey)??null)}:null;}
  function saveContact({contact,name='',message=''}){
    const parsed=parseOfferContact(contact);if(!parsed)throw Object.assign(new Error('invalid-contact'),{code:'invalid-contact'});
    if(typeof name!=='string'||name.length>100||typeof message!=='string'||message.length>3000)throw new Error('invalid-contact-fields');
    const fingerprint=JSON.stringify([parsed,name.trim(),message.trim()]);if(fingerprint===lastContact)return packet();lastContact=fingerprint;
    contactDraft={...parsed,name:name.trim(),message:message.trim(),savedAt:now()};
    add('user','Kontaktutkast til Bjørn er lagra lokalt.','contact-draft',{contact:clone(contactDraft)});return packet();
  }
  return {add,reset,patch,updateMessage,setResult,chooseStage,chooseService,invalidateResult,saveContact,packet,snapshot:()=>({epoch,messages:clone(messages),active:clone(active),hasContactDraft:!!contactDraft})};
}
export function simulatedReply(question){
  return /pris|kost|tilbod/i.test(question)?'Bjørn gir individuelle tilbod. Denne lokaltesten reknar ikkje ut prisar. Bruk Kontakt Bjørn for å lage eit lokalt kontaktutkast.'
    :'Eg kan hjelpe deg med modellval og vise effektalternativa. Bruk registreringsnummer eller vel manuelt. Spørsmålet ditt blir med i samtalen til eit seinare kontaktutkast.';
}
