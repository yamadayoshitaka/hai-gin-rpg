import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {STORY_KEY_PEOPLE} from '../src/story-cinematic.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {mangaForStage} from '../src/story-stage-manga.js';
import {STORY_VOICE_PROFILES} from '../src/story-voice-director.js';
import {individualStoryPanelAsset} from '../src/story-cinematic-assets.js';
import {
 STORY_FLOW,STORY_CHARACTERS,CHARACTER_FACTION_BY_ID,
 storyDecisionForStage,setStoryDecision,availableStoryRoutes,
 selectStoryRoute,storyAllianceScores,storyStageContext,
 availableStoryEndings,chooseStoryEnding
} from '../src/story-narrative-flow.js';

assert.equal(STORY_FLOW.length,20);
assert.equal(STORY_CHAPTERS.length,20);
assert.equal(CAMPAIGN_STAGES.length,200);
assert.equal(STORY_CHARACTERS.length,20);
assert.equal(Object.keys(STORY_VOICE_PROFILES).length,20);
assert.equal(CHARACTER_FACTION_BY_ID.noel,'neutral');
assert.equal(CHARACTER_FACTION_BY_ID.orphe,'verdant');
assert.equal(CHARACTER_FACTION_BY_ID.vess,'archive');

for(const stage of CAMPAIGN_STAGES){
 const story=mangaForStage(stage.id,{protagonistGender:'male'});
 assert.equal(story.panels.length,7,stage.id);
 assert.equal(story.id,stage.id);
 for(let i=0;i<7;i++){
  const p=story.panels[i];
  assert.equal(p.id,stage.id+'-m'+(i+1));
  if(p.characterId)assert.ok(STORY_VOICE_PROFILES[p.characterId],p.id);
  assert.ok(individualStoryPanelAsset(p)?.endsWith('-m0'+(i+1)+'.webp'));
 }
}
const chapter1=mangaForStage('c01-s01');
assert.deepEqual(chapter1.panels.slice(1,4).map(p=>p.characterId),['lucia','garan','iris']);
assert.equal(STORY_KEY_PEOPLE.find(x=>x.id==='lucia').faction,'灰銀');
assert.ok(mangaForStage('c14-s01',{route:'crimson'}).panels[0].text.includes('ライゼン'));
assert.ok(mangaForStage('c14-s01',{route:'verdant'}).panels[0].text.includes('アルテア'));
const game={completedStages:['c01-s01'],storyFlags:{},history:[],narrativeEnding:null};
assert.deepEqual(availableStoryRoutes(game).filter(r=>r.unlocked),[]);
assert.ok(storyDecisionForStage('c05-s05'));
assert.equal(storyDecisionForStage('c05-s04'),null);
setStoryDecision(game,'c05-s05','protect');
setStoryDecision(game,'c03-s05','preserve');
setStoryDecision(game,'c12-s05','share');
game.completedStages.push('c05-s05','c03-s05','c12-s05','c12-s10','c13-s01');
const scores=storyAllianceScores(game);
assert.equal(scores.crimson,1);
assert.equal(scores.verdant,2);
assert.equal(scores.evidence,1);
assert.equal(availableStoryRoutes(game).filter(r=>r.unlocked).length,4);
assert.equal(selectStoryRoute(game,'independent').id,'independent');
assert.equal(storyStageContext(game,'c14-s02').route,'independent');
assert.throws(()=>selectStoryRoute(game,'crimson'),/変更/);
assert.ok(availableStoryEndings(game).every(e=>!e.unlocked));
game.completedStages.push('c20-s10');
assert.equal(availableStoryEndings(game).filter(e=>e.unlocked).length,2);
setStoryDecision(game,'c15-s05','investigate');
setStoryDecision(game,'c19-s05','inherit');
game.completedStages.push('c15-s05','c19-s05');
assert.equal(availableStoryEndings(game).find(e=>e.id==='inherit').unlocked,true);
assert.equal(chooseStoryEnding(game,'inherit').name,'忘却の朝');
assert.equal(game.narrativeEnding,'inherit');
const paths=['game.html','town-hub.html','world-map.html','dev-menu.html','story-maintenance.html',
 'src/story-voice-director.js','scripts/generate-story-panel-voicevox.mjs'];
for(const p of paths)await stat(new URL('../'+p,import.meta.url));
for(const p of ['game.html','town-hub.html','world-map.html','dev-menu.html']){
 const html=await readFile(new URL('../'+p,import.meta.url),'utf8');
 assert.ok(html.includes('story-maintenance.html'),p+' lacks maintenance link');
}
const artSha=[];
for(let i=1;i<=7;i++){
 const panelPath='assets/story/panels/c01-s01-m'+String(i).padStart(2,'0')+'.webp';
 const bytes=await readFile(new URL('../'+panelPath,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'RIFF',panelPath);
 assert.equal(bytes.toString('ascii',8,12),'WEBP',panelPath);
 assert.ok(bytes.length>25000,'Too small: '+panelPath);
 artSha.push(createHash('sha256').update(bytes).digest('hex'));
}
assert.equal(new Set(artSha).size,7,'Chapter 1 panels must use seven different image files');
assert.equal(STORY_VOICE_PROFILES.garan.voicevoxSpeaker,'剣崎雌雄','Garan must not use the frail elder voice');
console.log('Story flow regression: 20 chapters, 200 stages, 1400 panels, 20 characters, 4 routes, 3 endings, 7 distinct paintings and Garan voice PASS');
