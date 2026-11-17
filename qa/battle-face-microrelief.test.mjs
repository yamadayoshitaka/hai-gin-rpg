import assert from 'node:assert/strict';
import * as THREE from 'three';
import {correctBattleFaceSkinTone,getBattleSkinAlbedoTexture,
 getBattleSkinMicroNormalTexture} from '../src/character-system/battle-artist-head-graft.js';
const geometry=new THREE.SphereGeometry(1,24,16);
const face=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({color:0xebc5b7,roughness:.7}));
face.userData.faceColorMode='color';
const r=correctBattleFaceSkinTone(face,{sex:'female',skinToneHex:'#d8b49f'});
assert.equal(r.skinHex,'#d8b49f');
assert.equal(face.material.map,getBattleSkinAlbedoTexture());
assert.equal(face.material.normalMap,getBattleSkinMicroNormalTexture());
assert.equal(face.material.normalMap.image.width,128);
assert.equal(face.material.normalMap.image.height,128);
assert.ok(face.material.normalScale.x<=.25,'Micro normal must not create glitter or harsh pore shadows');
assert.ok(face.material.roughness>=.8,'Skin is neither shiny porcelain nor metal');
assert.equal(face.material.normalMap,getBattleSkinMicroNormalTexture(),
 'No texture allocation per character');
assert.equal(correctBattleFaceSkinTone(face,{sex:'female',skinToneHex:'#ffffff'}).skinHex,
 '#d8b49f','LOD/reconfigure must not bleach the chosen complexion');
const bad=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xeeeeee}));
bad.userData.faceColorMode='color';
assert.equal(correctBattleFaceSkinTone(bad,{skinToneHex:'not-a-color'}).skinHex,'#e2bda9');
console.log('PASS: warm skin PBR, shared 128px microrelief, subtle normalScale, stable author pigment');
