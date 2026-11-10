// A motorhome builder is not the chassis manufacturer. These named builders
// are documented in the Knaus technical guides and Rapido technical/type
// approval material. No market share, VIN decoding or registration exceptions.
import {documentedBaseEvidence} from './vehicle-base-registry.mjs';
export const motorhomeBuilders=Object.freeze(['KNAUS','RAPIDO','EURAMOBIL','MORELO','CARTHAGO','HYMER','DETHLEFFS','RIMOR','HOBBY','BURSTNER','ADRIA','FRANKIA']);
export const baseVehicleOptions=Object.freeze([
 {id:'fiat-ducato',manufacturer:'Fiat',model:'Ducato',label:'Fiat Ducato'},
 {id:'mercedes-sprinter',manufacturer:'Mercedes-Benz',model:'Sprinter',label:'Mercedes-Benz Sprinter'},
 {id:'ford-transit',manufacturer:'Ford',model:'Transit',label:'Ford Transit'},
 {id:'renault-master',manufacturer:'Renault',model:'Master',label:'Renault Master'},
 {id:'iveco-daily',manufacturer:'Iveco',model:'Daily',label:'Iveco Daily'},
 {id:'mercedes-atego',manufacturer:'Mercedes-Benz',model:'Atego',label:'Mercedes-Benz Atego',catalogueTypeName:'Trucks & Buses'},
 {id:'iveco-eurocargo',manufacturer:'Iveco',model:'Eurocargo',label:'Iveco Eurocargo',catalogueTypeName:'Trucks & Buses'},
]);
const key=v=>String(v??'').toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
export function needsBaseVehicle(vehicle){return motorhomeBuilders.includes(key(vehicle?.manufacturer))&&/^M1G?$/i.test(String(vehicle?.vehicleCategory??'').trim());}
export function confirmedBaseVehicle(vehicle){
 if(!needsBaseVehicle(vehicle))return null;
 const evidence=vehicle.baseVehicle?.status==='customer-confirmed'?{id:vehicle.baseVehicle.id,status:'customer-confirmed',basis:'explicit-customer-choice'}:documentedBaseEvidence(vehicle);
 const row=baseVehicleOptions.find(o=>o.id===evidence?.id);return row?{...row,...evidence}:null;
}
export function baseMatchingVehicle(vehicle){
 const base=confirmedBaseVehicle(vehicle);if(!base)return structuredClone(vehicle);
 const result={...structuredClone(vehicle),manufacturer:base.manufacturer,model:base.model,
  // Builder approval/type strings do not identify a chassis generation.
  typeCode:null,variantCode:null,versionCode:null,...(base.catalogueTypeName?{baseCatalogueType:base.catalogueTypeName}:{}),baseVehicleEvidence:{id:base.id,basis:base.basis}};delete result.baseVehicle;return result;
}
