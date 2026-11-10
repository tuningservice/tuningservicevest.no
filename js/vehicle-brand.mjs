import {assistantApiPath} from './assistant-api-path.mjs';
const id=v=>/^[1-9]\d{0,11}$/.test(String(v??''));
// Reviewed against real /vdb/manufacturers/1 on 2026-10-25, data/graph-audit/vdb-sample.json.
// This is only a manufacturer crosswalk, never a vehicle/engine/Stage ID crosswalk.
const reviewedDvxBrands={Audi:{id:'1088',name:'Audi'},BMW:{id:'1262',name:'BMW'},Volvo:{id:'2997',name:'Volvo'}};
export function brandForVdb(rows,selected){
  const manufacturer=rows.manufacturers?.find(r=>String(r.id)===selected.manufacturers);
  return manufacturer&&id(manufacturer.id)&&id(selected.types)?{namespace:'tuningfiles',manufacturerId:String(manufacturer.id),typeId:selected.types,name:manufacturer.name,logoAvailable:!!manufacturer.brandLogo}:null;
}
export function brandForDvx(canonicalBrand){const m=Object.hasOwn(reviewedDvxBrands,canonicalBrand)?reviewedDvxBrands[canonicalBrand]:null;return m?{namespace:'tuningfiles',manufacturerId:m.id,typeId:'1',name:m.name,logoAvailable:true,association:'reviewed-dvx-brand-only',dvxBrand:canonicalBrand}:canonicalBrand?{namespace:'dvx',name:canonicalBrand,logoAvailable:false}:null;}
export function brandLogoPath(brand){return brand?.namespace==='tuningfiles'&&brand.logoAvailable&&id(brand.manufacturerId)&&id(brand.typeId)?assistantApiPath('/api/vehicle-brand-logo?typeId='+brand.typeId+'&id='+brand.manufacturerId):null;}
export function createBrandBadge(brand){
  const wrap=document.createElement('div');wrap.className='vehicle-brand';if(!brand)return wrap;
  const name=document.createElement('strong');name.textContent=brand.name;wrap.append(name);
  const src=brandLogoPath(brand);if(src){const frame=document.createElement('span');frame.className='vehicle-brand-image';frame.hidden=true;const image=document.createElement('img');image.alt='';image.width=70;image.height=44;image.addEventListener('load',()=>{frame.hidden=false;});image.addEventListener('error',()=>{frame.remove();});image.src=src;frame.append(image);wrap.prepend(frame);}return wrap;
}
