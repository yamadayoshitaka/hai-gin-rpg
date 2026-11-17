/**
 * Pages release gate: every provisional comic panel must render identically
 * in game, admin and title/town flows, using the immutable Pages commit.
 * No model/scene identity or P0 approval is inferred from physical registration.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CHAPTER1_PROVISIONAL_LIVE} from '../src/story-chapter1-provisional-live.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {oldStoryArtReuseAllowed} from '../src/story-art-sourcing-policy.js';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'pages-dist');
const read=rel=>readFileSync(path.join(root,rel),'utf8');
const entries=Object.entries(CHAPTER1_PROVISIONAL_LIVE);
assert(entries.length>=145,'Do not discard existing Chapter 1 reversible originals');
const canonical=new Map(chapterOneReviewPages().flatMap(p=>p.shots.map(s=>[s.key,s])));
const counts={},seen=new Set();
for(const [key,art] of entries){
 assert(canonical.has(key),'Art may not use a noncanonical screenplay key '+key);
 assert(art.asset.startsWith('./assets/story/chapter1-provisional-live/'),key);
 assert.equal(art.status,'PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0',key);
 const rel=art.asset.slice(2),file=path.join(root,rel);
 assert(existsSync(file),'Missing registered game original '+key);
 const digest=createHash('sha256').update(readFileSync(file)).digest('hex');
 assert.equal(digest,art.sha256,'Registered bytes mismatch '+key);
 assert(!seen.has(rel),'Scene image reused '+rel);seen.add(rel);
 const shot=canonical.get(key);
 const uri=registeredStoryPanelAsset({
  stageId:shot.stageId,comicEdition:shot.edition,
  protagonistGender:shot.gender,id:shot.shotId
 });
 if(oldStoryArtReuseAllowed(shot.stageId))
  assert.equal(uri,art.asset,'Review and game must resolve same old registered original '+key);
 else
  assert.equal(uri,null,'Stage5+ historical images must remain inactive '+key);
 counts[shot.stageId]=(counts[shot.stageId]||0)+1;
}
console.log('Verified canonical physical registrations:',JSON.stringify(counts));
const review=read('src/story-chapter1-approval-ui.js');
assert(review.includes('const gameAsset=live?.asset||registeredStoryPanelAsset('));
assert(review.includes('if(!oldStoryArtReuseAllowed(shot.stageId))return null;'),'Old stage5 review must stay archive-only');
assert(review.includes('storyArtDisplayUrl(gameAsset)'));
assert(review.includes("if(!imageUrl&&new URLSearchParams(location.search).get('draft')==='1')"),
 'Unregistered draft branch must be separately opted into');
const viewer=read('src/story-manga-viewer.js');
assert(viewer.includes("!cut?.includes('/chapter1-provisional-live/')"),
 'Game must never silently substitute stale sheets for a failed live image');
for(const page of ['game.html','town-hub.html']){
 assert(read(page).includes("!cut?.includes('/chapter1-provisional-live/')"),page+' old-art fallback');
}
const sha=process.env.GITHUB_SHA;
assert(/^[a-f0-9]{40}$/.test(sha||''),'Release gate requires actual GitHub commit');
const release=JSON.parse(read('pages-dist/release.json'));
assert.equal(release.sha,sha);
assert.equal(release.story_art_revision,sha);
assert.equal(release.story_art_source,'github-raw-exact-release');
const bundledResolver=read('pages-dist/src/story-panel-registered-art.js');
assert(bundledResolver.includes("STORY_PAGES_COMMIT='"+sha+"'"));
assert(!bundledResolver.includes('__HAI_GIN_STORY_RELEASE_SHA__'));
const published=await import(pathToFileURL(path.join(dist,'src/story-panel-registered-art.js')).href);
assert.equal(published.STORY_PAGES_COMMIT,sha);
assert.equal(published.isPublishedStoryRevision(),true);
for(const [key,art] of entries){
 const expected='https://raw.githubusercontent.com/yamadayoshitaka/hai-gin-rpg/'+sha+'/'+art.asset.slice(2);
 assert.equal(published.storyArtDisplayUrl(art.asset),expected,'Published origin stale for '+key);
 assert(!existsSync(path.join(dist,art.asset.slice(2))),
  'Unexpected duplicate in capacity-limited Pages distribution: '+key);
}
const revision=sha.slice(0,12);
for(const [file,token] of [
 ['game.html','./src/story-panel-registered-art.js?release='+revision],
 ['town-hub.html','./src/story-panel-registered-art.js?release='+revision],
 ['world-map.html','./src/story-manga-viewer.js?release='+revision],
 ['story-chapter1-approval.html','./src/story-chapter1-approval-ui.js?release='+revision],
 ['src/story-manga-viewer.js','./story-panel-registered-art.js?release='+revision],
 ['src/story-chapter1-approval-ui.js','./story-panel-registered-art.js?release='+revision],
 ['src/story-panel-registered-art.js','./story-chapter1-provisional-live.js?release='+revision]
]){
 const text=read('pages-dist/'+file);
 assert(text.includes(token),'Stale module link in Pages '+file+'; missing '+token);
}
console.log('PASS Pages: exact release '+revision+', '+entries.length+
 ' live manga WebPs pinned to GitHub raw with no legacy substitution or cache-skew');
