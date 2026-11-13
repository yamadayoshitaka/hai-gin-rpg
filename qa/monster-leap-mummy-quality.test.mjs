import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {MONSTER_LEAP_PHASES,monsterLeapPose} from '../src/monster-leap-kinematics.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';

assert.equal(MONSTER_LEAP_PHASES.length,4);
assert.deepEqual(MONSTER_LEAP_PHASES.map(x=>x.name),
 ['anticipation','takeoff','airborne','landing']);
for(const family of ['beast','feline','avian','reptile','insect','arachnid',
 'undead','golem','fiend','aquatic']){
 const anticipation=monsterLeapPose(.14,family);
 const takeoff=monsterLeapPose(.33,family);
 const airborne=monsterLeapPose(.54,family);
 const landing=monsterLeapPose(.82,family);
 const recovered=monsterLeapPose(1,family);
 assert.equal(anticipation.phase,'anticipation',family);
 assert.ok(anticipation.height<0&&anticipation.crouch>0,'missing pre-jump crouch '+family);
 assert.equal(takeoff.phase,'takeoff');
 assert.ok(takeoff.height>0,'takeoff must rise '+family);
 assert.ok(airborne.height>0&&airborne.airborne,'airborne lift missing '+family);
 assert.ok(landing.crouch>0&&landing.height<0,'impact must compress '+family);
 assert.ok(Math.abs(recovered.height)<1e-8&&recovered.crouch<1e-8,
  'jump must finish standing '+family);
 for(let i=0;i<=100;i++){
  const q=monsterLeapPose(i/100,family);
  for(const n of [q.height,q.pitch,q.crouch,q.extension,q.tuck])
   assert.ok(Number.isFinite(n),'NaN in '+family+' jump phase');
 }
}
assert.ok(monsterLeapPose(.54,'golem').height<
 monsterLeapPose(.54,'feline').height,'heavy giants must jump lower');

const three=await import('three').catch(e=>{
 if(e.code==='ERR_MODULE_NOT_FOUND')return null;
 throw e;
});
if(three){
 const {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}=
  await import('../src/monster-geometry.js');
 const mummy=createMonsterModel(MONSTER_BY_ID.m032,{detail:'high'});
 const p=mummy.userData.pivots;
 for(const key of ['head','torso','armL','armR','elbowL','elbowR',
   'legL','legR','kneeL','kneeR'])
  assert.ok(p[key]?.isGroup,'mummy missing physical joint '+key);
 const wraps=[],sockets=[],irises=[];
 mummy.traverse(o=>{
  if(o.isMesh&&o.name.startsWith('m032-')&&o.name.includes('wrap')||
     o.isMesh&&/^m032-(thigh|shin|upper-arm|forearm)/.test(o.name))wraps.push(o);
  if(o.name==='m032-orbit')sockets.push(o);
  if(o.name==='m032-clouded-iris')irises.push(o);
 });
 assert.ok(wraps.length>=11,'mummy requires layered 3D cloth on body and moving limbs');
 assert.equal(sockets.length,2,'mummy should have two recessed eye sockets');
 assert.equal(irises.length,2,'mummy needs two desiccated eyes');
 assert.ok(irises.every(o=>o.material.emissiveIntensity===0),
  'mummy eyes must not glow like toy LEDs');
 const forearm=wraps.find(o=>o.name==='m032-forearm-L');
 const shin=wraps.find(o=>o.name==='m032-shin-R');
 assert.strictEqual(forearm.parent,p.elbowL,'forearm cloth must follow elbow');
 assert.strictEqual(shin.parent,p.kneeR,'shin cloth must follow knee');
 assert.ok(forearm.geometry.getAttribute('uv')?.count>40,
  'mummy bandage needs drawable UV ribbon geometry');
 const vertex=new three.Vector3().fromBufferAttribute(
  forearm.geometry.getAttribute('position'),28);
 mummy.updateMatrixWorld(true);
 const initial=vertex.clone().applyMatrix4(forearm.matrixWorld);
 p.elbowL.rotation.x=.45;
 mummy.updateMatrixWorld(true);
 const flexed=vertex.clone().applyMatrix4(forearm.matrixWorld);
 assert.ok(initial.distanceTo(flexed)>.004,'bandages must move with their elbow');
 // Four-stage transitions must articulate monster limbs, not just translate root.
 startMonsterAction(mummy,'leap',10);
 animateMonsterModel(mummy,10.13);
 const preHeight=mummy.position.y;
 const preKnee=p.kneeL.rotation.x;
 animateMonsterModel(mummy,10.68);
 assert.ok(mummy.position.y>0&&mummy.position.y>preHeight,
  'mummy must leave floor after its crouch');
 assert.notEqual(p.kneeL.rotation.x,preKnee,
  'mummy knee should fold in flight');
 const airborneHeight=mummy.position.y;
 animateMonsterModel(mummy,11.04);
 assert.ok(mummy.position.y<airborneHeight,
  'mummy must absorb landing impact');
 animateMonsterModel(mummy,11.25);
 assert.ok(Math.abs(mummy.position.y)<1e-6,'mummy should recover to ground');
 disposeMonsterSculpture(mummy);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
  'mummy bandage materials should be released');
 for(const id of ['m031','m035','m039','m043','m011','m004']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  const joints=model.userData.pivots;
  startMonsterAction(model,'leap',0);
  animateMonsterModel(model,.16);
  const pre=model.position.y;
  animateMonsterModel(model,.67);
  assert.ok(model.position.y>pre,
   id+' jump must lift the procedural body');
  if(joints.kneeL){
   assert.ok(Math.abs(joints.kneeL.rotation.x)>.05,
    id+' jump must bend the humanoid knee');
  }
  animateMonsterModel(model,1.25);
  assert.ok(Math.abs(model.position.y)<1e-6,
   id+' should land with zero vertical offset');
  disposeMonsterSculpture(model);
 }
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
  'no leftover materials from humanoid leap checks');
}
console.log('Mummy anatomy/UV bandages, joint-following cloth and four-phase family leap: PASS');
