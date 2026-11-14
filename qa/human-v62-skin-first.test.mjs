import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {measureStudioBareTorsoNeck} from '../src/studio-unified-neck-v59.js';
import {alignStudioHeadToSkinnedTorso,fitStudioNeckContinuity,studioNapeRiseForBodies}
 from '../src/heroine-battle-costume-bridge.js';

test('v62: sex from naked SuperHero body is identical to Ranger donor sex',()=>{
 assert.equal(studioNapeRiseForBodies([{name:'SuperHero_Male'}]),.018);
 assert.equal(studioNapeRiseForBodies([{name:'Male_Ranger_Body'}]),.018);
 assert.equal(studioNapeRiseForBodies([{name:'Male_Peasant_Body'}]),.018);
 assert.equal(studioNapeRiseForBodies([{name:'SuperHero_Female'}]),.012);
 assert.equal(studioNapeRiseForBodies([{name:'Female_Ranger_Body'}]),.012);
 assert.equal(studioNapeRiseForBodies([{name:'Female_Peasant_Body'}]),.012);
 assert.equal(studioNapeRiseForBodies([{name:'SuperHero_Male'},{name:'Male_Ranger_Body'}]),.018);
});

// Regression contract: anatomy is fitted to genuine skinned torso vertices
// BEFORE any clothing. The real skin and donor face source stay untouched.
for(const sex of ['Female','Male']){
 test('v62 '+sex+': body cut / face cut / skin weld precede garment fitting',()=>{
  const root=new THREE.Group(),head=new THREE.Group(),skin=new THREE.Group(),
   clothing=new THREE.Group();
  root.add(head,skin,clothing);
  const source=new THREE.SphereGeometry(.11,52,36);
  source.scale(1,1.2,.9);
  const n=source.getAttribute('position').count,colors=new Float32Array(n*3);
  for(let i=0;i<n*3;i+=3){colors[i]=.94;colors[i+1]=.86;colors[i+2]=.84;}
  source.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const face=new THREE.Mesh(source,new THREE.MeshPhysicalMaterial({
   color:0xeac0b5,vertexColors:true,roughness:.75}));
  face.position.y=1.13;head.add(face);
  const torsoSource=new THREE.BoxGeometry(.32,.50,.23,16,16,12);
  const originalTorso=torsoSource.getAttribute('position').array.slice();
  const torso=new THREE.SkinnedMesh(torsoSource,new THREE.MeshStandardMaterial());
  torso.name=sex+'_Ranger_Body';torso.position.y=.98;skin.add(torso);
  const collar=new THREE.Mesh(new THREE.BoxGeometry(.12,.012,.11),
   new THREE.MeshStandardMaterial());
  collar.name='sewn-neckline';collar.position.y=1.17;clothing.add(collar);
  root.updateWorldMatrix(true,true);
  const body=measureStudioBareTorsoNeck(skin);
  assert.equal(body.applied,true,JSON.stringify(body));
  assert.equal(body.source,'posed-real-skinned-torso');
  assert.ok(body.ringSamples>=12);
  assert.ok(body.halfWidth>.025);
  assert.ok(body.halfDepth>=.024);
  const aligned=alignStudioHeadToSkinnedTorso({
   faceRoot:head,faceMesh:face,wardrobeRoot:skin});
  assert.equal(aligned.applied,true);
  const report=fitStudioNeckContinuity({
   faceRoot:head,faceMesh:face,wardrobeRoot:skin,garmentRoot:clothing});
  assert.equal(report.unifiedSkinNeckApplied,true,JSON.stringify(report));
  assert.equal(report.v62SkinFirst,true);
  assert.equal(report.v62ClothingFittedAfterSkin,true);
  assert.ok(report.v62SkinToTorsoOverlap>=.012);
  assert.ok(report.v62BareBodyNeckSamples>=12);
  assert.equal(report.v62BareBodyNeckSource,torso.name);
  assert.ok(report.raisedInnerCollarApplied);
  assert.ok(report.unifiedNeckBottomHeight<body.topY);
  assert.equal(report.originalFaceGeometryImmutable,true);
  assert.deepEqual(torsoSource.getAttribute('position').array,originalTorso);
  const geometryCount=face.geometry.getAttribute('position').count;
  clothing.visible=false;
  assert.equal(face.visible,true,'bare skin remains visible without garment');
  assert.equal(face.geometry.userData.studioUnifiedNeck,true);
  assert.equal(clothing.visible,false);
  clothing.visible=true;
  const again=fitStudioNeckContinuity({
   faceRoot:head,faceMesh:face,wardrobeRoot:skin,garmentRoot:clothing});
  assert.equal(again.v62SkinFirst,true);
  assert.equal(face.geometry.getAttribute('position').count,geometryCount,
   'repeated dressing must not duplicate neck meshes');
  assert.equal(clothing.children.filter(m=>
   m.name==='STUDIO_RAISED_INNER_TUNIC_COLLAR_V59').length,1);
  torsoSource.dispose();face.geometry.dispose();source.dispose();
  face.material.dispose();torso.material.dispose();collar.geometry.dispose();
  collar.material.dispose();
 });
}
