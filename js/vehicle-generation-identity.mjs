// Reviewed exact homologation variants, never registration numbers or VIN prefixes.
// BMW Group July 2012 Touring sheet, pp.3–4:
// https://www.press.bmwgroup.com/austria/article/attachment/T0128210DE/192301
// Additional variants: DEFA manufacturer fitment instructions 414842, p.3:
// https://www.defa.com/content/uploads/Documentation/Enginge-heaters/Find-engine-heater/Manuals-and-pdfs/414842.pdf
import {generationPeriod,generationChronology,registrationDates,catalogYear} from './vehicle-dates.mjs';
import {reviewedBMWVariants as bmwVariants,documentedGenerationCompatibility} from './vehicle-identity-registry.mjs';
import {establishVehicleIdentity} from './vehicle-identity-registry.mjs';
// Vehicle generation can be constrained even while the powertrain needs manual
// review. A calendar-period suggestion is kept separate from a proven identity.
export function registeredGenerationChoices(rows,vehicle){
 const identity=establishVehicleIdentity(vehicle),checks=rows.map(g=>({id:String(g.id),chronology:generationChronology(g,vehicle),compatibility:generationCompatibility(g,vehicle).status}));
 const conflicting=identity.issues.length>0||checks.some(c=>c.chronology.status==='conflict');
 const options=conflicting?[]:rows.filter((g,i)=>checks[i].chronology.status!=='excluded'&&checks[i].compatibility!=='conflict');
 const date=registrationDates(vehicle.firstRegistered,vehicle.firstRegisteredNorway),year=date.firstRegistered?Number(date.firstRegistered.slice(0,4)):null;
 const inPeriod=!conflicting&&vehicle.registrationDateStatus!=='missing'&&year?options.filter(g=>{const start=catalogYear(g.year),end=catalogYear(g.yearend);return start!==null&&start<=year&&(end===null||end>=year);}):[];
 const selected=!conflicting&&options.length===1&&checks.find(c=>c.id===String(options[0].id))?.compatibility==='match'?String(options[0].id):null;
 return {identity,checks,options,selected,suggestion:inPeriod.length===1?{id:String(inPeriod[0].id),basis:'registration-period-hint',requiresConfirmation:true}:null,conflicting};
}
export function generationChoiceLabel(g){return String(g.name??'').replace(/\s+(?:FL|LCI)\b/i,' – oppdatert utgåve')+generationPeriod(g);}
const codes=value=>[...String(value??'').toUpperCase().matchAll(/\b([EFG][0-9]{2})\b/g)].map(m=>m[1]);
// Exact register type text may be repeated verbatim by a model's catalogue
// generations (e.g. B5). No decoding, year inference or prefix matching. The
// caller must first establish the manufacturer/model and compare all its rows.
export function literalGenerationMatches(rows,vehicle){
 const type=String(vehicle?.typeCode??'').trim().toUpperCase();
 if(!/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{2,12}$/.test(type))return [];
 return rows.filter(g=>String(g.name??'').toUpperCase().split(/[^A-Z0-9]+/).includes(type));
}
export function generationIdentity(vehicle){
  if(String(vehicle?.manufacturer).toUpperCase()!=='BMW')return {codes:[],basis:[],conflict:false};
  const variant=String(vehicle.variantCode??'').trim().toUpperCase();
  const explicit=[...new Set([...codes(vehicle.typeCode),...codes(vehicle.model)])];
  const reviewed=bmwVariants[variant];
  const all=[...new Set([...explicit,...(reviewed?[reviewed]:[])])];
  return {codes:all,basis:[...(explicit.length?['explicit-chassis-code']:[]),...(reviewed?['documented-homologation-variant']:[])],conflict:all.length>1};
}
export function generationCompatibility(generation,vehicle){
  const identity=generationIdentity(vehicle),catalog=codes(generation.name);
  const reviewed=documentedGenerationCompatibility(generation,vehicle,'vdb');
  if(reviewed.status!=='unknown')return {status:reviewed.status,identity:{...identity,basis:[...identity.basis,'documented-identity-registry']}};
  if(identity.conflict)return {status:'conflict',identity};
  if(!identity.codes.length||!catalog.length)return {status:'unknown',identity};
  return {status:catalog.includes(identity.codes[0])?'match':'conflict',identity};
}
export function generationQuestion(paths){
  const options=[...new Map(paths.map(p=>[String(p.generation.id),p.generation])).values()];
  return 'Kva utgåve har du? '+options.map(g=>g.name+generationPeriod(g)).join(' eller ')+'. Er du usikker, kan Bjørn hjelpe deg.';
}
