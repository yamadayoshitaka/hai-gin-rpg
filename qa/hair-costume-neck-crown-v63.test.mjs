import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {setCostumeHairScalpMask,releaseCostumeHairScalpMask}
 from '../src/face-costume-scalp-mask.js';
import {FACE_HAIR_RUNTIME_BUILD,createScalpAnchoredWig,
 createSadakoCrownFlow,v63WigScalpTone} from '../src/face-scalp-wig.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const head=()=>{
 const geo=new THREE.SphereGeometry(.5,32,24);
 geo.computeVertexNormals();geo.computeBoundingBox();
 return new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
};
function dispose(h,wig){
 wig?.dispose();h.geometry.dispose();h.material.dispose();
}
test('costume buzz mask uses original uncut follicle bounds and preserves neck welding',()=>{
 const face=head(),follicle=face.geometry.clone();
 const original=face.geometry,oldCount=original.getAttribute('position').count;
 const vertices=[[.27,.38,-.70],[.35,.40,-.72],[.31,.45,-.73]];
 for(const name of Object.keys(original.attributes)){
  const attr=original.getAttribute(name),values=Array.from(attr.array);
  for(const v of vertices){
   if(name==='position')values.push(...v);
   else if(name==='normal')values.push(0,1,0);
   else values.push(...Array(attr.itemSize).fill(0));
  }
  original.setAttribute(name,new THREE.BufferAttribute(
   new attr.array.constructor(values),attr.itemSize,attr.normalized));
 }
 const oldIndex=Array.from(original.getIndex().array);
 original.setIndex([...oldIndex,oldCount,oldCount+1,oldCount+2]);
 original.userData.studioOriginalFaceVertexCount=oldCount;
 const report=setCostumeHairScalpMask(face,'buzz-cut',
  {scalpReferenceGeometry:follicle});
 assert.equal(report.active,true);
 assert.equal(report.source,'uncut-follicle-donor');
 assert.equal(report.protectedNeckIndex,oldCount);
 const p=face.geometry.getAttribute('position');
 let neckTriangles=0;
 for(let i=0;i+2<p.count;i+=3){
  if(p.getZ(i)<-.69&&p.getZ(i+1)<-.69&&p.getZ(i+2)<-.69)
   neckTriangles++;
 }
 assert.equal(neckTriangles,1,
  'reconstructed neck must NEVER be clipped as if it were scalp');
 releaseCostumeHairScalpMask(face);
 assert.equal(face.geometry,original);
 assert.equal(face.userData.costumeScalpMaskActive,false);
 follicle.dispose();dispose(face);
});

test('mask is reversible on refit and does not accumulate duplicate cut geometry',()=>{
 const h=head(),donor=h.geometry;
 const first=setCostumeHairScalpMask(h,'buzz-cut',
  {scalpReferenceGeometry:donor});
 assert.equal(first.active,true);
 const n=h.geometry.getAttribute('position').count;
 releaseCostumeHairScalpMask(h);
 assert.strictEqual(h.geometry,donor);
 const second=setCostumeHairScalpMask(h,'buzz-cut',
  {scalpReferenceGeometry:donor});
 assert.equal(second.active,true);
 assert.equal(h.geometry.getAttribute('position').count,n);
 releaseCostumeHairScalpMask(h);
 dispose(h);
});

test('buzz stays sparse; face-only style does not gain a solid secondary cap',()=>{
 const h=head(),wig=createScalpAnchoredWig(h,{
  styleId:'buzz-cut',count:100,color:0x704530,staticGroom:true,
  normalLayeredSingleMesh:false});
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.equal(cap.material.type,'MeshPhysicalMaterial');
 assert.equal(cap.userData.v66RealCrownUnderlayTriangles,0);
 assert.equal(wig.getReport().closeCutFibreCount,30000);
 assert.equal(wig.getReport().buzzSparseApprovedLookRestored,true);
 dispose(h,wig);
});

test('Sadako fine crown hair pigment matches underlying donated scalp tone',()=>{
 const h=head(),wig=createScalpAnchoredWig(h,{
  styleId:'sadako-straight-long',count:120,color:0x704530,
  staticGroom:false,visualFiberMultiplier:1,normalLayeredSingleMesh:false});
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 const flow=wig.root.getObjectByName('SADAKO_CROWN_TANGENTIAL_FIBRE_FLOW_V50');
 assert.equal(flow.material.type,'MeshPhysicalMaterial');
 const position=flow.geometry.getAttribute('position');
 const colors=flow.geometry.getAttribute('color');
 const box=h.geometry.boundingBox;
 const dye=new THREE.Color(0x704530);
 assert.ok(position.count>40);
 for(let i=0;i<Math.min(position.count,200);i+=4){
  const rootX=(position.getX(i)+position.getX(i+1))*.5;
  const rootY=(position.getY(i)+position.getY(i+1))*.5;
  const rootZ=(position.getZ(i)+position.getZ(i+1))*.5;
  const tone=colors.getX(i)/dye.r;
  assert.ok(tone>.80&&tone<1.08,'crown fibres should not form dark bands');
  assert.ok(Math.abs(tone-v63WigScalpTone(rootX,rootY,rootZ,box))<.09);
 }
 assert.ok(cap.userData.donorScalpVertexCount>0);
 dispose(h,wig);
});

test('full body attaches real neck first and remasks after animated update',()=>{
 const bridge=read('src/heroine-battle-costume-bridge.js');
 const studio=read('face-body-studio.html');
 const mask=read('src/face-costume-scalp-mask.js');
 assert.match(bridge,/withOriginalNeckSkin/);
 assert.match(bridge,/onBeforeNeckRefit\?\.\(face\)/);
 assert.match(bridge,/onAfterNeckRefit\?\.\(face\)/);
 assert.match(studio,/onBeforeNeckRefit:\(fittedFace\)=>releaseCostumeHairScalpMask\(fittedFace\)/);
 assert.match(studio,/onAfterNeckRefit:\(fittedFace\)=>\{/);
 assert.match(studio,/scalpReferenceGeometry:uncutScalpSource\?\.geometry/);
 assert.match(mask,/studioOriginalFaceVertexCount/);
 assert.match(mask,/stitchedNeck\?\[true,true,true\]/);
 assert.match(FACE_HAIR_RUNTIME_BUILD,/costume-neck-buzz-crown-v63$/);
 for(const path of ['face-mesh-studio.html','face-body-studio.html'])
  assert.match(read(path),/20261121-costume-neck-buzz-crown-v63/);
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-costume-neck-crown-v63\.test\.mjs/);
});
