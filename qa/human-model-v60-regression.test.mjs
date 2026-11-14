import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import * as THREE from 'three';
import {BODY_PROFILES,BODY_TYPE_IDS,resolveBodyType,enumerateDemographics}
 from '../src/character-demographics-v47.js';
import {applySkinnedBuildMorph} from '../src/body-build-morph-v48.js';
import {HEROINE_FACE_STUDIO_KEY,loadHeroineFacePreset,saveHeroineFacePreset}
 from '../src/heroine-face-preset-store.js';
import {MALE_FACE_STUDIO_KEY,loadMaleFacePreset,saveMaleFacePreset}
 from '../src/male-face-preset-store.js';
import {addStudioRaisedInnerCollar} from '../src/studio-unified-neck-v59.js';
import {clipStudioFaceBustPreservingSurface} from '../src/studio-face-quality-v56.js';

test('v60: old thin is exactly ultraThin, new thin lies strictly between it and normal',()=>{
 assert.deepEqual(BODY_TYPE_IDS,['ultraThin','thin','normal','fat']);
 const old={width:.90,depth:.90,faceFullness:-.75,neckWidth:.93,abdomen:-.075,legRadius:.89};
 for(const [key,value] of Object.entries(old))assert.equal(BODY_PROFILES.ultraThin[key],value,key);
 for(const key of ['width','depth','faceFullness','neckWidth','abdomen','legRadius']){
  assert.ok(BODY_PROFILES.ultraThin[key]<BODY_PROFILES.thin[key],key+' ultra -> thin');
  assert.ok(BODY_PROFILES.thin[key]<BODY_PROFILES.normal[key],key+' thin -> normal');
 }
 assert.equal(resolveBodyType('slim').id,'ultraThin');
 assert.equal(resolveBodyType('child').id,'ultraThin');
 assert.equal(resolveBodyType('thin').id,'thin');
 assert.equal(resolveBodyType('normal').id,'normal');
 assert.equal(resolveBodyType('fat').id,'fat');
 assert.equal(enumerateDemographics().length,64);
});

test('v60: legacy heroine and male thin saves migrate once; v60 thin remains thin',()=>{
 for(const {key,version,load,save} of [
  {key:HEROINE_FACE_STUDIO_KEY,version:40,load:loadHeroineFacePreset,save:saveHeroineFacePreset},
  {key:MALE_FACE_STUDIO_KEY,version:42,load:loadMaleFacePreset,save:saveMaleFacePreset}
 ]){
  const disk=new Map();
  const storage={
   getItem:k=>disk.get(k)??null,
   setItem:(k,v)=>disk.set(k,v)
  };
  const before={version,parts:{bodyType:'thin',hair:7,hairColor:'blonde'},
   controls:{eyeHeight:1.24,eyeWidth:1.16},hairStyleId:'fringe-long'};
  storage.setItem(key,JSON.stringify(before));
  const migrated=load(storage);
  assert.equal(migrated.parts.bodyType,'ultraThin');
  assert.deepEqual(migrated.controls,before.controls);
  assert.equal(migrated.parts.hair,7);
  assert.equal(JSON.parse(storage.getItem(key)).parts.bodyType,'thin',
   'reading cannot mutate original stored JSON before user saves');
  assert.equal(save(migrated,storage),true);
  const persisted=JSON.parse(storage.getItem(key));
  assert.equal(persisted.bodyPresetVersion,60);
  assert.equal(load(storage).parts.bodyType,'ultraThin');
  assert.equal(save({...migrated,parts:{...migrated.parts,bodyType:'thin'}},storage),true);
  assert.equal(load(storage).parts.bodyType,'thin',
   'deliberately selected NEW thin must not be remigrated on reload');
 }
});

test('v60: real skinned arms and legs are re-created from bind pose, never cumulative',()=>{
 for(const sex of ['Female','Male']){
  const actor=new THREE.Group();
  for(const [part,geometry] of [
   ['Arms',new THREE.BoxGeometry(.6,.8,.4,4,8,4)],
   ['Legs',new THREE.BoxGeometry(.7,.9,.4,4,8,4)],
   ['Body',new THREE.BoxGeometry(.8,1,.5,4,8,4)]
  ]){
   const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());
   mesh.name=sex+'_Ranger_'+part;actor.add(mesh);
  }
  const originals=actor.children.map(m=>({
   geometry:m.geometry,vertices:m.geometry.getAttribute('position').array.slice()
  }));
  const snapshots={};
  for(const id of ['ultraThin','thin','normal','fat']){
   const report=applySkinnedBuildMorph(actor,id);
   assert.equal(report.bodyType,id);
   assert.equal(report.meshes,3);
   assert.equal(report.accumulative,false);
   snapshots[id]=actor.children.map(m=>m.geometry.getAttribute('position').array.slice());
  }
  applySkinnedBuildMorph(actor,'ultraThin');
  for(let i=0;i<actor.children.length;i++){
   const mesh=actor.children[i];
   assert.deepEqual(mesh.geometry.getAttribute('position').array,snapshots.ultraThin[i]);
   assert.deepEqual(originals[i].geometry.getAttribute('position').array,originals[i].vertices);
  }
  assert.notDeepEqual(snapshots.ultraThin[1],snapshots.normal[1],
   'legs must show different geometry');
  assert.notDeepEqual(snapshots.thin[0],snapshots.normal[0],
   'new slim arms must show an intermediate silhouette');
  for(let i=0;i<actor.children.length;i++){
   actor.children[i].geometry.dispose();actor.children[i].material.dispose();
   originals[i].geometry.dispose();
  }
 }
});

test('v60: cloth collar hides 18 percent more skin while retaining welded v59 face',()=>{
 const wardrobe=new THREE.Group();
 const sourceFace=new THREE.Mesh(new THREE.SphereGeometry(.11,8,8),
  new THREE.MeshStandardMaterial({color:0xe9b6aa}));
 const facePositions=sourceFace.geometry.getAttribute('position').array.slice();
 const joined={applied:true,seamMinY:1.25,collarY:1.15,
  jawHalfX:.045,jawHalfZ:.041,centerX:0,centerZ:0};
 const report=addStudioRaisedInnerCollar({wardrobeRoot:wardrobe,joined});
 assert.equal(report.applied,true);
 assert.ok(Math.abs(report.visibleSkinLength-.029*.82)<1e-8);
 assert.ok(report.visibleSkinLength<.029*.85);
 assert.ok(report.topY>report.baseY);
 assert.equal(report.mesh.parent,wardrobe);
 assert.equal(report.mesh.userData.notPartOfFace,true);
 assert.equal(sourceFace.geometry.getAttribute('position').array.length,facePositions.length);
 assert.deepEqual(sourceFace.geometry.getAttribute('position').array,facePositions);
 report.mesh.geometry.dispose();report.mesh.material.dispose();
 sourceFace.geometry.dispose();sourceFace.material.dispose();
});

test('v60: raised nape cutoff changes only disposable low rear-bust mesh',()=>{
 const source=new THREE.SphereGeometry(.11,36,24);
 const face=new THREE.Mesh(source,new THREE.MeshStandardMaterial());
 const untouched=source.getAttribute('position').array.slice();
 const plain=clipStudioFaceBustPreservingSurface(face,-.05,{anatomicalCurve:true});
 const raised=clipStudioFaceBustPreservingSurface(face,-.05,{anatomicalCurve:true,backRise:.018});
 assert.equal(plain.anatomicalSeamProfile.backRise,.006);
 assert.equal(raised.anatomicalSeamProfile.backRise,.018);
 assert.ok(raised.removedTriangles>=plain.removedTriangles);
 assert.deepEqual(source.getAttribute('position').array,untouched);
 assert.equal(raised.sourceNormalsPreserved,true);
 face.geometry.dispose();raised.geometry.dispose();plain.geometry.dispose();
});

test('v60: both body studios and face editor offer one shared four-build contract',()=>{
 for(const file of ['face-body-studio.html','male-body-studio.html','face-mesh-studio.html']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(source.includes('v47BodyType'),file);
  assert.ok(source.includes('超痩せ型'),file);
  assert.ok(source.includes('character-demographics-v47.js?v=60'),file);
 }
 for(const file of ['face-body-studio.html','male-body-studio.html']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(source.includes('setQAView:'),file);
  assert.ok(source.includes('threeQuarterLeft'),file);
  assert.ok(source.includes('threeQuarterRight'),file);
  assert.ok(source.includes('heroine-battle-costume-bridge.js?v=60'),file);
 }
});

test('v60: inline browser ESM in all three studios is syntactically valid',()=>{
 for(const file of ['face-body-studio.html','male-body-studio.html','face-mesh-studio.html']){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const match=html.match(/<script\s+type="module">([\s\S]*?)<\/script>/);
  assert.ok(match,'studio module script exists: '+file);
  const parsed=spawnSync(process.execPath,['--check','--input-type=module'],{
   encoding:'utf8',input:match[1]
  });
  assert.equal(parsed.status,0,file+': '+parsed.stderr);
 }
});
