import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FACE_HAIR_RUNTIME_BUILD,buzzHairlineFractionAtPoint,
 createScalpAnchoredWig,createCloseCutScalpFibres,
 createSadakoCrownFlow} from '../src/face-scalp-wig.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function head(){
 const geometry=new THREE.SphereGeometry(.5,32,24);
 geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 geometry.computeBoundingBox();
 return mesh;
}
function make(style){
 const mesh=head();
 const wig=createScalpAnchoredWig(mesh,{
  count:144,styleId:style,gender:'female',color:0x81583b,
  normalLayeredSingleMesh:false,staticGroom:true,visualFiberMultiplier:1
 });
 return {mesh,wig,cap:wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP')};
}
function dispose(f){
 f.wig.dispose();f.mesh.geometry.dispose();f.mesh.material.dispose();
}
test('v61 donor scalp contour is symmetric for left and right temple views',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),
  new THREE.Vector3(.5,.5,.5));
 const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 for(const x of [.20,.27,.33,.40,.46]){
  for(const z of [-.3,-.12,0,.12,.3]){
   const a=buzzHairlineFractionAtPoint({x,y:.1,z},box,size,center);
   const b=buzzHairlineFractionAtPoint({x:-x,y:.1,z},box,size,center);
   assert.ok(Math.abs(a-b)<1e-10,`bilateral mismatch at ${x},${z}`);
  }
 }
 assert.ok(buzzHairlineFractionAtPoint({x:.35,y:0,z:-.1},box,size,center)>.64,
  'approved sparse buzz contour must not be artificially lowered');
});

test('only Sadako keeps the long-hair temple underlay; buzz remains sparse',()=>{
 const buzz=make('buzz-cut');
 assert.equal(buzz.wig.getReport().v66RealCrownUnderlayTriangles,0);
 assert.equal(buzz.wig.getReport().bilateralTempleScalpCoverage,false);
 dispose(buzz);
 for(const style of ['sadako-straight-long']){
  const f=make(style);
  const cap=f.cap,report=f.wig.getReport();
  assert.ok(cap?.isMesh,'actual donor scalp must be present');
  assert.equal(report.bilateralTempleScalpCoverage,true);
  assert.ok(report.v66RealCrownUnderlayTriangles>0,
   'central crown alone cannot fill the temple hairline');
  assert.ok(cap.userData.donorScalpVertexCount<
   cap.geometry.getAttribute('position').count,
   'supplemental underlay is not a new root donor');
  const p=cap.geometry.getAttribute('position');
  let left=0,right=0;
  const main=cap.userData.donorScalpVertexCount;
  for(let i=main;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(y>.09&&Math.abs(x)>.24&&z<.08&&z>-.35){
    if(x<0)left++;else right++;
   }
  }
  assert.ok(left>0&&right>0,`missing real temple guard ${style} (${left},${right})`);
  assert.ok(Math.min(left,right)/Math.max(left,right)>.65,
   'scalp donor pigmentation must not fade on only one side');
  dispose(f);
 }
});

test('buzz restores its approved physical pigment with stubble',()=>{
 const f=make('buzz-cut');
 assert.equal(f.cap.material.type,'MeshPhysicalMaterial');
 assert.equal(f.cap.material.depthWrite,true);
 assert.equal(f.cap.renderOrder,2);
 assert.equal(f.cap.userData.shortHairDepthPriority,true);
 assert.equal(f.wig.getReport().buzzScalpPigmentBelowFibres,false);
 const stubble=f.wig.root.getObjectByName('CLOSE_CUT_SCALP_FIBRES_V18');
 assert.equal(stubble.material.type,'MeshBasicMaterial');
 const originalCap=f.cap.userData.donorScalpVertexCount;
 const stubble2=createCloseCutScalpFibres(f.cap,
  f.mesh.geometry.boundingBox,0x81583b,100);
 assert.equal(stubble2.userData.fibreCount,stubble.userData.fibreCount);
 assert.ok(originalCap>0);
 stubble2.geometry.dispose();stubble2.material.dispose();
 dispose(f);
});

test('long crown fibres sample original donor, not the duplicated hairline underlay',()=>{
 const f=make('sadako-straight-long');
 assert.ok(f.wig.getReport().sadakoCrownFibreCount>0);
 assert.equal(f.wig.getReport().v61SeamBlend,
  'donor-bilateral-temple-pigment-and-gradual-crown-ribbon-root');
 const fibres=createSadakoCrownFlow(f.cap,f.mesh.geometry.boundingBox,0x81583b);
 assert.ok(fibres.userData.crownFibreCount>0);
 fibres.geometry.dispose();fibres.material.dispose();
 dispose(f);
});

test('both studios use latest common scalp renderer and retain mantle collision',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/sadako-invisible-perm-rods-v66$/);
 for(const path of ['face-mesh-studio.html','face-body-studio.html'])
  assert.match(read(path),/20261121-sadako-invisible-perm-rods-v66/);
 assert.match(read('face-mesh-studio.html'),/buzzHairlineFractionAtPoint/);
 assert.match(read('face-body-studio.html'),/garmentCollisionResolver:mantleCollision/);
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-shared-scalp-temple-v61\.test\.mjs/);
});
