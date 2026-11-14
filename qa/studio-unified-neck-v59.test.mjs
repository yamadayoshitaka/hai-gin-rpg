import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {weldStudioNeckIntoFace,measureStudioGarmentCollar}
 from '../src/studio-unified-neck-v59.js';
import {alignStudioHeadToSkinnedTorso,fitStudioNeckContinuity}
 from '../src/heroine-battle-costume-bridge.js';

const create=()=>{
 const root=new THREE.Group(),head=new THREE.Group(),wardrobe=new THREE.Group();
 root.add(head,wardrobe);
 const source=new THREE.SphereGeometry(.11,52,36);
 source.scale(1,1.2,.90);
 const n=source.getAttribute('position').count,pigments=new Float32Array(n*3);
 for(let i=0;i<n*3;i+=3){pigments[i]=.92;pigments[i+1]=.84;pigments[i+2]=.79}
 source.setAttribute('color',new THREE.Float32BufferAttribute(pigments,3));
 const face=new THREE.Mesh(source,new THREE.MeshPhysicalMaterial({
  color:0xeac0b5,vertexColors:true,roughness:.78}));
 face.position.y=1.13;head.add(face);
 const torso=new THREE.SkinnedMesh(new THREE.BoxGeometry(.32,.50,.23),
  new THREE.MeshStandardMaterial());
 torso.name='Female_Ranger_Body';torso.position.y=.98;wardrobe.add(torso);
 const neckline=new THREE.Mesh(new THREE.BoxGeometry(.12,.012,.11),
  new THREE.MeshStandardMaterial({color:0x526a7e}));
 neckline.name='sewn-neckline';neckline.position.y=1.17;wardrobe.add(neckline);
 root.updateWorldMatrix(true);
 return {root,head,wardrobe,source,face,torso,neckline};
};

test('v59 unified connector shares face draw mesh and physically reaches the actual garment neckline',()=>{
 const {root,head,wardrobe,source,face,torso,neckline}=create();
 const sourcePosition=source.getAttribute('position').array.slice();
 const sourceColors=source.getAttribute('color').array.slice();
 const pose=alignStudioHeadToSkinnedTorso({faceRoot:head,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(pose.applied,true);
 const result=fitStudioNeckContinuity({faceRoot:head,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(result.applied,true,JSON.stringify(result));
 assert.equal(result.unifiedSkinNeckApplied,true,JSON.stringify(result));
 assert.equal(result.reusedFaceMaterial,true);
 assert.equal(result.originalFaceGeometryImmutable,true);
 assert.ok(result.unifiedSkinNeckEdges>=12);
 assert.ok(result.unifiedSkinNeckTriangles>100);
 assert.equal(result.actualCollarSource,'sewn-neckline');
 assert.ok(result.unifiedNeckBottomHeight<result.actualCollarHeight,
  'the neck must reach *under* the actual garment collar');
 assert.ok(result.unifiedNeckBottomHeight<result.actualTorsoTopY-.045,
  'the connector must not stop at the top of an exposed donor neck');
 assert.equal(result.separateNeckGeometryHidden,true,
  'v54/v58 detached tubes must not render on top of skin');
 assert.equal(face.geometry.userData.studioUnifiedNeck,true);
 assert.equal(face.children.filter(x=>x.isMesh&&x.visible).length,0,
  'skin neck must be part of face geometry, not a separate rendered cylinder');
 assert.equal(face.geometry.getAttribute('position').count,
  face.geometry.userData.studioOriginalFaceVertexCount+
  result.unifiedSkinNeckEdges*2*(7-1),
  'non-indexed original cut corners require their own lower connected strips');
 const initialVerts=face.geometry.getAttribute('position').count;
 const again=fitStudioNeckContinuity({faceRoot:head,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(again.unifiedSkinNeckApplied,true);
 assert.equal(face.geometry.getAttribute('position').count,initialVerts,
  'reapplying body pose cannot add a second cumulative neck');
 assert.deepEqual(source.getAttribute('position').array,sourcePosition);
 assert.deepEqual(source.getAttribute('color').array,sourceColors);
 root.clear();face.geometry.dispose();source.dispose();face.material.dispose();
 torso.geometry.dispose();torso.material.dispose();
 neckline.geometry.dispose();neckline.material.dispose();
});

test('v59 face/neck seam retains original face positions, normals, UVs and makeup on the unified mesh',()=>{
 const {head,wardrobe,face,source,torso,neckline}=create();
 alignStudioHeadToSkinnedTorso({faceRoot:head,faceMesh:face,wardrobeRoot:wardrobe});
 const report=fitStudioNeckContinuity({faceRoot:head,faceMesh:face,wardrobeRoot:wardrobe});
 assert.equal(report.unifiedSkinNeckApplied,true,JSON.stringify(report));
 const geometry=face.geometry,originalN=geometry.userData.studioOriginalFaceVertexCount;
 assert.ok(originalN>100);
 for(const name of ['position','normal','uv','color']){
  assert.ok(geometry.getAttribute(name)?.count>=originalN,
   'all face attributes must have same appended neck vertex count: '+name);
 }
 const attached=geometry.getAttribute('position');
 assert.ok(attached.count>originalN);
 const original=source.getAttribute('position').array;
 assert.deepEqual(source.getAttribute('position').array,original);
 assert.ok(geometry.getIndex().count>10000);
 face.geometry.dispose();source.dispose();face.material.dispose();
 torso.geometry.dispose();torso.material.dispose();
 neckline.geometry.dispose();neckline.material.dispose();
});

test('collar position comes from rendered neckline rather than torso bounding box',()=>{
 const {wardrobe,torso,neckline,face,source}=create();
 const collar=measureStudioGarmentCollar(wardrobe,{torsoTopY:1.23});
 assert.equal(collar.mesh,'sewn-neckline');
 assert.ok(collar.y>1.17&&collar.y<1.19);
 assert.ok(collar.y<1.23-.04);
 const fallback=measureStudioGarmentCollar(null,{torsoTopY:1.23});
 assert.equal(fallback.mesh,'torso-based-fallback');
 assert.ok(fallback.y<1.2);
 face.geometry.dispose();source.dispose();face.material.dispose();
 torso.geometry.dispose();torso.material.dispose();
 neckline.geometry.dispose();neckline.material.dispose();
});
