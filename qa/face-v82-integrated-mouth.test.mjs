import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAnatomicalFaceParts,applyFaceColorMode}
 from '../src/face-feature-meshes.js';
import {createFaceExpressionAnimator} from '../src/face-expression-animation-v48.js';
import {integrateMouthIntoFace} from '../src/face-integrated-mouth-v82.js';

test('V82 the visible mouth is a hole stitched into ONE head mesh, not an overlay',()=>{
 const face=new THREE.Mesh(
  new THREE.SphereGeometry(.20,96,72),
  new THREE.MeshStandardMaterial()
 );
 face.name='FEMALE_INDEPENDENT_CLAY_FACE';
 // Experimental surgery is quarantined from production. This test
 // deliberately exercises the old topology algorithm for comparison.
 face.userData.enableExperimentalOralSurgery=true;
 const originalFaceCount=face.geometry.getAttribute('position').count;
 const {root}=createAnatomicalFaceParts(face,{gender:'female',
  controls:{ageBand:'sixties'}});
 face.add(root);
 const topo=face.userData.v82IntegratedMouth;
 assert.ok(topo?.integrated,
  'Density-adequate donor head must receive a real connected mouth aperture');
 assert.ok(topo.removedTriangles>3);
 assert.ok(topo.boundaryEdges>5);
 assert.ok(topo.createdVertices>=topo.boundaryEdges);
 assert.ok(face.geometry.getAttribute('position').count>originalFaceCount);
 assert.equal(face.userData.v82RealMouthAperture,true);
 assert.equal(face.userData.v82LipAndFaceShareGeometry,true);
 assert.equal(face.userData.mouthPigmentSource,
  'integrated-head-mouth-vertices-v82');
 assert.ok(topo.lipTintWeights.size>=topo.boundaryEdges);
 assert.ok(face.geometry.getAttribute('color').count===
  face.geometry.getAttribute('position').count);
 for(const side of ['UPPER','LOWER']){
  const strip=root.getObjectByName(side+'_3D_VERMILION_LIP');
  assert.ok(strip,'Compatibility mesh may remain for old editors');
  assert.equal(strip.visible,false,
   'Legacy lip strip MUST NOT be rendered on top of the head');
  assert.equal(strip.userData.v82HiddenLegacyLipStrip,true);
 }
 const palette=face.geometry.getAttribute('color').array.slice();
 applyFaceColorMode(face,'color',{makeupType:3});
 assert.equal(face.geometry.getAttribute('color').count,
  face.geometry.getAttribute('position').count);
 assert.notDeepEqual(face.geometry.getAttribute('color').array,palette,
  'Lip pigment on the new head vertices must respond to makeup');
 const animator=createFaceExpressionAnimator({face,parts:root},{autoBlink:false});
 const cavity=face.getObjectByName('V48_3D_INNER_MOUTH');
 assert.ok(cavity);
 assert.equal(cavity.material.visible,false,
  'Retired black foreground mouth must never render');
 const indices=face.geometry.getIndex().count;
 const attr=face.geometry.getAttribute('position');
 const before=attr.array.slice();
 const upper=topo.pairs.find(v=>v.sign>0&&Math.abs(v.t)<.55);
 const lower=topo.pairs.find(v=>v.sign<0&&Math.abs(v.t)<.55);
 assert.ok(upper&&lower);
 animator.setExpression('laugh');
 const state=animator.getState();
 assert.equal(state.v82SingleHeadMouthTopology,true);
 assert.equal(state.v82NoForegroundMouthCover,true);
 assert.equal(state.v82LipPigmentDeformsWithFace,true);
 assert.equal(face.geometry.getIndex().count,indices,
  'No re-meshing/replacing faces when selecting a new expression');
 assert.ok(attr.getY(upper.inner)>before[upper.inner*3+1]);
 assert.ok(attr.getY(lower.inner)<before[lower.inner*3+1]);
 const oral=face.getObjectByName('V80_INTRAORAL_ANATOMY');
 assert.ok(oral.visible);
 const pharynx=oral.getObjectByName('V82_RECESSED_ORAL_VESTIBULE');
 assert.ok(pharynx&&pharynx.userData.v82BehindHeadAperture);
 const tooth=oral.getObjectByName('V80_UPPER_TOOTH_06');
 assert.ok(tooth.material.depthTest&&tooth.material.depthWrite,
  'Dental anatomy MUST be occluded by the true facial surface');
 animator.setExpression('neutral');
 assert.ok(Math.abs(attr.getY(upper.inner)-before[upper.inner*3+1])<1e-5);
 assert.ok(Math.abs(attr.getY(lower.inner)-before[lower.inner*3+1])<1e-5);
 animator.dispose();
 root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material?.dispose?.();}});
 face.geometry.dispose();face.material.dispose();
});

test('V82 topology gracefully preserves low-density donors',()=>{
 const face=new THREE.Mesh(new THREE.TetrahedronGeometry(.15),
  new THREE.MeshStandardMaterial());
  // This test intentionally uses an invalidly sparse face to ensure
 // the geometry is preserved rather than leaving an unexplained hole.
 const before=face.geometry.getAttribute('position').array.slice();
 const report=integrateMouthIntoFace(face,{
  centerX:0,centerY:0,halfWidth:.025,headHeight:.3,surfaceZ:.1
 });
 assert.equal(report.integrated,false);
 assert.deepEqual(face.geometry.getAttribute('position').array,before);
 face.geometry.dispose();face.material.dispose();
});
