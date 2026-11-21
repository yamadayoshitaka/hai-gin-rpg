import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 FACE_HAIR_RUNTIME_BUILD,createScalpFirstLongGuide,
 createScalpAnchoredWig,sadakoCrownSideOverlayOffset,
 sadakoCrownSurfaceLayerOffset
} from '../src/face-scalp-wig.js';

const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),
 new THREE.Vector3(1,1,1));

test('v57 anatomical crown canopy sweeps BOTH ways over the side scalp',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v60$/);
 for(const side of [-1,1]){
  const root=new THREE.Vector3(side*.12,.95,.01);
  const normal=new THREE.Vector3(side*.18,.97,.02).normalize();
  const options={root,normal,box,zone:'crown',length:3.4,trimY:-5,
   segments:18,whorl:new THREE.Vector3(0,.95,-.12),
   targetX:side*.68,targetZ:root.z,volumeSpread:0};
  const canopy=createScalpFirstLongGuide({...options,crownOverSide:true});
  const ordinary=createScalpFirstLongGuide({...options,crownOverSide:false});
  assert.deepEqual(canopy[0].toArray(),root.toArray(),
   'donor scalp follicle must remain attached');
  assert.ok(side*(canopy[3].x-root.x)>.065,
   'top hair must physically sweep across the crown toward the ear');
  assert.ok(side*(canopy[3].x-ordinary[3].x)>.012,
   'top-to-side route must be distinct from ordinary fringe/down guides');
  assert.ok(canopy[10].y<canopy[4].y-.12,
   'after crossing the crown, canopy must fall with gravity');
  for(const p of canopy)assert.ok(p.toArray().every(Number.isFinite));
 }
});

test('v57 crown overlay is geometrically OUTSIDE temple and fringe through upper side',()=>{
 assert.equal(sadakoCrownSideOverlayOffset('crown',.80,0,box,true),0);
 assert.ok(sadakoCrownSideOverlayOffset('crown',.72,.23,box,true)>
  sadakoCrownSurfaceLayerOffset('crown',.72,.23,box),
  'top-grown crown canopy should sit outside earlier root-only offset');
 assert.ok(sadakoCrownSideOverlayOffset('crown',.30,.36,box,true)>.012,
  'outer layer must also cover upper temple, not just the very top');
 assert.equal(sadakoCrownSideOverlayOffset('crown',.72,.23,box,false),0);
 assert.equal(sadakoCrownSideOverlayOffset('templeRight',.72,.23,box,true),0);
 assert.equal(sadakoCrownSideOverlayOffset('crown',.72,.9,box,true),0,
  'long tips are free falling, without an inflated helmet');
});

test('actual Sadako wig generates many crown-rooted locks crossing above BOTH sides',()=>{
 const geometry=new THREE.SphereGeometry(.5,30,24);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(head,{
  styleId:'sadako-straight-long',count:360,color:0x755038,
  gender:'female',staticGroom:true,normalLayeredSingleMesh:false,
  visualFiberMultiplier:1,volumeProfile:'natural'
 });
 const report=wig.getReport();
 assert.equal(report.sadakoCrownLayerOrder,
  'top-grown-canopy-crosses-and-overlies-both-sides-v57');
 assert.equal(report.sadakoCrownCanopyGroom,
  'curved-scalp-crown-guide-fibre-overlay-v59');
 assert.equal(report.sadakoCrownOverSideOffset,.021);
 assert.ok(report.sadakoCrownOverSideLocks>=report.rootDistribution.crown*.76,
  'most crown follicles need actual top-to-side growth, not a visual decal');
 assert.ok(report.sadakoCrownOverSideLocks>=70);
 const samples=wig.getCrownOverlaySamples();
 assert.ok(samples.length>20,'Expose representative canopy guides for regression');
 for(const side of [-1,1]){
  const same=samples.filter(x=>x.side===side);
  assert.ok(same.length>5,side+' crown must cover its own temple');
  const crossed=same.filter(x=>
   side*(x.stations[4][0]-x.root[0])>.035).length;
  assert.ok(crossed>=Math.floor(same.length*.70),
   'most top-grown strands must actually cross towards side '+side);
 }
 const locks=wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 assert.ok(locks?.isMesh);
 const attr=locks.geometry.getAttribute('position');
 for(let i=0;i<Math.min(attr.count,250);i++)
  assert.ok([attr.getX(i),attr.getY(i),attr.getZ(i)].every(Number.isFinite));
 assert.equal(report.sadakoSidePanelCount,0,'Do not reintroduce flat side sheets');
 wig.dispose();geometry.dispose();head.material.dispose();
});

test('buzz does not inherit long canopy and studios load the exact v57 module',()=>{
 const geometry=new THREE.SphereGeometry(.5,20,14);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const buzz=createScalpAnchoredWig(head,{
  styleId:'buzz-cut',gender:'female',count:50,color:0x755038,
  staticGroom:true,normalLayeredSingleMesh:false,visualFiberMultiplier:1
 });
 assert.equal(buzz.getReport().sadakoCrownOverSideLocks,0);
 assert.equal(buzz.getReport().sadakoCrownCanopyGroom,null);
 assert.equal(buzz.getReport().closeCutPaletteMatched,true);
 buzz.dispose();geometry.dispose();head.material.dispose();
 const face=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const body=readFileSync(new URL('../face-body-studio.html',import.meta.url),'utf8');
 assert.match(face,/20261121-sadako-mantle-crown-v60/);
 assert.match(body,/20261121-sadako-mantle-crown-v60/);
 assert.match(face,/頭頂→横に覆う毛束/);
});
