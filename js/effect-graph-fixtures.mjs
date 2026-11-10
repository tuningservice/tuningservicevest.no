// Explicit synthetic curves for graph QA only. Never used in the customer catalogue.
import {normalizeVdbCurves} from './effect-graph-model.mjs';
import {vdbResult} from './chat-session.mjs';
import {brandForDvx} from './vehicle-brand.mjs';
export function graphFixture(scenario='complete',brand='BMW'){
  const original={rpm_values:'0,1000,1500,2000,2500,3000,3500,4000,4500,5000',hp_values:'0,22,62,86,109,123,132,136,123,0',nm_values:'0,160,288,317,320,304,272,253,215,0'};
  const tune={hp_values:'0,26,73,103,130,146,158,162,146,0',nm_values:'0,195,351,387,390,371,332,309,262,0'};
  if(scenario==='original')Object.assign(tune,{hp_values:null,nm_values:null});
  if(scenario==='peaks')for(const object of [original,tune])Object.assign(object,{hp_values:null,nm_values:null});
  if(scenario==='missing-torque')for(const object of [original,tune])object.nm_values=null;
  if(scenario==='invalid'){original.hp_values='1,2,3';original.nm_values='bad';tune.hp_values='1,2';tune.nm_values='1,,no';}
  const details={id:'501',power:136,torque:scenario==='missing-torque'?null:320,curves:normalizeVdbCurves(original),remapStages:[
    {stage:1,power:162,torque:scenario==='missing-torque'?null:390,hardwareRequirements:'TESTKRAV: kontroller oppsett før tuning.',curves:normalizeVdbCurves(tune,original,{ownership:'stage'})},
    {stage:'1+',power:170,torque:405,hardwareRequirements:'TESTKRAV: oppgradert innsug. Ingen kurveseriar er oppgitt for dette teststeget.',curves:null},
    {stage:4,power:205,torque:455,hardwareRequirements:'TESTKRAV: oppgradert turbo. Desse tala gjeld berre det syntetiske testscenarioet.',curves:null},
  ]};
  return vdbResult(details,brand+' · TESTMOTOR · syntetiske grafdata',{}, {simulated:true,brand:brandForDvx(brand)});
}
