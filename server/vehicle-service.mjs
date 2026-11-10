// Shared server-only adapters. No HTTP request, credential or vehicle identifier is logged.
import {normalizeVdbCurves} from '../js/effect-graph-model.mjs';
import {allowedBrandLogo} from './vehicle-brand-logo.mjs';
import {catalogYear,registrationDates} from '../js/vehicle-dates.mjs';
export class VehicleError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}
const text = value => typeof value === 'string' ? value.trim().slice(0, 400) : '';
const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const list = value => Array.isArray(value) ? value : [];
const codeText = value => text(value?.kodeBeskrivelse) || text(value?.kodeNavn) || text(value?.kodeVerdi);
const validId = value => /^[1-9][0-9]{0,11}$/.test(String(value ?? ''));

// SVV Enkeltoppslag: hybridElektriskKjoretoy is a JSON boolean; hybridKategori
// is KodeverkType. HYBRIDKATEGORI: INGEN, LADBAR, IKKE_LADBAR, ANNEN.
// The existence of the category object (including "Ingen") is not evidence of a hybrid.
export function assessHybrid(drive = {}) {
  const flag = drive.hybridElektriskKjoretoy;
  const flagPresent = flag !== undefined && flag !== null;
  const invalidFlag = flagPresent && typeof flag !== 'boolean';
  const rawCategory = drive.hybridKategori;
  const categoryPresent = rawCategory !== undefined && rawCategory !== null;
  const categoryObject = categoryPresent && typeof rawCategory === 'object' && !Array.isArray(rawCategory);
  const rawCode = categoryObject ? text(rawCategory.kodeVerdi) : '';
  const knownCodes = ['INGEN', 'LADBAR', 'IKKE_LADBAR', 'ANNEN'];
  const category = knownCodes.includes(rawCode) ? rawCode : null;
  const invalidCategory = categoryPresent && !categoryObject;
  const categorySignal = category === 'INGEN' ? false : ['LADBAR', 'IKKE_LADBAR'].includes(category) ? true : null;
  const booleanSignal = typeof flag === 'boolean' ? flag : null;
  const conflict = booleanSignal !== null && categorySignal !== null && booleanSignal !== categorySignal;
  let status = 'unknown';
  let reason = null;
  if (invalidFlag) reason = 'invalid-hybrid-flag';
  else if (invalidCategory) reason = 'invalid-hybrid-category';
  else if (conflict) reason = 'conflicting-hybrid-data';
  else {
    const signal = booleanSignal ?? categorySignal;
    if (signal !== null) status = signal ? 'hybrid' : 'non-hybrid';
    else reason = 'hybrid-status-unknown';
  }
  // Only documented enum values leave the server, not arbitrary upstream text.
  return { status, category, reason };
}

export function normalizeCatalog(level, value) {
  if (level === 'details') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !validId(value.id)) throw new VehicleError('invalid-response');
    return { id: String(value.id), name: text(value.name), power: number(value.power), torque: number(value.torque),
      capacity: number(value.capacity), year: catalogYear(value.year), yearend: catalogYear(value.yearend),
      engineCode: text(value.engine_code), fuel: text(value.fuel_name) || text(value.type),curves:normalizeVdbCurves(value),
      ecu:text(value.ecu)||null,tcu:text(value.tcu)||null,engineType:text(value.type)||null,
      options:Array.isArray(value.options)?value.options.slice(0,30).filter(o=>o&&typeof o==='object').map(o=>({name:text(o.name),code:text(o.code)})):null,
      remapStages: list(value.remap_stages).map(stage => ({ stage: number(stage.stage_no), power: number(stage.power),
        torque: number(stage.torque), curves:normalizeVdbCurves(stage,value,{ownership:'stage'}),hardwareRequirements: typeof stage.modifications === 'string' ? stage.modifications.trim() || null : null })) };
  }
  if (!Array.isArray(value)) throw new VehicleError('invalid-response');
  return value.filter(row => row && validId(row.id) && text(row.name)).map(row => ({
    id: String(row.id), name: text(row.name), year: catalogYear(row.year), yearend: catalogYear(row.yearend),
    engineCode: text(row.engine_code), fuel: text(row.fuel_name) || text(row.type),
    capacity: number(row.capacity), power: number(row.power), torque: number(row.torque),
    ...(level==='manufacturers'?{brandLogo:allowedBrandLogo(row.brand_logo)}:{}),
  }));
}

export function normalizeSvv(vehicle) {
  const approval = vehicle?.godkjenning || {};
  const technical = approval.tekniskGodkjenning?.tekniskeData || {};
  const general = technical.generelt || {};
  const drive = technical.motorOgDrivverk || {};
  const motors = list(drive.motor);
  const motor = motors.length === 1 ? motors[0] : {};
  const fuels = list(motor.drivstoff);
  const fuel = fuels.length === 1 ? fuels[0] : {};
  const makes = [...new Set(list(general.merke).map(row => text(row.merke)).filter(Boolean))];
  const models = [...new Set(list(general.handelsbetegnelse).map(text).filter(Boolean))];
  const reasons = [];
  const hybrid = assessHybrid(drive);
  if (motors.length > 1) reasons.push('multiple-engines');
  if (motors.some(item => list(item.drivstoff).length > 1)) reasons.push('multiple-fuels');
  if (hybrid.status === 'hybrid') reasons.push('hybrid');
  if (hybrid.reason) reasons.push(hybrid.reason);
  if (makes.length > 1 || models.length > 1) reasons.push('conflicting-identity');
  if (!makes.length) reasons.push('missing-manufacturer');
  if (!models.length) reasons.push('missing-model');
  if (!motors.length) reasons.push('missing-engine');
  if (motors.length === 1 && !fuels.length) reasons.push('missing-fuel');
  const dates = registrationDates(approval.forstegangsGodkjenning?.forstegangRegistrertDato,
    vehicle?.forstegangsregistrering?.registrertForstegangNorgeDato);
  reasons.push(...dates.registrationDateIssues);
  // Deliberately exclude regnr, VIN, owner data, raw upstream data and motor serial numbers.
  return { manufacturer: makes.length === 1 ? makes[0] : null, model: models.length === 1 ? models[0] : null,
    typeCode: text(general.typebetegnelse) || null,
    variantCode: text(approval.tekniskGodkjenning?.kjoretoyklassifisering?.efTypegodkjenning?.variant) || null,
    versionCode: text(approval.tekniskGodkjenning?.kjoretoyklassifisering?.efTypegodkjenning?.versjon) || null, vehicleCategory: text(general.tekniskKode?.kodeVerdi) || null,
    ...dates,
    emissionClass: /^Euro\s*([1-6])/i.exec(codeText(technical.miljodata?.euroKlasse))?.[1] ? 'Euro '+/^Euro\s*([1-6])/i.exec(codeText(technical.miljodata?.euroKlasse))[1] : null,
    emissionCode: text(technical.miljodata?.euroKlasse?.kodeVerdi)||null,
    engineCc: number(motor.slagvolum), engineKw: number(fuel.maksNettoEffekt), engineCode: text(motor.motorKode) || null,
    fuel: codeText(fuel.drivstoffKode) || null, gearbox: codeText(drive.girkassetype) || null,
    hybridStatus: hybrid.status, hybridCategory: hybrid.category,
    requiresManual: reasons.length > 0, manualReasons: reasons };
}

async function limitedJson(response, maxBytes = 2 * 1024 * 1024) {
  if (!response.body) throw new VehicleError('invalid-response');
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new VehicleError('response-too-large'); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(body)); } catch { throw new VehicleError('invalid-response'); }
}

export function createVehicleService(env = {}, { fetchImpl = globalThis.fetch, timeoutMs = 10000, onDiagnostic = () => {},
  cacheTtlMs = 180000, now = () => Date.now(), maxConcurrentCatalog = 2, maxQueuedCatalog = 20 } = {}) {
  const cache = new Map();
  const pending = new Map();
  let activeCatalog = 0;
  const catalogQueue = [];
  const concurrentLimit = Number.isInteger(maxConcurrentCatalog) ? Math.max(1, Math.min(2, maxConcurrentCatalog)) : 2;
  const queueLimit = Number.isInteger(maxQueuedCatalog) ? Math.max(0, Math.min(20, maxQueuedCatalog)) : 20;
  async function catalogSlot(work) {
    if (activeCatalog >= concurrentLimit) {
      if (catalogQueue.length >= queueLimit) throw new VehicleError('quota', 429);
      await new Promise(resolve => catalogQueue.push(resolve));
    } else activeCatalog++;
    try { return await work(); }
    finally { if (catalogQueue.length) catalogQueue.shift()(); else activeCatalog--; }
  }
  function diagnose(service,phase,status=null,code=null){try{onDiagnostic({service,phase,status,code});}catch{}}
  async function upstream(url, headers, service='catalog') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: 'GET', headers, redirect: 'error', signal: controller.signal });
      diagnose(service,'http-response',response.status);
      if (response.status === 204 || response.status === 404) { await response.body?.cancel(); throw new VehicleError('not-found', 404); }
      if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw new VehicleError('access-denied', 403); }
      if (response.status === 429 || response.status === 422) { await response.body?.cancel(); throw new VehicleError('quota', 429); }
      if (!response.ok) { await response.body?.cancel(); throw new VehicleError('upstream-unavailable'); }
      return await limitedJson(response);
    } catch (error) {
      diagnose(service,'request-failed',null,error instanceof VehicleError?error.code:controller.signal.aborted?'timeout':'network-failure');
      if (error instanceof VehicleError) throw error;
      if (controller.signal.aborted) throw new VehicleError('timeout', 504);
      throw new VehicleError('upstream-unavailable');
    } finally { clearTimeout(timer); }
  }
  async function catalog(level, parentId) {
    const routes = { types: 'types/', manufacturers: 'manufacturers/', models: 'models/',
      generations: 'generations/', engines: 'engines/', details: 'engines/view/' };
    if (!Object.hasOwn(routes, level) || level === 'types' && parentId != null && parentId !== ''
      || level !== 'types' && !validId(parentId)) throw new VehicleError('invalid-input', 400);
    if (!env.TUNINGFILES_VDB_API_KEY) throw new VehicleError('vdb-not-configured', 503);
    const route = routes[level] + (level === 'types' ? '' : String(parentId));
    const cached = cache.get(route);
    if (cached && cached.expires > now()) return structuredClone(cached.value);
    cache.delete(route);
    if (!pending.has(route)) {
      const work = (async () => {
        const raw = await catalogSlot(() => upstream('https://api.tuningfiles.com/vdb/' + route,
          { 'x-api-key': env.TUNINGFILES_VDB_API_KEY, Accept: 'application/json' }));
        const value = normalizeCatalog(level, raw);
        if (level === 'details' && value.id !== String(parentId)) throw new VehicleError('invalid-response');
        while (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(route, { value, expires: now() + cacheTtlMs });
        return value;
      })();
      pending.set(route, work);
      work.finally(() => pending.delete(route)).catch(() => {});
    }
    return structuredClone(await pending.get(route));
  }
  async function lookup(registration) {
    const regnr = typeof registration === 'string' ? registration.toUpperCase().replace(/ /g, '') : '';
    // Deliberately limited to ordinary alphanumeric plates in this first local version.
    if (!/^[A-Z0-9]{2,7}$/.test(regnr)) throw new VehicleError('invalid-registration', 400);
    if (!env.SVV_API_KEY) throw new VehicleError('svv-not-configured', 503);
    const url = new URL('https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata');
    url.searchParams.set('kjennemerke', regnr);
    const raw = await upstream(url.href, { 'SVV-Authorization': 'Apikey ' + env.SVV_API_KEY, Accept: 'application/json' },'svv');
    const vehicles = list(raw?.kjoretoydataListe);
    if (vehicles.length === 0) throw new VehicleError('not-found', 404);
    if (vehicles.length !== 1) {
      // Different vehicles may share a plate search. Never pick the first row.
      // Only the same technical whitelist used for a single result leaves here.
      const error=new VehicleError('ambiguous-vehicle',409);
      if(vehicles.length<=10){try{error.candidates=vehicles.map(normalizeSvv);}catch{throw new VehicleError('invalid-response');}}
      diagnose('svv','multiple-vehicles',409,'ambiguous-vehicle');
      throw error;
    }
    let vehicle;try{vehicle=normalizeSvv(vehicles[0]);}catch{diagnose('svv','normalization-failed',null,'invalid-response');throw new VehicleError('invalid-response');}
    diagnose('svv','normalized',200);
    return { source: 'svv', simulated: false, vehicle };
  }
  return { catalog, lookup };
}

export function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

export async function handleVehicleRequest(request, service) {
  try {
    const url = new URL(request.url);
    if (url.pathname === '/api/vehicle-catalog') {
      if (request.method !== 'GET') throw new VehicleError('method-not-allowed', 405);
      if ([...url.searchParams.keys()].some(key => !['level', 'id'].includes(key))
        || url.searchParams.getAll('level').length !== 1 || url.searchParams.getAll('id').length > 1) throw new VehicleError('invalid-input', 400);
      return jsonResponse({ source: 'vdb', data: await service.catalog(url.searchParams.get('level'), url.searchParams.get('id')) });
    }
    if (url.pathname === '/api/vehicle-lookup') {
      if (request.method !== 'POST') throw new VehicleError('method-not-allowed', 405);
      if (url.search) throw new VehicleError('invalid-input', 400);
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw new VehicleError('invalid-input', 400);
      let body;
      try { body = await limitedJson(request, 512); } catch { throw new VehicleError('invalid-input', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'registration')) throw new VehicleError('invalid-input', 400);
      return jsonResponse(await service.lookup(body.registration));
    }
    throw new VehicleError('not-found', 404);
  } catch (error) {
    const known = error instanceof VehicleError;
    return jsonResponse({ error: { code: known ? error.code : 'upstream-unavailable' },
      ...(known&&error.code==='ambiguous-vehicle'&&error.candidates?{candidates:error.candidates}:{}) }, known ? error.status : 502);
  }
}

const services = new WeakMap();
export function serviceForEnvironment(env) {
  if (!services.has(env)) services.set(env, createVehicleService(env));
  return services.get(env);
}
