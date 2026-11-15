import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compactComicForStage} from '../src/story-compact-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
const config=JSON.parse(fs.readFileSync('data/story-compact-20chapters.json','utf8'));
assert.equal(config.chapterCount,20);assert.equal(config.stageCount,200);
assert.equal(config.expectedNormalImageSlots,880);
assert.equal(config.expectedWithCommonDefeat,882);
assert.equal(config.chapters.length,20);
assert(config.chapters.every(c=>c.stages.length===10),'Every chapter must define 10 stages');
let reused=0,required=0;
const reusedMap=[];
for(const stageId of ['c01-s01','c01-s02','c01-s03','c01-s04']){
 for(const gender of ['male','female']){
  for(const [phase,context] of [
   ['pre',{chapterOpeningSeen:false}],
   ['post',{battleOutcome:{victory:true}}]
  ]){
   const data=compactComicForStage(stageId,phase,{...context,protagonistGender:gender});
   for(const shot of data.panels){
    required++;
    const art=registeredStoryPanelAsset(shot);
    if(art){
     reused++;
     assert.match(art,/\.webp$/);
     // Binding must originate from the original exact stage, branch, gender.
     assert.equal(shot.stageId,stageId);
     assert.equal(shot.protagonistGender,gender);
     reusedMap.push({key:[stageId,shot.comicEdition,gender,shot.id].join('|'),art});
    }
   }
  }
 }
}
assert.equal(required,40,'4 stages with 4 opening panels, 2 before and 2 after, both genders');
assert.equal(reused,40,'All chosen first-four-stage main-path CGs already have correct registered artwork');
assert.equal(new Set(reusedMap.map(x=>x.key)).size,40);
assert.equal(new Set(reusedMap.map(x=>x.art)).size,40,'Existing selected visuals remain gender/branch specific');
const pages=['game.html','town-hub.html','world-map.html','src/story-manga-viewer.js'];
for(const p of pages){
 const s=fs.readFileSync(p,'utf8');
 if(p==='game.html'||p==='town-hub.html'||p.endsWith('viewer.js')){
  assert.match(s,/compactComicForStage/,'Game UI must use compact production resolver: '+p);
 }
}
const dialogue=fs.readFileSync('src/story-manga-viewer.js','utf8');
assert.match(dialogue,/renderPortrait\(talk\)/);
assert.match(dialogue,/shot\.dialogueTurns/);
assert.match(dialogue,/storySheetCrop\(shot,shot\.sourceSheetCount\|\|pagePanels\.length\)/);
console.log(JSON.stringify({status:'PASS',stages:4,genderVariants:2,mainPathCompactCG:required,reusedRegisteredWebP:reused,formalP0NotAsserted:true}));
