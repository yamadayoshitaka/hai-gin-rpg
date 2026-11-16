import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 correctBattleFaceSkinTone,BATTLE_FACE_LIGHT_RESPONSE_VERSION,
 cranialScalpSurface
} from '../src/character-system/battle-artist-head-graft.js';
import {
 fitShieldAheadOfForearm,SHIELD_FOREARM_CLEARANCE_METERS,
 SHIELD_FOREARM_CLEARANCE_VERSION
} from '../src/character-system/shield-forearm-fit.js';
import {createHeroProductionRecipe,heroProductionActionCue}
 from '../src/hero-production-character-factory.js';

const scene=new THREE.Mesh(new THREE.SphereGeometry(.18,12,10),
 new THREE.MeshPhysicalMaterial({color:0xebc5b7,vertexColors:true}));
scene.userData.faceColorMode='color';
for(const sex of ['male','female']){
 const face=scene.clone();face.material=scene.material.clone();
 const fixed=correctBattleFaceSkinTone(face,{sex});
 assert.ok(fixed.corrected);
 assert.equal(face.material.userData.battleFaceLightResponseScale,.86);
 assert.equal(face.material.userData.battleFaceLightResponseVersion,
  BATTLE_FACE_LIGHT_RESPONSE_VERSION);
 assert.equal(fixed.skinHex,sex==='female'?'#eac9b8':'#e2bda9');
 const shader={fragmentShader:'vec3 outgoingLight = vec3(4.0);\n#include <opaque_fragment>'};
 face.material.onBeforeCompile(shader,{});
 assert.match(shader.fragmentShader,/outgoingLight \* 0\.86/);
 assert.match(shader.fragmentShader,/max\(outgoingLight - vec3\(0\.68\)/);
 assert.doesNotMatch(shader.fragmentShader,/outgoingLight \* 0\.58/);
 assert.equal(face.material.metalness,0);
 assert.ok(face.material.roughness>=.8);
 assert.equal(face.material.vertexColors,true,'creator makeup must survive');
}

// A typical Blender source has a wide neck/bust skirt. The wig MUST derive
// its hair-line from the skull, not use the shoulder-sized full face AABB.
const skull=new THREE.SphereGeometry(.12,40,28).toNonIndexed();
skull.translate(0,.19,0);
const bust=new THREE.BoxGeometry(.56,.20,.16).toNonIndexed();
bust.translate(0,-.24,0);
const a=skull.getAttribute('position'),b=bust.getAttribute('position');
const both=new Float32Array(a.array.length+b.array.length);
both.set(a.array);both.set(b.array,a.array.length);
const source=new THREE.BufferGeometry();
source.setAttribute('position',new THREE.BufferAttribute(both,3));
const model=new THREE.Mesh(source,new THREE.MeshStandardMaterial());
source.computeBoundingBox();
const before=source.boundingBox.getSize(new THREE.Vector3());
const scalp=cranialScalpSurface(model);
const after=scalp.geometry.boundingBox.getSize(new THREE.Vector3());
assert.ok(scalp.triangles>100,'real usable scalp triangles must survive');
assert.ok(after.x<before.x*.60,'shoulder width must not inflate the scalp cap');
assert.ok(after.y<before.y*.60,'long neck/bust must not drive wig length');
assert.ok(scalp.cutoffY>source.boundingBox.min.y);
assert.ok(scalp.cutoffY<scalp.upperCutoffY,'nape survives the cranial sizing cutoff');
scalp.geometry.dispose();skull.dispose();bust.dispose();source.dispose();

const elbow=new THREE.Vector3(-.25,1.15,.05),wrist=new THREE.Vector3(-.15,1,.12);
const p1=fitShieldAheadOfForearm({
 elbow,wrist,forward:new THREE.Vector3(0,0,1),sourceBackZ:-.12,
 scale:.74,blend:.48
});
assert.equal(p1.version,SHIELD_FOREARM_CLEARANCE_VERSION);
assert.ok(p1.bindSafe);
assert.ok(p1.forwardClearance>=SHIELD_FOREARM_CLEARANCE_METERS-.000001);
assert.ok(Math.abs(p1.center.x-(-.202))<.001,'original forearm XY anchor remains');
const raisedElbow=new THREE.Vector3(-.22,1.35,.20),
 raisedWrist=new THREE.Vector3(-.10,1.65,.48);
const p2=fitShieldAheadOfForearm({
 elbow:raisedElbow,wrist:raisedWrist,forward:new THREE.Vector3(0,0,1),
 sourceBackZ:-.12,scale:.74,blend:.48
});
assert.ok(p2.rearPlaneWorld>raisedWrist.z+.074,
 'during a shield guard, wrist cannot pierce back surface');
const charge=fitShieldAheadOfForearm({
 elbow:new THREE.Vector3(-.25,1.20,0),
 wrist:new THREE.Vector3(-.28,1.18,.50),
 forward:new THREE.Vector3(1,0,0),sourceBackZ:-.09,scale:.74
});
assert.ok(charge.forwardClearance>=.075-.000001,
 'turning the body preserves arm clearance in the rotated forward axis');
assert.ok(Math.abs(charge.center.z-.24)<.001,
 'rear clearance must not distort sideways arm segment position');

for(const rarity of ['N','R','UR']){
 const cue=heroProductionActionCue(createHeroProductionRecipe({
  jobId:'fighter',rarity
 }),'skill');
 assert.equal(cue.action,'punch');
 assert.ok(cue.scale>=1.22&&cue.scale<=1.65);
}
const rig=readFileSync(new URL('../src/character-system/rigged-outfit-runtime.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const fx=readFileSync(new URL('../src/character-system/action-vfx-runtime.js',import.meta.url),'utf8');
assert.match(rig,/fitShieldAheadOfForearm\(\{/);
assert.match(rig,/shieldHandBone\?\.getWorldPosition\(shieldWrist\)/);
assert.match(rig,/item\.position\.copy\(item\.parent\.worldToLocal\(fitted\.center\)\)/);
assert.match(rig,/shieldBackClearanceM=fitted\.forwardClearance/);
assert.match(rig,/shieldBackClearanceM:shield\?\.userData\.shieldBackClearanceM/);
assert.match(game,/face-wig-v6/);
assert.match(game,/STUDIO_GROOM_MIDDLE_MAX=6/);
assert.match(game,/bakeInterval=p95>33\?3800/);
assert.match(game,/quality,/);
assert.match(rig,/battleBackUnderlay=quality==='battle'\?\['torso'\]/);
const wigSource=readFileSync(new URL('../src/face-scalp-wig.js',import.meta.url),'utf8');
assert.match(wigSource,/normalLayers=clamp\(Math\.trunc\(normalLayerCount\),1,3\)/);
assert.match(game,/shieldclear1/);
assert.match(game,/vfxvisibility2/);
assert.match(fx,/kind==='punch'\?1\.08/);
console.log('PASS: natural face PBR, true cranium hair, no forearm-through-shield at guard/attack, high-visibility pooled effects');
