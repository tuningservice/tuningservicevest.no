// Presentation only: raw requirements remain in the result for traceability and AI.
export const visibleRequirements=stage=>String(stage.code)==='1'?[]:(stage.requirements??[]).filter(([,items])=>items?.length);
// No generated curves, interpolation, sorting, padding or cross-source fallbacks.
export const GRAPH_NOTES={curves:'Rettleiande leverandørkurver – ikkje ei individuell måling',peaks:'Oppgitt maksimal effekt og dreiemoment'};
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export const displayNumber=v=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('nn-NO',{maximumFractionDigits:1}).format(v):'Ikkje oppgitt';
function vector(raw){
  if(raw===null||raw===undefined||raw==='')return {state:'missing',values:[]};
  if(typeof raw!=='string'||raw.length>16000)return {state:'invalid',values:[]};
  const tokens=raw.split(',');if(tokens.length<2||tokens.length>512)return {state:'invalid',values:[]};
  const values=[];
  for(const token of tokens){const value=token.trim();if(value===''){values.push(null);continue;}if(!/^\d+(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value)))return {state:'invalid',values:[]};values.push(Number(value));}
  return {state:'ok',values};
}
export function normalizeVdbCurves(block={},engine=block,{ownership='original'}={}){
  const rpm=vector(Object.hasOwn(block,'rpm_values')?block.rpm_values:engine.rpm_values);
  const result={source:'vdb',ownership,rpmSource:block===engine?'engine':Object.hasOwn(block,'rpm_values')?'stage':'engine-shared',series:[],issues:[]};
  for(const [field,metric,unit] of [['hp_values','powerHk','HK'],['nm_values','torqueNm','Nm']]){
    const values=vector(block[field]);if(values.state==='missing')continue;
    if(values.state!=='ok'){result.issues.push(metric+':invalid-values');continue;}
    if(rpm.state!=='ok'||rpm.values.some((v,i,a)=>v===null||v>30000||i>0&&v<=a[i-1])){result.issues.push(metric+':invalid-rpm');continue;}
    if(values.values.length!==rpm.values.length){result.issues.push(metric+':length-mismatch');continue;}
    // Zero meanings are undocumented. Keep their positions as gaps, never as measured zeroes.
    const points=values.values.map((value,i)=>({rpm:rpm.values[i],value:value>0?value:null}));
    if(points.filter(p=>p.value!==null).length<2){result.issues.push(metric+':insufficient-points');continue;}
    result.series.push({metric,unit,points});
    if(points.some(p=>p.value===null))result.issues.push(metric+':unknown-points-omitted');
  }
  return result;
}
export function curveSegments(points){
  const segments=[];let segment=[];
  for(const p of points){if(p.value===null){if(segment.length)segments.push(segment);segment=[];}else segment.push(p);}if(segment.length)segments.push(segment);return segments;
}
function safeSeries(curves,source,ownership){
  if(!curves||curves.source!==source||curves.ownership!==ownership)return [];
  return (curves.series||[]).filter(s=>['powerHk','torqueNm'].includes(s.metric)&&s.unit===(s.metric==='powerHk'?'HK':'Nm')&&Array.isArray(s.points)&&s.points.length<=512&&s.points.length>=2&&s.points.every((p,i,a)=>finite(p.rpm)&&p.rpm<=30000&&(i===0||p.rpm>a[i-1].rpm)&&(p.value===null||finite(p.value)&&p.value>0))&&s.points.filter(p=>p.value!==null).length>=2).map(s=>({...structuredClone(s),ownership}));
}
export function makeGraphModel(result,stage){
  if(!stage||stage.source!==result.source||!result.stages.some(s=>s.key===stage.key))throw new Error('Graph stage/source mismatch.');
  const metrics=[['powerHk','Effekt','HK'],['torqueNm','Dreiemoment','Nm']].map(([key,label,unit])=>{
    const original=finite(stage.original?.[key])?stage.original[key]:null,tuned=finite(stage.tuned?.[key])?stage.tuned[key]:null;
    return {key,label,unit,original,tuned,increase:original!==null&&tuned!==null?Math.round((tuned-original)*10)/10:null};
  });
  // DVX snapshot has no documented RPM data. Ignore any incidental curve fields there.
  const curves=result.source==='vdb'?[...safeSeries(stage.curves?.original,'vdb','original'),...safeSeries(stage.curves?.tuned,'vdb','stage')]:[];
  const issues=[...(stage.curves?.original?.issues||[]),...(stage.curves?.tuned?.issues||[])];
  return {title:result.label,stage:stage.label,stageKey:stage.key,source:result.source,sourceLabel:result.sourceLabel,brand:structuredClone(result.brand??null),simulated:!!result.simulated,
    snapshot:structuredClone(result.snapshot??null),metrics,curves,mode:curves.length?'curves':'peaks',note:curves.length?GRAPH_NOTES.curves:GRAPH_NOTES.peaks,
    detailNote:issues.some(s=>s.includes('length-mismatch'))?'Nokre kurveseriar har ulik lengd og er ikkje viste. Tuningens makstal blir viste som søyler.':curves.length&&!curves.some(s=>s.ownership==='stage')?'Berre originalkurver er tilgjengelege. Valt steg blir samanlikna med søyler.':null,
    requirements:structuredClone(visibleRequirements(stage)),road:structuredClone(stage.road??[])};
}
export function axisLimit(values){const max=Math.max(0,...values.filter(finite));if(!max)return 10;const raw=max/4,mag=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(n=>n*mag).find(n=>n>=raw)||10*mag;return Math.ceil(max/step)*step;}
export function makeCustomerSummaryModel(result,stage){
 const model=makeGraphModel(result,stage);
 // Supplier RPM vectors are not evidence of a measured dyno run on this car.
 // Keep them internally; the customer comparison and its PNG use maxima only.
 return {...model,presentation:'customer-summary',curves:[],mode:'peaks',detailNote:null,
  note:'Rettleiande effekt – ikkje ei individuell måling.',
  basis:result.source==='tsv'?result.customerBasis:'Typiske leverandøroppgitte katalogverdiar. Ikkje eigne rullevegmålingar. Resultatet avheng av tilstand og oppsett.'};
}
export function createGraphLifetime(){let version=0,disposed=false;return {begin:()=>++version,isCurrent:token=>!disposed&&token===version,dispose(){disposed=true;version++;}};}
