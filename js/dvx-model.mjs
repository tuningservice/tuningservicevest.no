// DVX-only view helpers. No matching or shared Tuningfiles IDs.
export function groupVariants(records) {
  const grouped = new Map();
  for (const record of records) {
    if (record.namespace !== 'dvx' || !record.vehicleId?.startsWith('dvx:variant:')) throw new Error('Ugyldig DVX-namnerom.');
    if (!grouped.has(record.vehicleId)) grouped.set(record.vehicleId, []);
    grouped.get(record.vehicleId).push(record);
  }
  return [...grouped].map(([id, stages]) => ({ id, stages: stages.sort((a,b) => a.stage.number-b.stage.number) }));
}
export function preferredStage(stages) { return stages.find(s => s.stage.number === 1 && !s.stage.qualifier) ?? stages[0] ?? null; }
export function dvxVariantFacts(record){
  const name=record.engineDesignation;
  return {manufacturer:record.brand,fuel:record.fuel,gearbox:record.gearboxVariant||(/\b(?:DSG|S[ -]?tronic|tiptronic|automaat|automatic)\b/i.test(name)?'automatic':/\b(?:manual|manueel)\b/i.test(name)?'manual':null),
    systems:{dpf:/\bNO\s*DPF\b/i.test(name)?false:/\bDPF\b/i.test(name)?true:null,gpf:/\b(?:GPF|OPF)\b/i.test(name)?true:null}};
}
export function displayNumber(value) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('nn-NO',{maximumFractionDigits:2}).format(value) : 'Ikkje oppgitt'; }
export function effectView(original, tuned, unit) {
  const known = v => typeof v === 'number' && Number.isFinite(v);
  return { original: displayNumber(original)+(known(original)?' '+unit:''), tuned:displayNumber(tuned)+(known(tuned)?' '+unit:''),
    increase:known(original)&&known(tuned)?(tuned-original>=0?'+':'')+displayNumber(tuned-original)+' '+unit:'Auke ikkje oppgitt' };
}
export function requirementsView(record) {
  const items=record.requirements.items;
  const describe = item => (item.nn==='Teknisk punkt må kontrollerast mot originalteksten.'?item.raw+' (norsk attgiving ikkje kontrollert)':item.nn)+(item.needsReview?' Må kontrollerast mot kjelda.':'');
  const category = name => items.filter(item=>item.category===name && (name!=='required'||item.domain!=='gearbox-software')).map(describe);
  return [
    ['Påkravde hardwareendringar',category('required'),'Ikkje uttrykkeleg oppgitt. Dette betyr ikkje at ingen endringar er nødvendige.'],
    ['Oppgitt som del av steget',category('included_unclassified'),'Ikkje oppgitt.'],
    ['Valfrie endringar',category('optional'),'Ikkje oppgitt.'],
    ['Anbefalte endringar',category('recommended'),'Ikkje oppgitt.'],
    ['Programvare',category('software_included').concat(items.filter(item=>item.domain==='gearbox-software').map(describe)),'Ikkje oppgitt.'],
    ['Andre føresetnader',record.requirements.conditional.map(x=>x.nn).concat(record.requirements.fuelConditions.map(x=>x.nn||x.raw+' – drivstoffkravet må kontrollerast.')).concat(record.requirements.previousStageContext?['Samanhengen med grunnsteget må kontrollerast; øvrige krav er ikkje automatisk arva.']:[]),'Drivstoffkrav og andre føresetnader er ikkje oppgitt.'],
  ];
}
