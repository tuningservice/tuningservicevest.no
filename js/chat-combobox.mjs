import {filterOptions} from './chat-dvx-options.mjs';
import {customerEngineName} from './vehicle-units.mjs';
// Compact editable selection. Typing/navigation never commits a first result.
export function createCarCombobox({id,label,rows,value='',disabled=false,onSelect}){
  const wrap=document.createElement('div');wrap.className='car-combobox';
  const caption=document.createElement('label');caption.htmlFor=id+'-search';caption.textContent=label;
  const control=document.createElement('div');control.className='car-combobox-control';
  const input=document.createElement('input');input.id=id+'-search';input.type='text';input.autocomplete='off';input.spellcheck=false;input.placeholder='Vel '+label.toLocaleLowerCase('nn-NO');input.disabled=disabled;
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-controls',id+'-options');input.setAttribute('aria-expanded','false');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='car-combobox-toggle';toggle.textContent='⌄';toggle.disabled=disabled;toggle.setAttribute('aria-label','Opne '+label.toLocaleLowerCase('nn-NO'));
  const list=document.createElement('ul');list.id=id+'-options';list.className='car-combobox-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',label);list.hidden=true;
  const status=document.createElement('p');status.className='sr-only';status.setAttribute('role','status');
  const chosen=rows.find(r=>String(r.id)===String(value)),display=r=>customerEngineName(r?.name||'');let filtered=rows,index=-1,open=false,query='';input.value=display(chosen);
  function close(){open=false;list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.value=display(chosen);query='';}
  function commit(row){close();onSelect(String(row.id));}
  function render(){
    filtered=filterOptions(rows.map(row=>({...row,name:display(row)})),query);list.replaceChildren();status.textContent=filtered.length?`${filtered.length} alternativ`:'Ingen treff. Prøv eit anna søk.';
    if(!filtered.length){const empty=document.createElement('li');empty.className='car-combobox-empty';empty.textContent='Ingen treff';empty.setAttribute('role','presentation');list.append(empty);}
    filtered.forEach((row,i)=>{const option=document.createElement('li');option.id=id+'-option-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected',String(String(row.id)===String(value)));option.dataset.active=String(i===index);option.textContent=display(row);option.addEventListener('mousedown',e=>e.preventDefault());option.addEventListener('click',()=>commit(row));list.append(option);});
    const active=index>=0?list.children[index]:null;if(active){input.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
  }
  function show(){if(disabled)return;open=true;query='';index=-1;list.hidden=false;input.setAttribute('aria-expanded','true');render();}
  toggle.addEventListener('click',()=>{input.focus();if(open)close();else{show();input.select();}});
  input.addEventListener('click',()=>{if(!open){show();input.select();}});
  input.addEventListener('input',()=>{query=input.value;index=-1;open=true;list.hidden=false;input.setAttribute('aria-expanded','true');render();});
  input.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&(open||event.key.startsWith('Arrow'))){event.preventDefault();if(!open)show();if(filtered.length){index=event.key==='Home'?0:event.key==='End'?filtered.length-1:event.key==='ArrowDown'?Math.min(index+1,filtered.length-1):Math.max(index-1,0);render();}}
    else if(event.key==='Enter'&&open){event.preventDefault();if(index>=0&&filtered[index])commit(filtered[index]);else if(filtered.length===1&&input.value.trim().toLocaleLowerCase('nn-NO')===display(filtered[0]).toLocaleLowerCase('nn-NO'))commit(filtered[0]);}
    else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}
    else if(event.key==='Tab')close();
  });
  wrap.addEventListener('focusout',event=>{if(!wrap.contains(event.relatedTarget))close();});
  control.append(input,toggle);wrap.append(caption,control,list,status);return wrap;
}
