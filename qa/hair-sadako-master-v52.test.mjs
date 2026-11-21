import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {scalpToGravityWeight,createScalpFirstLongGuide,
 createAreaWeightedScalpRootSampler,createScalpAnchoredWig,FACE_HAIR_RUNTIME_BUILD} from '../src/face-scalp-wig.js';
import {WIG_STYLES} from '../src/face-wig-styles.js';

test('v52 root tangent hugs scalp to 15%, then gravity blends until 38%',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v57$/);
 assert.equal(scalpToGravityWeight(0),0);
 assert.equal(scalpToGravityWeight(.15),0);
 assert.ok(Math.abs(scalpToGravityWeight(.265)-.5)<1e-8);
 assert.equal(scalpToGravityWeight(.38),1);
 assert.equal(scalpToGravityWeight(1),1);
 const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));
 const root=new THREE.Vector3(0,1,0);
 const guide=createScalpFirstLongGuide({
  root,normal:new THREE.Vector3(0,1,0),box,zone:'crown',
  whorl:new THREE.Vector3(0,.95,-.1),length:2,trimY:-3,
  targetX:0,targetZ:.28,segments:18
 });
 assert.equal(guide.length,19);
 assert.ok(guide[1].z>guide[0].z,
  'Root begins by flowing tangentially over the real head, not pointing downward');
 assert.ok(Math.abs(guide[1].y-guide[0].y)<.04,
  'First scalp station must not experience full root gravity');
 assert.ok(guide[11].y<guide[3].y-.16,
  'Later stations must descend after gravity blends in');
 assert.deepEqual(root.toArray(),[0,1,0],'Donor root remains unchanged');
 assert.equal(WIG_STYLES['sadako-straight-long'].cuttingWorkflow,'groom-then-trim');
 assert.equal(WIG_STYLES['sadako-straight-long'].groomMaster,'sadako-straight-long');
});

test('v52 real Sadako ribbons resist penetrating the donor head from underneath',()=>{
 const geometry=new THREE.SphereGeometry(.5,28,20);
 geometry.computeVertexNormals();geometry.computeBoundingBox();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(head,{
  count:80,color:0x78563f,styleId:'sadako-straight-long',
  gender:'female',staticGroom:true,normalLayeredSingleMesh:false,
  visualFiberMultiplier:1,fineFringeMultiplier:1
 });
 const report=wig.getReport();
 assert.equal(report.sadakoMasterGroom,'sadako-scalp-first-master-v52');
 assert.deepEqual(report.sadakoGravityTransition,
  {scalpTo:.15,fullyGravity:.38,segments:18});
 assert.ok(report.pointCount>=80*19);
 assert.equal(report.sadakoUnifiedScalpClipping,true);
 assert.ok(report.sadakoAreaSampledRoots>=report.rootCount*.40,
  'Area roots should replace concentrated photo-vertex sampling');
 assert.ok(report.sadakoFollicleTriangles>15,
  'Scalp surface triangles must be available for true area sampling');
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.equal(cap?.userData.unifiedBuzzContour,true);
 assert.ok(cap?.userData.donorScalpVertexCount>40);
 assert.equal(report.sadakoCrownFibreCount,0,
  'Synthetic short crown stubble should not conceal uncovered long locks');
 assert.ok(Number.isFinite(report.sadakoGuideScalpPushes));
 assert.ok(Number.isFinite(report.sadakoRibbonScalpPushes));
 const locks=wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 assert.ok(locks?.isMesh,'Must inspect actual rendered hair geometry, not just guide metadata');
 const positions=locks.geometry.getAttribute('position');
 let interior=0,scalpStations=0;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z));
  // Skip below the spherical nape: those long tips should freely drape.
  if(y<.06||y>.497)continue;
  scalpStations++;
  if(Math.hypot(x,y,z)<.46)interior++;
 }
 assert.ok(scalpStations>60,'Exercise scalp/root-zone ribbon vertices');
 assert.equal(interior,0,
  'Hair ribbon corners must not penetrate deeply into the donor skull');
 const styleSamples=wig.getStyleSamples();
 assert.ok(styleSamples.some(s=>s.zone==='crown'));
 for(const sample of styleSamples){
  assert.ok(sample.firstStep.every(Number.isFinite));
  assert.ok(sample.tip.every(Number.isFinite));
 }
 wig.dispose();geometry.dispose();head.material.dispose();
});

test('v52 changing to buzz still takes the independent short-cut path',()=>{
 const geometry=new THREE.SphereGeometry(.5,24,16);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const short=createScalpAnchoredWig(head,{
  count:48,color:0x765039,styleId:'buzz-cut',gender:'female',
  staticGroom:true,normalLayeredSingleMesh:false,visualFiberMultiplier:1
 });
 const report=short.getReport();
 assert.equal(report.sadakoMasterGroom,null);
 assert.equal(report.sadakoGravityTransition,null);
 assert.equal(report.closeCutPaletteMatched,true);
 assert.equal(report.closeCutSelfShadowDisabled,true);
 short.dispose();geometry.dispose();head.material.dispose();
});

test('Android studio provides a real one-tap underside hair view',()=>{
 const page=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 assert.match(page,/id="underside"[^>]*>頭皮の下面<\/button>/);
 assert.match(page,/view==='underside'\?new THREE.Vector3\(0,-1,0\)/);
 assert.match(page,/\['front','threeQuarter','side','back','crown','underside'\]/);
 assert.match(page,/for\(const id of \['female','male','front','threeQuarter','side','back','crown','underside'/);
 assert.match(page,/sadako-top-to-side-canopy-v57/);
});

test('v53 independent follicle sampling covers crown and front without topology density bias',()=>{
 const geometry=new THREE.SphereGeometry(.5,40,30);
 geometry.computeVertexNormals();geometry.computeBoundingBox();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(head,{
  count:420,color:0x73503b,styleId:'sadako-straight-long',
  gender:'female',staticGroom:true,normalLayeredSingleMesh:false,
  visualFiberMultiplier:1,fineFringeMultiplier:1
 });
 const rootSamples=wig.getRootSamples();
 const stats=wig.getReport();
 assert.ok(stats.sadakoAreaZoneTriangles.crown>20,
  'There must be real donor crown triangles');
 assert.ok(stats.sadakoAreaZoneTriangles.fringeLeft>0,
  'Left forehead must contain front follicles');
 assert.ok(stats.sadakoAreaZoneTriangles.fringeRight>0,
  'Right forehead must contain front follicles');
 assert.ok(stats.sadakoAreaSampledRoots>stats.rootCount*.6,
  'Most roots must be distributed over area, not repeated vertex IDs');
 assert.ok(rootSamples.some(s=>s.zone==='fringeLeft'));
 assert.ok(rootSamples.some(s=>s.zone==='fringeRight'));
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 const sampler=createAreaWeightedScalpRootSampler(cap,geometry.boundingBox);
 for(const zone of ['crown','fringeLeft','fringeRight','templeLeft','templeRight']){
  const points=Array.from({length:70},(_,i)=>sampler.sample(zone,i)).filter(Boolean);
  assert.ok(points.length>20,zone+' must not have sparse unfilled donor roots');
  const keys=new Set(points.map(p=>[p.p.x,p.p.y,p.p.z].map(v=>v.toFixed(4)).join(',')));
  assert.ok(keys.size>points.length*.88,
   'Roots must fill '+zone+' continuously, not reuse a few vertices');
  assert.ok(points.every(p=>p.source==='donor-triangle-area-v53'));
 }
 wig.dispose();geometry.dispose();head.material.dispose();
});

test('v53 studio reselect clips long donor scalp and leaves buzz path unchanged',()=>{
 const page=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const hair=readFileSync(new URL('../src/face-scalp-wig.js',import.meta.url),'utf8');
 assert.match(page,/sadakoCover=wig\?\.root\?\.userData\?\.hairStyleId==='sadako-straight-long'/);
 assert.match(page,/if\(!wig\?\.root\?\.userData\?\.buzzFibreOnly&&!sadakoCover\)/);
 assert.match(page,/v53-sadako-matched-donor-clipping/);
 assert.match(hair,/if\(shortHair\|\|styleId==='sadako-straight-long'\)/);
 assert.match(hair,/const sadakoCrownFlow=null/);
 assert.match(page,/sadako-top-to-side-canopy-v57/);
});
