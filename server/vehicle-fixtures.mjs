// Marked local fixtures: synthetic scenarios and anonymous technical replays.
// No registration, VIN or owner fields. Only local test runners use these.
import motorhomeProfiles from '../test/fixtures/motorhome-batch-20-profiles.json' with {type:'json'};
import mercedesE280Profile from '../test/fixtures/mercedes-e280-cdi-anonymized.json' with {type:'json'};
import mercedesE220Profile from '../test/fixtures/mercedes-e220-bluetec-svv-anonymized.json' with {type:'json'};
import bmw525dProfile from '../test/fixtures/bmw-525d-svv-anonymized.json' with {type:'json'};
export function makeSvvFixture() {
  return { godkjenning: { forstegangsGodkjenning: { forstegangRegistrertDato: '2014-05-01' },
    tekniskGodkjenning: { tekniskeData: {
      generelt: { merke: [{ merke: 'Audi' }], handelsbetegnelse: ['A3'], tekniskKode: { kodeVerdi: 'M1' } },
      motorOgDrivverk: { hybridElektriskKjoretoy: false, girkassetype: { kodeNavn: 'Manuell' },
        motor: [{ motorKode: 'DEMO-CODE', slagvolum: 1598, drivstoff: [{ maksNettoEffekt: 77, drivstoffKode: { kodeBeskrivelse: 'Diesel' } }] }] },
    } } } };
}
// Regression shape: technical fields only; no registration, VIN or owner data.
export function makeNonHybridSvvFixture() {
  const vehicle = makeSvvFixture();
  vehicle.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato = '2007-07-04';
  const data = vehicle.godkjenning.tekniskGodkjenning.tekniskeData;
  data.generelt.merke = [{ merke: 'Volvo' }];
  data.generelt.handelsbetegnelse = ['V50'];
  data.motorOgDrivverk.hybridKategori = { kodeVerdi: 'INGEN', kodeNavn: 'Ingen', kodeBeskrivelse: 'Ingen', kodeTypeId: 'HYBRIDKATEGORI' };
  data.motorOgDrivverk.motor = [{ motorKode: 'D4204T', slagvolum: 1997,
    drivstoff: [{ maksNettoEffekt: 100, drivstoffKode: { kodeBeskrivelse: 'Diesel' } }] }];
  return vehicle;
}
export const demoScenarios = [
  {id:'mercedes-e280-cdi',name:'Mercedes E280 CDI4MATIC – anonymisert registerprofil, rekonstruert teststruktur'},
  {id:'mercedes-e220-bluetec',name:'Mercedes E220 BlueTEC – anonymisert registerprofil, rekonstruert teststruktur'},
  {id:'bmw-525d',name:'BMW 525d – anonymisert registerprofil, rekonstruert teststruktur'},
  ...motorhomeProfiles.cases.map(({id,vehicle})=>({id:'batch-'+id,name:'Bubiltest '+id.slice(-2)+' – '+vehicle.manufacturer+' '+vehicle.model+' (anonymisert gjenspeling)'})),
  { id: 'tractor-n-series', name: 'Traktor N-serie – anonymisert gjenspeling, syntetisk kW-grunnlag' },
  { id: 'truck-r-series', name: 'Lastebil R-serie – anonymisert gjenspeling, syntetisk kW-grunnlag' },
  { id: 'truck-full-chassis', name: 'Lastebil med full chassiskode – anonymisert teknisk gjenspeling' },
  { id: 'motorhome-rapido', name: 'Rapido – anonymisert 177 HK / Euro 6-profil, grunnbilval' },
  { id: 'motorhome-knaus', name: 'Knaus – anonymisert 160 HK-profil, grunnbilval' },
  { id: 'truck-man-tgx', name: 'MAN TGX – anonymisert 510 HK-profil, manglande motordekning' },
  { id: 'truck-volvo-fh', name: 'Volvo FH – anonymisert teknisk gjenspeling, manglande katalogmotor' },
  { id: 'sprinter-519', name: 'Sprinter 519 – anonymisert 2012-profil, fast katalogkategori' },
  { id: 'sprinter-516', name: 'Sprinter 516 – anonymisert 2010-profil, automatisk treff og tilval' },
  { id: 'sprinter-2l', name: 'Sprinter 2,0 – anonymisert profil, manglande katalogdekning' },
  { id: 'sprinter-doka', name: 'Sprinter Doka – anonymisert profil, eldre motorvariant' },
  { id: 'truck-mercedes-reference', name: 'Mercedes lastebil – anonymisert gjenspeling av modellretting' },
  { id: 'audi-b5', name: 'Audi A4 B5 – teknisk gjenspeling utan regnr, syntetisk SVV-format' },
  { id: 'audi-b6', name: 'Audi A4 B6 – teknisk gjenspeling utan regnr, syntetisk SVV-format' },
  { id: 'audi-a4', name: 'Audi A4 – anonymisert namne- og modelltest' },
  { id: 'audi', name: 'Audi A3 – syntetiske, komplette data' },
  { id: 'non-hybrid', name: 'Volvo V50 – test av hybridkategori Ingen' },
  { id: 'bmw', name: 'BMW 318d – anonymisert struktur, fleire utgåver' },
  { id: 'skoda-superb', name: 'Skoda Superb – oppgitte tekniske testdata, ikkje nytt SVV-oppslag' },
  { id: 'ford-focus', name: 'Ford Focus – oppgitte tekniske testdata' },
  { id: 'ambiguous', name: 'Audi A3 – manglande motorkode / fleire alternativ' },
  { id: 'hybrid', name: 'Hybrid med fleire motorar' },
  { id: 'conflict', name: 'Motstridande merke og modell' },
  { id: 'unknown', name: 'Ukjent bil i katalogen' },
  { id: 'missing', name: 'Manglande tekniske data' },
];
export function demoVehicle(scenario) {
  if (!demoScenarios.some(row => row.id === scenario)) return null;
  if(['bmw-525d','mercedes-e220-bluetec','mercedes-e280-cdi'].includes(scenario)){
    const v=(scenario==='bmw-525d'?bmw525dProfile:scenario==='mercedes-e280-cdi'?mercedesE280Profile:mercedesE220Profile).vehicle;return {forstegangsregistrering:{registrertForstegangNorgeDato:v.firstRegisteredNorway},godkjenning:{forstegangsGodkjenning:{forstegangRegistrertDato:v.firstRegistered},tekniskGodkjenning:{kjoretoyklassifisering:{efTypegodkjenning:{variant:v.variantCode,versjon:v.versionCode}},tekniskeData:{generelt:{merke:[{merke:v.manufacturer}],handelsbetegnelse:[v.model],typebetegnelse:v.typeCode,tekniskKode:{kodeVerdi:v.vehicleCategory}},miljodata:{euroKlasse:{kodeVerdi:v.emissionCode,kodeNavn:v.emissionClass}},motorOgDrivverk:{hybridElektriskKjoretoy:false,hybridKategori:{kodeVerdi:'INGEN'},girkassetype:{kodeNavn:v.gearbox},motor:[{slagvolum:v.engineCc,motorKode:v.engineCode,drivstoff:[{maksNettoEffekt:v.engineKw,drivstoffKode:{kodeBeskrivelse:v.fuel}}]}]}}}}};
  }
  const replay=motorhomeProfiles.cases.find(row=>'batch-'+row.id===scenario);
  if(replay){const v=replay.vehicle;return {forstegangsregistrering:{registrertForstegangNorgeDato:v.firstRegisteredNorway},godkjenning:{forstegangsGodkjenning:{forstegangRegistrertDato:v.firstRegistered},tekniskGodkjenning:{kjoretoyklassifisering:{efTypegodkjenning:{variant:v.variantCode,versjon:v.versionCode}},tekniskeData:{generelt:{merke:[{merke:v.manufacturer}],handelsbetegnelse:[v.model],typebetegnelse:v.typeCode,tekniskKode:{kodeVerdi:v.vehicleCategory}},miljodata:{euroKlasse:{kodeVerdi:v.emissionCode,kodeNavn:v.emissionClass}},motorOgDrivverk:{hybridElektriskKjoretoy:false,hybridKategori:{kodeVerdi:'INGEN'},girkassetype:{kodeNavn:v.gearbox},motor:[{slagvolum:v.engineCc,motorKode:v.engineCode,drivstoff:[{maksNettoEffekt:v.engineKw,drivstoffKode:{kodeBeskrivelse:v.fuel}}]}]}}}}};}
  if (scenario === 'non-hybrid') return makeNonHybridSvvFixture();
  const value = makeSvvFixture();
  const data = value.godkjenning.tekniskGodkjenning.tekniskeData;
  if(['tractor-n-series','truck-r-series'].includes(scenario)){
    const tractor=scenario==='tractor-n-series';
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato=tractor?'2025-09-04':'2014-06-06';
    data.generelt.merke=[{merke:tractor?'VALTRA':'SCANIA'}];data.generelt.handelsbetegnelse=[tractor?'N155E':'R 500'];
    data.generelt.typebetegnelse=tractor?'N SERIES':'R500 LB6X2';data.generelt.tekniskKode={kodeVerdi:tractor?'T1':'N3'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Automat'};
    // Explicit test reconstruction from rounded stored HK, not original SVV kW.
    data.motorOgDrivverk.motor=[{motorKode:tractor?null:'DC1619L01',slagvolum:tractor?4910:15607,drivstoff:[{maksNettoEffekt:(tractor?175:500)/1.35962,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
    if(tractor)value.godkjenning.tekniskGodkjenning.kjoretoyklassifisering={efTypegodkjenning:{variant:'N154ES',versjon:'N154ES5PS-5-1469'}};
  }
  if(scenario==='truck-full-chassis'){
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2015-08-24';
    data.generelt.merke=[{merke:'SCANIA'}];data.generelt.handelsbetegnelse=['R 580 LB6X4HNB'];data.generelt.tekniskKode={kodeVerdi:'N3'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Manuell'};
    data.motorOgDrivverk.motor=[{motorKode:'DC16102L01',slagvolum:16353,drivstoff:[{maksNettoEffekt:427,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if(['motorhome-rapido','motorhome-knaus'].includes(scenario)){
    const rapido=scenario==='motorhome-rapido';
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato=rapido?'2017-04-27':'2021-11-02';
    data.generelt.merke=[{merke:rapido?'RAPIDO':'KNAUS'}];data.generelt.handelsbetegnelse=[rapido?'Rapido':'R12 Live 1 700 MEG'];data.generelt.typebetegnelse=rapido?'FA5':'K250/5';data.generelt.tekniskKode={kodeVerdi:'M1'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Automat'};
    data.motorOgDrivverk.motor=[{motorKode:rapido?null:'F1AGL4112',slagvolum:2287,drivstoff:[{maksNettoEffekt:rapido?130:160/1.35962,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
    if(rapido)data.miljodata={euroKlasse:{kodeVerdi:'6L',kodeNavn:'Euro 6L - EF 715/2007'}};
  }
  if(scenario==='truck-man-tgx'){

    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2020-09-29';
    data.generelt.merke=[{merke:'MAN'}];data.generelt.handelsbetegnelse=['TGX'];data.generelt.typebetegnelse='28.510 6X2=2 BL';data.generelt.tekniskKode={kodeVerdi:'N3'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Automat'};
    // Test reconstruction from stored rounded HK; original raw kW unavailable.
    data.motorOgDrivverk.motor=[{slagvolum:12419,drivstoff:[{maksNettoEffekt:510/1.35962,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if(scenario==='truck-volvo-fh'){

    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2015-12-11';
    data.generelt.merke=[{merke:'VOLVO'}];data.generelt.handelsbetegnelse=['FH540'];data.generelt.typebetegnelse='FH62TR';data.generelt.tekniskKode={kodeVerdi:'N3'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Automat'};
    data.motorOgDrivverk.motor=[{motorKode:'D13K540',slagvolum:12777,drivstoff:[{maksNettoEffekt:405,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if(scenario==='sprinter-519'){
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2012-08-10';
    data.generelt.merke=[{merke:'MERCEDES-BENZ'}];data.generelt.handelsbetegnelse=['Sprinter 519/37 S1'];data.generelt.typebetegnelse='906BA50';data.generelt.tekniskKode={kodeVerdi:'N2'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Automat'};
    // Marked test reconstruction of rounded HK retained in the local journal.
    data.motorOgDrivverk.motor=[{slagvolum:2987,drivstoff:[{maksNettoEffekt:190/1.35962,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if(scenario==='sprinter-516'){

    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2010-06-25';
    data.generelt.merke=[{merke:'MERCEDES-BENZ'}];data.generelt.handelsbetegnelse=['SPRINTER 516 CDI'];data.generelt.typebetegnelse='WDB906657';data.generelt.tekniskKode={kodeVerdi:'N2'};
    delete data.motorOgDrivverk.girkassetype;
    // Explicit reconstruction of stored rounded HK; original raw kW unavailable.
    data.motorOgDrivverk.motor=[{slagvolum:2143,drivstoff:[{maksNettoEffekt:163/1.35962,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if(['sprinter-2l','sprinter-doka'].includes(scenario)){
    const doka=scenario==='sprinter-doka';
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato=doka?'2011-12-21':'2024-11-29';
    data.generelt.merke=[{merke:'MERCEDES-BENZ'}];data.generelt.handelsbetegnelse=[doka?'519/43 Doka S1':'Sprinter'];
    data.generelt.typebetegnelse=doka?'WDB9062551':'906BB50';data.generelt.tekniskKode={kodeVerdi:doka?'N2G':'N2'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Automat'};
    // 2-litre raw kW was not retained: synthetic reconstruction of stored 190 HK.
    data.motorOgDrivverk.motor=[{motorKode:doka?null:'654',slagvolum:doka?2987:1950,drivstoff:[{maksNettoEffekt:doka?140:190/1.35962,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if(scenario==='truck-mercedes-reference'){

    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2016-08-15';
    data.generelt.merke=[{merke:'MERCEDES-BENZ'}];data.generelt.handelsbetegnelse=['2563L'];data.generelt.typebetegnelse='6x2 963';data.generelt.tekniskKode={kodeVerdi:'N3'};
    data.motorOgDrivverk.girkassetype={kodeNavn:'Automat'};
    data.motorOgDrivverk.motor=[{motorKode:'OM473LA.6-4',slagvolum:15569,drivstoff:[{maksNettoEffekt:460,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if(['audi-b5','audi-b6'].includes(scenario)){
    const b6=scenario==='audi-b6';
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato=b6?'2003-11-07':'2000-09-22';
    value.forstegangsregistrering={registrertForstegangNorgeDato:b6?'2003-11-07':'2004-03-03'};
    data.generelt.merke=[{merke:'AUDI'}];data.generelt.handelsbetegnelse=[b6?'A4 S4':'A 4 QUATRO-1,8T'];data.generelt.typebetegnelse=b6?'8E':'B5';
    delete data.motorOgDrivverk.girkassetype;
    // Synthetic kW equivalent of the stored 150 HK display value, not a saved
    // raw SVV response. The production match uses the actual current response.
    data.motorOgDrivverk.motor=[{slagvolum:1781,drivstoff:[{maksNettoEffekt:b6?120:110,drivstoffKode:{kodeBeskrivelse:'Bensin'}}]}];
  }
  if(scenario==='audi-a4'){
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2007-07-20';
    data.generelt.merke=[{merke:'AUDI'}];data.generelt.handelsbetegnelse=['AUDI A4'];
    data.motorOgDrivverk.motor=[{motorKode:'BPW',slagvolum:1968,drivstoff:[{maksNettoEffekt:103,drivstoffKode:{kodeBeskrivelse:'Diesel'}}]}];
  }
  if (scenario === 'bmw') {
    value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato='2014-10-06';
    data.generelt.merke = [{ merke: 'BMW' }]; data.generelt.handelsbetegnelse = ['318d'];
    data.motorOgDrivverk.girkassetype = { kodeNavn: 'Automat' };
    data.motorOgDrivverk.motor = [{ motorKode: 'N47D20C', slagvolum: 1995,
      drivstoff: [{ maksNettoEffekt: 100, drivstoffKode: { kodeBeskrivelse: 'Diesel' } }] }];
    data.generelt.typebetegnelse='3K';value.godkjenning.tekniskGodkjenning.kjoretoyklassifisering={efTypegodkjenning:{variant:'3K11',versjon:'5A25R000'}};
  }
  if(['skoda-superb','ford-focus'].includes(scenario)){
    const skoda=scenario==='skoda-superb';value.godkjenning.forstegangsGodkjenning.forstegangRegistrertDato=skoda?'2013-12-16':'2012-09-24';
    data.generelt.merke=[{merke:skoda?'SKODA':'FORD'}];data.generelt.handelsbetegnelse=[skoda?'SUPERB':'FOCUS'];
    data.motorOgDrivverk.girkassetype={kodeNavn:skoda?'Automat':'Manuell'};
    data.motorOgDrivverk.motor=[{motorKode:skoda?'CFG':'M1DA',slagvolum:skoda?1968:998,drivstoff:[{maksNettoEffekt:skoda?125:92,drivstoffKode:{kodeBeskrivelse:skoda?'Diesel':'Bensin'}}]}];
    if(skoda){data.generelt.typebetegnelse='3T';value.forstegangsregistrering={registrertForstegangNorgeDato:'2013-12-16'};value.godkjenning.tekniskGodkjenning.kjoretoyklassifisering={efTypegodkjenning:{variant:'ACCFGBX01',versjon:'NFD6FD62E0187'}};}
  }
  if (scenario === 'ambiguous') delete data.motorOgDrivverk.motor[0].motorKode;
  if (scenario === 'hybrid') {
    data.motorOgDrivverk.hybridElektriskKjoretoy = true;
    data.motorOgDrivverk.motor.push({ drivstoff: [{ drivstoffKode: { kodeBeskrivelse: 'Elektrisk' } }] });
  }
  if (scenario === 'conflict') data.generelt.merke.push({ merke: 'Eit anna testmerke' });
  if (scenario === 'unknown') { data.generelt.merke = [{ merke: 'Ukjent testmerke' }]; data.generelt.handelsbetegnelse = ['Ukjent testmodell']; }
  if (scenario === 'missing') { data.motorOgDrivverk = {}; data.generelt.handelsbetegnelse = []; }
  return value;
}
export const catalogFixtures = {
  'types/': [{ id: 1, name: 'Cars & LCV' }, { id: 2, name: 'Trucks & Buses' }, { id: 3, name: 'Agriculture' }, { id: 4, name: 'Marine' }, { id: 5, name: 'Motorcycles & ATVs' }],
  'manufacturers/1': [{ id: 1088, name: 'Audi' }, { id: 2001, name: 'Testmerke' }],
  'manufacturers/2': [],
  'manufacturers/3': [],
  'manufacturers/4': [],
  'manufacturers/5': [],
  'models/1088': [{ id: 138, name: 'A3' }, { id: 139, name: 'A4' }],
  'models/2001': [],
  'generations/138': [{ id: 167, name: '8V', year: 2012, yearend: 2016 }, { id: 168, name: '8V – overlappande testperiode', year: 2014, yearend: 2018 }],
  'generations/139': [],
  'engines/167': [{ id: 9067, name: '1.6 TDI 105hp 250Nm', engine_code: 'DEMO-CODE', type: 'Turbo Diesel', capacity: 1.6, power: 105, torque: 250 },
    { id: 9068, name: '1.6 TDI – alternativ motor', engine_code: 'OTHER-CODE', type: 'Turbo Diesel', capacity: 1.6, power: 105 }],
  'engines/168': [{ id: 9067, name: '1.6 TDI 105hp 250Nm', engine_code: 'OTHER-CODE', type: 'Turbo Diesel' }],
  'engines/view/9067': { id: 9067, name: '1.6 TDI 105hp 250Nm', power: 105, torque: 250, remap_stages: [
    { stage_no: 1, power: 142, torque: 308, modifications: '' },
    { stage_no: 2, power: 150, torque: 340, modifications: 'TESTKRAV: oppgradert intercooler og individuell kontroll.' },
  ] },
  'engines/view/9068': { id: 9068, name: 'Alternativ motor med manglande opplysningar', remap_stages: [{ stage_no: 1, power: null, torque: null }] },
};
export async function fixtureFetch(url, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const route = new URL(url).pathname.replace(/^\/vdb\//, '');
  return Object.hasOwn(catalogFixtures, route) ? Response.json(catalogFixtures[route]) : Response.json({}, { status: 404 });
}
