import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {SUMMON_WOLF_HYBRID,blendSummonedWolfBlueprint}
 from '../src/creature-wolf-hybrid.js';
import {DRAGON_SOURCE_HYBRIDS,blendSummonDragonBlueprint}
 from '../src/creature-dragon-hybrids.js';
import {CREATURE_VISUAL_SPECS,buildCombatObjectGeometry}
 from '../src/combat-creature-geometry.js';
import {FEMALE_SUMMON_FORMS,MALE_DRAGON_LORD_FORM}
 from '../src/female-summon-forms.js';
import {creatureSize,SUMMON_WORLD_SCALE,LARGE_SUMMON_IDS,
 riderSeatHeight,riderSeatLocalOffset} from '../src/combat-creature-performance.js';

const original=Object.freeze({
 anatomy:'quadruped',skin:0x65717a,highlight:0x94a0a5,shadow:0x303942,
 width:.39,height:.76,length:.78,legs:.61,tail:1
});
const input=JSON.stringify(original);
assert.equal(SUMMON_WOLF_HYBRID.secondary,'m001');
assert.equal(MONSTER_BY_ID.m001.family,'beast');
const exact=blendSummonedWolfBlueprint(original,0);
assert.equal(exact.width,original.width);
assert.equal(exact.skin,original.skin);
const hybrid=blendSummonedWolfBlueprint(original);
assert.equal(hybrid.hybrid.sourceId,'m001');
assert.equal(hybrid.hybrid.weight,.42);
assert.equal(hybrid.hybrid.keepsOriginalRig,true);
assert.ok(hybrid.width>original.width&&hybrid.width<SUMMON_WOLF_HYBRID.sourceDimensions.width);
assert.ok(hybrid.height>original.height&&hybrid.height<SUMMON_WOLF_HYBRID.sourceDimensions.height);
assert.notEqual(hybrid.skin,original.skin);
assert.deepEqual(JSON.stringify(original),input);
assert(Object.isFrozen(hybrid));
assert.throws(()=>blendSummonedWolfBlueprint({anatomy:'dragon'}));

// All three dragon models retain their own moving wing, jaw, tail and leg
// geometry, and each draws quality features from a DISTINCT existing species.
const expectedDonors={wyvern:'m017',dragon:'m018',elder_dragon:'m020'};
const mobileBudgets={wyvern:175000,dragon:175000,elder_dragon:205000};
for(const [type,donor] of Object.entries(expectedDonors)){
 const original=CREATURE_VISUAL_SPECS[type];
 const mix=blendSummonDragonBlueprint(type,original);
 assert.equal(DRAGON_SOURCE_HYBRIDS[type].donor,donor);
 assert.equal(mix.hybrid.sourceId,donor);
 assert.ok(mix.hybrid.weight>0&&mix.hybrid.weight<.5);
 assert.ok(mix.width>original.width&&mix.width<original.width*1.02);
 assert.notEqual(mix.highlight,original.highlight);
 for(const part of ['originalWingRig','originalLegRig','originalTailRig'])
  assert.equal(mix.hybrid[part],true);
 assert.ok(Object.isFrozen(mix));
 const high=buildCombatObjectGeometry(type,{detail:'high'});
 const low=buildCombatObjectGeometry(type,{detail:'low'});
 const vertices=Object.values(high).reduce((n,g)=>n+g.getAttribute('position').count,0);
 assert.ok(vertices<mobileBudgets[type],type+' exceeded mobile model budget: '+vertices);
 for(const part of ['core','jaw','wingL','wingR','tail']){
  assert.ok(high[part]?.getAttribute('position')?.count>60,
   type+' source blend lost animated '+part);
 }
 assert.ok(Object.values(low).reduce((n,g)=>n+g.getAttribute('position').count,0)
  <vertices*.70,type+' lacks low-detail LOD');
 for(const geo of Object.values(high).concat(Object.values(low)))geo.dispose();
}
assert.equal(SUMMON_WORLD_SCALE,10);
assert.equal(LARGE_SUMMON_IDS.length,7);
for(const id of LARGE_SUMMON_IDS)assert.ok(creatureSize(id)>=10,
 'Summon is not ten times a human '+id);
assert.equal(creatureSize('horse'),1,'A horse is not a summoned monster');
assert.equal(creatureSize('horse',true),1,'Mounted horses must stay rideable');
assert.ok(creatureSize('wolf',true)>=14,'Mounted summoned wolf remains colossal');
const wolf={id:'summoned-wolf',type:'wolf',flying:false};
assert.ok(riderSeatHeight(wolf)>=10,'Human rider must not merge into enlarged wolf');
assert.ok(Math.abs(riderSeatLocalOffset(wolf).z)>1,
 'Giant mount saddle must follow its new torso size');

assert.equal(FEMALE_SUMMON_FORMS.seraph_guardian.skin,0xf4f4f2);
assert.equal(FEMALE_SUMMON_FORMS.seraph_guardian.faceOpenHair,true);
assert.equal(FEMALE_SUMMON_FORMS.forest_archer.skin,0xe1b496);
assert.equal(FEMALE_SUMMON_FORMS.forest_archer.forestGreen,true);
assert.ok(FEMALE_SUMMON_FORMS.forest_archer.leaf===0x32964a);
assert.equal(MALE_DRAGON_LORD_FORM.sex,'male');

const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
const hair=readFileSync(new URL('../src/monster-humanoid-hair.js',import.meta.url),'utf8');
const forest=readFileSync(new URL('../src/creature-summon-humanoid-anatomy.js',import.meta.url),'utf8');
const gallery=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
assert.match(source,/blendSummonedWolfBlueprint\(s\)/,
 'Summoned wolf must actually use the donor blueprint to create the mesh');
assert.match(source,/m001|s\.hybrid/,
 'The hybrid source must contribute its own anatomical contours');
assert.match(hair,/seraph-face-open/,
 'Angel fringe must expose the real original eyes, not place a face mask');
assert.match(forest,/0xf4f5f4/,
 'Procedural fallback angel must have white skin');
assert.match(forest,/0x3d9d4d/,
 'Procedural forest costume must contain emerald leaf surfaces');
assert.match(gallery,/summonWorldScale:SUMMON_WORLD_SCALE/,
 'Showcase and combat should share one world-scale contract');
console.log('Summon source hybrid, forest complexion, white angel, face-open hair and 10x world scale: PASS');
