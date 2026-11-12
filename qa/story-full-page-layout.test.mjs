import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {mangaForStage} from '../src/story-stage-manga.js';
import {STORY_PAGE_LAYOUT,storyPageAsset,storyPagePanels,storyPagePosition}
 from '../src/story-manga-page.js';

assert.deepEqual(
 [STORY_PAGE_LAYOUT.columns,STORY_PAGE_LAYOUT.rows,STORY_PAGE_LAYOUT.width,STORY_PAGE_LAYOUT.height],
 [2,5,1536,2160]
);
assert.equal(STORY_PAGE_LAYOUT.panels,10);
assert.equal(storyPageAsset('c01-s01','pre','male'),
 './assets/story/pages/c01-s01-pre-male.webp');
assert.equal(storyPageAsset('c01-s01','post','female'),
 './assets/story/pages/c01-s01-post-female.webp');
assert.equal(storyPageAsset('c01-s01','pre','unspecified'),null,
 'unknown protagonist gender must not silently choose a male picture');
assert.throws(()=>storyPageAsset('../c01-s01','pre','male'));
assert.throws(()=>storyPageAsset('c01-s01','other','male'));
for(let i=0;i<10;i++){
 const cell=storyPagePosition(i);
 assert.deepEqual(cell,{row:Math.floor(i/2)+1,column:i%2+1});
}
for(const stage of CAMPAIGN_STAGES){
 for(const gender of ['male','female']){
  const story=mangaForStage(stage.id,{protagonistGender:gender});
  for(const phase of ['pre','post']){
   const frames=storyPagePanels(story,phase);
   assert.equal(frames.length,10,stage.id+' '+gender+' '+phase);
   assert.ok(frames.every(p=>p.phase===phase&&p.protagonistGender===gender));
   assert.match(storyPageAsset(stage.id,phase,gender),
    /^\.\/assets\/story\/pages\/c\d\d-s\d\d-(pre|post)-(male|female)\.webp$/);
  }
 }
}
const viewer=await readFile(new URL('../src/story-manga-viewer.js',import.meta.url),'utf8');
const importer=await readFile(new URL('../scripts/slice-story-art-batch.py',import.meta.url),'utf8');
const workflow=await readFile(new URL('../.github/workflows/story-sheet-import.yml',import.meta.url),'utf8');
assert.match(viewer,/loadApprovedPage\(shot\)/);
assert.match(viewer,/manga-hotspots/);
assert.match(viewer,/原画未登録/);
assert.doesNotMatch(viewer,/stageMangaImage\(shot\)/);
assert.doesNotMatch(viewer,/applyCinematicImage\(/);
assert.match(importer,/female_complete = \(patch_count \+ neutral_count == 10\)/);
assert.match(importer,/new_assets\[male_page\] = encode_webp\(base_sheet\)/);
assert.match(importer,/new_assets\[female_page\] = encode_webp\(female_sheet\)/);
assert.match(workflow,/git add assets\/story\/panels\/ assets\/story\/pages\//);
console.log('PASS all 200 stages: one reviewed 2x5 page before and after events, gender-separated 400 male/female image routes, no illustration substitution');
