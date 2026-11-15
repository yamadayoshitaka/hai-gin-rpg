import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {MONSTER_SUMMON_ENTRIES} from '../src/monster-summon-registry.js';
import {monsterDesignPrompt,MONSTER_REFERENCE_COVERAGE} from '../src/monster-reference-design.js';
import {MONSTER_QUALITY_SCHEMA,MONSTER_QUALITY_FIELDS,MONSTER_QUALITY_ACTIONS,
 MONSTER_QUALITY_GATES,MONSTER_QUALITY_ANATOMY,MONSTER_QUALITY_TARGET,
 MONSTER_QUALITY_MIN_RATINGS,WOLF_QUALITY_REFERENCE,assessMonsterQuality,
 monsterQualityScore} from '../src/monster-quality-kpi.js';

const allFive=Object.fromEntries(MONSTER_QUALITY_FIELDS.map(f=>[f.id,5]));
const allChecks=Object.fromEntries(MONSTER_QUALITY_GATES.map(g=>[g.id,true]));
const allActions=Object.fromEntries(MONSTER_QUALITY_ACTIONS.map(g=>[g.id,true]));
const evidence={
 reference:'assets/quality/m001-reference.png',
 renderBefore:'assets/quality/m001-before.png',
 renderAfter:'assets/quality/m001-after.png',
 motion:'qa/m001-seven-actions.mp4',
 device:'qa/android-pixel8a-50v50-10min.json',
 license:'creature-model-credits.html'
};
const passRecord=()=>({
 ratings:{...allFive},gates:{...allChecks},actions:{...allActions},
 speciesChecks:[true,true,true],
 metrics:{fps1Low:'33.5',crashCount:'0'},evidence:{...evidence}
});

test('all 50 monster species and 50 summons have species-specific baseline prompts',()=>{
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(MONSTER_REFERENCE_COVERAGE.length,50);
 assert.equal(MONSTER_SUMMON_ENTRIES.length,50);
 assert.equal(new Set(MONSTER_REFERENCE_COVERAGE.map(m=>m.id)).size,50);
 for(const m of MONSTER_CATALOG){
  const before=monsterDesignPrompt(m.id);
  const summon=monsterDesignPrompt('summon_'+m.id);
  assert.ok(before.includes(m.id)&&before.includes(m.name),m.id);
  assert.ok(summon.includes('召喚獣版'),m.id);
  assert.ok(before.includes('敵モンスター版'),m.id);
  assert.ok(before.includes('文字・ロゴ・番号'),m.id);
  assert.equal(MONSTER_QUALITY_ANATOMY[m.family].length,3,m.family);
  if(HUMAN_MONSTER_IDS.includes(m.id))assert.ok(before.includes('人体骨格'),m.id);
  else assert.ok(before.includes('非人型'),m.id);
 }
 assert.ok(monsterDesignPrompt('m001').includes(WOLF_QUALITY_REFERENCE.m001.visual),
  'Enemy wolf prompt should use the current specifically approved reference rather than an obsolete magic-color phrase');
 assert.equal(WOLF_QUALITY_REFERENCE.m001.role,'enemy');
 assert.equal(WOLF_QUALITY_REFERENCE.summon_m001.role,'summon');
 assert.equal(WOLF_QUALITY_REFERENCE.wolf.role,'summon');
});
test('weights total exactly 100; missing values never become fabricated scores',()=>{
 assert.equal(MONSTER_QUALITY_SCHEMA,'hai-gin/monster-quality-review/v1');
 assert.equal(MONSTER_QUALITY_TARGET,90);
 assert.equal(MONSTER_QUALITY_FIELDS.reduce((sum,f)=>sum+f.weight,0),100);
 assert.equal(MONSTER_QUALITY_ACTIONS.length,7);
 assert.equal(monsterQualityScore(null),null);
 assert.equal(monsterQualityScore({}),null);
 assert.equal(monsterQualityScore(allFive),100);
 assert.equal(monsterQualityScore(Object.fromEntries(
  MONSTER_QUALITY_FIELDS.map(f=>[f.id,4]))),80);
 assert.equal(monsterQualityScore({...allFive,materials:undefined}),null);
 assert.equal(monsterQualityScore({...allFive,materials:6}),null);
});
test('90 points is not sufficient without screenshots, actions, anatomy and device results',()=>{
 const scoreOnly={ratings:{...allFive}};
 const result=assessMonsterQuality(scoreOnly);
 assert.equal(result.score,100);
 assert.equal(result.status,'unverified');
 assert.equal(result.pass,false);
 assert.ok(result.missingEvidence.length>0);
 assert.equal(result.missingActions.length,7);
 assert.equal(result.missingAnatomy.length,1);
 const fake={...passRecord(),speciesChecks:[true]};
 assert.equal(assessMonsterQuality(fake).pass,false);
 const missingClip=passRecord();missingClip.actions.attack=false;
 assert.equal(assessMonsterQuality(missingClip).pass,false);
 const whiteCrash=passRecord();whiteCrash.gates.noWhiteGeometry=false;
 assert.equal(assessMonsterQuality(whiteCrash).pass,false);
 const noLicense=passRecord();noLicense.evidence.license='';
 assert.equal(assessMonsterQuality(noLicense).pass,false);
});
test('validated high-quality monster passes; subthreshold mobile and rights fail',()=>{
 assert.equal(assessMonsterQuality(passRecord()).pass,true);
 const slow=passRecord();slow.metrics.fps1Low='29.9';
 assert.equal(assessMonsterQuality(slow).pass,false);
 const broken=passRecord();broken.metrics.crashCount='1';
 assert.equal(assessMonsterQuality(broken).pass,false);
 const unknown=passRecord();unknown.metrics.fps1Low='';
 assert.equal(assessMonsterQuality(unknown).pass,false);
 const lower=passRecord();lower.ratings.anatomy=3;
 assert.ok(monsterQualityScore(lower.ratings)>=90);
 assert.equal(assessMonsterQuality(lower).pass,false,'critical weak anatomy cannot pass by averaging');
 const rights=passRecord();rights.ratings.rights=4;
 assert.equal(MONSTER_QUALITY_MIN_RATINGS.rights,5);
 assert.equal(assessMonsterQuality(rights).pass,false,'rights must score full marks');
 const under=passRecord();under.ratings={...allFive,design:3,anatomy:3,materials:3,actions:3};
 assert.equal(assessMonsterQuality(under).pass,false);
});
