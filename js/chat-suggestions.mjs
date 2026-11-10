export function chatSuggestions(active={}){
 const known=!!(active.result||active.registered),last=active.selectedServices?.at(-1)??active.selectedService;
 const primary=known?[{label:'Kva anbefaler de?',question:'Kva anbefaler de ut frå dei stadfesta opplysningane?'}]:[{label:'Kva kan de hjelpe med?',question:'Kva kan de hjelpe med?'}];
 if(last)primary.push({label:'Kva inneber dette?',question:'Kva inneber '+last.label+' for dette oppsettet?'});
 else if(known&&active.result?.stages.length>1)primary.push({label:'Kva er skilnaden på stega?',question:'Kva er skilnaden på dei tilgjengelege tuningstega for dette oppsettet?'});
 else primary.push({label:'Korleis fungerer tuning?',question:'Korleis fungerer tuning'+(known?' for dette oppsettet':'')+'?'});
 primary.push({label:'Få tilbod',action:'contact'});
 return {primary,more:[{label:'Kva med garanti?',question:'Kva med garanti ved tuning?'},{label:'Må oppsettet vere originalt?',question:'Må oppsettet vere originalt før tuning?'}]};
}
