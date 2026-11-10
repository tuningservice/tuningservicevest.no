import {graphFixture} from './effect-graph-fixtures.mjs';
import {createEffectGraph} from './effect-graph.mjs';
import {createBrandBadge} from './vehicle-brand.mjs';
const $=id=>document.getElementById(id);let graph;
function render(){graph?.dispose();const result=graphFixture($('graph-scenario').value,$('graph-brand').value),stage=result.stages[Number($('graph-stage').value)];graph=createEffectGraph(result,stage);$('lab-brand').replaceChildren(createBrandBadge(result.brand));$('lab-result').replaceChildren(graph.element);}
for(const id of ['graph-scenario','graph-brand','graph-stage'])$(id).addEventListener('change',render);render();
