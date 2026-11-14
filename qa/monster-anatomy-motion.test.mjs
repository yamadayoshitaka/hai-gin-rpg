import assert from 'node:assert/strict';
// Run the same visual-anatomy contracts in CI's fixed 50-species suite.
import './monster-leap-mummy-quality.test.mjs';
import './monster-realistic-remesh.test.mjs';
import './creature-dragon-realism-regression.test.mjs';
import './creature-face-mouth-saddle-regression.test.mjs';
import './dragonlord-cranium-jaw-seam.test.mjs';
import './creature-face-volume-batch.test.mjs';
import './creature-fangs-garment-seam-batch.test.mjs';
import './monster-character-cosplay-regression.test.mjs';
import './monster-gothic-sculpt-regression.test.mjs';
import './monster-16-cosplay-pigment-regression.test.mjs';
import './demon-female-summon-mobile-viewer.test.mjs';
import './monster-humanoid-hair-orientation-regression.test.mjs';
import './monster-regal-wardrobe-batch.test.mjs';
import {MONSTER_CATALOG,validateMonsterCatalog} from '../src/monster-catalog.js';
import {
 ANATOMY_EVIDENCE, MONSTER_ANATOMY_RESEARCH, monsterEvidenceFor,
} from '../src/monster-anatomy-reference.js';
import {
 createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats,
} from '../src/monster-geometry.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';

assert.equal(validateMonsterCatalog(),true);
assert.equal(MONSTER_CATALOG.length,50);
assert.equal(Object.keys(MONSTER_ANATOMY_RESEARCH).length,50);
const protectedIds=new Set([
 'm015',...Array.from({length:15},(_,i)=>'m'+String(i+31).padStart(3,'0')),
]);
assert.equal(protectedIds.size,16);
for(const spec of MONSTER_CATALOG){
 const entry=monsterEvidenceFor(spec);
 assert.equal(entry.id,spec.id);
 assert.ok(entry.analogue&&entry.motion);
 assert.equal(entry.status==='protected-humanlike',protectedIds.has(spec.id),
   'Humanlike or shared-rig monster was not protected: '+spec.id);
 if(!protectedIds.has(spec.id)){
   assert.ok(ANATOMY_EVIDENCE[entry.source]?.url?.startsWith('https://'),
     'Missing per-ID research provenance '+spec.id);
 }
}
assert.equal(MONSTER_CATALOG.filter(s=>!protectedIds.has(s.id)).length,34);
const testAngles=(p,names)=>names.map(n=>{
 const o=p[n];assert.ok(o,'Missing named real anatomical joint '+n);
 assert.ok(o.isGroup,'Joint must be a real Three.js group '+n);
 return [o.rotation.x,o.rotation.y,o.rotation.z];
});
for(const spec of MONSTER_CATALOG){
 const model=createMonsterModel(spec,{detail:'high'});
 const p=model.userData.pivots;
 assert.equal(model.userData.anatomyEvidence.id,spec.id);
 let geometryCount=0,triangles=0;
 model.traverse(obj=>{
   if(!obj.isMesh)return;
   geometryCount++;
   const geo=obj.geometry,attrib=geo.getAttribute('position');
   assert.ok(attrib?.count>2,'Empty 3D mesh '+spec.id);
   assert.ok(attrib.array.every(Number.isFinite),'Invalid vertices '+spec.id);
   triangles+=(geo.index?.count??attrib.count)/3;
 });
 assert.ok(geometryCount>=18,'Lost real meshes '+spec.id);
 assert.ok(triangles<900000,'Excessive mobile preview polygons '+spec.id);
 if(['beast','feline'].includes(spec.family)||
   (spec.family==='reptile'&&spec.id!=='m020')||spec.id==='m050'){
   testAngles(p,['lowerfrontL','lowerfrontR','lowerrearL','lowerrearR','tailMid','tailTip']);
   startMonsterAction(model,'walk',0);
   animateMonsterModel(model,.17);
   const first=p.lowerfrontL.rotation.x,other=p.lowerrearL.rotation.x;
   animateMonsterModel(model,.56);
   assert.notEqual(p.lowerfrontL.rotation.x,first,'Distal joint did not move '+spec.id);
   assert.ok(Number.isFinite(other));
 }
 if(spec.id==='m020'||spec.id==='m048'){
   testAngles(p,['spineRear','tail','tailMid','tailTip']);
   assert.ok(!p.legfrontL,'Sea serpent should not be a quadruped '+spec.id);
   startMonsterAction(model,'run',0);
   animateMonsterModel(model,.20);
   const a=p.spineRear.rotation.y;
   animateMonsterModel(model,.53);
   assert.notEqual(p.spineRear.rotation.y,a,'Serpent wave missing '+spec.id);
 }
 if(spec.family==='avian'&&spec.id!=='m015'){
   testAngles(p,['wingL','wingR','wingElbowL','wingWristL','wingElbowR','wingWristR',
     'birdAnkleL','birdAnkleR']);
   startMonsterAction(model,'special',0);
   animateMonsterModel(model,.19);
   const a=p.wingWristL.rotation.y;
   animateMonsterModel(model,.31);
   assert.notEqual(p.wingWristL.rotation.y,a,'Wing wrist did not fold '+spec.id);
 }
 if(spec.id==='m001'){
   testAngles(p,['earL','earR']);
   const noseMeshes=[];
   model.traverse(node=>{if(node.isMesh&&node.name==='wolf-nasal-cartilage')
     noseMeshes.push(node)});
   assert.equal(noseMeshes.length,1,'Wolf needs an independent nasal cartilage mesh');
   startMonsterAction(model,'idle',0);
   animateMonsterModel(model,.18);
   const a=p.earL.rotation.z,b=p.earR.rotation.z;
   assert.notEqual(a,b,'Wolf pinnae must not be rigid copies');
   animateMonsterModel(model,.54);
   assert.notEqual(p.earL.rotation.z,a,'Wolf ear pivot must physically animate');
 }
 if(spec.id==='m015'){
   assert.equal(p.wingElbowL,undefined,'Do not alter humanoid tengu wing rig');
   assert.equal(p.birdAnkleL,undefined,'Do not alter humanoid tengu leg rig');
 }
 if(spec.id==='m023')testAngles(p,['raptorialL','raptorialR',
   'raptorialElbowL','raptorialElbowR']);
 if(spec.id==='m047'||spec.id==='m049'){
   const names=Array.from({length:8},(_,i)=>[
    'tentacle'+i,'tentacle'+i+'Mid','tentacle'+i+'Tip']).flat();
   testAngles(p,names);
   startMonsterAction(model,'special',0);
   animateMonsterModel(model,.19);
   const a=p.tentacle4Tip.rotation.x;
   animateMonsterModel(model,.53);
   assert.notEqual(p.tentacle4Tip.rotation.x,a,'Three-stage arm does not flex '+spec.id);
 }
 for(const [action] of MONSTER_ACTIONS){
   startMonsterAction(model,action,1);
   const pose=animateMonsterModel(model,1.20);
   assert.equal(pose.action,action,'Missing action '+spec.id+' '+action);
   model.traverse(node=>{
     if(node.isGroup)assert.ok(
       [node.rotation.x,node.rotation.y,node.rotation.z].every(Number.isFinite),
       'NaN joint '+node.name+' '+spec.id);
   });
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'Leaking material after jointed sculpture '+spec.id);
}
console.log('50-species evidence map, 34 animal/creature profiles, protected humanoids, joint animation and geometry: PASS');
