import assert from 'node:assert/strict';
import test from 'node:test';
import {STARTER_KINGDOM_CHARACTER_PRESETS,resolveStarterKingdomCharacter,validateStarterKingdomCharacters} from '../src/starter-town-character-bom.js';
import {CHARACTER_PARTS} from '../src/character-assembly-bom.js';

test('starter town has 15 distinct valid reusable NPC recipes',()=>{
 assert.equal(validateStarterKingdomCharacters(),true);
 assert.equal(STARTER_KINGDOM_CHARACTER_PRESETS.length,15);
 const ids=STARTER_KINGDOM_CHARACTER_PRESETS.map(x=>x.id);
 assert.equal(new Set(ids).size,15);
 for(const preset of STARTER_KINGDOM_CHARACTER_PRESETS){
  for(const [key,parts] of Object.entries({body:CHARACTER_PARTS.bodies,face:CHARACTER_PARTS.faces,hair:CHARACTER_PARTS.hairs,outfit:CHARACTER_PARTS.outfits,equipment:CHARACTER_PARTS.equipment})){
   assert.ok(parts[preset[key]],preset.id+' missing real BOM definition '+key+':'+preset[key]);
  }
 }
 assert.equal(resolveStarterKingdomCharacter(0).id,'royal-king');
 assert.equal(resolveStarterKingdomCharacter(14).id,'wealthy-citizen');
 assert.equal(resolveStarterKingdomCharacter(15).id,'royal-king');
});
