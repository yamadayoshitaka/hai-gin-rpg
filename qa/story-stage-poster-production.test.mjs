import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output='qa-reports/story-stage-production/c01-s02-through-c01-s03.json';
execFileSync(process.execPath,['scripts/prepare-story-stage-posters.mjs',
 '--start','c01-s02','--count','2','--out',output],{cwd:root,stdio:'pipe'});
const data=JSON.parse(fs.readFileSync(path.join(root,output),'utf8'));
assert.equal(data.kind,'production-manifest-not-generated-art');
assert.equal(data.noPaidAPICalls,true);
assert.equal(data.artGeneratorAttached,false);
assert.equal(data.stages.length,2);
assert.deepEqual(data.stages.map(s=>s.stageId),['c01-s02','c01-s03']);
assert.equal(data.totals.requiredPosters,16);
assert.equal(data.totals.requiredPanels,96);
assert.equal(data.totals.approvedPanels,0);
assert.equal(data.totals.registeredDraftPanels,15);
assert.equal(data.totals.missingPanels,81);
const saved=new Set(),posters=new Set();
for(const stage of data.stages){
 assert.equal(stage.variants.length,8);
 assert.equal(stage.requiredGenderOutcomePosters,8);
 assert.equal(stage.requiredIndividualImages,48);
 assert.equal(stage.stageCompletion,'NOT_APPROVED');
 assert.equal(stage.alreadyRegisteredDraftImages,stage.stageId==='c01-s02'?15:0);
 const phaseCounts={pre:8,'post-victory':7,'post-defeat':7,'post-gameover':2};
 for(const edition of stage.variants){
  assert(edition.gender==='male'||edition.gender==='female');
  assert.equal(edition.pageCount,1);
  assert.equal(edition.panels,phaseCounts[edition.edition]);
  const poster=edition.pages[0];
  assert.equal(poster.posterSpec.cellCount,phaseCounts[edition.edition]);
  assert(!posters.has(poster.posterAsset));posters.add(poster.posterAsset);
  assert.equal(poster.posterSpec.minNativePixels[0],3072);
  assert(poster.textFreePrompt.includes('Chapter 1 Stage 1'));
  assert(poster.textFreePrompt.includes('No title, caption'));
  assert.equal(poster.panels.length,phaseCounts[edition.edition]);
  for(const panel of poster.panels){
   assert(!saved.has(panel.individualAsset),'Image filename collision between outcomes '+panel.individualAsset);
   saved.add(panel.individualAsset);
   assert.equal(panel.approval.approved,false);
   assert.equal(panel.manualReviewRequired,true);
   assert.equal(panel.individualMinPixels[0],1536);
   assert(panel.scriptText.length>0 && panel.voiceText.length>0,'Script and voice must be present');
   assert(panel.shotKey.includes('|'+edition.edition+'|'+edition.gender+'|'));
   assert(panel.qualityReferenceImage.endsWith('-'+edition.gender+'.webp'));
   assert(panel.qualityReferenceStatus.includes('NOT_HUMAN_APPROVED'));
   if(panel.reuseCandidate){
    assert.equal(edition.gender,'female');
    assert.equal(stage.stageId,'c01-s02');
    assert(panel.reuseCandidate.decision.includes('NOT_AUTOMATIC'));
   }
   if(edition.edition==='post-gameover')assert(panel.panelId.includes('death'));
  }
 }
}
assert.equal(saved.size,96);
assert.equal(posters.size,16);
console.log('PASS stage poster production: 16 scripts / 96 variant-specific frame IDs / 15 existing drafts / 81 missing / 0 approved / no paid API');
