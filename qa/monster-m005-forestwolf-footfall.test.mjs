import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';

assert.equal(MONSTER_BY_ID.m005.name,'翠森の古狼');
let lowTriangles=0;
for(const detail of ['low','high']){
 const model=createMonsterModel(MONSTER_BY_ID.m005,{detail});
 const p=model.userData.pivots;
 assert.ok(p.neckGuard?.isGroup,'Need an independent cervical mantle');
 for(const suffix of ['L','R']){
   assert.ok(p['scapula'+suffix]?.isGroup,'Scapula must rotate');
   assert.ok(p['ear'+suffix]?.isGroup,'Pinna must rotate');
 }
 for(const key of ['frontL','frontR','rearL','rearR']){
   assert.ok(p['carpal'+key]?.isGroup,'Carpal/tarsal hinge missing '+key);
   assert.ok(p['toe'+key]?.isGroup,'Independent toe hinge missing '+key);
   assert.equal(p['carpal'+key].parent,p['lower'+key]);
   assert.equal(p['toe'+key].parent,p['carpal'+key]);
 }
 const counts=new Map();let triangles=0;
 model.traverse(o=>{
   if(!o.isMesh)return;
   counts.set(o.name,(counts.get(o.name)||0)+1);
   const pos=o.geometry.getAttribute('position'),
     uv=o.geometry.getAttribute('uv'),
     normals=o.geometry.getAttribute('normal');
   assert.ok(pos?.count>=3&&pos.array.every(Number.isFinite),
     'Invalid vertices in '+o.name);
   assert.equal(uv?.count,pos.count,'Missing UV '+o.name);
   assert.equal(normals?.count,pos.count,'Missing normals '+o.name);
   triangles+=(o.geometry.index?.count??pos.count)/3;
 });
 for(const [part,n] of [
   ['m005-mobile-scapula',2],['m005-cervical-guard',2],
   ['m005-pinna-inner-cartilage',2],['m005-masseter',2],
   ['m005-inset-nostril',2],['m005-nasal-leather',1],
   ['m005-carpal-tarsal-pad',4],['m005-metapodial-pad',4],
   ['m005-digit-pad',16],['m005-caudal-root-muscle',1]
 ])assert.equal(counts.get(part),n,detail+' missing real mesh '+part);
 assert.ok(triangles>2000&&triangles<900000,'Outside mesh budget');
 if(detail==='low')lowTriangles=triangles;
 else assert.ok(triangles>lowTriangles,'High LOD must retain more triangles');
 startMonsterAction(model,'walk',0);
 animateMonsterModel(model,.18);
 const carpal=p.carpalfrontL.rotation.x,ear=p.earL.rotation.x,
  toe=p.toerearR.rotation.x,tail=p.tailMid.rotation.y;
 animateMonsterModel(model,.38);
 assert.notEqual(p.carpalfrontL.rotation.x,carpal,'Carpal not animated');
 assert.notEqual(p.toerearR.rotation.x,toe,'Rear toe not animated');
 assert.notEqual(p.earL.rotation.x,ear,'Ear cannot scan independently');
 assert.notEqual(p.tailMid.rotation.y,tail,'Tail not stabilizing');
 assert.notEqual(p.scapulaL.rotation.x,p.scapulaR.rotation.x,
   'Shoulders must have independent phase');
 for(const [action] of MONSTER_ACTIONS){
   startMonsterAction(model,action,0);
   animateMonsterModel(model,.24);
   for(const n of Object.values(p))
     assert.ok([n.rotation.x,n.rotation.y,n.rotation.z]
       .every(Number.isFinite),'Nonfinite joint '+action);
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'm005 materials leaked');
}
// Individual model work must never affect other animals or human models.
for(const id of ['m001','m004','m006','m015','m031']){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
 let leak=0;
 model.traverse(o=>{if(o.isMesh&&o.name.startsWith('m005-'))leak++});
 assert.equal(leak,0,'Forest wolf mesh leaked to '+id);
 assert.equal(model.userData.pivots.neckGuard,undefined,
   'Forest wolf joints leaked to '+id);
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0);
}
console.log('m005: 4 independently articulated feet, ears, cervical/scapular mesh, LOD, 10 motions and species isolation PASS');
