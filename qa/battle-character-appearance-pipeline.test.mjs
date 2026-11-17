import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 correctBattleFaceSkinTone,restoreBattleFaceShaderAfterClone,
 BATTLE_FACE_LIGHT_RESPONSE_VERSION
} from '../src/character-system/battle-artist-head-graft.js';

const face=new THREE.Mesh(
 new THREE.SphereGeometry(.17,24,20),
 new THREE.MeshPhysicalMaterial({color:0xddb49e,roughness:.9})
);
face.userData.faceColorMode='color';
correctBattleFaceSkinTone(face,{sex:'female'});
assert.match(BATTLE_FACE_LIGHT_RESPONSE_VERSION,/anatomical-shadows/);
assert.ok(face.material.userData.battleFaceSculptureBounds);
assert.deepEqual(face.material.userData.battleFaceSculptureBounds.min.length,3);
assert.equal(face.material.map?.name,'battle-original-uv-warm-skin-albedo-v1');
const makeShader=()=>({
 vertexShader:'void main(){\n#include <begin_vertex>\n}',
 fragmentShader:'void main(){\nvec3 outgoingLight=vec3(1.0);\n#include <opaque_fragment>\n}',
 uniforms:{}
});
let shader=makeShader();
face.material.onBeforeCompile(shader,{});
assert.match(shader.vertexShader,/vBattleFaceLocal = position/);
assert.match(shader.fragmentShader,/eyeSocket/);
assert.match(shader.fragmentShader,/noseShade/);
assert.match(shader.fragmentShader,/lipUnderside/);
assert.match(shader.fragmentShader,/outgoingLight \* 0\.86/);
assert.equal(shader.uniforms.battleFaceMin.value.isVector3,true);
assert.equal(shader.uniforms.battleFaceInvSize.value.isVector3,true);

const gpu=face.material.clone();
assert.equal(restoreBattleFaceShaderAfterClone(face.material,gpu),true);
assert.equal(gpu.userData.battleFaceLightResponseVersion,
 BATTLE_FACE_LIGHT_RESPONSE_VERSION);
shader=makeShader();
gpu.onBeforeCompile(shader,{});
assert.match(shader.fragmentShader,/eyeSocket/,'GPU cloned face is identical to studio face');
assert.ok(shader.uniforms.battleFaceInvSize.value.x>0);
const plain=new THREE.MeshStandardMaterial();
assert.equal(restoreBattleFaceShaderAfterClone(plain,plain.clone()),false);

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const battle=read('tactics-wireframe.html');
const mass=read('src/mass-battle-real-army.js');
const rig=read('src/character-system/rigged-outfit-runtime.js');
assert.match(rig,/const closedBackContract=Boolean\(closedBack\?\.isSkinnedMesh/);
assert.match(rig,/forceCoveredRegions=closedBackContract\?\['torso'\]:\[\]/);
assert.doesNotMatch(rig,/const battleBackUnderlay=/,
 'Source skin may not punch through a complete back vest');
assert.match(mass,/restoreBattleFaceShaderAfterClone\(originals\[i\],m\)/);
assert.match(mass,/authoredCompile\(shader\)/,'Never erase studio PBR face shading');
assert.match(mass,/const authoredProgramKey=material\.customProgramCacheKey\.bind\(material\)/);
assert.match(mass,/garmentClosedBack:!!representative\.outfit\?\.diagnostics\?\.closedBackContract/);
assert.match(mass,/sourceFaceGLB:representative\.masterHead\?\.sourceAsset/);
assert.match(battle,/async function prewarmMassBattleStudioHair\(\)/);
assert.match(battle,/await prewarmMassBattleStudioHair\(\);\s*await prepareMassRenderer\(\);/,
 'The 1000 model must inherit the proper hair BEFORE GPU snapshot');
assert.match(battle,/a\.outfit\.setHairVisible\(false\)/);
assert.match(battle,/a\.outfit\.setHairVisible\(true\); \/\/ do not bake a bald soldier/);
assert.match(battle,/getBattleCharacterPipelineQA=/);
console.log('PASS: source-sculpted face PBR, real back cover, full hair in GPU and game provenance');
