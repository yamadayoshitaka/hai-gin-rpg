import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {blinkEnvelope,speechEnvelope,createFaceExpressionAnimator} from '../src/face-expression-animation-v48.js';
import {updateFaceFeatureAngles} from '../src/face-feature-meshes.js';
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


// Regression: screenshot showed '大笑い' with a nearly closed mouth and
// drooping eyes. Distinct 3D motions must remain pronounced at rest.
test('laugh and surprise visibly open both lips and eyelids, then reset',()=>{
 const model=exampleFace();
 const animator=createFaceExpressionAnimator(model,{autoBlink:false});
 const lip=model.parts.getObjectByName('LOWER_3D_VERMILION_LIP');
 const upperEye=model.parts.getObjectByName('LEFT_UPPER_ANATOMICAL_EYELID');
 animator.setExpression('neutral');
 const lipY=lip.position.y;
 const neutralEye=upperEye.geometry.getAttribute('position').array.slice();
 const neutralSkin=model.face.geometry.getAttribute('position').array.slice();
 animator.setExpression('laugh');
 assert.ok(animator.getState().mouthOpen>=.85&&animator.getState().mouthOpen<.95,
  'Real laugh opens visibly but remains below full jaw extension');
 assert.ok(lipY-lip.position.y>.010,
  'Laughing should actually lower the lip, not merely show a mouth label');
 const cavity=model.face.getObjectByName('V48_3D_INNER_MOUTH');
 assert.ok(cavity?.visible);
 assert.ok(cavity.scale.y>.010,'Mouth opening must remain visibly tall');
 assert.notDeepEqual(upperEye.geometry.getAttribute('position').array,neutralEye,
  'Laughing should widen eyelid opening');
 assert.notDeepEqual(model.face.geometry.getAttribute('position').array,neutralSkin,
  'Laughing should deform real lower jaw and cheeks');
 animator.setExpression('surprised');
 assert.ok(animator.getState().mouthOpen>.65);
 assert.notDeepEqual(upperEye.geometry.getAttribute('position').array,neutralEye);
 animator.setExpression('neutral');
 assert.equal(animator.getState().mouthOpen,0);
 assert.equal(lip.position.y,lipY);
 assert.deepEqual(model.face.geometry.getAttribute('position').array,neutralSkin);
 animator.dispose();
});

test('v80 expressions ease across FACS muscle poses instead of snapping',()=>{
 const model=exampleFace();
 const animator=createFaceExpressionAnimator(model,{autoBlink:false});
 animator.setExpression('neutral');
 animator.transitionToExpression('laugh',.28);
 assert.equal(animator.getState().mouthOpen,0);
 assert.ok(animator.getState().v80TransitionProgress!==null);
 animator.update(.08);
 assert.ok(animator.getState().mouthOpen>.02);
 assert.ok(animator.getState().mouthOpen<.85);
 for(let i=0;i<7;i++)animator.update(.06);
 assert.equal(animator.getState().v80TransitionProgress,null);
 assert.ok(animator.getState().mouthOpen>=.85&&animator.getState().mouthOpen<.95);
 animator.transitionToExpression('neutral',.28);
 for(let i=0;i<7;i++)animator.update(.06);
 assert.equal(animator.getState().mouthOpen,0);
 assert.equal(animator.getState().v80SmoothMuscleTransitions,true);
 animator.dispose();
});

test('v97: all 196 eyeliner vertices refit and follow the 28-column eyelids without shearing',()=>{
 const model=exampleFace();
 const linerAttrs=[];
 for(const side of ['LEFT','RIGHT']){
  for(const upper of [true,false]){
   const label=side+(upper?'_UPPER':'_LOWER');
   const lid=model.parts.getObjectByName(label+'_ANATOMICAL_EYELID');
   const original=lid.geometry.getAttribute('position');
   const positions=[];
   for(let j=0;j<=3;j++)for(let i=0;i<=48;i++){
    const source=Math.round(i/48*28)*3;
    positions.push(original.array[source],original.array[source+1],
     original.array[source+2]+.0004);
   }
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
   const liner=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
   liner.name=label+'_EYELINER';
   lid.add(liner);
   linerAttrs.push(liner);
  }
 }
 const rebuilt=updateFaceFeatureAngles(model.parts,{eyeAngle:2});
 assert.equal(rebuilt.eyelinerMeshesRefitted,4);
 for(const liner of linerAttrs){
  assert.equal(liner.userData.v97AllLinerVerticesRefitted,true);
  assert.equal(liner.geometry.getAttribute('position').count,196);
  const attr=liner.geometry.getAttribute('position');
  assert.ok(Number.isFinite(attr.getX(195))&&Number.isFinite(attr.getY(195)));
 }
 const animator=createFaceExpressionAnimator(model,{autoBlink:false});
 animator.setExpression('laugh');
 const upper=model.parts.getObjectByName('LEFT_UPPER_EYELINER');
 const rest=upper.geometry.getAttribute('position').array.slice();
 const cover=model.parts.getObjectByName('LEFT_ANIMATED_BLINK_CLOSURE');
 assert.equal(cover.visible,false,
  'laugh squint must not show an opaque detached eye-cover ribbon');
 animator.setBlinkProgress(.70);
 assert.equal(cover.visible,false);
 const opened=upper.geometry.getAttribute('position');
 for(const col of [8,24,40,48]){
  const k=(2*49+col)*3+1;
  if(col===48)assert.ok(Number.isFinite(opened.array[k]));
  else assert.ok(Math.abs(opened.array[k]-rest[k])>.001,
   'Every eyeliner column, including after column 28, must track its eyelid');
 }
 animator.setBlinkProgress(1);
 assert.equal(cover.visible,true);
 animator.setBlinkProgress(0);
 assert.deepEqual(upper.geometry.getAttribute('position').array,rest);
 animator.dispose();
});
