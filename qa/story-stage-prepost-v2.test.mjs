import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {
 MANGA_STAGE_COUNT,MANGA_PANELS_PER_STAGE,MANGA_TOTAL_PANELS,
 MANGA_PRE_BATTLE_PANELS,MANGA_POST_BATTLE_PANELS,mangaForStage
} from '../src/story-stage-manga.js';
import {storyVoiceText,storyRubyTokens,STORY_READINGS} from '../src/story-pronunciations.js';
import {individualStoryPanelAsset} from '../src/story-cinematic-assets.js';

assert.equal(MANGA_STAGE_COUNT,200);
assert.equal(MANGA_PANELS_PER_STAGE,10);
assert.equal(MANGA_TOTAL_PANELS,2000);
assert.equal(MANGA_PRE_BATTLE_PANELS,5);
assert.equal(MANGA_POST_BATTLE_PANELS,5);
assert.equal(CAMPAIGN_STAGES.length,200);

const allIds=new Set();
for(const stage of CAMPAIGN_STAGES){
 const victorious=mangaForStage(stage.id,{protagonistGender:'male',battleOutcome:{victory:true,casualties:6}});
 const defeated=mangaForStage(stage.id,{protagonistGender:'male',battleOutcome:{victory:false,casualties:2}});
 const neutral=mangaForStage(stage.id);
 assert.equal(victorious.panels.length,10,stage.id);
 assert.equal(defeated.panels.length,10,stage.id);
 assert.equal(neutral.panels.length,10,stage.id);
 for(let i=0;i<10;i++){
  const panel=victorious.panels[i],other=defeated.panels[i];
  assert.equal(panel.id,stage.id+'-m'+(i+1));
  assert.equal(panel.phase,i<5?'pre':'post');
  assert.equal(other.id,panel.id);
  assert.equal(panel.subtitleText,panel.text);
  assert.equal(panel.voiceText,storyVoiceText(panel.text));
  assert.equal(panel.protagonistGender,'male');
  assert.ok(panel.text.length>=16,'stage needs a meaningful line: '+panel.id);
  assert.ok(!allIds.has(panel.id),'duplicate canonical panel '+panel.id);
  allIds.add(panel.id);
  assert.ok(individualStoryPanelAsset(panel)?.endsWith('-m'+String(i+1).padStart(2,'0')+'.webp'));
  if(i<5)assert.equal(panel.text,other.text,'pre-battle story must not leak the result');
 }
 if(stage.kind!=='town'){
  assert.match(victorious.panels[5].text,/作戦目標を達成/);
  assert.match(defeated.panels[5].text,/撤退/);
  assert.notEqual(victorious.panels[5].text,defeated.panels[5].text);
  assert.match(defeated.panels[9].text,/町で編成を立て直/);
  assert.doesNotMatch(defeated.panels[9].text,/次の舞台/);
  assert.ok(!neutral.panels[5].text.includes('作戦目標を達成'),
   'preview without a combat receipt must not pretend a victory');
 }
}
assert.equal(allIds.size,2000);
assert.equal(storyVoiceText('灰銀の王都レヴナ。星鐘を守ろう。'),'はいぎんのおうとれぶな。 せいしょうを守ろう。');
assert.equal(STORY_READINGS['ガラン'],'がらん');
assert.equal(storyRubyTokens('灰銀・レヴナ')[0].ruby,'はいぎん');

const town=await readFile(new URL('../town-hub.html',import.meta.url),'utf8');
assert.ok(town.includes("startPaperStory('post')"),'town must show a five-shot epilogue before returning to map');
assert.ok(town.includes('stagePostMangaSeen'),'town post event must be remembered');
const map=await readFile(new URL('../world-map.html',import.meta.url),'utf8');
const viewer=await readFile(new URL('../src/story-manga-viewer.js',import.meta.url),'utf8');
const voice=await readFile(new URL('../scripts/generate-story-panel-voicevox.mjs',import.meta.url),'utf8');
assert.ok(map.includes("sessionStorage.setItem(POST_EVENT_PENDING_KEY"));
assert.ok(map.includes("phase:'post'"));
assert.ok(map.includes("phase:'pre'"));
assert.ok(map.includes("stagePostMangaSeen"));
assert.ok(map.includes("settleCoreBattle(game,request,result)"));
assert.ok(viewer.includes("visiblePanels=which==='all'?story.panels:story.panels.filter"));
assert.ok(voice.includes("panel.voiceText.slice(0,380)"));
console.log('PASS: all 200 stages, 2000 canonical panels, 5+5, verified result epilogues and proper-noun voice readings');
