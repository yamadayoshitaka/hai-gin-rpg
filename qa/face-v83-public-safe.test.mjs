import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAnatomicalFaceParts,applyFaceColorMode}
 from '../src/face-feature-meshes.js';
import {createFaceExpressionAnimator,FACE_EXPRESSIONS}
 from '../src/face-expression-animation-v48.js';

test('v83 production release never cuts facial mouth triangles or draws black overlays',()=>{
 for(const gender of ['female','male']){
  for(const ageBand of ['twenties','fifties','seventies','eightyPlus']){
   const face=new THREE.Mesh(new THREE.SphereGeometry(.22,96,72),
    new THREE.MeshStandardMaterial());
   face.name=gender.toUpperCase()+'_INDEPENDENT_CLAY_FACE';
   const originalVertexCount=face.geometry.getAttribute('position').count;
   const built=createAnatomicalFaceParts(face,{gender,controls:{ageBand}});
   face.add(built.root);
   assert.equal(face.userData.v83SafeOriginalMouthTopology,true);
   assert.equal(face.userData.v83OralSurgeryQuarantined,true);
   assert.equal(face.userData.v82MouthTopologyReport.integrated,false);
   assert.equal(face.userData.v82MouthTopologyReport.removedTriangles,0);
   assert.equal(face.geometry.getAttribute('position').count,originalVertexCount,
    'A production face must not acquire arbitrary stitching vertices');
   for(const id of ['UPPER','LOWER']){
    const strip=built.root.getObjectByName(id+'_3D_VERMILION_LIP');
    assert.ok(strip);
    assert.equal(strip.visible,false,'Overlay lip must not render');
    assert.equal(strip.userData.v83HiddenOverlayMouth,true);
   }
   assert.equal(face.userData.mouthPigmentSource,
    'original-head-animated-vertex-colors-v83');
   applyFaceColorMode(face,'color',{makeupType:1});
   assert.equal(face.geometry.getAttribute('color').count,originalVertexCount);
   const animator=createFaceExpressionAnimator({face,parts:built.root},
    {autoBlink:false});
   const initial=face.geometry.getAttribute('position').array.slice();
   const indexCount=face.geometry.getIndex()?.count;
   for(const expression of Object.keys(FACE_EXPRESSIONS)){
    animator.setExpression(expression);
    assert.equal(animator.getState().v83ProductionSafetyMode,true);
    assert.equal(animator.getState().v83ForegroundOverlaysDisabled,true);
    assert.equal(animator.getState().v84JawOpeningQuarantined,true);
    assert.equal(animator.getState().v84OralSkinInversionGuard,true);
    assert.equal(animator.getState().mouthOpen,0,
     'Closed donor topology cannot report a fake open mouth');
    assert.equal(animator.getState().v83OralCavityDeferredUntilTopologyValidated,true);
    assert.equal(face.getObjectByName('V48_3D_INNER_MOUTH'),undefined);
    assert.equal(face.getObjectByName('V80_INTRAORAL_ANATOMY'),undefined);
    assert.equal(face.geometry.getIndex()?.count,indexCount);
    assert.ok(face.geometry.getAttribute('position').array.every(Number.isFinite));
    assert.ok(face.geometry.getAttribute('normal').array.every(Number.isFinite));
   }
   animator.setExpression('smile');
   assert.notDeepEqual(face.geometry.getAttribute('position').array,initial,
    'Facial muscle fields still animate the original head vertices');
   animator.setExpression('neutral');
   assert.deepEqual(face.geometry.getAttribute('position').array,initial);
   animator.dispose();
   built.root.traverse(o=>{
    if(!o.isMesh)return;
    o.geometry?.dispose();
    if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
    else o.material?.dispose();
   });
   face.geometry.dispose();face.material.dispose();
  }
 }
});
