import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {GAME_MONSTER_MODEL_REGISTRY} from '../src/creature-game-model-routing.js';
import {CONCEPT_TRIO_IDS,CONCEPT_TRIO_REVISION}
 from '../src/monster-concept-trio-sculpt.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {animateMonsterModel,startMonsterAction} from '../src/monster-animation.js';

assert.deepEqual(CONCEPT_TRIO_IDS,
 ['m026','m027','m028','m029','m030','m046','m047','m049']);
const spiderIds=new Set(CONCEPT_TRIO_IDS.slice(0,5));
const octopusIds=new Set(['m047','m049']);
for(const id of CONCEPT_TRIO_IDS){
 const species=MONSTER_BY_ID[id];
 assert.ok(species,'Existing bestiary identity preserved: '+id);
 assert.equal(GAME_MONSTER_MODEL_REGISTRY[id].version,CONCEPT_TRIO_REVISION);
 assert.equal(GAME_MONSTER_MODEL_REGISTRY[id].mobileVisualApproved,false);
 for(const detail of ['high','low']){
  const monster=createMonsterModel(species,{detail});
  assert.equal(monster.userData.gameModelRevision,CONCEPT_TRIO_REVISION);
  assert.equal(monster.userData.referenceArtworkDate,'2026-11-21');
  const pivots=monster.userData.pivots;
  const names=[],positions=[];
  let triangleCount=0;
  monster.traverse(node=>{
   if(!node.isMesh)return;
   names.push(node.name);
   const a=node.geometry.getAttribute('position');
   assert.ok(a&&a.count>0,id+' '+node.name+' missing real vertices');
   assert.ok(a.array.every(Number.isFinite),id+' '+node.name+' NaN geometry');
   positions.push(node.position.x,node.position.y,node.position.z);
   triangleCount+=(node.geometry.index?.count??a.count)/3;
  });
  assert.ok(positions.every(Number.isFinite));
  assert.ok(triangleCount>900,id+' must be modeled, not a billboard');
  assert.ok(triangleCount<900000,id+' exceeds mobile budget');
  if(spiderIds.has(id)){
   assert.equal(monster.userData.anatomicalLegCount,8);
   assert.ok(names.includes('layered-abdomen-scutum'));
   assert.ok(names.includes('curved-venom-fang'));
   assert.ok(names.includes('organic-energy-fissure'));
   for(const side of ['L','R'])for(let i=0;i<4;i++){
    const leg='leg'+side+i;
    for(const suffix of ['', 'Femur','Patella','Tibia','Tarsus'])
     assert.ok(pivots[leg+suffix],id+' missing spider pivot '+leg+suffix);
    assert.equal(pivots[leg+'Femur'].parent,pivots[leg]);
    assert.equal(pivots[leg+'Patella'].parent,pivots[leg+'Femur']);
    assert.equal(pivots[leg+'Tibia'].parent,pivots[leg+'Patella']);
    assert.equal(pivots[leg+'Tarsus'].parent,pivots[leg+'Tibia']);
   }
  }else if(id==='m046'){
   assert.equal(monster.userData.anatomicalLegCount,0);
   for(const name of ['translucent-main-gel','flowing-puddle-skirt',
    'slime-internal-core','slime-luminous-eye','transparent-gel-horn',
    'gel-embedded-crystal'])assert.ok(names.includes(name),id+' missing '+name);
   const transparent=[];
   monster.traverse(node=>{
    if(node.isMesh&&node.material.transparent)transparent.push(node);
   });
   assert.ok(transparent.length>=3,'Gel has no transparent volume');
  }else if(octopusIds.has(id)){
   assert.equal(monster.userData.anatomicalTentacleCount,8);
   for(const name of ['cephalopod-head','bulbous-octopus-mantle',
    'recessed-sucker-cavity','predatory-golden-eye',
    'tapered-muscular-arm-0-0'])assert.ok(names.includes(name),id+' missing '+name);
   for(let i=0;i<8;i++){
    const base='tentacle'+i;
    for(const suffix of ['', 'Mid','Tip'])
     assert.ok(pivots[base+suffix],id+' missing '+base+suffix);
    assert.equal(pivots[base+'Mid'].parent,pivots[base]);
    assert.equal(pivots[base+'Tip'].parent,pivots[base+'Mid']);
   }
  }
  for(const action of ['walk','run','attack','special','defeat']){
   startMonsterAction(monster,action,1);
   animateMonsterModel(monster,1.16);
   monster.traverse(node=>{
    if(node.isGroup)
     assert.ok([node.rotation.x,node.rotation.y,node.rotation.z].every(Number.isFinite),
       id+' bad pivot after '+action);
   });
  }
  disposeMonsterSculpture(monster);
  assert.equal(monsterSculptCacheStats().activeMaterials,0,
   id+' leaked cached materials');
 }
}
console.log('8 concept-matched monster species: geometry, rigs, LOD and motion PASS');
