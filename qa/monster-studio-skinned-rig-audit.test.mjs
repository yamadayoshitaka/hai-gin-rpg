import assert from 'node:assert/strict';
import * as THREE from 'three';
import {inspectStudioSkinnedActor}
 from '../src/monster-studio-skinned-rig-audit.js';
import {planHumanoidCosplayBase,STUDIO_ACTOR_PACKAGE_SCHEMA,
 REQUIRED_SKINNED_BONE_SLOTS,REQUIRED_MOTION_SLOTS}
 from '../src/monster-studio-base-intake.js';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';

function makeStudioActor(){
 const scene=new THREE.Group(),bones={};
 function bone(name,parent,x=0,y=0,z=0){
  const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);
  parent.add(b);bones[name]=b;return b;
 }
 const geometry=new THREE.BoxGeometry(.45,1.6,.23);
 const count=geometry.getAttribute('position').count;
 const idx=new Uint16Array(count*4),weight=new Float32Array(count*4);
 for(let i=0;i<count;i++)weight[i*4]=1;
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(idx,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weight,4));
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());
 mesh.name='studio-female-fullbody-skinned';scene.add(mesh);
 const hips=bone('hips',mesh,0,.89);
 const spine=bone('spine',hips,0,.42);
 const neck=bone('neck',spine,0,.18);
 bone('head',neck,0,.19);
 const leftArm=bone('upperArmL',spine,.26,.10);
 bone('lowerArmL',leftArm,.22,-.24);
 const rightArm=bone('upperArmR',spine,-.26,.10);
 bone('lowerArmR',rightArm,-.22,-.24);
 const leftThigh=bone('thighL',hips,.12,-.40);
 bone('calfL',leftThigh,0,-.41);
 const rightThigh=bone('thighR',hips,-.12,-.40);
 bone('calfR',rightThigh,0,-.41);
 mesh.bind(new THREE.Skeleton(Object.values(bones)));
 scene.updateMatrixWorld(true);
 const motion=Object.fromEntries(REQUIRED_MOTION_SLOTS.map(k=>[k,k]));
 const clips=REQUIRED_MOTION_SLOTS.map(name=>new THREE.AnimationClip(name,1,[
  new THREE.QuaternionKeyframeTrack('hips.quaternion',[0,1],
   [0,0,0,1,0,0,0,1])
 ]));
 const contract={
  schema:STUDIO_ACTOR_PACKAGE_SCHEMA,sex:'female',
  modelId:'Studio_Female_Production_01',
  modelUrl:'./assets/characters/studio/female-verified-v60.glb',
  revision:'v60',productionSkinnedActor:true,
  sourceFaceNeckContinuous:true,
  bones:Object.fromEntries(REQUIRED_SKINNED_BONE_SLOTS.map(name=>[name,name])),
  motions:motion,mappedBoneNames:REQUIRED_SKINNED_BONE_SLOTS.slice(),
  measuredHeightM:1.67,targetHeightM:1.66,
  face:{eyes:true,eyelids:true,blink:true,mouth:true,jaw:true,neck:true},
  fitting:{wigBaseMasked:true,armorAndCostumeNoClips:true,wingAndHornRoots:true},
  visualQA:{front:true,side:true,back:true,top:true,
   androidWebGL:true,battleRegression:true}
 };
 return {scene,mesh,geometry,bones,clips,contract};
}
const actor=makeStudioActor();
const positions=actor.geometry.getAttribute('position').array.slice();
const originalSkeleton=actor.mesh.skeleton;
const originalMaterial=actor.mesh.material;
const clean=inspectStudioSkinnedActor(actor.scene,actor.contract,{
 animations:actor.clips
});
assert.equal(clean.ready,true,JSON.stringify(clean.errors));
assert.equal(clean.skinnedMeshes,1);
assert.equal(clean.sourceUnmodified,true);
assert.equal(clean.bindings.head,actor.bones.head);
assert.equal(clean.bindings.upperArmR,actor.bones.upperArmR);
assert.equal(clean.motionNames.length,6);
const profile=FEMALE_SUMMON_FORMS.forest_archer;
const accepted=planHumanoidCosplayBase(profile,{
 studioPackage:actor.contract,studioScene:actor.scene,
 studioAnimations:actor.clips
});
assert.equal(accepted.studioPackageReady,true);
assert.equal(accepted.studioRigReady,true);
assert.equal(accepted.studioRigSkinnedMeshes,1);
assert.equal(accepted.activationAllowed,false,
 'Even a fully audited synthetic candidate may not silently replace production');
assert.equal(accepted.nextAction,'implement-and-test-actor-loader');
assert.strictEqual(actor.mesh.skeleton,originalSkeleton);
assert.strictEqual(actor.mesh.material,originalMaterial);
assert.deepEqual(Array.from(actor.geometry.getAttribute('position').array),
 Array.from(positions),'Audit must never change source geometry');

const missingClip=inspectStudioSkinnedActor(actor.scene,actor.contract,{
 animations:actor.clips.filter(c=>c.name!=='dead')
});
assert.ok(missingClip.errors.includes('missing-motion:dead'));
const unrelated=new THREE.AnimationClip('idle',1,[
 new THREE.VectorKeyframeTrack('foreignDummy.position',[0,1],
 [0,0,0,0,0,0])
]);
const foreign=inspectStudioSkinnedActor(actor.scene,actor.contract,{
 animations:[unrelated,...actor.clips.filter(c=>c.name!=='idle')]
});
assert.ok(foreign.errors.includes('unbound-motion:idle'));
const missingJoint=inspectStudioSkinnedActor(actor.scene,{
 ...actor.contract,bones:{...actor.contract.bones,upperArmR:'MissingArm'}
},{animations:actor.clips});
assert.ok(missingJoint.errors.includes('missing-anchor:upperArmR'));
const sourceWeights=actor.geometry.getAttribute('skinWeight');
for(let i=0;i<sourceWeights.count;i++)sourceWeights.setX(i,0);
const badWeight=inspectStudioSkinnedActor(actor.scene,actor.contract,{
 animations:actor.clips
});
assert.ok(badWeight.errors.includes('invalid-skinning-weights'));
for(let i=0;i<sourceWeights.count;i++)sourceWeights.setX(i,1);
const oldY=actor.bones.head.position.y;
actor.bones.head.position.y=-.9;
const inverted=inspectStudioSkinnedActor(actor.scene,actor.contract,{
 animations:actor.clips
});
assert.ok(inverted.errors.includes('inverted-or-invalid-anatomical-height'));
actor.bones.head.position.y=oldY;
const noScene=planHumanoidCosplayBase(profile,{studioPackage:actor.contract});
assert.equal(noScene.studioPackageReady,true);
assert.equal(noScene.studioRigReady,false);
assert.equal(noScene.activationAllowed,false);
assert.ok(noScene.studioRigErrors.includes('studio-scene-not-audited'));
actor.geometry.dispose();actor.mesh.material.dispose();
console.log('Studio skinned actor real-scene QA PASS: weighted geometry, mapped bones, 6 motion tracks, height, and no live replacement');
