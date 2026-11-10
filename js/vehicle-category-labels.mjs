// Presentation only: keep supplier names and actual IDs intact for matching.
const labels=new Map([
  ['cars & lcv','Personbilar og varebilar'],
  ['trucks & buses','Lastebilar og bussar'],
  ['agriculture','Traktor og landbruk'],
  ['marine','Båt og marine'],
  ['motorcycles & atvs','Motorsyklar og ATV'],
]);
export function vehicleCategoryLabel(name){return labels.get(String(name??'').trim().replace(/\s+/g,' ').toLowerCase())??String(name??'');}

// Only the verified Cars & LCV category is covered by the pinned primary export.
// Category IDs come from the server, never from translated labels or constants.
export function manualCategoryRoute(row,preferred='dvx'){
 if(!row?.id||!row?.name)return null;
 return {id:String(row.id),name:row.name,source:preferred==='dvx'&&/^Cars\s*&\s*LCV$/i.test(row.name.trim())?'dvx':'vdb'};
}
