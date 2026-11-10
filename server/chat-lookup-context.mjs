import {needsBaseVehicle,baseVehicleOptions} from '../js/vehicle-base.mjs';
import {randomUUID} from 'node:crypto';
// Bounded local RAM. Only normalized technical data and a separate private regnr
// are retained; no raw response, VIN or owner data.
// Browser sends an opaque token; it cannot assert register facts of its own.
export function createChatLookupContext({now=()=>Date.now(),uuid=randomUUID,ttlMs=1800000,limit=100,savedEntries=[]}={}){
  const entries=new Map(savedEntries);
  function expire(){for(const [key,entry]of entries)if(entry.expires<=now())entries.delete(key);}
  function remember(result,registration=null){
    if(!result?.vehicle||typeof result.vehicle!=='object')return result;
    expire();while(entries.size>=limit)entries.delete(entries.keys().next().value);
    const vehicle={};
    for(const key of ['manufacturer','model','fuel','engineCode','gearbox','vehicleCategory','hybridStatus','hybridCategory','firstRegistered','firstRegisteredNorway','registrationDateStatus','typeCode','variantCode','versionCode','emissionClass','emissionCode']){
      const value=result.vehicle[key];vehicle[key]=typeof value==='string'?value.slice(0,400):null;
    }
    for(const key of ['engineKw','engineCc']){const value=result.vehicle[key];vehicle[key]=typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
    vehicle.requiresManual=result.vehicle.requiresManual===true;
    for(const key of ['manualReasons','registrationDateIssues'])vehicle[key]=Array.isArray(result.vehicle[key])?result.vehicle[key].filter(v=>typeof v==='string').slice(0,20):[];
    const chatLookupToken=uuid();
    entries.set(chatLookupToken,{expires:now()+ttlMs,value:{vehicle,simulated:result.simulated===true},registration:typeof registration==='string'&&/^[A-Z0-9]{2,7}$/.test(registration)?registration:null});
    return {...result,vehicle:structuredClone(vehicle),chatLookupToken};
  }
  function get(token){expire();const entry=entries.get(token);return entry?structuredClone(entry.value):null;}
  function getPrivate(token){expire();const entry=entries.get(token);return entry?{...structuredClone(entry.value),registration:entry.registration}:null;}
  function confirmBase(token,id){
    const entry=getPrivate(token),choice=baseVehicleOptions.find(o=>o.id===id);
    if(!entry||(!choice&&id!=='unconfirmed')||!needsBaseVehicle(entry.vehicle))return null;
    const result=remember({vehicle:entry.vehicle,simulated:entry.simulated},entry.registration);
    const vehicle=entries.get(result.chatLookupToken).value.vehicle;
    vehicle.baseVehicle=choice?{id:choice.id,status:'customer-confirmed'}:{status:'unconfirmed'};
    return {...result,vehicle:structuredClone(vehicle)};
  }
  return {remember,get,getPrivate,confirmBase,snapshot(){expire();return structuredClone([...entries]);}};
}
