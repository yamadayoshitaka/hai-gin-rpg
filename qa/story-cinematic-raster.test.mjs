import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {STORY_KEY_PEOPLE} from '../src/story-cinematic.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {mangaForStage} from '../src/story-stage-manga.js';
import {
 CINEMATIC_CAST_ASSETS,CINEMATIC_CHAPTER_ASSETS,CINEMATIC_TITLE_ASSET
} from '../src/story-cinematic-assets.js';
const load=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const verifyWebP=path=>{
 const raw=fs.readFileSync(new URL('../'+path.replace(/^\.\//,''),import.meta.url));
 assert.equal(raw.toString('ascii',0,4),'RIFF',path);
 assert.equal(raw.toString('ascii',8,12),'WEBP',path);
 assert.ok(raw.length>8000,path+' must be an actual raster image, not a dummy');
 assert.ok(raw.length<300_000,path+' should remain lightweight on mobile');
};
assert.equal(STORY_KEY_PEOPLE.length,20);
assert.equal(Object.keys(CINEMATIC_CAST_ASSETS).length,20);
assert.equal(new Set(Object.values(CINEMATIC_CAST_ASSETS)).size,20);
for(const p of STORY_KEY_PEOPLE){
 assert.ok(CINEMATIC_CAST_ASSETS[p.id],p.id+' missing visual identity');
 verifyWebP(CINEMATIC_CAST_ASSETS[p.id]);
}
assert.equal(CINEMATIC_CHAPTER_ASSETS.length,20);
for(const bg of CINEMATIC_CHAPTER_ASSETS)verifyWebP(bg);
verifyWebP(CINEMATIC_TITLE_ASSET);
assert.equal(CAMPAIGN_STAGES.length,200);
for(const stage of CAMPAIGN_STAGES){
 const story=mangaForStage(stage.id);
 assert.equal(story.panels.length,20);
 for(const p of story.panels){
  for(const id of [p.characterId,p.secondaryId]){
   if(id)assert.ok(CINEMATIC_CAST_ASSETS[id],stage.id+' unknown character '+id);
  }
 }
}
const art=load('src/story-cinematic-assets.js'),town=load('town-hub.html'),map=load('world-map.html'),
title=load('game.html'),viewer=load('src/story-manga-viewer.js');
new SourceTextModule(art,{identifier:'src/story-cinematic-assets.js'});
assert.match(art,/getPicture\(CINEMATIC_CHAPTER_ASSETS\[panel\.chapter-1\]\)/);
assert.match(art,/getPicture\(primary\),getPicture\(secondary\)/);
assert.match(title,/assets\/story-cinema\/title\.webp/);
for(const entry of [title,town,viewer])assert.match(entry,/comicPageAsset\(/);
for(const entry of [title,town,viewer])assert.doesNotMatch(entry,/applyCinematicImage\(/,'no slideshow/collage art may stand in for manga');
assert.match(map,/mangaViewer\.open\(stage\.id,\{onFinish:/);
assert.match(town,/stageMangaSeen\?\.\[game\.townStage\]/);
assert.doesNotMatch(town,/get\('paper'\)==='1'/,'town must not replay on re-entry');
assert.doesNotMatch(town,/openPanel\('dialogue'\)/,'NPC dialogue must not open the big modal');
assert.match(town,/id="townDialogue"/);
assert.match(town,/paperPending=false;paperPhase=phase/);
assert.match(town,/game\.storyFlags\.stageMangaSeen/);
assert.match(town,/game\.storyFlags\.stagePostMangaSeen/);
assert.match(viewer,/loadPanelArt\(shot,pagePanels\)/,'every dialogue must display a single stage-matched panel');
assert.match(viewer,/storySheetCrop\(shot,pagePanels.length\)/,'2x5 sheets must crop one panel at a time');
assert.doesNotMatch(viewer,/applyCinematicImage\(/,'do not substitute portraits for an unfinished page');
console.log('PASS cinematic raster: 20 persistent cast portraits, 20 chapter backdrops, title cover, 200×20 panels (10+10), one-time town intro and inline NPC speech');
