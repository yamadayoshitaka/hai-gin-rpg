import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reportPath='qa-reports/story-stage-production/c01-s02-through-c01-s03.json';
execFileSync(process.execPath,['scripts/prepare-story-stage-posters.mjs',
 '--start','c01-s02','--count','2','--out',reportPath],{cwd:ROOT,stdio:'pipe'});
const report=JSON.parse(fs.readFileSync(path.join(ROOT,reportPath),'utf8'));
assert.equal(report.kind,'production-manifest-not-generated-art');
assert.equal(report.noPaidAPICalls,true);
assert.equal(report.artGeneratorAttached,false);
assert.equal(report.absolutePriority,'P0_ABSOLUTE_MUST_FOLLOW');
assert.equal(report.failClosedOnMissingReferenceBytes,true);
assert.equal(report.outputIsOnlyInstructions,true);
assert.deepEqual(report.imageSpec.minimumNativePixels,[1536,864]);
assert.deepEqual(report.mobileImageSpec.minimumNativePixels,[768,320]);
assert.equal(report.mobileImageSpec.aspectRatioPolicy,'PRESERVE_ORIGINAL_ASPECT_WITH_OBJECT_FIT_CONTAIN');
assert.deepEqual(report.imageSpec.preferredNativePixels,[2048,1152]);
assert.equal(report.imageSpec.maxCellsPerReviewSheet,10);
assert.equal(report.imageSpec.stage2MaxCellsPerReviewSheet,5);
assert.deepEqual(report.imageSpec.fullFiveCellPreferredPixels,[4096,3456]);
assert.equal(report.imageSpec.fullFiveCellGeneratorCapability,'UNVERIFIED_DO_NOT_ASSUME');
assert.equal(report.reviewSheetPolicy.maxPanels,10);
assert.equal(report.reviewSheetPolicy.stageOverrides['c01-s02'],5);
assert.equal(report.reviewSheetPolicy.rowsForFive,3);
assert.deepEqual(report.reviewSheetPolicy.preferredFivePanelSheetPixels,[4096,3456]);
assert.deepEqual(report.stages.map(x=>x.stageId),['c01-s02','c01-s03']);
assert.deepEqual(report.totals,{
 stageCount:2,requiredPosters:22,requiredPanels:96,registeredDraftPanels:15,
 missingPanels:81,approvedPanels:0
});
const stageContract=JSON.parse(fs.readFileSync(
 path.join(ROOT,'assets/story/stage-manifests/c01-s02.manifest.json'),'utf8'));
assert.equal(stageContract.layout.maxPanelsPerPoster,5);
assert.equal(stageContract.layout.nativeSheetPipeline.maximumFramesPerSheet,5);
assert.equal(stageContract.activeP0BatchPolicy.maxPanelsPerSheet,5);
assert.equal(stageContract.continuation.remainingSceneCount,25);
assert.equal(stageContract.continuation.existingSceneCount,23);
assert.equal(stageContract.continuation.pendingSheetCount,8);
assert.equal(stageContract.continuation.newActualRegisteredWebps,0);
const pendingKeys=stageContract.continuation.pendingGroups.flatMap(v=>
 v.panels.map(p=>[v.edition,v.gender,p].join('|')));
assert.equal(pendingKeys.length,25);
assert.equal(new Set(pendingKeys).size,25);
const assets=new Set(),keys=new Set(),posters=new Set();
for(const stage of report.stages){
 assert.equal(stage.variants.length,8);
 const maxCells=stage.stageId==='c01-s02'?5:10;
 assert.equal(stage.maxReviewCells,maxCells);
 assert.equal(stage.requiredGenderOutcomePosters,stage.stageId==='c01-s02'?14:8);
 assert.equal(stage.requiredIndividualImages,48);
 assert.equal(stage.stageCompletion,'NOT_APPROVED');
 const expected={pre:8,'post-victory':7,'post-defeat':7,'post-gameover':2};
 for(const edition of stage.variants){
  assert.equal(edition.panels,expected[edition.edition]);
  assert.equal(edition.pageCount,Math.ceil(edition.panels/maxCells));
  let seen=0;
  for(const page of edition.pages){
   assert(page.panels.length>=1&&page.panels.length<=maxCells,'P0: oversized review sheet');
   assert.equal(page.posterSpec.maxCellCount,maxCells);
   assert.equal(page.posterSpec.cellCount,page.panels.length);
   assert.equal(page.posterSpec.columns,2);
   assert.equal(page.posterSpec.rows,Math.ceil(page.panels.length/2));
   assert(page.posterSpec.rows<=Math.ceil(maxCells/2));
   assert.equal(page.posterSpec.blankCells,page.posterSpec.rows*2-page.panels.length);
   assert.deepEqual(page.posterSpec.minNativePixels,stage.stageId==='c01-s02'?
    [1536,page.posterSpec.rows*320]:[3072,page.posterSpec.rows*864]);
   assert.deepEqual(page.posterSpec.preferredNativePixels,[4096,page.posterSpec.rows*1152]);
   assert.equal(page.posterSpec.reviewOnlyNotGameArtwork,true);
   assert.equal(page.posterSpec.previewCannotBeRegisteredAsFinalArt,true);
   assert(!posters.has(page.posterAsset),'No duplicated review sheet '+page.posterAsset);
   posters.add(page.posterAsset);
   assert.equal(page.panelIds.length,page.panels.length);
   for(const panel of page.panels){
    assert.equal(panel.panelId,page.panelIds[panel.order-1]);
    assert.equal(panel.order,(seen%maxCells)+1);
    assert.equal(panel.globalOrder,seen+1);
    assert(!assets.has(panel.individualAsset),'No reused image across gender/outcome');
    assert(!keys.has(panel.shotKey),'No reused canonical shot key');
    assets.add(panel.individualAsset);keys.add(panel.shotKey);
    assert(panel.shotKey.includes('|'+edition.edition+'|'+edition.gender+'|'));
    assert.equal(panel.realCastImageBytesAttached,false);
    assert.equal(panel.renderReady,false);
    assert.equal(panel.approval.approved,false);
    assert.equal(panel.manualReviewRequired,true);
    assert.deepEqual(panel.individualMinPixels,stage.stageId==='c01-s02'?[768,320]:[1536,864]);
    assert(panel.generationPrompt.startsWith('P0_ABSOLUTE_MUST_FOLLOW.'));
    for(const token of ['P0_REFERENCE_IMAGE_BYTES','P0_NO_TEXT_UI_IN_ART',
      'P0_FINAL_DOUBLE_CHECK','CURRENT EXACT SCREENPLAY BEAT: '+panel.scriptText,
      '2048x1152',stage.stageId==='c01-s02'?'768x320':'1536x864',
      'NO text, Japanese letters, numbers'])
     assert(panel.generationPrompt.includes(token),'Missing '+token);
    assert.equal(panel.narrative.currentScene.shotKey,panel.shotKey);
    assert(panel.narrative.previousScene===null||panel.narrative.previousScene.panelId!==panel.panelId);
    if(stage.stageId==='c01-s02'&&panel.castAssignment?.renderMode==='ENVIRONMENT_ONLY')
     assert.deepEqual(panel.requiredCharacterReferences,[],'Death ending must contain no characters');
    else assert(panel.requiredCharacterReferences.length>0);
    assert(panel.requiredCharacterReferences.every(r=>r.requiresActualImageBytes&&
      r.attachmentStatus==='NOT_ATTACHED_BY_PREFLIGHT'));
    assert(panel.requiredChecks.includes('rejectAnyInImageTextOrUI'));
    assert(panel.requiredChecks.includes('sceneMatchesExactScript'));
    assert(panel.requiredChecks.includes('realNativeDetail'));
    if(stage.stageId==='c01-s02'){
     const hero=panel.requiredCharacterReferences.find(r=>r.actorId==='commander_'+edition.gender);
     if(panel.castAssignment?.renderMode==='ENVIRONMENT_ONLY') assert.equal(hero,undefined);
      else assert(hero&&hero.sourceExists);
     if(edition.gender==='female'&&hero)
      assert(hero.sourceImage.endsWith('/commander/female-master.webp'));
    }
    seen++;
   }
  }
  assert.equal(seen,expected[edition.edition]);
 }
}
assert.equal(assets.size,96);
assert.equal(keys.size,96);
assert.equal(posters.size,22);
console.log('PASS: c01-s02 mobile 768x320 true-native cuts, <=5 shots/sheet; other stages retain legacy contract; 96 unique scene briefs without false approval');
