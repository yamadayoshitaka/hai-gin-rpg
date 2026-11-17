import assert from 'node:assert/strict';
import {battleClosedBackCoverage,battleScalpCoverageState,ensureBattleScalpCoverage,
 auditBattleCharacterPipeline} from '../src/character-system/battle-visual-pipeline.js';
const panel={isSkinnedMesh:true,visible:true,geometry:{getAttribute:()=>({count:165})}};
let policy=battleClosedBackCoverage({panel,opaqueLining:0});
assert.equal(policy.closed,true);assert.deepEqual(policy.forceCoveredRegions,['torso']);
assert.deepEqual(policy.preserveRegions,[],'never expose unclothed backs when a closed panel is skinned');
policy=battleClosedBackCoverage({panel:null});
assert.equal(policy.closed,false);assert.deepEqual(policy.preserveRegions,['torso'],'no panel retains fallback body');
assert.equal(battleClosedBackCoverage({panel:{...panel,visible:false}}).closed,false);
assert.equal(battleClosedBackCoverage({panel,preserveBody:true}).closed,false);
let visible=false;
const a={id:2,job:{name:'剣士'},studioPattern:{hairStyleId:'h01'},
  character:{},outfit:{
   getHairState:()=>({attached:true,visible,style:'h01'}),
   setHairVisible:v=>{visible=v;},
   diagnostics:{closedBackPanelSkinned:true,torsoForcedCovered:true}
  },masterHead:{attached:true,face:{visible:true,material:{userData:{battleFaceLightResponseVersion:'v5'}}},
   sourceAsset:'source-head.glb',version:'v1'}};
assert.equal(battleScalpCoverageState(a).source,'missing');
assert.equal(ensureBattleScalpCoverage(a).repaired,true);
assert.equal(battleScalpCoverageState(a).source,'fitted-source');
const lock={visible:true,geometry:{getAttribute:()=>({count:500})}};
const root={visible:true,parent:{},getObjectByName:name=>name==='SINGLE_MESH_NORMAL_LAYERED_HAIR'?lock:null};
a.masterHead.studioWig={root};
assert.equal(ensureBattleScalpCoverage(a).after.source,'studio-scalp');
assert.equal(battleScalpCoverageState(a).rootedVertices,500);
lock.visible=false;
assert.equal(ensureBattleScalpCoverage(a).after.source,'fitted-source','empty/hidden hair mesh must restore genuine source GLB');
lock.visible=true;
ensureBattleScalpCoverage(a);
assert.equal(visible,false,'two hairstyles must never overlap');
assert.deepEqual(auditBattleCharacterPipeline([a]).baldRisk,[]);
const missing={...a,id:3,masterHead:{...a.masterHead,studioWig:null},
 outfit:{getHairState:()=>({attached:false,visible:false}),diagnostics:{}}};
assert.deepEqual(auditBattleCharacterPipeline([missing],{mass:true}).baldRisk,[3]);
console.log('PASS real mesh -> skinned outfit -> visible hair -> GPU model parity');
