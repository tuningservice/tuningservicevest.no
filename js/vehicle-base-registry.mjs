// Builder-model/chassis evidence only. Never contains registration numbers,
// tuning values, VIN decoding or a majority/popularity default.
export const baseVehicleSources=Object.freeze({
 hymerPremium:{publisher:'HYMER',url:'https://docs.campingcar-infos.com/docs/Hymer/Hymer%202016%20Informations.pdf',pages:[19,20],checked:'2026-11-08',fact:'B-Class PremiumLine incl.668/678/704/708: Fiat AL-KO Ducato Maxi. Base family only; engine emissions/calibration checked separately.'},
 adriaCoral:{publisher:'Adria',url:'https://lp.adria.co.uk/pdf/motorhome_brochure_pricelist.pdf',pages:[84],checked:'2026-11-08',fact:'2019 Coral S670 variants: Fiat Ducato 2.3 Euro6. Other chassis outside this technical signature are not inferred.'},
 euraIntegra:{publisher:'Eura Mobil',url:'https://www.camperonline.it/magazine/cataloghi/EuraMobil-dati2011.pdf',pages:[3],checked:'2026-11-08',fact:'2011 Integra Style IS560/650/660/670/700/710: Fiat Ducato; engine option is not a stock-power correction.'},
 burstner2010:{publisher:'Bürstner',url:'https://www.yumpu.com/de/document/view/7038017/bu-td-a-rm-2010-4178-cover-masterindd-buerstnercom/34',checked:'2026-11-08',fact:'Manufacturer 2010 technical table: Elegance i705/726/729/730/810/821 uses Fiat Ducato/Maxi; 3.0 115 kW/157 PS. Archived primary document, no tuning values.'},
 dethleffsMagic:{publisher:'Dethleffs',url:'https://docs.campingcar-infos.com/docs/Dethleffs/Dethleffs%202013%20CaracteristiquesTechniques.pdf',checked:'2026-11-08',fact:'Magic Edition chassis table specifies Fiat Ducato; matching still requires registered diesel displacement and no contradictory engine family.'},
 euraContura:{publisher:'Eura Mobil',url:'https://acuestas.com/uploads/2021/euramobil-technic-and-prices-2022-en.pdf',pages:[38,42],checked:'2026-11-08',fact:'2021/22 Contura Mercedes C716/C766 variants use MB Sprinter; table and 170 HP option. Manufacturer-authored archived brochure.'},
 carthago:{publisher:'Carthago',url:'https://carthago-presseportal.de/fileadmin/user_upload/Texte/englisch/EN_Carthago_e-line_s-plus_CSD18.pdf',checked:'2026-11-08',fact:'24 August 2018: chic e-line is Ducato/AL-KO; chic s-plus is Iveco Daily. Model family evidence, not an engine calibration identity.'},
 morelo:{publisher:'MORELO',url:'https://www.morelo.ch/wp-content/uploads/sites/2/2021/05/morelo_preisliste_2022_DE.pdf',pages:[38,39,43,46],checked:'2026-11-08',fact:'Palace (without Liner) on Daily; Palace Liner offers Eurocargo or Atego. 99 GSB Atego 7.7 l/220 kW versus Eurocargo 6.7 l/205 kW. Builder source table, not registered category.'},
 hymerLiner:{publisher:'HYMER',url:'https://docs.campingcar-infos.com/docs/Hymer/Hymer%202010%20Liner%20Informations.pdf',pages:[1],checked:'2026-11-08',fact:'Liner 809/829/839: Iveco Daily 65C18, nominal 3.0 l,130 kW. Manufacturer-authored archived brochure.'},
 hymerXl:{publisher:'HYMER',url:'https://docs.campingcar-infos.com/docs/Hymer/Hymer%202011%20Informations.pdf',pages:[47],checked:'2026-11-08',fact:'B-Klasse XL 709/779 uses Iveco 50 C14 CCS, 3.0 l; optional engines remain separate. Manufacturer-authored archived brochure.'},
 frankia:{publisher:'FRANKIA',url:'https://docs.campingcar-infos.com/docs/Frankia/Frankia%202019%20Platin.pdf',checked:'2026-11-08',fact:'Platin 2019: new Mercedes-Benz Sprinter 519, 2987 cc /140 kW. Manufacturer-authored archived brochure.'},
 hobbyFord:{publisher:'Hobby',url:'https://www.hobby-caravan.de/fileadmin/user_upload/kataloge_und_service/bedienungsanleitungen/RM_Ford_deu_11_Komplett_BS.pdf',pages:[138],checked:'2026-11-08',fact:'2011 Ford-based range lists T600 AK KM as Siesta on front-wheel-drive Ford Transit. Customer also confirmed Transit chassis in the submitted sample; no registration mapping is stored.'},
 rimorAdr:{publisher:'TÜV Nord / AS Air Suspension',url:'https://www.air-suspension-parts.de/media/AS-INFO/AS170311%20T%C3%9CV.pdf',pages:[3,5],checked:'2026-11-08',fact:'Certificate table lists ADR (Luano), Rimor among trade names, in Renault Master FWD column; parallel Movano cells are empty. Scope plus literal builder type and 2299 cc are required; M9T family alone cannot distinguish shared engines. User independently confirmed Renault in the audit sample.'},
});
const key=v=>String(v??'').toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
export const baseVehicleRules=Object.freeze([
 {id:'hymer-premium-ducato',builder:'HYMER',model:/^B(?:544|568|588|594|598|668|678|704|708)PL$/,cc:[2287],codes:/^F1A[A-Z0-9.*-]*$/,base:'fiat-ducato',sources:['hymerPremium']},
 {id:'adria-coral-ducato',builder:'ADRIA',model:/^CORAL(?:S)?(?:670)(?:SC|SL|DC|DL|SLT)$/,cc:[2287],codes:/^F1A[A-Z0-9.*-]*$/,base:'fiat-ducato',sources:['adriaCoral']},
 {id:'eura-integra-style-ducato',builder:'EURAMOBIL',model:/^IS(?:560|650|660|670|700|710)(?:LB|EB|HB|SB|QB)$/,cc:[2287,2998,2999],base:'fiat-ducato',sources:['euraIntegra']},
 {id:'burstner-elegance-old-ducato',builder:'BURSTNER',model:/^ELEGANCEI(?:705|726|729|730|810|821)(?:G)?$/,cc:[2286,2287,2998,2999],base:'fiat-ducato',sources:['burstner2010']},
 {id:'dethleffs-magic-ducato',builder:'DETHLEFFS',model:/^MAGICEDITIONT[0-9A-Z]+$/,cc:[2287],codes:/^F1A[A-Z0-9.*-]*$/,base:'fiat-ducato',sources:['dethleffsMagic']},
 {id:'eura-contura-mercedes',builder:'EURAMOBIL',model:/^CONTURA(?:C)?(?:716|766)(?:EB|EF|QB)$/,cc:[2143],codes:/^(?:OM)?651(?:[A-Z0-9.-]*)?$/,base:'mercedes-sprinter',sources:['euraContura']},
 {id:'carthago-eline-ducato',builder:'CARTHAGO',model:/^CHICELINE/,cc:[2287],codes:/^F1A[A-Z0-9.*-]*$/,base:'fiat-ducato',sources:['carthago']},
 {id:'carthago-splus-daily',builder:'CARTHAGO',model:/^CHICSPLUS/,cc:[2998],codes:/^F1C[A-Z0-9.*-]*$/,base:'iveco-daily',sources:['carthago']},
 {id:'morelo-palace-daily',builder:'MORELO',model:/^PALACE(?!LINER)/,cc:[2998],codes:/^F1C[A-Z0-9.*-]*$/,base:'iveco-daily',sources:['morelo']},
 {id:'morelo-palace-liner-atego',builder:'MORELO',model:/^PALACELINER/,cc:[7698],codes:/^OM936LA(?:[A-Z0-9.-]*)?$/,powerKw:220,base:'mercedes-atego',sources:['morelo']},
 {id:'hymer-liner-daily',builder:'HYMER',model:/^(?:HYMER)?LINER(?:809L?|829|839)$/,cc:[2998],powerKw:130,base:'iveco-daily',sources:['hymerLiner']},
 {id:'hymer-b-xl-daily',builder:'HYMER',model:/^(?:HYMERMOBILB|B)(?:709|779)?$/,type:/^(?:709|779)XL$/,cc:[2998],base:'iveco-daily',sources:['hymerXl']},
 {id:'frankia-platin-sprinter',builder:'FRANKIA',model:/^PLATIN(?:I[0-9A-Z]+)?$/,cc:[2987],codes:/^(?:OM)?642(?:[A-Z0-9.-]*)?$/,powerKw:140,base:'mercedes-sprinter',sources:['frankia']},
 {id:'hobby-t600-transit',builder:'HOBBY',model:/^T600AKKMC?$/,type:/^H2$/,cc:[2198],powerKw:103,base:'ford-transit',sources:['hobbyFord']},
 {id:'rimor-adr-master',builder:'RIMOR',model:/^ADR[0-9A-Z]+$/,type:/^ADR$/,cc:[2299],codes:/^M9T[A-Z0-9.-]*$/,base:'renault-master',sources:['rimorAdr']},
]);
export function documentedBaseEvidence(vehicle){
 if(!vehicle||vehicle.baseVehicle?.status==='unconfirmed')return null;
 const code=String(vehicle.engineCode??'').trim().toUpperCase(),fuel=String(vehicle.fuel??'');
 if(!/diesel/i.test(fuel)||!(vehicle.engineCc>0))return null;
 const rules=baseVehicleRules.filter(r=>key(vehicle.manufacturer)===r.builder&&r.model.test(key(vehicle.model))
  &&(!r.type||r.type.test(key(vehicle.typeCode)))&&r.cc.some(cc=>Math.abs(vehicle.engineCc-cc)<=3)
  &&(!r.codes||!code||r.codes.test(code))&&(!r.powerKw||vehicle.engineKw>0&&Math.abs(vehicle.engineKw-r.powerKw)<=0.5));
 if(!rules.length||new Set(rules.map(r=>r.base)).size!==1)return null;
 return {id:rules[0].base,status:'documented',basis:'documented-builder-model-and-technical-profile',ruleIds:rules.map(r=>r.id),sources:[...new Set(rules.flatMap(r=>r.sources))]};
}
