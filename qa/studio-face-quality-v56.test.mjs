import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clipStudioFaceBustPreservingSurface,
 restoreStudioFaceSurfaceQuality,sampleStudioFacePigment,
 smoothStudioFaceNormals,studioAnatomicalSeamY,taperStudioLowerBustBelowChin}
 from '../src/studio-face-quality-v56.js';
import {fitStudioNeckContinuity,alignStudioHeadToSkinnedTorso} from '../src/heroine-battle-costume-bridge.js';

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
 const alignment=alignStudioHeadToSkinnedTorso({faceRoot:headRoot,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(alignment.applied,true);
 const skin=sampleStudioFacePigment(face);
 assert.ok(skin.samples>0);
 assert.ok(Math.abs(skin.multiplier.r-.9)<.001);
 const fitted=fitStudioNeckContinuity({faceRoot:headRoot,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(fitted.applied,true,JSON.stringify(fitted));
 assert.equal(fitted.matchedFaceMaterial,true);
 assert.equal(fitted.anatomicalJawCut,true,
  'face should end in a shallow anatomical curve, not a straight ruler edge');
 assert.equal(fitted.cutPlaneType,'jaw-and-nape-curve');
 assert.equal(fitted.narrowUnderJawConnector,true);
 assert.equal(fitted.lowerBustTapered,true);
 assert.ok(fitted.lowerBustTaperedVertices>0);
 assert.equal(fitted.sourceFaceUnchangedByBustTaper,true);
 assert.equal(fitted.transparentNeckEdge,true);
 assert.equal(fitted.originalFaceNormalsPreserved,true);
 assert.equal(fitted.smoothedFacialNormals,true);
 assert.ok(fitted.normalWeldGroups>50);
 assert.equal(fitted.originalFaceColoursPreserved,true);
 assert.ok(fitted.untouchedFaceTriangles>100);
 assert.ok(fitted.newCutVertices>0);
 const connector=headRoot.getObjectByName('STUDIO_REAL_SKIN_NECK_CONNECTOR_V54');
 assert.ok(connector?.material.transparent);
 assert.equal(connector.material.depthWrite,false);
 assert.equal(fitted.tunicInnerCollar,true);
 assert.equal(connector.material.color.getHex(),0xffffff);
 const colors=connector.geometry.getAttribute('color');
 assert.equal(colors.itemSize,4);
 assert.ok(colors.getW(0)<.15,'bottom edge must blend into the outfit collar');
 assert.ok(colors.getW(colors.count-1)<.15,'top edge must blend into the jaw');
 const collar=new THREE.Color(0x526a7e);
 assert.ok(Math.abs(colors.getX(0)-collar.r)<.002,
  'lower collar should match the dark slate costume rather than white skin');
 assert.ok(Math.abs(colors.getX(colors.count-1)-
   face.material.color.r*.9*.96)<.015,
  'skin tone should only appear under the jaw, never as a wide bright plate');
 assert.ok(colors.getW(Math.floor(colors.count/2))>.95);
 const allPositions=source.getAttribute('position').array.slice();
 const clipped=face.geometry;
 const second=fitStudioNeckContinuity({faceRoot:headRoot,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(second.applied,true);
 assert.equal(face.geometry.getAttribute('position').count,
  clipped.getAttribute('position').count,
  're-fitting retains a stable one-piece neck vertex count');
 assert.equal(second.unifiedSkinNeckApplied,true);
 assert.deepEqual(source.getAttribute('position').array,allPositions,
  'no face morph or mesh position may be modified by a neck edit');
 connector.geometry.dispose();connector.material.dispose();
 face.geometry.dispose();face.material.dispose();source.dispose();
 body.geometry.dispose();body.material.dispose();
});

test('v56 neighboring unshared triangle corners share smoother normals without moving sculpted vertices',()=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  0,0,0, 1,0,0, 0,1,0,
  0,0,0, 0,1,0, 0,0,1
 ],3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute([
  0,0,1, 0,0,1, 0,0,1,
  1,0,0, 1,0,0, 1,0,0
 ],3));
 const positions=geometry.getAttribute('position').array.slice();
 const originalNormals=geometry.getAttribute('normal').array.slice();
 const report=smoothStudioFaceNormals(geometry);
 assert.equal(report.applied,true);
 assert.ok(report.weldedGroups>=2);
 assert.ok(report.alteredNormalVertices>=4);
 assert.equal(report.topologyUnmodified,true);
 assert.deepEqual(geometry.getAttribute('position').array,positions);
 const normal=geometry.getAttribute('normal');
 const a=new THREE.Vector3(normal.getX(0),normal.getY(0),normal.getZ(0));
 const b=new THREE.Vector3(normal.getX(3),normal.getY(3),normal.getZ(3));
 assert.ok(a.dot(b)>.95,'shared vertices should no longer have a visible hard lighting seam');
 assert.notDeepEqual(normal.array,originalNormals);
 geometry.dispose();
});

test('v57 curved under-jaw clip is not a flat plane and leaves source face unchanged',()=>{
 const source=new THREE.SphereGeometry(.11,48,28);
 const face=new THREE.Mesh(source,new THREE.MeshStandardMaterial({color:0xffc8b5}));
 const before=source.getAttribute('position').array.slice();
 const base=clipStudioFaceBustPreservingSurface(face,-.045);
 const curved=clipStudioFaceBustPreservingSurface(face,-.045,{anatomicalCurve:true});
 assert.equal(base.cutPlaneType,'horizontal');
 assert.equal(curved.cutPlaneType,'jaw-and-nape-curve');
 assert.equal(curved.anatomicalCurve,true);
 assert.ok(curved.newCutVertices>10);
 const originalCount=curved.originalVertexCount;
 const vertices=curved.geometry.getAttribute('position');
 const newYs=Array.from({length:curved.newCutVertices},
  (_,i)=>vertices.getY(originalCount+i));
 const spread=Math.max(...newYs)-Math.min(...newYs);
 assert.ok(spread>.003,'the cut edge must curve upward at the cheeks and nape');
 assert.deepEqual(source.getAttribute('position').array,before,
  'lower-face clipping must not change forehead, eyes, nose or mouth');
 const p={centerX:0,centerZ:0,halfWidth:.1,halfDepth:.1};
 const middle=studioAnatomicalSeamY(1,0,.04,p);
 const side=studioAnatomicalSeamY(1,.10,.04,p);
 const rear=studioAnatomicalSeamY(1,0,-.10,p);
 assert.ok(side>middle+.006);
 assert.ok(rear>middle+.002);
 base.geometry.dispose();curved.geometry.dispose();
 source.dispose();face.material.dispose();
});

test('v57 connector rises gently at the sides, is narrower than the jaw, and has a soft top edge',()=>{
 const scene=new THREE.Group(),head=new THREE.Group(),wardrobe=new THREE.Group();
 scene.add(head,wardrobe);
 const source=new THREE.SphereGeometry(.11,48,28);
 const face=new THREE.Mesh(source,new THREE.MeshStandardMaterial({color:0xe8bdaf}));
 face.position.y=1.14;head.add(face);
 const torso=new THREE.SkinnedMesh(new THREE.BoxGeometry(.31,.46,.22),
  new THREE.MeshStandardMaterial());
 torso.name='Female_Ranger_Body';torso.position.y=.99;wardrobe.add(torso);
 scene.updateMatrixWorld(true);
 const alignment=alignStudioHeadToSkinnedTorso({
  faceRoot:head,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(alignment.applied,true);
 const fit=fitStudioNeckContinuity({faceRoot:head,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(fit.applied,true,JSON.stringify(fit));
 assert.equal(fit.anatomicalJawCut,true);
 assert.equal(fit.narrowUnderJawConnector,true);
 assert.ok(fit.neckHeight<.052);
 const bridge=head.getObjectByName('STUDIO_REAL_SKIN_NECK_CONNECTOR_V54');
 assert.ok(bridge);
 const ring=bridge.geometry.getAttribute('position');
 const row=fit.segmentCount+1,start=(ring.count-row);
 const ys=Array.from({length:row},(_,i)=>ring.getY(start+i));
 assert.ok(Math.max(...ys)-Math.min(...ys)>.002,
  'upper contour must vary with cheek geometry, not form a flat horizontal shelf');
 assert.equal(bridge.material.transparent,true);
 assert.deepEqual(source.getAttribute('position').count>0,true);
 bridge.geometry.dispose();bridge.material.dispose();
 face.geometry.dispose();source.dispose();face.material.dispose();
 torso.geometry.dispose();torso.material.dispose();
});

test('v57 lower bust taper narrows cropped pedestal while upper facial coordinates remain bit-identical',()=>{
 const source=new THREE.SphereGeometry(.12,40,26);
 const working=source.clone();
 source.computeBoundingBox();
 const face=new THREE.Mesh(working,new THREE.MeshStandardMaterial());
 const originalSource=source.getAttribute('position').array.slice();
 const originalWorking=working.getAttribute('position').array.slice();
 const bounds=source.boundingBox.clone();
 const report=taperStudioLowerBustBelowChin(face,{sourceWorldBounds:bounds});
 assert.equal(report.applied,true);
 assert.ok(report.affectedVertices>20);
 assert.ok(report.lowerWidthAfter<report.lowerWidthBefore,
  'shoulder/bust flange must become narrower toward the neck');
 assert.equal(report.upperFaceVerticesMoved,0);
 const a=working.getAttribute('position').array;
 const b=originalWorking;
 const cutoff=bounds.min.y+bounds.getSize(new THREE.Vector3()).y*.27;
 let upper=0;
 for(let i=0;i<b.length/3;i++){
  if(b[i*3+1]>=cutoff-1e-7){
   upper++;
   assert.deepEqual(Array.from(a.slice(i*3,i*3+3)),
    Array.from(b.slice(i*3,i*3+3)),
    'upper face, nose, cheeks and eyes must never move');
  }
 }
 assert.ok(upper>200);
 assert.deepEqual(source.getAttribute('position').array,originalSource,
  'original imported GLB remains unchanged');
 working.dispose();source.dispose();face.material.dispose();
});
