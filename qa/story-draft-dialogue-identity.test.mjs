import assert from 'node:assert/strict';
import {sourceDraftDialogueMatches} from '../src/story-draft-dialogue-identity.js';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';

const frames=chapterOneReviewPages().flatMap(x=>x.shots);
for(const [id,beat] of [
 ['c01-s02','礼拝堂の死者名簿が消えた夜、郊外の魔物が街道を塞ぐ。'],
 ['c01-s03','王城へ戻る補給路が不審な使者に押さえられる。']
]){
 const s=frames.find(s=>s.stageId===id&&s.edition==='pre'&&
  s.gender==='female'&&s.shotId===id+'-m1');
 assert(s,'Archived female first-scene source was lost: '+id);
 assert.equal(STORY_STAGE_BEATS[0][Number(id.slice(-2))-1][0],beat);
 const params={stageId:id,edition:'pre',shotId:s.shotId,
  currentText:s.scriptText,sourceText:beat};
 assert(sourceDraftDialogueMatches(params),'Safe scene beat must survive narration prefix: '+id);
 assert(sourceDraftDialogueMatches({...params,sourceText:s.scriptText}), 'Exact source text valid');
 assert.equal(sourceDraftDialogueMatches({...params,sourceText:beat+'誤'}),false);
 assert.equal(sourceDraftDialogueMatches({...params,currentText:'別場面。'+beat}),false);
 assert.equal(sourceDraftDialogueMatches({...params,edition:'post-victory'}),false);
 assert.equal(sourceDraftDialogueMatches({...params,shotId:id+'-m2'}),false);
 assert.equal(sourceDraftDialogueMatches({...params,stageId:'c01-s04'}),false);
}
// No accidental approval of a different gender or outcome. The manifest
// checks gender and image SHA independently of this text-only guard.
assert.equal(sourceDraftDialogueMatches({stageId:'none',edition:'pre',shotId:'none-m1',
 currentText:'different',sourceText:'old'}),false);
console.log('PASS: exact archived scene beat migration with fail-closed drift guards');
