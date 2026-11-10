import {confirmedBaseVehicle,baseMatchingVehicle} from './vehicle-base.mjs';
// Reviewed identity evidence only. No registration/VIN mappings or effect data.
import {catalogModelName} from './vehicle-identity.mjs';
import {registrationDates} from './vehicle-dates.mjs';
import {KW_TO_HK} from './vehicle-units.mjs';
const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export const identitySources=Object.freeze({
 mb212Archive:{publisher:'Mercedes-Benz',title:'E 220 CDI BlueEFFICIENCY, 2009–2013',url:'https://mercedes-benz-publicarchive.com/marsClassic/en/instance/ko/E-220-CDI-BlueEFFICIENCY-2009---2013.xhtml?oid=188539114',checked:'2026-11-08',fact:'W 212 D 22 / type 212.002; OM651.924,2143 cc,125 kW/170 DIN hp,400 Nm. Generation/technical identity only, not a BlueTEC/facelift inference.'},
 mb212K:{publisher:'GDV',title:'E-Class 212 K E220 CDI T-Modell,125 kW',url:'https://www.dieversicherer.de/typklassen/versicherer/Mercedes-Benz_E-Klasse-hsn-1313-tsn-BMD',checked:'2026-11-08',fact:'Registered type 212 K, E220 CDI estate,125 kW, introduced2009. Shared 212 labels are not decoded without technical corroboration and the conservative pre-successor date bound.'},
 mb213Estate:{publisher:'Mercedes-Benz',title:'Verkoopstart nieuwe Mercedes-Benz E-Klasse Estate',url:'https://media.mercedes-benz.nl/verkoopstart-nieuwe-mercedes-benz-e-klasse-estate/',checked:'2026-11-08',fact:'New E-Class Estate introduced2016. The 212 K rule is only enabled with reliable global registration before2016; later registration never excludes an older car.'},
 audiB7Launch:{publisher:'Audi AG',title:'Hohe Wertstabilität für neuen Audi A4 erwartet, 26 October 2004',url:'https://www.presseportal.de/pm/6730/610332',checked:'2026-11-06',hosting:'Original Audi AG press release distributed by news aktuell.',fact:'New A4 saloon launch 5 November 2004; Avant 26 November 2004. Only reliable global registrations before 2004 are used to exclude B7, retaining the entire changeover year conservatively.'},
 mb211:{publisher:'Valeo',title:'Manufacturer vehicle reference E320 W211',url:'https://www.valeoservice.com/en-com/techassist/vehicle/P-16564?country=DE',checked:'2026-11-05',fact:'E-Class W211 E320 211.065, 3199 cc, 165 kW. Base-generation reference; no VIN or body subtype is decoded.'},
 bmwF20Start:{publisher:'BMW Group',title:'The new BMW 1 Series, 5 June 2011',url:'https://www.press.bmwgroup.com/united-kingdom/article/detail/T0112077EN_GB/the-new-bmw-1-series?language=en_GB',checked:'2026-11-05',fact:'Second-generation 1 Series introduced 2011, UK sale September 2011. Only globally registered dates before 2011 are used as a conservative exclusion of F2x.'},
 vwGolfAu:{publisher:'Volkswagen AG',title:'Golf VII vehicle data and factory code',url:'https://www.volkswagen-newsroom.com/en/vehicle-data-golf-7-profile-20039',checked:'2026-11-05',fact:'Golf VII factory code AU, including 2014–2018 GTE. Identifies the base generation; does not identify facelift, production date or tuning compatibility.'},
 vwPassatGte:{publisher:'Volkswagen AG',title:'Passat B8 predecessor model, including Passat GTE',url:'https://www.volkswagen.de/de/besitzer-und-service/ueber-ihr-auto/vorgaengermodelle/mittelklasse/passat-b8.html',checked:'2026-11-05',fact:'B8 / 3G, 2014–2023, includes GTE. Registered approval type 3C alone is not a B8 identifier.'},
 vwPassatFirstPhev:{publisher:'Volkswagen Group',title:'Chronicle 1992–2015: first Passat plug-in hybrid in 2014',url:'https://www.volkswagen-group.com/en/volkswagen-chronicle-17351/1992-to-2015-globalisation-of-the-mobility-group-17360',checked:'2026-11-05',fact:'First Passat plug-in hybrid presented October 2014. Supports the factory PHEV generation scope, never a sum of motor powers.'},
 vwPassatNext:{publisher:'Volkswagen AG',title:'All-new ninth Passat generation pre-sales, 16 November 2023',url:'https://www.volkswagen-newsroom.com/en/press-releases/configurator-open-pre-sales-of-the-all-new-passat-have-now-started-17924',checked:'2026-11-05',fact:'Ninth generation deliveries start first quarter 2024. PHEV base-generation rule uses only reliable global registrations before 2023, a deliberately conservative boundary.'},
 volvoV70S:{publisher:'ClimAir PLAVA Kunststoffe GmbH',title:'ClimAir 2021 vehicle fitment catalogue',url:'https://erny.ch/wp-content/uploads/2021/04/CA_Katalog_2021_Web.pdf',page:55,checked:'2026-11-05',hosting:'Manufacturer-authored catalogue, publicly hosted copy.',fact:'Table columns explicitly distinguish vehicle type from body style: V70 type S, 2000–2007; succeeding V70/XC70 type B, 2007–2016. SW in this table is estate body style, not a decoded homologation variant. Fitment years are not exact build dates.'},
 volvoV70II:{publisher:'ClimAir PLAVA Kunststoffe GmbH',title:'Manufacturer fitment CLI0033097: V70 type S',url:'https://shop.climair.de/Vordere-Windabweiser-1-Set-fuer-VOLVO-V70-CROSSCOUNTRY-TYP-S-SW-5-Door-2000-2007-fuer-die-Fahrer-und-Beifahrerseite/CLI0033097',checked:'2026-11-05',fact:'Same manufacturer product identifies the compatible Volvo as V70 II (285). Supports generation only; no engine code, gearbox or tuning compatibility is inferred.'},
 skoda3t:{publisher:'Škoda',title:'Superb II rescue sheet',url:'https://www.skoda.pl/_doc/4cd534b8-db17-4bde-9bf3-d3fc85454aff',page:1,checked:'2026-11-04',fact:'Rescue-sheet identity TMB-3T; Superb II, 2008–2015.'},
 bmwVariants:{publisher:'DEFA AS',title:'414842 fitting instructions',url:'https://www.defa.com/content/uploads/Documentation/Enginge-heaters/Find-engine-heater/Manuals-and-pdfs/414842.pdf',page:3,checked:'2026-11-04',fact:'Explicit BMW model, body and homologation variants; not an engine-tuning compatibility table.'},
 bmw2015:{publisher:'BMW Group',title:'Annual Report 2015',url:'https://www.bmwgroup.com/content/dam/grpw/websites/bmwgroup_com/ir/downloads/en/2016/hv/2015-BMW-Group-Annual-Report.pdf',page:43,checked:'2026-11-04',fact:'Updated 3 Series Sedan and Touring introduced July 2015. Conservative exclusion uses only dates before 2015, not an exact production-day cutoff.'},
 audiBpw:{publisher:'Audi AG',title:'Self-Study Programme 343: The new Audi A4 2005',url:'https://www.volkspage.net/technik/ssp/ssp/SSP_343.pdf',page:12,checked:'2026-11-04',hosting:'Manufacturer-authored primary document, publicly hosted copy.',fact:'BPW: A4 2.0-litre TDI, 103 kW, factory DPF. This is original equipment, not proof of current physical condition.'},
 audiB7:{publisher:'Hengst Filtration',title:'Manufacturer filter fitment catalogue: Audi A4 B7 (8EC)',url:'https://catalog.hengst.com/de/online-katalog/produkt/409200000-05/au/',checked:'2026-11-04',fact:'BPW, 103 kW, A4 B7 (8EC); supports model-generation scope, not tuning numbers.'},
 volvoP1:{publisher:'Volvo Cars',title:'Technical Journal 19245: Vehicle type and platform identification',url:'https://volvotechinfo.com/index.cfm?event=viewFile&fileName=TJ19245-2015-04-02.pdf',page:2,checked:'2026-11-04',fact:'V50, type 545, platform P1. North American model-year ranges are not used as European first-registration bounds.'},
 volvo2007:{publisher:'Volvo Cars',title:'Introducing the new Volvo S40 and V50 Sportswagon',url:'https://www.volvocars.com/uk/media/press-releases/B4B77D63B32008A6/',checked:'2026-11-04',fact:'Model-year 2008 update; production from May 2007. July first registration does not establish build date/model year.'},
 fordFocus:{publisher:'Ford',title:'2014 Focus (2010) owner manuals',url:'https://www.ford.co.uk/support/vehicle/focus-2010/2014/owner-manuals',checked:'2026-11-04',fact:'Build-date-specific manuals exist. No reviewed rule maps M1DA alone to a unique generation; no such deduction is enabled.'},
});
export const reviewedBMWVariants=Object.freeze({'3K11':'F31','3K91':'F31','3K31':'F31','3D31':'F30','3D11':'F30'});
const bmwVariantModels={'3K11':'318D','3K91':'316D','3K31':'320D','3D31':'320D','3D11':'318D'};
// Earlier hand-written mappings are deliberately not promoted without a
// retrievable source for each code. This is review state, not an active rule.
export const pendingIdentityCodes=Object.freeze(['BMW:3E11','BMW:3L11','BMW:3Y31','BMW:3Y51','Ford:M1DA-to-generation']);
export const identityRegistry=Object.freeze([
 {id:'mercedes-e220-212k-pre-successor',make:'MERCEDESBENZ',models:['E220','E220CDI','E220BLUETEC','E220BLUEEFFICIENCY','E220CDIBLUEEFFICIENCY'],selector:{scopedModels:true,typeCodes:['212K'],firstRegisteredBefore:'2016-01-01'},expected:{fuel:'diesel',powerKw:125,capacityCc:2143,capacityTolerance:5},generation:{key:'mercedes:e:212',label:'E-klasse 212',platform:'212',startYear:2009,endYear:2016},sources:['mb212Archive','mb212K','mb213Estate'],catalogue:{vdbNames:['W212','S212'],dvxPlatformTokens:['W212','S212']},scope:'Corroborated registered type + E220 diesel 125 kW/2143 cc before the successor introduction year. Does not establish facelift or emissions equipment.'},
 {id:'mercedes-e320-211',make:'MERCEDESBENZ',models:['E320'],selector:{typeCodes:['211']},generation:{key:'mercedes:e:211',label:'E-klasse W211',platform:'W211',startYear:2002,endYear:2009},sources:['mb211'],catalogue:{vdbNames:['W211','S211']}},
 {id:'vw-golf-au',make:'VOLKSWAGEN',models:['GOLF'],selector:{typeCodes:['AU']},generation:{key:'vw:golf:VII',label:'Golf VII',platform:'AU',startYear:2012,endYear:2019},sources:['vwGolfAu'],catalogue:{vdbNames:['VII','VII FL'],dvxNamePrefix:'Golf 7'},scope:'Base generation only; calendar year is not a facelift/build-date proof.'},
 {id:'vw-passat-phev-before-b9',make:'VOLKSWAGEN',models:['PASSAT'],selector:{typeCodes:['3C','3G'],hybridCategory:'LADBAR',firstRegisteredBefore:'2023-01-01'},generation:{key:'vw:passat:B8',label:'Passat B8',platform:'B8',startYear:2014,endYear:2023},sources:['vwPassatGte','vwPassatFirstPhev','vwPassatNext'],catalogue:{vdbNames:['B8','B8 FL']},scope:'Factory PHEV identity with reliable date before the successor. Shared approval type 3C alone never identifies B8 or its facelift.'},
 {id:'volvo-v70-type-s',make:'VOLVO',models:['V70'],selector:{typeCodes:['S']},generation:{key:'volvo:v70:II',label:'V70 II',platform:'S',startYear:2000,endYear:2007},sources:['volvoV70S','volvoV70II'],catalogue:{vdbNames:['II'],dvxPeriodWithin:{startYear:2000,endYear:2007}},scope:'Exact registered type S within V70 only. Variant/version strings and engine-code typography are not decoded. Catalogue periods must be contained in the documented generation range; A date alone never activates this rule.'},
 {id:'skoda-superb-3t',make:'SKODA',models:['SUPERB'],selector:{typeCodes:['3T']},generation:{key:'skoda:superb:II',label:'Superb II',platform:'3T',startYear:2008,endYear:2015},sources:['skoda3t'],catalogue:{vdbNames:['II'],dvxStart:2008,dvxEnd:2015}},
 {id:'bmw-reviewed-variants',make:'BMW',models:['3-series','3-serie'],selector:{variants:reviewedBMWVariants},sources:['bmwVariants'],scope:'Generation/body only; no engine or gearbox is inferred.'},
 {id:'audi-a4-bpw',make:'AUDI',models:['A4'],selector:{engineCodes:['BPW']},expected:{fuel:'diesel',powerKw:103,capacityCc:2000,capacityTolerance:100,typeCodesWhenPresent:['8E','8EC']},generation:{key:'audi:a4:B7',label:'A4 B7',platform:'8E',startYear:2004,endYear:2008},factorySystems:{dpf:true},sources:['audiBpw','audiB7'],catalogue:{vdbNames:['B7'],dvxToken:'B7'}},
 {id:'volvo-v50-p1',make:'VOLVO',models:['V50'],selector:{modelOnly:true,typeCodes:['545']},generation:{key:'volvo:v50:P1',label:'V50 (P1)',platform:'P1'},sources:['volvoP1'],scope:'Base generation only; facelift unknown without build-date/model-year evidence.'},
 {id:'ford-m1da-review',make:'FORD',models:['FOCUS'],selector:{engineCodes:['M1DA']},status:'reference-only',sources:['fordFocus'],scope:'No generation inference from engine code; retain normal technical candidate checks.'},
]);
export function establishVehicleIdentity(vehicle={}){
 const make=norm(vehicle.manufacturer)==='VW'?'VOLKSWAGEN':norm(vehicle.manufacturer),model=catalogModelName(vehicle.model,vehicle.manufacturer),modelKey=norm(model),type=norm(vehicle.typeCode),variant=norm(vehicle.variantCode),code=norm(vehicle.engineCode);
 const evidence=[],issues=[],matchingVehicle=structuredClone(vehicle);let generation=null,phase=null;const factorySystems={};
 for(const rule of identityRegistry){
  if(rule.status==='reference-only'||rule.make!==make)continue;
  if(rule.selector.scopedModels&&!rule.models.map(norm).includes(modelKey))continue;
  if(rule.selector.hybridCategory&&(vehicle.hybridStatus!=='hybrid'||vehicle.hybridCategory!==rule.selector.hybridCategory))continue;
  if(rule.selector.firstRegisteredBefore){const d=registrationDates(vehicle.firstRegistered,vehicle.firstRegisteredNorway);if(!d.firstRegistered||d.registrationDateIssues.length||vehicle.registrationDateStatus==='conflicting'||vehicle.registrationDateStatus==='missing'||d.firstRegistered>=rule.selector.firstRegisteredBefore)continue;}
  const isBmw=!!rule.selector.variants,body=isBmw?(rule.selector.variants[variant]??(/^(?:F30|F31)$/.test(type)?type:null)):null;
  const hit=body||rule.selector.engineCodes?.includes(code)||rule.selector.modelOnly&&rule.models.map(norm).includes(modelKey)||rule.selector.typeCodes?.includes(type);
  if(!hit)continue;
  const modelMatches=isBmw?/^(?:3\d{2}[a-z]|3[- ]?series?|3[- ]?serie)$/i.test(model):rule.models.map(norm).includes(modelKey);
  if(!modelMatches){issues.push({code:'documented-type-model-conflict',rule:rule.id});continue;}
  if(isBmw&&bmwVariantModels[variant]&&/^3\d{2}[A-Z]$/.test(modelKey)&&modelKey!==bmwVariantModels[variant]){issues.push({code:'documented-variant-model-conflict',rule:rule.id});continue;}
  if(rule.expected){const e=rule.expected,fuel=String(vehicle.fuel??'').toLowerCase(),power=vehicle.engineKw??(vehicle.powerHk>0?vehicle.powerHk/KW_TO_HK:null);
   const conflict=vehicle.fuel&&!fuel.includes(e.fuel)||power!=null&&Math.abs(power-e.powerKw)>1||vehicle.engineCc!=null&&Math.abs(vehicle.engineCc-e.capacityCc)>e.capacityTolerance||type&&e.typeCodesWhenPresent&&!e.typeCodesWhenPresent.includes(type);
   if(conflict){issues.push({code:'documented-engine-configuration-conflict',rule:rule.id});continue;}
  }
  const g=body?{key:'bmw:3:'+body,label:'BMW 3-serie '+body,platform:body,startYear:body==='F30'?2011:body==='F31'?2012:2013}:rule.generation;
  if(generation&&generation.key!==g.key){issues.push({code:'conflicting-documented-generations',rule:rule.id});continue;}
  generation={...g,ruleId:rule.id};evidence.push({ruleId:rule.id,sources:rule.sources});
  for(const [name,value]of Object.entries(rule.factorySystems??{})){
   factorySystems[name]={value,scope:'original-factory-configuration',sources:rule.sources,currentPhysicalCondition:'unknown'};
   if(typeof vehicle.systems?.[name]==='boolean'&&vehicle.systems[name]!==value)issues.push({code:'factory-system-configuration-conflict',system:name,rule:rule.id});
   else matchingVehicle.systems={...matchingVehicle.systems,[name]:value};
  }
 }
 const dates=registrationDates(vehicle.firstRegistered,vehicle.firstRegisteredNorway);
 if(dates.registrationDateIssues.length||vehicle.registrationDateStatus==='conflicting')issues.push({code:'conflicting-registration-dates'});
 const first=issues.some(i=>i.code==='conflicting-registration-dates')||vehicle.registrationDateStatus==='missing'?null:dates.firstRegistered;
 if(first&&generation?.startYear&&Number(first.slice(0,4))+1<generation.startYear)issues.push({code:'registered-before-documented-generation',rule:generation.ruleId});
 if(generation&&make==='BMW'&&['F30','F31'].includes(generation.platform)&&first&&first<'2015-01-01'){
  phase={key:'before-2015-update',label:'Før 2015-oppdateringa',confidence:'documented-conservative-bound',source:'bmw2015',notBeforeUpdatedVariant:'2015-01-01'};
  evidence.push({ruleId:'bmw-pre-2015-update',sources:['bmw2015'],basis:'First registration is before the calendar year of the documented update. Later registration never excludes the older car.'});
 }
 const engine={code:vehicle.engineCode??null,fuel:vehicle.fuel??null,capacityCc:vehicle.engineCc??null,powerKw:vehicle.engineKw??null,powerHk:vehicle.powerHk??null,gearbox:vehicle.gearbox??null,basis:'registered-technical-fields'};
 const registeredEngine=!!(engine.code&&engine.fuel&&engine.capacityCc&&(engine.powerKw||engine.powerHk));
 const baseVehicle=confirmedBaseVehicle(vehicle);
 if(baseVehicle){Object.assign(matchingVehicle,baseMatchingVehicle(vehicle));delete matchingVehicle.baseVehicle;evidence.push({ruleId:baseVehicle.status==='customer-confirmed'?'customer-confirmed-base-vehicle':'documented-base-vehicle',basis:baseVehicle.basis,sources:baseVehicle.sources??[],rules:baseVehicle.ruleIds??[]});}
 return {baseVehicle,version:1,status:issues.length?'conflicting':generation&&registeredEngine?'identified':'partial',make:vehicle.manufacturer??null,model: model||null,generation,phase,engine,factorySystems,evidence,issues,matchingVehicle};
}
export const generationIntroductionBounds=Object.freeze([
 {id:'audi-a4-b7-introduction',make:'AUDI',modelFamily:'A4',catalogueToken:'B7',notBeforeYear:2004,source:'audiB7Launch'},
]);
export function documentedGenerationCompatibility(g,vehicle,source='vdb'){
 const identity=establishVehicleIdentity(vehicle);if(identity.issues.length)return {status:'conflict',identity};
 // A documented introduction boundary is stronger than an approximate catalogue
 // start-year allowance, but never identifies an older generation on its own.
 const first=registrationDates(vehicle.firstRegistered,vehicle.firstRegisteredNorway);
 if(first.firstRegistered&&!first.registrationDateIssues.length&&vehicle.registrationDateStatus!=='missing')for(const bound of generationIntroductionBounds){
  const family=bound.modelFamily.replace(/([a-z])(?=\d)/gi,'$1\\s*');
  if(norm(vehicle.manufacturer)===bound.make&&new RegExp('^'+family+'(?=\\s|$)','i').test(catalogModelName(vehicle.model,vehicle.manufacturer))&&String(g.name??'').toUpperCase().split(/[^A-Z0-9]+/).includes(bound.catalogueToken)&&Number(first.firstRegistered.slice(0,4))<bound.notBeforeYear)return {status:'conflict',identity,evidenceSource:bound.source};
 }
 if(norm(vehicle.manufacturer)==='BMW'&&/^1\d{2}[A-Z]$/.test(norm(catalogModelName(vehicle.model,vehicle.manufacturer)))&&/\bF2(?:0|1|x)\b/i.test(g.name??'')&&first.firstRegistered&&vehicle.registrationDateStatus!=='missing'&&!first.registrationDateIssues.length&&first.firstRegistered<'2011-01-01')return {status:'conflict',identity,evidenceSource:'bmwF20Start'};
 const rule=identityRegistry.find(r=>r.id===identity.generation?.ruleId),name=String(g.name??'');
 if(!rule)return {status:'unknown',identity};
 if(rule.catalogue){const c=rule.catalogue;
  if(source==='dvx'&&c.dvxPlatformTokens){const tokens=name.toUpperCase().split(/[^A-Z0-9]+/);return {status:c.dvxPlatformTokens.some(t=>tokens.includes(t))?'match':tokens.some(t=>/^[WS]\d{3}$/.test(t))?'conflict':'unknown',identity};}
  if(source==='dvx'&&c.dvxPeriodWithin){
   // A reviewed physical identity constrains supplier period buckets, not the
   // other way round. Unknown/open/malformed periods provide no confirmation.
   const start=Number(g.year),end=Number(g.yearend),known=Number.isInteger(start)&&start>0&&Number.isInteger(end)&&end>=start;
   return {status:known?start>=c.dvxPeriodWithin.startYear&&end<=c.dvxPeriodWithin.endYear?'match':'conflict':'unknown',identity};
  }
  if(source==='dvx'&&c.dvxStart){const known=g.year!=null&&g.yearend!=null;return {status:known?g.year===c.dvxStart&&g.yearend===c.dvxEnd?'match':'conflict':'unknown',identity};}
  if(source==='dvx'&&c.dvxToken)return {status:new RegExp('\\b'+c.dvxToken+'\\b','i').test(name)?'match':/\bB[5-9]\b/i.test(name)?'conflict':'unknown',identity};
  if(source==='dvx'&&c.dvxNamePrefix)return {status:name===c.dvxNamePrefix||name.startsWith(c.dvxNamePrefix+' ')?'match':/^Golf \d\b/i.test(name)?'conflict':'unknown',identity};
  if(source==='vdb'&&c.vdbNames)return {status:c.vdbNames.some(n=>n.toUpperCase()===name.trim().toUpperCase())?'match':/^(?:[IVX]+|B[5-9]|[WS]\d{3})(?:\s+(?:FL|LCI))?$/i.test(name.trim())?'conflict':'unknown',identity};
 }
 if(identity.phase&&/\b(?:LCI|FL)\b/i.test(name))return {status:'conflict',identity};
 return {status:'unknown',identity};
}
