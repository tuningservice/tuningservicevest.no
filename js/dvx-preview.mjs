import {groupVariants,preferredStage,effectView,requirementsView} from './dvx-model.mjs';
const $=id=>document.getElementById(id);
const make=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
let variants=[];
function populate(selected){
  const terms=$('dvx-search').value.toLocaleLowerCase('nn-NO').trim().split(/\s+/).filter(Boolean);
  const visible=variants.filter(v=>{const r=v.stages[0],text=[r.brand,r.model,r.generation,r.engineDesignation,r.original.powerHk].join(' ').toLocaleLowerCase('nn-NO');return terms.every(t=>text.includes(t));});
  $('dvx-vehicle').replaceChildren(...visible.map(v=>{const r=v.stages[0],o=make('option',`${r.brand} ${r.model} · ${r.generation} · ${r.engineDesignation} · ${effectView(r.original.powerHk,null,'HK').original}`);o.value=v.id;return o;}));
  if(visible.some(v=>v.id===selected))$('dvx-vehicle').value=selected;
  $('dvx-vehicle').disabled=!visible.length;$('load-status').textContent=`${visible.length} av ${variants.length} henta motorvariantar · sjå dekningsstatus over`;
  selectVehicle();
}
function render(record) {
  $('result-title').textContent=`${record.brand} ${record.model} · ${record.engineDesignation}`;
  $('vehicle-period').textContent=record.generation+' · oppgitt årsperiode, ikkje stadfesta årsmodell for ein kundebil';
  $('stage-heading').textContent=record.stage.labelRaw;
  for(const tab of $('dvx-stages').children){const selected=tab.dataset.recordId===record.id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected)$('dvx-stage-panel').setAttribute('aria-labelledby',tab.id);}
  $('dvx-effects').replaceChildren(...[['Effekt','powerHk','HK'],['Dreiemoment','torqueNm','Nm']].map(([label,key,unit])=>{
    const value=effectView(record.original[key],record.tuned[key],unit),card=make('div',undefined,'effect-card');
    card.append(make('h4',label),make('strong',`${value.original} → ${value.tuned}`,'effect-transition'),make('p',value.increase,'effect-increase'));return card;
  }));
  $('dvx-requirements').replaceChildren(...requirementsView(record).map(([heading,items,fallback])=>{
    const group=make('section',undefined,'requirement-group');group.append(make('h4',heading));
    if(items.length){const list=make('ul');list.append(...items.map(item=>make('li',item)));group.append(list);}else group.append(make('p',fallback));return group;
  }));
  const road=record.roadUse.items.concat(record.roadUse.catalogNotices??[]);
  $('road-warning').hidden=!road.length;
  $('road-warning').textContent=road.map(item=>item.nn).join(' ');
  $('dvx-source').href=record.source.url;$('source-time').textContent='Henta '+new Date(record.source.retrievedAt).toLocaleString('nn-NO');
  const facts=[['DVX-ID',record.id],['Kjeldeeining',record.original.powerSource.unit],['Drivstoff',record.fuel],['Motorkode',record.engineCode],['Girkassevariant',record.gearboxVariant],['Kjelde-ID-ar',JSON.stringify(record.sourceIds)]];
  $('dvx-facts').replaceChildren(...facts.flatMap(([label,value])=>[make('dt',label),make('dd',value??'Ikkje oppgitt')]));
  const raw=record.requirements.items.map(x=>x.raw).concat(record.requirements.conditional.map(x=>x.raw),record.requirements.fuelConditions.map(x=>x.raw),record.roadUse.items.map(x=>x.raw));
  $('original-requirements').replaceChildren(make('h3','Original teknisk ordlyd'),make('p',raw.join('\n\n'),'raw-text'));
  $('dvx-result').hidden=false;
}
function selectVehicle() {
  const variant=variants.find(v=>v.id===$('dvx-vehicle').value);$('dvx-result').hidden=true;
  if(!variant)return;
  $('dvx-stages').replaceChildren(...variant.stages.map((record,i)=>{
    const tab=make('button',record.stage.labelRaw);tab.type='button';tab.id='dvx-tab-'+i;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','dvx-stage-panel');tab.dataset.recordId=record.id;tab.addEventListener('click',()=>render(record));
    tab.addEventListener('keydown',event=>{
      const tabs=[...$('dvx-stages').children];let next;
      if(event.key==='ArrowRight')next=(i+1)%tabs.length;if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();tabs[next].click();tabs[next].focus();}
    });return tab;
  }));
  const unavailable=[...new Set(variant.stages.flatMap(r=>r.advertisedStages.filter(s=>s.status!=='parsed').map(s=>s.advertisedLabel)))];
  $('unfetched-stages').textContent=unavailable.length?unavailable.join(', ')+': lenkje funnen, men sida er ikkje henta. Ingen effekt- eller hardwaretal blir viste for dette steget.':'';
  render(preferredStage(variant.stages));
}
async function start(){try{
  const [response,coverageResponse]=await Promise.all([fetch('/data/dvx/catalog.json',{cache:'no-store'}),fetch('/data/dvx/coverage.json',{cache:'no-store'})]);if(!response.ok||!coverageResponse.ok)throw new Error();
  const data=await response.json(),coverage=await coverageResponse.json(),selected=$('dvx-vehicle').value;variants=groupVariants(data.records);
  $('coverage-title').textContent=coverage.complete?'Alle lenkjer i det oppgitte omfanget er behandla.':'Innsamlinga er ikkje fullført.';
  const pending=coverage.crawl?.counts?.pending,halt=coverage.crawl?.halt;
  $('coverage-note').textContent=`${coverage.motorVariants} motorvariantar og ${coverage.stageRecords} stegoppføringar frå ${coverage.brandsRepresented.length} merke. `+(halt?'Innsamlinga har stansa: '+halt.reason+'. ':pending!==undefined?pending+' oppdaga lenkjer ventar. ':'')+`Parserfeil: ${coverage.errors.length}. Sidefeil: ${coverage.pageErrors?.length??0}. `;
  populate(selected);
}catch{$('load-status').textContent='Kunne ikkje lese lokale DVX-data. Køyr importskriptet og prøv igjen.';$('load-status').dataset.error='true';}}
$('dvx-vehicle').addEventListener('change',selectVehicle);$('dvx-search').addEventListener('input',()=>populate($('dvx-vehicle').value));$('dvx-refresh').addEventListener('click',start);
start();
