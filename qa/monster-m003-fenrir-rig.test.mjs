import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';

const spec=MONSTER_BY_ID.m003;
assert.equal(spec.name,'氷霜フェンリル');
assert.equal(spec.family,'beast');
let lowTriangles=0;
for(const detail of ['low','high']){
 const model=createMonsterModel(spec,{detail});
 const p=model.userData.pivots,counts=new Map();
 for(const side of ['L','R']){
   for(const name of ['scapula','ruff','ear']){
     assert.ok(p[name+side]?.isGroup,detail+' missing '+name+side);
   }
 }
 for(const limb of ['frontL','frontR','rearL','rearR']){
   assert.ok(p['toe'+limb]?.isGroup,detail+' missing digitigrade toe '+limb);
   assert.equal(p['toe'+limb].parent,p['lower'+limb],
     'Toe must follow distal leg transform');
 }
 let triangles=0;
 model.traverse(node=>{
   if(!node.isMesh)return;
   counts.set(node.name,(counts.get(node.name)||0)+1);
   const xyz=node.geometry.getAttribute('position');
   assert.ok(xyz?.count>0&&xyz.array.every(Number.isFinite));
   assert.equal(node.geometry.getAttribute('uv')?.count,xyz.count);
   triangles+=(node.geometry.index?.count??xyz.count)/3;
 });
 for(const [name,expected] of [
   ['m003-scapular-mantle',2],['m003-pinna-cartilage',2],
   ['m003-temporalis',2],['m003-nostril',2],
   ['m003-metapodial-pad',4],['m003-digit-pad',16]])
   assert.equal(counts.get(name),expected,detail+' missing real '+name);
 assert.ok(triangles>2000&&triangles<900000,'Preview geometry budget exceeded');
 if(detail==='low')lowTriangles=triangles;
 else assert.ok(triangles>lowTriangles,'Near LOD cannot lose geometry');
 startMonsterAction(model,'run',0);
 animateMonsterModel(model,.12);
 const toe0=p.toefrontL.rotation.x,ruff0=p.ruffL.rotation.x;
 animateMonsterModel(model,.34);
 assert.notEqual(p.toefrontL.rotation.x,toe0,'Toe must articulate');
 assert.notEqual(p.ruffL.rotation.x,ruff0,'Neck mantle must articulate');
 assert.notEqual(p.scapulaL.rotation.x,p.scapulaR.rotation.x,
   'Shoulders should not be a rigid mirrored mesh');
 startMonsterAction(model,'attack',0);
 animateMonsterModel(model,.34);
 assert.ok(p.earL.rotation.x>.15,'Ears should flatten before bite');
 for(const [action] of MONSTER_ACTIONS){
   startMonsterAction(model,action,0);
   animateMonsterModel(model,.21);
   for(const node of Object.values(p))
     if(node?.rotation)assert.ok([node.rotation.x,node.rotation.y,node.rotation.z]
       .every(Number.isFinite),'Nonfinite joint angle '+action);
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0);
}
for(const id of ['m001','m002','m004','m015','m031']){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
 let ownParts=0;
 model.traverse(n=>{if(n.isMesh&&n.name.startsWith('m003-'))ownParts++;});
 assert.equal(ownParts,0,'Species leak '+id);
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0);
}
console.log('m003: anatomical paws, ruff, pinnae, scapula and all ten actions PASS');
