import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clipStudioFaceBustPreservingSurface,
 restoreStudioFaceSurfaceQuality,sampleStudioFacePigment}
 from '../src/studio-face-quality-v56.js';
import {fitStudioNeckContinuity} from '../src/heroine-battle-costume-bridge.js';

function indexedPortrait(){
 const geo=new THREE.BufferGeometry();
 // First face is untouched by the cut; the second crosses the cut plane.
 geo.setAttribute('position',new THREE.Float32BufferAttribute([
  -.13,1.45,0, .13,1.45,0, .00,1.53,0,
  -.13,1.25,.01
 ],3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute([
  0,0,1, 0,.02,.9998, 0,0,1, 0,0,1
 ],3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute([
  0,1, 1,1, .5,.9, 0,0
 ],2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute([
  .92,.83,.81, .95,.87,.82, .94,.84,.80, .93,.86,.82
 ],3));
 geo.setIndex([0,1,2,0,3,1]);
 return geo;
}
test('v56 cutting bust does not unshare untouched facial vertices or recalculate their normals',()=>{
 const geo=indexedPortrait();
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
  color:0xecb4a7,vertexColors:true}));
 const snapshots=Object.fromEntries(Object.keys(geo.attributes).map(name=>
  [name,geo.getAttribute(name).array.slice()]));
 const cut=clipStudioFaceBustPreservingSurface(face,1.35);
 assert.equal(cut.sourceNormalsPreserved,true);
 assert.equal(cut.sourceVertexPositionsPreserved,true);
 assert.equal(cut.originalVertexCount,4);
 assert.equal(cut.untouchedTriangles,1);
 assert.equal(cut.newCutVertices,2);
 assert.deepEqual(Array.from(cut.geometry.getIndex().array.slice(0,3)),[0,1,2]);
 for(const name of Object.keys(snapshots)){
  const origin=geo.getAttribute(name).array;
  const clipped=cut.geometry.getAttribute(name).array;
  assert.deepEqual(origin,snapshots[name],'source '+name+' must be immutable');
  assert.deepEqual(clipped.slice(0,origin.length),snapshots[name],
   'all uncut source '+name+' values must be reproduced byte-for-byte');
 }
 assert.equal(cut.geometry.userData.studioPreservedIndexedFace,true);
 assert.ok(cut.geometry.getIndex().count>3);
 cut.geometry.dispose();geo.dispose();face.material.dispose();
});

test('v56 skin shading correction is preview-only and does not change lip, nose, eye geometry',()=>{
 const geo=indexedPortrait();
 const face=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({
  color:0xe6b7ad,vertexColors:true,roughness:.74,
  clearcoat:.055,bumpScale:.0001}));
 const originalPositions=geo.getAttribute('position').array.slice();
 const originalPigment=geo.getAttribute('color').array.slice();
 const result=restoreStudioFaceSurfaceQuality(face);
 assert.equal(result.applied,true);
 assert.ok(face.material.roughness>=.81);
 assert.ok(face.material.clearcoat<=.028);
 assert.ok(face.material.bumpScale<=.000055);
 assert.equal(face.material.flatShading,false);
 assert.equal(restoreStudioFaceSurfaceQuality(face).reused,true);
 assert.deepEqual(geo.getAttribute('position').array,originalPositions);
 assert.deepEqual(geo.getAttribute('color').array,originalPigment);
 geo.dispose();face.material.dispose();
});

test('v56 neck colour follows cheek pigment instead of an opaque fixed beige card',()=>{
 const scene=new THREE.Group(),headRoot=new THREE.Group(),wardrobe=new THREE.Group();
 scene.add(headRoot,wardrobe);
 const source=new THREE.SphereGeometry(.1,40,30);
 source.scale(1,1.18,1);
 const face=new THREE.Mesh(source,new THREE.MeshPhysicalMaterial({
  color:0xb9a9b0,vertexColors:true,roughness:.74}));
 const pigment=new Float32Array(source.getAttribute('position').count*3);
 pigment.fill(.90);
 source.setAttribute('color',new THREE.Float32BufferAttribute(pigment,3));
 face.position.y=1.13;headRoot.add(face);
 const body=new THREE.SkinnedMesh(new THREE.BoxGeometry(.30,.46,.23),
  new THREE.MeshStandardMaterial());
 body.name='Female_Ranger_Body';body.position.y=.98;wardrobe.add(body);
 scene.updateMatrixWorld(true);
 const skin=sampleStudioFacePigment(face);
 assert.ok(skin.samples>0);
 assert.ok(Math.abs(skin.multiplier.r-.9)<.001);
 const fitted=fitStudioNeckContinuity({faceRoot:headRoot,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(fitted.applied,true,JSON.stringify(fitted));
 assert.equal(fitted.matchedFaceMaterial,true);
 assert.equal(fitted.transparentNeckEdge,true);
 assert.equal(fitted.originalFaceNormalsPreserved,true);
 assert.equal(fitted.originalFaceColoursPreserved,true);
 assert.ok(fitted.untouchedFaceTriangles>100);
 assert.ok(fitted.newCutVertices>0);
 const connector=headRoot.getObjectByName('STUDIO_REAL_SKIN_NECK_CONNECTOR_V54');
 assert.ok(connector?.material.transparent);
 assert.equal(connector.material.depthWrite,false);
 assert.ok(connector.material.color.equals(face.material.color));
 const colors=connector.geometry.getAttribute('color');
 assert.equal(colors.itemSize,4);
 assert.ok(colors.getW(0)<.15,'bottom edge must blend into the outfit collar');
 assert.ok(colors.getW(colors.count-1)<.15,'top edge must blend into the jaw');
 assert.ok(colors.getW(Math.floor(colors.count/2))>.95);
 const allPositions=source.getAttribute('position').array.slice();
 const clipped=face.geometry;
 const second=fitStudioNeckContinuity({faceRoot:headRoot,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(second.applied,true);
 assert.equal(face.geometry,clipped,'stationary head can reuse exact clipped face geometry');
 assert.deepEqual(source.getAttribute('position').array,allPositions,
  'no face morph or mesh position may be modified by a neck edit');
 connector.geometry.dispose();connector.material.dispose();
 face.geometry.dispose();face.material.dispose();source.dispose();
 body.geometry.dispose();body.material.dispose();
});
