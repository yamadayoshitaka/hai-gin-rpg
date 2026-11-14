import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {CHAPTER1_PROVISIONAL_LIVE,chapter1ProvisionalLivePanel} from '../src/story-chapter1-provisional-live.js';
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

const registered=Object.entries(CHAPTER1_PROVISIONAL_LIVE).filter(([key])=>key.startsWith('c01-s04|'));
assert.equal(registered.length,7,'Only seven individually uploaded ChatGPT stage4 WebPs are registered, never rejected collages');
const liveS05=Object.keys(CHAPTER1_PROVISIONAL_LIVE).filter(key=>key.startsWith('c01-s05|'));
assert.equal(liveS05.length,0,'No image may be fabricated or counted as stage5 completed');
for(const gender of ['male','female']){
 const key='c01-s04|pre|'+gender+'|c01-s04-m1';
 const item=CHAPTER1_PROVISIONAL_LIVE[key];
 assert(item&&item.status==='PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0','Stage4 original not marked provisional');
 assert.equal(item.gender,gender);
 assert(item.outstandingP0.some(x=>x.includes('Lucia')||x.includes('摂政')),'Cast mismatch must remain visible');
 const actual=fs.readFileSync(item.asset.startsWith('./')?item.asset.slice(2):item.asset);
 assert.equal(actual.toString('ascii',0,4),'RIFF');
 assert.equal(actual.toString('ascii',8,12),'WEBP');
 assert.equal(crypto.createHash('sha256').update(actual).digest('hex'),item.sha256,'Wrong actual WebP bytes');
 const proof=JSON.parse(fs.readFileSync(item.provenance,'utf8'));
 assert.equal(proof.shotKey,key);
 assert.equal(proof.sha256,item.sha256);
 assert.equal(proof.ownerAuthorizedForProvisional,true);
 assert.equal(proof.ownerAuthorizedForP0,false);
 assert.equal(proof.formallyApproved,false);
 assert.equal(proof.quality.exactCast,false);
 assert.equal(proof.provisionalRegistered,true);
 assert.deepEqual(proof.nativePixels,[1664,936]);
 assert.equal(chapter1ProvisionalLivePanel({
  stageId:'c01-s04',comicEdition:'pre',protagonistGender:gender,id:'c01-s04-m1'
 })?.asset,item.asset,'Live game resolver does not point to owner provisional asset');
 const canonical=pages.flatMap(p=>p.shots).find(x=>x.key===key);
 assert(canonical&&canonical.scriptText===proof.scriptText,'Never bind artwork to a noncanonical script');
}
const ledger=JSON.parse(fs.readFileSync('assets/story/chapter1-provisional-revisions.json','utf8'));
for(const gender of ['male','female'])
 assert(ledger.history.some(h=>h.key==='c01-s04|pre|'+gender+'|c01-s04-m1' &&
   h.kind==='CHATGPT_OWNER_PROVISIONAL_KNOWN_CAST_MISMATCH_NOT_P0'),'No reversible audit event for '+gender);

const newShot='c01-s04|pre|male|c01-s04-m2';
const nativeFrame=CHAPTER1_PROVISIONAL_LIVE[newShot];
assert(nativeFrame&&nativeFrame.gender==='male'&&nativeFrame.edition==='pre'&&nativeFrame.status==='PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0');
const framePath=nativeFrame.asset.startsWith('./')?nativeFrame.asset.slice(2):nativeFrame.asset;
const frameBytes=fs.readFileSync(framePath);
assert.equal(frameBytes.toString('ascii',0,4),'RIFF');
assert.equal(frameBytes.toString('ascii',8,12),'WEBP');
assert.equal(crypto.createHash('sha256').update(frameBytes).digest('hex'),nativeFrame.sha256);
assert.equal(nativeFrame.sha256,'fc035c7037f7ccc2cfb0281796c533e99986f6884e084e4905da00fe362338a3');
assert.deepEqual(nativeFrame.nativePixels,[1664,936]);
assert.equal(chapter1ProvisionalLivePanel({
 stageId:'c01-s04',comicEdition:'pre',protagonistGender:'male',id:'c01-s04-m2'
})?.asset,nativeFrame.asset);
const m2Proof=JSON.parse(fs.readFileSync(nativeFrame.provenance,'utf8'));
assert.equal(m2Proof.shotKey,newShot);
assert.equal(m2Proof.imageSha256,nativeFrame.sha256);
assert.equal(m2Proof.qaStatus,'OWNER_PROVISIONAL');
assert.equal(m2Proof.finalP0Approved,false);
assert.equal(m2Proof.quality.exactCast,true);
assert.equal(m2Proof.quality.realReferenceBytesAttachedToImageGenerator,false);
assert.equal(m2Proof.scriptText,pages.flatMap(p=>p.shots).find(x=>x.key===newShot).scriptText);
assert(ledger.history.some(h=>h.key===newShot&&h.kind==='CHATGPT_OWNER_PROVISIONAL_NOT_P0'));

const newNative=[
  {
    "key": "c01-s04|pre|male|c01-s04-m3",
    "hash": "c9d2d43c582908b4c66707c335c043ab1559df395dc5274ef910255b231f1f96",
    "actors": [
      "garan",
      "iris"
    ]
  },
  {
    "key": "c01-s04|pre|female|c01-s04-m3",
    "hash": "cac502be198e3934f55090fe591a5d35b4a25a6d895eec2ad860e4b8cb20b934",
    "actors": [
      "garan",
      "iris"
    ]
  },
  {
    "key": "c01-s04|pre|male|c01-s04-m4",
    "hash": "b9b8deee5d266e55ae708bfaa1dc2bc785a247e3cf7b0497b490e268a0ffdf2c",
    "actors": [
      "iris",
      "lucia"
    ]
  },
  {
    "key": "c01-s04|pre|male|c01-s04-m15",
    "hash": "59f3ea7757e27c3f546c6afacf09dc1ec98e0b30f93a3d9f6a79268f752953f1",
    "actors": [
      "lucia",
      "garan"
    ]
  }
];
const knownKeys=new Set(pages.flatMap(p=>p.shots.map(s=>s.key)));
const usedHashes=new Set();
for(const spec of newNative){
 assert(knownKeys.has(spec.key),'Unknown canonical shot '+spec.key);
 const shot=pages.flatMap(p=>p.shots).find(s=>s.key===spec.key);
 assert.deepEqual([shot.characterId,shot.secondaryId],spec.actors,'Incorrect script cast '+spec.key);
 const live=CHAPTER1_PROVISIONAL_LIVE[spec.key];
 assert(live&&live.sha256===spec.hash&&live.status==='PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0');
 assert(!usedHashes.has(live.sha256),'Same binary used for multiple gender/branch shots');
 usedHashes.add(live.sha256);
 const imageBytes=fs.readFileSync(live.asset.startsWith('./')?live.asset.slice(2):live.asset);
 assert.equal(imageBytes.toString('ascii',0,4),'RIFF');
 assert.equal(imageBytes.toString('ascii',8,12),'WEBP');
 assert.equal(crypto.createHash('sha256').update(imageBytes).digest('hex'),spec.hash);
 const proof=JSON.parse(fs.readFileSync(live.provenance,'utf8'));
 assert.equal(proof.shotKey,spec.key);
 assert.equal(proof.image.sha256,spec.hash);
 assert.deepEqual(proof.image.nativePixels,[1664,936]);
 assert.equal(proof.image.noUpscaling,true);
 assert.equal(proof.formallyApproved,false);
 assert.equal(proof.referenceImagesAttachedToGenerator,false);
 assert.equal(proof.provisionalRegistered,true);
 assert.equal(proof.cast.join('|'),spec.actors.join('|'));
 assert.equal(chapter1ProvisionalLivePanel({
  stageId:shot.stageId,comicEdition:shot.edition,protagonistGender:shot.gender,id:shot.shotId
 })?.asset,live.asset,'Registration resolver did not use the correct native image');
 assert(ledger.history.some(h=>h.key===spec.key&&h.sha256===spec.hash&&h.kind==='CHATGPT_OWNER_PROVISIONAL_NOT_P0'));
}

console.log('PASS: 96 exact stage4/5 ChatGPT per-shot handoffs, actual bytes, style and branch safety, no paid API');
