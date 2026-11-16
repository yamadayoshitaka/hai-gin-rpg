import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 HERO_PRODUCTION_JOBS,HERO_PRODUCTION_RARITIES,HERO_PRODUCTION_SEXES,
 HERO_VARIANT_COUNT,createHeroProductionRecipe,enumerateHeroProductionRecipes,
 resolveHeroProductionJob,heroProductionActionCue
} from '../src/hero-production-character-factory.js';
import {resolveJobMotion,JOB_SKILL_MOTION_COMMANDS,JOB_CAST_MOTION_COMMANDS}
 from '../src/character-system/job-motion-source.js';
import {AGE_BAND_IDS,BODY_TYPE_IDS} from '../src/character-demographics-v47.js';
import {OUTFIT_RARITY} from '../src/character-system/outfit-rarity-policy.js';

const jobIds=Object.keys(HERO_PRODUCTION_JOBS).filter(id=>id!=='strategist');
assert.equal(jobIds.length,10,'hero character production must span all ten live battle jobs');
assert.equal(HERO_VARIANT_COUNT,
 jobIds.length*HERO_PRODUCTION_RARITIES.length*HERO_PRODUCTION_SEXES.length*
 AGE_BAND_IDS.length*BODY_TYPE_IDS.length);
const variants=[...enumerateHeroProductionRecipes()],seen=new Set();
assert.equal(variants.length,1920,'generate exact full recipe matrix; not 1920 heavy meshes');
for(const recipe of variants){
 assert.ok(!seen.has(recipe.id),'every identity distinct');seen.add(recipe.id);
 assert.ok(HERO_PRODUCTION_JOBS[recipe.jobId]);
 assert.ok(Object.hasOwn(OUTFIT_RARITY,recipe.rarity));
 assert.ok(HERO_PRODUCTION_SEXES.includes(recipe.sex));
 assert.ok(AGE_BAND_IDS.includes(recipe.ageBand));
 assert.ok(BODY_TYPE_IDS.includes(recipe.bodyType));
 assert.ok(recipe.height>.95&&recipe.height<1.95,'age-based metres remain within human scale');
 assert.ok(recipe.hairStyle>=1&&recipe.hairStyle<=(recipe.sex==='female'?12:14));
 assert.ok(Number.isInteger(recipe.hairColor));
 assert.ok(recipe.visualScaleX>=.88&&recipe.visualScaleX<=1.17);
 assert.ok(recipe.visualScaleZ>=.88&&recipe.visualScaleZ<=1.16);
 for(const name of ['eyeSize','eyeSpacing','noseWidth','noseLength','mouthWidth','mouthFullness'])
  assert.ok(Number.isFinite(recipe.faceProfile[name]));
 assert.equal(recipe.photoMasterGeometrySwapped,false,
  'do not claim the unrigged static prototype is an animated in-game mesh');
 assert.equal(recipe.donorSkinnedRig,'quaternius-65-bone');
 const cue=heroProductionActionCue(recipe,'skill');
 assert.ok(cue&&cue.scale>0&&cue.scale<=1.2);
 assert.equal(heroProductionActionCue(recipe,'run'),null,
  'no per-frame particle emission on running soldiers');
}
assert.equal(heroProductionActionCue(createHeroProductionRecipe({jobId:'mage'}),'skill').action,'magic');
assert.equal(heroProductionActionCue(createHeroProductionRecipe({jobId:'priest'}),'skill').action,'heal');
assert.equal(heroProductionActionCue(createHeroProductionRecipe({jobId:'guardian'}),'skill').action,'guard');
assert.equal(heroProductionActionCue(createHeroProductionRecipe({jobId:'fighter'}),'skill').action,'punch');
assert.equal(heroProductionActionCue(createHeroProductionRecipe({jobId:'swordsman'}),'skill').action,'heavy');
assert.equal(heroProductionActionCue(createHeroProductionRecipe({jobId:'archer'}),'skill').action,'aim');
assert.equal(heroProductionActionCue(createHeroProductionRecipe({jobId:'ninja',rarity:'UR'}),'skill').scale,1.20);

const selected={id:'hero-player',jobId:'mage',sex:'female',rarity:'UR',
 ageBand:'seventies',bodyType:'fat',faceId:7,hairStyle:9,hairColor:0xb1aa91};
const first=createHeroProductionRecipe(selected),second=createHeroProductionRecipe(selected);
assert.deepEqual(first,second,'same story identity must not change face between load or frame');
assert.equal(first.faceIndex,7);
assert.equal(first.hairStyle,9);
assert.equal(first.hairColor,0xb1aa91);
assert.equal(first.sex,'female');
assert.ok(first.height<createHeroProductionRecipe({...selected,ageBand:'twenties'}).height);
assert.ok(first.visualScaleX>1,'adult body types must be distinguishable without moving hitboxes');
assert.equal(resolveHeroProductionJob('guardian').outfit,'盾戦士');
assert.equal(resolveHeroProductionJob('槍兵').outfit,'剣士');
assert.equal(resolveHeroProductionJob('strategist').motion,'剣士');

const jobs=JSON.parse(readFileSync(new URL('../job-command-motion-map.json',import.meta.url),'utf8')).jobs;
for(const [jobId,row] of Object.entries(HERO_PRODUCTION_JOBS)){
 const actual=jobs[row.motion];
 assert.ok(actual,jobId+' requires an authentic motion donor');
 for(const state of ['idle','run','attack','skill']){
  const selected=resolveJobMotion(jobs,row.motion,state);
  // The three normal combat states retain their original fallback policies;
  // every ultimate (including caster spells and ninja combos) MUST resolve.
  if(state==='skill'){
   assert.ok(selected?.available,jobId+' skill has no authored playable clip');
   assert.ok(actual.some(c=>c.command===selected.command&&c.available),
    jobId+' skill must use a verified, registered source clip');
  }
 }
 if(JOB_CAST_MOTION_COMMANDS[row.motion]){
  const cast=resolveJobMotion(jobs,row.motion,'cast');
  assert.ok(cast?.available,jobId+' casting clip must be playable');
  assert.ok(JOB_CAST_MOTION_COMMANDS[row.motion].includes(cast.command));
 }
}
assert.ok(JOB_SKILL_MOTION_COMMANDS['召喚士'].includes('召喚詠唱'));
assert.ok(JOB_SKILL_MOTION_COMMANDS['魔法使い'].includes('長詠唱'));

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../src/character-system/shared-character-runtime.js',import.meta.url),'utf8');
assert.match(game,/createHeroProductionRecipe\(\{/);
assert.match(game,/a\.sex=recipe\.sex;a\.masterRecipe=recipe/);
assert.match(game,/faceId:recipe\.faceIndex,faceProfile:recipe\.faceProfile/);
assert.match(game,/job:recipe\.outfitJob,sex:recipe\.sex,quality:'battle',rarity:recipe\.rarity/);
assert.match(game,/hairStyle:1\+studioPattern\.hairIndex%\(recipe\.sex==='female'\?12:14\)/,
 'mid/far hair must use the generator catalogue style instead of unrelated random job GLB');
assert.match(game,/hairColor:studioPattern\.hairColor/,
 'generator hair pigment must drive the real fitted-hair material');
assert.match(game,/character\.object3D\.scale\.set\(recipe\.visualScaleX,1,recipe\.visualScaleZ\)/);
assert.match(game,/heroProductionActionCue\(a\.masterRecipe,state\)/);
assert.match(game,/window\.getHeroProductionSwapStatus/);
assert.match(runtime,/\['attack','skill','cast','jump','dead','death','hit'\]\.includes\(state\)\?THREE\.LoopOnce/,
 'actual rigged skill/cast retarget must be one-shot');
assert.doesNotMatch(game,/createHumanBomRig\(/,
 'battle must use the real rigged hero skeleton, not simplified geometric primitives');
console.log('PASS: 1920 lazy hero-derived variants, ten authentic job ultimates and casts, skin/wardrobe/full-rig battle swap and pooled VFX');
