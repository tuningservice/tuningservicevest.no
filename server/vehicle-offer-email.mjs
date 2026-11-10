const value = (item, unit='') => item == null || item === '' ? 'Ikkje oppgitt' : `${item}${unit ? ' '+unit : ''}`;
const escape = input => String(input).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderOfferEmail(envelope) {
  const choice=envelope.customerChoice, facts=envelope.registered?.data;
  const lines=[
    'LOKAL TEST – INGEN E-POST ER SEND',
    `Førespurnadstype: ${envelope.type}`, `Mottakar: ${envelope.to}`,
    `Nettside: ${envelope.site}`, `Tidspunkt (UTC): ${envelope.createdAt}`, `Referanse: ${envelope.id}`,
    '', 'KONTAKTOPPLYSNINGAR', `Namn: ${envelope.name || 'Ikkje oppgitt'}`,
    envelope.contact.kind==='phone' ? `Mobilnummer: ${envelope.contact.phone}` : `E-post: ${envelope.contact.email}`,
    `Reply-To: ${envelope.replyTo || 'Ikkje sett – kunden har berre oppgitt telefon'}`,
    '', 'REGISTRERINGSNUMMER', `Regnr: ${envelope.registration || 'Ikkje oppgitt'}`,
    `Kjelde for regnr: ${envelope.registrationSource==='synthetic-test-data'?'Fiktivt regnr i testdata – ikkje slått opp':envelope.registrationSource==='register-lookup'?'Brukt i registeroppslag':envelope.registration?'Oppgitt av kunden, ikkje kontrollert':'Ikkje oppgitt'}`,
    '', 'REGISTEROPPLYSNINGAR (SKILDE FRÅ KATALOG OG KUNDEVAL)',
  ];
  if(facts) {
    lines.push(`Kjelde: ${envelope.registered.simulated?'Syntetiske TESTDATA, ikkje eit faktisk registeroppslag':'Teknisk registeroppslag kontrollert på serveren'}`);
    for(const [label,item,unit] of [['Merke',facts.manufacturer],['Modell',facts.model],['Førstegongsregistrert (årshint)',facts.firstRegistered],['Drivstoff',facts.fuel],['Motorkode',facts.engineCode],['Slagvolum',facts.engineCc,'cm³'],['Registrert effekt',envelope.registered.powerHk,'HK'],['Girkasse',facts.gearbox]]) lines.push(`${label}: ${value(item,unit)}`);
    lines.push(`Manuell registeravklaring: ${facts.requiresManual?'Ja – '+facts.manualReasons.join(', '):'Ikkje flagga'}`);
  } else lines.push('Ingen verifiserte registeropplysningar.');
  lines.push('', 'KATALOGFORSLAG (IKKJE STADFESTA BILIDENTITET)');
  if(envelope.proposal) {
    if(envelope.proposal.kind==='unavailable') lines.push('Katalogtenesta kunne ikkje kontrollerast. Ingen katalogmatch er stadfesta.');
    lines.push(`Forslåtte ID-ar: ${Object.entries(envelope.proposal.selections).map(([level,id])=>`${level}=${id}`).join(', ') || 'Ingen sikre forslag'}`);
    for(const candidate of envelope.proposal.candidates) lines.push(`Alternativ: ${candidate.generation} [${candidate.generationId}] / ${candidate.engine} [${candidate.engineId}]`);
  } else lines.push('Ingen automatisk katalogkopling.');
  lines.push('', 'KUNDEN SITT VAL', `Bilvariant: ${choice.status==='confirmed'?'Kunden har stadfesta katalogvalet':'UAVKLART – Bjørn må avklare varianten'}`);
  for(const [level,row] of Object.entries(choice.selection)) lines.push(`${({types:'Type',manufacturers:'Merke',models:'Modell',generations:'Utgåve',engines:'Motor'})[level]}: ${row.name} [ID ${row.id}]`);
  if(!Object.keys(choice.selection).length) lines.push('Ingen katalogvariant vald.');
  if(choice.unverifiedIds) lines.push('Kunden sine katalog-ID-ar (IKKJE kontrollerte, varianten er uavklart): '+Object.entries(choice.unverifiedIds).map(([level,id])=>`${level}=${id}`).join(', '));
  if(choice.effect) {
    const effect=choice.effect, stage=effect.stage;
    lines.push('', 'KATALOGTAL KONTROLLERTE PÅ SERVEREN', `Original: ${value(effect.original.powerHk,'HK')} / ${value(effect.original.torqueNm,'Nm')}`,
      `Valt steg: ${stage ? stage.number==null?'Tuningalternativ utan oppgitt stegnummer':`Stage ${stage.number}`:'Ikkje valt / ikkje tilgjengeleg'}`);
    if(stage) lines.push(`Etter tuning: ${value(stage.powerHk,'HK')} / ${value(stage.torqueNm,'Nm')}`,
      `Auke: ${effect.original.powerHk!=null&&stage.powerHk!=null?value(stage.powerHk-effect.original.powerHk,'HK'):'Ikkje oppgitt'} / ${effect.original.torqueNm!=null&&stage.torqueNm!=null?value(stage.torqueNm-effect.original.torqueNm,'Nm'):'Ikkje oppgitt'}`,
      `Krav til oppsett: ${stage.hardwareRequirements || 'Ikkje oppgitt – må avklarast'}`);
    lines.push('Rettleiande effekt. Resultatet avheng av bilen sin tilstand og oppsett.');
  } else lines.push('Tuningsteg og effekt er uavklart. Ingen tal er gjetta.');
  lines.push('', 'MELDING FRÅ KUNDEN', envelope.message || 'Ikkje oppgitt.', '', 'Individuelt pristilbod frå Bjørn. Ingen automatisk pris.');
  const text=lines.join('\n');
  return {to:envelope.to,replyTo:envelope.replyTo,subject:'[LOKAL TEST] Tilbodsførespurnad – Tuningservice Vest',text,
    html:`<!doctype html><html lang="nn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Simulert tilbodsførespurnad</title><link rel="stylesheet" href="/css/vehicle-offer-preview.css"></head><body><main><h1>Førehandsvisning av e-post</h1><p>Berre fiktive kontaktopplysningar. Ingen levering er utført.</p><pre>${escape(text)}</pre></main></body></html>`};
}
