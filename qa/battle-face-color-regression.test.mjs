import assert from 'node:assert/strict';
import * as THREE from 'three';
import {correctBattleFaceSkinTone,BATTLE_FACE_SKIN_TONE_VERSION,
 BATTLE_FACE_LIGHT_RESPONSE_VERSION,getBattleSkinAlbedoTexture}
 from '../src/character-system/battle-artist-head-graft.js';
import {readFileSync} from 'node:fs';

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
 assert.equal(face.material.map,getBattleSkinAlbedoTexture(),
  'All 100 battle faces share one UV-based skin detail atlas');
 assert.equal(face.material.map.colorSpace,THREE.SRGBColorSpace);
 assert.equal(face.material.map.image.width,256);
 assert.equal(face.material.map.image.height,256);
 assert.equal(face.material.userData.battleFaceLightResponseVersion,
  BATTLE_FACE_LIGHT_RESPONSE_VERSION);
 assert.equal(face.material.userData.battleFaceLightResponseScale,.58);
 const shader={fragmentShader:'vec3 outgoingLight=vec3(4.0);\\n#include <opaque_fragment>'};
 face.material.onBeforeCompile(shader,{});
 assert.match(shader.fragmentShader,
  /outgoingLight = \\(outgoingLight \\* 0\\.58\\) \\/ \\(vec3\\(1\\.0\\)/,
  'Real PBR fragment must dim reflected battlefield light, not only set color');
 assert.ok(shader.fragmentShader.includes('\\n#include <opaque_fragment>'),
  'Shader injects a legal GLSL newline');
 assert.doesNotMatch(shader.fragmentShader,/\\\\n#include/,
  'Do not emit a raw backslash-n token into GLSL shader code');

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
// Verify the MASTER source rather than assuming it already has photographic
// skin textures. Prior tests only checked CSS/material hex and missed whitewash.
const master=readFileSync(new URL('../assets/master-sources/blender/realistic-head-animation.glb',import.meta.url));
assert.equal(master.toString('ascii',0,4),'glTF');
const jsonLength=master.readUInt32LE(12),json=JSON.parse(master.toString('utf8',20,20+jsonLength));
const mainMesh=json.meshes.find(m=>/head_animation_realistic\\.001/.test(m.name));
assert.ok(mainMesh?.primitives[0]?.attributes?.TEXCOORD_0!==undefined,
 'Real head must retain original UVs for skin albedo');
const masterSkin=json.materials[mainMesh.primitives[0].material];
assert.equal(masterSkin.pbrMetallicRoughness.baseColorTexture,undefined,
 'Master head is an untextured source; combat must not claim a photographic face map');
console.log('PASS: 100 heads share one UV albedo, face shader actually attenuates PBR light, eyes stay distinct; source geometry is untextured');
