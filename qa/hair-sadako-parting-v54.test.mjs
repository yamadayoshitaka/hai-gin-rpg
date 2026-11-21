import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createScalpFirstLongGuide,createScalpAnchoredWig,
 FACE_HAIR_RUNTIME_BUILD} from '../src/face-scalp-wig.js';
import {WIG_BASE_VOLUME_PROFILES} from '../src/face-wig-styles.js';

const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),
 new THREE.Vector3(1,1,1));

test('v54 uses skull distance for gravity; no sideways plate-length sweep',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/v56$/);
 const sample=createScalpFirstLongGuide({
  root:new THREE.Vector3(0,1,0),
  normal:new THREE.Vector3(0,1,0),box,
  zone:'crown',whorl:new THREE.Vector3(0,.95,-.08),
  length:5,trimY:-8,targetX:0,targetZ:.24,segments:18
 });
 assert.equal(sample.length,19);
 const first=sample[1].clone().sub(sample[0]);
 assert.ok(first.z>0,'Root should flow forwards from the crown');
 assert.ok(sample[5].y<sample[2].y,
  'Long hair must begin descending near the skull instead of forming a horizontal board');
 assert.ok(sample[9].y<sample[5].y,
  'Lower lengths should be gravity-aligned');
 for(const p of sample)assert.ok(p.toArray().every(Number.isFinite));
});

test('front scalp is parted half-left and half-right while the roots stay fixed',()=>{
 const leftRoot=new THREE.Vector3(-.08,.63,.29),
  rightRoot=new THREE.Vector3(.08,.63,.29);
 const guide=(root,zone)=>createScalpFirstLongGuide({
  root,normal:new THREE.Vector3(Math.sign(root.x)*.18,.76,.61).normalize(),
  box,zone,whorl:new THREE.Vector3(0,.95,-.08),
  length:3.5,trimY:-6,targetX:root.x,targetZ:.38,segments:18
 });
 const a=guide(leftRoot,'fringeLeft'),b=guide(rightRoot,'fringeRight');
 assert.deepEqual(a[0].toArray(),leftRoot.toArray());
 assert.deepEqual(b[0].toArray(),rightRoot.toArray());
 assert.ok(a[7].x<leftRoot.x-.04,'Left front curtain opens towards left cheek');
 assert.ok(b[7].x>rightRoot.x+.04,'Right front curtain opens towards right cheek');
 assert.ok((b[7].x-a[7].x)>(rightRoot.x-leftRoot.x)+.12,
  'Front hair must be visibly divided, not one straight sheet over the face');
});

test('volume dropdown compresses/spreads STRAND silhouette without lifting scalp roots',()=>{
 assert.equal(WIG_BASE_VOLUME_PROFILES.soft.spread,-1);
 assert.equal(WIG_BASE_VOLUME_PROFILES.natural.spread,0);
 assert.ok(WIG_BASE_VOLUME_PROFILES.full.spread>WIG_BASE_VOLUME_PROFILES.airy.spread);
 const root=new THREE.Vector3(.28,.72,.12);
 const guide=volumeSpread=>createScalpFirstLongGuide({
  root,normal:new THREE.Vector3(.5,.72,.4).normalize(),box,
  zone:'templeRight',whorl:new THREE.Vector3(0,.95,-.08),
  length:3,trimY:-6,targetX:.28,targetZ:.16,segments:18,volumeSpread
 });
 const compressed=guide(-1),normal=guide(0),expanded=guide(1.5);
 assert.deepEqual(compressed[0].toArray(),normal[0].toArray());
 assert.deepEqual(expanded[0].toArray(),normal[0].toArray());
 const radial=p=>Math.hypot(p.x,p.z);
 assert.ok(radial(compressed[9])<radial(normal[9]));
 assert.ok(radial(expanded[9])>radial(normal[9]));
});

test('real Sadako model has no broad rear plates and retains crown hair roots',()=>{
 const geometry=new THREE.SphereGeometry(.5,32,24);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(head,{
  count:160,gender:'female',styleId:'sadako-straight-long',
  volumeProfile:'natural',visualFiberMultiplier:1,
  staticGroom:true,normalLayeredSingleMesh:false
 });
 const report=wig.getReport();
 assert.equal(report.undercoatLockCount,0,'No 160 wide rear cardboard strips');
 assert.equal(report.sadakoSidePanelCount,0);
 assert.equal(report.layeredRibbonCount,2,'Two narrow card planes replace four stiff boards');
 assert.match(report.hairCardStyle,/two-narrow-tangent-ribbons/);
 assert.equal(report.sadakoCenterParted,true);
 assert.equal(report.sadakoGravityDistanceBased,true);
 assert.ok(report.sadakoAreaZoneTriangles.crown>20);
 const locks=wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 const count=locks.geometry.getAttribute('position').count;
 assert.ok(count>=report.rootCount*19*4);
 assert.equal(report.sadakoHairVolumeSpread,0);
 wig.dispose();geometry.dispose();head.material.dispose();
});

test('face and body studios expose only one visible style/volume/density selector',()=>{
 const face=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const body=readFileSync(new URL('../face-body-studio.html',import.meta.url),'utf8');
 const selector=readFileSync(new URL('../src/face-part-selector-ui-v32.js',import.meta.url),'utf8');
 assert.equal((face.match(/id="quickWigStyle"/g)||[]).length,1);
 assert.equal((face.match(/id="wigVolume"/g)||[]).length,1);
 assert.doesNotMatch(face,/id="wigStyle"/);
 assert.match(face,/hairVolume=\$\('wigVolume'\)\.value/);
 assert.match(face,/hideHairType:sex==='female',hideHairVolume:sex==='female'/);
 assert.match(selector,/if\(!hideHairVolume\)panel\.append\(baseLabel\)/);
 assert.match(body,/hideHairType:true,hideHairVolume:true/);
 assert.match(body,/label\[for="v32HairDensity"\]/);
 assert.match(face,/sadako-ear-crown-bust-v55/);
 assert.match(body,/sadako-ear-crown-bust-v55/);
});
