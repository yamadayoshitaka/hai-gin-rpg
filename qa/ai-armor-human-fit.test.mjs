import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitImportedArmorOverHuman,alignLooseGauntletsToRealHands,poseHumanForRigidArmorFit} from '../src/character-system/ai-armor-human-fit.js';

test('fitting resizes imported armor, never the real anatomy or its rig',()=>{
 const scene=new THREE.Scene();
 const human=new THREE.Group(),armor=new THREE.Group();
 const hmesh=new THREE.Mesh(new THREE.BoxGeometry(.65,1.78,.35));
 hmesh.position.y=.89;human.add(hmesh);
 const gmesh=new THREE.Mesh(new THREE.BoxGeometry(2,5,1.5));
 gmesh.position.y=2.5;armor.add(gmesh);
 scene.add(human,armor);
 const saved={scale:human.scale.clone(),position:human.position.clone()};
 const original={scale:armor.scale.clone(),position:armor.position.clone()};
 const result=fitImportedArmorOverHuman(human,armor);
 assert.equal(human.scale.equals(saved.scale),true);
 assert.equal(human.position.equals(saved.position),true);
 assert.ok(Math.abs(result.worldHeight-1.78)<.001);
 assert.ok(result.floorError<.001);
 assert.equal(result.rigReady,false);
 assert.equal(result.armorParts,1);
 result.restore();
 assert.equal(armor.scale.equals(original.scale),true);
 assert.equal(armor.position.equals(original.position),true);
});
test('fit rejects empty meshes and impossible dimensions without mutating body',()=>{
 const person=new THREE.Group(),garment=new THREE.Group();
 assert.throws(()=>fitImportedArmorOverHuman(person,garment),/サイズ/);
 const bone=new THREE.Bone();person.add(bone);
 assert.throws(()=>fitImportedArmorOverHuman(person,garment),/サイズ/);
});

test('detached gauntlets align to real hands and their original transforms restore',()=>{
 const scene=new THREE.Scene(),human=new THREE.Group(),armor=new THREE.Group();
 scene.add(human,armor);
 for(const [side,x] of [['l',-.5],['r',.5]]){
  const hand=new THREE.Bone();hand.name='hand_'+side;hand.position.set(x,.85,0);human.add(hand);
 }
 const meshes=[];
 for(const [suffix,x] of [['-1',-1.45],['1',1.45]]){
  for(let i=0;i<5;i++){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1));
   mesh.name='gauntlets__Block_hand_part_'+i+'_'+suffix;
   mesh.position.set(x+i*.002,1.0,0);
   armor.add(mesh);meshes.push(mesh);
  }
 }
 const before=meshes.map(m=>m.position.clone());
 const result=alignLooseGauntletsToRealHands(human,armor);
 assert.equal(result.movedMeshes,10);
 const centers={left:new THREE.Box3(),right:new THREE.Box3()};
 for(const m of meshes)centers[m.position.x<0?'left':'right'].expandByObject(m);
 assert.ok(Math.abs(centers.left.getCenter(new THREE.Vector3()).x+.5)<.01);
 assert.ok(Math.abs(centers.right.getCenter(new THREE.Vector3()).x-.5)<.01);
 result.restore();
 meshes.forEach((mesh,i)=>assert.ok(mesh.position.distanceTo(before[i])<1e-8));
});

test('upright armor fitting A pose lowers arms without moving torso or legs',()=>{
 const human=new THREE.Group(),shoulders=[],forearms=[];
 for(const [side,x] of [['l',-.5],['r',.5]]){
  const upper=new THREE.Bone();upper.name='upperarm_'+side;upper.position.set(x,1.5,0);
  const lower=new THREE.Bone();lower.name='lowerarm_'+side;lower.position.set(x,0,0);
  upper.add(lower);human.add(upper);shoulders.push(upper);forearms.push(lower);
 }
 human.updateWorldMatrix(true,true);
 const initial=forearms.map(x=>x.getWorldPosition(new THREE.Vector3()));
 const report=poseHumanForRigidArmorFit(human);
 const after=forearms.map(x=>x.getWorldPosition(new THREE.Vector3()));
 assert.equal(report.applied,2);
 assert.ok(after[0].y<initial[0].y-.2,'left arm lowered');
 assert.ok(after[1].y<initial[1].y-.2,'right arm lowered');
 report.restore();
 forearms.forEach((bone,i)=>assert.ok(bone.getWorldPosition(new THREE.Vector3()).distanceTo(initial[i])<1e-8));
});
