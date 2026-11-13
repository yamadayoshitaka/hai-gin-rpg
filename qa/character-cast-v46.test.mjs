import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_CAST_V46,CHARACTER_CAST_BY_ID,MAJOR_CHARACTER_IDS,
 characterAppearance,BODY_SHAPES} from '../src/character-cast-v46.js';
import {PART_CATALOG} from '../src/face-part-catalog-v32.js';
import {listWigStyles,WIG_SILHOUETTE_PROFILES} from '../src/face-wig-styles.js';
test('six distinct chapter-one story identities use their own 3D face and hair profiles',()=>{
 assert.deepEqual(MAJOR_CHARACTER_IDS,
  ['commander-female','commander-male','lucia','garan','iris','mina']);
 assert.equal(new Set(CHARACTER_CAST_V46.map(c=>c.id)).size,CHARACTER_CAST_V46.length);
 for(const c of CHARACTER_CAST_V46){
  const look=characterAppearance(c.id);
  assert.equal(look.item.gender,c.gender);
  assert.ok(look.bodyShape.width>0);
  assert.ok(WIG_SILHOUETTE_PROFILES[look.styleId]);
  assert.equal(PART_CATALOG[c.gender].hair[look.parts.hair].values.styleId,look.styleId);
  assert.ok(Number.isFinite(look.controls.eyeHeight)||look.controls.eyeHeight===undefined);
 }
 assert.equal(CHARACTER_CAST_BY_ID.lucia.hairColor,'silver');
 assert.equal(CHARACTER_CAST_BY_ID.garan.age,'elder');
});
test('24 unique hairstyle IDs are compatible with each gender, no princess haircut on men',()=>{
 for(const gender of ['male','female']){
  const ids=PART_CATALOG[gender].hair.map(x=>x.values.styleId);
  assert.equal(ids.length,24);
  assert.equal(new Set(ids).size,24);
  const visible=new Set(listWigStyles(gender).map(x=>x.id));
  for(const id of ids)assert.ok(visible.has(id),gender+' missing '+id);
 }
 const men=new Set(PART_CATALOG.male.hair.map(x=>x.values.styleId));
 for(const style of ['princess-long','female-hime-cut','female-low-bun','female-twin-braids'])
  assert.equal(men.has(style),false,'Women-only hair leaked into men: '+style);
});
test('mob NPC archetypes cover age, narrow eyes and heavier figures',()=>{
 const npcs=CHARACTER_CAST_V46.filter(c=>c.status==='npc');
 assert.ok(npcs.some(c=>c.gender==='female'&&c.age==='elder'));
 assert.ok(npcs.some(c=>c.gender==='male'&&c.age==='elder'));
 assert.ok(npcs.some(c=>c.gender==='female'&&c.eyeShape==='narrow'));
 assert.ok(npcs.some(c=>c.gender==='male'&&c.eyeShape==='narrow'));
 assert.ok(npcs.some(c=>c.gender==='male'&&c.bodyShape==='heavy'));
 assert.ok(npcs.some(c=>c.gender==='female'&&c.bodyShape==='full'));
 assert.ok(BODY_SHAPES.heavy.width>BODY_SHAPES.average.width);
});
