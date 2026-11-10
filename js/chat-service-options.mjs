import {offeredServiceOptions} from './vehicle-service-options.mjs';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export function createServiceOptions(facts,onSelect,selectedId=null,onAsk=()=>{}){
  const section=make('details',null,'service-options'),options=offeredServiceOptions(facts),selected=new Set(Array.isArray(selectedId)?selectedId:selectedId?[selectedId]:[]);
  section.hidden=options.length===0;section.setAttribute('aria-label','Andre tenester');
  section.append(make('summary','Andre tenester'),make('p','Vel eitt eller fleire tilval. Støtte blir avklart for ditt oppsett.','help'));
  const buttons=[];
  function action(option){
    const b=make('button',option.label,'secondary-button service-option');b.type='button';b.dataset.service=option.id;b.setAttribute('aria-pressed',String(selected.has(option.id)));
    b.addEventListener('click',()=>{const next=new Set(selected),wasSelected=next.has(option.id);if(wasSelected)next.delete(option.id);else next.add(option.id);if(onSelect(option,[...next])!==true)return;selected.clear();for(const id of next)selected.add(id);for(const item of buttons)item.setAttribute('aria-pressed',String(selected.has(item.dataset.service)));onAsk([option],{selected:!wasSelected});});
    buttons.push(b);return b;
  }
  const relevant=options.filter(o=>o.scope!=='general-equipment-unverified'),general=options.filter(o=>o.scope==='general-equipment-unverified');
  const primary=make('div',null,'actions');primary.append(...relevant.slice(0,5).map(action));section.append(primary);
  const more=make('details'),summary=make('summary','Sjå fleire moglegheiter');more.append(summary);
  if(relevant.length>5){const rest=make('div',null,'actions');rest.append(...relevant.slice(5).map(action));more.append(rest);}
  if(general.length){more.append(make('p','Moglegheiter som må avklarast','service-group-title'),make('p','Vi tilbyr desse generelt. Drivstoff, utstyr og støtte må avklarast.','help'));const rest=make('div',null,'actions');rest.append(...general.map(action));more.append(rest);}
  if(relevant.length>5||general.length)section.append(more);
  return section;
}
