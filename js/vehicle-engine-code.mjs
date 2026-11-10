import {KW_TO_HK} from './vehicle-units.mjs';
// Reviewed manufacturer evidence, not a general prefix/substring comparison.
export const engineCodeSources=Object.freeze({
 mbSprinterFamilies:{publisher:'Daimler Truck',url:'https://www.daimlertruck.com/en/newsroom/presskit/driving-experience-the-new-mercedes-benz-intouro-and-sprinter-minibuses-50236478',checked:'2026-11-08',fact:'Sprinter technical family labels OM 642 (2.98 l/140 kW) and OM 651 (2.14 l); family labels omit a full application subcode. Only these exact registered three-digit families are recognised as incomplete family evidence.'},
 vwFourCharacter:{publisher:'Volkswagen of America',url:'https://static.nhtsa.gov/odi/tsbs/2014/MC-10074002-2280.pdf',pdfPages:[31,274,342],checked:'2026-11-05',fact:'Four-character C... engine codes: first three characters identify mechanical structure, fourth identifies output/torque. The block can carry the three-character form.'},
 cayVariants:{publisher:'Niterra / NGK NTK',url:'https://www.tekniwiki.com/fileadmin/emea/catalogues_pdf/ntk_catalogue_edps_2024-2025_en.pdf',pdfPages:[129,152,153],checked:'2026-11-05',fact:'CAYA/CAYB/CAYC: 1598 cc TDI, 55/66/77 kW respectively. Jetta applications include CAYB and CAYC; no tuning effect data are taken from this document.'},
});
const reviewedCay=Object.freeze({CAYA:55,CAYB:66,CAYC:77});
// A documented shorter mechanical code is incomplete variant evidence. It is
// never an exact code match, never an inference of a suffix from a variant/VIN,
// and cannot replace fuel, displacement, power or checked catalogue details.
export function reviewedMechanicalCode(engine,vehicle,canonicalMake){
 const short=String(vehicle.engineCode??'').trim().toUpperCase(),full=String(engine.engineCode??'').trim().toUpperCase();
 if(canonicalMake==='mercedes'&&/^(?:OM\s*)?(?:642|651)$/.test(short)){
  const family=short.replace(/^OM\s*/,''),supplier=full.match(/^OM\s*(642|651)(?=$|[\s.\-]|DE)/)?.[1];
  return !!supplier&&supplier===family&&/diesel/i.test(vehicle.fuel??'')&&/diesel/i.test(engine.fuel??'');
 }
 if(canonicalMake!=='volkswagen'||short!=='CAY'||!Object.hasOwn(reviewedCay,full))return false;
 if(!/diesel/i.test(vehicle.fuel??'')||!/diesel/i.test(engine.fuel??'')||Math.abs((vehicle.engineCc??0)-1598)>2)return false;
 if(typeof engine.power==='number'&&Math.abs(engine.power-reviewedCay[full]*KW_TO_HK)>1.5)return false;
 return true;
}
