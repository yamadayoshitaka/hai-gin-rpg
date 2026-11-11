import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {CHAPTER_ONE_ART_REFERENCES,CHAPTER_ONE_ART_BY_KEY,
 FEMALE_COMMANDER_ART_PALETTE,artReferenceForFeatured}
 from '../src/chapter-one-character-art-references.js';
import {featuredSwordsmanProfile} from '../src/master-swordsman-featured-profiles.js';

test('only verified Chapter 1 story and commander art is registered as 3D reference',()=>{
 assert.deepEqual(CHAPTER_ONE_ART_REFERENCES.map(r=>r.key),
  ['commander-female','lucia','garan','iris']);
 for(const ref of CHAPTER_ONE_ART_REFERENCES){
  assert.ok(existsSync(ref.image),'Missing registered portrait: '+ref.image);
  assert.ok(ref.image.endsWith('.webp'));
  assert.ok(['character-master','cinema-cast'].includes(ref.source));
  assert.equal(readFileSync(ref.image).subarray(0,4).toString(),'RIFF',
   'Image asset is not a real WebP: '+ref.image);
 }
 assert.equal(CHAPTER_ONE_ART_BY_KEY.lucia.image,
  'assets/story/characters/lucia/master.webp');
 assert.equal(CHAPTER_ONE_ART_BY_KEY.garan.status,'provisional');
 assert.equal(CHAPTER_ONE_ART_BY_KEY.iris.status,'provisional');
 assert.equal(artReferenceForFeatured('hero-01'),null,
  'Never map the female source portrait onto a male character');
 assert.equal(artReferenceForFeatured('hero-girl-01').key,'commander-female');
});
test('provisional female-commander portrait drives appearance palette without claiming finished 3D',()=>{
 const p=featuredSwordsmanProfile('hero-girl-01');
 assert.equal(p.referenceArt,CHAPTER_ONE_ART_BY_KEY['commander-female'].image);
 assert.equal(p.referenceArtStatus,'provisional-chapter-one-character-master');
 assert.ok(p.referenceDesign.startsWith('original-chapter1-'));
 assert.deepEqual({
  skin:p.skin,iris:p.iris,hair:p.hairColor,cloth:p.clothColor,armor:p.armorColor
 },FEMALE_COMMANDER_ART_PALETTE);
 assert.equal(p.artGradeCertified,false);
 assert.equal(p.facialArtistApproval,false);
 assert.equal(p.coiffureStyle,'fantasy-long-blonde');
 const design=JSON.parse(readFileSync('data/heroine-approved-design.json','utf8'));
 assert.equal(design.artMaster.chapter,1);
 assert.equal(design.artMaster.image,p.referenceArt);
 assert.equal(design.artMaster.otherChaptersArtworkCertified,false);
});
test('viewer compares Chapter 1 visual masters with no false NPC-to-3D linkage',()=>{
 const html=readFileSync('master-swordsman-prototype.html','utf8');
 for(const id of ['chapterOneArtComparison','chapterOneArtImage','chapterOneArtSelect',
  'chapterOneArtStatus'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/CHAPTER_ONE_ART_REFERENCES/);
 assert.match(html,/isSameCharacter/);
 assert.ok(html.indexOf('id="chapterOneArtComparison"')>html.indexOf('id="portrait"'),
  'Do not insert the art panel between WebGL canvas and camera controls: Chromium screenshot scrolls it offscreen');
 assert.match(html,/現在表示している3Dはこの人物のモデルではありません/);
 assert.match(html,/第2〜20章の場面原画は完成扱いにしません/);
 assert.doesNotMatch(html,/10万本ローズピンク/);
});
