import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset,storySheetCrop} from '../src/story-panel-registered-art.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const viewer=read('src/story-manga-viewer.js'),review=read('story-art-review.html');
assert.match(viewer,/loadPanelArt\(shot,pagePanels\)/);
assert.match(viewer,/storySheetCrop\(shot,pagePanels.length\)/);
assert.doesNotMatch(viewer,/loadApprovedPage/);
assert.match(review,/registeredStoryPanelAsset\(shot\)/);
assert.match(review,/storySheetCrop\(shot,count\)/);
let found=0;
const visibleArt=new Map();
for(const [stage,gender,outcome,expected] of [
 ['c01-s01','male','pre',10],
 ['c01-s02','male','pre',8],
 ['c01-s02','male','victory',7],
 ['c01-s02','male','defeat',0],
 ['c01-s02','male','gameover',0],
 ['c01-s01','female','pre',10],
 ['c01-s01','male','town',5],
 ['c01-s01','female','town',5],
 ['c01-s02','female','victory',0],
 ['c01-s03','male','pre',0],
 ['c01-s03','female','pre',0]
]){
 const context={protagonistGender:gender,...(outcome==='victory'?{battleOutcome:{victory:true}}:
  outcome==='defeat'?{battleOutcome:{victory:false}}:
  outcome==='gameover'?{battleOutcome:{victory:false,playerCommanderDead:true}}:{})};
 const phase=outcome==='pre'?'pre':'post';
 const story=comicForStage(stage,phase,context);
 const cuts=story.panels.filter(p=>registeredStoryPanelAsset(p));
 assert(cuts.length>=expected,
  stage+'/'+gender+'/'+outcome+': legacy minimum '+expected+', now '+cuts.length);
 // Any newly provisional scene must own its own physical WebP. Never borrow a
 // male, female, winner or loser scene from a different canonical key.
 for(const cut of cuts){
  const src=registeredStoryPanelAsset(cut);
  if(src.includes('/chapter1-provisional-live/')){
   assert(src.endsWith('.webp'));
   assert(src.includes([cut.stageId,cut.comicEdition,cut.protagonistGender,cut.id].join('__')),
    'provisional original must bind to its own exact gender/outcome shot');
  }
  const prior=visibleArt.get(src);
  assert(!prior||prior===cut.stageId+'|'+cut.comicEdition+'|'+cut.protagonistGender+'|'+cut.id,
   'two distinct scenes must not share the same image URL');
  visibleArt.set(src,cut.stageId+'|'+cut.comicEdition+'|'+cut.protagonistGender+'|'+cut.id);
 }
 found+=cuts.length;
 for(const p of story.panels){
  const count=story.pages.find(x=>x.number===p.comicPage).cellCount;
  const c=storySheetCrop(p,count);
  assert.equal(c.widthPercent,200);
  assert.equal(c.heightPercent,Math.ceil(count/2)*100);
  assert.equal(c.leftPercent,-(p.comicCell%2)*100);
  assert.equal(c.topPercent,-Math.floor(p.comicCell/2)*100);
 }
}
assert(found>=45,'Legacy 45 registered images must remain available');
console.log('PASS: one manga cell per panel; legacy 45 preserved, provisional chapter1 image URLs unique across genders/outcomes; visible='+found);
