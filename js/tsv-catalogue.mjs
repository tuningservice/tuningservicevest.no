// Owner-maintained additions. No supplier IDs, imported prices or registration
// numbers. Keep this catalogue separate from immutable supplier snapshots.
import {kwToHk} from './vehicle-units.mjs';
import {vehicleCategoryGroup} from './vehicle-category.mjs';
import {catalogModelName} from './vehicle-identity.mjs';
import {serviceFacts,fuelKind,gearboxKind} from './vehicle-service-options.mjs';
const compact=value=>String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const modelKey=value=>String(value??'').trim().toUpperCase().replace(/^([A-Z]+)\s*(\d+)(?=$|\s)/,'$1 $2');
export const ownVehicles=[{
 id:'tsv:variant:scania-r650-dc16118',manufacturer:'Scania',model:'R 650',
 category:'heavy',vehicleType:'Trucks & Buses',fuel:'Diesel',
 engineCode:'DC 16 118',engineCc:16353,gearbox:'Automat',
 original:{powerHk:650,torqueNm:3300},
 stages:[{code:'1',label:'Stage 1',tuned:{powerHk:710,torqueNm:3680},requirements:[]}],
 provenance:{namespace:'tsv',providedBy:'Bjørn',providedAt:'2026-11-09',basis:'owner-supplied',measured:false},
 // Verified manufacturer association only; never a shared engine ID.
 brand:{namespace:'tuningfiles',manufacturerId:'5858',typeId:'2',name:'Scania',logoAvailable:true,association:'verified-manufacturer-only'}
}];
export function ownCatalogueCandidates(vehicle,records=ownVehicles){
 if(vehicle?.requiresManual)return [];
 return records.filter(r=>{
  if(compact(vehicle.manufacturer)!==compact(r.manufacturer)||vehicleCategoryGroup(vehicle.vehicleCategory)!==r.category)return false;
  const actual=modelKey(catalogModelName(vehicle.model,vehicle.manufacturer)),expected=modelKey(r.model);
  if(actual!==expected&&!actual.startsWith(expected+' '))return false;
  if(fuelKind(vehicle.fuel)!==fuelKind(r.fuel))return false;
  const hp=kwToHk(vehicle.engineKw);
  if(!Number.isFinite(hp)||Math.abs(hp-r.original.powerHk)>1.5||!Number.isFinite(vehicle.engineCc)||Math.abs(vehicle.engineCc-r.engineCc)>2)return false;
  if(vehicle.engineCode&&compact(vehicle.engineCode)!==compact(r.engineCode))return false;
  if(gearboxKind(vehicle.gearbox)&&gearboxKind(vehicle.gearbox)!==gearboxKind(r.gearbox))return false;
  return true;
 });
}
export function ownVehicleResult(id,{registered=null,records=ownVehicles}={}){
 const r=records.find(row=>row.id===id);if(!r)throw new Error('Unknown own-catalogue variant');
 // A supplied lookup cannot be attached to a contradictory own result.
 if(registered&&!ownCatalogueCandidates(registered,records).some(row=>row.id===id))throw new Error('Own catalogue conflicts with register data');
 return {source:'tsv',sourceLabel:'Tuningservice Vest · eigne opplysningar',
  label:r.manufacturer+' '+r.model+' · '+r.engineCode,brand:structuredClone(r.brand),
  ids:{namespace:'tsv',vehicleId:r.id},provenance:structuredClone(r.provenance),simulated:false,
  serviceFacts:serviceFacts({registered,catalog:{manufacturer:r.manufacturer,vehicleType:r.vehicleType,fuel:r.fuel,gearbox:r.gearbox,engineCc:r.engineCc}}),
  customerBasis:'Rettleiande effekt oppgitt av Tuningservice Vest. Ikkje ei individuell måling. Resultatet avheng av tilstand og oppsett.',
  stages:r.stages.map(s=>({source:'tsv',key:r.id+':stage:'+s.code,code:s.code,label:s.label,
   original:structuredClone(r.original),tuned:structuredClone(s.tuned),requirements:structuredClone(s.requirements),sourceUrl:null})),
  defaultIndex:0};
}
export function ownManualOptions(typeId,manufacturerId,registered=null){
 return ownVehicles.filter(r=>r.brand.typeId===typeId&&r.brand.manufacturerId===manufacturerId&&(!registered||ownCatalogueCandidates(registered).some(v=>v.id===r.id)))
  .map(r=>({id:r.id,name:r.model+' · '+r.engineCode+' · '+r.original.powerHk+' HK'}));
}
