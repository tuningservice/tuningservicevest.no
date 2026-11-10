import { parseOfferContact } from '../js/vehicle-offer-state.mjs';
import { levels } from '../js/vehicle-cascade.mjs';
import { resolveVehicleProposal } from '../js/vehicle-matching.mjs';
import { kwToHk } from '../js/vehicle-units.mjs';
import { VehicleError, jsonResponse } from './vehicle-service.mjs';
import { renderOfferEmail } from './vehicle-offer-email.mjs';

export const OFFER_RECIPIENT = 'vest@tuningservice.no';
export const OFFER_SITE = 'https://tuningservicevest.no';
export const OFFER_TYPE = 'vehicle-offer.v1';
const fail = (code = 'invalid-offer', status = 400) => { throw new VehicleError(code, status); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validId = value => typeof value === 'string' && /^[1-9][0-9]{0,11}$/.test(value);
function string(value, max, multiline = false) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) fail();
  return value.trim();
}
function registration(value) {
  const plate = string(value, 10).toUpperCase().replace(/ /g, '');
  if (plate && !/^[A-Z0-9]{2,7}$/.test(plate)) fail();
  return plate || null;
}
function validate(body) {
  const fields = ['requestId','contact','name','message','lookupToken','registration','selection','confirmed','stage','website'];
  if (!object(body) || Object.keys(body).some(key => !fields.includes(key)) || !uuid(body.requestId)) fail();
  const contact = parseOfferContact(body.contact); if (!contact) fail('invalid-contact');
  // Existing contact flow uses Turnstile; the local-only route additionally uses a honeypot.
  if (string(body.website, 200)) fail('spam-rejected');
  if (body.lookupToken != null && !uuid(body.lookupToken)) fail();
  if (!object(body.selection) || Object.keys(body.selection).some(key => !levels.includes(key))) fail('invalid-selection');
  const selection = {}; let gap = false;
  for (const level of levels) {
    const id = body.selection[level];
    if (!id) { gap = true; continue; }
    if (gap || !validId(id)) fail('invalid-selection'); selection[level] = id;
  }
  if (typeof body.confirmed !== 'boolean' || body.confirmed && !selection.engines) fail('invalid-selection');
  let stage = null;
  if (body.stage != null) {
    if (!object(body.stage) || Object.keys(body.stage).some(key => !['index','number'].includes(key))
      || !Number.isInteger(body.stage.index) || body.stage.index < 0 || body.stage.index > 50
      || !(body.stage.number === null || typeof body.stage.number === 'number' && Number.isFinite(body.stage.number) && body.stage.number >= 0)
      || !body.confirmed) fail('invalid-stage');
    stage = { index: body.stage.index, number: body.stage.number };
  }
  return { requestId: body.requestId.toLowerCase(), contact, name: string(body.name,100), message: string(body.message,3000,true),
    lookupToken: body.lookupToken || null, registration: registration(body.registration), selection, confirmed: body.confirmed, stage };
}

// Mirrors the private binding interface, but has no network transport or provider credentials.
export function createSimulatedOfferWorker({ delayMs = 150 } = {}) {
  let failNext = false;
  return {
    mode: 'local-simulated',
    failNext() { failNext = true; },
    async fetch(url, init) {
      if (url !== 'https://internal/vehicle-offer' || init?.method !== 'POST') return Response.json({ok:false},{status:400});
      const envelope = JSON.parse(init.body);
      if (envelope.type !== OFFER_TYPE || envelope.to !== OFFER_RECIPIENT) return Response.json({ok:false},{status:400});
      renderOfferEmail(envelope); // Build the same email as the fixed previews, then discard it locally.
      if (delayMs) await new Promise(resolve => setTimeout(resolve,delayMs));
      if (failNext) { failNext = false; return Response.json({ok:false,simulated:true},{status:502}); }
      return Response.json({ok:true,simulated:true});
    },
  };
}

export function createOfferService({ vehicleService, mailWorker = createSimulatedOfferWorker(), now = () => Date.now(),
  contextTtlMs = 15 * 60000, idempotencyTtlMs = 30 * 60000 } = {}) {
  if (mailWorker.mode !== 'local-simulated') throw new Error('Only the local mail simulator is supported.');
  const contexts = new Map(), submissions = new Map();
  const prune = map => { for (const [key, value] of map) if (value.expires <= now() && !value.pending) map.delete(key); };
  function rememberLookup(result, plate = null) {
    prune(contexts); while (contexts.size >= 200) contexts.delete(contexts.keys().next().value);
    const token = crypto.randomUUID();
    contexts.set(token,{ result: structuredClone(result), registration: registration(plate), expires: now()+contextTtlMs });
    return { ...result, lookupToken: token };
  }
  async function buildEnvelope(input) {
    prune(contexts);
    const context = input.lookupToken ? contexts.get(input.lookupToken) : null;
    if (input.lookupToken && !context) fail('lookup-expired',409);
    if (context && input.registration && input.registration !== context.registration) fail('vehicle-context-changed',409);
    const catalogSelection = {};
    let selectionUnavailable = false;
    let parent;
    for (const level of levels) {
      const id = input.selection[level]; if (!id) break;
      let rows;
      try { rows = await vehicleService.catalog(level,parent); }
      catch(error) {
        if(input.confirmed || error?.status === 400) throw error;
        selectionUnavailable = true; break;
      }
      const row = rows.find(item => String(item.id) === id); if (!row) fail('invalid-selection');
      catalogSelection[level] = { id, name: row.name, ...(level === 'generations' ? { year: row.year, yearend: row.yearend } : {}) };
      parent = id;
    }
    let effect = null;
    if (input.confirmed) {
      const detail = await vehicleService.catalog('details',input.selection.engines);
      if (String(detail.id) !== input.selection.engines) fail('invalid-selection');
      if (input.stage && (!detail.remapStages[input.stage.index] || detail.remapStages[input.stage.index].stage !== input.stage.number)) fail('invalid-stage');
      if (!input.stage && detail.remapStages.length) fail('invalid-stage');
      const stage = input.stage ? detail.remapStages[input.stage.index] : null;
      effect = { source:'catalog-server', original:{powerHk:detail.power,torqueNm:detail.torque}, stage:stage ? {
        index:input.stage.index, number:stage.stage, powerHk:stage.power, torqueNm:stage.torque, hardwareRequirements:stage.hardwareRequirements,
      } : null };
    }
    let proposal = null;
    if (context) {
      try {
        if(selectionUnavailable) throw new Error('catalog-unavailable');
        const resolved = await resolveVehicleProposal(context.result.vehicle,(level,id)=>vehicleService.catalog(level,id));
        proposal = { kind:resolved.kind, selections:resolved.selections, candidates:resolved.paths.slice(0,20).map(path=>({
          generationId:String(path.generation.id),generation:path.generation.name,engineId:String(path.engine.id),engine:path.engine.name,
        })) };
      } catch { proposal = {kind:'unavailable',selections:{},candidates:[]}; }
    }
    const registered = context ? { source:context.result.simulated ? 'synthetic-test-data' : 'svv-verified-server',
      simulated:Boolean(context.result.simulated), data:structuredClone(context.result.vehicle), powerHk:kwToHk(context.result.vehicle.engineKw) } : null;
    return { type:OFFER_TYPE, simulated:true, id:input.requestId, to:OFFER_RECIPIENT, replyTo:input.contact.email || null,
      site:OFFER_SITE, createdAt:new Date(now()).toISOString(), contact:input.contact, name:input.name, message:input.message,
      registration:context?.registration || input.registration, registrationSource:context?.registration ? context.result.simulated?'synthetic-test-data':'register-lookup' : input.registration ? 'customer-unverified' : null,
      registered, proposal, customerChoice:{status:input.confirmed ? 'confirmed' : 'unresolved',selection:selectionUnavailable?{}:catalogSelection,
        unverifiedIds:selectionUnavailable?input.selection:null,effect},
    };
  }
  async function submit(body) {
    const input = validate(body);
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input)));
    const fingerprint = Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    prune(submissions);
    const existing = submissions.get(input.requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) fail('request-changed',409);
      return existing.promise;
    }
    if (submissions.size >= 200) fail('quota',429);
    const entry = {fingerprint,pending:true,expires:now()+idempotencyTtlMs};
    // Install before any asynchronous vehicle checks, so concurrent duplicates share one delivery.
    submissions.set(input.requestId,entry);
    entry.promise = (async()=>{
      try {
        const envelope = await buildEnvelope(input);
        const response = await mailWorker.fetch('https://internal/vehicle-offer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope)});
        const result = await response.json().catch(()=>null);
        if (!response.ok || result?.ok !== true || result?.simulated !== true) fail('delivery-failed',502);
        return {ok:true,simulated:true,id:input.requestId,message:'Testførespurnad registrert – ingen e-post er send'};
      } catch (error) { submissions.delete(input.requestId); throw error instanceof VehicleError ? error : new VehicleError('delivery-failed',502); }
      finally { entry.pending = false; }
    })();
    return entry.promise;
  }
  return { rememberLookup, submit, expire(){prune(contexts);prune(submissions);} };
}

export async function handleOfferRequest(request, offerService, { localOrigin, limiter } = {}) {
  try {
    const url = new URL(request.url);
    if (!localOrigin || !['127.0.0.1','localhost'].includes(url.hostname) || url.origin !== localOrigin) fail('local-test-only',503);
    if(url.pathname !== '/api/vehicle-offer') fail('not-found',404);
    if (request.method !== 'POST') fail('method-not-allowed',405);
    if (url.search || request.headers.get('origin') !== localOrigin) fail('invalid-origin',403);
    // Unlike the old contact route, this fails closed if its limiter is missing or broken.
    let allowed = false;
    try { allowed = Boolean(limiter && await limiter() === true); } catch {}
    if (!allowed) fail('quota',429);
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) fail();
    if (!request.body) fail();
    const reader = request.body.getReader(); let size=0; const chunks=[];
    for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; if(size>16384){await reader.cancel();fail('payload-too-large',413);} chunks.push(value); }
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{fail();}
    return jsonResponse(await offerService.submit(body));
  } catch(error) {
    const known=error instanceof VehicleError;
    return jsonResponse({ok:false,error:{code:known?error.code:'delivery-failed'}},known?error.status:502);
  }
}
