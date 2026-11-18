import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 REPAIR_RULES,PROTECTED_PATHS,allowedRepairPath,repairMonsterPriority,
 repairStudioManifest,repairCrowdBudget,applyKnownRule
} from '../scripts/batch-repair-rules.mjs';
import {CHARACTER_QUALITY_SIX_LANES} from '../src/character-system/character-quality-six-lanes.js';
const read=p=>fs.readFileSync(p,'utf8');

test('all rule targets are a strict source allowlist; no world/story/GLB mutations',()=>{
 assert.equal(REPAIR_RULES.length,3);
 assert.equal(new Set(REPAIR_RULES.map(x=>x.id)).size,3);
 for(const rule of REPAIR_RULES){
  assert(allowedRepairPath(rule.file));
  assert(fs.existsSync(rule.file),rule.file);
  for(const p of rule.tests)assert(fs.existsSync(p),'Missing rule-specific regression test '+p);
 }
 for(const p of [...PROTECTED_PATHS,'tactics-wireframe.html',
  'data/story-panels.json','.github/workflows/publish-pages.yml',
  'src/character-system/hair-attachment-runtime.js',
  'assets/characters/a.glb','../src/crowd-performance-budget.js'])
  assert.equal(allowedRepairPath(p),false,'unexpectedly unsafe edit '+p);
});

test('existing latest main model refresh priority has no work for known-rule fixer',()=>{
 const src=read('src/creature-game-model-routing.js');
 const out=repairMonsterPriority(src);
 assert.equal(out.changed,false);
 assert.equal(out.code,src);
});
test('a duplicated m011 or omitted m012 filter is actually repaired and then idempotent',()=>{
 const src=read('src/creature-game-model-routing.js');
 const broken=src.replace("'m011','m012','m013','m014'].includes(id)",
  "'m013','m014'].includes(id)");
 assert.notEqual(src,broken,'fixture should introduce a true duplicate species scan');
 const out=repairMonsterPriority(broken);
 assert.equal(out.changed,true);
 assert.match(out.code,/m011','m012','m013','m014'\]\.includes\(id\)/);
 assert.equal(repairMonsterPriority(out.code).changed,false);
});
test('duplicate priorities in manually favored wave are reduced to unique IDs',()=>{
 const src=read('src/creature-game-model-routing.js');
 const broken=src.replace("'m011','m012','m013','m014',\n ...MONSTER_CATALOG",
  "'m011','m011','m012','m013','m014',\n ...MONSTER_CATALOG");
 assert.notEqual(broken,src);
 const out=repairMonsterPriority(broken);
 assert(out.changed);
 assert(!out.code.includes("'m011','m011'"));
 assert.equal(repairMonsterPriority(out.code).changed,false);
});
test('missing face/hair production route is restored without erasing the outfit rubric',()=>{
 const src=read('data/character-system/quality-six-targets.json');
 const original=JSON.parse(src);
 const altered=structuredClone(original);
 altered.groups.faceHair.gamePipeline=['src/face-scalp-wig.js'];
 altered.groups.outfit.gamePipeline=['outfit-maintenance.html'];
 const out=repairStudioManifest(JSON.stringify(altered),CHARACTER_QUALITY_SIX_LANES);
 assert(out.changed);
 const fixed=JSON.parse(out.code);
 for(const key of ['faceHair','outfit']){
  assert.deepEqual(fixed.groups[key].gamePipeline,
   CHARACTER_QUALITY_SIX_LANES[key].gamePipeline);
  assert.deepEqual(fixed.groups[key].lanes,original.groups[key].lanes);
 }
 assert.equal(repairStudioManifest(out.code,CHARACTER_QUALITY_SIX_LANES).changed,false);
 assert.equal(repairStudioManifest(src,CHARACTER_QUALITY_SIX_LANES).changed,false);
});
test('unknown or malformed manifest is not silently reconstructed',()=>{
 const data='{broken';
 const out=repairStudioManifest(data,CHARACTER_QUALITY_SIX_LANES);
 assert.equal(out.changed,false);assert.equal(out.code,data);
 const unknown='{"schemaVersion":2,"groups":{}}';
 assert.equal(repairStudioManifest(unknown,CHARACTER_QUALITY_SIX_LANES).changed,false);
});
test('invalid LOD budget is repaired, while valid tuning is left untouched',()=>{
 const src=read('src/crowd-performance-budget.js');
 assert.equal(repairCrowdBudget(src).changed,false);
 const broken=src.replace('targetFps=45,minPx=36,maxPx=60',
  'targetFps=0,minPx=120,maxPx=8');
 assert.notEqual(src,broken);
 const out=repairCrowdBudget(broken);
 assert(out.changed);
 assert.match(out.code,/targetFps=45,minPx=36,maxPx=60/);
 assert.equal(repairCrowdBudget(out.code).changed,false);
 const tuned=src.replace('targetFps=45,minPx=36,maxPx=60',
  'targetFps=50,minPx=40,maxPx=72');
 assert.equal(repairCrowdBudget(tuned).changed,false);
});
test('self-heal engine contains required bounded retry, retest and release gates',()=>{
 const code=read('scripts/batch-rule-self-heal.mjs');
 const yaml=read('.github/workflows/batch-rule-self-heal.yml');
 assert.match(code,/pass<=3/);
 assert.match(code,/fs\.writeFileSync\(filepath,candidate\.code\)/);
 assert.match(code,/const targetQA=suites\(rule\.tests\)/);
 assert.match(code,/fs\.writeFileSync\(filepath,original\)/);
 assert.match(code,/git.*|requireRun\('git',\['commit'/);
 assert.match(code,/\['push','origin','HEAD:main'\]/);
 assert.match(code,/actions\/workflows\/publish-pages\.yml\/dispatches/);
 assert.match(code,/report\.improvements\.push/);
 assert.match(code,/recordIssue|openOrUpdateIssue/);
 assert.match(yaml,/workflow_dispatch/);
 assert.match(yaml,/node --test qa\/batch-repair-rules\.test\.mjs/);
 assert.match(yaml,/src\/batch-repair-rules\.mjs|scripts\/batch-repair-rules\.mjs/);
});
test('game quality status is never promoted by tests alone',()=>{
 const script=read('scripts/batch-rule-self-heal.mjs');
 assert.match(script,/webglQualityVerified:false/);
 assert.match(script,/androidFpsMeasured:false/);
 assert.match(script,/modelGlbsGenerated:0/);
 assert.match(script,/no_known_error_to_fix/);
 assert.match(script,/disabled_by_batch_center/);
 assert(script.includes('batch-center-switches.json'));
 assert(script.includes("isEnabled('faceHair')&&isEnabled('outfit')"));
});
