const topics=new Set(['Generell førespurnad','Diagnose','Utleige','Byte av 78 mm hjullager']);
export function contactEntryMessage(search=''){
 const params=new URLSearchParams(search),topic=params.get('emne');
 if(!topics.has(topic))return '';
 const equipment=(params.get('utstyr')??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,160);
 return 'Emne: '+topic+(topic==='Utleige'&&equipment?'\nUtstyr: '+equipment:'');
}
export function combineContactMessage(current,initial){
 if(!initial||current.includes(initial))return {value:current,tooLong:false};
 const value=initial+(current.trim()?'\n\n'+current:'');
 return value.length<=3000?{value,tooLong:false}:{value:current,tooLong:true};
}
export function mountContactEntries({open,doc=document,location=window.location}){
 const initialMessage=contactEntryMessage(location.search);
 for(const button of doc.querySelectorAll('[data-open-contact]'))button.addEventListener('click',()=>open(initialMessage));
 if(initialMessage&&location.hash==='#contact')open(initialMessage);
}
