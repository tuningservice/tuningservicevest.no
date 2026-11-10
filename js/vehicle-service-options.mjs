import {businessServices} from './business-services.mjs';
import {isLightVehicleCategory,vehicleCategoryGroup} from './vehicle-category.mjs';
const key=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const OPTIONS_NOTE='Tilgjengelege tilval blir avklarte for ditt oppsett.';
export function fuelKind(value){
  const s=String(value??'').toLowerCase();
  if(/hybrid|electric|elektrisk/.test(s))return null;
  const diesel=/diesel/.test(s),petrol=/petrol|bensin|gasoline/.test(s);
  return diesel!==petrol?diesel?'diesel':'petrol':null;
}
export function gearboxKind(value){
  const s=String(value??'').toLowerCase();
  const manual=/\b(manual|manuell|manuellgir)\b/.test(s),automatic=/\b(automatic|automatik|automat(?:isk|gir(?:kasse)?)?|automaat|dsg|s[ -]?tronic|tiptronic)\b/.test(s);
  return manual!==automatic?manual?'manual':'automatic':null;
}
function typeKind(value){
  const s=String(value??'').trim().toLowerCase();
  if(isLightVehicleCategory(value)||/^(cars\s*&\s*lcv|passenger car|personbil)$/.test(s))return 'light';
  if(vehicleCategoryGroup(value)==='agriculture'||/^agriculture$/i.test(s))return 'agriculture';
  if(/^N[23]G?$/i.test(s))return 'truck';
  if(/^M[23]G?$/i.test(s))return 'heavy';
  if(/^trucks\s*&\s*buses$/i.test(s))return 'heavy';
  return s?'other':null;
}
const compatibleTypes=(a,b)=>a===b||a==='heavy'&&b==='truck'||b==='heavy'&&a==='truck';
const label=value=>typeof value==='string'&&value.trim()&&!/^(?:n\/a|none|null|unknown|false|not specified|-|ukjend)$/i.test(value.trim())?value.trim():null;
const systemKeys=['egr','dpf','adblue','gpf','catalyst','sai','swirlFlaps','startStop','launchControl','drivingModesDSM','cylinderOnDemand'];
// All sources must be normalised, technical facts. Never infer equipment from
// a model name, registration year, ECU family or an informational option label.
export function serviceFacts({catalog={},registered=null}={}){
  const cFuel=fuelKind(catalog.fuel),rFuel=fuelKind(registered?.fuel),fuelConflict=!!(cFuel&&rFuel&&cFuel!==rFuel);
  const cType=typeKind(catalog.vehicleType),rType=typeKind(registered?.vehicleCategory);
  // Cars & LCV is a supplier bucket, not the legal <=3.5t category. A van
  // registered N2/N2G may legitimately be listed there. Keep the registered
  // truck service list; this supplies enquiries, never compatibility evidence.
  const catalogueBucketOverlap=cType==='light'&&rType==='truck'&&/^N2G?$/i.test(String(registered?.vehicleCategory??'').trim());
  const cGear=gearboxKind(catalog.gearbox),rGear=gearboxKind(registered?.gearbox);
  const systems={};let systemConflict=false;
  for(const k of systemKeys){const a=catalog.systems?.[k],b=registered?.systems?.[k];if(typeof a==='boolean'&&typeof b==='boolean'&&a!==b)systemConflict=true;systems[k]=typeof a==='boolean'&&typeof b==='boolean'&&a!==b?null:typeof b==='boolean'?b:typeof a==='boolean'?a:null;}
  return {vehicleType:rType??cType,fuel:fuelConflict?null:rFuel??cFuel,gearbox:rGear??cGear,
    engineCc:registered?.engineCc??catalog.engineCc??null,
    emissionClass:label(registered?.emissionClass)??label(catalog.emissionClass),modelYear:Number.isInteger(registered?.modelYear)?registered.modelYear:Number.isInteger(catalog.modelYear)?catalog.modelYear:null,
    manufacturer:label(catalog.manufacturer)??label(registered?.manufacturer),ecu:label(catalog.ecu),tcu:label(catalog.tcu),
    turbo:catalog.turbo===true?true:catalog.turbo===false?false:null,systems,
    conflict:systemConflict||fuelConflict||/hybrid|electric|elektrisk/i.test(String(catalog.fuel??'')+' '+String(registered?.fuel??''))||!!(cType&&rType&&!compatibleTypes(cType,rType)&&!catalogueBucketOverlap)||!!(cGear&&rGear&&cGear!==rGear)||registered?.requiresManual===true,
    catalogOptions:Array.isArray(catalog.options)?catalog.options.map(o=>({name:label(o.name),code:label(o.code)})):null};
}
export function vehicleServiceOptions(facts,{includeGeneral=false}={}){
  if(!facts||!['light','truck','heavy','agriculture'].includes(facts.vehicleType)||facts.vehicleType==='light'&&!['diesel','petrol'].includes(facts.fuel)||facts.conflict)return [];
  const codes=new Set((facts.catalogOptions??[]).flatMap(o=>[key(o.name),key(o.code)]).filter(Boolean));
  return businessServices.flatMap(g=>g.services).flatMap(s=>{const rules=facts.vehicleType==='light'?s.eligibility:s.heavyEligibility;return s.customerOption&&rules?[{...s,rules}]:[];}).filter(s=>{
    const r=s.rules,unknownHeavyFuel=includeGeneral&&facts.vehicleType!=='light'&&facts.fuel===null;
    if(r.fuels&&!r.fuels.includes(facts.fuel)&&!unknownHeavyFuel||r.automatic&&facts.gearbox!=='automatic')return false;
    if(r.ecu&&!facts.ecu||r.tcu&&!facts.tcu)return false;
    if(r.turbo&&(facts.turbo===false||!includeGeneral&&facts.turbo!==true))return false;
    if(r.system&&(facts.systems?.[r.system]===false||!includeGeneral&&facts.systems?.[r.system]!==true)||r.systemUnlessAbsent&&facts.systems?.[r.systemUnlessAbsent]===false)return false;
    if(r.vagThreeLitre&&(!['audi','volkswagen','vw','porsche','skoda','seat','cupra'].includes(key(facts.manufacturer))||!(facts.engineCc>=2900&&facts.engineCc<=3100)||!includeGeneral))return false;
    if(r.vagThreeLitre&&((facts.modelYear!==null&&facts.modelYear<r.yearFrom)||(facts.emissionClass&&!/^euro\s*6(?:\b|[a-z])/i.test(facts.emissionClass))))return false;
    return !r.makes||r.makes.includes(key(facts.manufacturer));
  }).sort((a,b)=>a.rules.priority-b.rules.priority||a.id.localeCompare(b.id)).map(s=>({
    id:s.id,label:s.label,offeredGenerally:true,compatibility:'unconfirmed',
    scope:s.rules.fuels&&facts.fuel===null||s.rules.reviewVariant||s.rules.system&&facts.systems?.[s.rules.system]!==true||s.rules.turbo&&facts.turbo!==true?'general-equipment-unverified':'vehicle-enquiry',
    catalogListed:codes.has(key(s.supplierLabel))||codes.has(key(s.id)),
  }));
}
export const offeredServiceOptions=facts=>vehicleServiceOptions(facts,{includeGeneral:true});
export function serviceFollowUp(option,{selected=true}={}){
  const options=Array.isArray(option)?option:[option],names=options.map(o=>o.label).join(' og ');
  return selected?'Eg er interessert i '+names+'.':'Eg tek bort '+names+' frå vala mine.';
}
