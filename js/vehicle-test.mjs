import { createCascade, levels } from './vehicle-cascade.mjs';
import { resolveVehicleProposal, assessEnginePaths, catalogCc } from './vehicle-matching.mjs';
import { kwToHk, effectChange, defaultStageIndex, customerEngineName } from './vehicle-units.mjs';
import { createVehicleOfferUi } from './vehicle-offer-ui.mjs';
import { generationPeriod } from './vehicle-dates.mjs';
import { vehicleCategoryLabel } from './vehicle-category-labels.mjs';

const el = id => document.getElementById(id);
const names = { types: 'køyretøytype', manufacturers: 'merke', models: 'modell', generations: 'utgåve', engines: 'motor' };
const messages = {
  'access-denied': 'Biltenesta avviser tilgangen. Prøv manuelt val eller kontakt Bjørn.',
  quota: 'Grensa for førespurnader er nådd. Vent litt og prøv igjen.',
  timeout: 'Oppslaget tok for lang tid. Prøv igjen.',
  'not-found': 'Vi fann ikkje bilen. Du kan velje bilen manuelt.',
  'svv-not-configured': 'Registreringsoppslag er ikkje tilgjengeleg i denne lokaltesten. Vel bilen manuelt.',
  'vdb-not-configured': 'Bilveljaren er ikkje tilgjengeleg akkurat no.',
  'invalid-registration': 'Skriv eit registreringsnummer med 2–7 bokstavar og tal.',
  'invalid-input': 'Kontroller opplysningane og prøv igjen.',
  'invalid-response': 'Biltenesta gav eit uventa svar. Prøv igjen eller vel bilen manuelt.',
  'ambiguous-vehicle': 'Vi fann fleire moglege bilar. Vel bilen manuelt.',
  'upstream-unavailable': 'Biltenesta er ikkje tilgjengeleg akkurat no. Prøv igjen.',
};
const reasons = { hybrid: 'Bilen er registrert som hybrid.', 'multiple-engines': 'Bilen har fleire motoroppføringar.',
  'multiple-fuels': 'Bilen har fleire drivstoffoppføringar.', 'conflicting-identity': 'Bilopplysningane er motstridande.',
  'missing-manufacturer': 'Merke manglar.', 'missing-model': 'Modell manglar.', 'missing-engine': 'Motoropplysningar manglar.',
  'missing-fuel': 'Drivstoff manglar.', 'hybrid-status-unknown': 'Drivlinjetypen er ikkje eintydig oppgitt.',
  'invalid-hybrid-flag': 'Drivlinjeopplysningane har eit uventa format.', 'invalid-hybrid-category': 'Drivlinjekategorien har eit uventa format.',
  'conflicting-hybrid-data': 'Drivlinjeopplysningane er motstridande.' };
const format = (value, unit = '') => typeof value !== 'number' || !Number.isFinite(value) ? 'Ikkje oppgitt' : `${Math.round(value)}${unit ? ' ' + unit : ''}`;
const message = error => messages[error.code] || messages['upstream-unavailable'];
let vehicle = null, simulated = false, catalogSimulated = false, showAll = false, manual = false, resolving = false, proposalPaths = [];
let revision = 0, controller, renderedDetails = null;
let lookupToken = null, lookupFailed = false, activeStageIndex = -1, offerUi;
const cache = new Map();
async function api(url, { signal, ...options } = {}) {
  let response;
  try { response = await fetch(url, { ...options, signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)]) }); }
  catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw Object.assign(new Error('request-failed'), { code: error.name === 'TimeoutError' ? 'timeout' : 'upstream-unavailable' });
  }
  let body;
  try { body = await response.json(); } catch { throw Object.assign(new Error('invalid-response'), { code: 'invalid-response' }); }
  if (!response.ok) throw Object.assign(new Error('request-failed'), { code: body?.error?.code });
  return body;
}
async function loadCatalog(level, id, signal) {
  const key = `${level}:${id || ''}`, stored = cache.get(key);
  if (stored && Date.now() - stored.at < 120000) return structuredClone(stored.data);
  const query = new URLSearchParams({ level }); if (id) query.set('id', id);
  const body = await api('/api/vehicle-catalog?' + query, { signal });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  while (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), data: body.data });
  return body.data;
}
function status(id, content, error = false) { el(id).textContent = content; el(id).dataset.error = String(error); }
function node(tag, content, className) {
  const element = document.createElement(tag); if (content != null) element.textContent = content;
  if (className) element.className = className; return element;
}
function selectedRow(state, level) { return state.rows[level].find(row => String(row.id) === state.selected[level]); }
function renderEffects(details) {
  el('effect-panel').hidden = !details;
  if (details === renderedDetails) return;
  renderedDetails = details;
  const tabs = el('stage-tabs'), output = el('effect-output'); tabs.replaceChildren(); output.replaceChildren();
  if (!details) { activeStageIndex = -1; return; }
  const stages = details.remapStages;
  function choose(index, focus = false) {
    activeStageIndex = index;
    [...tabs.children].forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    if (focus) tabs.children[index]?.focus();
    output.replaceChildren(node('h3', customerEngineName(details.name)));
    if (index < 0) { output.append(node('p', 'Vi har ikkje tuningalternativ for denne motoren. Avklar moglegheitene med Bjørn.')); return; }
    const stage = stages[index]; output.setAttribute('aria-labelledby', `stage-${index}`);
    const grid = node('div', null, 'effect-grid');
    for (const [label, original, tuned, unit] of [['Effekt', details.power, stage.power, 'HK'], ['Dreiemoment', details.torque, stage.torque, 'Nm']]) {
      const card = node('article', null, 'effect-card'); card.append(node('h3', label));
      card.append(node('p', 'Original → etter tuning', 'help'), node('strong', `${format(original, unit)} → ${format(tuned, unit)}`, 'effect-transition'));
      const delta = effectChange(original, tuned);
      card.append(node('p', delta == null ? 'Auke: ikkje oppgitt' : `${delta >= 0 ? '+' : ''}${format(delta, unit)}`, 'effect-increase')); grid.append(card);
    }
    output.append(grid, node('p', stage.hardwareRequirements ? `Krav til oppsett: ${customerEngineName(stage.hardwareRequirements)}` : 'Krav til oppsett er ikkje oppgitt. Avklar dette med Bjørn.', 'hardware'));
    syncOffer(cascade.snapshot());
  }
  stages.forEach((stage, index) => {
    const tab = node('button', stage.stage == null ? 'Tuningalternativ' : `Stage ${stage.stage}`);
    tab.id = `stage-${index}`; tab.type = 'button'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'effect-output');
    tab.addEventListener('click', () => choose(index));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % stages.length : event.key === 'ArrowLeft' ? (index + stages.length - 1) % stages.length : event.key === 'Home' ? 0 : event.key === 'End' ? stages.length - 1 : null;
      if (next != null) { event.preventDefault(); choose(next, true); }
    }); tabs.append(tab);
  }); choose(defaultStageIndex(stages));
}
function render(state) {
  el('simulation-label').hidden = !(simulated || catalogSimulated);
  const pending = levels.find(level => !state.selected[level]);
  const comparison = el('candidate-comparison'); comparison.replaceChildren();
  const visiblePaths = proposalPaths.filter(path => !state.selected.generations || String(path.generation.id) === state.selected.generations);
  comparison.hidden = !pending || resolving || !visiblePaths.length;
  if (!comparison.hidden) {
    comparison.append(node('h3', visiblePaths.length > 1 ? 'Desse alternativa kan passe' : 'Forslaget frå bilveljaren'));
    const list = node('ul', null, 'candidate-list');
    for (const path of visiblePaths.slice(0, 20)) {
      const item = node('li'); const { generation, engine } = path;
      const period = generationPeriod(generation);
      item.append(node('h4', generation.name + period), node('p', customerEngineName(engine.name)));
      const cc = catalogCc(engine);
      const volume = engine.capacity != null ? format(cc, 'cm³') : cc == null ? 'slagvolum ikkje oppgitt'
        : `${(cc / 1000).toLocaleString('nn-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} l (oppgitt i motornamnet)`;
      const facts = [engine.fuel, volume, engine.power == null ? null : format(engine.power, 'HK'), engine.torque == null ? null : format(engine.torque, 'Nm')].filter(Boolean);
      item.append(node('p', 'Oppgitt for alternativet: ' + facts.join(' · '), 'help'), node('p', engine.engineCode ? `Motorkode: ${engine.engineCode}` : 'Motorkode er ikkje oppgitt for dette alternativet.', 'help'));
      list.append(item);
    }
    comparison.append(list);
  }
  for (const level of levels) {
    const select = el(level); select.replaceChildren(new Option(state.loading === level ? 'Hentar alternativ …' : `Vel ${names[level]}`, ''));
    const suggestedIds = level === 'generations' ? proposalPaths.map(path => String(path.generation.id))
      : level === 'engines' ? proposalPaths.filter(path => String(path.generation.id) === state.selected.generations).map(path => String(path.engine.id)) : [];
    const rows = !showAll && suggestedIds.length ? state.rows[level].filter(row => suggestedIds.includes(String(row.id))) : state.rows[level];
    for (const row of rows) {
      const year = level === 'generations' ? generationPeriod(row) : '';
      select.add(new Option((level==='types'?vehicleCategoryLabel(row.name):customerEngineName(row.name)) + year, row.id));
    }
    select.value = state.selected[level]; select.disabled = resolving || !state.rows[level].length || state.loading === level;
    select.setAttribute('aria-busy', String(state.loading === level));
    el('field-' + level).hidden = !showAll && (resolving || level !== pending);
  }
  if (manual || !vehicle) {
    const title = ['manufacturers', 'models', 'generations', 'engines'].map(level => selectedRow(state, level)?.name).filter(Boolean);
    el('car-name').textContent = title.length ? title.map(customerEngineName).join(' · ') : 'Vel bilen din';
    el('car-summary').textContent = '';
  } else {
    el('car-name').textContent = [vehicle.manufacturer, vehicle.model].filter(Boolean).join(' ');
    const facts = [vehicle.fuel, vehicle.engineKw == null ? null : format(kwToHk(vehicle.engineKw), 'HK'), vehicle.engineCc == null ? null : format(vehicle.engineCc, 'cm³'), vehicle.gearbox].filter(Boolean);
    el('car-summary').textContent = 'Registrert for bilen: ' + facts.join(' · ');
  }
  let text = resolving ? 'Finn rett bilvariant …' : state.loading ? 'Hentar alternativ …' : pending ? `Vel ${names[pending]} for å gå vidare.` : 'Kontroller bilvalet og sjå alternativa.';
  if (state.error) text = messages[state.error] || messages['upstream-unavailable'];
  if (state.empty) text = 'Ingen alternativ er oppgitte for dette valet. Prøv eit anna bilval eller avklar med Bjørn.';
  status('catalog-status', text, Boolean(state.error));
  el('retry-button').hidden = !state.error;
  el('confirm-button').disabled = resolving || Boolean(state.loading) || !state.selected.engines;
  renderEffects(state.details);
  syncOffer(state);
}
const cascade = createCascade({ loadCatalog, onState: render });
function syncOffer(state) {
  const selection = Object.fromEntries(levels.filter(level=>state.selected[level]).map(level=>[level,state.selected[level]]));
  const stage = state.details?.remapStages[activeStageIndex];
  const title = ['manufacturers','models','generations','engines'].map(level=>selectedRow(state,level)?.name).filter(Boolean).map(customerEngineName).join(' · ');
  offerUi?.setContext({lookupToken,registration:simulated?null:el('registration').value.trim()||null,selection,
    confirmed:Boolean(state.details),stage:stage?{index:activeStageIndex,number:stage.stage}:null,
    eligible:Boolean(manual||vehicle||lookupFailed||Object.keys(selection).length),busy:resolving||Boolean(state.loading),
    label:(title||[vehicle?.manufacturer,vehicle?.model].filter(Boolean).join(' ')||'Bilvariant uavklart')+(stage?stage.stage==null?' · Tuningalternativ utan stegnummer':` · Stage ${stage.stage}`:'')});
}
offerUi = createVehicleOfferUi({send:body=>api('/api/vehicle-offer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(result=>{
  if(result.ok!==true||result.simulated!==true)throw Object.assign(new Error('delivery-failed'),{code:'delivery-failed'});
  return result;
})});
function invalidate() {
  lookupToken = null; lookupFailed = false;
  revision++; controller?.abort(); resolving = false; vehicle = null; simulated = false; manual = false; showAll = false; proposalPaths = [];
  cascade.clear(); el('car-panel').hidden = true; el('simulation-label').hidden = true; el('technical-data').textContent = ''; status('lookup-status', '');
}
async function lookup(url, body) {
  invalidate(); const version = revision; controller = new AbortController(); const signal = controller.signal;
  status('lookup-status', 'Finn bilen din …');
  try {
    const result = await api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (version !== revision) return;
    vehicle = result.vehicle; simulated = Boolean(result.simulated); lookupToken = result.lookupToken || null; el('simulation-label').hidden = !simulated;
    el('technical-data').textContent = JSON.stringify(vehicle, null, 2);
    el('car-panel').hidden = false; resolving = true; render(cascade.snapshot());
    const proposal = await resolveVehicleProposal(vehicle, loadCatalog, { signal });
    if (version !== revision) return;
    proposalPaths = proposal.paths;
    el('technical-data').textContent = JSON.stringify({ registered: vehicle, detailChecks: proposal.detailChecks }, null, 2);
    await cascade.applySelections(proposal.selections, () => version === revision);
    if (version !== revision) return;
    resolving = false;
    el('proposal-note').textContent = vehicle.requiresManual ? `${vehicle.manualReasons.map(reason => reasons[reason] || 'Bilopplysningar må avklarast.').join(' ')} Vel manuelt og avklar motoren med Bjørn.`
      : proposal.kind === 'complete' ? 'Vi fann eitt underbygd forslag. Kontroller at opplysningane stemmer.'
      : proposal.kind === 'choose-engine' ? 'Vi fann utgåva. Vel og kontroller motoren før du går vidare.'
      : proposal.kind === 'choose-generation' ? 'Vel utgåva som stemmer med bilen din. Førstegongs registrering er berre eit årshint.'
      : 'Vi fann ikkje eit sikkert forslag til heile bilen. Du kan fullføre bilvalet manuelt.';
    if (proposal.detailChecks?.failures.length) el('proposal-note').textContent += ' Nokre opplysningar kunne ikkje kontrollerast. Vel manuelt eller prøv igjen seinare.';
    if (proposal.detailChecks?.limitReached) el('proposal-note').textContent += ' Det er mange moglege alternativ. Avgrens bilvalet manuelt.';
    status('lookup-status', simulated ? 'TESTDATA – ingen faktisk bil er slått opp.' : 'Bilen er funnen. Kontroller bilvalet nedanfor.');
    render(cascade.snapshot());
  } catch (error) {
    if (version === revision && error.name !== 'AbortError') { resolving = false; lookupFailed = true; render(cascade.snapshot()); status('lookup-status', message(error), true); }
  }
}
el('registration').addEventListener('input', invalidate);
el('lookup-form').addEventListener('submit', event => {
  event.preventDefault(); if (el('lookup-button').disabled) return;
  const registration = el('registration').value.toUpperCase().replace(/ /g, '');
  if (!/^[A-Z0-9]{2,7}$/.test(registration)) { el('registration').setAttribute('aria-invalid', 'true'); status('lookup-status', messages['invalid-registration'], true); return; }
  el('registration').removeAttribute('aria-invalid'); lookup('/api/vehicle-lookup', { registration });
});
el('demo-button').addEventListener('click', () => lookup('/api/vehicle-demo', { scenario: el('demo-scenario').value }));
el('simulate-offer-failure').addEventListener('click',async()=>{
  try { await api('/api/vehicle-offer-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({failNext:true})});el('offer-test-status').textContent='Den neste testleveringa vil feile. Ingen ekte e-post er aktivert.'; }
  catch { el('offer-test-status').textContent='Kunne ikkje aktivere testfeilen.'; }
});
el('manual-button').addEventListener('click', async () => {
  invalidate(); manual = true; showAll = false; el('car-panel').hidden = false;
  el('proposal-note').textContent = 'Du kan velje bilen utan registreringsnummer.';
  if (!cascade.snapshot().rows.types.length) await cascade.start(); else render(cascade.snapshot());
  el('types').focus();
});
el('change-button').addEventListener('click', () => { revision++; controller?.abort(); resolving = false; manual = true; showAll = !showAll; cascade.change('engines', cascade.snapshot().selected.engines); el('proposal-note').textContent = 'Endre bilvalet. Kontroller utgåve og motor før du går vidare.'; });
for (const level of levels) el(level).addEventListener('change', async () => {
  const version = ++revision; controller?.abort(); resolving = false; manual = true;
  if (['types', 'manufacturers', 'models'].includes(level)) proposalPaths = [];
  await cascade.change(level, el(level).value);
  if (version !== revision) return;
  if (level === 'generations' && vehicle && !vehicle.requiresManual && proposalPaths.length) {
    const state = cascade.snapshot();
    // Ancestor edits clear proposalPaths. Never apply a previous car's evidence to another model.
    const paths = proposalPaths.filter(path => String(path.generation.id) === state.selected.generations);
    const assessment = assessEnginePaths(paths, vehicle);
    if (assessment.engine) await cascade.change('engines', String(assessment.engine.id));
  }
  if (version === revision) {
    const state = cascade.snapshot();
    const pending = levels.find(next => !state.selected[next]);
    const target = pending ? el(pending) : el('confirm-button');
    if (!target.disabled) target.focus();
  }
});
el('confirm-button').addEventListener('click', () => cascade.confirm());
el('retry-button').addEventListener('click', () => {
  const state = cascade.snapshot();
  if (state.selected.engines) cascade.confirm();
  else { const parent = [...levels].reverse().find(level => state.selected[level]); if (parent) cascade.change(parent, state.selected[parent]); else cascade.start(); }
});
try {
  const config = await api('/api/vehicle-test-status');
  el('environment').textContent = `VDB: ${config.vdbMode} · SVV: ${config.svvConfigured ? 'konfigurert' : 'ikkje konfigurert'}`;
  el('lookup-button').disabled = !config.svvConfigured; el('registration').disabled = !config.svvConfigured;
  el('svv-setup').hidden = config.svvConfigured;
  if (!config.svvConfigured) status('lookup-status', messages['svv-not-configured']);
  catalogSimulated = config.vdbMode === 'simulated';
  for (const scenario of config.scenarios) el('demo-scenario').add(new Option(scenario.name, scenario.id));
  await cascade.start();
} catch { status('lookup-status', 'Den lokale testserveren svarar ikkje. Sjå startkommandoen i LOCAL-VEHICLE-TEST.md.', true); }
