import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {buildChapter1ImagePrompt} from '../src/story-chapter1-image-prompt.js';

const pages=chapterOneReviewPages().filter(p=>p.stageId==='c01-s04'||p.stageId==='c01-s05');
assert.equal(pages.flatMap(p=>p.shots).length,96,'Stage4+5 must preserve 48 shots each');
const rules=JSON.parse(fs.readFileSync('assets/story/quality/artwork-p0-rules.json','utf8'));
let verified=0;
for(const page of pages){
 const manifest=JSON.parse(fs.readFileSync('assets/story/stage-manifests/'+page.stageId+'.manifest.json','utf8'));
 const bible=JSON.parse(fs.readFileSync('assets/story/characters/'+page.stageId+'-reference-bible.json','utf8'));
 for(const shot of page.shots){
  const prompt=buildChapter1ImagePrompt({shot,page,bible,stageManifest:manifest,qualityRules:rules});
  for(const expected of [shot.key,shot.scriptText,manifest.qualityReferenceByGender[shot.gender],
   '生成器はChatGPT Imagesを使用','Cloudflare Workers AI、外部有料API','この1枚を生成するたびに最優先',
   '文字・台詞・吹き出し','画風','勝利以前','ゲームへの登録やコミットが完了したとは主張しない']){
   if(expected!=='勝利以前')assert(prompt.includes(expected),shot.key+' lacks '+expected);
  }
  assert(prompt.includes(page.stageId==='c01-s04'?'森の古代遺構':'王都へ迫る軍勢'));
  assert(!prompt.includes('登場人物ID（このコマ専用・追加禁止）：commander_'+
   (shot.gender==='female'?'female':'male')+'、commander_'),shot.key+' repeated hero');
  verified++;
 }
}
assert.equal(verified,96);
const importer=fs.readFileSync('scripts/import-story-chapter1-chatgpt-staging.mjs','utf8');
assert(importer.includes("'c01-s04','c01-s05'"));
assert(importer.includes("if(!fs.existsSync(abs(imagePath)))throw Error('Real image bytes missing')"));
assert(importer.includes("if(w<min[0]||h<min[1]||w*9!==h*16)"));
const ui=fs.readFileSync('src/story-chapter1-approval-ui.js','utf8');
assert(ui.includes("prepared.stageManifest?.qualityReferenceByGender?.[shot.gender]"));
assert(ui.includes("new File([blob]"));
assert(ui.includes('ChatGPT Plusの画像生成を利用'));
console.log('PASS: 96 exact stage4/5 ChatGPT per-shot handoffs, actual bytes, style and branch safety, no paid API');
