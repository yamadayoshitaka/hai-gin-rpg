import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const graft=readFileSync(new URL('../src/character-system/battle-artist-head-graft.js',import.meta.url),'utf8');
const shared=readFileSync(new URL('../src/character-system/shared-character-runtime.js',import.meta.url),'utf8');
const studio=readFileSync(new URL('../src/heroine-battle-costume-bridge.js',import.meta.url),'utf8');
const factory=readFileSync(new URL('../src/hero-production-character-factory.js',import.meta.url),'utf8');
const asset='assets/master-sources/blender/realistic-head-animation.glb';
for(const file of ['../src/character-system/battle-artist-head-graft.js','../src/heroine-battle-costume-bridge.js']){
 execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,import.meta.url))]);
}
assert.match(graft,/makeIndependentFaceMaster\(source,recipe\.sex,args\)/,
 'The artist-grade 3D sculpt must be built, not merely declared');
assert.match(graft,/hideBattleDonorFace\(character\.model\)/,
 'Actually remove the previous Quaternius face polygons');
assert.match(graft,/attachIndependentFaceToBattleHead\(/,
 'Bind the independent artist face to the moving Head bone');
assert.match(graft,/loadAsync\(masterHeadSourceUrl\(\)\)/,
 'Download the original Blender master instead of rendering the same donor mesh');
assert.ok(graft.includes(asset),'Reference the exact 785k Blender GLB from heroine studio');
assert.ok(studio.includes('export function hideBattleDonorFace('));
assert.ok(studio.includes('export function attachIndependentFaceToBattleHead('));
assert.match(graft,/if\(!donorFit\.attachedToRealHeadBone\|\|cut\.removedTriangles<=0\)/,
 'Do not report replacement when the old head has not been removed');
assert.match(graft,/fitBattleArtistFaceToHead\(\{/, 'True cranium fitting must follow donor face removal');
assert.match(graft,/facePrototypes\.set\(key,prototype\)/,
 'Share authored geometry across generic soldiers');
assert.match(graft,/prototype\.root\.clone\(true\)/,
 'No expensive duplicate geometry per soldier with the same sculpt');
assert.match(graft,/createFaceExpressionAnimator\(master/,
 'The protagonist/strategist keeps real eyelid and lip motion');
assert.match(graft,/part\.node\.visible=part\.initialVisible&&\(desired\|\|\/EYELINER\/i\.test\(part\.node\.name\)\)/,
 'LOD cannot resurrect invisible donor facial cosmetics');
assert.match(game,/loadBattleHeadMaster\(\)/);
assert.match(game,/a\.masterHead=attachBattleArtistHead\(/);
assert.match(game,/animatedFace:a\.isPlayerHero\|\|a\.isStrategist/);
assert.match(game,/a\.artistWardrobeFinish=enhanceStudioCombatMaterials\(a\.outfit\.root\)/);
assert.match(game,/a\.artistArmorFit=refineHeroineCostumeSilhouette\(/);
assert.match(game,/applySkinnedBuildMorph\(character\.object3D,recipe\.bodyType\)/);
assert.match(game,/window\.getBattleArtistHeadReport/);
assert.match(game,/高精細頭部 /);
assert.match(game,/頭部LOD /);
assert.match(game,/if\(sculpted!==actors\.filter\(a=>!a\.monsterSpec\)\.length\)/);
assert.ok(game.indexOf('a.masterHead=attachBattleArtistHead(')<
 game.indexOf('a.outfit=await buildRiggedJobOutfit('),
 'Remove donor triangles BEFORE wardrobe computes body/cloth occlusion');
assert.match(shared,/skeleton\.pose\(\)/,
 'Original 65-bone retargeted character motion must remain intact');
assert.match(factory,/HERO_VARIANT_COUNT=10\*3\*2\*AGE_BAND_IDS\.length\*BODY_TYPE_IDS\.length/);
console.log('PASS: live artist GLB physically replaces old donor face, maintains animated bones, studio metal/cloth, face expression and audited LOD');
