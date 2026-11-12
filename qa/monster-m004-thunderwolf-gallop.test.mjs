import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
  from '../src/monster-geometry.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel}
  from '../src/monster-animation.js';

assert.equal(MONSTER_BY_ID.m004.name,'雷迅の魔狼');
let lowTriangles=0;
for(const detail of ['low','high']){
 const model=createMonsterModel(MONSTER_BY_ID.m004,{detail});
 const p=model.userData.pivots;
 const names=['lumbar','pelvis','neckCollar','scapulaL','scapulaR',
   'earL','earR','tail','tailMid','tailTip',
   ...['frontL','frontR','rearL','rearR'].flatMap(x=>
     ['leg'+x,'lower'+x,'hock'+x,'toe'+x])];
 for(const name of names)
   assert.ok(p[name]?.isGroup,detail+' missing actual articulated joint '+name);
 assert.equal(p.pelvis.parent,p.lumbar,'Pelvis must be attached to lumbar spine');
 assert.equal(p.legrearL.parent,p.pelvis,'Left rear leg follows pelvic flexion');
 assert.equal(p.legrearR.parent,p.pelvis,'Right rear leg follows pelvic flexion');
 assert.equal(p.tail.parent,p.pelvis,'Tail must follow pelvic hinge');
 assert.equal(p.legfrontL.parent,model,'Forelimbs remain root space');
 for(const limb of ['frontL','frontR','rearL','rearR']){
   assert.equal(p['hock'+limb].parent,p['lower'+limb]);
   assert.equal(p['toe'+limb].parent,p['hock'+limb]);
 }
 model.updateMatrixWorld(true);
 // Original world-space hip and tail positions must be preserved on rig build.
 const rearWorld=p.legrearL.getWorldPosition(new Vector3()).clone();
 const tailWorld=p.tail.getWorldPosition(new Vector3()).clone();
 const scale=model.userData.homeScale;
 assert.ok(rearWorld.distanceTo(new Vector3(-.29,.67,-.49).multiplyScalar(scale))<.002,
   'Pelvic reparent changed hindleg bind pose');
 assert.ok(tailWorld.distanceTo(new Vector3(0,1.35,-.55).multiplyScalar(scale))<.002,
   'Pelvic reparent changed tail bind pose');
 const count=new Map();
 let triangles=0;
 model.traverse(n=>{
   if(!n.isMesh)return;
   count.set(n.name,(count.get(n.name)||0)+1);
   const a=n.geometry.getAttribute('position'),uv=n.geometry.getAttribute('uv');
   assert.ok(a?.count>=3&&a.array.every(Number.isFinite),
     'Invalid 3D positions in '+n.name);
   assert.equal(uv?.count,a.count,'Missing proper UV coordinates for '+n.name);
   triangles+=(n.geometry.index?.count??a.count)/3;
 });
 for(const [name,number] of [
   ['m004-erector-spinae',2],
   ['m004-pelvis-croup',1],
   ['m004-scapular-shoulder',2],
   ['m004-cervical-muscle',2],
   ['m004-ear-cartilage',2],
   ['m004-temporalis',2],
   ['m004-nostril',2],
   ['m004-vibrissa-follicle',8],
   ['m004-tarsal-joint',4],
   ['m004-metacarpal-pad',4],
   ['m004-digit',16],
 ])assert.equal(count.get(name),number,detail+' missing true mesh '+name);
 assert.ok(triangles>2000&&triangles<900000,detail+' outside mobile triangle budget');
 if(detail==='low')lowTriangles=triangles;
 else assert.ok(triangles>lowTriangles,'High LOD cannot have fewer triangles');
 startMonsterAction(model,'run',0);
 animateMonsterModel(model,.18);
 const lum=p.lumbar.rotation.x,pel=p.pelvis.rotation.x,
  hock=p.hockfrontL.rotation.x,head=p.neckCollar.rotation.x;
 animateMonsterModel(model,.35);
 assert.notEqual(p.lumbar.rotation.x,lum,'Lumbar flexion must animate');
 assert.notEqual(p.pelvis.rotation.x,pel,'Pelvic hinge must animate');
 assert.notEqual(p.hockfrontL.rotation.x,hock,'Tarsal joint must bend');
 assert.notEqual(p.neckCollar.rotation.x,head,'Cervical stabilizer must counterbend');
 assert.notEqual(p.scapulaL.rotation.x,p.scapulaR.rotation.x,
   'Independent shoulder blades must not mirror each other rigidly');
 startMonsterAction(model,'attack',0);
 animateMonsterModel(model,.42);
 assert.ok(Math.abs(p.lumbar.rotation.x)>.05,
   'Prey seizure must recruit lumbar spine');
 assert.ok(p.earL.rotation.x>.14,'Wolf ears must flatten during lunge');
 startMonsterAction(model,'leap',0);
 animateMonsterModel(model,.45);
 assert.ok(Math.abs(p.pelvis.rotation.x)>.05,
   'Jump must involve pelvic angle');
 for(const [action] of MONSTER_ACTIONS){
   startMonsterAction(model,action,0);
   animateMonsterModel(model,.27);
   for(const n of Object.values(p))assert.ok(
     [n.rotation.x,n.rotation.y,n.rotation.z].every(Number.isFinite),
     'Nonfinite pose in '+action+' at '+n.name);
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'm004 materials must release after preview');
}
// Guard unrelated quadrupeds and every human-type shared model.
for(const id of ['m001','m002','m003','m005','m015','m031']){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
 let shared=0;
 model.traverse(n=>{if(n.isMesh&&n.name.startsWith('m004-'))shared++;});
 assert.equal(shared,0,'m004-only meshes leaked into '+id);
 assert.equal(model.userData.pivots.lumbar,undefined,
   'm004-only lumbar rig leaked into '+id);
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0);
}
console.log('m004: actual lumbar/pelvis/neck/shoulder/hock/toe mesh, 10 actions, LOD/UV, human protection: PASS');
