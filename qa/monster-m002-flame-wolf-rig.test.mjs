import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,
 monsterSculptCacheStats} from '../src/monster-geometry.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';

const spec=MONSTER_BY_ID.m002;
assert.ok(spec&&spec.name==='紅蓮の獄狼'&&spec.family==='beast');
const requiredMeshes=[
 ['m002-masseter',2],['m002-scapular-muscle',2],
 ['m002-ear-cartilage-base',2],['m002-nostril',2],
 ['m002-rhinarium',1],['m002-vibrissa-root',8],
];
let previousLow=0;
for(const detail of ['low','high']){
 const model=createMonsterModel(spec,{detail});
 const pivots=model.userData.pivots;
 for(const name of ['head','jaw','tail','lowerfrontL','lowerfrontR',
   'earL','earR','scapulaL','scapulaR']){
  assert.ok(pivots[name]?.isGroup,detail+' missing true joint '+name);
 }
 const meshes=new Map();
 let vertexCount=0,triangles=0;
 model.traverse(node=>{
  if(!node.isMesh)return;
  meshes.set(node.name,(meshes.get(node.name)||0)+1);
  const xyz=node.geometry.getAttribute('position'),
    uv=node.geometry.getAttribute('uv');
  assert.ok(xyz?.count>0&&xyz.array.every(Number.isFinite),
    'Nonfinite physical surface: '+node.name);
  assert.equal(uv?.count,xyz.count,'UV counts must match rendered vertices');
  vertexCount+=xyz.count;
  triangles+=(node.geometry.index?.count??xyz.count)/3;
 });
 for(const [name,count] of requiredMeshes)
  assert.equal(meshes.get(name),count,detail+' requires anatomical '+name);
 assert.ok(triangles>2000&&triangles<900000,
   detail+' mesh must exist within preview mobile GPU budget');
 if(detail==='low')previousLow=triangles;
 else assert.ok(triangles>previousLow,'Near view cannot lose geometry detail');
 // Geometry vertices must physically move with local joint transforms,
 // instead of being static meshes with synthetic pose metadata.
 const leftEar=pivots.earL.getObjectByName('m002-ear-cartilage-base');
 const leftMuscle=pivots.scapulaL.getObjectByName('m002-scapular-muscle');
 assert.ok(leftEar?.parent===pivots.earL);
 assert.ok(leftMuscle?.parent===pivots.scapulaL);
 startMonsterAction(model,'run',0);
 animateMonsterModel(model,.15);
 const earA=pivots.earL.rotation.y,
  shoulderA=pivots.scapulaL.rotation.x;
 animateMonsterModel(model,.32);
 assert.notEqual(pivots.earL.rotation.y,earA,
   'Left pinna must rotate independently over time');
 assert.notEqual(pivots.scapulaL.rotation.x,shoulderA,
   'Forequarter shoulder must articulate during gait');
 assert.notEqual(pivots.scapulaL.rotation.x,pivots.scapulaR.rotation.x,
   'Forequarter motion must not be a mirrored rigid object');
 startMonsterAction(model,'attack',0);
 animateMonsterModel(model,.33);
 assert.ok(pivots.jaw.rotation.x>.2,'Lunge must open the physical mandible');
 assert.ok(pivots.earL.rotation.x>.2&&pivots.earR.rotation.x>.2,
   'Both ears flatten during the attack');
 for(const [action] of MONSTER_ACTIONS){
   startMonsterAction(model,action,0);
   animateMonsterModel(model,.22);
   model.traverse(node=>{
     if(node.isGroup)assert.ok([node.rotation.x,node.rotation.y,node.rotation.z]
       .every(Number.isFinite),'Nonfinite animated joint: '+node.name);
   });
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'Switching specimen must release materials');
}
// Only the intended wolf species gains flame-wolf-only assets.
for(const id of ['m001','m003','m015','m031']){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
 let flameParts=0;
 model.traverse(node=>{if(node.isMesh&&node.name.startsWith('m002-'))flameParts++;});
 assert.equal(flameParts,0,id+' must not inherit m002 anatomy');
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0);
}
console.log('m002 individually researched skull, pinna, scapula, jaw, all 10 actions, low/high LOD, human protection: PASS');
