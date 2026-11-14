import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildStudioContourNeck,extractStudioJawCutSegments}
 from '../src/studio-contour-neck-v58.js';
import {alignStudioHeadToSkinnedTorso,fitStudioNeckContinuity}
 from '../src/heroine-battle-costume-bridge.js';

function createTestHuman(scale=.11){
 const root=new THREE.Group(),head=new THREE.Group(),outfit=new THREE.Group();
 root.add(head,outfit);
 const source=new THREE.SphereGeometry(scale,52,36);
 source.scale(1,1.2,.91);
 const pigment=new Float32Array(source.getAttribute('position').count*3);
 for(let i=0;i<pigment.length;i+=3){
  pigment[i]=.92;pigment[i+1]=.84;pigment[i+2]=.79;
 }
 source.setAttribute('color',new THREE.Float32BufferAttribute(pigment,3));
 const face=new THREE.Mesh(source,
  new THREE.MeshStandardMaterial({color:0xe7c0b7,vertexColors:true}));
 face.position.y=1.13;head.add(face);
 const body=new THREE.SkinnedMesh(new THREE.BoxGeometry(.32,.50,.23),
  new THREE.MeshStandardMaterial({color:0xcaa18c}));
 body.name='Female_Ranger_Body';body.position.y=.98;outfit.add(body);
 root.updateMatrixWorld(true);
 return {root,head,outfit,source,face,body};
}

test('v58 neck is skin colored and its upper boundary follows actual cropped face segments',()=>{
 const {head,outfit,source,face,body}=createTestHuman();
 const positions=source.getAttribute('position').array.slice(),
  colors=source.getAttribute('color').array.slice();
 const aligned=alignStudioHeadToSkinnedTorso({
  faceRoot:head,faceMesh:face,wardrobeRoot:outfit});
 assert.equal(aligned.applied,true);
 const result=fitStudioNeckContinuity({faceRoot:head,faceMesh:face,wardrobeRoot:outfit});
 assert.equal(result.applied,true,JSON.stringify(result));
 assert.equal(result.contourNeckApplied,true,JSON.stringify(result));
 assert.ok(result.actualCutEdgeSegments>=12);
 assert.equal(result.originalBluePipeHidden,true);
 assert.equal(result.correctSkinNeckColor,true);
 assert.ok(result.contourNeckLength>0&&result.contourNeckLength<.11);
 const contour=face.getObjectByName('STUDIO_CONTOUR_SKIN_NECK_V58');
 const old=head.getObjectByName('STUDIO_REAL_SKIN_NECK_CONNECTOR_V54');
 assert.ok(contour?.isMesh&&!contour.visible, 'old v58 separate surface must be hidden');
 assert.equal(contour.parent,face,
  'physical face boundary should be inherited without a separate head transform');
 assert.equal(old.visible,false,'the blue shelf must never be displayed');
 assert.equal(result.unifiedSkinNeckApplied,true,JSON.stringify(result));
 assert.equal(face.geometry.userData.studioUnifiedNeck,true);
 assert.equal(contour.material.transparent,false);
 assert.equal(contour.material.vertexColors,true);
 assert.equal(contour.material.color.getHex(),face.material.color.getHex(),
  'neck inherits face base skin colour instead of any fabric colour');
 const seg=extractStudioJawCutSegments(face,result.originalIndexedVertices);
 assert.ok(seg.length>=12);
 const count=contour.geometry.getAttribute('position').count;
 assert.equal(count,48*7);
 assert.equal(contour.geometry.getIndex().count,(7-1)*48*6);
 assert.deepEqual(source.getAttribute('position').array,positions);
 assert.deepEqual(source.getAttribute('color').array,colors);
 const before=contour;
 const second=fitStudioNeckContinuity({faceRoot:head,faceMesh:face,wardrobeRoot:outfit});
 assert.equal(second.contourNeckApplied,true);
 assert.equal(second.unifiedSkinNeckApplied,true);
 assert.equal(face.children.filter(m=>m.name==='STUDIO_CONTOUR_SKIN_NECK_V58').length,1);
 assert.notEqual(face.getObjectByName('STUDIO_CONTOUR_SKIN_NECK_V58'),before);
 assert.deepEqual(source.getAttribute('position').array,positions,
  'repeated fitting cannot modify source face or nose geometry');
 face.getObjectByName('STUDIO_CONTOUR_SKIN_NECK_V58').geometry.dispose();
 face.getObjectByName('STUDIO_CONTOUR_SKIN_NECK_V58').material.dispose();
 face.geometry.dispose();source.dispose();face.material.dispose();
 body.geometry.dispose();body.material.dispose();
});

test('v58 rejects discontinuous or absent seam rather than inventing another visible cylinder',()=>{
 const root=new THREE.Group(),face=new THREE.Mesh(
  new THREE.BoxGeometry(.12,.15,.1),new THREE.MeshStandardMaterial());
 root.add(face);
 const r=buildStudioContourNeck({faceRoot:root,faceMesh:face,
  cut:{originalVertexCount:500},torsoTopY:1.0,facePigment:null});
 assert.equal(r.applied,false);
 assert.equal(r.reason,'real-cut-edge-unavailable');
 assert.equal(face.children.length,0);
 face.geometry.dispose();face.material.dispose();
});
