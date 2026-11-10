// Reviewed manufacturer engine identities. Never tuning values or supplier IDs.
// A full designation and the original specifications documented in each source
// identify a reference row. Explicit date scopes can narrow applicability, but
// never manufacture a code or tuning result. Missing facts stay unknown.
import {gearboxKind} from './vehicle-service-options.mjs';
import {catalogModelName} from './vehicle-identity.mjs';
import {KW_TO_HK} from './vehicle-units.mjs';
import {registrationDates} from './vehicle-dates.mjs';
export const engineReferenceSources=Object.freeze({
 mbE280Cdi2006:{publisher:'DaimlerChrysler AG',url:'https://ragtop.org/mbbrochures/2006/int-eclass.pdf',printedPage:100,checked:'2026-11-08',scope:'Manufacturer international E-Class W211/S211 brochure2006. E280CDI4MATIC:2987cc,140kW,440Nm,automatic. Used only for original technical identity, not facelift or tuning values. Publicly hosted primary document.'},
 mbE220CdiEuro5:{publisher:'Daimler AG',url:'https://www.car-mbenz.com/content/media_library/retailer/product/pc/all-class-brochures/E-Class_saloon_estate_W212_S212_0413.pdf',pdfPage:109,printedPage:107,checked:'2026-11-08',scope:'April2013 Estate technical table: E220 CDI,2143 cc,125 kW/170 hp,400 Nm,Euro5. Used only for the explicitly named older W212/W2072009–2013 supplier bucket, never as a blanket inference that absence of BlueTEC means Euro5.'},
 fiatDucato2014:{publisher:'Fiat Professional',url:'https://www.media.stellantis.com/em-en/fiat-professional/press/parma-show-2014-fiat-new-ducato-motorhome-is-leader-in-leisure-time',checked:'2026-11-07',scope:'180 MultiJet Power: nominal 3.0 litres, 130 kW / 177 HP and 400 Nm. No exact engine code inferred.'},
 fiatDucatoEuro6:{publisher:'Fiat Professional',url:'https://www.media.stellantis.com/uploads/uk/UK/2016/FIAT_Professional/Price_Lists/Fiat_Professional_Range_Price_List_DEC_2016.pdf',pdfPage:39,checked:'2026-11-07',scope:'December 2016, Ducato Euro 6 chassis for conversion: 2.3 150 MultiJet,150 HP/380 Nm; 2.3 180 MultiJet Power, actual177 HP/400 Nm. Displacement is nominal 2.3 litres, not an exact 2300 cc claim.'},
 mbSprinter2009:{publisher:'Mercedes-Benz',url:'https://media.mercedes-benz.fr/propres-sobres-puissants--la-nouvelle-generation-de-moteurs-diesel-pour-le-mercedes-benz-sprinter/',checked:'2026-11-07',scope:'29 May 2009 Sprinter announcement: OM651 diesel 2143 cc, 216/316/416/516 CDI 120 kW (163 metric hp), 360 Nm. Specification evidence only, no exact engine subcode or tuning values.'},
 bmw730d:{publisher:'BMW Group',url:'https://treffseiten.de/bmw/info/daten_730d_730ld_745d_05_09.pdf',pdfPage:1,checked:'2026-11-05',scope:'Manufacturer press technical data, September 2005: 730d 2993 cc, 170 kW/231 PS, 520 Nm. Publicly hosted original document; no tuning values.'},
 bmw116d:{publisher:'BMW Group',url:'https://www.press.bmwgroup.com/belux/article/attachment/T0076902FR/112402',pdfPage:1,checked:'2026-11-05',scope:'September 2009 model table: 116d, 1995 cc, 85 kW/115 PK. Used only for reliable pre-2011 profiles. Torque and engine code are not supplied by this table.'},
 mbGls:{publisher:'Daimler AG',url:'https://cms.my.na/assets/documents/p1aheb18hh17oahsa19imhbo15t31.pdf',pdfPage:1,checked:'2026-11-05',scope:'Manufacturer GLS X166 specification, April 2016: GLS 350 d 190 kW, 620 Nm, 2987 cc. No prices imported.'},
 mbGt:{publisher:'Daimler AG',url:'https://blog.le-parnass.com/catalogue_pdf/mercedesbenz_amg_gt201506.pdf',pdfPage:38,checked:'2026-11-05',scope:'Manufacturer UK technical table June 2015: AMG GT S 375 kW/510 hp, 650 Nm, 3982 cc. Distinct GT and GT S.'},
 mbE63:{publisher:'Daimler AG',url:'https://www.car-mbenz.com/content/media_library/retailer/product/pc/all-class-brochures/E-Class_saloon_estate_W212_S212_0413.pdf',pdfPage:108,checked:'2026-11-05',scope:'Manufacturer W212/S212 brochure April 2013: E63 AMG and 4MATIC 410 kW, 720 Nm, 5461 cc. S-model differs and is not aliased.'},
 volvo2008:{publisher:'Volvo Cars',url:'https://ldgsvccassets.blob.core.windows.net/pdfs/49f09bca49bcb716cbae2d5a01ba1f0d827bacb0/V70_XC70_OwnersManual_en.pdf',pdfPage:275,printedPage:274,checked:'2026-11-05',scope:'V70 diesel engine specifications; nominal 2.00 litres is not an exact 2000 cc measurement.'},
 volvoV70Support:{publisher:'Volvo Cars',url:'https://www.volvocars.com/au/support/car/v70/14w20/article/d24bb7d1e21ec6e4c0a801e801cf6114/510652ac31fe5b38c0a801e8014486bc/c48f21dbf78fa679c0a801e800b1d372/',checked:'2026-11-05',scope:'V70 table only, including separate D4 and D5 variants. Not all engines were sold in all markets. No introduction/build-date boundary is inferred.'},
});
const row=(designation,code,powerHk,torqueNm,nominalLitres,source)=>({make:'VOLVO',models:['V70'],designation,code,powerHk,torqueNm,nominalLitres,source});
export const engineReferences=Object.freeze([
 {make:'MERCEDESBENZ',models:['E280CDI4MATIC'],designation:'280 CDI',aliases:['280 CDI 4MATIC'],powerKw:140,torqueNm:440,capacityCc:2987,requiredRegisteredGearbox:'automatic',source:'mbE280Cdi2006'},
 {make:'MERCEDESBENZ',models:['E220','E220CDI','E220BLUETEC','E220BLUEEFFICIENCY','E220CDIBLUEEFFICIENCY'],designation:'220 CDi',powerKw:125,torqueNm:400,capacityCc:2143,emissionClass:'Euro 5',catalogueGeneration:{platform:'W212',startYear:2009,endYear:2013},source:'mbE220CdiEuro5'},
 {make:'FIAT',models:['Ducato'],designation:'150 Multijet (Euro 6)',powerHk:150,torqueNm:380,nominalCapacityLitres:2.3,emissionClass:'Euro 6',source:'fiatDucatoEuro6'},
 {make:'FIAT',models:['Ducato'],designation:'180 Multijet',powerHk:177,torqueNm:400,nominalCapacityLitres:3.0,emissionClass:'Euro 5',source:'fiatDucato2014'},
 {make:'FIAT',models:['Ducato'],designation:'180 Multijet (Euro 6)',powerHk:177,torqueNm:400,nominalCapacityLitres:2.3,emissionClass:'Euro 6',source:'fiatDucatoEuro6'},
 {make:'MERCEDESBENZ',models:['Sprinter','Sprinter 216 CDI','Sprinter 316 CDI','Sprinter 416 CDI','Sprinter 516 CDI'],designation:'216/316/416/516 CDi',powerKw:120,torqueNm:360,capacityCc:2143,source:'mbSprinter2009'},
 {make:'BMW',models:['730d'],designation:'730d',powerKw:170,torqueNm:520,capacityCc:2993,source:'bmw730d'},
 {make:'BMW',models:['116d'],designation:'116d',powerHk:115,capacityCc:1995,registeredFrom:'2009-01-01',registeredBefore:'2011-01-01',source:'bmw116d'},
 {make:'MERCEDESBENZ',models:['GLS350D','GLS350D4MATIC'],designation:'350 CDI',aliases:['350d','GLS350d'],powerKw:190,torqueNm:620,capacityCc:2987,source:'mbGls'},
 {make:'MERCEDESBENZ',models:['AMG GT S','GT S'],designation:'AMG GT S',aliases:['GT S'],powerKw:375,torqueNm:650,capacityCc:3982,source:'mbGt'},
 {make:'MERCEDESBENZ',models:['E63AMG','E63AMG4MATIC'],designation:'63 AMG',aliases:['E63AMG','E63AMG4MATIC'],powerKw:410,torqueNm:720,capacityCc:5461,source:'mbE63'},
 row('2.0D','D4204T',136,320,2.0,'volvo2008'),
 row('2.4D','D5244T5',163,340,2.4,'volvo2008'),
 row('D5','D5244T4',185,400,2.4,'volvo2008'),
 row('T4','B4164T',180,240,1.6,'volvoV70Support'),
 row('T4F','B4164T2',180,240,1.6,'volvoV70Support'),
 row('T5','B4204T11',245,350,2.0,'volvoV70Support'),
 row('T6','B6304T4',304,440,3.0,'volvoV70Support'),
 row('D2','D4162T',115,270,1.6,'volvoV70Support'),
 row('D3','D5204T7',136,350,2.0,'volvoV70Support'),
 row('D4','D5204T3',163,400,2.0,'volvoV70Support'),
 row('D4','D4204T5',181,400,2.0,'volvoV70Support'),
 row('D4','D5244T12',181,420,2.4,'volvoV70Support'),
 row('D4','D5244T17',163,420,2.4,'volvoV70Support'),
 row('D5','D5244T11',215,420,2.4,'volvoV70Support'),
 row('D5','D5244T15',215,440,2.4,'volvoV70Support'),
]);
const generationScope=(r,engine)=>!r.catalogueGeneration||engine.generation&&String(engine.generation.name??'').toUpperCase().split(/[^A-Z0-9]+/).includes(r.catalogueGeneration.platform)&&engine.generation.year===r.catalogueGeneration.startYear&&engine.generation.yearend===r.catalogueGeneration.endYear;
const key=v=>String(v??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const makeKey=v=>['MERCEDES','MERCEDESBENZ','MERCEDESAMG'].includes(key(v))?'MERCEDESBENZ':key(v);
// A supplier's absent displacement must not bypass specifications already
// documented for this full variant. Check every compatible reference rather
// than picking a single row when the manufacturer's own table has alternatives.
export function referenceVariantConflict(engine,vehicle,references=engineReferences){
 const designation=key(engine.name),make=makeKey(vehicle.manufacturer),model=key(catalogModelName(vehicle.model,vehicle.manufacturer)),dates=registrationDates(vehicle.firstRegistered,vehicle.firstRegisteredNorway);
 const rows=references.filter(r=>(!r.requiredRegisteredGearbox||gearboxKind(vehicle.gearbox)===r.requiredRegisteredGearbox)&&generationScope(r,engine)&&makeKey(r.make)===make&&r.models.some(m=>key(m)===model)
  &&(!r.registeredBefore||dates.firstRegistered&&!dates.registrationDateIssues.length&&dates.firstRegistered>=r.registeredFrom&&dates.firstRegistered<r.registeredBefore)
  &&[r.designation,...(r.aliases??[])].some(n=>key(n)===designation)
  &&Math.abs((r.powerKw?r.powerKw*KW_TO_HK:r.powerHk)-engine.power)<=0.5*KW_TO_HK+0.5);
 return rows.length>0&&rows.every(r=>{
  const cc=r.capacityCc??(r.nominalCapacityLitres??r.nominalLitres)*1000;
  return vehicle.engineCc>0&&cc>0&&Math.abs(vehicle.engineCc-cc)>100
    ||engine.torque>0&&r.torqueNm>0&&Math.abs(engine.torque-r.torqueNm)>0.5;
 });
}
export function referenceEngineCodes(engine,vehicle,references=engineReferences){
 const designation=key(String(engine.name??'').replace(/\s+\d+(?:[.,]\d+)?\s*(?:hp|hk|ps)\b.*$/i,''));
 if(!designation||!(engine.power>0)||!(engine.torque>0))return {status:'unknown',codes:[],sources:[]};
 const make=makeKey(vehicle.manufacturer),model=key(catalogModelName(vehicle.model,vehicle.manufacturer));
 const dates=registrationDates(vehicle.firstRegistered,vehicle.firstRegisteredNorway);
 const matches=references.filter(r=>(!r.requiredRegisteredGearbox||gearboxKind(vehicle.gearbox)===r.requiredRegisteredGearbox)&&generationScope(r,engine)&&makeKey(r.make)===make&&r.models.some(m=>key(m)===model)
  &&(!r.registeredBefore||dates.firstRegistered&&!dates.registrationDateIssues.length&&vehicle.registrationDateStatus!=='missing'&&vehicle.registrationDateStatus!=='conflicting'&&dates.firstRegistered>=r.registeredFrom&&dates.firstRegistered<r.registeredBefore)
  &&[r.designation,...(r.aliases??[]),...(r.nominalLitres?[r.nominalLitres.toFixed(1)+' '+r.designation]:[])].some(n=>key(n)===designation)
  &&(r.powerKw?Math.abs(r.powerKw*KW_TO_HK-engine.power)<=0.5*KW_TO_HK+0.5:Math.abs(r.powerHk-engine.power)<=0.5)
  &&(r.torqueNm==null||Math.abs(r.torqueNm-engine.torque)<=0.5));
 const emissions=[...new Set(matches.map(r=>r.emissionClass).filter(Boolean))];
 const nominal=[...new Set(matches.map(r=>r.nominalCapacityLitres).filter(v=>v>0))];
 const codes=[...new Set(matches.filter(r=>r.code).map(r=>key(r.code)))],sources=[...new Set(matches.map(r=>r.source))],capacities=[...new Set(matches.map(r=>r.capacityCc).filter(v=>v>0))];
 return {status:codes.length===1?'documented-signature':codes.length?'ambiguous':matches.length?'documented-specification':'unknown',codes,sources,...(capacities.length===1?{capacityCc:capacities[0]}:{}),...(nominal.length===1?{nominalCapacityCc:nominal[0]*1000,capacityPrecision:'nominal-litres'}:{}),...(emissions.length===1?{emissionClass:emissions[0]}:{})};
}
