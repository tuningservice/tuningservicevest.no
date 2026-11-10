// Scania Type designations – Function, 2016-10-21, pp.2–7:
// https://pdfcoffee.com/scania-type-designation-pdf-free.html (OEM document mirror).
// Cab + power code form the model. The remaining validated chassis tokens
// are retained as qualifiers, never evidence of an engine/ECU/tuning variant.
// Also corroborated by Scania's public bodybuilder specification sheets.
export function heavyModelDesignation(vehicle){
  const group=String(vehicle?.vehicleCategory??'').trim().toUpperCase();
  if(!/^(?:N[23]G?|M[23]G?|T[1-5]|C[1-5]|TR)$/.test(group))return null;
  const value=catalogModelName(vehicle.model,vehicle.manufacturer);
  const bare=value.match(/^([A-Z]{1,5})\s*(\d{2,4}[A-Z]?)(?:\s+(?:(?:LA|LB|DA|DB)?[2468]X[2468]))?$/i);
  if(bare)return {family:bare[1].toUpperCase(),variant:bare[2].toUpperCase(),qualifiers:null,basis:'literal-series-designation'};
  if(!/^N[23]G?$/.test(group)||String(vehicle.manufacturer??'').trim().toLowerCase()!=='scania')return null;
  const match=value.match(/^([PGR])\s*(\d{3})\s*([LDC][AB])\s*(4X[24]|6X[246]|8X[2468]|6X2[/*][24]|8X[246][/*][246]|10X4[/*]6)\s*([MHE])\s*([ELNSH])\s*([ABCZ])$/i);
  return match?{family:match[1].toUpperCase(),variant:match[2],qualifiers:match.slice(3).join('').toUpperCase(),basis:'scania-type-designation-2016'}:null;
}

// Volvo's FH drivetrain documentation names D13K540 as a 12.8-litre
// engine in the 13-litre family. Supplier model groups FH13/FM13 encode
// this family, whereas the register trade name FH540 encodes the power badge.
// https://www.volvotrucks.no/content/dam/volvo-trucks/markets/norway/brochures/Volvo_FH_Product_Overview_Euro6_2020_NB-NO.pdf p.15
// Require the literal model family and a known engine family or displacement;
// when both are available they must agree. Missing facts stay unknown. This
// identifies a supplier model group only, never an engine or effect figure.
export function displacementModelGroupMatch(alias,vehicle){
  if(String(vehicle?.manufacturer??'').trim().toLowerCase()!=='volvo'||!/^N[23]G?$/i.test(String(vehicle?.vehicleCategory??'').trim()))return false;
  const designation=heavyModelDesignation(vehicle),model=String(alias??'').trim().match(/^([A-Z]{1,5})\s*(\d{1,2})$/i);
  const code=String(vehicle.engineCode??'').replace(/\s+/g,'').match(/^D(\d{1,2})[A-Z](\d{3})(?:TC|S)?$/i);
  if(!designation||!model||designation.family!==model[1].toUpperCase())return false;
  const hasCc=typeof vehicle.engineCc==='number'&&Number.isFinite(vehicle.engineCc)&&vehicle.engineCc>0;
  const ccMatch=hasCc&&Math.abs(vehicle.engineCc/1000-Number(model[2]))<=0.5;
  const codeMatch=!!code&&Number(model[2])===Number(code[1])&&designation.variant===code[2];
  if(hasCc&&!ccMatch||code&&!codeMatch)return false;
  return ccMatch||codeMatch;
}

// Remove only complete leading manufacturer names, never substrings in a model.
export function catalogModelName(model,manufacturer){
  let value=String(model??'').replace(/\s+/gu,' ').trim();
  const brand=String(manufacturer??'').trim().split(/[\s-]+/u).filter(Boolean).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s-]+');
  if(!brand)return value;
  // Some register trade names concatenate the make and numeric model (Mazda6,
  // BMW730d). Only the digit boundary permits omission of a separator.
  const prefix=new RegExp('^'+brand+'(?:\\s*[:,-]\\s*|\\s+|(?=\\d))','iu');
  for(let i=0;i<8;i++){const next=value.replace(prefix,'').trim();if(next===value||!next)break;value=next;}
  return value;
}
export function customerManufacturer(value){
  const name=String(value??'').trim().replace(/\s+/gu,' ');
  if(name.length<=3||name!==name.toUpperCase())return name;
  return name.toLowerCase().replace(/(^|[\s-])\p{L}/gu,c=>c.toUpperCase());
}
export function registeredVehicleLabel(vehicle,canonicalManufacturer=null){
  const make=canonicalManufacturer||customerManufacturer(vehicle?.manufacturer);
  const model=customerManufacturer(catalogModelName(vehicle?.model,vehicle?.manufacturer));
  const comparable=v=>String(v??'').normalize('NFKD').replace(/[^a-z0-9]/gi,'').toLowerCase();
  return [make,comparable(make)===comparable(model)?null:model].filter(Boolean).join(' ');
}

// Manufacturer's 29 May 2009 Sprinter engine announcement explicitly lists
// 219/319/419/519 CDI: diesel, 2987 cc, 140 kW. A bare badge with recognised
// cab/wheelbase suffixes identifies this model family only after corroborating
// those register facts. It never identifies emissions equipment or tuning support.
export const commercialModelSources=Object.freeze({
 sprinterV6:{publisher:'Mercedes-Benz',url:'https://media.mercedes-benz.fr/propres-sobres-puissants--la-nouvelle-generation-de-moteurs-diesel-pour-le-mercedes-benz-sprinter/',checked:'2026-11-07',fact:'Sprinter 219 CDI / 319 CDI / 419 CDI / 519 CDI, OM642 V6, 2987 cc, 140 kW (190 metric hp), 440 Nm. Cab and wheelbase suffixes are not engine/ECU evidence.'}
});
export function documentedCommercialModel(vehicle){
 const make=String(vehicle?.manufacturer??'').replace(/[^a-z]/gi,'').toUpperCase();
 if(!['MERCEDES','MERCEDESBENZ'].includes(make)||! /^(?:N[12]G?|M2G?)$/i.test(String(vehicle?.vehicleCategory??'').trim()))return null;
 const model=catalogModelName(vehicle.model,vehicle.manufacturer);
 if(!/^(?:SPRINTER\s+)?(?:219|319|419|519)(?:\/\d{2})?(?:\s+(?:CDI|DOKA|S[1-9]))*$/i.test(model))return null;
 const hp=vehicle.engineKw>0?vehicle.engineKw*1.35962:vehicle.powerHk;
 if(!/diesel/i.test(vehicle.fuel??'')||Math.abs((vehicle.engineCc??0)-2987)>2||!(hp>0)||Math.abs(hp-190)>1.2)return null;
 return {model:'Sprinter',basis:'documented-commercial-badge-and-technical-profile',source:'sprinterV6'};
}
