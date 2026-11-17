import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CHARACTER_QUALITY_SIX_LANES,partitionHairStyles} from '../src/character-system/character-quality-six-lanes.js';
import {listWigStyles} from '../src/face-wig-styles.js';
const targets=JSON.parse(fs.readFileSync('data/character-system/quality-six-targets.json','utf8'));
test('Six independent themes for each of face+hair and wardrobe, with nontrivial acceptance criteria',()=>{
 for(const cat of ['faceHair','outfit']){
  assert.equal(targets.groups[cat].lanes.length,6);
  assert.equal(CHARACTER_QUALITY_SIX_LANES[cat].lanes.length,6);
  const names=targets.groups[cat].lanes.map(x=>x.id);
  assert.equal(new Set(names).size,6);
  for(const lane of targets.groups[cat].lanes)assert(lane.criteria.length>=4);
 }
});
test('All male/female canonical hairstyles belong to exactly one of six balanced families',()=>{
 const rows=['female','male'].flatMap(gender=>listWigStyles(gender).map(x=>({...x,gender})));
 const groups=partitionHairStyles(rows);
 assert.equal(groups.length,6);
 const covered=groups.flatMap(x=>x.items);
 assert.equal(covered.length,rows.length);
 assert.equal(new Set(covered.map(x=>x.gender+':'+x.id)).size,rows.length);
 const sizes=groups.map(x=>x.items.length);
 assert(Math.max(...sizes)-Math.min(...sizes)<=1);
});
test('Game runtime uses same source-level hair and wardrobe constructors as model studios',()=>{
 const game=fs.readFileSync('tactics-wireframe.html','utf8');
 const hair=fs.readFileSync('src/character-system/rigged-outfit-runtime.js','utf8');
 assert.match(game,/rigged-outfit-runtime\.js/);
 assert.match(hair,/hair-attachment-runtime\.js/);
 assert.match(game,/battle-visual-pipeline\.js/);
 assert.match(hair,/garment-coverage-runtime\.js/);
 assert.match(game,/buildRiggedJobOutfit/);
});
test('Old human and world recurring tasks disabled; monster and anime kept on',()=>{
 const s=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
 assert.equal(s.groups.human.enabled,false);
 assert.equal(s.groups.world.enabled,false);
 assert.equal(s.groups.faceHair.enabled,true);
 assert.equal(s.groups.outfit.enabled,true);
 assert.equal(s.groups.monster.enabled,true);
 assert.equal(s.groups.anime.enabled,true);
});
