import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {listWigStyles} from '../src/face-wig-styles.js';
import {shapeCatalogLengthGuide,shapeRebuiltPinnedFringe,shapeRebuiltFaceFrame,
 createScalpAnchoredWig} from '../src/face-scalp-wig.js';
import {HAIR_SHAPE_CATALOG_V71} from '../src/hair-shape-catalog-v71.js';
const path=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
 new THREE.Vector3(.5,1,.5));
const makeGuide=()=>Array.from({length:19},(_,i)=>
 new THREE.Vector3(.06,.98-i*.07,.30));
test('v72 only front fringe is pinned; cheek and side hair stays naturally loose',()=>{
 const fringe=makeGuide(),face=makeGuide(),temple=makeGuide();
 const orig=fringe[0].clone();
 shapeRebuiltPinnedFringe(fringe,{box,side:1});
 shapeRebuiltFaceFrame(face,{box,side:1});
 assert.deepEqual(fringe[0].toArray(),orig.toArray());
 assert.ok(fringe[6].x>.26,'only fringe is pinned toward a shallow side clip');
 assert.ok(fringe[6].z>.10,'pinned fringe must not be sent behind the ear');
 assert.ok(face[9].z===.30,'face-frame hair must not be pushed backwards');
 assert.deepEqual(temple[9].toArray(),makeGuide()[9].toArray());
});
test('v72 medium/semilong/long catalog has progressive shoulder-to-back cut levels',()=>{
 const c=HAIR_SHAPE_CATALOG_V71;
 assert.ok(c['rb-f-medium'].back>c['rb-f-semilong'].back+.15);
 assert.ok(c['rb-f-semilong'].back>c['rb-f-long'].back+.30);
 assert.ok(c['rb-m-center-medium'].back>c['rb-m-shoulder'].back+.25);
 assert.ok(c['rb-m-shoulder'].back>c['rb-m-long'].back+.17);
 assert.ok(c['rb-f-medium'].back>-.21&&c['rb-f-medium'].back<-.06);
});
test('v72 every station stays between real root and target: no long dangling tails',()=>{
 for(const y of [.55,.28,-.14,-.33,-.72]){
  const g=makeGuide(),root=g[0].clone();
  shapeCatalogLengthGuide(g,{box,tipY:y,rootIndex:2});
  assert.deepEqual(g[0].toArray(),root.toArray());
  const target=g.at(-1).y;
  for(let i=1;i<g.length;i++){
   assert.ok(g[i].y>=target-1e-7,'no hair stations under actual cut');
   assert.ok(g[i].y<=g[i-1].y+1e-7,'guide must fall monotonically');
  }
 }
});
function actual(id,gender='female',consolidated=false){
 const geom=new THREE.SphereGeometry(.5,24,18);
 geom.computeVertexNormals();
 const face=new THREE.Mesh(geom,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(face,{styleId:id,gender,count:128,
  visualFiberMultiplier:1,staticGroom:true,
  normalLayeredSingleMesh:consolidated,color:0x675143});
 return {wig,dispose(){wig.dispose();geom.dispose();face.material.dispose();}};
}
test('v72 actual semilong pins are fitted to real FRONT hairs (not floating transforms)',()=>{
 const testWig=actual('rb-f-semilong');
 const {wig}=testWig,report=wig.getReport();
 assert.equal(report.v70HairPinMeshCount,2);
 assert.equal(report.v72FringeOnlyPins,true);
 assert.equal(report.v72PinAnchors.length,2);
 assert.equal(report.v70EyeCurtainLocks,0);
 for(const side of [-1,1]){
  const label=side<0?'LEFT':'RIGHT';
  const pin=wig.root.getObjectByName(label+'_TEMPLE_HAIRPIN_0');
  assert.ok(pin?.isMesh,'visible physical pin for '+label);
  assert.equal(pin.userData.pinSourceZone,side<0?'fringeLeft':'fringeRight');
  assert.ok(pin.userData.pinSurfaceGap<.007);
  assert.equal(pin.position.length(),0,'no unbaked node translation');
  assert.equal(pin.rotation.z,0,'pin rotation baked into real vertices');
  pin.geometry.computeBoundingBox();
  const centroid=pin.geometry.boundingBox.getCenter(new THREE.Vector3());
  const anchor=report.v72PinAnchors.find(p=>p.side===side).position;
  assert.ok(centroid.distanceTo(new THREE.Vector3(...anchor))<.006);
 }
 testWig.dispose();
});
test('v72 full 3D medium remains shoulder-length rather than a hidden long tail',()=>{
 const m=actual('rb-f-medium'),s=actual('rb-f-semilong'),
  l=actual('rb-f-long');
 const shortY=m.wig.getReport().v71RearTipMedian;
 const semiY=s.wig.getReport().v71RearTipMedian;
 const longY=l.wig.getReport().v71RearTipMedian;
 assert.ok(shortY>semiY+.12);
 assert.ok(semiY>longY+.30);
 for(const item of [m,s,l])item.dispose();
});
test('v72 male combo replaces female choices and uses male actor state',()=>{
 const html=path('face-mesh-studio.html');
 const male=listWigStyles('male'),female=listWigStyles('female');
 assert.ok(male.some(x=>x.id==='rb-m-center-medium'));
 assert.ok(!male.some(x=>x.id.startsWith('rb-f-')));
 assert.ok(!female.some(x=>x.id.startsWith('rb-m-')));
 assert.match(html,/function populateQuickHairStyles\(sex\)/);
 assert.match(html,/listWigStyles\(sex\)/);
 assert.match(html,/populateQuickHairStyles\(next\)/);
 assert.match(html,/synchronizeHeroHairSelection\(gender,v32Parts\[gender\]/);
 assert.match(html,/if\(gender==='male'\)\{rebuildMaleHair\(\);persistMaleFace\(\);\}/);
 assert.doesNotMatch(html,/\$\('quickHairControl'\)\.hidden=next!=='female'/);
 assert.match(html,/hideHairType:true,hideHairVolume:true/);
});
