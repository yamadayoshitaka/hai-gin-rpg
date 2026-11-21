import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FACE_HAIR_RUNTIME_BUILD,sadakoSideRibbonBlend,
 v67ScalpMatchedLockTone,v63WigScalpTone,createScalpAnchoredWig}
 from '../src/face-scalp-wig.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const make=(styleId,options={})=>{
 const geometry=new THREE.SphereGeometry(.5,28,20);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(head,{styleId,count:180,color:0x78503c,
  staticGroom:true,normalLayeredSingleMesh:false,visualFiberMultiplier:1,
  ...options});
 return {head,wig,dispose(){wig.dispose();geometry.dispose();head.material.dispose();}};
};

test('v64 narrows ONLY Sadako temple/crown-over-side cards and feathered layers',()=>{
 const t=.38;
 for(const zone of ['templeLeft','templeRight']){
  const p=sadakoSideRibbonBlend(zone,false,t,0);
  assert.equal(p.active,true);
  assert.ok(p.widthScale<.67&&p.widthScale>.5);
  assert.ok(p.layerWidth<1);
  assert.ok(p.thicknessScale<.6);
  assert.equal(p.toneBlendEnd,.44);
  for(let layer=0;layer<4;layer++){
   const q=sadakoSideRibbonBlend(zone,false,t,layer);
   assert.ok(q.layerWidth>0&&q.layerWidth<=.82);
  }
 }
 assert.deepEqual(sadakoSideRibbonBlend('templeLeft',false,t,2),
  sadakoSideRibbonBlend('templeRight',false,t,2),
  'left/right card widths must be mirror symmetric');
 const crown=sadakoSideRibbonBlend('crown',true,t,0);
 assert.equal(crown.active,true);
 assert.ok(crown.widthScale<.84);
 assert.equal(crown.crownLiftScale,.64);
 assert.ok(sadakoSideRibbonBlend('crown',true,.01).widthScale<
  sadakoSideRibbonBlend('crown',true,.31).widthScale,
  'scalp roots narrow into a naturally widening loose side curtain');
});

test('non-side strands and approved buzz rendering retain the old card profile',()=>{
 for(const zone of ['crown','fringeLeft','fringeRight','backLeft','napeRight']){
  const q=sadakoSideRibbonBlend(zone,false,.42,0);
  assert.equal(q.active,false);
  assert.equal(q.widthScale,1);
  assert.equal(q.layerWidth,1);
  assert.equal(q.crownLiftScale,1);
  assert.equal(q.toneBlendEnd,.30);
 }
 const buzz=make('buzz-cut');
 const r=buzz.wig.getReport();
 assert.equal(r.closeCutFibreCount,30000);
 assert.equal(r.buzzSparseApprovedLookRestored,true);
 assert.equal(r.sadakoSideRibbonProfile,null);
 assert.equal(r.sadakoCrownOverSideLocks,0);
 const cap=buzz.wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.equal(cap?.material.type,'MeshPhysicalMaterial');
 assert.equal(cap?.userData.v66RealCrownUnderlayTriangles,0);
 buzz.dispose();
});

test('v64 long hair keeps root distribution but removes flat side card layers',()=>{
 const long=make('sadako-straight-long');
 const r=long.wig.getReport();
 assert.equal(r.sadakoSidePanelCount,0);
 assert.match(r.sadakoSideRibbonProfile,/tapered-layers-no-flat-panels-v64/);
 assert.ok(r.sadakoEarCurtainLocks>0);
 assert.ok(r.sadakoCrownOverSideLocks>0);
 assert.equal(r.sadakoTempleWidthScale,.66);
 assert.equal(r.sadakoCrownOverSideWidthScale,.83);
 assert.ok(r.v66RealCrownUnderlayTriangles>0);
 const locks=long.wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 assert.ok(locks?.isMesh);
 const p=locks.geometry.getAttribute('position');
 for(let i=0;i<Math.min(p.count,350);i++)
  assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));
 long.dispose();
});

test('root pigment of Sadako side strands blends longer into donor scalp',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),
  new THREE.Vector3(.5,.5,.5));
 const point=new THREE.Vector3(.23,.45,-.08),seed=17,t=.18;
 const scalp=v63WigScalpTone(point.x,point.y,point.z,box);
 const oldTone=v67ScalpMatchedLockTone(point,box,t,seed,1);
 const newTone=v67ScalpMatchedLockTone(point,box,t,seed,1,.44);
 assert.ok(Math.abs(newTone-scalp)<=Math.abs(oldTone-scalp)+1e-10);
 assert.equal(v67ScalpMatchedLockTone(point,box,0,seed,1,.44),scalp);
 assert.equal(v67ScalpMatchedLockTone(point,box,1,seed,1,.44),
  v67ScalpMatchedLockTone(point,box,1,seed,1));
});

test('both previews and CI use v64 while keeping full-body mantle collision',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/two-donor-unisex-catalog-v67$/);
 const body=read('face-body-studio.html'),face=read('face-mesh-studio.html');
 for(const html of [body,face])
  assert.match(html,/20261121-two-donor-unisex-catalog-v67/);
 assert.match(body,/garmentCollisionResolver:mantleCollision/);
 assert.match(body,/wig\?\.update\(dt\)/);
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-sadako-side-ribbons-v64\.test\.mjs/);
});
