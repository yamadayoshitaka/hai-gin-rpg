import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getWigStyle,WIG_BASE_VOLUME_PROFILES} from '../src/face-wig-styles.js';
import {REBUILT_HAIR_CATALOG} from '../src/hair-rebuilt-catalog-v67.js';
import {shapeRebuiltEarTuck,shapeRebuiltMaleGuide,
 shapeRebuiltStraightBangs,createScalpAnchoredWig} from '../src/face-scalp-wig.js';
const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
 new THREE.Vector3(.5,1,.5));
const curtain=()=>Array.from({length:19},(_,j)=>
 new THREE.Vector3(.035,.98-j*.039,.30));
test('v70 ear tuck leaves eyes, nose and cheeks uncovered on long frontal locks',()=>{
 for(const side of [-1,1]){
  const guide=curtain().map(p=>new THREE.Vector3(p.x*side,p.y,p.z));
  const root=guide[0].clone();
  shapeRebuiltEarTuck(guide,{box,side});
  assert.deepEqual(guide[0].toArray(),root.toArray(),'follicle unchanged');
  for(const p of guide.slice(4,14)){
   assert.ok(side*p.x>.30,'curtain must reach temple above eye height');
   assert.ok(p.z<.12,'frontal hair must route behind the ear/face');
  }
 }
 assert.equal(getWigStyle('rb-f-semilong').catalogFront,'tucked');
});
test('v70 men have a separate swept top, compact sideburn and nape geometry',()=>{
 for(const row of REBUILT_HAIR_CATALOG.male){
  assert.equal(getWigStyle(row.id).maleGroom,'tailored-male-v70');
 }
 for(const row of REBUILT_HAIR_CATALOG.female)
  assert.equal(getWigStyle(row.id).maleGroom,null);
 const guide=curtain();
 shapeRebuiltMaleGuide(guide,{box,zone:'templeRight',side:1,part:'side'});
 assert.ok(guide[8].x>.25,'male temple is swept outside eye');
 assert.ok(guide.at(-1).y>=.51,'medium sideburn ends near the ear');
 const maleNape=curtain();
 shapeRebuiltMaleGuide(maleNape,{box,zone:'napeRight',side:1});
 assert.ok(maleNape.at(-1).y>=.32,'short male nape is separately tapered');
});
test('v70 hime haircut has lower long blunt bangs instead of extreme short fringe',()=>{
 assert.equal(getWigStyle('rb-f-hime').himeFringe,'glabella-long-v70');
 const a=curtain(),hime=curtain();
 shapeRebuiltStraightBangs(a,{box,rootIndex:0,tipLevel:.786});
 shapeRebuiltStraightBangs(hime,{box,rootIndex:0,tipLevel:.752});
 assert.equal(hime[0].y,a[0].y);
 assert.ok(hime.at(-1).y<a.at(-1).y-.03,
  'hime central bangs must be noticeably longer than standard blunt bangs');
 assert.ok(Math.abs(hime.at(-1).x-hime[0].x)<.02);
});
const head=()=>{
 const geo=new THREE.SphereGeometry(.5,24,18);
 geo.computeVertexNormals();
 return new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
};
const wig=(id,gender='female')=>{
 const h=head(),w=createScalpAnchoredWig(h,{
  styleId:id,gender,count:96,visualFiberMultiplier:1,
  staticGroom:true,normalLayeredSingleMesh:false,color:0x765440,
  volumeProfile:'full'
 });
 return {w,cleanup(){w.dispose();h.geometry.dispose();h.material.dispose();}};
};
test('v70 actual female semilong carries visible metal hairpins and compact head hair',()=>{
 const x=wig('rb-f-semilong');
 const report=x.w.getReport();
 assert.equal(report.v70EarTuckBeforeEyes,true);
 assert.equal(report.v70EyeCurtainLocks,0,'no frontal eye-level hair veil in the actual 3D semilong');
 assert.equal(report.v70HairPinMeshCount,4);
 for(const side of ['LEFT','RIGHT']){
  for(let i=0;i<2;i++){
   const p=x.w.root.getObjectByName(side+'_TEMPLE_HAIRPIN_'+i);
   assert.ok(p?.isMesh,'actual selectable geometry not a fake clip label');
   assert.ok(p.material.metalness>.5);
  }
 }
 assert.ok(WIG_BASE_VOLUME_PROFILES.full.spread<=-1);
 x.cleanup();
});
test('v70 male and hime actual wigs carry their own blueprint and no female clips',()=>{
 const m=wig('rb-m-center-medium','male'),h=wig('rb-f-hime');
 const mr=m.w.getReport(),hr=h.w.getReport();
 assert.equal(mr.v70MasculineGroom,'tailored-male-v70');
 assert.equal(mr.v70HairPinMeshCount,0);
 assert.equal(hr.v70HimeFringe,'glabella-long-v70');
 assert.equal(hr.v70HairPinMeshCount,0);
 assert.ok(mr.rootDistribution.templeLeft<hr.rootDistribution.templeLeft,
  'male scalp layout must not be the same female temple curtain');
 const himeFringe=h.w.getStyleSamples().filter(x=>x.zone.startsWith('fringe'));
 assert.ok(himeFringe.length>0);
 assert.ok(himeFringe.some(x=>x.tip[1]<=.29),
  'hime bangs fall noticeably below the previous cropped line');
 m.cleanup();h.cleanup();
});
