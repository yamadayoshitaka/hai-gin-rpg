import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from '../src/story-chapter-comic.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stageIds=Array.from({length:9},(_,i)=>'c01-s'+String(i+2).padStart(2,'0'));
assert.equal(stageIds.at(-1),'c01-s10');
const allowedGender=['male','female'];
const counts={pre:8,'post-victory':7,'post-defeat':7,'post-gameover':2};
const uniqueFiles=new Set(),uniqueShots=new Set();
for(const stageId of stageIds){
 const s=CAMPAIGN_STAGE_BY_ID[stageId];
 const contract=JSON.parse(fs.readFileSync(path.join(root,'assets/story/stage-manifests',stageId+'.manifest.json'),'utf8'));
 const bible=JSON.parse(fs.readFileSync(path.join(root,'assets/story/characters',stageId+'-reference-bible.json'),'utf8'));
 assert.equal(contract.schemaVersion,4);
 assert.equal(contract.kind,'STAGE_RENDER_CONTRACT_NOT_COMPLETED_ART');
 assert.equal(contract.stageId,stageId);
 assert.equal(contract.layout.requiredPanels,48);
 assert.equal(contract.layout.maxPanelsPerPoster,10);
 assert.equal(contract.criticalPriorityPolicy.priority,'P0_ABSOLUTE_MUST_FOLLOW');
 assert.equal(contract.criticalPriorityPolicy.failClosed,true);
 assert.equal(contract.singleInvocation.artRendererConnected,false);
 assert.equal(contract.qualityApproved,false);
 assert.equal(contract.complete,false);
 assert.equal(contract.deployedNewImages,false);
 assert.equal(contract.variants.length,8);
 assert.equal(bible.stageId,stageId);
 assert.equal(bible.policy.attachRealImageBytesToGeneration,true);
 assert.equal(bible.policy.textlessArtOnly,true);
 assert.deepEqual(bible.actors.filter(x=>x.id.startsWith('commander_')).map(x=>x.id),
  ['commander_male','commander_female']);
 assert(bible.actors.some(a=>a.id==='commander_female'&&a.path.endsWith('/commander/female-master.webp')));
 if(s.slot>=3){
  assert.equal(contract.canonicalStageName,s.name);
  assert.equal(contract.stageSetup,STORY_STAGE_BEATS[0][s.slot-1][0]);
  assert.equal(contract.verifiedVictoryBeat,STORY_STAGE_BEATS[0][s.slot-1][1]);
  assert.equal(contract.canonicalWinCondition,s.winCondition);
  assert.equal(contract.existingGithubDrafts,0);
 }
 assert.equal(comicEditionsForStage(stageId).length,4,
  'Chapter1 stage must have pre/victory/defeat/gameover outcomes; no decision invented');
 for(const gender of allowedGender)for(const phase of ['pre','post-victory','post-defeat','post-gameover']){
  const v=contract.variants.find(x=>x.gender===gender&&x.edition===phase);
  assert(v);
  assert.equal(v.count,counts[phase]);
  assert.deepEqual(v.posterMinNativePixels,[3072,Math.ceil(v.count/2)*864]);
  assert.deepEqual(v.posterPreferredNativePixels,[4096,Math.ceil(v.count/2)*1152]);
  assert.equal(v.nativeAssembly.realSceneCount,v.count);
  const context={protagonistGender:gender};
  if(phase==='post-victory')context.battleOutcome={victory:true};
  if(phase==='post-defeat')context.battleOutcome={victory:false};
  if(phase==='post-gameover')context.battleOutcome={victory:false,playerCommanderDead:true};
  const comic=comicForStage(stageId,phase==='pre'?'pre':'post',context);
  assert.deepEqual(v.scriptPanelIds,comic.panels.map(p=>p.id));
  for(const frame of v.scriptPanelIds){
   const shot=stageId+'|'+phase+'|'+gender+'|'+frame;
   assert(!uniqueShots.has(shot));uniqueShots.add(shot);
  }
  assert(!uniqueFiles.has(v.posterInput));uniqueFiles.add(v.posterInput);
  assert(v.posterInput.includes(stageId+'-'+phase+'-'+gender+'-p01.webp'));
 }
}
assert.equal(uniqueShots.size,432);
assert.equal(uniqueFiles.size,72);
const proc=spawnSync(process.execPath,['scripts/run-story-stage-range.mjs',
 '--start','c01-s02','--through','c01-s10','--prepare-only'],{
 cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
assert.equal(proc.status,0,proc.stdout+'\n'+proc.stderr);
const dir=path.join(root,'qa-reports/story-stage-production/range-c01-s02-through-c01-s10');
const summary=JSON.parse(fs.readFileSync(path.join(dir,'range-summary.json'),'utf8'));
assert.deepEqual(summary.stages.map(x=>x.stageId),stageIds);
assert.equal(summary.canonicalSceneCount,432);
assert.equal(summary.actualNewArtGenerated,0);
assert.equal(summary.qualityApproved,false);
assert.equal(summary.gameAssetRegistration,false);
assert.equal(summary.deployedNewArt,false);
assert.equal(summary.imageGeneratorAttached,false);
assert.deepEqual(summary.bulkBatches.map(x=>x.count),[100,100,100,100,32]);
assert.deepEqual(summary.bulkBatches.map(x=>x.sheetCount),[10,10,10,10,4]);
assert.deepEqual(summary.bulkBatches.map(x=>x.blocked),[10,10,10,10,4]);
assert.deepEqual(summary.bulkBatches.map(x=>x.assembled),[0,0,0,0,0]);
const bulkKeys=new Set();
for(const b of summary.bulkBatches){
 const report=JSON.parse(fs.readFileSync(path.join(root,b.statusReport),'utf8'));
 assert.equal(report.newArtActuallyGenerated,0);
 assert.equal(report.approved,false);
 assert.equal(report.deployed,false);
 for(const g of report.groups)for(const p of g.frames){
  assert(!bulkKeys.has(p.shotKey),'Duplicate scene in 100-frame batches: '+p.shotKey);
  bulkKeys.add(p.shotKey);
  assert.equal(p.approved,false);
  assert.equal(p.visualQA,'PENDING');
 }
}
assert.equal(bulkKeys.size,432);
assert.equal([...bulkKeys].filter(k=>k.startsWith('c01-s10|')).length,48);
assert.equal(summary.stages.at(-1).stageId,'c01-s10');
console.log('PASS chapter 1 s02-s10: 9 locked contracts, 8 editions per stage, 432 unique frames, 100+100+100+100+32, all P0-blocked without real native art and visual QA. No images fabricated.');
