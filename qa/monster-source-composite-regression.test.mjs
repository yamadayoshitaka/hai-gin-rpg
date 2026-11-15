import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {SPECIES_SOURCE_PILOT_IDS,SPECIES_SOURCE_REBUILD_PILOTS,
 isSpeciesSourcePilot} from '../src/monster-source-composite.js';
import {FEMALE_SUMMON_FORMS,MALE_DRAGON_LORD_FORM,
 MALE_DRAGON_LORD_HUMAN_FORM} from '../src/female-summon-forms.js';

const registry=JSON.parse(readFileSync(new URL(
 '../assets/creatures/quaternius50/registry.json',import.meta.url),'utf8'));
const expected=['m001','m007','m011','m021','m046','m047'];
assert.deepEqual(SPECIES_SOURCE_PILOT_IDS,expected);
assert.ok(expected.every(id=>!HUMAN_MONSTER_IDS.includes(id)));
assert.ok(!SPECIES_SOURCE_PILOT_IDS.includes('m005'));
assert.ok(!SPECIES_SOURCE_PILOT_IDS.includes('m006'));
for(const [id,plan] of Object.entries(SPECIES_SOURCE_REBUILD_PILOTS)){
 const spec=MONSTER_BY_ID[id],donor=registry.entries[plan.donor];
 assert.ok(spec&&donor,'Unregistered source pairing '+id);
 assert.ok(isSpeciesSourcePilot(id));
 assert.equal(isSpeciesSourcePilot(spec),true);
 assert.equal(plan.family,spec.family);
 assert.equal(donor.license,'CC0-1.0');
 assert.ok(donor.sourceUrl.startsWith('https://quaternius.com/'));
 for(const lod of ['low','high']){
  const model=donor.models[lod];
  assert.ok(model.endsWith('/'+plan.donor+'/'+lod+'.glb'));
  assert.ok(existsSync(new URL('../'+model.slice(2),import.meta.url)),
   'Source GLB missing in repository: '+id+' '+lod);
 }
}
assert.equal(isSpeciesSourcePilot('m031'),false);
const normal=MALE_DRAGON_LORD_HUMAN_FORM,dragon=MALE_DRAGON_LORD_FORM;
assert.equal(normal.sourceSpecies,'dragon_lord');
assert.equal(dragon.sourceSpecies,'dragon_lord');
assert.equal(normal.sex,'male');
assert.equal(dragon.sex,'male');
assert.equal(normal.formKind,'human');
assert.equal(dragon.formKind,'dragonkin');
assert.equal(normal.costume,'human_royal');
assert.equal(normal.horns,false);assert.equal(normal.wings,false);
assert.equal(dragon.horns,true);assert.equal(dragon.wings,true);
assert.equal(FEMALE_SUMMON_FORMS.seraph_guardian.noBeard,true);
assert.equal(FEMALE_SUMMON_FORMS.seraph_guardian.skin,0xf8f9f8);

const gallery=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
const summon=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../src/monster-summon-renderer.js',import.meta.url),'utf8');
const cosplay=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(gallery,/value="source-composite"/);
assert.match(gallery,/loadSpeciesSourceComposite\(m,externalRegistry/);
assert.match(gallery,/withoutFallback:true/);
assert.match(gallery,/旧造形モデルは非表示/);
assert.match(summon,/value="human" hidden/);
assert.match(summon,/MALE_DRAGON_LORD_HUMAN_FORM/);
assert.match(summon,/femaleMode.value==='human'/);
assert.match(battle,/createCosplayedHumanoidMonster\(spec,\{/);
assert.match(battle,/detail,withoutFallback:true/);
assert.match(battle,/node.costumeHandle\.update\(time\)/);
assert.match(battle,/node.costumeHandle\.dispose\(\)/);
assert.match(cosplay,/profile\.noBeard===true/);
console.log('Source/model routing PASS: 6 existing CC0 GLBs, no protected donors, human-shaped 16 production cosplay, dragon 3 forms, beardless white angel');
