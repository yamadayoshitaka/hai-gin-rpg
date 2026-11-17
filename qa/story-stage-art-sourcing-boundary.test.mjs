import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COMPACT_TWENTY_CHAPTER_PLAN,compactComicForStage} from '../src/story-compact-comic.js';
import {oldStoryArtReuseAllowed,requiresNewStoryArt,
 STORY_NEW_ART_FIRST_STAGE} from '../src/story-art-sourcing-policy.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {restoredStoryArchivePanel,RESTORED_STORY_ARCHIVE} from '../src/story-archive-restored-art.js';
import {chapter1ProvisionalLivePanel} from '../src/story-chapter1-provisional-live.js';
import {NEW_STORY_ORIGINAL_ART} from '../src/story-new-original-art.js';

assert.equal(STORY_NEW_ART_FIRST_STAGE,'c01-s05');
for(let n=1;n<=4;n++){
 const id='c01-s0'+n;
 assert(oldStoryArtReuseAllowed(id));
 assert(!requiresNewStoryArt(id));
}
assert(!oldStoryArtReuseAllowed('c01-s05'));
assert(requiresNewStoryArt('c01-s05'));
assert(requiresNewStoryArt('c01-s10'));
assert(requiresNewStoryArt('c02-s01'));
assert(requiresNewStoryArt('c20-s10'));
assert.deepEqual(NEW_STORY_ORIGINAL_ART,{},'New story images must not be falsely pre-registered');

const historicalExamples=[
 ['c01-s05','pre','male','c01-s05-m1'],
 ['c01-s05','pre','male','c01-s05-m15'],
 ['c01-s05','post-victory','male','c01-s05-m6'],
 ['c01-s05','post-victory','male','c01-s05-m10'],
 ['c01-s05','post-victory','female','c01-s05-m6']
];
for(const [stageId,comicEdition,gender,id] of historicalExamples){
 const shot={stageId,comicEdition,protagonistGender:gender,id};
 const key=[stageId,comicEdition,gender,id].join('|');
 assert(RESTORED_STORY_ARCHIVE[key], 'Prior restoration proof is preserved for rollback '+key);
 assert.equal(restoredStoryArchivePanel(shot),null,'Historical stage5 must not be playable');
 assert.equal(registeredStoryPanelAsset(shot),null,'Old stage5 image is blocked from game');
}
const oldFemale=chapter1ProvisionalLivePanel({
 stageId:'c01-s05',comicEdition:'pre',protagonistGender:'female',id:'c01-s05-m1'
});
assert(oldFemale,'The older female stage5 image archive must remain intact');
assert.equal(registeredStoryPanelAsset({
 stageId:'c01-s05',comicEdition:'pre',protagonistGender:'female',id:'c01-s05-m1'
}),null,'Prior owner provisional art must also be excluded');

let checked=0,oldRegistered=0,newMissing=0;
for(const chapter of COMPACT_TWENTY_CHAPTER_PLAN)
 for(const stageId of chapter.stageIds)for(const gender of ['male','female']){
  const ctx={protagonistGender:gender,chapterOpeningSeen:false};
  for(const [phase,result] of [['pre',null],['post',true]]){
   const comic=compactComicForStage(stageId,phase,
    result===null?ctx:{...ctx,battleOutcome:{victory:true}});
   for(const scene of comic.panels){
    const asset=registeredStoryPanelAsset(scene);
    if(oldStoryArtReuseAllowed(stageId)){
     if(asset)oldRegistered++;
    }else{
     assert.equal(asset,null,'An old or unapproved CG leaked to stage5+: '+stageId+'/'+scene.id);
     newMissing++;
    }
    checked++;
   }
  }
 }
assert(oldRegistered>=30,'Previous stages 1-4 image reuse unexpectedly removed');
assert(newMissing>1000);
const viewer=fs.readFileSync('src/story-manga-viewer.js','utf8');
const generator=fs.readFileSync('scripts/generate-story-chapter1-free-batch.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/story-chapter1-free-complete-draft-production.yml','utf8');
const restore=fs.readFileSync('scripts/restore-existing-story-art.mjs','utf8');
assert(viewer.includes("const sheet=oldStoryArtReuseAllowed(shot.stageId)?"),
 'Legacy sheet fallback is still available after stage4');
assert(viewer.includes("const draftArt=oldStoryArtReuseAllowed(shot.stageId)?"),
 'Legacy provisional status is still available after stage4');
assert(generator.includes("cloudflare-chapter1-new-originals"),
 'New stage5+ output must use an empty, separated production path');
assert(workflow.includes('--mode generate --max-pages 12 --start-stage "$START_STAGE" --through-stage "$THROUGH_STAGE"') && workflow.includes("START_STAGE: \${{ inputs.start_stage || 'c01-s05' }}") && workflow.includes("THROUGH_STAGE: \${{ inputs.through_stage || 'c01-s10' }}"), 'Free generator defaults to stage5 and validates optional sequential stage1-10 input');
assert(restore.includes('if(!oldStoryArtReuseAllowed(stageId))continue'));
console.log(JSON.stringify({status:'PASS',scopeOld:'c01-s01..c01-s04',
 firstNew:'c01-s05',chapters:20,stages:200,checked,
 priorReused:oldRegistered,newOnlyPlaceholders:newMissing,
 stage5ArchivedButInactive:historicalExamples.length,paidGenerationCalls:0}));
