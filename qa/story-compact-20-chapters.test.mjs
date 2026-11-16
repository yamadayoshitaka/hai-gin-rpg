import assert from 'node:assert/strict';
import {comicForStage} from '../src/story-chapter-comic.js';
import {compactComicForStage,compactChapterPlan,COMPACT_TWENTY_CHAPTER_PLAN,COMPACT_DEFEAT_LINES} from '../src/story-compact-comic.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {screenplayForStage} from '../src/story-screenplay-v2.js';
assert.equal(COMPACT_TWENTY_CHAPTER_PLAN.length,20);
assert.equal(CAMPAIGN_STAGES.length,200);
for(const plan of COMPACT_TWENTY_CHAPTER_PLAN){
 assert.equal(plan.stageIds.length,10);
 assert.equal(plan.requiredPrimaryImageSlots,44);
 const first=plan.stageIds[0];
 const opening=compactComicForStage(first,'pre',{protagonistGender:'male'});
 assert.equal(opening.panels.length,6);
 assert.deepEqual(opening.panels.slice(0,4).map(x=>x.id),['m1','m2','m3','m4'].map(x=>first+'-'+x));
 assert(opening.panels.slice(0,4).every(x=>x.isChapterOpening));
 assert.equal(compactComicForStage(first,'pre',{chapterOpeningSeen:true}).panels.length,2);
 for(const stageId of plan.stageIds){
  const pre=compactComicForStage(stageId,'pre',{chapterOpeningSeen:true,protagonistGender:'female'});
  assert.equal(pre.panels.length,2,stageId+' pre');
  for(const [suffix,context] of [
   ['victory',{battleOutcome:{victory:true}}],
   ['defeat',{battleOutcome:{victory:false}}],
   ['gameover',{battleOutcome:{victory:false,playerCommanderDead:true}}]
  ]){
   const post=compactComicForStage(stageId,'post',{...context,protagonistGender:'female'});
   assert.equal(post.panels.length,2,stageId+'/'+suffix);
   assert(post.panels.every(x=>x.dialogueTurns.length>0));
   assert(post.panels.every(x=>x.protagonistGender==='female'));
   if(suffix==='defeat' && post.edition.startsWith('post-defeat'))assert.deepEqual(post.panels.map(x=>x.text),COMPACT_DEFEAT_LINES);
  }
 }
}
const s='c01-s02';
const legacy=comicForStage(s,'pre',{protagonistGender:'female'});
const compact=compactComicForStage(s,'pre',{protagonistGender:'female'});
assert.deepEqual(compact.panels.map(x=>x.id),[s+'-m1',s+'-m15']);
assert(legacy.panels.length>compact.panels.length);
assert(compact.panels.every(x=>x.originalSceneId===x.id));
const originalScript=screenplayForStage(s,{protagonistGender:'female'});
assert.deepEqual(compact.panels.flatMap(p=>p.dialogueTurns.map(t=>t.text)),
 originalScript.pre.map(t=>t.text),
 'Compact images must play all current stage-specific dialogue, not obsolete repeated legacy lines');
assert.equal(compact.dialogueCount,originalScript.pre.length);
assert.equal(new Set(compact.panels.flatMap(p=>p.dialogueTurns.map(t=>t.text))).size,
 compact.dialogueCount,'Do not repeat the same line in one stage');
for(const chapter of COMPACT_TWENTY_CHAPTER_PLAN){
 const first=chapter.stageIds[0];
 const intro=compactComicForStage(first,'pre',{protagonistGender:'male'});
 const oneTimeOpening=intro.panels.slice(0,4).map(p=>p.text);
 for(const otherId of chapter.stageIds.slice(1)){
  const story=compactComicForStage(otherId,'pre',{protagonistGender:'male'});
  const dialogue=story.panels.flatMap(p=>p.dialogueTurns.map(t=>t.text));
  assert(dialogue.every(t=>!oneTimeOpening.includes(t)),
   'Chapter opening text must not recur across stages: '+otherId);
 }
}
console.log('PASS: all 200 stages, unchanged CG IDs, per-stage dialogue, no repeated chapter-openers, outcome-specific audio turns');
