import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AGE_BAND_IDS,AGE_PROFILES} from '../src/character-demographics-v47.js';
import {skinAgeShadowFactor,createAnatomicalFaceParts} from '../src/face-feature-meshes.js';
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
 assert.ok(animator.getState().mouthOpen>.7);
 assert.equal(oral.visible,true);
 animator.dispose();
 assert.equal(face.getObjectByName('V80_INTRAORAL_ANATOMY'),undefined);
 built.root.traverse(o=>{
  if(o.isMesh){o.geometry.dispose();o.material?.dispose?.();}
 });
 face.geometry.dispose();face.material.dispose();
});
