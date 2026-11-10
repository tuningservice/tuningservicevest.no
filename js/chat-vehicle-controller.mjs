import {establishVehicleIdentity} from './vehicle-identity-registry.mjs';
import {createCascade,levels} from './vehicle-cascade.mjs';
import {resolveVehicleProposal,assessEnginePaths,suggestCandidates} from './vehicle-matching.mjs';
import {registeredGenerationChoices} from './vehicle-generation-identity.mjs';
export function createChatVehicleController({loadCatalog,lookup,resolvePreferred=null,onPreferred=()=>{},onState=()=>{},onLookup=()=>{},onProposal=()=>{},onError=()=>{},autoConfirm=false}){
  let revision=0,controller=null,vehicle=null,registeredReference=null,paths=[],busy=false,generationReview=null;
  const cascade=createCascade({loadCatalog,onState:s=>onState({...s,resolving:busy,paths,registered:registeredReference,generationReview})});
  function cancel(){revision++;controller?.abort();busy=false;vehicle=null;registeredReference=null;paths=[];generationReview=null;cascade.clear();}
  async function find(body,{demo=false,lookupResult=null}={}){
    cancel();const version=revision;controller=new AbortController();const signal=controller.signal;busy=true;onState({...cascade.snapshot(),resolving:true,paths:[],registered:null});
    try{
      const result=lookupResult??await lookup(body,{signal,demo});if(version!==revision)return;
      vehicle=establishVehicleIdentity(result.vehicle).matchingVehicle;registeredReference=result.vehicle;onLookup(result);
      let proposal;
      if(resolvePreferred){const preferred=await resolvePreferred(result,signal);if(version!==revision)return;
        if(preferred?.source==='vdb')proposal=preferred;
        else if(preferred?.paths?.length){busy=false;await onPreferred(preferred,result);return;}}
      proposal??=await resolveVehicleProposal(vehicle,loadCatalog,{signal});if(version!==revision)return;
      paths=proposal.paths;await cascade.applySelections(proposal.selections,()=>version===revision);if(version!==revision)return;
      if(proposal.kind==='manual'){
        // Manual powertrain review does not erase a known make/model. Seed only
        // exact unique catalogue identity rows; never a generation or engine.
        // Conflicting register identity must still be chosen by the customer.
        const knownIdentity={...vehicle,requiresManual:false};
        for(const level of ['types','manufacturers','models']){
          if(version!==revision)return;
          const state=cascade.snapshot();if(state.error)break;if(state.selected[level])continue;
          if(level!=='types'&&vehicle.manualReasons?.includes('conflicting-identity'))break;
          const ids=suggestCandidates(level,state.rows[level],knownIdentity).ids;
          if(ids.length!==1)break;
          await cascade.change(level,ids[0]);if(version!==revision)return;
        }
        const state=cascade.snapshot();
        if(!state.error&&state.selected.models){generationReview=registeredGenerationChoices(state.rows.generations,vehicle);if(generationReview.selected){await cascade.change('generations',generationReview.selected);if(version!==revision)return;}}
        const selected=cascade.snapshot().selected;
        proposal={...proposal,selections:Object.fromEntries(Object.entries(selected).filter(([,id])=>id)),pendingLevel:levels.find(l=>!selected[l])??null};
      }
      busy=false;onProposal(proposal,result);onState({...cascade.snapshot(),resolving:false,paths,registered:registeredReference,generationReview});
      if(autoConfirm&&proposal.kind==='complete'&&version===revision)await cascade.confirm();
    }catch(error){if(version===revision&&error.name!=='AbortError'){busy=false;onState({...cascade.snapshot(),error:error.code||'upstream-unavailable',resolving:false,paths,registered:registeredReference});onError(error);}}
  }
  async function manual({carsOnly=false}={}){
    cancel();const version=revision;await cascade.start();if(!carsOnly||version!==revision)return;
    const state=cascade.snapshot();if(state.error)return;
    const cars=state.rows.types.filter(t=>/^Cars\s*&\s*LCV$/i.test(t.name));
    if(cars.length===1)await cascade.change('types',String(cars[0].id));
    else onError({code:'car-type-unavailable'});
  }
  async function change(level,value){
    const version=++revision;controller?.abort();busy=false;
    if(level==='generations'&&vehicle&&!cascade.snapshot().selected.models){
      const parents=[...new Set(paths.filter(p=>String(p.generation.id)===String(value)).map(p=>p.model?.id).filter(Boolean))];
      if(parents.length!==1)return;
      await cascade.change('models',String(parents[0]));if(version!==revision)return;
    }
    // A manual catalogue correction invalidates automatic matching against the
    // previous model; the original register facts remain a separate reference.
    if(['types','manufacturers','models'].includes(level)){paths=[];vehicle=null;generationReview=null;}
    await cascade.change(level,value);if(version!==revision)return;
    if(level==='generations'&&vehicle&&!vehicle.requiresManual&&paths.length){
      const p=paths.filter(p=>String(p.generation.id)===cascade.snapshot().selected.generations),assessment=assessEnginePaths(p,vehicle);
      if(assessment.engine){await cascade.change('engines',String(assessment.engine.id));if(autoConfirm&&version===revision)await cascade.confirm();}
    }
    if(level==='engines'&&autoConfirm&&vehicle&&!vehicle.requiresManual&&version===revision&&cascade.snapshot().selected.engines)await cascade.confirm();
  }
  return {find,chooseLookup:result=>find(null,{lookupResult:result}),manual,cancel,change,confirm:()=>cascade.confirm(),snapshot:()=>({...cascade.snapshot(),resolving:busy,paths,registered:registeredReference,generationReview})};
}
