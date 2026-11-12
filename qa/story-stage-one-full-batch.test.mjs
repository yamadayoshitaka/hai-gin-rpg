import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {comicForStage,comicPageAsset} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';

const resource=relative=>new URL('../'+relative,import.meta.url);
const inventory=JSON.parse(readFileSync(resource('assets/story/chapters/c01/c01-s01-draft-registry-20261113.json'),'utf8'));
const contract=readFileSync(resource('docs/story-manga-artwork-production-contract.md'),'utf8');
assert.equal(inventory.productionRules.version,2);
assert.equal(inventory.approved,false,'Registration is not human quality approval');
assert.equal(inventory.noTextInArt,true);
for(const token of ['数字','コマ番号','UI','性別','台本','画像','禁止','デプロイ','URL','吹き出し']){
 assert(contract.includes(token),'Production rule missing: '+token);
}
for(const token of ['visible digits','panel counters','UI screenshots','speech balloons','wrong-gender protagonist']){
 assert(inventory.productionRules.prohibited.includes(token),'Metadata restriction missing: '+token);
}
const seen=new Set();
const allowed=[
 ['male','pre',10],['male','post',5],['female','pre',10],['female','post',5]
];
for(const [gender,phase,expected] of allowed){
 const comic=comicForStage('c01-s01',phase,{protagonistGender:gender});
 assert.equal(comic.panels.length,expected,'Missing stage scene '+gender+' '+phase);
 const e=inventory.editions.find(e=>e.edition===(phase==='post'?'post-town':'pre')&&e.gender===gender);
 if(phase==='post'){
  assert(e,'Missing outcome edition metadata '+gender);
  assert.equal(e.panelCount,5);
  const archive='./'+e.sheet;
  assert.equal(comicPageAsset('c01-s01',phase,{protagonistGender:gender},1,gender),archive);
 }
 for(let i=0;i<expected;i++){
  const p=comic.panels[i],url=registeredStoryPanelAsset(p);
  assert.equal(p.protagonistGender,gender);
  assert(p.voiceText&&p.voiceText.trim().length>0,'Missing voice text '+p.id);
  assert(url&&url.endsWith('-'+gender+'.webp'),'Cross-gender frame '+p.id);
  assert(!seen.has(url),'Same file reused across gender/phase editions '+url);
  seen.add(url);
  const rel=url.slice(2);
  assert(existsSync(resource(rel)),'Game asset missing: '+url);
  const b=readFileSync(resource(rel));
  assert.equal(b.toString('ascii',0,4),'RIFF','Corrupt art '+url);
  assert.equal(b.toString('ascii',8,12),'WEBP','Corrupt art '+url);
  assert(b.length>12000,'Too-small artwork '+url);
  if(e){
    const md=e.panels[i];
    assert.equal(md.path,rel,'Wrong stage-panel registration '+url);
    assert.equal(md.bytes,b.length,'Unexpected file size '+url);
    assert.equal(md.sha256,createHash('sha256').update(b).digest('hex'),'Wrong WebP asset '+url);
  }
 }
}
assert.equal(seen.size,30,'Stage 1 must contain 30 gender-separated panels');
for(const gender of ['male','female']){
 const s=inventory.editions.find(x=>x.edition==='post-town'&&x.gender===gender);
 const b=readFileSync(resource(s.sheet));
 assert.equal(b.toString('ascii',0,4),'RIFF');
 assert.equal(b.toString('ascii',8,12),'WEBP');
 assert.equal(b.length,s.bytes);
 assert.equal(createHash('sha256').update(b).digest('hex'),s.sha256);
}
console.log('PASS: Stage c01-s01 all 30 registered scene files; SHA-pinned before/after editions; 2 new 5-panel archive sheets; 0 unverified gender fallbacks.');
