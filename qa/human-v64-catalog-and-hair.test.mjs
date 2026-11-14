import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FACE_CATALOG_V64,HAIR_CATALOG_V64,EXPRESSION_CATALOG_V64,
 CHARACTER_CATALOG_V64,catalogValidationV64,catalogStudioUrlV64,
 resolveCatalogFaceV64} from '../src/character-face-catalog-v64.js';
import {HERO_FACE_PRESETS,chooseHeroFacePreset} from '../src/hero-face-presets-v45.js';
import {FACE_EXPRESSIONS} from '../src/face-expression-animation-v48.js';
import {makeStyleSpecificHair,resolveTiedHairScalpAnchor}
 from '../src/face-wig-ornaments-v49.js';
import {AGE_PROFILES} from '../src/character-demographics-v47.js';

test('v64: no ghost face types; 16 actual complete faces per gender, legacy 01-10 stable',()=>{
 assert.deepEqual(catalogValidationV64(),[]);
 for(const gender of ['female','male']){
  const entries=FACE_CATALOG_V64[gender];
  assert.equal(entries.length,16);
  assert.equal(HERO_FACE_PRESETS[gender].length,16);
  assert.equal(new Set(entries.map(e=>e.id)).size,16);
  for(let i=0;i<16;i++){
   const entry=entries[i];
   assert.equal(entry.facePresetIndex,i);
   assert.equal(entry.id,gender+'-face-'+String(i+1).padStart(2,'0'));
   const applied=chooseHeroFacePreset(gender,i,{hair:5,face:0});
   assert.equal(applied.face,HERO_FACE_PRESETS[gender][i].face);
   assert.equal(applied.hair,5,'face selection must not reset chosen hairstyle');
   assert.ok(Object.values(entry.parts).every(x=>typeof x==='string'&&x!=='未定義'));
  }
 }
});
test('v64: 22 real expression vectors, finite and unique, preserve original ten',()=>{
 assert.equal(EXPRESSION_CATALOG_V64.length,22);
 assert.equal(Object.keys(FACE_EXPRESSIONS).length,22);
 assert.equal(new Set(EXPRESSION_CATALOG_V64.map(x=>x.parameterSignature)).size,22);
 for(const entry of EXPRESSION_CATALOG_V64)
  for(const v of Object.values(entry.features))
   assert.ok(Number.isFinite(v)&&Math.abs(v)<=1,entry.id);
 for(const x of ['neutral','softSmile','smile','laugh','angry','shout',
  'sad','surprised','troubled','serious','tearful','determined','sleepy'])
  assert.ok(FACE_EXPRESSIONS[x]);
});
test('v64: canon characters resolve to real face and hair presets',()=>{
 assert.ok(CHARACTER_CATALOG_V64.length>=14);
 for(const c of CHARACTER_CATALOG_V64){
  assert.ok(resolveCatalogFaceV64(c.gender,c.faceTypeId));
  assert.ok(HAIR_CATALOG_V64[c.gender].some(x=>x.id===c.hairStyleId));
 }
});
test('v64: catalog direct links preserve gender, face choice, hairstyle, emotion and view',()=>{
 const u=new URL(catalogStudioUrlV64({gender:'male',faceIndex:15,
  hairStyleId:'male-comma',expression:'determined',view:'side',
  characterId:'commander-male'}),'https://example.test/');
 assert.equal(u.pathname,'/face-mesh-studio.html');
 for(const [k,v] of Object.entries({gender:'male',facePreset:'15',
  hair:'male-comma',expression:'determined',view:'side',
  character:'commander-male'}))assert.equal(u.searchParams.get(k),v);
});
test('v64: side ponytail root is measured from REAL donor scalp, not detached bounding-box stalk',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,1,.5));
 const samples=[];
 for(let i=0;i<48;i++){
  const ang=2*Math.PI*i/48;
  samples.push({p:new THREE.Vector3(.42*Math.cos(ang),.75,.35*Math.sin(ang)-.04)});
 }
 const anchor=resolveTiedHairScalpAnchor(box,-1,samples);
 assert.equal(anchor.source,'real-scalp-vertex');
 const hair=makeStyleSpecificHair('female-side-ponytail',box,new THREE.Color(0x874a3d),
  {scalpCandidates:samples});
 assert.equal(hair.type,'side-ponytail');
 const root=hair.meshes.find(x=>x.name==='PONYTAIL_TIED_ROOT');
 assert.ok(root?.userData?.v64ScalpAnchored);
 assert.equal(root.userData.v64AnchorSource,'real-scalp-vertex');
 assert.ok(root.userData.v64AnchorDistance<.009);
 assert.equal(hair.meshes.filter(x=>x.name.startsWith('PONYTAIL_SCALP_FEED')).length,7);
 assert.equal(hair.meshes.filter(x=>x.name.startsWith('PONYTAIL_FALLING_LOCK')).length,14);
 const center=root.geometry.boundingBox||root.geometry.computeBoundingBox()||root.geometry.boundingBox;
 assert.ok(root.geometry.boundingBox.getCenter(new THREE.Vector3())
  .distanceTo(anchor.position)<.025);
 for(const m of hair.meshes){
  assert.ok(m.geometry.getAttribute('position').count>100);
  const positions=m.geometry.getAttribute('position').array;
  assert.ok([...positions].every(Number.isFinite),m.name);
  m.geometry.dispose();m.material.dispose();
 }
});
test('v64: 20s remain strictly wrinkle-free, older age sculpt can retain detail',()=>{
 assert.equal(AGE_PROFILES.under10.wrinkles,0);
 assert.equal(AGE_PROFILES.teens.wrinkles,0);
 assert.equal(AGE_PROFILES.twenties.wrinkles,0);
 assert.ok(AGE_PROFILES.sixties.wrinkles>AGE_PROFILES.forties.wrinkles);
});
