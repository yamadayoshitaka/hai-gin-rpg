import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {
 FACE_HAIR_RUNTIME_BUILD,createAreaWeightedScalpRootSampler,
 createScalpAnchoredWig,createScalpFirstLongGuide,
 sadakoCrownSurfaceLayerOffset
} from '../src/face-scalp-wig.js';

const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));

test('v56 ears: scalp-root sampling reaches lower temples instead of only top-of-head',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v57$/);
 const sphere=new THREE.SphereGeometry(.5,48,36).toNonIndexed();
 sphere.computeVertexNormals();sphere.computeBoundingBox();
 const cap=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial());
 const sampler=createAreaWeightedScalpRootSampler(cap,sphere.boundingBox);
 for(const zone of ['templeLeft','templeRight']){
  assert.ok(sampler.zoneTriangleCounts[zone]>45,'must sample the side of head');
  const points=Array.from({length:100},(_,i)=>sampler.sample(zone,i)).filter(Boolean);
  assert.equal(points.length,100);
  const lower=points.filter(x=>{
   const yn=(x.p.y-sphere.boundingBox.min.y)/
    (sphere.boundingBox.max.y-sphere.boundingBox.min.y);
   return yn<.76;
  }).length;
  assert.ok(lower>=10,zone+' must have true ear-level follicles');
  assert.ok(points.every(x=>x.source==='donor-triangle-area-v53'));
 }
 sphere.dispose();cap.material.dispose();
});

test('v56 ear guides remain close to the ears rather than radially spreading',()=>{
 for(const side of [-1,1]){
  const root=new THREE.Vector3(side*.39,.75,-.07);
  const result=createScalpFirstLongGuide({
   root,normal:new THREE.Vector3(side*.7,.65,.12).normalize(),
   box,zone:side>0?'templeRight':'templeLeft',length:3.2,trimY:-5,
   targetX:root.x,targetZ:root.z,segments:18,
   whorl:new THREE.Vector3(0,.96,-.1)
  });
  const band=result.filter(p=>p.y>-.01&&p.y<.55);
  assert.ok(band.length>=1,'some locks must pass across ear height');
  assert.ok(band.every(p=>side*p.x<.61),'no wide radial wing from the ear');
  assert.ok(band.some(p=>side*p.x>.33),'ear cover still stays outside pinna');
 }
});

test('v56 crown layer is OUTSIDE front and temple cards, never floats off donor root',()=>{
 const upperY=.85;
 assert.equal(sadakoCrownSurfaceLayerOffset('crown',upperY,0,box),0,
  'donor scalp follicles must remain attached');
 assert.ok(sadakoCrownSurfaceLayerOffset('crown',upperY,.12,box)>.035,
  'head-top crown must be the outermost 3D hair surface, not hidden by side/front cards');
 assert.ok(sadakoCrownSurfaceLayerOffset('crown',upperY,.34,box)>.03,
  'outer crown overlap must persist over the frontal and side scalp arcs');
 assert.equal(sadakoCrownSurfaceLayerOffset('templeLeft',upperY,.12,box),0);
 assert.equal(sadakoCrownSurfaceLayerOffset('fringeRight',upperY,.12,box),0);
 assert.equal(sadakoCrownSurfaceLayerOffset('crown',-.4,.12,box),0);
 assert.equal(sadakoCrownSurfaceLayerOffset('crown',upperY,.8,box),0,
  'long dangling tips should not grow a hard helmet shell');
});

test('actual Sadako mesh allocates dense ear curtains AND an upper crown layer',()=>{
 const g=new THREE.SphereGeometry(.5,28,20);
 g.computeVertexNormals();
 const head=new THREE.Mesh(g,new THREE.MeshStandardMaterial());
 const w=createScalpAnchoredWig(head,{
  styleId:'sadako-straight-long',count:420,color:0x755037,
  staticGroom:true,normalLayeredSingleMesh:false,visualFiberMultiplier:1,
  volumeProfile:'natural',gender:'female'
 });
 const r=w.getReport();
 assert.equal(r.sadakoEarCoverageMethod,'lower-temple-rooted-vertical-curtain-v56');
 assert.equal(r.sadakoCrownLayerOrder,'top-grown-canopy-crosses-and-overlies-both-sides-v57');
 assert.equal(r.sadakoCrownOuterMaxFraction,.038);
 assert.equal(r.sadakoCrownOuterOnlyAboveEar,true);
 assert.ok(r.sadakoEarCurtainLocks>=r.rootCount*.33,
  'ear coverage needs actual rooted long-hair guides, not forced outward width');
 assert.ok(r.rootDistribution.crown>=r.rootCount*.24,
  'crown must remain dense enough to cover the front/side layers from above');
 assert.equal(r.sadakoEarRibbonWidthFactor,.90);
 assert.equal(r.sadakoSidePanelCount,0,'old rectangular side/rear panels stay removed');
 const locks=w.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 assert.ok(locks?.isMesh);
 const a=locks.geometry.getAttribute('position');
 for(let i=0;i<Math.min(a.count,300);i++)
  assert.ok([a.getX(i),a.getY(i),a.getZ(i)].every(Number.isFinite));
 w.dispose();g.dispose();head.material.dispose();
 const buzzHead=new THREE.Mesh(new THREE.SphereGeometry(.5,20,12),
  new THREE.MeshStandardMaterial());
 const buzz=createScalpAnchoredWig(buzzHead,{
  styleId:'buzz-cut',count:60,gender:'female',color:0x755037,
  staticGroom:true,normalLayeredSingleMesh:false
 });
 assert.equal(buzz.getReport().closeCutPaletteMatched,true);
 assert.equal(buzz.getReport().sadakoCrownLayerOrder,null);
 buzz.dispose();buzzHead.geometry.dispose();buzzHead.material.dispose();
});

test('both game hair editors use v56 and can inspect crown from above',()=>{
 const face=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const body=readFileSync(new URL('../face-body-studio.html',import.meta.url),'utf8');
 assert.match(face,/20261121-sadako-top-to-side-canopy-v57/);
 assert.match(body,/20261121-sadako-top-to-side-canopy-v57/);
 assert.match(face,/id="crown"/);
 assert.match(face,/頭頂部レイヤー/);
});
