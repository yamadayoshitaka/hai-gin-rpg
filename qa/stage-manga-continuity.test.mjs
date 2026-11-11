import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {STORY_KEY_PEOPLE} from '../src/story-cinematic.js';
import {MANGA_STAGE_COUNT,MANGA_TOTAL_PANELS,MANGA_PANELS_PER_STAGE,mangaForStage,mangaStoryChain} from '../src/story-stage-manga.js';
import {MANGA_VISUAL_CHARACTERS,stageMangaSvg,stageMangaImage} from '../src/story-manga-art.js';
import {FANTASY_SCORE_LIBRARY,fantasyCueForLocation,fantasyCueForMangaPanel} from '../src/fantasy-scene-score.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
assert.equal(MANGA_STAGE_COUNT,200);
assert.equal(MANGA_PANELS_PER_STAGE,10);
assert.equal(MANGA_TOTAL_PANELS,2000);
assert.equal(CAMPAIGN_STAGES.length,200);
assert.equal(STORY_KEY_PEOPLE.length,20);
assert.equal(Object.keys(MANGA_VISUAL_CHARACTERS).length,20);
assert.equal(new Set(Object.values(MANGA_VISUAL_CHARACTERS).map(x=>x.hair+'-'+x.garment+'-'+x.costume)).size,20,
 'each key character must have persistent distinct visual identity');
const links=mangaStoryChain();
assert.equal(links.length,200);
assert.equal(fantasyCueForLocation('opening').id,'heartfelt','avoid arcade-like fairy cue at opening');
assert.equal(fantasyCueForLocation('title').id,'whispers','title should be fantasy mystery');
const first=mangaForStage('c01-s01');
assert.match(first.panels[1].text,/リュシア/,'the heroine must introduce herself');
assert.match(first.panels[2].text,/ガラン/,'first-time players meet the knight gradually');
assert.ok(first.panels[0].text.length<100,'do not start with an encyclopaedia');
assert.ok(first.panels.every(p=>p.text.length<210),'use short scenes at first stage');
let artworkSamples=new Set(),characterPanels=0;
for(let i=0;i<CAMPAIGN_STAGES.length;i++){
 const stage=CAMPAIGN_STAGES[i],story=mangaForStage(stage);
 assert.equal(story.id,stage.id);
 assert.equal(story.panels.length,10,'every stage contains five pre and five post scenes');
 assert.equal(story.panels.filter(p=>p.phase==='pre').length,5);
 assert.equal(story.panels.filter(p=>p.phase==='post').length,5);
 assert.equal(story.previousStageId,CAMPAIGN_STAGES[i-1]?.id||null);
 assert.equal(story.nextStageId,CAMPAIGN_STAGES[i+1]?.id||null);
 assert.ok(story.cast.length>=3,'each stage must include several distinct characters');
 assert.ok(story.panels.every((p,k)=>p.id===stage.id+'-m'+(k+1)));
 assert.ok(story.panels.every(p=>p.text.length>=16),'manga must tell a complete story');
 assert.ok(story.panels.some(p=>p.kind==='confrontation'));
 assert.ok(story.panels.some(p=>p.kind==='choice'));
 assert.ok(story.panels.some(p=>p.kind==='closing'));
 assert.ok(story.panels.some(p=>p.secondaryId),'actors must share a frame');
 assert.ok(story.panels.some(p=>p.speaker!=='語り手'));
 assert.ok(story.panels[9].text.includes(CAMPAIGN_STAGES[i+1]?.name||'未来'),
  'closing frame should physically connect to the next stage');
 for(let n=0;n<story.panels.length;n++){
  const panel=story.panels[n];
  if(panel.characterId)characterPanels++;
  const cue=fantasyCueForMangaPanel(stage,n);
  assert.ok(FANTASY_SCORE_LIBRARY.some(track=>track.id===cue.id));
  // Hold the BGM through a dialogue scene; change for revelation/transition.
  if(n===1||n===2||n===3||n===5||n===7)assert.equal(cue.id,fantasyCueForMangaPanel(stage,n-1).id,
   'dialogue must not switch to a jarring new song at every page');
  if(n===4||n===6||n===8||n===9)assert.notEqual(cue.id,fantasyCueForMangaPanel(stage,n-1).id,
   'a genuine story beat must change the orchestral mood');
  if((i+n)%11===0){
   const art=stageMangaSvg(panel);
   assert.match(art,/<svg[^>]+viewBox="0 0 960 540"/);
   assert.match(art,/<path /);
   assert.match(art,/<ellipse /);
   assert.doesNotMatch(art,/d=""/,'comic character paths cannot be empty');
   assert.match(stageMangaImage(panel),/^data:image\/svg\+xml;charset=utf-8,/);
   artworkSamples.add(art);
  }
 }
}
assert.ok(characterPanels>950,'characters rather than narration must drive the story');
assert.ok(artworkSamples.size>115,'story must contain distinct illustrated shots, not one reused backdrop');
for(const track of FANTASY_SCORE_LIBRARY){
 const uri=track.url.replace(/^\.\//,'');
 assert.ok(fs.existsSync(new URL('../'+uri,import.meta.url)),track.id+' must have a bundled fantasy track');
}
for(const location of ['town','shop','inn','tavern','church','castle','paper','battle','title','opening','map']){
 assert.ok(fantasyCueForLocation(location)?.url,location+' lacks a music cue');
}
const map=read('world-map.html'),town=read('town-hub.html'),title=read('game.html');
const guide=read('src/first-play-guide.js');
assert.match(guide,/export const FIRST_PLAY_GUIDE/);
assert.match(title,/showTutorial\(true\)/,'new game must start with a tutorial');
assert.match(title,/id="tutorialModal"/);
assert.doesNotMatch(title,/setInterval\(nextLine/,'do not automatically rush through a long introduction');
assert.match(map,/mangaViewer\.open\(stage\.id,\{onFinish:/,'sortie must show manga before launching');
assert.match(map,/launchSelectedStage\(stage\.id\)/);
assert.match(map,/mapAudio\.changeScene\('manga',cue\.url\)/);
assert.match(map,/stageMangaSeen\[stage\.id\]=true/);
assert.match(town,/const townManga=mangaForStage\(game\.townStage\)/);
assert.match(town,/stageMangaImage\(shot\)/);
assert.match(town,/townAudio\.setScene\('paper',cue\.url\)/);
assert.match(town,/speakCurrentScene\(\);/);
assert.match(town,/id="eventVoice"[^>]*>音声 ON<\/button>/);
assert.match(title,/const introStory=mangaForStage\('c01-s01'\)/);
assert.match(title,/stageMangaImage\(shot\)/);
assert.match(read('src/story-manga-viewer.js'),/voiceOn=readVoice\(storage\)/);
for(const [name,html] of [['world-map.html',map],['town-hub.html',town],['game.html',title]]){
 const scripts=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length,name+' must contain ES module');
 for(const match of scripts)new SourceTextModule(match[1],{identifier:name});
}
console.log('PASS 200 stages / 2000 manga frames (5 pre+5 post), continuity, identity, artwork, fantasy tracks and default voice');
