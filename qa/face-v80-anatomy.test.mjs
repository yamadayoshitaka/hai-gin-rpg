import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AGE_BAND_IDS,AGE_PROFILES} from '../src/character-demographics-v47.js';
import {skinAgeShadowFactor,createAnatomicalFaceParts,applyFaceColorMode} from '../src/face-feature-meshes.js';
import {createFaceExpressionAnimator} from '../src/face-expression-animation-v48.js';
import {FACS_CHANNELS_V80,deriveFacialActionUnits,v80FaceMuscleDelta}
 from '../src/face-anatomy-rig-v80.js';

test('fifties are selectable between forties and sixties with continuous aging',()=>{
 assert.equal(AGE_BAND_IDS.length,9);
 const f=AGE_BAND_IDS.indexOf('fifties');
 assert.ok(f>0);
 assert.equal(AGE_BAND_IDS[f-1],'forties');
 assert.equal(AGE_BAND_IDS[f+1],'sixties');
 for(const k of ['sag','wrinkles']){
  assert.ok(AGE_PROFILES.forties[k]<AGE_PROFILES.fifties[k]);
  assert.ok(AGE_PROFILES.fifties[k]<AGE_PROFILES.sixties[k]);
 }
 assert.ok(skinAgeShadowFactor('forties')<skinAgeShadowFactor('fifties'));
 assert.ok(skinAgeShadowFactor('fifties')<skinAgeShadowFactor('sixties'));
});

test('FACS action units couple cheeks, smile grooves, jaw and eyelids',()=>{
 assert.equal(FACS_CHANNELS_V80.length,14);
 const smile=deriveFacialActionUnits({smile:1,cheek:.7});
 assert.ok(smile.au12>.9&&smile.au06>.5);
 const laugh=v80FaceMuscleDelta({ax:.23,ny:.59,front:1,
  expression:{smile:1,cheek:.7},mouthY:.509,ageStrength:.7});
 const rest=v80FaceMuscleDelta({ax:.23,ny:.59,front:1,
  expression:{},mouthY:.509,ageStrength:.7});
 assert.ok(laugh.dy>rest.dy,'Cheek raising has anatomical displacement');
 assert.notEqual(laugh.dz,rest.dz,'Nasolabial skin responds to smile');
 assert.deepEqual(v80FaceMuscleDelta({ax:.2,ny:.55,front:0,
  expression:{smile:1}}).dy,0);
 const jaw=deriveFacialActionUnits({open:1});
 assert.ok(jaw.au26>.99);
 assert.equal(deriveFacialActionUnits({smile:1,au12:.2}).au12,.2);
});

test('real eye contains lacrimal caruncle and blinking wet rim',()=>{
 const face=new THREE.Mesh(new THREE.SphereGeometry(.20,52,38),
  new THREE.MeshStandardMaterial());
 // This legacy dental test exercises the experimental topology only.
 face.userData.enableExperimentalOralSurgery=true;
 const built=createAnatomicalFaceParts(face,{gender:'female',
  controls:{ageBand:'fifties'}});
 face.add(built.root);
 const leftDuct=built.root.getObjectByName('LEFT_LACRIMAL_CARUNCLE');
 const rightDuct=built.root.getObjectByName('RIGHT_LACRIMAL_CARUNCLE');
 assert.ok(leftDuct?.isMesh&&rightDuct?.isMesh);
 assert.ok(leftDuct.material.clearcoat>.2);
 const wet=built.root.getObjectByName('LEFT_LOWER_TEAR_MENISCUS');
 assert.ok(wet?.geometry.getAttribute('position').count===29*3);
 assert.ok(wet.material.clearcoat>.5);
 const animator=createFaceExpressionAnimator({face,parts:built.root},
  {autoBlink:false});
 const before=wet.geometry.getAttribute('position').array.slice();
 animator.setBlinkProgress(.95);
 assert.notDeepEqual(wet.geometry.getAttribute('position').array,before,
  'Tear film must travel with the lower eyelid');
 animator.setBlinkProgress(0);
 assert.deepEqual(wet.geometry.getAttribute('position').array,before);
 animator.setExpression('laugh');
 const oral=face.getObjectByName('V80_INTRAORAL_ANATOMY');
 assert.ok(oral?.visible);
 assert.equal(animator.getState().v80MouthAnatomy.upperTeeth,12);
 assert.equal(animator.getState().v80MouthAnatomy.lowerTeeth,12);
 assert.equal(animator.getState().v80FACSChannels,14);
 assert.ok(oral.getObjectByName('V80_UPPER_TOOTH_01'));
 assert.ok(oral.getObjectByName('V80_LOWER_TOOTH_12'));
 assert.ok(oral.getObjectByName('V80_TONGUE_DORSUM'));
 assert.equal(oral.getObjectByName('V80_TONGUE_JAW_FOLLOW').visible,true);
 animator.setExpression('neutral');
 assert.equal(oral.visible,false);
 animator.setActionUnits({au12:1,au06:.8,au26:.8});
 assert.ok(animator.getState().mouthOpen>=.65);
 assert.equal(oral.visible,true);
 animator.dispose();
 assert.equal(face.getObjectByName('V80_INTRAORAL_ANATOMY'),undefined);
 built.root.traverse(o=>{
  if(o.isMesh){o.geometry.dispose();o.material?.dispose?.();}
 });
 face.geometry.dispose();face.material.dispose();
});

test('v81 lipstick lives on deforming lip mesh without static head ghost',()=>{
 const face=new THREE.Mesh(new THREE.SphereGeometry(.2,52,38),
  new THREE.MeshStandardMaterial());
 face.name='FEMALE_INDEPENDENT_CLAY_FACE';
 // This legacy dental test exercises the experimental topology only.
 face.userData.enableExperimentalOralSurgery=true;
 const built=createAnatomicalFaceParts(face,{
  gender:'female',controls:{ageBand:'seventies'}
 });
 face.add(built.root);
 applyFaceColorMode(face,'color',{makeupType:2});
 assert.equal(face.userData.v81NoStaticLipstickGhost,true);
 assert.ok([
  'deforming-vermilion-vertices-v81','integrated-head-mouth-vertices-v82'
 ].includes(face.userData.mouthPigmentSource));
 const lip=built.root.getObjectByName('UPPER_3D_VERMILION_LIP');
 assert.equal(lip.userData.v81PigmentBoundToAnimatedLip,true);
 assert.equal(lip.userData.lipstickOnSourceHead,false);
 const integrated=!!face.userData.v82IntegratedMouth?.integrated;
 const visible=integrated?face.geometry:lip.geometry;
 const before=visible.getAttribute('position').array.slice();
 const skinPigment=face.geometry.getAttribute('color').array.slice();
 const animator=createFaceExpressionAnimator({face,parts:built.root},{autoBlink:false});
 animator.setExpression('laugh');
 const after=visible.getAttribute('position').array;
 if(integrated){
  const pairs=face.userData.v82IntegratedMouth.pairs;
  const corner=pairs.find(p=>p.sign>0&&Math.abs(p.t)>.8);
  const middle=pairs.find(p=>p.sign>0&&Math.abs(p.t)<.40);
  assert.ok(corner&&middle);
  assert.equal(lip.visible,false,'No static lip overlay on integrated skin');
  assert.ok(after[corner.inner*3+1]>before[corner.inner*3+1]);
  assert.ok(after[corner.inner*3+1]-before[corner.inner*3+1]>
   after[middle.inner*3+1]-before[middle.inner*3+1]);
 }else{
  const corner=0,mid=16*3;
  assert.ok(after[corner+1]>before[corner+1]);
  assert.ok(Math.abs(after[corner]-before[corner])>0);
  assert.ok(after[corner+1]-before[corner+1]>
   after[mid+1]-before[mid+1]);
 }
 assert.deepEqual(face.geometry.getAttribute('color').array,skinPigment);
 animator.setExpression('neutral');
 const reset=visible.getAttribute('position').array;
 if(integrated)
  assert.ok(reset.every((v,i)=>Math.abs(v-before[i])<1e-5));
 else assert.deepEqual(reset,before);
 animator.dispose();
 built.root.traverse(o=>{
  if(o.isMesh){o.geometry.dispose();o.material?.dispose?.();}
 });
 face.geometry.dispose();face.material.dispose();
});

test('v81 dental crowns are short rounded enamel, tongue is low and recessed',()=>{
 const face=new THREE.Mesh(new THREE.SphereGeometry(.2,52,38),
  new THREE.MeshStandardMaterial());
 // This legacy dental test exercises the experimental topology only.
 face.userData.enableExperimentalOralSurgery=true;
 const built=createAnatomicalFaceParts(face,{gender:'female'});
 face.add(built.root);
 const animator=createFaceExpressionAnimator({face,parts:built.root},{autoBlink:false});
 animator.setExpression('laugh');
 const oral=face.getObjectByName('V80_INTRAORAL_ANATOMY');
 assert.ok(oral.visible);
 const crown=oral.getObjectByName('V80_UPPER_TOOTH_06');
 assert.equal(crown.userData.anatomicalCrown,'rounded-short-v81');
 assert.ok(crown.scale.y/crown.scale.x<1.25,
  'Dentition must never become long vampire fangs');
 assert.ok(crown.position.z<0,'Teeth recede behind the oral vestibule');
 const tongue=oral.getObjectByName('V80_TONGUE_DORSUM');
 assert.ok(tongue.scale.x>tongue.scale.y*3,
  'Tongue dorsum must be flattened and broad, not a sphere');
 assert.ok(tongue.position.z<0,'Tongue must remain in the oral cavity');
 const eye=built.root.getObjectByName('LEFT_ORBITAL_EYEBALL');
 assert.equal(eye.userData.v81ScleralMicrovascularPBR,true);
 assert.ok(eye.material.map?.isTexture);
 assert.equal(animator.getState().v81AnatomicalSmileEyeCoupling,true);
 const upper=built.root.getObjectByName('LEFT_UPPER_ANATOMICAL_EYELID');
 const lower=built.root.getObjectByName('LEFT_LOWER_ANATOMICAL_EYELID');
 animator.setExpression('neutral');
 const upperRest=upper.geometry.getAttribute('position').array.slice();
 const lowerRest=lower.geometry.getAttribute('position').array.slice();
 animator.setExpression('laugh');
 assert.notDeepEqual(upper.geometry.getAttribute('position').array,upperRest);
 assert.notDeepEqual(lower.geometry.getAttribute('position').array,lowerRest);
 animator.dispose();
 built.root.traverse(o=>{
  if(o.isMesh){o.geometry.dispose();o.material?.dispose?.();}
 });
 face.geometry.dispose();face.material.dispose();
});
