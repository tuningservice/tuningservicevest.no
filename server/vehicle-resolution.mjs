import {needsBaseVehicle,confirmedBaseVehicle,baseVehicleOptions} from '../js/vehicle-base.mjs';
import {establishVehicleIdentity} from '../js/vehicle-identity-registry.mjs';
import {resolveDvxProposal} from '../js/dvx-matching.mjs';
import {resolveVehicleProposal} from '../js/vehicle-matching.mjs';
import {vehicleCategoryGroup} from '../js/vehicle-category.mjs';
import {documentedCommercialModel} from '../js/vehicle-identity.mjs';
import {ownCatalogueCandidates} from '../js/tsv-catalogue.mjs';
// Identity is established before any effect-source choice. Catalogue uncertainty
// never erases registered identity, and a reserve result is always used whole.
export async function resolveCustomerVehicle(vehicle,{groups,loadCatalog,signal}={}){
 const identity=establishVehicleIdentity(vehicle);
 if(needsBaseVehicle(vehicle)&&!confirmedBaseVehicle(vehicle))return {source:'vdb',kind:'choose-base-vehicle',selections:{},paths:[],identity,baseOptions:baseVehicleOptions};
 if(identity.issues.length)return {source:'vdb',kind:'identity-conflict',selections:{},paths:[],identity,resolution:{status:'manual-identity-conflict',selectedSource:null}};
 const own=ownCatalogueCandidates(identity.matchingVehicle);
 if(own.length===1)return {source:'tsv',kind:'complete',selections:{vehicleId:own[0].id},paths:[{id:own[0].id}],identity,resolution:{status:'resolved',selectedSource:'tsv',basis:'owner-catalogue-model-fuel-displacement-power-and-no-technical-conflict'}};
 // The current pinned export has no verified heavy/agricultural category.
 // Route those register groups to the explicitly typed supplier catalogue;
 // a same-name car record cannot override the registered vehicle category.
 let preferred=identity.matchingVehicle.baseCatalogueType==='Trucks & Buses'||['heavy','agriculture'].includes(vehicleCategoryGroup(vehicle.vehicleCategory))?{kind:'category-not-covered',paths:[],selections:{}}:resolveDvxProposal(groups,identity.matchingVehicle);
 if(preferred.kind==='complete')return {...preferred,source:'dvx',identity,resolution:{status:'resolved',selectedSource:'dvx',basis:'unique-supported-preferred-candidate'}};
 let reserve=null,reserveError=null;
 try{reserve=await resolveVehicleProposal(identity.matchingVehicle,loadCatalog,{signal});}catch(error){if(signal?.aborted)throw error;reserveError=['timeout','quota','access-denied'].includes(error?.code)?error.code:'unavailable';}
 // A verified exact Cars & LCV model path can cover an N2 van in the fixed
 // primary export. Keep register facts/category and complete source results.
 const commercial=documentedCommercialModel(vehicle);
 if(['exact-model-in-alternate-catalogue','reviewed-model-catalogue-route'].includes(reserve?.catalogueRouting?.basis)){
  const alternative=resolveDvxProposal(groups,{...identity.matchingVehicle,...(commercial?{model:commercial.model}:reserve.catalogueRouting.model?{model:reserve.catalogueRouting.model}:{})});
  const underpinned=!!commercial||alternative.paths?.some(p=>p.evidence.capacityMatch||p.evidence.codeMatch);
  if(underpinned&&alternative.kind==='complete')return {...alternative,source:'dvx',identity,resolution:{status:'resolved',selectedSource:'dvx',basis:'verified-van-model-and-technical-profile'}};
  if(underpinned&&alternative.paths?.length)preferred=alternative;
 }
 if(reserve?.kind==='complete')return {...reserve,source:'vdb',identity,resolution:{status:'resolved',selectedSource:'vdb',basis:preferred.paths?.length?'preferred-ambiguous-reserve-unique':'preferred-uncovered-reserve-unique',preferredKind:preferred.kind,preferredCandidates:preferred.paths?.map(p=>p.id)??[]}};
 if(preferred.paths?.length)return {...preferred,source:'dvx',identity,resolution:{status:'needs-catalogue-clarification',selectedSource:null,reserveKind:reserve?.kind??null,reserveError}};
 return {...(reserve??{kind:'no-engine-match',paths:[],selections:{}}),source:'vdb',identity,resolution:{status:'needs-catalogue-clarification',selectedSource:null,reserveError}};
}
