import {makeGraphModel,makeCustomerSummaryModel,displayNumber,axisLimit,createGraphLifetime,GRAPH_NOTES} from './effect-graph-model.mjs';
import {barScene,curveScene,sceneToSvg,exportScene,paintScene} from './effect-graph-scene.mjs';
import {brandLogoPath} from './vehicle-brand.mjs';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const unit=(v,u)=>v===null?'Ikkje oppgitt':displayNumber(v)+' '+u;
export async function loadGraphImages(model,{fetchImpl=fetch,decode=createImageBitmap}={}){
  const result={};await Promise.all(['watermark','brand'].map(async key=>{const path=key==='watermark'?'/img/logo-transparent.png':brandLogoPath(model.brand);if(!path)return;
    try{const response=await fetchImpl(path,{signal:AbortSignal.timeout(10000)});if(response.ok)result[key]=await decode(await response.blob());}catch{} }));return result;
}
export function createEffectGraph(result,stage,{compact=false,customerSummary=false}={}){
  const model=customerSummary?makeCustomerSummaryModel(result,stage):makeGraphModel(result,stage),life=createGraphLifetime(),root=make('section',undefined,customerSummary?'effect-graph customer-comparison':'effect-graph');root.setAttribute('aria-label','Graf for '+model.title+' · '+model.stage);
  const head=make('div',undefined,'effect-graph-heading'),heading=make('h3','Effekt og dreiemoment'),download=make('button','Last ned graf');download.type='button';download.className='secondary-button';head.append(heading,download);root.append(head);
  if(model.simulated)root.append(make('p','TESTDATA – simulert grafgrunnlag','notice'));
  let observer=null;
  if(customerSummary){
    head.remove();
    root.append(make('p','Rettleiande effekt','comparison-note'),make('p',model.basis,'comparison-basis'));
    for(const m of model.metrics){const row=make('div',undefined,'comparison-metric');row.append(make('h3',m.label));
      const values=make('p',undefined,'comparison-values'),original=make('span',m.original===null?'Ikkje oppgitt':displayNumber(m.original)+' '+m.unit),after=make('strong',m.tuned===null?'Ikkje oppgitt':'opp til ca. '+displayNumber(m.tuned)+' '+m.unit);
      values.append(original,make('span','→','comparison-arrow'),after);row.append(values);
      const bars=make('div',undefined,'comparison-bars');bars.setAttribute('aria-hidden','true');const limit=axisLimit([m.original,m.tuned]);for(const [key,v]of [['original',m.original],['tuned',m.tuned]])if(v!==null){const bar=make('span',undefined,key);bar.style.width=(v/limit*100)+'%';bars.append(bar);}row.append(bars);root.append(row);
    }
    root.append(make('p','Original → '+stage.label+' · grå: original · grøn: tuning','comparison-legend'));
  }else{
  if(!compact){root.append(make('p',model.note,'graph-caption'));if(model.detailNote)root.append(make('p',model.detailNote,'help'));}
  const curves=make('div',undefined,'curve-plot'),bars=make('div',undefined,'bar-plots');if(model.curves.length){if(compact){const extra=make('details',undefined,'curve-details');extra.append(make('summary','Vis turtalskurver'),make('p',model.note,'graph-caption'),curves);root.append(extra);}else root.append(curves,make('p',GRAPH_NOTES.peaks,'graph-caption'));}root.append(bars);
  function render(){const style=getComputedStyle(root),available=root.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0),width=Math.max(280,Math.min(1000,available||800)),split=width>=(compact?460:650);if(model.curves.length)curves.replaceChildren(sceneToSvg(curveScene(model,width)));const barWidth=split?(width-16)/2:width;bars.replaceChildren(...model.metrics.map(m=>sceneToSvg(barScene(m,model.stage,barWidth,{compact}))));bars.dataset.columns=split?'2':'1';}
  render();observer=new ResizeObserver(render);observer.observe(root);
  const details=make('details',undefined,'graph-data'),summary=make('summary','Vis talgrunnlaget som tabell');details.append(summary);
  const table=make('table'),caption=make('caption',GRAPH_NOTES.peaks),thead=make('thead'),row=make('tr');
  for(const h of ['Måling','Original',model.stage,'Auke']){const th=make('th',h);th.scope='col';row.append(th);}thead.append(row);const tbody=make('tbody');
  for(const m of model.metrics){const row=make('tr'),name=make('th',m.label+' ('+m.unit+')');name.scope='row';row.append(name,make('td',unit(m.original,m.unit)),make('td',unit(m.tuned,m.unit)),make('td',m.increase===null?'Ikkje oppgitt':(m.increase>0?'+':'')+displayNumber(m.increase)+' '+m.unit));tbody.append(row);}table.append(caption,thead,tbody);details.append(table);
  if(model.curves.length){const ct=make('table'),ch=make('tr');ct.append(make('caption','Leverandørkurver · tomme/nullplasshaldarar er ikkje målepunkt'));for(const label of ['o/min',...model.curves.map(c=>(c.ownership==='stage'?model.stage:'Original')+' '+c.unit)]){const th=make('th',label);th.scope='col';ch.append(th);}const th=make('thead');th.append(ch);ct.append(th);const cb=make('tbody');
    const rpms=[...new Set(model.curves.flatMap(c=>c.points.map(p=>p.rpm)))].sort((a,b)=>a-b);for(const rpm of rpms){const row=make('tr');row.append(make('th',displayNumber(rpm)));for(const c of model.curves)row.append(make('td',displayNumber(c.points.find(p=>p.rpm===rpm)?.value??null)));cb.append(row);}ct.append(cb);details.append(ct);}
  root.append(details);
  }
  const status=make('p','','help');status.setAttribute('role','status');root.append(status);
  download.addEventListener('click',async()=>{
    const token=life.begin();download.disabled=true;status.textContent='Lagar PNG …';let images={};
    try{
      await document.fonts.ready;images=await loadGraphImages(model);if(!life.isCurrent(token)||!root.isConnected)return;if(!images.watermark)throw new Error('watermark-unavailable');
      const scene=exportScene(model),canvas=document.createElement('canvas');canvas.width=scene.width;canvas.height=scene.height;paintScene(canvas.getContext('2d'),scene,images);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!life.isCurrent(token)||!root.isConnected)return;if(!blob)throw new Error('png-failed');
      const url=URL.createObjectURL(blob),a=document.createElement('a'),slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\+/g,'plus').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,115).toLowerCase();
      a.href=url;a.download=slug('Tuningservice '+model.title)+'-'+slug(model.stage)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent=images.brand||!brandLogoPath(model.brand)?'PNG er klar. Grafen gjeld valet og steget ovanfor.':'PNG er klar med merkenamn. Merke­logoen kunne ikkje lastast.';
    }catch{if(life.isCurrent(token))status.textContent='PNG kunne ikkje lagast. Prøv igjen.';}
    finally{Object.values(images).forEach(image=>image.close?.());if(life.isCurrent(token))download.disabled=false;}
  });
  return {element:root,model,dispose(){life.dispose();observer?.disconnect();download.disabled=true;}};
}
