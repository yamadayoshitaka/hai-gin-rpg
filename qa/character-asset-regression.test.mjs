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
assert.match(editor,/characterAssetRecipe\(job,sex,editValues\)/);
assert.match(editor,/const preset=\{\.\.\.actor,\.\.\.contract\.slots/,'initialize preview from resolved JSON');
assert.match(editor,/const generation=\+\+modelGeneration/,'async generation guard');
assert.match(editor,/if\(generation!==modelGeneration\|\|host!==nextHost\)return/,'stale model load must not replace current actor');
assert.match(editor,/part\.name==='weapon-bom-mount'\)part\.visible=contract\.slots\.equipment!=='none'/,'weapon must follow the recipe slot');
assert.match(editor,/nextRig\.root\.visible=false;\s*model\.visible=true/,'one visual authority');
assert.match(editor,/sampleHumanClip\(action,motionClock/);
assert.match(editor,/sequence=true;start\(queue\.shift\(\)\)/);
console.log('Character asset regression: '+cases+' job/sex/clip/cosmetic cases passed');

const imported=fs.readFileSync(new URL('../src/cc0-town-npc-visuals.js',import.meta.url),'utf8');
const hair=fs.readFileSync(new URL('../src/quaternius-head-bom.js',import.meta.url),'utf8');
assert.match(imported,/style:preset\.hair\|\|null/,'visible imported model must apply user hair setting');
for(const style of ['short','layered','long','bob','swept','bald'])assert.ok(hair.includes(style),'missing visible hair style '+style);
assert.match(editor,/v127\.48/,'editor UI version must match current natural motion preview');
assert.match(editor,/height:39dvh/,'mobile preview must not be obscured by oversized control pane');

// Cosmetic contract regression: all seven outfit IDs must alter visible imported materials.
for(const outfit of ['traveler','villager','guard','noble','merchant','mage','bandit'])assert.ok(imported.includes(outfit+':['),'outfit palette missing '+outfit);
assert.match(imported,/equipped==='none'\?null:equipmentModels\[equipped\]/,'none must never request an equipment GLTF');
assert.match(imported,/appearanceOutfit=preset.outfit/,'visible outfit selection must be observable');
assert.match(imported,/hairProfile=\{style:preset.hair/,'hair diagnostics must reflect selected style');

const fallbackSource=fs.readFileSync(new URL('../src/equipment-fallback-bom.js',import.meta.url),'utf8');
for(const id of Object.keys(CHARACTER_PARTS.equipment))assert.ok(fallbackSource.includes("'"+id+"'"),'missing equipment fallback '+id);
assert.match(imported,/makeEquipmentFallback\(THREE,preset.equipment\)/,'visible fallback must be selected from equipment BOM');
assert.match(imported,/previous.visible=false/,'matching asset loading hides fallback');
