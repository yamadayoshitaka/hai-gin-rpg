import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {studioCoveredSkinPolicy} from '../src/character-system/rigged-outfit-runtime.js';
import {addStudioRaisedInnerCollar} from '../src/studio-unified-neck-v59.js';
import {v63WigScalpTone,v63WigLockTone} from '../src/face-scalp-wig.js';
import {v63IrisOpticalTones,updateRealFacePigment} from '../src/face-feature-meshes.js';

test('v63: opaque costume masks covered thigh/calf skin but bare anatomy remains reversible',()=>{
 const outfit=studioCoveredSkinPolicy({studioPreferSkinnedLegs:true,
  studioPreserveLegAnatomy:true,preserveBody:false});
 assert.equal(outfit.coveredSkinMasked,true);
 assert.equal(outfit.underlyingAnatomyRestorable,true);
 assert.deepEqual(outfit.preserveRegions,[]);
 assert.equal(outfit.faceNeckHandsProtected,true);
 const undressed=studioCoveredSkinPolicy({studioPreferSkinnedLegs:true,
  studioPreserveLegAnatomy:true,preserveBody:true});
 assert.equal(undressed.coveredSkinMasked,false);
 const legacy=studioCoveredSkinPolicy({studioPreferSkinnedLegs:false,
  studioPreserveLegAnatomy:true,preserveBody:false});
 assert.deepEqual(legacy.preserveRegions,['thigh','calf','foot']);
 const battle=studioCoveredSkinPolicy();
 assert.equal(battle.coveredSkinMasked,false);
 assert.deepEqual(battle.preserveRegions,[]);
});

test('v63: rooted hair pigment breaks plastic helmet and has smooth shaded ends',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.12,-.16,-.11),
  new THREE.Vector3(.12,.16,.11));
 const cap=[];
 for(let i=0;i<24;i++){
  const angle=i*Math.PI/12;
  const tone=v63WigScalpTone(Math.cos(angle)*.09,.11,Math.sin(angle)*.08,box);
  cap.push(tone);
  assert.ok(tone>=.82&&tone<=1.045);
 }
 assert.ok(Math.max(...cap)-Math.min(...cap)>.018,
  'real root shell should not be uniformly painted or metallic');
 for(let i=0;i<18;i++){
  const root=v63WigLockTone(0,i,0),mid=v63WigLockTone(.55,i,0);
  assert.ok(Number.isFinite(root)&&Number.isFinite(mid));
  assert.ok(mid-root>.015,'fiber must darken at the root, not become a fake helmet');
  assert.ok(v63WigLockTone(.55,i,3)<mid,'cross-layer fibers have shading depth');
 }
});

test('v63: curved irises keep dark outer limbal ring and high-frequency chromatic fibers',()=>{
 for(const female of [true,false]){
  const avg=r=>Array.from({length:48},(_,i)=>
   v63IrisOpticalTones(r,i*Math.PI/24,{female})[0])
   .reduce((a,b)=>a+b,0)/48;
  assert.ok(avg(.98)<avg(.52)*.72,
   'peripheral limbal ring should be substantially darker than collarette');
  const values=[];
  for(let i=0;i<48;i++){
   const rgb=v63IrisOpticalTones(.60,i*Math.PI/24,{female});
   values.push(rgb[0]);
   assert.equal(rgb.length,3);
   for(const c of rgb)assert.ok(c>=.32&&c<=1.30);
  }
  assert.ok(Math.max(...values)-Math.min(...values)>.09,
   'iris must show genuine radial-fiber variation rather than a flat color');
 }
});

test('v63: face pigment adds soft eyelid occlusion while preserving youthful non-wrinkled skin',()=>{
 const geo=new THREE.SphereGeometry(.10,48,32);
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xffffff}));
 const report=updateRealFacePigment(face,{ageBand:'twenties'},'color','female');
 assert.ok(face.geometry.getAttribute('color')?.count>100);
 assert.equal(face.userData.v63AnatomicalEyelidContactShadow,true);
 assert.ok(Number.isFinite(report.cheek));
 geo.dispose();face.material.dispose();
});


test('v63: high skinned-garment neckline still fits an inner collar after skin weld',()=>{
 const outfit=new THREE.Group();
 const sewn=new THREE.Mesh(new THREE.BoxGeometry(.12,.012,.11),
  new THREE.MeshStandardMaterial({color:0x536a7e}));
 sewn.name='sewn-neckline';sewn.position.y=1.225;outfit.add(sewn);
 const joined={applied:true,seamMinY:1.24,collarY:1.226,
  jawHalfX:.040,jawHalfZ:.036,centerX:0,centerZ:0};
 const result=addStudioRaisedInnerCollar({wardrobeRoot:outfit,joined});
 assert.equal(result.applied,true,JSON.stringify(result));
 assert.ok(result.topY-result.baseY>=.0139);
 assert.ok(result.mesh.isMesh);
 assert.equal(outfit.children.filter(x=>
  x.name==='STUDIO_RAISED_INNER_TUNIC_COLLAR_V59').length,1);
 assert.equal(sewn.geometry.getAttribute('position').count,24,
  'clothing fallback must not alter the original sewn mesh');
 result.mesh.geometry.dispose();result.mesh.material.dispose();
 sewn.geometry.dispose();sewn.material.dispose();
});
