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
assert.match(editor,/const previewSlots=contract.slots/);
assert.match(editor,/attack:actor.motion.attack/);
assert.match(editor,/const editorUsesBom=.*'equipment'/);
assert.match(editor,/sequence=true;start\(queue.shift\(\)\)/);
console.log('Character asset regression: '+cases+' job/sex/clip/cosmetic cases passed');
