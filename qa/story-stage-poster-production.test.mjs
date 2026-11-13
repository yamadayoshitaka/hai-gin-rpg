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
assert.equal(data.schemaVersion,3);
assert.equal(data.noPaidAPICalls,true);
assert.equal(data.artGeneratorAttached,false);
assert.equal(data.absolutePriority,'P0_ABSOLUTE_MUST_FOLLOW');
assert.equal(data.failClosedOnMissingReferenceBytes,true);
assert.equal(data.outputIsOnlyInstructions,true);
assert.equal(data.shotWorkflow,'SCREENPLAY_CONTEXT_PREVIOUS_CURRENT_NEXT_REAL_CAST_REFERENCES_PER_SHOT');
assert.equal(data.imageSpec.aspectRatio,'16:9');
assert.deepEqual(data.imageSpec.minimumNativePixels,[1536,864]);
assert.deepEqual(data.imageSpec.preferredNativePixels,[2048,1152]);
assert.equal(data.imageSpec.maxCellsPerReviewSheet,10);
assert.deepEqual(data.imageSpec.fullTenCellPreferredPixels,[4096,5760]);
assert.equal(data.imageSpec.fullTenCellGeneratorCapability,'UNVERIFIED_DO_NOT_ASSUME');
assert.equal(data.reviewSheetPolicy.maxPanels,10);
assert.equal(data.reviewSheetPolicy.rowsForTen,5);
assert.deepEqual(data.reviewSheetPolicy.preferredTenPanelSheetPixels,[4096,5760]);
assert.equal(data.imageSpec.safeCompositionMarginPercent,5);
assert.equal(data.stages.length,2);
assert.deepEqual(data.stages.map(s=>s.stageId),['c01-s02','c01-s03']);
assert.equal(data.totals.requiredPosters,16);
assert.equal(data.totals.requiredPanels,96);
assert.equal(data.totals.approvedPanels,0);
assert.equal(data.totals.registeredDraftPanels,15);
assert.equal(data.totals.missingPanels,81);

const saved=new Set(),posters=new Set(),shotKeys=new Set();
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
  assert.equal(poster.posterSpec.columns,2);
  assert.equal(poster.posterSpec.rows,Math.ceil(edition.panels/2));
  assert.deepEqual(poster.posterSpec.minNativePixels,[3072,poster.posterSpec.rows*864]);
  assert.deepEqual(poster.posterSpec.preferredNativePixels,[4096,poster.posterSpec.rows*1152]);
  assert.equal(poster.posterSpec.maxCellCount,10);
  assert.equal(poster.posterSpec.blankCells,poster.posterSpec.rows*2-edition.panels);
  assert.equal(poster.posterSpec.assemblyMode,'INDIVIDUAL_NATIVE_FRAMES_FIRST_THEN_LOSSLESS_REVIEW_SHEET');
  assert.equal(poster.posterSpec.reviewOnlyNotGameArtwork,true);
  assert.equal(poster.posterSpec.previewCannotBeRegisteredAsFinalArt,true);
  assert(poster.textFreePrompt.startsWith('CONTINUITY PREVIEW ONLY'));
  assert.equal(poster.panels.length,phaseCounts[edition.edition]);

  for(const [i,panel] of poster.panels.entries()){
   assert(!saved.has(panel.individualAsset),'Collision between outcomes: '+panel.individualAsset);
   saved.add(panel.individualAsset);
   assert(!shotKeys.has(panel.shotKey),'Duplicate full shot key: '+panel.shotKey);
   shotKeys.add(panel.shotKey);
   assert.equal(panel.approval.approved,false);
   assert.equal(panel.manualReviewRequired,true);
   assert.deepEqual(panel.individualMinPixels,[1536,864]);
   assert.equal(panel.imageSpec.pixelWidth,1536);
   assert.equal(panel.imageSpec.pixelHeight,864);
   assert.equal(panel.imageSpec.aspectRatio,'16:9');
   assert.equal(panel.imageSpec.safeCompositionMarginPercent,5);
   assert(panel.scriptText.length>0&&panel.voiceText.length>0,
     'Script and voice must be captured for each frame');
   assert.equal(panel.scriptText,panel.narrative.currentScene.scriptText);
   assert.equal(panel.speaker,panel.narrative.currentScene.speaker);
   assert.equal(panel.shotKey,panel.narrative.currentScene.shotKey);
   assert.equal(panel.globalOrder,i+1);
   assert(panel.shotKey.includes('|'+edition.edition+'|'+edition.gender+'|'));
   assert(panel.qualityReferenceImage.endsWith('-'+edition.gender+'.webp'));
   assert(panel.qualityReferenceStatus.includes('NOT_HUMAN_APPROVED'));
   assert.equal(panel.attachmentGate,'ATTACH_REAL_IMAGE_BYTES_BEFORE_GENERATION');
   assert.equal(panel.absolutePriority,'P0_ABSOLUTE_MUST_FOLLOW');
   assert.equal(panel.realCastImageBytesAttached,false);
   assert.equal(panel.renderReady,false);
   assert.equal(panel.renderBlockedReason,'REAL_REFERENCE_IMAGE_BYTES_NOT_ATTACHED_BY_PREFLIGHT');
   assert(panel.generationPrompt.startsWith('P0_ABSOLUTE_MUST_FOLLOW.'));
   assert(panel.generationPrompt.includes('P0_NO_TEXT_UI_IN_ART'));
   assert(panel.generationPrompt.includes('P0_REFERENCE_IMAGE_BYTES'));
   assert(panel.generationPrompt.includes('P0_FINAL_DOUBLE_CHECK'));
   assert(panel.requiredChecks.includes('rejectAnyInImageTextOrUI'));
   assert(panel.requiredChecks.includes('failClosedOnMissingActualImageBytes'));
   assert(panel.requiredCharacterReferences.length>0);
   assert(panel.requiredCharacterReferences.every(x=>x.requiresActualImageBytes&&
    x.attachmentStatus==='NOT_ATTACHED_BY_PREFLIGHT'));
   assert(panel.generationPrompt.includes('CURRENT EXACT SCREENPLAY BEAT: '+panel.scriptText),
    'Each shot must follow its own screenplay, not a generic poster prompt');
   assert(panel.generationPrompt.includes('1536x864'));
   assert(panel.generationPrompt.includes('2048x1152'));
   assert(panel.generationPrompt.includes('PREVIOUS SCENE for continuity ONLY'));
   assert(panel.generationPrompt.includes('NEXT SCENE for continuity ONLY'));
   assert(panel.generationPrompt.includes('NO text, Japanese letters, numbers'));
   assert(panel.generationPrompt.includes(panel.shotKey));
   assert(panel.requiredChecks.includes('sceneMatchesExactScript'));
   assert(panel.requiredChecks.includes('realCastImagesAttached'));
   assert(panel.requiredChecks.includes('safeArea5Percent'));
   assert(panel.requiredChecks.includes('outputSha256Recorded'));
   assert(!panel.requiredChecks.includes('sha256MatchesApprovedReference'));
   if(i===0)assert.equal(panel.narrative.previousScene,null);
   else assert.equal(panel.narrative.previousScene.panelId,poster.panels[i-1].panelId);
   if(i===poster.panels.length-1)assert.equal(panel.narrative.nextScene,null);
   else assert.equal(panel.narrative.nextScene.panelId,poster.panels[i+1].panelId);
   if(edition.edition==='pre'){
    assert(panel.narrative.verifiedOutcome.startsWith('PRE_BATTLE_NO_RESULT'));
    assert(panel.generationPrompt.includes('PRE_BATTLE_NO_RESULT'));
   }
   if(edition.edition==='post-victory')assert(panel.narrative.verifiedOutcome.startsWith('VERIFIED_VICTORY'));
   if(edition.edition==='post-defeat')assert(panel.narrative.verifiedOutcome.startsWith('VERIFIED_DEFEAT'));
   if(edition.edition==='post-gameover'){
    assert(panel.narrative.verifiedOutcome.startsWith('COMMANDER_DEATH'));
    assert(panel.panelId.includes('death'));
   }
   if(stage.stageId==='c01-s02'){
    const hero=panel.requiredCharacterReferences.find(x=>x.actorId==='commander_'+edition.gender);
    assert(hero&&hero.sourceExists,'Actual stage2 hero master must exist: '+edition.gender);
    if(edition.gender==='female')
     assert(hero.sourceImage.endsWith('/commander/female-master.webp'));
   }
   if(panel.reuseCandidate){
    assert.equal(edition.gender,'female');
    assert.equal(stage.stageId,'c01-s02');
    assert(panel.reuseCandidate.decision.includes('NOT_AUTOMATIC'));
   }
  }
 }
}
assert.equal(saved.size,96);
assert.equal(posters.size,16);
assert.equal(shotKeys.size,96);
console.log('PASS: 96 gender/outcome scenes, 1536x864 16:9 shot-specific screenplay prompts, previous/next context, actual cast source requirements, no paid API, no false approval');
