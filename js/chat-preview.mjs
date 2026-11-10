import {confirmedBaseVehicle} from './vehicle-base.mjs';
import {registeredVehicleLabel,catalogModelName} from './vehicle-identity.mjs';
import {visibleRequirements} from './effect-graph-model.mjs';
import {generationQuestion,generationChoiceLabel} from './vehicle-generation-identity.mjs';
import {generationPeriod} from './vehicle-dates.mjs';
import {createChatSession,vdbResult,dvxResult} from './chat-session.mjs';
import {ownVehicleResult,ownManualOptions} from './tsv-catalogue.mjs';
import {assistantApiPath} from './assistant-api-path.mjs';
import {ensurePublicAssistantSession} from './public-assistant-session.mjs';
import {assertAssistantResponse} from './assistant-response.mjs';
import {createChatVehicleController} from './chat-vehicle-controller.mjs';
import {levels} from './vehicle-cascade.mjs';
import {kwToHk,customerEngineName} from './vehicle-units.mjs';
import {groupVariants} from './dvx-model.mjs';
import {createChatCatalogueLoader} from './chat-catalogue-loader.mjs';
import {dvxLevels,dvxLevelNames,dvxOptions,changeDvxSelection,displayDvxGeneration} from './chat-dvx-options.mjs';
import {brandForVdb,brandForDvx,createBrandBadge} from './vehicle-brand.mjs';
import {createEffectGraph} from './effect-graph.mjs';
import {createCarCombobox} from './chat-combobox.mjs';
import {createServiceOptions} from './chat-service-options.mjs';
import {serviceFollowUp} from './vehicle-service-options.mjs';
import {serviceFacts,offeredServiceOptions} from './vehicle-service-options.mjs';
import {dvxCandidateLabel} from './dvx-matching.mjs';
import {suggestCandidates} from './vehicle-matching.mjs';
import {customerText,customerHardwareText,hardwareReviewNote} from './customer-presentation.mjs';
import {createChatServerSync} from './chat-server-sync.mjs';
import {createChatContactFlow} from './chat-contact-flow.mjs';
import {mountContactEntries} from './contact-entry.mjs';
import {createChatTurns,nearChatBottom} from './chat-turns.mjs';
import {chatSuggestions} from './chat-suggestions.mjs';
import {vehicleCategoryLabel,manualCategoryRoute} from './vehicle-category-labels.mjs';
import {CHAT_WELCOME} from './chat-copy.mjs';
import {createChatUnread} from './chat-unread.mjs';
import {registrationMessageIntent} from './chat-registration.mjs';
import {createRegistrationPlate} from './registration-plate.mjs';
const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const session=createChatSession(),nodes=new Map(),cache=new Map();
const unread=createChatUnread(count=>{const badge=$('chat-unread');if(badge){badge.hidden=count===0;badge.textContent=count>9?'9+':String(count);badge.setAttribute('aria-label',count+' ulese meldingar');}$('chat-launch').setAttribute('aria-label',count?'Opne chat, '+count+' ulese meldingar':'Opne chat');});
let config=null,dvxGroups=[],catalogueLoader=null,snapshot=null,carCard=null,effectCard=null,entryCard=null,changing=false,latestVdb=null,detailSignature=null,manualSource='dvx';
const labels={types:'Køyretøytype',manufacturers:'Merke',models:'Modell',generations:'Utgåve/årsperiode',engines:'Motor'};
const customerLevels=levels.filter(l=>l!=='types'),dvxLabels={...dvxLevelNames,generation:'Utgåve/årsperiode'};
let aiRequest=null,aiRevision=0,registrationIntroPlayed=false,lookupRequestId=null;
let chatLookupNotice=null;
function updateChatLookupNotice(text){
 const notice=chatLookupNotice;if(!notice||notice.epoch!==session.snapshot().epoch)return;
 session.updateMessage(notice.message.id,{text});notice.node.replaceChildren(make('p',text),button('Sjå oppslaget',()=>{const target=effectCard?.node??carCard?.node;if(target)focusCard(target);} ,true));
 unread.receive(notice.message.id+':'+text);followChat(nearChatBottom($('chat-messages')));
}
function cancelAi(){aiRevision++;turns.cancel();for(const retry of document.querySelectorAll('[data-turn-retry]'))retry.remove();for(const row of document.querySelectorAll('[data-turn-pending]')){row.removeAttribute('data-turn-pending');row.classList.remove('waiting');row.replaceChildren(make('p','Spørsmålet gjaldt førre val.'));}aiRequest=null;}
let savedChatScroll={top:0,follow:true};
function showPanel(name){
 const open=name==='chat',panel=$('conversation-panel'),messages=$('chat-messages');
 if(!open&&!panel.hidden)savedChatScroll={top:messages.scrollTop,follow:nearChatBottom(messages)};
 const wasHidden=panel.hidden;panel.hidden=!open;$('chat-launch').hidden=open;
 if(open)unread.show();else unread.hide();
 $('journey-layout').dataset.mobilePanel=name;$('journey-layout').dataset.chatOpen=String(open);$('chat-launch').setAttribute('aria-expanded',String(open));
 if(open&&wasHidden)messages.scrollTop=savedChatScroll.follow?messages.scrollHeight:savedChatScroll.top;
 for(const id of ['vehicle','conversation']){const tab=$(id+'-tab'),selected=(id==='vehicle'?'vehicle':'chat')===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
}
for(const [id,name]of [['vehicle','vehicle'],['conversation','chat']]){$(id+'-tab').addEventListener('click',()=>showPanel(name));$(id+'-tab').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'vehicle':e.key==='End'?'conversation':id==='vehicle'?'conversation':'vehicle';showPanel(next==='vehicle'?'vehicle':'chat');$(next+'-tab').focus();}});}
function followChat(wasNear){if(wasNear&&!$('conversation-panel').hidden)$('chat-messages').scrollTop=$('chat-messages').scrollHeight;}
const errors={'ambiguous-vehicle':'Vi fann fleire kjøretøy på dette nummeret. Kva treff gjeld det?','not-found':'Vi fann ikkje eit treff. Du kan velje manuelt eller kontakte Bjørn.','svv-not-configured':'Regnr-oppslag er ikkje konfigurert. Vel manuelt.',
  'quota':'Tenesta har nådd førespurnadsgrensa. Vent litt og prøv igjen.','timeout':'Oppslaget tok for lang tid. Prøv igjen.','access-denied':'Tilgangen til oppslagstenesta vart avvist. Prøv manuelt val eller kontakt Bjørn.',
  'invalid-registration':'Skriv 2–7 bokstavar og tal i registreringsnummeret.','invalid-response':'Oppslagstenesta gav eit uventa svar. Prøv igjen eller vel manuelt.',
  'vdb-not-configured':'Modellveljaren er ikkje tilgjengeleg. Prøv seinare eller kontakt Bjørn.','car-type-unavailable':'Modellveljaren er ikkje tilgjengeleg. Kontakt Bjørn for hjelp.','upstream-unavailable':'Oppslagstenesta svarar ikkje. Prøv igjen eller kontakt Bjørn.'};
const manualReasons={hybrid:'Registrert som hybrid.','multiple-engines':'Registeret har fleire motoroppføringar.','multiple-fuels':'Registeret har fleire drivstoffoppføringar.',
  'conflicting-identity':'Merke eller modell er motstridande.','missing-manufacturer':'Merke manglar.','missing-model':'Modell manglar.','missing-engine':'Motoropplysningar manglar.',
  'missing-fuel':'Drivstoff manglar.','hybrid-status-unknown':'Drivlinjetypen er ikkje eintydig oppgitt.','invalid-hybrid-flag':'Drivlinjefeltet har uventa format.',
  'invalid-hybrid-category':'Drivlinjekategorien har uventa format.','conflicting-hybrid-data':'Drivlinjeopplysningane er motstridande.',
  'invalid-first-registration':'Førstegongsregistreringa har ein ugyldig dato.',
  'invalid-norway-registration':'Datoen for førstegongsregistrering i Noreg er ugyldig.',
  'conflicting-registration-dates':'Registreringsdatoane er motstridande.'};
const fmt=(value,unit)=>typeof value==='number'&&Number.isFinite(value)?`${Math.round(value)} ${unit}`:null;
async function api(url,{signal,...options}={}){
  if(url!=='/api/chat-session'&&typeof serverSync!=='undefined'){const id=serverSync.state().conversationId;if(id)options.headers={...options.headers,'X-Chat-Conversation':id};}
  let response;try{response=await fetch(assistantApiPath(url),{...options,redirect:'manual',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(28000)])});}
  catch(error){if(signal?.aborted)throw new DOMException('Aborted','AbortError');throw Object.assign(new Error('request-failed'),{code:error.name==='TimeoutError'?'timeout':'upstream-unavailable'});}
  assertAssistantResponse(response);
  let data;try{data=await response.json();}catch{throw Object.assign(new Error('invalid-response'),{code:'invalid-response'});}
  if(!response.ok)throw Object.assign(new Error('request-failed'),{code:data.error?.code||'upstream-unavailable',actions:data.actions,candidates:data.candidates});return data;
}
async function loadCatalog(level,id,signal){
  const key=level+':'+(id||''),cached=cache.get(key);if(cached&&Date.now()-cached.at<120000)return structuredClone(cached.data);
  const query=new URLSearchParams({level});if(id)query.set('id',id);const body=await api('/api/vehicle-catalog?'+query,{signal});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');while(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),data:body.data});return body.data;
}
const serverSync=createChatServerSync({api,onError:()=>{$('announcer').textContent='Samtalen er ikkje ferdig lagra på serveren. Innhaldet er bevart for nytt forsøk.';}});
const contactFlow=createChatContactFlow({api,sync:serverSync,beforeSend:()=>{if(aiRequest||controller.snapshot().resolving||controller.snapshot().loading)throw {code:'conversation-busy'};},mount:(root,anchor)=>{
  $('offer-panel').hidden=false;$('offer-content').replaceChildren(root);
},onRegistered:result=>session.add('assistant',result.message,'contact-receipt',{id:result.id})});
function vehicleReference(result,stageKey,lookupToken=session.snapshot().active.chatLookupToken){return {source:result.source,selection:result.source==='vdb'?result.ids.selection:{vehicleId:result.ids.vehicleId},...(result.source==='vdb'?{engineId:result.ids.engineId}:{}),stageKey,...(lookupToken?{lookupToken}:{})};}
function addContactActions(node,actions){for(const action of actions??[])if(action.type==='contact_bjorn'){for(const old of document.querySelectorAll('[data-contact-action]'))old.remove();const b=button('Få tilbod',()=>openContact(action.anchorEventId),true);b.dataset.contactAction='true';node.append(b);}}
function announce(text){$('announcer').textContent=text;}
function contextLabel(){const active=session.snapshot().active;return active.label?[active.label,active.result?.stages.find(s=>s.key===active.stageKey)?.label].filter(Boolean).join(' · '):active.registered?`Registrert: ${registeredVehicleLabel(active.registered)} · variant ikkje stadfesta`:'Ingen val enno';}
function renderChatSuggestions(){const root=$('chat-suggestions'),items=chatSuggestions(session.snapshot().active);root.replaceChildren();const primary=make('div',null,'chat-primary-suggestions');const action=item=>button(item.label,()=>item.action==='contact'?openContact():askQuestion(item.question),true);primary.append(...items.primary.map(action));const more=make('details');more.append(make('summary','Fleire spørsmål'));const extra=make('div',null,'chat-more-suggestions');extra.append(...items.more.map(action));more.append(extra);root.append(primary,more);}
function syncContext(){const text=contextLabel();$('active-context').textContent=text;$('vehicle-context').hidden=!session.snapshot().active.source;const a=session.snapshot().active;$('active-source-debug').textContent=a.result?'Intern resultatreferanse: '+JSON.stringify(a.result.ids):a.source?'Val under arbeid: '+a.source:'Ingen val enno.';renderChatSuggestions();}
function messageNode(message){const li=make('li'),article=make('article',null,'message '+message.role),vehicle=['entry','selector','effect'].includes(message.kind),wasNear=nearChatBottom($('chat-messages'));if(['vehicle-choice','lookup-request'].includes(message.kind))li.hidden=true;if(message.text)article.append(make('p',message.text));li.append(article);$(vehicle?'vehicle-content':'chat-messages').append(li);nodes.set(message.id,{li,article});if(!vehicle){if(message.role==='assistant'&&message.text)unread.receive(message.id);followChat(wasNear);}return article;}
function say(role,text,kind='text',data=null){const m=session.add(role,text,kind,data);const n=messageNode(m);return {message:m,node:n};}
// History stays in the session/journal, not in obsolete interactive DOM. Hidden
// selectors reused field IDs and could steal a new car's label/focus target.
function retire(){for(const message of session.snapshot().messages)if(message.retired){const n=nodes.get(message.id);if(n){n.li.remove();nodes.delete(message.id);}}}
function resetVehicle(){for(const b of chatLookupNotice?.node.querySelectorAll('button')??[])b.disabled=true;chatLookupNotice=null;cancelAi();effectCard?.dispose?.();$('vehicle-actions').replaceChildren();$('offer-panel').hidden=true;serverSync.event('reset');contactFlow.dirty();changing=true;controller.cancel();session.reset();retire();carCard=null;effectCard=null;entryCard=null;detailSignature=null;latestVdb=null;changing=false;syncContext();}
function invalidateEffect({preserveServices=false}={}){const active=session.snapshot().active;cancelAi();effectCard?.dispose?.();$('vehicle-actions').replaceChildren();session.invalidateResult();if(preserveServices)session.patch({selectedService:active.selectedService??null,selectedServices:active.selectedServices??[]});retire();effectCard=null;detailSignature=null;syncContext();}
function button(text,action,secondary=false){const b=make('button',text,secondary?'secondary-button':null);b.type='button';b.addEventListener('click',action);return b;}
function focusCard(card){if(card.closest('#vehicle-content')){showPanel('vehicle');$('vehicle-content').scrollTop=0;}card.setAttribute('tabindex','-1');card.focus({preventScroll:true});}
function createEntry(){
  const home=$('vehicle-journey');if(home)home.dataset.journeyState='entry';
  const {message,node}=say('assistant','Finn moglegheitene','entry');node.querySelector(':scope > p')?.remove();
  const form=make('form'),label=make('label','Registreringsnummer');const id='registration-'+message.id;label.htmlFor=id;
  const input=make('input');input.id=id;input.maxLength=10;input.autocomplete='off';input.spellcheck=false;input.placeholder='AB 12345';input.autocapitalize='characters';input.setAttribute('aria-describedby','lookup-help-'+message.id);
  const plate=createRegistrationPlate('',{input});
  const row=make('div',null,'lookup-input'),submit=make('button','Slå opp');submit.type='submit';row.append(plate,submit);
  const help=make('p',config?.lookupMode==='simulated'?'TESTDATA: Regnr-flyten er simulert i denne testserveren.':'Vi hentar berre tekniske opplysningar, ingen eigaropplysningar.','help');help.id='lookup-help-'+message.id;
  form.append(label,row,help);node.append(form,button('Vel manuelt',()=>beginManual(),true));if(!home)node.append(button('Still eit spørsmål',()=>{showPanel('chat');$('chat-question').focus();},true));
  const stopIntro=()=>plate.classList.remove('registration-arrival');
  for(const event of ['input','keydown','pointerdown'])input.addEventListener(event,stopIntro,{once:true});
  plate.addEventListener('animationend',stopIntro,{once:true});
  if(!registrationIntroPlayed){registrationIntroPlayed=true;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)plate.classList.add('registration-arrival');}
  if(config&&config.lookupMode==='unavailable'){submit.disabled=true;help.textContent='Regnr-tenesta er ikkje tilgjengeleg. Vel manuelt eller skriv eit spørsmål.';}
  form.addEventListener('submit',event=>{event.preventDefault();const registration=input.value.trim().toUpperCase().replace(/ /g,'');if(!/^[A-Z0-9]{2,7}$/.test(registration)){input.setAttribute('aria-invalid','true');help.textContent=errors['invalid-registration'];return;}beginLookup({registration});});
  entryCard={node,input,submit,help};return node;
}
function searchable(parent,{id,label,rows,value='',disabled=false,onSelect}){
  parent.append(createCarCombobox({id,label,rows,value,disabled,onSelect}));
}
function createCarCard(source,text){
  const home=$('vehicle-journey');if(home)home.dataset.journeyState='active';
  const {message,node}=say('assistant',text,'selector',{source});
  const facts=make('div'),note=make('p',null,'help'),fields=make('div',null,'car-fields'),status=make('p',null,'status');status.setAttribute('role','status');
  const services=make('div');node.append(facts,note,fields,status,services);
  const plate=createRegistrationPlate(session.snapshot().active.registration);if(plate){const row=make('div',null,'vehicle-registration');row.append(plate);node.insertBefore(row,facts);}
  carCard={message,node,source,facts,note,fields,status,services,editing:true,confirmed:false,queries:{},lookup:null,proposal:null,dvxSelection:{},showAll:false};return carCard;
}
function renderPendingServices(card){
  card.services.replaceChildren();if(!card.lookup?.vehicle||card.confirmed||session.snapshot().active.result)return;
  const vehicle=card.lookup.vehicle;
  card.services.append(createServiceOptions(serviceFacts({registered:vehicle}),(option,ids)=>selectServices(ids,serviceFacts({registered:vehicle})),session.snapshot().active.selectedServices?.map(o=>o.id)??[],(options,change)=>askQuestion(serviceFollowUp(options,change))),button('Få tilbod',()=>openContact()));
}
function selectServices(ids,facts){const available=serviceFactsOptions(facts),options=ids.map(id=>available.find(o=>o.id===id)).filter(Boolean);session.patch({selectedServices:options,selectedService:options.at(-1)??null});serverSync.event('service',{serviceIds:ids});contactFlow.dirty();syncContext();return true;}
function serviceFactsOptions(facts){return offeredServiceOptions(facts);}
function customerRegisteredLabel(card){const v=card.lookup.vehicle,model=card.dvxSelection?.model;return registeredVehicleLabel({...v,model:model&&catalogModelName(v.model,v.manufacturer).toLowerCase()===model.toLowerCase()?model:v.model},card.dvxSelection?.brand);}
function renderVdb(state){
  if(changing||!carCard||carCard.source!=='vdb'||session.snapshot().active.source!=='vdb')return;
  latestVdb=state;const card=carCard;const chosen=Object.fromEntries(levels.map(l=>[l,state.rows[l].find(r=>String(r.id)===state.selected[l])]));
  if(state.error&&card.lookupRequest&&!card.lookup){
    card.facts.replaceChildren(make('h2','Vi fekk ikkje henta opplysningane'));card.fields.replaceChildren();card.note.hidden=true;
    const intro=card.node.querySelector(':scope > p');if(intro)intro.textContent='Oppslaget kunne ikkje fullførast.';
    card.status.textContent=errors[state.error]||errors['upstream-unavailable'];card.status.dataset.error='true';return;
  }
  card.note.hidden=false;
  const title=['manufacturers','models','generations','engines'].map(l=>chosen[l]?.name).filter(Boolean).map(customerEngineName).join(' · ');
  session.patch({source:'vdb',selection:state.selected,label:state.selected.engines?title:null});
  const makeMatchesReference=!card.lookup||!!chosen.manufacturers&&suggestCandidates('manufacturers',[chosen.manufacturers],{...card.lookup.vehicle,requiresManual:false}).ids.length===1;
  card.facts.replaceChildren(createBrandBadge(makeMatchesReference?brandForVdb(state.rows,state.selected):null));
  if(card.lookup){const v=card.lookup.vehicle,knownGeneration=state.generationReview?.identity.generation?.label;card.facts.append(make('h2',registeredVehicleLabel(knownGeneration?{...v,model:knownGeneration}:v,makeMatchesReference?chosen.manufacturers?.name:null)||'Opplysningar må avklarast'));
    card.facts.append(make('p','Registrerte opplysningar: '+[v.fuel,fmt(kwToHk(v.engineKw),'HK'),fmt(v.engineCc,'cm³'),v.gearbox,v.engineCode?'Motorkode '+v.engineCode:null].filter(Boolean).join(' · ')));
    const base=confirmedBaseVehicle(v);if(base)card.facts.append(make('p','Grunnbil: '+base.label+(base.status==='customer-confirmed'?' · stadfesta av deg.':'.'),'help'),button('Endre grunnbil',()=>chooseBaseVehicle('unconfirmed'),true));
    if(v.firstRegistered)card.facts.append(make('p','Førstegongsregistrert '+v.firstRegistered+'.','help'));
    if(card.lookup.simulated)card.facts.append(make('p','TESTDATA – ikkje eit faktisk registeroppslag er gjort.','notice'));
  }else card.facts.append(make('h2','Vel type og modell'));
  card.fields.replaceChildren();const groupedGenerations=!!(card.lookup&&!card.showAll&&!state.selected.models&&state.paths.length&&state.paths.every(p=>p.model?.id)&&state.paths.every(p=>new Set(state.paths.filter(q=>q.generation.id===p.generation.id).map(q=>q.model.id)).size===1));
  if(card.lookup&&card.proposal?.kind==='choose-base-vehicle'&&!state.resolving&&!state.loading&&!card.baseQuestionDismissed){
    card.note.textContent='Bubilmerket er registrert. Kva grunnbil er bubilen bygd på?';card.note.hidden=false;
    searchable(card.fields,{id:'chat-base-vehicle',label:'Grunnbil',rows:card.proposal.baseOptions.map(option=>({id:option.id,name:option.label})),value:'',onSelect:chooseBaseVehicle});
    card.fields.append(button('Annan grunnbil / veit ikkje',()=>{card.baseQuestionDismissed=true;beginManual('vdb');},true));
    card.status.textContent='Vi brukar dei registrerte motoropplysningane vidare. Du slepp å skrive dei inn på nytt.';
    renderPendingServices(card);syncContext();return;
  }
  const pending=groupedGenerations?'generations':levels.find(l=>!state.selected[l]),noEngineCoverage=!!(card.lookup&&card.proposal?.kind==='no-engine-match'&&!state.paths.length&&!state.resolving&&!card.showAll);
  const manualReview=!!card.lookup?.vehicle.requiresManual,review=state.generationReview;
  if(pending==='generations'&&!card.showAll&&review?.suggestion&&review.options.length>1){
    const suggestion=review.options.find(g=>String(g.id)===review.suggestion.id);
    card.fields.append(make('p','Forslag ut frå registreringsåret: '+generationChoiceLabel(suggestion)+'. Stemmer dette?','notice'));
    const accept=button('Ja, bruk denne utgåva',()=>changeVdb('generations',review.suggestion.id));accept.disabled=state.resolving||!!state.loading;card.fields.append(accept);
  }
  const visibleLevels=pending==='types'||card.manualCategories?levels:customerLevels;
  for(const level of visibleLevels.filter(l=>!noEngineCoverage&&(card.lookup&&!card.editingAll?l===pending:state.selected[l]||l===pending))){
    const ids=level==='generations'?state.paths.map(p=>String(p.generation.id)):level==='engines'?state.paths.filter(p=>String(p.generation.id)===state.selected.generations).map(p=>String(p.engine.id)):[];
    const rows=!card.showAll&&manualReview&&level==='generations'&&review?review.options:manualReview&&level==='engines'?state.rows[level]:groupedGenerations&&level==='generations'?[...new Map(state.paths.map(p=>[p.generation.id,p.generation])).values()]:!card.showAll&&card.lookup&&['generations','engines'].includes(level)?state.rows[level].filter(r=>ids.includes(String(r.id))):state.rows[level];
    searchable(card.fields,{id:'chat-vdb-'+level,label:labels[level],rows:rows.map(r=>({...r,name:level==='types'?vehicleCategoryLabel(r.name):level==='generations'?generationChoiceLabel(r):r.name})).concat(level==='models'?ownManualOptions(state.selected.types,state.selected.manufacturers,card.lookup?.vehicle):[]),value:state.selected[level],disabled:state.resolving||level===pending&&!!state.loading,onSelect:value=>level==='models'&&value.startsWith('tsv:')?confirmOwnVehicle(value):level==='types'&&card.manualCategories?chooseManualCategory(value):changeVdb(level,value)});
  }
  if(noEngineCoverage){const review=make('details'),summary=make('summary','Kontroller valet');review.append(summary,make('p','Ingen motoroppføringar samsvarar med dei registrerte opplysningane. Du kan kontrollere valet manuelt om noko er feil.','help'),button('Opne katalogval for kontroll',()=>beginManual('vdb'),true));card.fields.append(review);}
  else if(card.lookup&&!card.showAll&&!(manualReview&&pending==='engines'))card.fields.append(button(pending==='engines'?'Vis alle motorar':'Vis alle alternativ',()=>{card.showAll=true;renderVdb(controller.snapshot());},true));
  const confirm=button(state.details?'Vis resultat':'Sjå tuningalternativ',()=>{card.editing=false;if(state.details){renderVdb(controller.snapshot());if(effectCard)focusCard(effectCard.node);}else{invalidateEffect({preserveServices:!!card.lookup});controller.confirm();}});confirm.disabled=state.resolving||!!state.loading||!state.selected.engines;confirm.hidden=!state.selected.engines;card.fields.append(confirm);
  if(state.details)card.editing=false;
  card.fields.hidden=!!state.details&&!card.editing;card.note.hidden=card.fields.hidden;
  nodes.get(card.message.id).li.hidden=!!state.details&&!card.editing;
  let text=state.resolving?'Hentar opplysningar …':state.loading?'Hentar alternativ …':state.details?'Valet er stadfesta.':pending?'Vel '+labels[pending].toLocaleLowerCase('nn-NO')+' for å gå vidare.':'Stemmer opplysningane?';
  if(state.error)text=errors[state.error]||errors['upstream-unavailable'];if(state.empty)text='Ingen alternativ for dette valet. Endre valet eller kontakt Bjørn.';
  if(pending==='generations'&&review?.identity.generation&&!state.resolving&&!state.loading&&!state.error)text=review.conflicting?'Opplysningane er motstridande. Bjørn kan hjelpe deg å avklare utgåva.':review.identity.generation.label+' er identifisert. Stadfest utgåva.';
  if(noEngineCoverage){text='Vi fann opplysningane, men har ikkje stadfesta tuningtal for denne motorvarianten. Du kan framleis velje tilval og få tilbod frå Bjørn.';card.note.hidden=true;}
  if(card.lookup&&card.proposal?.kind==='no-engine-match'&&!state.paths.length&&card.showAll&&!state.details){text='Manuell kontroll: Lista inneheld andre motorvariantar. Ingen av dei er stadfesta som treff på dei registrerte dei tekniske opplysningane.';card.note.hidden=true;}
  card.status.textContent=text;card.status.dataset.error=String(!!state.error);if(state.details)card.services.replaceChildren();else renderPendingServices(card);
  if(state.error)card.fields.append(button('Prøv igjen',()=>{const parent=[...levels].reverse().find(l=>state.selected[l]);if(parent){invalidateEffect();controller.change(parent,state.selected[parent]);}else controller.manual();},true));
  session.updateMessage(card.message.id,{data:{source:'vdb',registered:card.lookup?.vehicle??null,simulated:!!card.lookup?.simulated,proposal:card.proposal,selection:state.selected,label:title}});syncContext();
  if(state.details){const signature=JSON.stringify([session.snapshot().epoch,state.details]);if(signature!==detailSignature){detailSignature=signature;const result=vdbResult(state.details,title,state.selected,{simulated:config?.vdbMode==='simulated',brand:brandForVdb(state.rows,state.selected),vehicleType:chosen.types?.name,manufacturer:chosen.manufacturers?.name,model:chosen.models?.name,generation:chosen.generations?.name,registered:card.lookup?.vehicle});result.lookupSimulated=!!card.lookup?.simulated;showResult(result);}}
}
const controller=createChatVehicleController({autoConfirm:true,loadCatalog,lookup:async(body,{signal,demo})=>{await serverSync.flush();return api(demo?'/api/vehicle-demo':'/api/vehicle-lookup',{signal,method:'POST',headers:{'Content-Type':'application/json','X-Chat-Conversation':serverSync.state().conversationId,...(!demo?{'X-Chat-Lookup-Id':lookupRequestId??=crypto.randomUUID()}:{})},body:JSON.stringify(body)});},onState:renderVdb,
  resolvePreferred:(result,signal)=>api('/api/chat-vehicle-proposal',{signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lookupToken:result.chatLookupToken})}),
  onPreferred:async(proposal,result)=>{if(!carCard)return;if(proposal.source==='tsv'){confirmOwnVehicle(proposal.selections.vehicleId,result);return;}const card=carCard;try{dvxGroups=await catalogueLoader.ensureBrand(proposal.selections.brand);}catch{if(carCard===card)card.status.textContent='Kunne ikkje hente motoralternativa. Prøv igjen.';return;}if(carCard!==card)return;carCard.note.textContent='';carCard.source='dvx';carCard.lookup=result;carCard.proposal=proposal;carCard.dvxSelection={...proposal.selections};session.patch({source:'dvx'});serverSync.event('selection',{source:'dvx',selection:carCard.dvxSelection,lookupToken:result.chatLookupToken});contactFlow.dirty();$('lookup-debug').textContent=JSON.stringify({registered:result.vehicle,preferredSource:'dvx',proposal},null,2);renderDvx();if(proposal.kind==='complete')confirmDvx();},
  onLookup:result=>{if(!carCard)return;updateChatLookupNotice('Eg fann '+registeredVehicleLabel(result.vehicle)+'. Sjå opplysningane i resultatpanelet.');carCard.lookup=result;serverSync.event('registered',{lookupToken:result.chatLookupToken});contactFlow.dirty();session.patch({registered:result.vehicle,registeredSimulated:!!result.simulated,lookupToken:result.lookupToken??null,chatLookupToken:result.chatLookupToken??null});},
  onProposal:(proposal,result)=>{if(!carCard)return;if(proposal.kind==='manual')carCard.showAll=false;serverSync.event('selection',{source:'vdb',selection:proposal.selections,...(result.chatLookupToken?{lookupToken:result.chatLookupToken}:{})});carCard.proposal=proposal;if(proposal.kind==='complete')carCard.editing=false;const v=result.vehicle;$('lookup-debug').textContent=JSON.stringify({registered:v,normalizedModel:catalogModelName(v.model,v.manufacturer),proposal,registrationYearNote:'Berre gyldig førstegongsregistrering, ikkje Noreg-dato eller årshint, kan utelukke generasjonar som startar meir enn eitt kalenderår seinare. Sluttår utelukkar ikkje sein registrering. Datoen identifiserer ikkje modellår.'},null,2);carCard.note.textContent=result.vehicle.requiresManual?(result.vehicle.manualReasons||[]).map(r=>manualReasons[r]||'Opplysningane må avklarast.').join(' ')+' Vel manuelt.'
      :proposal.kind==='choose-base-vehicle'?'Kva grunnbil er bubilen bygd på?':proposal.kind==='complete'?'Vi fann eitt underbygd treff og hentar tuningalternativa.':proposal.kind==='conflicting-generation-data'?'Registreringsdatoen og opplysningane om utgåva er motstridande. Bjørn kan hjelpe deg å avklare opplysningane.':proposal.kind==='no-engine-match'?'Opplysningane er henta, men vi har ikkje stadfesta tuningtal for denne motorvarianten.':proposal.kind==='choose-engine'?(proposal.paths.length===1?'Vi fann eitt mogleg motoralternativ, men manglar opplysningar for å stadfeste det automatisk. Er du usikker, kan Bjørn avklare det.':'Vel motoren som stemmer.'):proposal.kind==='choose-generation'&&proposal.paths.length?generationQuestion(proposal.paths):'Vi fann ikkje eit sikkert forslag. Fullfør valet manuelt.';announce(carCard.note.textContent);},
  onError:error=>{if(!carCard)return;updateChatLookupNotice(errors[error.code]||errors['upstream-unavailable']);addContactActions(carCard.node,error.actions);carCard.status.textContent=errors[error.code]||errors['upstream-unavailable'];carCard.status.dataset.error=String(error.code!=='ambiguous-vehicle');carCard.note.textContent=carCard.status.textContent;
    const candidates=error.code==='ambiguous-vehicle'?error.candidates:null;
    if(candidates?.length){carCard.facts.replaceChildren(make('h2','Kva treff gjeld det?'));if(candidates.some(c=>c.simulated))carCard.facts.append(make('p','TESTDATA – simulerte registertreff.','notice'));carCard.fields.replaceChildren();carCard.note.hidden=true;const intro=carCard.node.querySelector(':scope > p');if(intro)intro.textContent='Vel type og modell for å halde fram.';
      for(const candidate of candidates){const v=candidate.vehicle,label=[registeredVehicleLabel(v),v.fuel,fmt(kwToHk(v.engineKw),'HK'),v.firstRegistered?'Førstegongsregistrert '+v.firstRegistered:null].filter(Boolean).join(' · ');
        carCard.fields.append(button(label,()=>{for(const control of carCard.fields.querySelectorAll('button'))control.disabled=true;carCard.note.textContent='';carCard.status.textContent='Hentar tuningalternativa …';say('user',registeredVehicleLabel(v),'vehicle-choice');controller.chooseLookup(candidate);},true));}
    }
    const request=carCard.lookupRequest;if(request&&error.code!=='ambiguous-vehicle')carCard.fields.append(button('Prøv oppslaget igjen',()=>beginLookup(request.body,{demo:request.demo})));carCard.fields.append(button('Vel manuelt',()=>beginManual('vdb'),true));announce(carCard.status.textContent);}
});
async function chooseBaseVehicle(baseId){
  let card=carCard;if(!card?.lookup||card.baseLoading)return;if(!card.node.isConnected){const lookup=card.lookup;card=createCarCard('vdb','Eg finn motoralternativa.');card.lookup=lookup;}card.baseLoading=true;card.status.textContent='Finn motoralternativa …';for(const b of card.fields.querySelectorAll('button'))b.disabled=true;
  try{const result=await api('/api/chat-base-vehicle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lookupToken:session.snapshot().active.chatLookupToken,baseId})});if(carCard!==card)return;
    cancelAi();invalidateEffect({preserveServices:true});card.proposal=null;card.baseLoading=false;card.baseQuestionDismissed=false;card.confirmed=false;card.editing=true;card.showAll=false;card.dvxSelection={};card.source='vdb';session.patch({source:'vdb'});await controller.chooseLookup(result);
  }catch(error){if(carCard===card){card.baseLoading=false;card.status.textContent=errors[error.code]??'Kunne ikkje lagre grunnvalet. Prøv igjen.';for(const b of card.fields.querySelectorAll('button'))b.disabled=false;}}
}
function newEntry(){resetVehicle();focusCard(createEntry());entryCard.input.focus();}
function beginLookup(body,{demo=false,chatMessage=null}={}){
  lookupRequestId=crypto.randomUUID();
  manualSource='dvx';$('chat-dev-source').value='dvx';
  resetVehicle();say('user',demo?'Bruk syntetiske testdata.':'Slå opp registreringsnummeret.','lookup-request',demo?{simulated:true,scenario:body.scenario}:{registration:body.registration});
  if(chatMessage){say('user',chatMessage);chatLookupNotice={...say('assistant','Eg sjekkar registreringsnummeret …','lookup-status'),epoch:session.snapshot().epoch};serverSync.event('registration-message',{message:chatMessage});}
  session.patch({source:'vdb',registration:demo?null:body.registration});if(!demo)serverSync.event('lookup-input',{registration:body.registration});const card=createCarCard('vdb','Eg sjekkar opplysningane og tuningalternativa.');card.lookupRequest={body:structuredClone(body),demo};focusCard(card.node);controller.find(body,{demo});if(chatMessage){showPanel('chat');$('chat-question').focus({preventScroll:true});}
}
async function beginManual(source=manualSource){
  // Continue the current registered vehicle; only "Endre val" starts over.
  // Keep its source, actual catalogue IDs, lookup token, extras and journal.
  if(source==='vdb'&&carCard?.source==='vdb'&&carCard.lookup){
    carCard.showAll=true;carCard.editing=true;
    carCard.note.textContent='Vel blant alternativa for denne modellen. Finn du ikkje rett motor, kan Bjørn hjelpe deg.';
    const state=controller.snapshot();renderVdb(state);
    const pending=levels.find(level=>!state.selected[level]);
    if(pending)document.getElementById('chat-vdb-'+pending+'-search')?.focus({preventScroll:true});
    return;
  }
  manualSource=source==='dvx'?'dvx':'vdb';source=manualSource;$('chat-dev-source').value=source;
  resetVehicle();say('user','Eg vil velje type og modell manuelt.','vehicle-choice');session.patch({source:'vdb'});
  const card=createCarCard('vdb','');card.manualCategories=true;card.manualPreferredSource=source;focusCard(card.node);
  await controller.manual();if(carCard===card)card.manualTypes=controller.snapshot().rows.types;
}
async function chooseManualCategory(value){
  const card=carCard;if(!card?.manualCategories)return;
  const rows=card.manualTypes??controller.snapshot().rows.types,route=manualCategoryRoute(rows.find(row=>String(row.id)===String(value)),card.manualPreferredSource);
  const revision=(card.manualCategoryRevision??0)+1;card.manualCategoryRevision=revision;
  serverSync.event('reset');contactFlow.dirty();
  invalidateEffect();card.confirmed=false;card.editing=true;card.proposal=null;card.dvxSelection={};card.queries={};card.manualTypes=rows;card.manualType=route?.id??'';
  card.source=route?.source??'vdb';session.patch({source:card.source,selection:{},label:null});$('chat-dev-source').value=card.source;
  if(route?.source==='dvx'){
    controller.cancel();say('user','Køyretøytype: '+vehicleCategoryLabel(route.name),'vehicle-choice');renderDvx();document.getElementById('chat-dvx-brand-search')?.focus({preventScroll:true});return;
  }
  await controller.manual();if(carCard!==card||card.manualCategoryRevision!==revision)return;
  if(route)await changeVdb('types',route.id);
  contactFlow.dirty();
}
async function changeVdb(level,value){
  if(!carCard)return;const state=controller.snapshot();const row=state.rows[level].find(r=>String(r.id)===String(value))??(level==='generations'?state.paths.find(p=>String(p.generation.id)===String(value))?.generation:null);
  if(state.selected[level]===String(value))return;
  const nextSelection={...state.selected};let remove=false;for(const name of levels){if(name===level){remove=true;if(value)nextSelection[name]=String(value);else delete nextSelection[name];}else if(remove)delete nextSelection[name];}for(const name of levels)if(!nextSelection[name])delete nextSelection[name];
  if(level==='generations'&&!nextSelection.models){const parents=[...new Set(state.paths.filter(p=>String(p.generation.id)===String(value)).map(p=>p.model?.id).filter(Boolean))];if(parents.length===1)nextSelection.models=String(parents[0]);}
  const token=session.snapshot().active.chatLookupToken;
  serverSync.event('selection',{source:'vdb',selection:nextSelection,...(token?{lookupToken:token}:{})});contactFlow.dirty();
  invalidateEffect({preserveServices:!!carCard.lookup});if(['types','manufacturers','models'].includes(level)){carCard.proposal=null;carCard.showAll=true;if(carCard.lookup){carCard.editingAll=true;carCard.note.textContent='Fullfør valet med opplysningane over som referanse.';}}
  for(const child of levels.slice(levels.indexOf(level)))delete carCard.queries[child];
  say('user',row?`${labels[level]}: ${level==='types'?vehicleCategoryLabel(row.name):customerEngineName(row.name)}`:`Eg endrar ${labels[level].toLocaleLowerCase('nn-NO')}.`,'vehicle-choice',{source:'vdb',level,id:value});
  await controller.change(level,value);
  if(carCard?.source==='vdb'){const pending=levels.find(l=>!controller.snapshot().selected[l]);const target=pending?document.getElementById('chat-vdb-'+pending+'-search'):carCard.fields.querySelector('button');if(target&&!target.disabled)target.focus({preventScroll:true});}
}
async function confirmDvx(){
  if(!carCard||carCard.source!=='dvx')return;
  const card=carCard,s=card.dvxSelection,group=dvxGroups.find(g=>g.id===s.variant);if(!group)return;
  if(card.confirmingVariant===s.variant)return;card.confirmingVariant=s.variant;const request=card.resultRequest=(card.resultRequest??0)+1;
  const r=group.stages[0],label=[r.brand,r.model,displayDvxGeneration(r.generation),r.engineDesignation,fmt(r.original.powerHk,'HK')].filter(Boolean).join(' · ');
  const epoch=session.snapshot().epoch,variant=s.variant;card.status.textContent='Hentar tuningalternativa …';
  const facts=await api('/api/chat-dvx-facts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vehicleId:variant})}).catch(()=>({}));
  if(request!==card.resultRequest)return;card.confirmingVariant=null;if(carCard!==card||session.snapshot().epoch!==epoch||card.dvxSelection.variant!==variant)return;
  card.editing=false;card.confirmed=true;session.updateMessage(card.message.id,{data:{source:'dvx',selection:s,label,snapshot}});renderDvx();
  const result=dvxResult(group.stages,label,snapshot,{...facts,registered:card.lookup?.vehicle});result.lookupSimulated=!!card.lookup?.simulated;showResult(result);
}
function renderDvx(){
  if(!carCard||carCard.source!=='dvx')return;const card=carCard,s=card.dvxSelection;
  const makeMatchesReference=!card.lookup||suggestCandidates('manufacturers',[{id:'reference',name:s.brand}],{...card.lookup.vehicle,requiresManual:false}).ids.length===1;
  card.facts.replaceChildren(createBrandBadge(makeMatchesReference?brandForDvx(s.brand):null),make('h2',card.lookup?registeredVehicleLabel(card.lookup.vehicle,makeMatchesReference?s.brand:null):'Vel type og modell'));card.fields.replaceChildren();
  if(card.lookup){const v=card.lookup.vehicle;card.facts.append(make('p',[v.fuel,fmt(kwToHk(v.engineKw),'HK'),fmt(v.engineCc,'cm³'),v.gearbox,v.engineCode?'Motorkode '+v.engineCode:null].filter(Boolean).join(' · ')));if(v.firstRegistered)card.facts.append(make('p','Førstegongsregistrert '+v.firstRegistered+'.','help'));if(card.lookup.simulated)card.facts.append(make('p','TESTDATA – attgitt teknisk tilfelle, ikkje eit nytt registeroppslag.','notice'));}
  const base=confirmedBaseVehicle(card.lookup?.vehicle);if(base)card.facts.append(make('p','Grunnbil: '+base.label+(base.status==='customer-confirmed'?' · stadfesta av deg.':'.'),'help'),button('Endre grunnbil',()=>chooseBaseVehicle('unconfirmed'),true));
  if(card.manualCategories)searchable(card.fields,{id:'chat-manual-category',label:labels.types,rows:(card.manualTypes??[]).map(row=>({...row,name:vehicleCategoryLabel(row.name)})),value:card.manualType??'',onSelect:chooseManualCategory});
  const pending=dvxLevels.find(l=>!s[l]);
  for(const level of dvxLevels.filter(l=>card.lookup&&!card.editingAll?l===pending:s[l]||l===pending)){
    let rows=dvxOptions(dvxGroups,s,level);
    if(card.lookup&&card.proposal&&!card.showAll&&['generation','variant'].includes(level)){
      const paths=card.proposal.paths.filter(p=>level==='generation'||p.generation.name===s.generation);
      rows=level==='generation'?[...new Map(paths.map(p=>[p.generation.name,{id:p.generation.name,name:displayDvxGeneration(p.generation.name)}])).values()]:paths.map(p=>({id:p.id,name:dvxCandidateLabel(p)}));
    }
    searchable(card.fields,{id:'chat-dvx-'+level,label:dvxLabels[level],rows,value:s[level]||'',onSelect:value=>changeDvx(level,value)});
  }
  if(card.lookup&&!card.showAll&&pending)card.fields.append(button(pending==='variant'?'Vis alle motorar':'Vis alle alternativ',()=>{card.showAll=true;renderDvx();},true));
  const group=dvxGroups.find(g=>g.id===s.variant),r=group?.stages[0];
  const label=r?[r.brand,r.model,displayDvxGeneration(r.generation),r.engineDesignation,fmt(r.original.powerHk,'HK')].filter(Boolean).join(' · '):null;
  session.patch({source:'dvx',selection:{namespace:'dvx',...s},label});syncContext();
  const confirm=button(card.confirmed?'Vis resultat':'Sjå tuningalternativ',()=>{if(!group)return;card.editing=false;if(card.confirmed){renderDvx();if(effectCard)focusCard(effectCard.node);return;}confirmDvx();});confirm.disabled=!group;confirm.hidden=!group;card.fields.append(confirm);
  card.fields.hidden=card.confirmed&&!card.editing;
  nodes.get(card.message.id).li.hidden=card.confirmed&&!card.editing;
  card.status.textContent=card.confirmed?'Valet er stadfesta.':group?'Stemmer opplysningane?':card.lookup&&pending==='generation'?'Kva utgåve har du? Årsperiodane hjelper deg å skilje alternativa.':card.lookup&&pending==='variant'?'Kva alternativ stemmer? Spør Bjørn om du er usikker.':pending&&dvxOptions(dvxGroups,s,pending).length?'Vel '+dvxLabels[pending].toLocaleLowerCase('nn-NO')+' for å gå vidare.':'Vi fann ikkje eit treff i utvalet. Prøv eit anna modellval eller kontakt Bjørn.';
  if(card.lookup&&pending==='variant'&&card.proposal?.paths.some(p=>p.unknownFeatures.some(f=>/partikkelfilter/.test(f))))card.status.textContent='Er partikkelfilter (DPF) montert? Vel alternativet som stemmer, eller spør Bjørn.';
  if(card.lookup&&!card.confirmed&&card.proposal?.resolution?.reserveError){
    card.note.hidden=false;card.note.textContent='Det automatiske valet kunne ikkje fullførast no. Opplysningane er bevarte; du kan prøve igjen eller avklare valet med Bjørn.';
    card.fields.append(button('Prøv automatisk modellval igjen',()=>{if(carCard!==card)return;invalidateEffect({preserveServices:true});card.source='vdb';card.confirmed=false;card.proposal=null;card.dvxSelection={};session.patch({source:'vdb'});controller.chooseLookup(card.lookup);},true));
  }
  renderPendingServices(card);
  if(!card.lookup&&!card.confirmed)card.fields.append(button('Fann du ikkje rett modell? Sjå fleire alternativ',expandedManual,true));
}
async function changeDvx(level,value){
  if(!carCard||carCard.dvxSelection[level]===value)return;
  invalidateEffect({preserveServices:!!carCard.lookup});carCard.confirmed=false;carCard.editing=true;
  if(['brand','model'].includes(level)&&carCard.lookup){carCard.proposal=null;carCard.showAll=true;carCard.editingAll=true;}
  carCard.dvxSelection=changeDvxSelection(carCard.dvxSelection,level,value);
  if(level==='brand'&&value){serverSync.event('selection',{source:'dvx',selection:{brand:value},...(carCard.lookup?{lookupToken:session.snapshot().active.chatLookupToken}:{})});const card=carCard,version=card.catalogueRevision=(card.catalogueRevision??0)+1;card.status.textContent='Hentar modellar …';try{const groups=await catalogueLoader.ensureBrand(value);if(carCard!==card||card.catalogueRevision!==version||card.dvxSelection.brand!==value)return;dvxGroups=groups;}catch{if(carCard===card){card.dvxSelection={};renderDvx();card.status.textContent='Kunne ikkje hente modellar. Vel merket på nytt for å prøve igjen.';}return;}}
  if(level==='generation'&&carCard.lookup&&carCard.proposal){const paths=carCard.proposal.paths.filter(p=>p.generation.name===value);if(paths.length===1&&paths[0].evidence.strong)carCard.dvxSelection.variant=paths[0].id;}
  if(level!=='brand')serverSync.event('selection',{source:'dvx',selection:carCard.dvxSelection,...(carCard.lookup?{lookupToken:session.snapshot().active.chatLookupToken}:{})});contactFlow.dirty();say('user',`${dvxLabels[level]} er valt.`,'vehicle-choice',{source:'dvx',level,value});renderDvx();
  if(carCard.lookup&&carCard.dvxSelection.variant){confirmDvx();return;}
  const pending=dvxLevels.find(l=>!carCard.dvxSelection[l]);document.getElementById('chat-dvx-'+pending+'-search')?.focus({preventScroll:true});
}
async function expandedManual(){
  const known={manufacturer:carCard?.dvxSelection.brand,model:carCard?.dvxSelection.model};
  await beginManual('vdb');
  const cars=controller.snapshot().rows.types.filter(row=>/^Cars\s*&\s*LCV$/i.test(row.name));if(cars.length===1)await chooseManualCategory(cars[0].id);
  for(const level of ['manufacturers','models']){
    const state=controller.snapshot(),ids=suggestCandidates(level,state.rows[level],known).ids;
    if(ids.length!==1)break;await changeVdb(level,ids[0]);
  }
}
function confirmOwnVehicle(id,lookup=carCard?.lookup){
  const card=carCard;if(!card)return;
  const result=ownVehicleResult(id,{registered:lookup?.vehicle??null});
  card.source='tsv';controller.cancel();session.patch({source:'tsv',selection:{vehicleId:id}});
  card.fields.hidden=true;card.note.hidden=true;nodes.get(card.message.id).li.hidden=true;
  result.lookupSimulated=!!lookup?.simulated;showResult(result);
}
function showResult(result){
  effectCard?.dispose?.();const message=session.setResult(result);serverSync.event('result',{vehicle:vehicleReference(result,session.snapshot().active.stageKey)});contactFlow.dirty();retire();const node=messageNode(message);node.replaceChildren();const heading=make('div',null,'result-heading');heading.append(createBrandBadge(result.brand),make('h2',result.label));const plate=createRegistrationPlate(session.snapshot().active.registration);if(plate)heading.append(plate);if(confirmedBaseVehicle(carCard?.lookup?.vehicle)){heading.classList.add('has-base-vehicle');heading.append(button('Endre grunnbil',()=>chooseBaseVehicle('unconfirmed'),true));}node.append(heading);
  if(result.simulated||result.lookupSimulated)node.append(make('p',result.simulated?'Testdata · simulert effekt':'Testdata · ikkje eit nytt regnr-oppslag','notice'));
  const tabs=make('div',null,'chat-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Tuningsteg for '+result.label);
  const panel=make('div');panel.id='effect-'+message.id;panel.setAttribute('role','tabpanel');panel.tabIndex=0;
  let graph=null;
  function choose(key,{recordChoice=false,focus=false}={}){
    if(recordChoice)cancelAi();
    const stage=recordChoice?session.chooseStage(key):result.stages.find(s=>s.key===key);if(!stage)return;if(recordChoice){serverSync.event('stage',{vehicle:vehicleReference(result,key)});contactFlow.dirty();}
    [...tabs.children].forEach(tab=>{const selected=tab.dataset.stage===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected){panel.setAttribute('aria-labelledby',tab.id);if(focus)tab.focus();}});
    graph?.dispose();panel.replaceChildren();
    graph=createEffectGraph(result,stage,{customerSummary:true});panel.append(graph.element);
    const requirements=visibleRequirements(stage),sections=[];for(const [title,items]of requirements){const texts=items.map(text=>customerHardwareText(customerEngineName(text).replace(/(\d+(?:[.,]\d+)?)\s*PK\b/gi,'$1 HK'))).filter(text=>text&&!/^(?:ikkje (?:uttrykkeleg )?oppgitt|drivstoffkrav og andre føresetnader er ikkje oppgitt|individuelt tilpassa motorprogramvare)/i.test(text));if(texts.length)sections.push({title,texts});}
    if(sections.length){const hardware=make('section',null,'setup-summary');hardware.append(make('h3','Dette inngår'),make('p','Oppsettet som steget føreset. Arbeidsomfanget blir stadfesta i tilbodet.','help'));const lines=sections.flatMap(s=>s.texts.map(text=>s.title+': '+text));for(const text of lines.slice(0,3))hardware.append(make('p',text));if(lines.length>3){const details=make('details'),summary=make('summary','Sjå heile oppsettet');details.append(summary);for(const s of sections){details.append(make('h4',s.title));const list=make('ul');list.append(...s.texts.map(text=>make('li',text)));details.append(list);}hardware.append(details);}const review=hardwareReviewNote(requirements);if(review)hardware.append(make('p',review,'help'));panel.append(hardware);}
    syncContext();
  }
  result.stages.forEach((stage,index)=>{const tab=button(stage.label,()=>choose(stage.key,{recordChoice:true}));tab.id='tab-'+message.id+'-'+index;tab.dataset.stage=stage.key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);tab.addEventListener('keydown',event=>{const i=event.key==='ArrowRight'?(index+1)%result.stages.length:event.key==='ArrowLeft'?(index+result.stages.length-1)%result.stages.length:event.key==='Home'?0:event.key==='End'?result.stages.length-1:null;if(i!==null){event.preventDefault();choose(result.stages[i].key,{recordChoice:true,focus:true});}});tabs.append(tab);});
  const followUp=make('div',null,'result-next-step');followUp.append(button('Få tilbod',()=>openContact()));
  const serviceOptions=createServiceOptions(result.serviceFacts,(option,ids)=>selectServices(ids,result.serviceFacts),session.snapshot().active.selectedServices?.map(o=>o.id)??[],(options,change)=>askQuestion(serviceFollowUp(options,change)));
  node.append(tabs,panel,serviceOptions);$('vehicle-actions').replaceChildren(followUp);effectCard={message,node,dispose:()=>graph?.dispose()};
  if(result.stages.length)choose(session.snapshot().active.stageKey);else panel.append(make('p','Ingen tuningsteg er oppgitte. Kontakt Bjørn for avklaring.'),serviceOptions);
  syncContext();announce('Tuningalternativa er klare.');updateChatLookupNotice('Tuningalternativa er klare. Sjå resultatet i resultatpanelet.');focusCard(node);
}
function openContact(anchor=null,initialMessage=''){showPanel('vehicle');return contactFlow.open(Number.isSafeInteger(anchor)?anchor:null,{initialMessage});}
$('chat-launch').addEventListener('click',()=>{showPanel('chat');$('chat-question').focus();});$('close-chat').addEventListener('click',()=>{showPanel('vehicle');$('chat-launch').focus();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('journey-layout').dataset.chatOpen==='true'){showPanel('vehicle');$('chat-launch').focus();}});for(const b of document.querySelectorAll('[data-chat-question]'))b.addEventListener('click',()=>askQuestion(b.dataset.chatQuestion));
$('contact-top')?.addEventListener('click',()=>openContact());$('new-vehicle').addEventListener('click',newEntry);$('home-open-chat')?.addEventListener('click',()=>{showPanel('chat');$('chat-question').focus();});
const turns=createChatTurns({send:(q,onSuccess,options)=>serverSync.chat(q,onSuccess,options),
 onUser:t=>{$('chat-end-status').textContent='';say('user',t.question);contactFlow.dirty();},
 onWaiting:t=>{const near=nearChatBottom($('chat-messages'));if(!t.answer)t.answer=say('assistant','','ai');const n=t.answer.node;n.classList.add('waiting');n.dataset.turnPending='true';const dots=make('div',null,'typing-dots');dots.setAttribute('aria-hidden','true');dots.append(make('span'),make('span'),make('span'));n.replaceChildren(dots,make('span','Assistenten skriv …','sr-only'));announce('Assistenten skriv.');followChat(near);},
 onSlow:t=>{const n=t.answer.node;if(!n.querySelector('.waiting-label'))n.append(make('p','Det tek litt lenger tid …','waiting-label'));announce('Det tek litt lenger tid.');},
 onAnswer:(t,data)=>{const near=nearChatBottom($('chat-messages')),n=t.answer.node;n.classList.remove('waiting');delete n.dataset.turnPending;session.updateMessage(t.answer.message.id,{text:data.answer,data:{actions:data.actions,replyEventId:data.replyEventId}});n.replaceChildren(make('p',data.answer));n.dataset.replyEvent=String(data.replyEventId);unread.receive(t.answer.message.id+':'+(data.replyEventId??'answer'));addContactActions(n,data.actions);announce('Nytt svar frå assistenten.');followChat(near);},
 onFailure:(t,e)=>{const near=nearChatBottom($('chat-messages')),n=t.answer.node,text=e.data?.answer??(e.code==='conversation-too-large'?'Samtalen er for lang for lokaltesten. Ingenting er kutta.':'Eg fekk ikkje henta svaret. Meldinga di er bevart.'),retry=button('Prøv igjen',()=>turns.retry(t.id),true);retry.dataset.turnRetry='true';n.classList.remove('waiting');delete n.dataset.turnPending;n.replaceChildren(make('p',text),retry);session.updateMessage(t.answer.message.id,{text});addContactActions(n,e.data?.actions??[{type:'contact_bjorn'}]);announce(text);followChat(near);},
 onChange:busy=>{aiRequest=busy?true:null;$('chat-composer').querySelector('button').disabled=turns.pending()>=5;}
});
function askQuestion(q){
 if(!q?.trim())return;const text=q.trim(),intent=registrationMessageIntent(text);showPanel('chat');
 if(intent.kind!=='none'){
   $('chat-question').value='';
   if(intent.kind==='lookup'){beginLookup({registration:intent.registration},{chatMessage:text});}
   else{
     say('user',text);const {node}=say('assistant',intent.answer,'registration-choice');serverSync.event('registration-message',{message:text});
     if(intent.registrations.length<=5){const choices=make('div',null,'actions');for(const registration of intent.registrations){const b=button('Finn '+registration,()=>{for(const option of choices.querySelectorAll('button'))option.disabled=true;beginLookup({registration},{chatMessage:'Slå opp '+registration+'.'});});choices.append(b);}node.append(choices);}
     else node.append(make('p','Skriv eitt registreringsnummer om gongen.'));
   }
   contactFlow.dirty();if(intent.kind==='clarify')$('chat-question').focus({preventScroll:true});return;
 }
 if(turns.pending()>=5){announce('Vent på eit av svara før du sender fleire meldingar.');return;}$('chat-question').value='';turns.ask(text);$('chat-question').focus({preventScroll:true});
}
$('chat-composer').addEventListener('submit',event=>{event.preventDefault();const q=$('chat-question').value.trim();if(!q)return;askQuestion(q);});
$('chat-question').placeholder='Skriv eit spørsmål eller regnr …';
$('chat-question').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('chat-composer').requestSubmit();}});
$('show-contact-draft').addEventListener('click',()=>openContact());
$('simulate-chat-mail-error').addEventListener('click',async()=>{await api('/api/chat-contact-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'fail-next'})});$('chat-mail-test-status').textContent='Neste lokale testlevering vil feile. Ingen ekte e-post er aktiv.';});
let endRequestId=null;
$('end-chat').addEventListener('click',async()=>{
  const b=$('end-chat');b.disabled=true;endRequestId??=crypto.randomUUID();
  try{const s=await serverSync.flush();const result=await api('/api/chat-end',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:s.conversationId,requestId:endRequestId})});$('chat-end-status').textContent=result.message;endRequestId=null;}
  catch{$('chat-end-status').textContent='Avsluttinga kunne ikkje stadfestast. Samtalen er bevart. Prøv igjen.';}
  finally{b.disabled=false;b.focus({preventScroll:true});}
});
async function showNotifications(before=null){
  const root=$('chat-notifications-list');if(before===null)root.textContent='Hentar lokal varslingskø …';
  try{const s=await serverSync.flush(),result=await api('/api/chat-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:s.conversationId,...(before===null?{}:{before})})});
    if(before===null)root.replaceChildren(make('p',result.healthy?(result.simulated?'Simulert levering · ingen ekte e-post er send.':'Ekte testlevering til vest@tuningservice.no. Sjå status per varsel nedanfor.'):'Varslingsjobben har ein feil. Kontroller køen før du prøver igjen.'));
    if(!result.items.length&&before===null)root.append(make('p','Ingen varsel enno. Regnr-forsøk blir kølagde straks. Samtaleloggen blir kølagd ved avslutting eller etter fem minutt utan aktivitet.'));
    for(const item of result.items){const details=make('details');details.append(make('summary',(item.kind==='lookup'?'Regnr-oppslag':'Samtalelogg')+' · '+item.status+((item.simulated??result.simulated)?' · simulert':' · e-post')+' · '+new Date(item.createdAt).toLocaleTimeString('nn-NO')));let loaded=false;details.addEventListener('toggle',async()=>{if(!details.open||loaded)return;loaded=true;const pre=make('pre','Hentar førehandsvisning …');details.append(pre);try{const mail=await api('/api/chat-notification-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:s.conversationId,id:item.id})});pre.textContent=mail.previewText;}catch{loaded=false;pre.textContent='Kunne ikkje hente førehandsvisninga.';}});root.append(details);}
    if(result.nextCursor!==null){const more=button('Sjå eldre varsel',()=>{more.remove();showNotifications(result.nextCursor);},true);root.append(more);}
  }catch{root.textContent='Varslingskøen kunne ikkje hentast. Prøv igjen.';}
}
$('show-chat-notifications').addEventListener('click',()=>showNotifications());
$('fail-chat-notification').addEventListener('click',async()=>{try{await api('/api/chat-notification-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'fail-next'})});$('chat-notifications-list').textContent='Neste simulerte varsel vil feile og bli prøvd igjen automatisk.';}catch{$('chat-notifications-list').textContent='Testfeilen kunne ikkje setjast.';}});
$('run-chat-demo').addEventListener('click',()=>beginLookup({scenario:$('chat-demo').value},{demo:true}));
$('chat-dev-source').addEventListener('change',()=>beginManual($('chat-dev-source').value));
try{
  await ensurePublicAssistantSession();
  const [status,data]=await Promise.all([api('/api/chat-status'),api('/data/chat/dvx-snapshot.json')]);config=status;snapshot=status.snapshot;catalogueLoader=createChatCatalogueLoader(data);dvxGroups=catalogueLoader.groups();
  $('chat-config').textContent=`Regnr: ${status.lookupMode} · Reservekatalog: ${status.vdbMode} · AI: ${status.aiMode}${status.missing?.length?" · Manglar: "+status.missing.join(", "):""} · E-post: ${status.mail?.mode??'simulated'}${status.mail?.missing?.length?' · Manglar: '+status.mail.missing.join(', '):''}`;
  if(status.mail?.mode==='live-test'){
    $('simulate-chat-mail-error').hidden=true;$('fail-chat-notification').hidden=true;
    for(const n of document.querySelectorAll('.local-note'))n.textContent=status.mail.configured?'Lokal test · ekte e-post til Bjørn er aktivert':'Lokal test · e-post manglar konfigurasjon';
    if($('notification-mode-heading'))$('notification-mode-heading').textContent='Bruksvarsel og samtaleloggar · ekte testlevering';
    if($('notification-mode-explanation'))$('notification-mode-explanation').textContent='Regnr-forsøk blir sende til Bjørn. Samtalar blir sende ved avslutting eller fem minutt utan aktivitet, også om fana er lukka. Lokalserveren og PC-en må stå på. Sjå status per oppføring nedanfor.';
    if($('mail-storage-notice'))$('mail-storage-notice').textContent='Lokal test med e-post til vest@tuningservice.no. Samtalar og testførespurnader blir lagra lokalt. Automatisk sletting er ikkje aktivert.';
    if($('chat-privacy-copy'))$('chat-privacy-copy').textContent='AI-en kan ta feil og gir ikkje bindande prisar eller garantiar. Denne lokale testen sender regnr-forsøk og samtaleloggar til Bjørn for oppfølging og kontroll, også utan tilbodsførespurnad. Loggen blir send ved avslutting eller fem minutt utan aktivitet. Opplysningane blir lagra lokalt og i e-post. Planlagt lagring ved lansering er normalt 30 dagar, eller inntil seks månader etter avslutta kontaktoppfølging. Automatisk sletting er ikkje aktivert enno.';
    $('chat-mail-test-status').textContent='Ekte testlevering · maks '+status.mail.dailyLimit+' forsøk per døgn. Eldre simulerte køoppføringar blir ikkje sende.';
  }
  if(status.production){$('chat-privacy-copy').textContent='AI-en kan ta feil. Oppslag og chat blir lagra og sende til Bjørn ved avslutting eller etter fem minutt utan aktivitet. App-loggen blir sletta etter 30 dagar; e-postkopiar blir handterte separat. Sjå personvern.';}
  $('ai-notice').textContent=status.aiMode==='live'?'Spørsmål og rettleiing – ikkje bindande tilbod':status.aiMode==='simulated'?'Simulerte testsvar · ingen ekte AI':'AI utilgjengeleg · kontakt Bjørn';
  $('snapshot-info').textContent=`Kontrollert datagrunnlag: ${snapshot.recordCount} stegoppføringar, ${snapshot.variantCount} variantar. SHA-256 ${snapshot.sha256}. Inn­samlingsdekning: ${snapshot.upstreamComplete?'ferdig innanfor oppgitt omfang':'ufullstendig'}.`;
  for(const scenario of status.scenarios||[])$('chat-demo').add(new Option(scenario.name,scenario.id));$('run-chat-demo').disabled=!status.scenarios?.length;
}catch{config={lookupMode:'unavailable',vdbMode:'unavailable',aiMode:'unavailable'};$('ai-notice').textContent='Oppslag og AI er mellombels utilgjengelege. Ring eller send e-post til Bjørn.';$('chat-config').textContent='Samtaletenesta kunne ikkje lastast. Prøv igjen, ring eller send e-post til Bjørn.';}
createEntry();syncContext();say('assistant',CHAT_WELCOME);
mountContactEntries({open:message=>openContact(null,message)});
// Existing production contact form owns its separate submission.
