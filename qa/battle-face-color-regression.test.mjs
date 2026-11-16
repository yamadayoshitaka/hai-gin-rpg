import assert from 'node:assert/strict';
import * as THREE from 'three';
import {correctBattleFaceSkinTone,BATTLE_FACE_SKIN_TONE_VERSION}
 from '../src/character-system/battle-artist-head-graft.js';

function faceFixture(sex='male'){
 const face=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),
  new THREE.MeshPhysicalMaterial({color:0xebc5b7,roughness:.74,clearcoat:.035,
   vertexColors:true}));
 face.userData.faceColorMode='color';
 face.name=sex.toUpperCase()+'_INDEPENDENT_CLAY_FACE';
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),
  new THREE.MeshStandardMaterial({color:0x514139}));
 eye.userData.colorRole='iris';
 const lid=new THREE.Mesh(new THREE.BoxGeometry(.08,.01,.03),
  new THREE.MeshStandardMaterial({color:0xebc5b7}));
 lid.userData.colorRole='eyelid';
 face.add(eye,lid);
 return {face,eye,lid};
}
for(const sex of ['male','female']){
 const {face,eye,lid}=faceFixture(sex);
 const eyeBefore=eye.material.color.getHex();
 const first=correctBattleFaceSkinTone(face,{sex});
 assert.equal(first.corrected,true);
 assert.ok(first.skinHex===face.userData.battleSkinToneHex);
 assert.equal(face.userData.battleSkinToneVersion,BATTLE_FACE_SKIN_TONE_VERSION);
 assert.ok(face.material.color.getHex()!==(0xebc5b7),'battle face cannot remain clay-pale');
 assert.equal(lid.material.color.getHex(),face.material.color.getHex(),
  'eyelids must join the corrected cheek tone');
 assert.equal(eye.material.color.getHex(),eyeBefore,'iris colour must remain creator-controlled');
 assert.equal(face.material.metalness,0);
 assert.ok(face.material.roughness>=.80,'skin cannot resemble glossy porcelain');
 assert.ok(face.material.clearcoat<=.015);
 assert.equal(face.material.vertexColors,true,'sculpted cheek/lip pigments survive');
 assert.equal(face.material.toneMapped,true);
 assert.equal(correctBattleFaceSkinTone(face,{sex}).skinHex,first.skinHex,
  'LOD/refresh calls cannot change skin tone');
}
const {face:textured}=faceFixture();
const photo=new THREE.Texture();
textured.material.map=photo;
const snapshot=textured.material.color.getHex();
assert.equal(correctBattleFaceSkinTone(textured).corrected,false);
assert.equal(textured.material.map,photo,'real skin texture must never be replaced');
assert.equal(textured.material.color.getHex(),snapshot);
const {face:clay}=faceFixture();
clay.userData.faceColorMode='clay';
assert.throws(()=>correctBattleFaceSkinTone(clay),/colorized/);
console.log('PASS: battle faces have warm anti-whitewash PBR, matching eyelids, preserved irises and photo textures');
