import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {v110InitialFemaleFaceState} from '../src/face-initial-preview-v110.js';
import {defaultPartSelection,resolvePartSelection} from '../src/face-part-catalog-v32.js';
import {resolveEditedFaceControls} from '../src/face-state-v49.js';
import {v106FaceZone,refineV106CheekMouthTopology}
 from '../src/face-v106-local-retopo.js';

const saved=(body='ultraThin',explicit=false)=>({
 version:40,bodySelectionExplicit:explicit,parts:{
 ...defaultPartSelection(),bodyType:body
 },controls:{ageBand:'twenties',bodyType:body,faceMorph:-.42},
 manualOverrides:{},hairStyleId:'rb-f-long',hairColor:'blonde'
});

test('v110 first paint is the user-approved rightmost/first screenshot: twenties normal with color not wire',()=>{
 const initial=v110InitialFemaleFaceState({
  savedPreset:saved(),parts:saved().parts,controls:saved().controls
 });
 assert.equal(initial.parts.ageBand,'twenties');
 assert.equal(initial.parts.bodyType,'normal');
 assert.equal(initial.migratedLegacyBody,true);
 assert.equal(initial.shouldRecompose,true);
 assert.equal(initial.defaultView,'color');
 assert.equal(initial.defaultWireframe,false);
 const selection=resolvePartSelection('female',initial.parts);
 const initialControls=resolveEditedFaceControls('female',selection.controls,
  initial.parts.ageBand,initial.parts.bodyType,{},false);
 const clickNormal=resolveEditedFaceControls('female',
  resolvePartSelection('female',{...saved().parts,bodyType:'normal'}).controls,
  'twenties','normal',{},false);
 assert.deepEqual(initialControls,clickNormal,
  'Reload and selecting 普通 must yield identical geometry control values');
});
test('v110 brand-new default initial face is identical to picking normal again',()=>{
 const parts=defaultPartSelection();
 const init=v110InitialFemaleFaceState({parts,controls:{ageBand:'twenties',bodyType:'normal'}});
 assert.equal(init.shouldRecompose,true,
  'Raw part defaults are not yet transformed by demographics');
 assert.equal(init.parts.bodyType,'normal');
 const expected=resolveEditedFaceControls('female',
  resolvePartSelection('female',parts).controls,'twenties','normal',{},false);
 const initial=resolveEditedFaceControls('female',
  resolvePartSelection('female',init.parts).controls,
  init.parts.ageBand,init.parts.bodyType,{},false);
 assert.deepEqual(initial,expected);
});
test('v110 explicit later ultra-thin selection is not silently discarded on subsequent visits',()=>{
 const custom=saved('ultraThin',true);
 const initial=v110InitialFemaleFaceState({
  savedPreset:custom,parts:custom.parts,controls:custom.controls
 });
 assert.equal(initial.parts.bodyType,'ultraThin');
 assert.equal(initial.shouldRecompose,false);
 assert.equal(initial.explicitBodySelection,true);
 const normalSaved=saved('normal',true);
 assert.equal(v110InitialFemaleFaceState({savedPreset:normalSaved,
  parts:normalSaved.parts,controls:normalSaved.controls}).shouldRecompose,false);
});
test('v110 keeps previously stored normal and fat body choices',()=>{
 for(const body of ['normal','fat']){
  const preset=saved(body,false);
  const actual=v110InitialFemaleFaceState({
   savedPreset:preset,parts:preset.parts,controls:preset.controls
  });
  assert.equal(actual.parts.bodyType,body);
  assert.equal(actual.migratedLegacyBody,false);
  assert.equal(actual.shouldRecompose,true);
 }
});
test('v110 automatically saved legacy normal keeps user hair and face edits',()=>{
 const parts={...defaultPartSelection(),bodyType:'ultraThin',
  hairColor:'silver',hairVolume:'full',face:7,eye:2};
 const state=v110InitialFemaleFaceState({
  savedPreset:saved(),parts,controls:{bodyType:'ultraThin',ageBand:'twenties'}
 });
 assert.deepEqual({...state.parts,bodyType:'ultraThin'},parts);
 assert.equal(state.parts.bodyType,'normal');
});
test('v110 pure geometry upgrade keeps oral seal/donor and makes sparse cheeks vs oral',()=>{
 const geo=new THREE.SphereGeometry(.14,72,56),original=geo.clone();
 const before=geo.getIndex().array.length/3;
 const oldPositions=geo.getAttribute('position').array.slice();
 geo.setIndex([...geo.getIndex().array,180,181,182]);
 geo.setAttribute('color',new THREE.Float32BufferAttribute(
  new Float32Array(geo.getAttribute('position').count*3).fill(.5),3));
 const face=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 face.userData.v86OralSeal={sealed:true,
  lipRing:Array.from({length:40},(_,i)=>180+i),
  outerSelectedRing:Array.from({length:30},(_,i)=>180+i),
  initialTriangleCount:before,addedTriangles:1};
 const result=refineV106CheekMouthTopology(face,{gender:'female'});
 assert.equal(result.applied,true,JSON.stringify(result));
 assert.equal(result.v110DensityProfile,'balanced-cheek-sparse-oral-detailed');
 assert.ok(result.v110BroadVertices>0&&result.v110OralVertices>0);
 assert.equal(result.v110BroadVertices+result.v110OralVertices,result.addedVertices);
 assert.ok(result.visibleVertices>result.originalVertices);
 assert.ok(result.protectedLipVertexCount>=40);
 assert.equal(face.userData.v86OralSeal.lipRing[0],180);
 assert.deepEqual(Array.from(original.getAttribute('position').array),
  Array.from(oldPositions),'Donor 3D source remains immutable');
 assert.ok(v106FaceZone({xn:.5,yn:.52,zn:.97}).cheek>.5);
 assert.ok(v106FaceZone({xn:.24,yn:.52,zn:.97}).oral>.5);
 face.geometry.dispose();face.material.dispose();original.dispose();
});
test('v110 studio binds the correct first-frame settings before loading the original GLB',()=>{
 const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const init=html.indexOf('const initialFaceV110=v110InitialFemaleFaceState(');
 const loader=html.indexOf('async function init(){');
 const startup=html.indexOf('init();frame();');
 assert.ok(init>0&&init<loader&&loader<startup);
 assert.match(html,/femaleBodySelectionExplicit=true;/);
 assert.match(html,/bodySelectionExplicit:femaleBodySelectionExplicit/);
 assert.match(html,/faceMode=initialFaceV110.defaultView;/);
 assert.match(html,/wired=initialFaceV110.defaultWireframe;/);
 assert.match(html,/20261122-v111-guarded-cheek/);
});
