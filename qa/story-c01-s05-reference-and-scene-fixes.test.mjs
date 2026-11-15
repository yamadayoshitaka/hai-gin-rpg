import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {buildChapter1ImagePrompt} from '../src/story-chapter1-image-prompt.js';
const pages=chapterOneReviewPages().filter(p=>p.stageId==='c01-s05'&&p.edition==='pre'&&p.pageWithinVariant===1);
const bible=JSON.parse(fs.readFileSync('assets/story/characters/c01-s05-reference-bible.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('assets/story/stage-manifests/c01-s05.manifest.json','utf8'));
const rules=JSON.parse(fs.readFileSync('assets/story/quality/artwork-p0-rules.json','utf8'));
const vess=bible.actors.find(p=>p.id==='vess');
assert.equal(vess.path,'assets/story-cinema/cast/vess.webp');
assert(fs.existsSync(vess.path));
for(const page of pages){
 const p=Object.fromEntries(page.shots.map(shot=>[shot.shotId,buildChapter1ImagePrompt({shot,page,bible,stageManifest:manifest,qualityRules:rules})]));
 const g=page.gender;
 assert(p['c01-s05-m1'].includes('画面に登場する人物ID（このコマ専用・追加禁止）：lucia'),'opening requires Lucia');
 assert(!p['c01-s05-m1'].includes('登場人物なしの風景・小道具カット'),'opening may not be empty');
 for(const shotId of ['c01-s05-m1','c01-s05-m2','c01-s05-m3','c01-s05-m4','c01-s05-m5']){
  assert(p[shotId].includes('c01-s01-m06-'+g+'.webp'),'wrong-gender supplementary style reference');
  assert(!p[shotId].includes('c01-s01-m06-'+(g==='male'?'female':'male')+'.webp'));
 }
 assert(p['c01-s05-m3'].includes('礼拝堂内部'));
 assert(p['c01-s05-m3'].includes('死者名簿'));
 assert(p['c01-s05-m4'].includes('第1コマとは違う引きの構図'));
 assert(p['c01-s05-m4'].includes('腕を上げず'));
 assert(p['c01-s05-m5'].includes('長い銀白髪'));
 assert(p['c01-s05-m5'].includes('assets/story-cinema/cast/vess.webp'));
 assert(p['c01-s05-m5'].includes('画面に登場する人物ID（このコマ専用・追加禁止）：lucia、vess'));
 assert(p['c01-s05-m5'].includes('偽造された王印'));
}
console.log('PASS: c01-s05 male/female scene and cast fixes, correct same-gender references');
