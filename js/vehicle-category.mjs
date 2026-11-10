import {catalogModelName} from './vehicle-identity.mjs';
// Reviewed SVV technical categories. G is the documented off-road subtype;
// it does not turn a passenger car/LCV into a bus or heavy truck.
// https://autosys-kjoretoy-api.atlas.vegvesen.no/kodeverk-ui/index-kodeverk.html?kodeverkId=TEKNISKKODE
// Checked 2026-11-05: M1/M1G passenger cars; N1/N1G goods vehicles <=3500 kg.
export function isLightVehicleCategory(value){return /^(?:M1G?|N1G?)$/i.test(String(value??'').trim());}

// The same official code list documents N2/N3 trucks, M2/M3 buses,
// T1–T5/TR tractors and C1–C5 tracked tractors. R/O/TT are trailers,
// MR is machinery: none of these are guessed to be agricultural tractors.
// Reviewed 2026-11-06. Catalogue IDs are discovered from /vdb/types/.
export function vehicleCategoryGroup(value){
  const code=String(value??'').trim().toUpperCase();
  if(isLightVehicleCategory(code))return 'light';
  if(/^(?:N[23]G?|M[23]G?)$/.test(code))return 'heavy';
  if(/^(?:T[1-5]|C[1-5]|TR)$/.test(code))return 'agriculture';
  return null;
}
// Reviewed from returned supplier catalogue paths on 2026-11-07:
// Cars & LCV -> Mercedes-Benz -> Sprinter (all returned generations).
// This is a persistent model-family routing rule, never an engine match or a
// change of the registered legal category. Supplier IDs are always discovered.
export function reviewedCatalogRouting(vehicle){
  if(vehicle?.baseCatalogueType==='Trucks & Buses'&&['mercedes-atego','iveco-eurocargo'].includes(vehicle.baseVehicleEvidence?.id))return {ruleId:'documented-motorhome-heavy-base',catalogueTypeName:'Trucks & Buses',evidence:vehicle.baseVehicleEvidence.basis,checked:'2026-11-08'};
  const make=String(vehicle?.manufacturer??'').replace(/[^a-z]/gi,'').toUpperCase();
  if(!['MERCEDES','MERCEDESBENZ'].includes(make)||!['light','heavy'].includes(vehicleCategoryGroup(vehicle?.vehicleCategory)))return null;
  const model=catalogModelName(vehicle.model,vehicle.manufacturer);
  if(!/^SPRINTER(?:\s|$)/i.test(model))return null;
  return {ruleId:'mercedes-sprinter-cars-lcv',model:'Sprinter',catalogueTypeName:'Cars & LCV',evidence:'captured-supplier-type-make-model-path',checked:'2026-11-07'};
}
export function catalogTypeMatches(name,category,vehicle=null){
  const reviewed=reviewedCatalogRouting(vehicle);
  if(reviewed)return String(name??'').trim()===reviewed.catalogueTypeName;
  const group=vehicleCategoryGroup(category),label=String(name??'').trim();
  return group==='light'?/^Cars\s*&\s*LCV$/i.test(label)
    :group==='heavy'?/^Trucks\s*&\s*Buses$/i.test(label)
    :group==='agriculture'?/^Agriculture$/i.test(label):false;
}
