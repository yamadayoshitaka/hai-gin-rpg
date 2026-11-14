import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {buildChapter1ImagePrompt,CHATGPT_IMAGES_URL} from '../src/story-chapter1-image-prompt.js';
const pages=chapterOneReviewPages();
assert.equal(pages.length,132);
const shots=pages.flatMap(p=>p.shots.map(s=>s.key));
assert.equal(shots.length,462);
assert.equal(new Set(shots).size,462);
assert.equal(CHATGPT_IMAGES_URL,'https://chatgpt.com/');
const page=pages.find(p=>p.stageId==='c01-s02'&&p.gender==='female'&&p.edition==='post-victory');
assert(page,'Expected official stage2 female victory scenes');
const shot=page.shots.find(s=>s.shotId==='c01-s02-m6');
assert(shot,'Expected official stage2 female victory m6 scene');
const bible=JSON.parse(fs.readFileSync('assets/story/characters/c01-s02-reference-bible.json','utf8'));
const assignment=JSON.parse(fs.readFileSync('assets/story/stage-manifests/c01-s02-shot-assignments.json','utf8')).entries['post-victory|female|c01-s02-m6'];
const edit='イリスの顔をマスター画像に一致させ、紙面の文字を消す';
const prompt=buildChapter1ImagePrompt({shot,page,edit,bible,assignment,sourceKind:'candidate'});
for(const phrase of [shot.key,shot.scriptText,assignment.sceneGoal,assignment.compositionHint,
 ...assignment.visibleActorIds,edit,'画像を実際に1枚生成','16:9','画像に台詞・説明文を焼き込まない',
 'assets/story/characters/commander/female-master.webp',
 'c01-s02-m06-post-victory-female.webp']){
 assert(prompt.includes(phrase),'Missing canonical instruction: '+phrase);
}
assert(!prompt.includes('プログラムの自動起動成功'));
const malePage=pages.find(p=>p.stageId==='c01-s02'&&p.gender==='male'&&p.edition==='post-victory');
assert(malePage);
assert(malePage.shots.every(s=>s.gender==='male'));
const pageHtml=fs.readFileSync('story-chapter1-approval.html','utf8');
const ui=fs.readFileSync('src/story-chapter1-approval-ui.js','utf8');
assert(pageHtml.includes('漫画を読んで作画・承認'));
assert(ui.includes('ChatGPTでこの1コマを画像生成'));
assert(ui.includes('buildChapter1ImagePrompt'));
assert(ui.includes('navigator.clipboard.writeText'));
assert(ui.includes('window.location.assign(CHATGPT_IMAGES_URL)'));
assert(!ui.includes('chatgpt.com/?q='));
assert(!ui.includes('OPENAI_API_KEY'));
console.log(JSON.stringify({test:'PASS',canonicalPages:132,canonicalShots:462,
 handoff:'manual copy-and-open with no paid API',visualApprovalAutomatic:false}));
