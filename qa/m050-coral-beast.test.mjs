import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {animateMonsterModel,startMonsterAction} from '../src/monster-animation.js';
import {createRegisteredBattleMonster} from '../src/battle-registered-monster-model.js';
import {createMonsterSummonRenderer} from '../src/monster-summon-renderer.js';
import {M050_CORAL_REVISION} from '../src/m050-coral-beast-sculpt.js';

const spec=MONSTER_BY_ID.m050;
for(const detail of ['low','high'])test('coral sea beast anatomy and vertex data at '+detail,()=>{
 const model=createMonsterModel(spec,{detail});
 try{
  assert.equal(model.userData.gameModelRevision,M050_CORAL_REVISION);
  assert.equal(model.userData.nonhumanOutfit,'sea-god-raiment');
  const p=model.userData.pivots,neck=model.getObjectByName('m050-long-neck');
  assert.equal(p.head.parent,neck.parent);
  assert.equal(p.jaw.parent,p.head);
  assert.ok(p.head.position.y>1);
  assert.equal(p.tailTip.parent,p.tailMid);
  const tail=model.getObjectByName('m050-continuous-caudal-skin');
  assert.ok(tail.isSkinnedMesh&&tail.userData.cappedTubularSkin);
  assert.equal(tail.skeleton.bones.length,3);
  model.updateMatrixWorld(true);
  const skull=model.getObjectByName('m050-dragon-skull');
  for(const side of ['L','R']){
   const horn=model.getObjectByName('m050-coral-horn-'+side);
   const origin=p.head.localToWorld(new THREE.Vector3(...horn.geometry.userData.root));
   const out=new THREE.Vector3(side==='L'?-.34:.34,.8,-.22).transformDirection(p.head.matrixWorld);
   const hits=new THREE.Raycaster(origin,out).intersectObject(skull,false);
   assert.equal(hits.length%2,1,'primary coral root is inside skull');
   assert.ok(hits[0].distance>.02);
   const eye=model.getObjectByName('m050-luminous-eye-'+side);
   const lateral=side==='L'?-1:1;
   const sightline=new THREE.Raycaster(p.head.localToWorld(new THREE.Vector3(lateral,.074,.253)),
    new THREE.Vector3(-lateral,0,0).transformDirection(p.head.matrixWorld));
   const eyeHit=sightline.intersectObject(eye,false)[0];
   const skullHit=sightline.intersectObject(skull,false)[0];
   assert.ok(eyeHit&&skullHit&&eyeHit.distance<skullHit.distance,'the eye is visible outside the skull');
   assert.equal(model.getObjectByName('m050-coral-fork-inner-'+side).parent,p.head);
   assert.equal(model.getObjectByName('m050-forked-tail-fin-'+side).parent,p.tailTip);
  }
  for(const name of ['frontL','frontR','rearL','rearR']){
   assert.equal(p['lower'+name].parent,p['leg'+name]);
   assert.equal(p['toe'+name].parent,p['lower'+name]);
  }
  assert.ok(Math.abs(new THREE.Box3().setFromObject(model,true).min.y)<.02);
  model.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const geo=mesh.geometry,vertices=geo.getAttribute('position').count;
   for(const attr of Object.values(geo.attributes))assert.equal(attr.count,vertices,mesh.name);
   assert.ok(geo.index?.array.every(index=>index<vertices)??true,mesh.name);
  });
  const index=tail.geometry.attributes.position.count-1;
  const rest=tail.getVertexPosition(index,new THREE.Vector3());
  startMonsterAction(model,'walk',0);
  animateMonsterModel(model,.31);
  model.updateMatrixWorld(true);
  assert.ok(Math.abs(p.lowerfrontL.rotation.x)>.01,'lower limb walks');
  assert.ok(rest.distanceTo(tail.getVertexPosition(index,new THREE.Vector3()))>.025,'tail flexes');
  startMonsterAction(model,'attack',1);
  animateMonsterModel(model,1.22);
  assert.ok(p.jaw.rotation.x>.12,'jaw opens on attack');
 }finally{disposeMonsterSculpture(model);}
});

test('existing enemy and summon entries automatically use the coral model',()=>{
 const enemy=createRegisteredBattleMonster(spec,{detail:'low'});
 const scene=new THREE.Scene(),summons=createMonsterSummonRenderer(scene);
 try{
  assert.equal(enemy.choice.record.version,M050_CORAL_REVISION);
  assert.ok(enemy.root.getObjectByName('m050-dragon-skull'));
  summons.sync([{id:'coral',type:'summon_m050',x:6,z:6,alive:true}],0);
  const model=summons.actualModel('coral');
  assert.equal(model.userData.gameModelRevision,M050_CORAL_REVISION);
  assert.ok(model.getObjectByName('m050-coral-horn-L'));
 }finally{enemy.dispose();summons.dispose();}
});
