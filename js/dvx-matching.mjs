import {suggestCandidates,engineEvidence,exactVariantProfile} from './vehicle-matching.mjs';
import {generationChronology} from './vehicle-dates.mjs';
import {generationIdentity,generationCompatibility} from './vehicle-generation-identity.mjs';
import {gearboxKind} from './vehicle-service-options.mjs';
import {dvxVariantFacts} from './dvx-model.mjs';
import {establishVehicleIdentity,documentedGenerationCompatibility} from './vehicle-identity-registry.mjs';
export function dvxGeneration(record){
 // Some imported periods with an explicitly unknown start were parsed as if
 // their sole (end) year was the start. Preserve the source; correct the view.
 const endOnly=String(record.generation??'').match(/(?:\.{2,}|…)\s*(?:->|→|[–—-])\s*(?:(?:0?[1-9]|1[0-2])\s*\/\s*)?((?:19|20)\d{2})\s*$/);
 return {id:record.sourceIds.generationLinkId,name:record.generation,year:endOnly?null:record.period.startYear,yearend:endOnly?Number(endOnly[1]):record.period.endYear};
}
export function dvxEngine(record){
  const name=record.engineDesignation;
  return {id:record.vehicleId,name,fuel:record.fuel,power:record.original.powerHk,torque:record.original.torqueNm,
    generation:dvxGeneration(record),capacity:null,engineCode:record.engineCode,gearbox:dvxVariantFacts(record).gearbox,detailChecked:true};
}
// Supplier chassis-family notation, e.g. F3x, denotes that family only. It does
// not identify the body/engine on its own or cross-map any supplier IDs.
function generationStatus(g,vehicle){
  const documented=documentedGenerationCompatibility(g,vehicle,'dvx');if(documented.status!=='unknown')return documented.status;
  const exact=generationCompatibility(g,vehicle);if(exact.status!=='unknown')return exact.status;
  const identity=generationIdentity(vehicle),families=[...g.name.matchAll(/\b([EFG]\d)[xX]\b/g)].map(m=>m[1].toUpperCase());
  return identity.codes.length&&families.length?families.includes(identity.codes[0].slice(0,2))?'match':'conflict':'unknown';
}
function unconfirmedFeatures(record,vehicle){
  const name=record.engineDesignation,unknown=[];
  if(/\bNO\s*DPF\b/i.test(name)){if(vehicle.systems?.dpf===true)return {conflict:true,unknown};if(vehicle.systems?.dpf!==false)unknown.push('utan partikkelfilter');}
  else if(/\bDPF\b/i.test(name)){if(vehicle.systems?.dpf===false)return {conflict:true,unknown};if(vehicle.systems?.dpf!==true)unknown.push('med partikkelfilter');}
  const gear=gearboxKind(dvxEngine(record).gearbox);if(gear&&!gearboxKind(vehicle.gearbox))unknown.push(gear==='automatic'?'automatgirkasse':'manuell girkasse');
  if(/\b(?:4x4|xdrive|quattro|4motion|4matic|awd)\b/i.test(name)){
    if(/\b(?:fwd|rwd|forhjulsdrift|bakhjulsdrift|2wd)\b/i.test(vehicle.drivetrain??''))return {conflict:true,unknown};
    if(!/\b(?:4x4|xdrive|quattro|4motion|4matic|awd|firehjulsdrift)\b/i.test(vehicle.drivetrain??''))unknown.push('firehjulsdrift');
  }
  return {conflict:false,unknown};
}
export function resolveDvxProposal(groups,vehicle,{generationId=null}={}){
  if(!vehicle||vehicle.requiresManual)return {kind:'manual',paths:[],selections:{}};
  const identity=establishVehicleIdentity(vehicle);if(identity.issues.length)return {kind:'identity-conflict',paths:[],selections:{},identity};
  vehicle=identity.matchingVehicle;
  const brands=[...new Set(groups.map(g=>g.stages[0].brand))].map(name=>({id:name,name}));
  const brand=suggestCandidates('manufacturers',brands,vehicle).ids;
  if(brand.length!==1)return {kind:'no-match',paths:[],selections:{}};
  const branded=groups.filter(g=>g.stages[0].brand===brand[0]);
  const models=[...new Set(branded.map(g=>g.stages[0].model))].map(name=>({id:name,name}));
  const model=suggestCandidates('models',models,vehicle).ids;
  if(model.length!==1)return {kind:'no-match',paths:[],selections:{brand:brand[0]}};
  const selections={brand:brand[0],model:model[0]},excluded=[],incompleteAlternatives=[];
  const modeled=branded.filter(g=>g.stages[0].model===model[0]);
  // A literal type/platform token is useful only when this model's catalogue
  // actually names it. Unknown type/variant strings are never decoded or guessed.
  const type=String(vehicle.typeCode??'').trim().toUpperCase();
  const literalTypes=/^[A-Z0-9]{2,12}$/.test(type)&&/[A-Z]/.test(type)&&/\d/.test(type)
    ?new Set(modeled.filter(g=>g.stages[0].generation.toUpperCase().split(/[^A-Z0-9]+/).includes(type)).map(g=>g.stages[0].sourceIds.generationLinkId)):new Set();
  const paths=modeled.flatMap(group=>{
    const record=group.stages[0],generation=dvxGeneration(record),engine=dvxEngine(record),chronology=generationChronology(generation,vehicle),documented=generationStatus(generation,vehicle),literal=literalTypes.size?literalTypes.has(generation.id)?'match':'conflict':'unknown',identity=documented==='conflict'||literal==='conflict'?'conflict':documented==='match'||literal==='match'?'match':'unknown',evidence=engineEvidence(engine,vehicle),features=unconfirmedFeatures(record,vehicle);
    const reasons=[...(evidence.conflict?['technical-conflict']:[]),...(identity==='conflict'?['generation-identity-conflict']:[]),...(['excluded','conflict'].includes(chronology.status)?[chronology.reason]:[]),...(features.conflict?['system-conflict']:[])];
    if(!reasons.length&&!evidence.plausible&&evidence.variantMatch&&(generationId===null||generation.id===generationId))incompleteAlternatives.push(group.id);
    if(reasons.length||!evidence.plausible||generationId!==null&&generation.id!==generationId){excluded.push({id:group.id,generation:generation.name,engine:engine.name,reasons:reasons.length?reasons:['insufficient-evidence-or-other-generation']});return [];}
    const strong=(evidence.strong||identity==='match'&&evidence.variantMatch&&evidence.fuelMatch&&evidence.powerMatch)&&!features.unknown.length;
    return [{id:group.id,generation,engine,evidence:{...evidence,strong,exactVariantProfile:exactVariantProfile(engine,vehicle,evidence)},unknownFeatures:features.unknown,chronology,identity,original:record.original}];
  });
  const generations=[...new Set(paths.map(p=>p.generation.id))];
  if(generations.length===1)selections.generation=paths[0].generation.name;
  const soleProfile=paths.length===1&&paths[0].evidence.exactVariantProfile&&!paths[0].unknownFeatures.length
    &&(paths[0].chronology.status==='possible'||paths[0].identity==='match')
    &&!incompleteAlternatives.length;
  const kind=!paths.length?'no-engine-match':generations.length>1?'choose-generation':paths.length===1&&(paths[0].evidence.strong||soleProfile)?'complete':'choose-engine';
  if(kind==='complete')selections.variant=paths[0].id;
  return {kind,paths,selections,excluded,identity,...(soleProfile?{selectionBasis:'unique-exact-variant-fuel-power'}:{})};
}
export function dvxCandidateLabel(path){
  const e=path.engine;return [e.name,e.power!=null?e.power+' HK':null,e.torque!=null?e.torque+' Nm':null,e.fuel,e.engineCode?'Motorkode '+e.engineCode:null,e.gearbox,...path.unknownFeatures.map(f=>'Avklar '+f)].filter(Boolean).join(' · ');
}
