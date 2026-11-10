// Presentation only. Raw supplier evidence/requirements remain in server data.
import {establishVehicleIdentity} from './vehicle-identity-registry.mjs';
import {registeredVehicleLabel} from './vehicle-identity.mjs';
export function identifiedResultLabel(registered,engineLabel,fallback,canonical=null){
 if(!registered?.manufacturer||!registered?.model)return fallback;
 const identity=establishVehicleIdentity(registered),g=identity.issues.length?null:identity.generation;
 if(identity.baseVehicle)return [registeredVehicleLabel(registered),identity.baseVehicle.label,customerText(engineLabel)].filter(Boolean).join(' · ');
 const suffix=g?.label.toLowerCase().startsWith(identity.model.toLowerCase())?g.label.slice(identity.model.length).replace(/[()]/g,'').trim():g?.platform;
 // Use the verified catalogue family/generation after matching, while retaining
 // converted/rebadged vehicles and documented physical identities as before.
 if(!g&&canonical?.manufacturer&&canonical.model&&canonical.generation&&!canonical.model.includes('/')&&canonical.manufacturer.toLowerCase()===registered.manufacturer.toLowerCase())return [canonical.manufacturer+' '+canonical.model,canonical.generation,customerText(engineLabel)].join(' · ');
 return [registeredVehicleLabel(registered),suffix,customerText(engineLabel)].filter(Boolean).join(' · ');
}
export function customerText(value){
 let text=String(value??'');const component=/DVX(?:\d|\s*(?:Outlet|cosworth))|Turbo\s+dvx/i.test(text);
 text=text.replace(/[^.!?\n]*(?:\b(?:kun|berre|bare|only)\b[^.!?\n]{0,70}\b(?:bane|circuit|track)\b|enkel\s+op\s+circuit)[^.!?\n]*[.!?]?/gi,'');
 text=text.replace(/DVX oppgir ikkje detaljane her\./gi,'Detaljane er ikkje oppgitte.').replace(/DVX(?:\s+Performance)?\s+nemner/gi,'Det er nemnt').replace(/DVX(?:\s+Performance)?\s*(?:oppgir|seier|says|states)(?:\s+at)?/gi,'Det er oppgitt at')
  .replace(/DVX(?:\s+Performance)?/gi,'').replace(/Tuningfiles(?:erver)?(?:\.com)?/gi,'leverandøren').replace(/[ \t]{2,}/g,' ').trim();
 if(component)text+=' (Nøyaktig komponentspesifikasjon må avklarast med Bjørn.)';
 return text;
}
export function customerAiContext(technical){
 if(!technical)return technical;const copy=structuredClone(technical);
 // Source IDs and legal/source notices are retained by the journal, not used as
 // unsolicited customer copy. The model still cannot promise approval/legality.
 delete copy.source;delete copy.ids;delete copy.proposal;
 if(copy.stages)copy.stages=copy.stages.map(s=>({...s,road:[],requirements:s.requirements.map(r=>({...r,items:r.items.map(customerText)}))}));
 return copy;
}
export function customerHardwareText(value){
 return customerText(value).replace(/Optie:\s*Luchtfilter/gi,'Valfritt luftfilter:').replace(/\s*\(norsk attgiving ikkje kontrollert\)/gi,'').replace(/\s*(?:Må kontrollerast mot kjelda|Avklar oppsett med Bjørn)\./g,'').trim();
}
// Preserve the review qualification once for the list, not after every part.
// Supplier evidence and per-item classification remain unchanged internally.
export function hardwareReviewNote(requirements){
 return requirements.some(([,items])=>items?.some(text=>/(?:Må kontrollerast mot kjelda|Avklar oppsett med Bjørn)\./.test(text)))?'Avklar samla oppsett og krav med Bjørn.':null;
}
