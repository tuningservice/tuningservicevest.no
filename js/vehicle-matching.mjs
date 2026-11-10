import {generationCompatibility,literalGenerationMatches} from './vehicle-generation-identity.mjs';
import { KW_TO_HK } from './vehicle-units.mjs';
import {catalogModelName,heavyModelDesignation,displacementModelGroupMatch,documentedCommercialModel} from './vehicle-identity.mjs';
import {generationChronology} from './vehicle-dates.mjs';
import {gearboxKind} from './vehicle-service-options.mjs';
import {establishVehicleIdentity} from './vehicle-identity-registry.mjs';
import {catalogTypeMatches,vehicleCategoryGroup,reviewedCatalogRouting} from './vehicle-category.mjs';
import {reviewedMechanicalCode} from './vehicle-engine-code.mjs';
import {referenceEngineCodes,referenceVariantConflict} from './vehicle-engine-reference.mjs';
const normalized = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const makeAlias=value=>({mercedesbenz:'mercedes',mercedesamg:'mercedes',ivecolcv:'iveco',vw:'volkswagen'}[normalized(value)]??normalized(value));
const makeName = value => {const aliases=String(value??'').split('/').map(makeAlias).filter(Boolean);return aliases.length&&new Set(aliases).size===1?aliases[0]:normalized(value);};

function modelNames(vehicle) {
  const cleanModel=catalogModelName(vehicle.model,vehicle.manufacturer);
  const names = [normalized(cleanModel),...cleanModel.split('/').map(normalized)];
  // Some register trade names list multiple complete model families, e.g.
  // "A4 S4". Keep all named families as candidates, then use technical data;
  // never treat the final badge as an authoritative engine identity.
  const families=cleanModel.split(/\s+/);
  if(families.length>=2&&families.length<=3&&families.every(v=>/^[A-Z]{1,3}\d{1,2}$/i.test(v)))names.push(...families.map(normalized));
  // Supplier guide 1.1: a three-digit BMW engine designation identifies its series.
  // This is a general brand rule, not a saved vehicle/registration mapping.
  if (makeName(vehicle.manufacturer) === 'bmw') {
    const designation = cleanModel.match(/^([1-8])[0-9]{2}[a-z]$/i);
    if (designation) names.push(normalized(designation[1] + '-series'),normalized(designation[1]+'-serie'));
    const series=cleanModel.match(/^([1-8])[- ]?(?:serie|series)$/i);
    if(series)names.push(normalized(series[1]+'-series'),normalized(series[1]+'-serie'));
  }
  if (makeName(vehicle.manufacturer) === 'mercedes') {
    const designation = cleanModel.match(/^([A-Z]{1,3})\s*[0-9]{2,3}(?:\s*(?:CDI|CGI|BLUETEC|BLUEEFFICIENCY|AMG|4MATIC\+?|[de]))*$/i);
    if (designation) names.push(normalized(designation[1]),normalized(designation[1] + '-Class'),normalized(designation[1]+'-klasse'));
    if(/^(?:AMG\s+)?GT(?:\s+(?:S|C|R|BLACK SERIES))?$/i.test(cleanModel))names.push('gt','amggtcoupe','amggtroadster');
  }
  return names.filter(Boolean);
}
function catalogueModelAlias(alias,vehicle){
 const clean=catalogModelName(vehicle.model,vehicle.manufacturer),aliasName=catalogModelName(alias,vehicle.manufacturer).trim();
 // Explicit supplier grouping, not a body-style or engine equivalence:
 // E (+ Coupé) includes the E family; A - A Berline includes the A family.
 if(makeName(vehicle.manufacturer)==='mercedes'){
  const family=aliasName.match(/^([A-Z]{1,3})\s*\(\+\s*Coup[eé]\)$/i)?.[1]??aliasName.match(/^([A-Z])\s*-\s*\1\s+Berline$/i)?.[1];
  if(family&&modelNames(vehicle).includes(normalized(family)))return true;
 }
 // IVECO's 2009 manufacturer release describes EcoDaily as the development
 // of Daily, with Euro4 Daily still sold alongside it. Explore either family
 // label, then keep all engine/emission conflicts; never rewrite a result.
 if(makeName(vehicle.manufacturer)==='iveco'&&/^(?:eco)?daily$/i.test(clean)&&/^(?:eco)?daily$/i.test(aliasName))return true;
 if(displacementModelGroupMatch(aliasName,vehicle))return true;
 // A heavy/agricultural catalogue may group engine badges under a literal
 // letter series: e.g. R 500 -> R-series, N155E -> N Series. Compare the
 // complete family token, never a substring or a guessed manufacturer ID.
 const group=vehicleCategoryGroup(vehicle.vehicleCategory);
 const family=['heavy','agriculture'].includes(group)?aliasName.match(/^([A-Z]{1,5})[\s-]+(?:series|serie)$/i)?.[1]:null;
 if(family){const designation=heavyModelDesignation(vehicle);if(designation&&designation.family===family.toUpperCase())return true;}
 // A catalogue may label BMW X/Z model families with "-series" as well.
 // Remove that exact family suffix, not arbitrary words or engine badges.
 const name=makeName(vehicle.manufacturer)==='bmw'?aliasName.replace(/^([XZ][1-9])[- ](?:series|serie)$/i,'$1'):aliasName;
 if(normalized(clean)===normalized(name))return true;
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+').replace(/([a-z])(?=\d)/gi,'$1\\s*');
 // Only known body/powertrain qualifiers may follow an exact catalogue model.
 // The full original trade name remains in the registered context.
 const tail=clean.match(new RegExp('^'+escaped+'(?=\\s|-|$)(.*)$','i'))?.[1];
 // Register trade names may space a model's letter/digit family (A 4, X 3)
 // and hyphenate known engine/body qualifiers. These identify the model only;
 // e.g. the spelling Quatro never establishes drivetrain compatibility.
 if(tail!==undefined&&/^(?:[\s-]+(?:AVANT|TOURING|ESTATE|KOMBI|WAGON|SEDAN|SPORTBACK|TD|TDI|TSI|TFSI|CDI|CGI|V\d|TDV\d|Q|QUATT?RO|4MATIC\+?|4MOTION|XDRIVE|AWD|AMG|\d+[.,]\d+(?:D|I|T|TD|TDI|CDI|TFSI|TSI|HDI|DCI)|\d+(?:[.,]\d+)?))*$/i.test(tail))return true;
 // A stated series number must also occur explicitly in the catalogue alias;
 // e.g. Land Cruiser (150 Series) cannot select J120 or J200.
 const series=clean.match(/^(.*?)\s*\((\d{2,3})\s+SERIES\)$/i);
 return !!(series&&normalized(name).startsWith(normalized(series[1]))&&new RegExp('\\b[A-Z]?'+series[2]+'\\b','i').test(name));
}

// Candidate evidence only. The customer journey separately decides when evidence is sufficient.
export function suggestCandidates(level, rows, vehicle) {
  if (!vehicle || vehicle.requiresManual) return { ids: [], reason: 'manual-review' };
  let matches = [];
  if (level === 'types') {
    matches = rows.filter(row => catalogTypeMatches(row.name,vehicle.vehicleCategory,vehicle));
  } else if (level === 'manufacturers' && vehicle.manufacturer) {
    matches = rows.filter(row => makeName(row.name) === makeName(vehicle.manufacturer));
  } else if (level === 'models' && vehicle.model) {
    // Catalog rows may group distinct model names, e.g. "S40 / V50".
    // Match a complete slash-separated name, never a substring or nearest model.
    const targets = modelNames(vehicle);
    matches = rows.filter(row => targets.includes(normalized(catalogModelName(row.name,vehicle.manufacturer)))
      || String(row.name).split('/').some(alias => targets.includes(normalized(catalogModelName(alias,vehicle.manufacturer)))||catalogueModelAlias(alias,vehicle)));
  } else if (level === 'generations') {
    matches = rows.filter(row => ['possible','unknown'].includes(generationChronology(row,vehicle).status));
  } else if (level === 'engines' && vehicle.engineCode) {
    matches = rows.filter(row => row.engineCode && normalized(row.engineCode) === normalized(vehicle.engineCode)
      && (!vehicle.fuel || row.fuel && normalized(row.fuel).includes(normalized(vehicle.fuel)))
      && !(vehicle.engineKw != null && row.power != null && Math.abs(vehicle.engineKw * 1.35962 - row.power) > 6)
      && !(vehicle.engineCc != null && row.capacity != null && Math.abs(vehicle.engineCc / 1000 - row.capacity) > 0.15));
  }
  return { ids: matches.map(row => String(row.id)), reason: matches.length > 1 ? 'multiple-candidates'
    : matches.length === 1 ? level === 'generations' ? 'chronology-candidate-only' : 'identity-match' : 'no-reliable-match' };
}

function fuelFamily(value) {
  const fuel = normalized(value);
  if (/hybrid/.test(fuel)) return 'hybrid';
  if (/diesel/.test(fuel)) return 'diesel';
  if (/petrol|bensin|gasoline/.test(fuel)) return 'petrol';
  if (/electric|elektrisk/.test(fuel)) return 'electric';
  // Supplier buckets such as "Other Engines" describe no actual fuel.
  // Unknown is neither diesel nor a contradiction of registered diesel.
  return /^(?:otherengines?|unknown|unspecified|notspecified|annet|ukjend)$/.test(fuel)?null:fuel || null;
}
export function catalogCc(engine) {
  if (typeof engine.capacity === 'number' && engine.capacity > 0) return engine.capacity > 20 ? engine.capacity : engine.capacity * 1000;
  // Only an explicit decimal litre designation is read from a name; never infer from horsepower.
  const cc=String(engine.name??'').match(/\b(\d{3,5})\s*(?:cc|cm[³3])\b/i);if(cc)return Number(cc[1]);
  const litres = String(engine.name || '').match(/(?:^|\s)([0-9]{1,2}[.,][0-9]{1,3})(?=\s|[A-Z])/i);
  return litres ? Number(litres[1].replace(',', '.')) * 1000 : null;
}
export function engineEvidence(engine, vehicle) {
  const expectedCode = normalized(vehicle.engineCode);
  const supplierCodes = String(engine.engineCode || '').split(/[,/;|]+/).map(normalized).filter(Boolean);
  const reference=referenceEngineCodes(engine,vehicle);
  const codes=supplierCodes.length?supplierCodes:reference.status==='documented-signature'?reference.codes.map(normalized):[];
  const codeMatch = Boolean(expectedCode && codes.includes(expectedCode));
  const mechanicalCode=reviewedMechanicalCode(engine,vehicle,makeName(vehicle.manufacturer));
  const codeConflict = Boolean(expectedCode && codes.length && !codeMatch && !mechanicalCode);
  const expectedFuel = fuelFamily(vehicle.fuel), engineFuel = fuelFamily(engine.fuel);
  const euro=v=>String(v??'').match(/^(?:Euro|EU)\s*([1-6])(?:[A-Z+])?$/i)?.[1]??null;
  const expectedEuro=euro(vehicle.emissionClass),engineEuro=euro(engine.emissionClass)??euro(reference.emissionClass)??String(engine.name??'').match(/\b(?:Euro|EU)\s*([1-6])\b/i)?.[1];
  const emissionConflict=!!(expectedEuro&&engineEuro&&expectedEuro!==engineEuro);
  const expectedGear=gearboxKind(vehicle.gearbox),actualGear=gearboxKind(engine.gearbox??engine.transmission);
  const gearboxConflict=Boolean(expectedGear&&actualGear&&expectedGear!==actualGear);
  const fuelMatch = Boolean(expectedFuel && engineFuel && expectedFuel === engineFuel);
  const capacity = catalogCc(engine)??reference.capacityCc??reference.nominalCapacityCc??null;
  const capacityMatch = vehicle.engineCc != null && capacity != null && Math.abs(vehicle.engineCc - capacity) <= 100;
  // Allow the combined rounding interval of whole kW (±0.5 kW) and HK (±0.5 HK).
  // 103 kW corresponds to 140 HK, not the distinct 143 HK / 105 kW variant.
  const powerTolerance=0.5*KW_TO_HK+0.5;
  const expectedPower=vehicle.engineKw>0?vehicle.engineKw*KW_TO_HK:vehicle.powerHk>0?vehicle.powerHk:null;
  const powerMatch = expectedPower!==null && engine.power > 0 && Math.abs(expectedPower - engine.power) <= (vehicle.engineKw>0?powerTolerance:0.5);
  // A full BMW designation is explicit variant identity within a grouped series.
  // Missing/shorthand names remain unknown; never infer displacement from 318d/18d.
  const model=catalogModelName(vehicle.model,vehicle.manufacturer);
  const expectedVariant = makeName(vehicle.manufacturer) === 'bmw' && /^([1-8][0-9]{2}[a-z])$/i.test(model)
    ? normalized(model) : null;
  const namedVariants = expectedVariant ? [...String(engine.name || '').matchAll(/\b([1-8][0-9]{2}[a-z])\b/gi)].map(match => normalized(match[1])) : [];
  const group=vehicleCategoryGroup(vehicle.vehicleCategory);
  const heavyDesignation=['heavy','agriculture'].includes(group)?heavyModelDesignation(vehicle):null;
  // Some catalogue names start with an explicit technical engine family,
  // e.g. D13A/B/C 400, before the commercial variant. The 13 is not the
  // power badge. A known different family remains a conflict, not a synonym.
  const technicalLabel=heavyDesignation?String(engine.name??'').match(/^(D\d{1,2}[A-Z](?:\/[A-Z])*)\s+(\d{3})(?=\s|$)/i):null;
  const heavyBadge=technicalLabel?[technicalLabel[0],undefined,technicalLabel[2]]:heavyDesignation?String(engine.name??'').match(/^([A-Z]{1,5}\s*)?(\d{2,4}[A-Z]?)(?=\s|$)/i):null;
  const expectedFamily=String(vehicle.engineCode??'').replace(/\s+/g,'').match(/^(D\d{1,2}[A-Z])\d{3}(?:TC|S)?$/i)?.[1]?.toUpperCase();
  const labelParts=technicalLabel?.[1].toUpperCase().split('/')??[],familyStem=labelParts[0]?.match(/^D\d{1,2}/)?.[0];
  const labelFamilies=labelParts.map((part,i)=>i===0?part:familyStem+part);
  const engineFamilyConflict=!!(expectedFamily&&labelFamilies.length&&!labelFamilies.includes(expectedFamily));
  const heavyVariantMatch=!!(heavyBadge&&normalized(heavyBadge[2])===normalized(heavyDesignation.variant)&&(!heavyBadge[1]||normalized(heavyBadge[1])===normalized(heavyDesignation.family)));
  // Mercedes class + three-digit badge identifies the commercial variant;
  // CDI is a diesel label, BlueTEC is retained as an explicit qualifier.
  // BlueEFFICIENCY is NOT a synonym for BlueTEC. Absent qualifiers stay unknown.
  const mb=makeName(vehicle.manufacturer)==='mercedes'?model.match(/^([A-Z]{1,3})\s*(\d{3})(?:\s*(?:CDI|CGI|BLUETEC|BLUEEFFICIENCY|AMG|4MATIC\+?|[de]))*$/i):null;
  const mbLabel=mb?String(engine.name??'').match(/^(?:[A-Z]{1,3}\s*)?(\d{3})(?=\s|[a-z]|$)/i):null;
  const mbBadgeConflict=!!(mb&&mbLabel&&mb[2]!==mbLabel[1]);
  const mbBlueTecMatch=!!(mb&&mbLabel&&!mbBadgeConflict&&/\bBLUETEC\b/i.test(model)&&/\bBLUETEC\b/i.test(engine.name??''));
  const variantConflict = mbBadgeConflict||namedVariants.length > 0 && !namedVariants.includes(expectedVariant)||!!(heavyBadge&&!heavyVariantMatch);
  const referenceConflict=supplierCodes.length&&reference.status==='documented-signature'&&!supplierCodes.some(c=>reference.codes.map(normalized).includes(c));
  const conflict = emissionConflict || engine.detailConflict || referenceConflict || variantConflict || engineFamilyConflict || codeConflict || gearboxConflict || Boolean(expectedFuel && engineFuel && !fuelMatch)
    || Boolean(vehicle.engineCc != null && capacity != null && !capacityMatch)
    || Boolean(expectedPower !== null && engine.power != null && !powerMatch);
  const variant = model;
  const variantMatch = mbBlueTecMatch||heavyVariantMatch||/[0-9]/.test(variant) && /[a-z]/i.test(variant)
    && String(engine.name || '').split(/\s+/).some(token => normalized(token) === normalized(variant));
  const corroboration = [fuelMatch, capacityMatch, powerMatch].filter(Boolean).length;
  const strong= !conflict && !engine.detailCheckIncomplete && fuelMatch && capacityMatch && powerMatch && (codeMatch||engine.detailChecked===true);
  return { plausible: !conflict && (corroboration >= 2||heavyVariantMatch&&powerMatch), strong,
    codeMatch,codeKnown:codes.length>0,codeRelation:mechanicalCode?'documented-mechanical-prefix':!supplierCodes.length&&reference.status==='documented-signature'?'documented-engine-signature':codeMatch?'exact':codes.length&&expectedCode?'different':'unknown',reference, fuelMatch, capacityMatch, powerMatch, variantMatch, variantConflict,emissionConflict,engineFamilyConflict,gearboxConflict, conflict: Boolean(conflict) };
}

// An exact full model/engine designation is independent evidence beyond power.
// Missing catalogue displacement/code remain unknown. Callers must ALSO prove
// uniqueness after generation, feature and all known technical conflict checks.
export function exactVariantProfile(engine,vehicle,evidence=engineEvidence(engine,vehicle)){
  const variant=catalogModelName(vehicle.model,vehicle.manufacturer);
  return !vehicle.requiresManual&&vehicle.engineCc>0&&/[a-z]/i.test(variant)&&/\d/.test(variant)
    &&normalized(engine.name)===normalized(variant)&&evidence.variantMatch
    &&engine.detailChecked===true&&!engine.detailCheckIncomplete&&!evidence.conflict
    &&evidence.fuelMatch&&evidence.powerMatch&&!referenceVariantConflict(engine,vehicle);
}

export function mergeEngineDetails(engine, details, vehicle) {
  const known = value => value !== null && value !== undefined && value !== '';
  const merged = { ...engine,detailChecked:true };
  for (const key of ['engineCode', 'fuel', 'capacity', 'power', 'torque']) if (!known(merged[key]) && known(details[key])) merged[key] = details[key];
  const listCodes = String(engine.engineCode || '').split(/[,/;|]+/).map(normalized).filter(Boolean);
  const detailCodes = String(details.engineCode || '').split(/[,/;|]+/).map(normalized).filter(Boolean);
  const codeConflict = listCodes.length && detailCodes.length && !listCodes.some(code => detailCodes.includes(code));
  const listCc = catalogCc(engine), detailCc = catalogCc(details);
  const dataConflict = Boolean(engine.fuel && details.fuel && fuelFamily(engine.fuel) !== fuelFamily(details.fuel))
    || Boolean(listCc != null && detailCc != null && Math.abs(listCc - detailCc) > 100)
    || Boolean(engine.power != null && details.power != null && Math.abs(engine.power - details.power) > 3);
  merged.detailConflict = Boolean(codeConflict || dataConflict || engineEvidence(details, vehicle).conflict);
  // Preserve both sources for explanations without exposing the tuning result before confirmation.
  return merged;
}

export async function enrichEnginePaths(paths, vehicle, loadCatalog, { signal, maxDetails = 4, concurrency = 2 } = {}) {
  const check = () => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };
  const candidates = paths.filter(path => engineEvidence(path.engine, vehicle).plausible);
  const ids = [...new Set(candidates.map(path => String(path.engine.id)))];
  const budget = Math.max(0, Math.min(4, Math.floor(maxDetails) || 0));
  // If the set exceeds the budget, check none rather than biasing toward the first few.
  const checkedIds = ids.length <= budget ? ids : [];
  const details = new Map(), failures = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < checkedIds.length) {
      check(); const id = checkedIds[cursor++];
      try {
        const data = await loadCatalog('details', id, signal); check();
        if (!data || String(data.id) !== id) throw Object.assign(new Error('invalid-response'), { code: 'invalid-response' });
        details.set(id, data);
      } catch (error) {
        check();
        const code = ['quota', 'timeout', 'access-denied', 'not-found', 'invalid-response'].includes(error?.code) ? error.code : 'upstream-unavailable';
        failures.push({ id, code });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(checkedIds.length, Math.max(1, Math.min(2, Math.floor(concurrency) || 1))) }, worker));
  check();
  return {
    paths: candidates.map(path => ({ ...path, engine: details.has(String(path.engine.id)) ? mergeEngineDetails(path.engine, details.get(String(path.engine.id)), vehicle) : { ...path.engine, detailCheckIncomplete: true },
      detailStatus: details.has(String(path.engine.id)) ? 'checked' : failures.some(item => item.id === String(path.engine.id)) ? 'unavailable' : 'not-checked' })),
    detailChecks: { limit: budget, total: ids.length, checked: details.size, attempted: checkedIds.length, limitReached: ids.length > budget, failures },
  };
}

export function assessEnginePaths(paths, vehicle) {
  if (!vehicle || vehicle.requiresManual) return { kind: 'manual', paths: [], generation: null, engine: null };
  const identity=establishVehicleIdentity(vehicle);if(identity.issues.length)return {kind:'conflicting-generation-data',paths:[],generation:null,engine:null};
  const evaluated = paths.map(path => {
    const generationEvidence=generationCompatibility(path.generation,vehicle),evidence=engineEvidence(path.engine,vehicle),engineChronology=generationChronology(path.engine,vehicle);
    if(['excluded','conflict'].includes(engineChronology.status)){evidence.plausible=false;evidence.strong=false;evidence.conflict=true;}
    const label=String(path.engine.name??'').trim().match(/^([a-z0-9]+)\s+(\d+(?:[.,]\d+)?)\s*(?:hp|hk|ps)\s+(\d+(?:[.,]\d+)?)\s*Nm$/i);
    const unqualifiedVariant=!!label&&normalized(label[1])===normalized(catalogModelName(vehicle.model,vehicle.manufacturer))
      &&Number(label[2].replace(',','.'))===path.engine.power&&Number(label[3].replace(',','.'))===path.engine.torque
      &&![path.engine.gearbox,path.engine.transmission,path.engine.drivetrain].some(v=>v!==null&&v!==undefined&&v!=='');
    // A reviewed homologation identity plus the explicit complete model/engine
    // designation can support a unique entry even when catalog capacity/code
    // are absent. Those absent fields remain unknown, never positive matches.
    const documentedIdentitySupport=path.engine.detailChecked===true&&!path.engine.detailCheckIncomplete&&!evidence.conflict
      &&unqualifiedVariant&&evidence.variantMatch&&evidence.fuelMatch&&evidence.powerMatch
      &&generationEvidence.status==='match'&&generationEvidence.identity.basis.includes('documented-homologation-variant')
      &&vehicle.engineCc>0&&typeof vehicle.engineCode==='string'&&!!vehicle.engineCode.trim();
    // Heavy/agricultural catalogues often omit fuel, displacement and codes.
    // A complete literal model badge + original power can select the sole
    // remaining entry after every known conflict and chronology check. Missing
    // fields remain unknown; this is a catalogue choice, not a proven code match.
    const allowedPowerProfile=vehicleCategoryGroup(vehicle.vehicleCategory)==='agriculture'||/^N[23]G?$/i.test(String(vehicle.vehicleCategory??'').trim());
    const variantPowerSupport=allowedPowerProfile&&!!heavyModelDesignation(vehicle)&&path.engine.detailChecked===true&&!path.engine.detailCheckIncomplete
      &&evidence.variantMatch&&evidence.powerMatch&&!evidence.conflict;
    return {...path,generationEvidence,engineChronology,chronology:generationChronology(path.generation,vehicle),evidence:{...evidence,documentedIdentitySupport,variantPowerSupport}};
  });
  const relevant=evaluated.filter(p=>p.evidence.plausible&&p.generationEvidence.status!=='conflict');
  const identified=relevant.filter(p=>p.generationEvidence.status==='match');
  if(relevant.some(p=>p.chronology.status==='conflict')
    ||identified.length&&identified.every(p=>p.chronology.status==='excluded'))
    return {kind:'conflicting-generation-data',paths:[],generation:null,engine:null};
  const plausible=evaluated.filter(path=>path.evidence.plausible&&path.generationEvidence.status!=='conflict'&&path.chronology.status!=='excluded');
  // Chronology can rule out clearly future starts; it never identifies a generation
  // on its own or excludes an older generation by its catalog end year.
  if (!plausible.length) return { kind: 'no-engine-match', paths: [], generation: null, engine: null };
  const generationIds = [...new Set(plausible.map(path => (path.model?.id??'')+':'+String(path.generation.id)))];
  // The same supplier engine ID may be linked from several period buckets.
  // Its checked detail endpoint owns one complete effect result. Do not ask
  // the customer to distinguish duplicate navigation paths to that same ID.
  // This does not identify a physical generation or merge different IDs.
  if(vehicle.baseVehicleEvidence&&plausible.length>1&&new Set(plausible.map(p=>String(p.model?.id??''))).size===1&&new Set(plausible.map(p=>String(p.engine.id))).size===1
   &&plausible.every(p=>p.evidence.strong&&p.engine.detailChecked&&!p.engine.detailCheckIncomplete)
   &&new Set(plausible.map(p=>JSON.stringify(p.engine))).size===1){
   return {kind:'complete',paths:plausible,generation:null,engine:plausible[0].engine,selectionBasis:'same-checked-supplier-engine',equivalentGenerationPaths:plausible.map(p=>({modelId:String(p.model?.id??''),generationId:String(p.generation.id),name:p.generation.name}))};
  }
  if (generationIds.length !== 1) return { kind: 'choose-generation', paths: plausible, generation: null, engine: null };
  const generation = plausible[0].generation;
  if (plausible.length === 1 && (plausible[0].evidence.strong||plausible[0].evidence.documentedIdentitySupport||plausible[0].evidence.variantPowerSupport)) return { kind: 'complete', paths: plausible, generation, engine: plausible[0].engine,
    selectionBasis:plausible[0].evidence.strong?'technical-evidence':plausible[0].evidence.documentedIdentitySupport?'documented-identity':'unique-model-variant-and-power' };
  return { kind: 'choose-engine', paths: plausible, generation, engine: null };
}

// Supplier catalogue buckets are not registration categories. N2 trucks
// can be van-derived and listed under Cars & LCV. Keep their actual
// registration category; try that catalogue only after the primary has no exact
// make/model path. An actual model match and all normal technical checks are
// still required. Never fall back after a conflict, quota/error or ambiguous path.
export async function resolveVehicleProposal(vehicle, loadCatalog, options = {}) {
  const commercial=documentedCommercialModel(vehicle);
  if(commercial)vehicle={...vehicle,model:commercial.model};
  const reviewed=reviewedCatalogRouting(vehicle);
  if(reviewed?.model)vehicle={...vehicle,model:reviewed.model};
  const cache=new Map();
  const load=(level,id,signal)=>{const key=level+'/'+(id??'');if(!cache.has(key))cache.set(key,Promise.resolve(loadCatalog(level,id,signal)));return cache.get(key);};
  const primary=await resolveTypedVehicleProposal(vehicle,load,options);
  if(reviewed)return primary.selections.models?{...primary,catalogueRouting:{basis:'reviewed-model-catalogue-route',...reviewed,registeredCategory:vehicle.vehicleCategory,selectedTypeId:primary.selections.types}}:primary;
  if(!/^N2G?$/i.test(String(vehicle?.vehicleCategory??'').trim())
    ||primary.kind!=='no-match'||!['models','manufacturers'].includes(primary.pendingLevel))return primary;
  const types=await load('types',undefined,options.signal),alternate=types.filter(t=>/^Cars\s*&\s*LCV$/i.test(t.name));
  if(alternate.length!==1)return primary;
  const proposal=await resolveTypedVehicleProposal(vehicle,load,{...options,catalogTypeId:String(alternate[0].id)});
  if(!proposal.selections.models)return primary;
  return {...proposal,catalogueRouting:{basis:'exact-model-in-alternate-catalogue',registeredCategory:vehicle.vehicleCategory,primaryTypeId:primary.selections.types,selectedTypeId:String(alternate[0].id)}};
}
async function resolveTypedVehicleProposal(vehicle, loadCatalog, { signal, maxModels = 4, maxGenerations = 10, maxDetails = 4, detailConcurrency = 2, catalogTypeId=null } = {}) {
  const selections = {};
  const result = { selections, kind: 'manual', pendingLevel: 'types', paths: [] };
  const check = () => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };
  if (!vehicle || vehicle.requiresManual) return result;
  if(establishVehicleIdentity(vehicle).issues.length)return {...result,kind:'conflicting-generation-data',pendingLevel:'generations'};
  let parent;
  for (const level of ['types', 'manufacturers']) {
    check();
    const rows = await loadCatalog(level, parent, signal); check();
    const candidates = level==='types'&&catalogTypeId ? {ids:rows.filter(r=>String(r.id)===catalogTypeId).map(r=>String(r.id))} : suggestCandidates(level, rows, vehicle);
    if (candidates.ids.length !== 1) return { ...result, kind: candidates.ids.length ? 'ambiguous' : 'no-match', pendingLevel: level };
    parent = candidates.ids[0]; selections[level] = parent;
  }
  // A supplier model row is a catalogue grouping, not necessarily a physical
  // model. Explore every exact model alias within a fixed budget; never choose
  // the first group, or discard a group merely because another one succeeded.
  const modelRows=await loadCatalog('models',parent,signal);check();
  const modelIds=suggestCandidates('models',modelRows,vehicle).ids;
  const models=modelRows.filter(m=>modelIds.includes(String(m.id)));
  if(!models.length)return {...result,kind:'no-match',pendingLevel:'models'};
  if(models.length>Math.max(1,Math.min(4,maxModels)))return {...result,kind:'ambiguous',pendingLevel:'models',searchChecks:{models:models.length,limitReached:true}};
  if(models.length===1)selections.models=String(models[0].id);
  const allGenerations=[];
  for(const model of models){check();const rows=await loadCatalog('generations',model.id,signal);check();allGenerations.push(...rows.map(g=>({...g,model})));}
  const literalGenerations=literalGenerationMatches(allGenerations,vehicle);
  const generationChecks=allGenerations.map(g=>({id:String(g.id),modelId:String(g.model.id),explicitTypeCodeMatch:literalGenerations.includes(g),...generationChronology(g,vehicle)}));
  const reviewedGenerations=allGenerations.filter(g=>generationCompatibility(g,vehicle).status==='match');
  if(literalGenerations.length&&reviewedGenerations.length&&!literalGenerations.some(g=>reviewedGenerations.includes(g)))
    return {...result,kind:'conflicting-generation-data',pendingLevel:'generations',generationChecks};
  const identifiedGenerations=[...new Set([...reviewedGenerations,...literalGenerations])];
  if(identifiedGenerations.length&&identifiedGenerations.every(g=>['excluded','conflict'].includes(generationChronology(g,vehicle).status)))
    return {...result,kind:'conflicting-generation-data',pendingLevel:'generations',generationChecks};
  const generations=allGenerations.filter((g,i)=>(!literalGenerations.length||literalGenerations.includes(g))&&generationChecks[i].status!=='excluded'&&generationCompatibility(g,vehicle).status!=='conflict');
  if (!generations.length || generations.length > maxGenerations) return { ...result, kind:generations.length?'choose-generation':'no-engine-match', pendingLevel: 'generations',generationChecks };
  const paths = [];
  for (const generation of generations) {
    check();
    const engines = await loadCatalog('engines', generation.id, signal); check();
    const {model,...g}=generation;
    paths.push(...engines.map(engine => ({ model, generation:g, engine })));
  }
  const plausible = assessEnginePaths(paths, vehicle);
  const enriched = await enrichEnginePaths(plausible.paths, vehicle, loadCatalog, { signal, maxDetails, concurrency: detailConcurrency });
  const assessment = assessEnginePaths(enriched.paths, vehicle);
  const survivingModels=[...new Set(assessment.paths.map(p=>String(p.model.id)))];
  if(survivingModels.length===1)selections.models=survivingModels[0];
  if (assessment.generation) selections.generations = String(assessment.generation.id);
  else if(assessment.equivalentGenerationPaths){selections.generations=String(assessment.paths[0].generation.id);}
  // A sole surviving supplier group can be traversed even without engine
  // coverage. This is navigation only: never a confirmed engine/result.
  else if(generations.length===1&&assessment.kind==='no-engine-match')selections.generations=String(generations[0].id);
  if (assessment.engine) selections.engines = String(assessment.engine.id);
  return { ...result, kind: assessment.kind, pendingLevel: assessment.kind === 'complete' ? null : selections.generations ? 'engines' : 'generations', paths: assessment.paths, detailChecks: enriched.detailChecks,generationChecks,
    ...(assessment.selectionBasis?{selectionBasis:assessment.selectionBasis}:{}),...(assessment.equivalentGenerationPaths?{equivalentGenerationPaths:assessment.equivalentGenerationPaths}:{}) };
}
