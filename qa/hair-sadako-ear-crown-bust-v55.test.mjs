import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {
 FACE_HAIR_RUNTIME_BUILD,createScalpFirstLongGuide,
 createRearBustDepthSampler,createScalpAnchoredWig
} from '../src/face-scalp-wig.js';

const headBox=new THREE.Box3(new THREE.Vector3(-1,-1,-1),
 new THREE.Vector3(1,1,1));

test('v55 temple hair covers both ear sides as the locks descend',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v62$/);
 for(const side of [-1,1]){
  const root=new THREE.Vector3(side*.40,.87,-.075);
  const normal=new THREE.Vector3(side*.45,.80,.12).normalize();
  const nearHead=[];
  const path=createScalpFirstLongGuide({
   root,normal,box:headBox,zone:side<0?'templeLeft':'templeRight',
   length:3.1,trimY:-4,targetX:root.x,targetZ:root.z,
   segments:18,whorl:new THREE.Vector3(0,.94,-.1),
   projectOutside:(p,near,front,followScalp)=>nearHead.push({followScalp})
  });
  const earPoints=path.filter(p=>p.y>headBox.min.y+2*.53&&
    p.y<headBox.min.y+2*.77);
  assert.ok(earPoints.length>0,'Must pass through the actual ear-height band');
  assert.ok(earPoints.some(p=>side*p.x>.34),
   'Hair must stay outside the ear on the '+(side<0?'left':'right')+' side');
  assert.ok(earPoints.every(p=>side*p.x<.60),
   'Hair must cover the ear rather than fly out as a wide side fan');
  assert.ok(earPoints.some(p=>p.z>root.z+.07),
   'Temple locks must pass in front of the ear, not behind it');
  assert.ok(nearHead.some(sample=>sample.followScalp),
   'First stations should request scalp-following, not radial free flight');
 }
});

test('real source-bust rear sampler returns the exterior rear depth',()=>{
 const geometry=new THREE.SphereGeometry(.48,30,24);
 geometry.translate(0,-.25,0);
 geometry.computeBoundingBox();
 const sampler=createRearBustDepthSampler(geometry,geometry.boundingBox);
 assert.equal(sampler.source,'real-bust-rear-depth-v55');
 assert.ok(sampler.vertexSamples>50);
 const z=sampler.query(0,-.25);
 assert.ok(Number.isFinite(z));
 assert.ok(z<-.34,'Expected rear-most donor surface, not the frontal face');
 assert.equal(sampler.query(0,geometry.boundingBox.max.y+1),null);
 geometry.dispose();
});

test('v55 generated Sadako hair preserves crown and cover-ear roots, protects buzz',()=>{
 const geo=new THREE.SphereGeometry(.5,28,20);
 geo.computeVertexNormals();
 const head=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 const long=createScalpAnchoredWig(head,{
  styleId:'sadako-straight-long',color:0x76523d,count:160,
  visualFiberMultiplier:1,volumeProfile:'natural',
  staticGroom:true,normalLayeredSingleMesh:false
 });
 const r=long.getReport();
 assert.ok(r.sadakoEarCurtainLocks>15,'Real temple follicles must exist around ear');
 assert.equal(r.sadakoCrownScalpFollow,true);
 assert.equal(r.sadakoRearBustSampler,'real-bust-rear-depth-v55');
 assert.ok(r.sadakoRearBustVertexSamples>40);
 assert.ok(Number.isFinite(r.sadakoRearBustGuideContacts));
 assert.ok(Number.isFinite(r.sadakoRearBustRibbonContacts));
 assert.equal(r.sadakoSidePanelCount,0);
 assert.ok(r.sadakoAreaZoneTriangles.crown>20);
 const strands=long.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 const attr=strands.geometry.getAttribute('position');
 for(let i=0;i<Math.min(attr.count,600);i++)
  assert.ok([attr.getX(i),attr.getY(i),attr.getZ(i)].every(Number.isFinite));
 long.dispose();
 const buzz=createScalpAnchoredWig(head,{
  styleId:'buzz-cut',color:0x76523d,count:80,
  visualFiberMultiplier:1,volumeProfile:'natural',
  staticGroom:true,normalLayeredSingleMesh:false
 });
 assert.equal(buzz.getReport().sadakoEarCurtainLocks,0);
 assert.equal(buzz.getReport().sadakoCrownScalpFollow,false);
 assert.equal(buzz.getReport().closeCutPaletteMatched,true);
 buzz.dispose();geo.dispose();head.material.dispose();
});

test('both face and full-body editors load v55 collision geometry',()=>{
 const face=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const body=readFileSync(new URL('../face-body-studio.html',import.meta.url),'utf8');
 const scalp=readFileSync(new URL('../src/face-scalp-wig.js',import.meta.url),'utf8');
 assert.match(face,/20261121-costume-mask-buzz-restored-v62/);
 assert.match(body,/20261121-costume-mask-buzz-restored-v62/);
 assert.match(scalp,/projectSadakoRearBust\(ribbonCollisionPoint,strand.zone,strand.rearFacing\)/);
 assert.match(scalp,/projectSadakoRearBust\(p,zone,rearFacing\)/);
 assert.match(face,/耳被覆毛束/);
});
