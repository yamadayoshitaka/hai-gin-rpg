import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHeroProductionRecipe,HERO_PRODUCTION_JOBS,HERO_PRODUCTION_RARITIES}
 from '../src/hero-production-character-factory.js';
import {resolveBattleStudioPattern,BATTLE_STUDIO_PATTERN_VERSION}
 from '../src/character-system/battle-generator-appearance.js';
import {HEROINE_BEAUTY_PART_SELECTION_V43}
 from '../src/heroine-beauty-preset-v42.js';
import {resolvePartSelection} from '../src/face-part-catalog-v32.js';

for(const path of [
 '../src/character-system/battle-generator-appearance.js',
 '../src/character-system/battle-artist-head-graft.js'
])execFileSync(process.execPath,['--check',fileURLToPath(new URL(path,import.meta.url))]);

const hero=createHeroProductionRecipe({
 id:'heroine',jobId:'swordsman',sex:'female',ageBand:'twenties',
 bodyType:'normal',rarity:'UR',faceId:8,hairStyle:4,hairColor:0x211111
});
const def=resolveBattleStudioPattern(hero,{lead:true});
assert.equal(def.version,BATTLE_STUDIO_PATTERN_VERSION);
assert.equal(def.source,'v47-heroine-editor-default');
assert.equal(def.parts.face,HEROINE_BEAUTY_PART_SELECTION_V43.face);
assert.equal(def.parts.eye,HEROINE_BEAUTY_PART_SELECTION_V43.eye);
assert.equal(def.parts.nose,HEROINE_BEAUTY_PART_SELECTION_V43.nose);
assert.equal(def.parts.mouth,HEROINE_BEAUTY_PART_SELECTION_V43.mouth);
assert.equal(def.parts.hair,HEROINE_BEAUTY_PART_SELECTION_V43.hair);
assert.equal(def.hairHex,resolvePartSelection('female',def.parts).hairHex);
assert.equal(def.faceControls.eyeWidth,1.27);
assert.equal(def.faceControls.irisDiameter,1.36);

const saved={
 version:40,parts:{face:2,eye:1,nose:4,mouth:0,hair:4,
  hairColor:'lightBrown',hairVolume:'natural',ageBand:'twenties',bodyType:'normal'},
 controls:{eyeWidth:1.30,eyeHeight:1.10,irisDiameter:1.25,
  jawSharpness:4.7,noseBridgeSharpness:3.2},
 hairStyleId:'rounded-bob',contactColor:'#467fa7',hairDensity:3
};
const out=resolveBattleStudioPattern(hero,{lead:true,preset:saved});
assert.equal(out.source,'saved-heroine-editor');
assert.equal(out.parts.face,2);
assert.equal(out.faceControls.eyeWidth,1.3);
assert.equal(out.contactColor,'#467fa7');
assert.equal(out.hairStyleId,'rounded-bob');
assert.equal(out.hairColor,parseInt(resolvePartSelection('female',saved.parts).hairHex.slice(1),16));
assert.equal(out.hairDensity,3);
assert.equal(out.ageBand,'twenties');
const reused=resolveBattleStudioPattern(hero,{lead:true,preset:saved});
assert.deepEqual(out,reused,'loading the same creator preset must yield the same game model');
const generic=resolveBattleStudioPattern(hero,{lead:false,preset:saved});
assert.equal(generic.source,'v32-catalog-production');
assert.notEqual(generic.faceControls.eyeWidth,out.faceControls.eyeWidth,
 'a saved protagonist face must not clone onto an entire army');
const aged=resolveBattleStudioPattern(createHeroProductionRecipe({
 id:7,jobId:'priest',sex:'female',ageBand:'seventies',bodyType:'fat',
 faceId:1
}),{lead:true,preset:saved});
assert.equal(aged.ageBand,'seventies');
assert.equal(aged.bodyType,'fat');
assert.equal(aged.faceControls.ageBand,'seventies');
assert.equal(aged.faceControls.bodyType,'fat');

const outcomes=new Set();
for(const jobId of Object.keys(HERO_PRODUCTION_JOBS)){
 for(const rarity of HERO_PRODUCTION_RARITIES){
  for(const sex of ['female','male']){
   const recipe=createHeroProductionRecipe({
    id:jobId+rarity+sex,jobId,sex,rarity
   });
   const pattern=resolveBattleStudioPattern(recipe);
   assert.equal(pattern.sex,sex);
   assert.ok(pattern.hairStyleId.length>2);
   assert.match(pattern.hairHex,/^#[0-9a-f]{6}$/);
   assert.equal(pattern.fullStudioSculpt,true);
   outcomes.add(pattern.hairStyleId+'|'+sex);
  }
 }
}
assert.ok(outcomes.size>=10,'job/sex variants must produce several source-catalog hairstyles');

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const graft=readFileSync(new URL('../src/character-system/battle-artist-head-graft.js',import.meta.url),'utf8');
assert.match(game,/currentHeroineStudioPreset\(\)/);
assert.match(game,/resolveBattleStudioPattern\(recipe,\{/);
assert.match(game,/a\.studioPattern=studioPattern/);
assert.match(game,/source:artistHeadSource,pattern:studioPattern/);
assert.match(graft,/makeIndependentFaceMaster\(source,recipe\.sex,args\)/);
assert.match(graft,/pattern\?\.faceControls\|\|artistControls\(recipe\)/);
assert.match(graft,/partSelection:pattern\?\.partIds\|\|null/);
assert.match(graft,/cranialScalpSurface\(artistHead\.face,\{/,
 'Hair cap must use real cranium triangles, never full neck/bust bounds');
assert.match(graft,/createScalpAnchoredWig\(scalp\.proxy,\{/);
assert.match(graft,/staticGroom:true,normalLayeredSingleMesh:true/);
assert.match(game,/a\.outfit\.setHelmetVisible\(false\)/);
assert.match(game,/a\.outfit\.setHairVisible\(true\)/);
assert.match(game,/next\.outfit\.setHairVisible\(false\)/);
assert.match(game,/const STUDIO_GROOM_NEAR_MAX=6/);
assert.match(game,/const STUDIO_GROOM_MIDDLE_MAX=6/);
assert.match(game,/const STUDIO_GROOM_MAX=STUDIO_GROOM_NEAR_MAX\+STUDIO_GROOM_MIDDLE_MAX/);
assert.match(game,/生成器パターン /);
assert.match(game,/生成器実髪 /);
assert.match(game,/window\.getBattleStudioPatternReport/);
assert.match(graft,/for\(const donorLid of character\.face\?\.lids\|\|\[\]\)donorLid\.visible=false/);
console.log('PASS: exact saved heroine face/hair controls and default art, catalog variants for other jobs/ages/sexes, real near-scalp wig and visible headgear override');
