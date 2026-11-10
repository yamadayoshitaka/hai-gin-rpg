import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTINENTS,continentForChapter,continentMapSvg,continentStagePoints} from '../src/continent-campaign.js';
import {CAMPAIGN_STAGES,stagesInChapter} from '../src/campaign-stage-plan.js';
import {STAGE_PRESETS,selectStageObjects} from '../src/stage-library.js';
import {createNewGame} from '../src/game-core-flow.js';
import {drawRecruitGacha,RECRUIT_GACHA} from '../src/town-recruit-gacha.js';
import {resolveTownConversation} from '../src/town-dialogue-catalog.js';
import {CHARACTER_MODEL_REGISTRY} from '../src/character-model-registry.js';
import {MODEL_FIRST_CATALOG} from '../src/model-first-catalog.js';

assert.equal(CONTINENTS.length,20);
assert.equal(new Set(CONTINENTS.map(c=>c.id)).size,20);
assert.equal(new Set(CONTINENTS.map(c=>c.name)).size,20);
assert.equal(new Set(CONTINENTS.map(c=>continentMapSvg(c.chapter))).size,20);
assert.equal(CAMPAIGN_STAGES.length,200);
assert.equal(new Set(CAMPAIGN_STAGES.map(s=>s.scenePreset)).size,200);
const sceneIds=new Set(STAGE_PRESETS.map(s=>s.id));
for(let chapter=1;chapter<=20;chapter++){
 const continent=continentForChapter(chapter);
 const stages=stagesInChapter(chapter);
 assert.equal(stages.length,10);
 assert.equal(continentStagePoints(chapter).length,10);
 assert.ok(continent.conflict.length>=20,'every continent has meaningful narrative conflict');
 assert.ok(stages.every(s=>s.continentId===continent.id));
 assert.ok(stages.every(s=>sceneIds.has(s.scenePreset)));
 assert.equal(stages[0].kind,'town');
 assert.ok(stages.every((s,i)=>s.storyBeat&&s.slot===i+1));
 assert.ok(stages.every(s=>s.chapterConflict===continent.conflict));
}
assert.equal(stagesInChapter(1)[0].scenePreset,'royal-castle');

const wild=STAGE_PRESETS.find(s=>s.id==='deep-forest');
const props=[{id:'wood_fence',x:80,z:80},{id:'town_fence_001',x:83,z:80},{id:'town_planter_001',x:86,z:81}];
const tiles=Array.from({length:232*232},()=> 'grass');
const retained=selectStageObjects(props,wild,{tiles,width:232});
assert.equal(retained.filter(o=>/fence|planter/.test(o.id)).length,3,
 'stage culling must not remove authored fences and flower planters');

const game=createNewGame('召喚QA');
game.campaign.treasury=10000;
for(let i=0;i<40;i++){
 const draw=drawRecruitGacha(game,()=>.99);
 assert.ok(CHARACTER_MODEL_REGISTRY.male.id===draw.modelId||CHARACTER_MODEL_REGISTRY.female.id===draw.modelId);
 assert.ok(game.campaign.squads.some(s=>s.id===draw.id&&s.commanderId==='reserve'));
 if(i===9)assert.equal(draw.rarity,'R','guaranteed R at tenth draw');
 if(i===39)assert.equal(draw.rarity,'UR','guaranteed UR at fortieth draw');
}
assert.equal(game.campaign.treasury,10000-RECRUIT_GACHA.cost*40);
const oldTotal=game.campaign.squads.length;
game.campaign.treasury=0;
assert.throws(()=>drawRecruitGacha(game,()=>.5),/不足/);
assert.equal(game.campaign.squads.length,oldTotal);

for(const panel of ['weapons','items','formation','tavern','save','story']){
 const talk=resolveTownConversation({panel,chapter:12});
 assert.ok(talk.panel);
 assert.ok(talk.lines.length>=3);
 assert.ok(talk.modelId.startsWith('Superhero_'));
}
const villager=resolveTownConversation({npcId:'street-1',chapter:20});
assert.ok(villager.lines.some(x=>x.includes(continentForChapter(20).name)));
assert.ok(villager.lines.length>=3);
const stageHtml=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const hubHtml=fs.readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const worldHtml=fs.readFileSync(new URL('../world-map.html',import.meta.url),'utf8');
assert.match(stageHtml,/MODEL_FIRST_CATALOG\[key\]\.url/,
 'villager model loader must resolve paths from the registered model catalog');
assert.match(stageHtml,/getSource\(citizen\.modelKey\)/,
 'each displayed citizen must use its catalog model key');
assert.match(stageHtml,/occlusionCandidates\.filter\(item=>item\.id==='tree_deciduous_001'\)/,
 'fence and flower cutaway must not be eligible');
assert.match(hubHtml,/data-gacha-draw/);
assert.match(hubHtml,/hai-gin-town-npc/);
assert.match(worldHtml,/continentMapUrl\(chapter\)/);
assert.ok(MODEL_FIRST_CATALOG.civilianMale.url);
assert.ok(MODEL_FIRST_CATALOG.civilianFemale.url);
console.log('20 continents, 200 stages, gacha, citizens, dialogue, fences/flowers: PASS');
