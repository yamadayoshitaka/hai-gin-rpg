import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from '../src/story-chapter-comic.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';
import {storyDecisionForStage} from '../src/story-narrative-flow.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ids=Array.from({length:10},(_,i)=>'c02-s'+String(i+1).padStart(2,'0'));
const genders=['male','female'];
const expectedBySlot=[30,48,48,48,160,48,48,48,48,48];
const editionsBySlot=[4,8,8,8,24,8,8,8,8,8];
const existingAssets=new Set(),actualKeys=new Set();
const policyChoices=['rescue','evidence'];
const maxTotal=expectedBySlot.reduce((a,b)=>a+b,0);
assert.equal(maxTotal,574);
let total=0;
for(const stageId of ids){
 const s=CAMPAIGN_STAGE_BY_ID[stageId];
 assert(s&&s.chapter===2);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,
  'assets/story/stage-manifests',stageId+'.manifest.json'),'utf8'));
 const bible=JSON.parse(fs.readFileSync(path.join(root,
  'assets/story/characters',stageId+'-reference-bible.json'),'utf8'));
 const slot=s.slot;
 assert.equal(manifest.schemaVersion,4);
 assert.equal(manifest.kind,'STAGE_RENDER_CONTRACT_NOT_COMPLETED_ART');
 assert.equal(manifest.stageId,stageId);
 assert.equal(manifest.canonicalStageName,s.name,'stage should use canonical game name');
 assert.equal(manifest.canonicalWinCondition,s.winCondition);
 assert.equal(manifest.canonicalStageKind,s.kind);
 assert.equal(manifest.stageSetup,STORY_STAGE_BEATS[1][slot-1][0]);
 assert.equal(manifest.verifiedVictoryBeat,STORY_STAGE_BEATS[1][slot-1][1]);
 assert.equal(manifest.layout.requiredPanels,expectedBySlot[slot-1],
  'Town / policy branch panels must match stage-specific canon');
 assert.equal(manifest.layout.variantCount,editionsBySlot[slot-1]);
 assert.equal(manifest.variants.length,editionsBySlot[slot-1]);
 assert.equal(manifest.layout.maxPanelsPerPoster,10);
 assert.deepEqual(manifest.layout.preferredPerPanelNativePixels,[2048,1152]);
 assert.deepEqual(manifest.layout.nativeSheetPipeline.preferredFullTenPanelSheetPixels,[4096,5760]);
 assert.equal(manifest.layout.bulkNativeSheetBatches.maxCanonicalFramesPerBatch,100);
 assert.equal(manifest.layout.bulkNativeSheetBatches.stageSpecificCanonicalScenes,expectedBySlot[slot-1]);
 assert.equal(manifest.criticalPriorityPolicy.priority,'P0_ABSOLUTE_MUST_FOLLOW');
 assert.equal(manifest.criticalPriorityPolicy.failClosed,true);
 assert.equal(manifest.singleInvocation.artRendererConnected,false);
 assert.equal(manifest.productionStatus,'SCRIPTED_LOCKED_NOT_AI_RENDERED_OR_APPROVED');
 assert.equal(manifest.qualityApproved,false);
 assert.equal(manifest.complete,false);
 assert.equal(manifest.deployedNewImages,false);
 assert.equal(manifest.existingGithubDrafts,0);
 assert.equal(bible.stageId,stageId);
 assert.equal(bible.policy.attachRealImageBytesToGeneration,true);
 assert.equal(bible.policy.doNotRelyOnPathStringsAlone,true);
 assert.equal(bible.policy.textlessArtOnly,true);
 assert(bible.actors.some(a=>a.id==='mina'&&a.path==='assets/story-cinema/cast/mina.webp'));
 assert(bible.actors.some(a=>a.id==='commander_female'&&
  a.path==='assets/story/characters/commander/female-master.webp'));
 assert(bible.actors.some(a=>a.id==='commander_male'));
 assert(bible.actors.some(a=>a.id==='lucia'));
 assert(bible.actors.some(a=>a.id==='iris'));
 const compiledEditions=comicEditionsForStage(stageId);
 assert.equal(compiledEditions.length,slot===1?2:slot===5?12:4);
 const m=new Map(manifest.variants.map(v=>[v.edition+'|'+v.gender,v]));
 assert.equal(m.size,manifest.variants.length);
 for(const edition of compiledEditions){
  for(const gender of genders){
   const key=edition.edition+'|'+gender;
   const v=m.get(key);
   assert(v,'Missing canonical branch '+stageId+' '+key);
   const context={protagonistGender:gender};
   if(edition.edition.startsWith('post-victory'))context.battleOutcome={victory:true};
   if(edition.edition.startsWith('post-defeat'))context.battleOutcome={victory:false};
   if(edition.edition.startsWith('post-gameover'))context.battleOutcome={victory:false,playerCommanderDead:true};
   if(edition.edition.includes('-choice-'))context.decision=edition.edition.split('-choice-')[1];
   const trueComic=comicForStage(stageId,edition.phase,context);
   assert.equal(trueComic.edition,edition.edition);
   assert.equal(trueComic.pages.length,1);
   assert.equal(v.count,trueComic.panels.length,
    'Variant missing or fabricating a script shot: '+stageId+' '+key);
   assert.deepEqual(v.scriptPanelIds,trueComic.panels.map(p=>p.id));
   assert(v.count>=2&&v.count<=10);
   assert.deepEqual(v.posterMinNativePixels,[3072,Math.ceil(v.count/2)*864]);
   assert.deepEqual(v.posterPreferredNativePixels,[4096,Math.ceil(v.count/2)*1152]);
   assert.equal(v.nativeAssembly.rows,Math.ceil(v.count/2));
   assert.equal(v.nativeAssembly.blankCellCount,Math.ceil(v.count/2)*2-v.count);
   assert.equal(v.nativeAssembly.approval,'NOT_APPROVED');
   assert.equal(v.numberedArt,false);
   assert.equal(v.status,'SCRIPTED_NOT_APPROVED_NO_SOURCE_IMAGE');
   assert.equal(v.posterInput,
    'assets/story/chapter-drafts/c02/posters/'+stageId+'-'+edition.edition+'-'+gender+'-p01.webp');
   assert(!existingAssets.has(v.posterInput),'Poster file overlap: '+v.posterInput);
   existingAssets.add(v.posterInput);
   for(const id of v.scriptPanelIds){
    const full=[stageId,edition.edition,gender,id].join('|');
    assert(!actualKeys.has(full),'Overlapping branch-scene key '+full);
    actualKeys.add(full);
    assert(id.startsWith(stageId+'-'),'Wrong stage panel ID '+id);
   }
  }
 }
 if(slot===1){
  assert.equal(s.kind,'town');
  assert.deepEqual(compiledEditions.map(e=>e.edition),['pre','post-town']);
  assert.equal(manifest.branching.selectionMode,'TOWN_NO_BATTLE');
  assert(manifest.branching.doNotInventVictoryDefeatOrGameover);
 }
 if(slot===5){
  assert.equal(manifest.branching.selectionMode,'OPTIONAL_PLAYER_POLICY');
  assert.deepEqual(manifest.branching.policyChoices.map(c=>c.id),policyChoices);
  assert.deepEqual(storyDecisionForStage(stageId).choices.map(c=>c[0]),policyChoices);
  assert(compiledEditions.some(e=>e.edition==='post-defeat-choice-rescue'));
  assert(compiledEditions.some(e=>e.edition==='post-gameover-choice-evidence'));
  assert(compiledEditions.some(e=>e.edition==='pre-choice-rescue'));
  assert(compiledEditions.some(e=>e.edition==='pre-choice-evidence'));
  assert.equal(m.get('post-gameover-choice-rescue|female').count,3);
  assert.equal(m.get('post-gameover-choice-evidence|male').count,3);
 }
 total+=manifest.layout.requiredPanels;
}
assert.equal(total,574);
assert.equal(actualKeys.size,574);
assert.equal(existingAssets.size,92);
const prepared=spawnSync(process.execPath,['scripts/run-story-stage-range.mjs',
 '--start','c02-s01','--through','c02-s10','--prepare-only'],{
 cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});
assert.equal(prepared.status,0,prepared.stdout+'\n'+prepared.stderr);
const dir=path.join(root,'qa-reports/story-stage-production/range-c02-s01-through-c02-s10');
const report=JSON.parse(fs.readFileSync(path.join(dir,'range-summary.json'),'utf8'));
assert.deepEqual(report.stages.map(s=>s.stageId),ids);
assert.deepEqual(report.stages.map(s=>s.canonicalFrames),expectedBySlot);
assert.equal(report.canonicalSceneCount,574);
assert.equal(report.actualNewArtGenerated,0);
assert.equal(report.qualityApproved,false);
assert.equal(report.gameAssetRegistration,false);
assert.equal(report.deployedNewArt,false);
assert.equal(report.imageGeneratorAttached,false);
assert.deepEqual(report.bulkBatches.map(b=>b.count),[100,100,100,100,100,74]);
assert.deepEqual(report.bulkBatches.map(b=>b.sheetCount),[10,10,10,10,10,8]);
assert.deepEqual(report.bulkBatches.map(b=>b.assembled),[0,0,0,0,0,0]);
assert.deepEqual(report.bulkBatches.map(b=>b.blocked),[10,10,10,10,10,8]);
const found=new Set();
for(const b of report.bulkBatches){
 const q=JSON.parse(fs.readFileSync(path.join(root,b.statusReport),'utf8'));
 assert.equal(q.approved,false);
 assert.equal(q.deployed,false);
 assert.equal(q.newArtActuallyGenerated,0);
 for(const g of q.groups)for(const p of g.frames){
  assert(actualKeys.has(p.shotKey),'Unexpected scene in bulk queue '+p.shotKey);
  assert(!found.has(p.shotKey),'Duplicate in bulk queue '+p.shotKey);
  found.add(p.shotKey);
  assert.equal(p.approved,false);
  assert.equal(p.visualQA,'PENDING');
  assert.equal(p.imageTextAllowed,false);
 }
}
assert.equal(found.size,574);
console.log('PASS chapter2: 10 stages, 92 gender/outcome/choice variants, 574 exact scenes in 100x5+74, town no fake battle, choice-rescue/evidence branches distinct, P0 fail-closed, original art not fabricated.');
