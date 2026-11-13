import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {blinkEnvelope,speechEnvelope,createFaceExpressionAnimator} from '../src/face-expression-animation-v48.js';
import {applySkinnedBuildMorph} from '../src/body-build-morph-v48.js';
import {resolveBodyType,resolveDemographicProfile} from '../src/character-demographics-v47.js';

function exampleFace(){
 const face=new THREE.Mesh(new THREE.SphereGeometry(.3,24,16),new THREE.MeshStandardMaterial());
 face.name='FEMALE_INDEPENDENT_CLAY_FACE';
 face.userData.actualMouthCreaseY=-.08;
 const parts=new THREE.Group();face.add(parts);
 const mesh=(name,positions)=>{const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial());
  m.name=name;parts.add(m);return m;};
 for(const sex of ['LEFT','RIGHT']){
  for(const [tag,height] of [['_UPPER_ANATOMICAL_EYELID',.10],['_LOWER_ANATOMICAL_EYELID',-.10]]){
   const positions=[];
   for(let row=0;row<=4;row++)for(let i=0;i<=28;i++)
    positions.push((i/28-.5)*.16,height*(1+Math.sin(Math.PI*i/28))+
      (tag.startsWith('_UPPER')?row*.008:-row*.008),.25);
   mesh(sex+tag,positions);
  }
  for(const label of ['_ORBITAL_EYEBALL','_CURVED_IRIS','_CURVED_PUPIL'])
   mesh(sex+label,[-.04,-.02,.28,.04,.02,.28,.0,.04,.29]);
 }
 for(const label of ['UPPER','LOWER']){
  const m=new THREE.Mesh(new THREE.BoxGeometry(.12,.012,.012),new THREE.MeshStandardMaterial());
  m.name=label+'_3D_VERMILION_LIP';m.position.y=label==='UPPER'?-.074:-.089;parts.add(m);
 }
 return {face,parts};
}
test('blink envelope is zero at rest and closes/reopens smoothly',()=>{
 assert.equal(blinkEnvelope(0),0);
 assert.ok(blinkEnvelope(2.77)>.99);
 assert.equal(blinkEnvelope(3.03),0);
 assert.ok(speechEnvelope(.33)>=0&&speechEnvelope(.33)<=1);
});
test('real linked eyelids move and restore; speech controls real lip meshes',()=>{
 const model=exampleFace();
 const animator=createFaceExpressionAnimator(model);
 assert.equal(animator.getState().blinkEyes,2);
 assert.equal(animator.getState().mouthIs3D,true);
 animator.setBlinkProgress(1);
 assert.equal(animator.getState().blink,1);
 animator.setBlinkProgress(null);
 const upper=model.parts.getObjectByName('LEFT_UPPER_ANATOMICAL_EYELID');
 const before=upper.geometry.getAttribute('position').array.slice();
 for(let i=0;i<55;i++)animator.update(.05);
 assert.ok(animator.getState().blink>.90);
 assert.notDeepEqual(upper.geometry.getAttribute('position').array,before);
 assert.ok(model.parts.getObjectByName('LEFT_ANIMATED_BLINK_CLOSURE').visible);
 animator.setAutoBlink(false);
 assert.deepEqual(upper.geometry.getAttribute('position').array,before);
 const lowerLip=model.parts.getObjectByName('LOWER_3D_VERMILION_LIP');
 const y0=lowerLip.position.y;
 animator.setMouthOpen(.85);
 assert.ok(lowerLip.position.y<y0);
 assert.ok(model.face.getObjectByName('V48_3D_INNER_MOUTH').visible);
 animator.setMouthOpen(null);
 animator.setSpeaking(true);animator.update(.08);
 assert.equal(animator.getState().speaking,true);
 animator.dispose();
 assert.equal(lowerLip.position.y,y0);
 assert.equal(model.face.getObjectByName('V48_3D_INNER_MOUTH'),undefined);
 assert.deepEqual(upper.geometry.getAttribute('position').array,before);
});
test('normal and fat are fuller and fat has a visible abdomen morph',()=>{
 const thin=resolveBodyType('thin'),normal=resolveBodyType('normal'),fat=resolveBodyType('fat');
 assert.ok(normal.width>=1&&normal.width<=1.075&&normal.depth<=1.075);
 assert.ok(fat.width>normal.width*1.25&&fat.depth>normal.depth*1.25);
 assert.ok(fat.abdomen>normal.abdomen*3);
 assert.ok(fat.faceFullness>normal.faceFullness);
 assert.ok(resolveDemographicProfile('eightyPlus','fat').body.abdomen===fat.abdomen);
 const source=new THREE.SphereGeometry(1,20,16);
 const avatar=new THREE.Group();
 const torso=new THREE.SkinnedMesh(source,new THREE.MeshStandardMaterial());
 torso.name='TORSO_SKIN';avatar.add(torso);
 const before=source.getAttribute('position').array.slice();
 const thinReport=applySkinnedBuildMorph(avatar,'thin');
 assert.equal(thinReport.meshes,1);
 const thinPoints=torso.geometry.getAttribute('position').array.slice();
 const fatReport=applySkinnedBuildMorph(avatar,'fat');
 assert.equal(fatReport.accumulative,false);
 assert.notDeepEqual(torso.geometry.getAttribute('position').array,thinPoints);
 assert.deepEqual(source.getAttribute('position').array,before);
 applySkinnedBuildMorph(avatar,'normal');
 const normalPoints=torso.geometry.getAttribute('position').array.slice();
 applySkinnedBuildMorph(avatar,'fat');
 applySkinnedBuildMorph(avatar,'normal');
 assert.deepEqual(torso.geometry.getAttribute('position').array,normalPoints);
});
