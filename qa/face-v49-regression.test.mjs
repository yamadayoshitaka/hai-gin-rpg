import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BODY_PROFILES,AGE_PROFILES,AGE_BAND_IDS} from '../src/character-demographics-v47.js';
import {attachAgeDetails} from '../src/face-age-detail-v49.js';
import {makeStyleSpecificHair} from '../src/face-wig-ornaments-v49.js';
import {resolveEditedFaceControls,recordFaceManualEdit} from '../src/face-state-v49.js';
import {FACE_EXPRESSIONS,createFaceExpressionAnimator} from '../src/face-expression-animation-v48.js';
import {loadHeroineFacePreset,saveHeroineFacePreset} from '../src/heroine-face-preset-store.js';
import {loadMaleFacePreset,saveMaleFacePreset} from '../src/male-face-preset-store.js';
test('normal body is lean, fat distributes volume and eight ages stay ordered',()=>{
 assert.ok(BODY_PROFILES.thin.width<BODY_PROFILES.normal.width);
 assert.ok(BODY_PROFILES.normal.width<1.07);
 assert.ok(BODY_PROFILES.normal.depth<1.07);
 assert.ok(BODY_PROFILES.normal.abdomen<.04);
 assert.ok(BODY_PROFILES.fat.width>1.30);
 assert.ok(BODY_PROFILES.fat.depth>1.30);
 assert.ok(BODY_PROFILES.fat.abdomen>BODY_PROFILES.normal.abdomen*10);
 assert.equal(AGE_BAND_IDS.length,8);
 const old=['forties','sixties','seventies','eightyPlus'].map(id=>AGE_PROFILES[id].wrinkles);
 for(let i=1;i<old.length;i++)assert.ok(old[i]>old[i-1]);
});
test('80+ face produces actual surface-fitted 3D creases; 20s stays smooth',()=>{
 const bounds=new THREE.Mesh(new THREE.SphereGeometry(1,32,28),
  new THREE.MeshStandardMaterial());
 const young=attachAgeDetails(bounds,'twenties');
 assert.equal(young.count,0);
 const old=attachAgeDetails(bounds,'eightyPlus');
 assert.ok(old.count>=12);
 assert.ok(old.vertices>400);
 const actual=[];bounds.traverse(o=>{if(o.name.startsWith('V49_AGE_'))actual.push(o)});
 assert.equal(actual.length,old.count);
 for(const crease of actual){
  assert.ok(crease.isMesh&&crease.geometry.getAttribute('position').count>20);
  assert.equal(crease.userData.realFaceSurfaceAttached,true);
 }
});
test('haircut name is backed by nonempty distinct 3D bun, braid, ponytail geometry',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.13,-.25,-.12),
  new THREE.Vector3(.13,.26,.12));
 const names=[
  ['female-low-bun','coiled-low-bun'],
  ['female-twin-braids','two-interwoven-plaits'],
  ['female-side-ponytail','side-ponytail'],
  ['female-half-up','half-up'],['male-long-tied','low-tied-men']
 ];
 for(const [id,type] of names){
  const built=makeStyleSpecificHair(id,box,new THREE.Color('#a7c4cf'));
  assert.equal(built.type,type);
  assert.ok(built.meshes.length>=2);
  assert.ok(built.triangleCount>150);
  assert.ok(built.meshes.every(mesh=>mesh.userData.hairStyleId===id));
  assert.ok(built.meshes.some(mesh=>mesh.geometry.getAttribute('position').count>60));
  for(const mesh of built.meshes){mesh.geometry.dispose();mesh.material.dispose();}
 }
 assert.equal(makeStyleSpecificHair('natural-short',box,0x343434).type,'none');
});
test('ten facial expressions are valid and include laugh, shout, anger and sadness',()=>{
 assert.equal(Object.keys(FACE_EXPRESSIONS).length,10);
 assert.ok(FACE_EXPRESSIONS.shout.open>.9);
 assert.ok(FACE_EXPRESSIONS.laugh.smile>.8);
 assert.ok(FACE_EXPRESSIONS.angry.brow<0);
 assert.ok(FACE_EXPRESSIONS.sad.smile<0);
 assert.notDeepEqual(FACE_EXPRESSIONS.neutral,FACE_EXPRESSIONS.smile);
});
test('manual changes survive all age/build swaps and do not compound',()=>{
 const base={eyeWidth:1.12,eyeHeight:1.15,eyeDepth:.08,
  jawSharpness:4.2,browThickness:1.1,faceMorph:0};
 for(const gender of ['female','male']){
  const manual={};recordFaceManualEdit(manual,'eyeWidth',1.33);
  recordFaceManualEdit(manual,'jawSharpness',6.3);
  const prior=JSON.stringify(manual);
  const young=resolveEditedFaceControls(gender,base,'twenties','normal',manual);
  const aged=resolveEditedFaceControls(gender,base,'eightyPlus','fat',manual);
  const reset=resolveEditedFaceControls(gender,base,'twenties','normal',manual);
  assert.equal(young.eyeWidth,1.33);
  assert.equal(aged.eyeWidth,1.33);
  assert.equal(aged.ageBand,'eightyPlus');
  assert.equal(aged.bodyType,'fat');
  assert.deepEqual(young,reset);
  assert.equal(JSON.stringify(manual),prior);
  assert.ok(aged.eyeHeight<young.eyeHeight);
  const chosen=resolveEditedFaceControls(gender,base,'twenties','normal',manual,true);
  assert.notEqual(chosen.eyeWidth,1.33,'picking a complete face clears obsolete sliders');
 }
});
test('save/load preserves user override independently for male and female',()=>{
 const values=new Map(),storage={
  getItem(key){return values.get(key)||null;},
  setItem(key,val){values.set(key,val);}
 };
 assert.equal(saveHeroineFacePreset({parts:{hair:1},controls:{eyeWidth:1.23},
  hairStyleId:'fringe-long',manualOverrides:{eyeWidth:1.23}},storage),true);
 assert.equal(saveMaleFacePreset({parts:{hair:1},controls:{eyeWidth:1.18},
  hairStyleId:'male-comma',manualOverrides:{eyeWidth:1.18}},storage),true);
 assert.equal(loadHeroineFacePreset(storage).manualOverrides.eyeWidth,1.23);
 assert.equal(loadMaleFacePreset(storage).manualOverrides.eyeWidth,1.18);
});
