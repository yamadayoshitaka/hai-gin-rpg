import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {buildChapter1ImagePrompt} from '../src/story-chapter1-image-prompt.js';
import {chooseFirstPage,validateFiveShotPage,reviewUrl,buildFiveShotPacket} from '../src/story-chatgpt-five-shot-queue.js';
const all=chapterOneReviewPages();
const page=chooseFirstPage(all);
assert.equal(page.stageId,'c01-s05');
assert.equal(page.gender,'male');
assert.equal(page.edition,'pre');
assert.equal(page.pageWithinVariant,1);
assert.equal(page.shots.length,5);
assert.deepEqual(page.shots.map(s=>s.shotId),[
 'c01-s05-m1','c01-s05-m2','c01-s05-m3','c01-s05-m4','c01-s05-m5'
]);
const fem=chooseFirstPage(all,{stageId:'c01-s05',gender:'female',edition:'pre'});
assert.equal(fem.shots.length,5);
assert(fem.shots.every(s=>s.gender==='female'));
const rules=JSON.parse(fs.readFileSync('assets/story/quality/artwork-p0-rules.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('assets/story/stage-manifests/c01-s05.manifest.json','utf8'));
const bible=JSON.parse(fs.readFileSync('assets/story/characters/c01-s05-reference-bible.json','utf8'));
const prompts=page.shots.map(shot=>({
 shotKey:shot.key,prompt:buildChapter1ImagePrompt({
  shot,page,bible,stageManifest:manifest,qualityRules:rules
 })
}));
const packet=buildFiveShotPacket(page,prompts);
assert(packet.includes('1コマずつ'));
assert(packet.includes('5コマ合成画像・一覧・絵コンテを生成しない'));
assert(packet.includes('Work、OpenAI API、外部有料API'));
assert(packet.includes('実画像を添付'));
for(const shot of page.shots){
 assert(packet.includes(shot.key));
 assert(packet.includes(shot.scriptText));
 assert(reviewUrl(shot).includes(encodeURIComponent(shot.shotId)));
}
assert.throws(()=>validateFiveShotPage({...page,shots:[...page.shots,...page.shots]}));
assert.throws(()=>buildFiveShotPacket(page,prompts.slice(1)));
assert.throws(()=>validateFiveShotPage({...page,shots:page.shots.map(s=>({...s,gender:'female'}))}));
const ui=fs.readFileSync('story-chatgpt-five.html','utf8');
for(const necessary of ['id="shots"','id="copyOne"','id="copyFive"','id="references"',
 'id="openChat"','CHAPTER1_PROVISIONAL_LIVE','buildChapter1ImagePrompt',
 'getJSON','stage','edition','gender','page','overflow:hidden']){
 assert(ui.includes(necessary),'Missing production queue UI '+necessary);
}
const original=fs.readFileSync('story-chapter1-approval.html','utf8');
assert(original.includes('story-chatgpt-five.html'));
assert(original.includes('story-chapter1-approval-ui.js'));
console.log('PASS: ChatGPT Plus 5-shot page queue, 5 separate canonical prompts, no paid API and source QA guard');
