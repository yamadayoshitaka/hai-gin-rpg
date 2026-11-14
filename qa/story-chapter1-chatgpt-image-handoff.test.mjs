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
const qualityRules=JSON.parse(fs.readFileSync('assets/story/quality/artwork-p0-rules.json','utf8'));
const prompt=buildChapter1ImagePrompt({shot,page,edit,bible,assignment,qualityRules,sourceKind:'candidate'});
for(const phrase of [shot.key,shot.scriptText,assignment.sceneGoal,assignment.compositionHint,
 ...assignment.visibleActorIds,edit,'画像を実際に1枚生成','16:9','画像に台詞・説明文を焼き込まない',
 'assets/story/characters/commander/female-master.webp',
 'c01-s02-m06-post-victory-female.webp']){
 assert(prompt.includes(phrase),'Missing canonical instruction: '+phrase);
}
assert(!prompt.includes('プログラムの自動起動成功'));
const manual=JSON.parse(fs.readFileSync('assets/story/stage-manifests/c01-s01-post-town-male-p01-manual-production.json','utf8'));
assert.equal(manual.visualStyleLock.id,'STAGE1_HI_FIDELITY_3D_JRPG_ANIME_REALISM_V1');
assert.equal(manual.visualStyleLock.failOnStyleDrift,true);
assert.equal(manual.visualStyleLock.actualReferenceImageBytesRequired,true);
assert(manual.visualStyleLock.referenceImagePaths.some(p=>p.endsWith('c01-s01-m01.webp')));
const maleTownPage=pages.find(p=>p.stageId==='c01-s01'&&p.gender==='male'&&p.edition==='post-town');
assert(maleTownPage,'First-stage town-after page must exist');
for(const original of manual.shots){
 const panel=maleTownPage.shots.find(x=>x.key===original.key);
 assert(panel,'The production manifest cannot refer to a noncanonical shot '+original.key);
 const shotPrompt=buildChapter1ImagePrompt({
  shot:panel,page:maleTownPage,manualManifest:manual,qualityRules,bible,sourceKind:'legacy'
 });
 for(const phrase of [original.scene,...original.actors,
  manual.visualStyleLock.id,qualityRules.policyId,'5コマ1枚のコラージュを描かない']){
  assert(shotPrompt.includes(phrase),'Manifest not injected into ChatGPT generator: '+phrase);
 }
}
assert.throws(()=>buildChapter1ImagePrompt({
 shot:maleTownPage.shots[0],page:maleTownPage,manualManifest:manual,bible
}),/P0 image-generation quality manifest/);
assert.throws(()=>buildChapter1ImagePrompt({
 shot:maleTownPage.shots[0],page:{...maleTownPage,edition:'pre'},
 manualManifest:{...manual,edition:'pre'},qualityRules,bible
}),/Mismatched manual production manifest|Shot missing from production manifest/);
for(const phrase of ['ハイエンド3D JRPG','2Dイラスト調','実際に添付する','c01-s01-m01.webp']){
 assert(prompt.includes(phrase),'Chapter1 visual style lock missing: '+phrase);
}
const malePage=pages.find(p=>p.stageId==='c01-s02'&&p.gender==='male'&&p.edition==='post-victory');
assert(malePage);
assert(malePage.shots.every(s=>s.gender==='male'));
const pageHtml=fs.readFileSync('story-chapter1-approval.html','utf8');
const ui=fs.readFileSync('src/story-chapter1-approval-ui.js','utf8');
assert(pageHtml.includes('漫画を読んで確認・修正'));
assert(!pageHtml.includes('id="visualConfirm"'),'No unnecessary manual temporary-approval checkbox');
assert(!ui.includes("'◎ 仮承認'"),'No temporary-approval action');
assert(!ui.includes("['approve'"),'Automatic registration must not ask for approval');
assert(ui.includes("['revise','↶ このコマを差し戻す']"),'Rollback remains available');
assert(ui.includes('function stepShot(direction)'), 'Single cut previous/next navigation');
assert(pageHtml.includes('html,body{height:100%;height:100dvh;overflow:hidden}'),
 'No vertically scrolling manga document');

assert(ui.includes('ChatGPTでこの1コマを画像生成'));
assert(ui.includes('buildChapter1ImagePrompt'));
assert(ui.includes('manualManifestFor(shot)'),'The UI must load the shot-specific production manifest');
assert(ui.includes('qualityRulesFor()'),'The UI must load P0 quality JSON for every prompt');
assert(ui.includes('referenceFilesForHandoff(shot,prepared)'),'Android share must include real master image bytes');
assert(ui.includes('manualManifest:prepared.manualManifest,qualityRules:prepared.qualityRules'),
 'The UI must pass BOTH manifests into image prompt generator');
assert(ui.includes('navigator.clipboard.writeText'));
assert(ui.includes('window.location.assign(CHATGPT_IMAGES_URL)'));
assert(!ui.includes('chatgpt.com/?q='));
assert(!ui.includes('OPENAI_API_KEY'));
console.log(JSON.stringify({test:'PASS',canonicalPages:132,canonicalShots:462,
 handoff:'manual copy-and-open with no paid API',visualApprovalAutomatic:false}));
