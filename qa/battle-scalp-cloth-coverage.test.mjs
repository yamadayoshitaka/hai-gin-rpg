import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 shouldClothLineBattleTorso,applyBattleTorsoLining
} from '../src/character-system/battle-torso-lining.js';

// Only the source chest/back skin material is retextured. Never paint the
// user's real hands, neck, exposed arms, head or the whole body rig as cloth.
for(const meshName of ['Male_Ranger_Body','Female_Ranger_Body_001','Male_Peasant_Body']){
 assert.equal(shouldClothLineBattleTorso({
  quality:'battle',meshName,materialName:'MI_Regular_01',role:'skin'
 }),true,meshName);
}
for(const [quality,meshName,materialName,role] of [
 ['preview','Male_Ranger_Body','MI_Regular_01','skin'],
 ['battle','Male_Ranger_Arms','MI_Regular_01','skin'],
 ['battle','Male_Ranger_Legs','MI_Regular_01','skin'],
 ['battle','Male_Ranger_Body','MI_Ranger_Cloth','body'],
 ['battle','Head','MI_Regular_01','skin']
]){
 assert.equal(shouldClothLineBattleTorso({quality,meshName,materialName,role}),false);
}
const texture=new THREE.Texture();
const source=new THREE.MeshPhysicalMaterial({
 transparent:true,opacity:.20,alphaTest:.45,depthWrite:false,
 metalness:.7,roughness:.25,clearcoat:.5,transmission:.3
});
const newMaterial=applyBattleTorsoLining(source,{
 texture,tint:0x756252,side:THREE.DoubleSide
});
assert.equal(newMaterial,source,'Reuse the SAME garment material slot: zero additional draw calls');
assert.equal(source.map,texture);
assert.equal(source.bumpMap,texture);
assert.equal(source.transparent,false);
assert.equal(source.opacity,1);
assert.equal(source.alphaTest,0);
assert.equal(source.depthWrite,true);
assert.equal(source.depthTest,true);
assert.equal(source.side,THREE.DoubleSide);
assert.equal(source.transmission,0);
assert.equal(source.vertexColors,false);
assert.equal(source.userData.battleOpaqueTorsoLining,true);
assert.match(source.name,/linen-battle-opaque-lining/,'new torso fabric participates in coverage sampling');

const battle=readFileSync(new URL('../src/character-system/battle-artist-head-graft.js',import.meta.url),'utf8');
const hair=readFileSync(new URL('../src/face-scalp-wig.js',import.meta.url),'utf8');
const rig=readFileSync(new URL('../src/character-system/rigged-outfit-runtime.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/studioWigVariants/,'Both middle and near styles have stable cached instances');
assert.match(battle,/artistHead.face.add\(wig.root\)/,'Atomic upgrade adds completed hair first');
assert.match(battle,/for\(const cached of variants.values\(\)\)cached.root.visible=/,
 'Switch near/middle by visibility, never by asynchronous detachment');
assert.match(battle,/artistHead.studioWigQuality!=='middle'/,
 'Dense geometry may be recycled only when the normal haircut is active');
assert.match(battle,/const count=quality==='middle'\?120:hero\?400:208/);
assert.match(battle,/normalLayerCount:quality==='middle'\?1:2/);
assert.match(battle,/battleStableCoverage:true/);
assert.match(hair,/shortBackStrips=shortHair&&battleStableCoverage&&rearCandidates\.length\?96:0/);
assert.match(hair,/shortLength=cutKind==='buzz'\?\(battleStableCoverage\?\.088:\.013\)/);
assert.match(hair,/mesh\.userData\.shortBackCoverageStripCount=shortBackStrips/);
assert.match(rig,/applyBattleTorsoLining\(copy/);
assert.match(rig,/opaqueTorsoLiningMaterials\+\+/);
assert.match(game,/battle-artist-head-graft\.js\?v=20261117-stable-hair1/);
assert.match(game,/rigged-outfit-runtime\.js\?v=20261117-mount-hair1/);
source.dispose();texture.dispose();
console.log('PASS: atomic wig upgrades, short scalp coverage and opaque torso from same source draw slots');
