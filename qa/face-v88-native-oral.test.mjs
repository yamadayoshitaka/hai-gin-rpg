import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initializeNativeOralRig,captureNativeOralSkinPose,
 updateNativeOralPose,getNativeOralRigReport} from '../src/face-native-oral-rig-v88.js';
import {v88AnatomicalLipDelta} from '../src/independent-face-masters.js';
import {normalizeFemaleFaceControls} from '../src/face-v7-controls.js';

function donorLikeFace(){
 const ringCount=40,vertices=[],indices=[];
 // Contiguous front-facing oral contour, rear head corners, and nose.
 for(let i=0;i<ringCount;i++){
  const a=i*2*Math.PI/ringCount;
  vertices.push(.16*Math.cos(a),.509+.015*Math.sin(a),.65);
 }
 for(const [x,y,z] of [[-1,0,.1],[1,0,.1],[1,1,.1],[-1,1,.1],[0,.56,.85]])
  vertices.push(x,y,z);
 const out=ringCount,corner=vertices.length/3-1;
 for(let i=0;i<ringCount;i++){
  const next=(i+1)%ringCount;
  indices.push(i,next,out+(i<ringCount/2?1:0));
 }
 // Neutral rest-state cap, omitted on jaw opening.
 const originalTriangleCount=indices.length/3;
 for(let i=1;i<ringCount-1;i++)indices.push(0,i,i+1);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex(indices);
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 face.userData.actualMouthCreaseY=.509;
 face.userData.v86OralSeal={
  sealed:true,lipRing:Array.from({length:ringCount},(_,i)=>i),
  outerSelectedRing:Array.from({length:ringCount},(_,i)=>i),
  initialTriangleCount:originalTriangleCount,
  addedTriangles:ringCount-2
 };
 return face;
}

test('V88 native mouth opens real indexed donor slit, restores caps, skin and normals',()=>{
 const face=donorLikeFace(),geometry=face.geometry;
 const rest=geometry.getAttribute('position').array.slice();
 const closed=geometry.getIndex().count;
 const originalNose=rest.slice(-3);
 const rig=initializeNativeOralRig(face);
 assert.equal(rig.ready,true,JSON.stringify(rig));
 assert.equal(getNativeOralRigReport(face).opened,false);
 assert.ok(rig.boundaryVertices>=30);
 assert.equal(geometry.getIndex().count,closed);
 assert.ok(captureNativeOralSkinPose(face));
 assert.ok(updateNativeOralPose(face,{open:.90,smile:.55,cheek:.45}));
 assert.equal(getNativeOralRigReport(face).opened,true);
 assert.ok(geometry.getIndex().count<closed);
 const wall=face.getObjectByName('V88_NATIVE_RECESSED_ORAL_VESTIBULE');
 assert.equal(wall.visible,true);
 const wallPositions=wall.geometry.getAttribute('position');
 assert.ok(wallPositions.array.every(Number.isFinite));
 assert.ok(wall.material.depthTest&&wall.material.depthWrite);
 assert.deepEqual(Array.from(geometry.getAttribute('position').array.slice(-3)),
  Array.from(originalNose),'Nose must not move with oral aperture');
 updateNativeOralPose(face,{open:0});
 assert.equal(geometry.getIndex().count,closed);
 assert.equal(wall.visible,false);
 assert.deepEqual(Array.from(geometry.getAttribute('position').array),Array.from(rest),
  'Rest face skin and lipstick-bearing vertices are exactly restored');
 wall.geometry.dispose();wall.material.dispose();
 geometry.dispose();face.material.dispose();
});

test('V88 half-width lip sculpt stays strictly in local native oral zone',()=>{
 const central=v88AnatomicalLipDelta({
  xn:.08,yn:.509,zn:.95,faceWidth:1,faceDepth:.5,mouthWidth:.425});
 assert.equal(central.dx,0,'V87 applies all X-mouth scaling exactly once');
 assert.ok(central.dz>0);
 assert.deepEqual(v88AnatomicalLipDelta({
  xn:.61,yn:.509,zn:.95,faceWidth:1,faceDepth:.5,mouthWidth:.425
 }),{dx:0,dz:0});
 assert.deepEqual(v88AnatomicalLipDelta({
  xn:.08,yn:.7,zn:.95,faceWidth:1,faceDepth:.5,mouthWidth:.425
 }),{dx:0,dz:0});
 assert.equal(normalizeFemaleFaceControls().mouthWidth,.65);
 assert.deepEqual(normalizeFemaleFaceControls({mouthWidth:10}).mouthWidth,1.25);
});
