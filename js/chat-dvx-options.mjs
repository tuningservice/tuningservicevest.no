const names={brand:'Merke',model:'Modell',generation:'Utgåve',variant:'Motor'};
export const dvxLevels=['brand','model','generation','variant'];
export const dvxLevelNames=names;
export const displayDvxGeneration=value=>String(value??'').replace(/\s*(?:->|→)\s*/g,'–').replace(/\bMid\s+(\d{4})/gi,'midten av $1').replace(/(?:\.\.\.|heden|present)$/i,'').replace(/–0$/,'–').trim();
export function dvxOptions(groups,selection,level){
  const index=dvxLevels.indexOf(level);if(index<0)throw new Error('Invalid DVX level.');
  const parents=dvxLevels.slice(0,index);
  const rows=groups.filter(g=>{const r=g.stages[0];return parents.every(parent=>!selection[parent]||r[parent]===selection[parent]);});
  if(level==='variant')return rows.map(g=>{const r=g.stages[0];return {id:g.id,name:[r.engineDesignation,typeof r.original.powerHk==='number'?r.original.powerHk+' HK':null,typeof r.original.torqueNm==='number'?r.original.torqueNm+' Nm':null,r.fuel].filter(Boolean).join(' · ')};});
  return [...new Set(rows.map(g=>g.stages[0][level]))].filter(Boolean).map(value=>({id:value,name:level==='generation'?displayDvxGeneration(value):value}));
}
export function changeDvxSelection(selection,level,value){const index=dvxLevels.indexOf(level);if(index<0)throw new Error('Invalid DVX level.');const next={...selection,[level]:value};for(const child of dvxLevels.slice(index+1))delete next[child];return next;}
export function filterOptions(rows,query){const terms=String(query||'').toLocaleLowerCase('nn-NO').trim().split(/\s+/).filter(Boolean);return rows.filter(r=>terms.every(t=>r.name.toLocaleLowerCase('nn-NO').includes(t)));}
