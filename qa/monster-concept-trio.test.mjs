import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {GAME_MONSTER_MODEL_REGISTRY} from '../src/creature-game-model-routing.js';
import {CONCEPT_TRIO_IDS,CONCEPT_TRIO_REVISION}
 from '../src/monster-concept-trio-sculpt-v2.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {animateMonsterModel,startMonsterAction} from '../src/monster-animation.js';

assert.deepEqual(CONCEPT_TRIO_IDS,
 ['m026','m027','m028','m029','m030','m046','m047','m049']);
const spiders=new Set(CONCEPT_TRIO_IDS.slice(0,5));
const octopi=new Set(['m047','m049']);
const artRequirement=(id,name)=>id+' failed 2D reference geometry: '+name;
for(const id of CONCEPT_TRIO_IDS){
 const species=MONSTER_BY_ID[id];
 assert.ok(species,'Original 50-species record missing: '+id);
 assert.equal(GAME_MONSTER_MODEL_REGISTRY[id].version,CONCEPT_TRIO_REVISION);
 assert.equal(GAME_MONSTER_MODEL_REGISTRY[id].mobileVisualApproved,false);
 for(const detail of ['high','medium','low']){
  const model=createMonsterModel(species,{detail});
  const pivots=model.userData.pivots;
  assert.equal(model.userData.gameModelRevision,CONCEPT_TRIO_REVISION);
  assert.equal(model.userData.referenceMatch,
   'physical-geometry-v2-pending-visual-approval');
  assert.ok(model.userData.conceptV2ArtworkFeatures?.length>=5);
  const names=[],transparents=[],materials=new Set();
  let triangles=0,meshes=0,billboards=0;
  model.traverse(obj=>{
   if(!obj.isMesh)return;
   meshes++;names.push(obj.name);
   if(obj.material.transparent)transparents.push(obj);
   if(obj.material)materials.add(obj.material);
   const geo=obj.geometry,attr=geo.getAttribute('position');
   assert.ok(attr?.count>2,artRequirement(id,obj.name+' no vertices'));
   assert.ok(attr.array.every(Number.isFinite),
     artRequirement(id,obj.name+' has invalid coordinates'));
   assert.ok(geo.getAttribute('normal'),
     artRequirement(id,obj.name+' has no normals'));
   triangles+=(geo.index?.count??attr.count)/3;
   billboards+=obj.isSprite?1:0;
  });
  assert.ok(triangles>4000,artRequirement(id,'flat toy geometry'));
  assert.ok(triangles<900000,artRequirement(id,'Android triangle budget'));
  assert.equal(billboards,0,'No billboard may replace original 3D geometry');
  assert.ok(meshes<550,artRequirement(id,'too many mobile draw calls'));
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  assert.ok(!box.isEmpty());
  const size=box.getSize(new THREE.Vector3());
  assert.ok([size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>.3));
  if(spiders.has(id)){
   assert.equal(model.userData.anatomicalLegCount,8);
   for(const name of ['conformal-carapace-plate','continuous-cephalothorax',
     'curved-venom-fang','organic-energy-fissure','faceted-glowing-ocellus',
     'contoured-armored-femur','contoured-barbed-tibia']){
    assert.ok(names.includes(name),artRequirement(id,name));
   }
   assert.equal(names.filter(n=>n==='faceted-glowing-ocellus').length,8);
   assert.ok(size.x>2.3,artRequirement(id,'eight-leg silhouette width'));
   for(const side of ['L','R'])for(let i=0;i<4;i++){
    const leg='leg'+side+i;
    for(const suffix of ['', 'Femur','Patella','Tibia','Tarsus'])
     assert.ok(pivots[leg+suffix],artRequirement(id,leg+suffix));
    assert.equal(pivots[leg+'Femur'].parent,pivots[leg]);
    assert.equal(pivots[leg+'Patella'].parent,pivots[leg+'Femur']);
    assert.equal(pivots[leg+'Tibia'].parent,pivots[leg+'Patella']);
    assert.equal(pivots[leg+'Tarsus'].parent,pivots[leg+'Tibia']);
   }
  }else if(id==='m046'){
   assert.equal(model.userData.anatomicalLegCount,0);
   for(const name of ['translucent-main-gel','slime-internal-core',
    'slime-luminous-eye','transparent-gel-horn',
    'gel-embedded-crystal','fluid-swept-eyebrow',
    'slime-spinning-magical-current']){
     assert.ok(names.includes(name),artRequirement(id,name));
   }
   assert.ok(transparents.length>=3,
    artRequirement(id,'refractive liquid shell'));
   assert.equal(names.filter(n=>n==='translucent-main-gel').length,1,
     'One contiguous membrane, not toy intersecting jelly spheres');
   assert.ok(size.x>1.5&&size.y>1.4,
    artRequirement(id,'lobed fluid and two high horns'));
  }else if(octopi.has(id)){
   assert.equal(model.userData.anatomicalTentacleCount,8);
   assert.ok(model.userData.mergedSuckerCount>=
    (detail==='low'?144:detail==='medium'?336:528),
     artRequirement(id,'two rows of cups on every tentacle'));
   for(const name of ['cephalopod-head','bulbous-octopus-mantle',
    'overlapping-dorsal-mantle-armor','recessed-sucker-cavity',
    'predatory-golden-eye','tapered-muscular-arm-0-0',
    'heavy-octopus-eye-brow']){
      assert.ok(names.includes(name),artRequirement(id,name));
   }
   assert.equal(names.filter(x=>x==='recessed-sucker-cavity').length,24,
    artRequirement(id,'cavities merged into 24 articulated segments'));
   assert.ok(size.x>3.1,artRequirement(id,'giant swirling eight-arm silhouette'));
   for(let i=0;i<8;i++){
    const arm='tentacle'+i;
    for(const suffix of ['','Mid','Tip'])
     assert.ok(pivots[arm+suffix],artRequirement(id,arm+suffix));
    assert.equal(pivots[arm+'Mid'].parent,pivots[arm]);
    assert.equal(pivots[arm+'Tip'].parent,pivots[arm+'Mid']);
   }
  }
  for(const action of ['idle','walk','run','attack','special','defeat']){
   startMonsterAction(model,action,1);
   animateMonsterModel(model,1.2);
   model.traverse(o=>{
    if(o.isGroup)
     assert.ok([o.rotation.x,o.rotation.y,o.rotation.z].every(Number.isFinite),
       artRequirement(id,'NaN joint in '+action));
   });
  }
  disposeMonsterSculpture(model);
  assert.equal(monsterSculptCacheStats().activeMaterials,0,
   artRequirement(id,'growing material memory cache'));
  console.log('CONCEPT-V2 '+id+' '+detail+
   ': '+Math.round(triangles)+' tris, '+meshes+' meshes, '+
   Math.round(size.x*100)/100+' wide, '+materials.size+' materials');
 }
}
console.log('PASS: 8 3D species / 3 LODs / 2D-reference feature geometry and animation');
