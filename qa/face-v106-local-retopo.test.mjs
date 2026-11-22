import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {v106FaceZone,refineV106CheekMouthTopology}
 from '../src/face-v106-local-retopo.js';

test('v106 concentrates density on front malar and lip-corner skin only',()=>{
 const cheek=v106FaceZone({xn:.50,yn:.53,zn:.96});
 const oral=v106FaceZone({xn:.24,yn:.52,zn:.96});
 assert.ok(cheek.cheek>.5,JSON.stringify(cheek));
 assert.ok(oral.oral>.5,JSON.stringify(oral));
 for(const zone of [
  {xn:.85,yn:.53,zn:.96},
  {xn:.30,yn:.87,zn:.96},
  {xn:.3,yn:.52,zn:.10}
 ])assert.deepEqual(v106FaceZone(zone),{cheek:0,oral:0});
});

test('v106 real 3D triangles are split conformingly while donor, mouth boundary, morph and cap are preserved',()=>{
 const donor=new THREE.SphereGeometry(.14,72,56);
 const geom=donor.clone(),beforeVertices=geom.getAttribute('position').count,
  beforeIndices=Array.from(geom.getIndex().array),
  beforeXYZ=geom.getAttribute('position').array.slice();
 const protectedRing=Array.from({length:40},(_,i)=>i+180);
 // Real seal has an existing donor triangle block followed by oral cap.
 geom.setIndex(beforeIndices.concat([180,181,182]));
 const originalFaceTriangles=beforeIndices.length/3;
 const colors=new Float32Array(beforeVertices*3).fill(.8);
 geom.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const morph=new Float32Array(beforeVertices*3).fill(.002);
 geom.morphAttributes.position=[new THREE.BufferAttribute(morph,3)];
 const face=new THREE.Mesh(geom,new THREE.MeshStandardMaterial());
 face.userData.v86OralSeal={
  sealed:true,lipRing:protectedRing,
  outerSelectedRing:protectedRing.slice(0,35),initialTriangleCount:originalFaceTriangles,
  addedTriangles:1
 };
 const result=refineV106CheekMouthTopology(face,{gender:'female'});
 assert.equal(result.applied,true,JSON.stringify(result));
 assert.ok(result.addedVertices>20,JSON.stringify(result));
 assert.ok(result.cheekRelaxedVertices>0);
 assert.ok(result.visibleTriangles>result.originalTriangles);
 assert.ok(result.originalVertices===beforeVertices);
 assert.equal(face.geometry,geom,'Visible skin is still the same indexed mesh');
 assert.equal(geom.morphAttributes.position[0].count,geom.getAttribute('position').count);
 assert.equal(geom.getAttribute('color').count,geom.getAttribute('position').count);
 assert.equal(geom.getAttribute('uv').count,geom.getAttribute('position').count);
 assert.deepEqual(Array.from(geom.getIndex().array.slice(-3)),[180,181,182],
  'Oral cap stays at the end of the skin index buffer');
 assert.equal(face.userData.v86OralSeal.initialTriangleCount,
  geom.getIndex().count/3-1,'Native oral rig sees the new original triangle count');
 const positions=geom.getAttribute('position');
 for(const id of protectedRing){
  assert.equal(positions.getX(id),beforeXYZ[id*3]);
  assert.equal(positions.getY(id),beforeXYZ[id*3+1]);
  assert.equal(positions.getZ(id),beforeXYZ[id*3+2]);
 }
 for(let i=0;i<positions.count;i++)
  for(let k=0;k<3;k++)
   assert.ok(Number.isFinite(positions.getComponent(i,k)),'No NaN skin vertices');
 for(const id of geom.getIndex().array)
  assert.ok(id>=0&&id<positions.count,'All indices address valid vertices');
 const beforeRingEdges=new Set(),afterRingEdges=new Set();
 const boundary=new Set(protectedRing);
 const add=(source,dst)=>{
  for(let t=0;t<source.length;t+=3){
   const [a,b,c]=source.slice(t,t+3);
   for(const [u,v] of [[a,b],[b,c],[c,a]])
    if(boundary.has(u)&&boundary.has(v))dst.add(Math.min(u,v)+'|'+Math.max(u,v));
  }
 };
 add(beforeIndices,beforeRingEdges);add(Array.from(geom.getIndex().array),afterRingEdges);
 for(const k of beforeRingEdges)
  assert.ok(afterRingEdges.has(k),'Original lip-ring edge must remain connected');
 assert.deepEqual(Array.from(donor.getAttribute('position').array),
  Array.from(beforeXYZ),'The immutable source donor is untouched');
 const repeat=refineV106CheekMouthTopology(face,{gender:'female'});
 assert.equal(repeat.applied,false);
 assert.equal(repeat.reason,'already-densified');
 const male=new THREE.Mesh(donor.clone(),new THREE.MeshStandardMaterial());
 assert.equal(refineV106CheekMouthTopology(male,{gender:'male'}).applied,false);
 male.geometry.dispose();male.material.dispose();
 face.geometry.dispose();face.material.dispose();donor.dispose();
});
