import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHARACTER_PARTS} from '../src/character-assembly-bom.js';
import {PLAYER_JOBS} from '../src/game-content.js';
import {characterAssetRecipe,ASSET_SLOT_NAMES,validateAssetRecipes} from '../src/character-asset-registry.js';
import {sampleHumanClip} from '../src/human-motion-clips.js';
import {sanitizeCharacterPreset} from '../src/character-preset-store.js';
assert.equal(validateAssetRecipes(),true);
let cases=0;
for(const job of Object.keys(PLAYER_JOBS))for(const sex of ['male','female']){
 const base=characterAssetRecipe(job,sex);
 assert.equal(base.skill,PLAYER_JOBS[job].skill);
 assert.ok(base.motion.attack);
 for(const name of ['idle','walk','run','attack','guard','hit','dead']){
  const pose=sampleHumanClip(name,.37,{...base.motion,attack:base.motion.attack});
  assert.ok([...pose.hips,...pose.knees,...pose.shoulders].every(Number.isFinite),job+'/'+sex+'/'+name);
  cases++;
 }
 for(const hair of Object.keys(CHARACTER_PARTS.hairs)){
  const customized=characterAssetRecipe(job,sex,{hair});
  assert.equal(customized.slots.hair,hair);
  assert.equal(customized.slots.equipment,base.slots.equipment,'hair selection altered equipment: '+job+'/'+sex);
  assert.equal(customized.slots.outfit,base.slots.outfit);
  cases++;
 }
 const all=sanitizeCharacterPreset({...base.slots,sex,jobId:job});
 for(const k of ASSET_SLOT_NAMES)assert.equal(all[k],base.slots[k]);
 cases++;
}
const editor=fs.readFileSync(new URL('../action-test.html',import.meta.url),'utf8');
assert.match(editor,/const overrides=\{\.\.\.editValues\};/,'editor must copy user edits into overrides');
assert.match(editor,/if\(!Object\.hasOwn\(overrides,'outfit'\).*overrides\.outfit=occupationOutfit;/,'occupation outfit must fill only an unspecified outfit');
assert.match(editor,/const contract=characterAssetRecipe\(job,sex,overrides\)/,'editor must pass resolved overrides to character recipe');
assert.match(editor,/const preset=\{\.\.\.actor,\.\.\.contract\.slots/,'initialize preview from resolved JSON');
assert.match(editor,/const generation=\+\+modelGeneration/,'async generation guard');
assert.match(editor,/if\(generation!==modelGeneration\|\|host!==nextHost\)return/,'stale model load must not replace current actor');
assert.match(editor,/equipment:Object\.hasOwn\(editValues,'equipment'\)\?contract\.slots\.equipment:occupationEquipment\.weapon/,'weapon must respect explicit selection or occupation equipment');
assert.match(editor,/host\.userData\.syncVisibleWeapon\?\.\(\)/,'visible weapon must be synchronized with character state');
assert.match(editor,/const contact=constraint\?\.solve\?\.\(\)/,'weapon grip must use contact solver');
assert.match(editor,/nextRig\.root\.visible=false;\s*model\.visible=true/,'one visual authority');
assert.match(editor,/host\.userData\.motionContact=\{action,time:motionClock/,'preview must provide motion state to the imported skeleton');
assert.match(editor,/host\.userData\.externalNpcSync\?\.\(\)/,'imported skeleton must receive the pose update');
assert.match(editor,/sequence=true;start\(queue\.shift\(\)\)/);
console.log('Character asset regression: '+cases+' job/sex/clip/cosmetic cases passed');

// Current contract: independent face/outfit/weapon editors, a shared full-body
// model registry, and a safe live-game fallback until motion QA is passed.
// Legacy cosmetic generation and weapon fallback assertions were removed because
// they enforced the retired two-head/old-outfit pipeline.
const {CHARACTER_MODEL_REGISTRY,CHARACTER_MOTION_COMMANDS,validateCharacterForGame}=await import('../src/character-model-registry.js');
const imported=fs.readFileSync(new URL('../src/cc0-town-npc-visuals.js',import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../src/game-runtime.js',import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../motion-external-test.html',import.meta.url),'utf8');
for(const sex of ['male','female']){
 const entry=CHARACTER_MODEL_REGISTRY[sex];
 assert.match(entry.id,/^Superhero_(Male|Female)_FullBody$/);
 assert.ok(entry.url.endsWith(entry.id+'.gltf'));
 assert.ok(entry.targetHeight>=1.5&&entry.targetHeight<=2.0);
 assert.ok(studio.includes('CHARACTER_MODEL_REGISTRY'),'motion studio must share the model IDs');
}
for(const action of ['idle','walk','dash','attack','guard','hit','dead','jump'])assert.ok(CHARACTER_MOTION_COMMANDS[action]);
assert.equal(validateCharacterForGame({mappedJoints:14,measuredHeight:1.78,targetHeight:1.78,clips:['Idle','Walk']}).ready,true);
for(const test of [
 {mappedJoints:4,measuredHeight:1.78,targetHeight:1.78,clips:['Idle','Walk']},
 {mappedJoints:14,measuredHeight:4.1,targetHeight:1.78,clips:['Idle','Walk']},
 {mappedJoints:14,measuredHeight:1.78,targetHeight:1.78,clips:['Walk']},
 {mappedJoints:14,measuredHeight:1.78,targetHeight:1.78,clips:['Idle']}
])assert.equal(validateCharacterForGame(test).ready,false,'invalid live model must fail release gate');
assert.match(imported,/CHARACTER_MODEL_REGISTRY/,'runtime visuals must use same model registry');
assert.match(imported,/characterVisualSource='bom-safe-fallback'/,'unsafe imported skins must not override the stable game actor');
assert.match(game,/rig\.root\.visible=true/,'BOM fallback must remain visible until a safe skin is ready');
for(const file of ['character-face.html','character-outfit.html','character-weapon.html'])assert.ok(fs.existsSync(new URL('../'+file,import.meta.url)),'missing editor: '+file);
console.log('Character model registry and live-game safety gate passed');
