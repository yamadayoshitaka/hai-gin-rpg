import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {
 CAMPAIGN_STAGES,CAMPAIGN_STAGE_BY_ID,STAGES_PER_CHAPTER,TOTAL_CHAPTERS,TOTAL_STAGES,
 stagesInChapter,stageUnlocked,chapterAvailable
} from '../src/campaign-stage-plan.js';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {TERRITORIES,createCampaign,validateSavedCampaign} from '../src/story-campaign.js';
import {
 GAME_SAVE_KEY,GAME_SESSION_KEY,createNewGame,getSavedGame,loadGame,
 saveAtTown,persistSession,stageAtTown,selectCampaignStage,leaveTown,markStageVictory,
 buyTownItem,equipTownItem,migrateLegacy,TOWN_SHOP
} from '../src/game-core-flow.js';
import {makeCoreBattleRequest,settleCoreBattle} from '../src/core-battle-bridge.js';
assert.equal(TOTAL_CHAPTERS,20);assert.equal(STAGES_PER_CHAPTER,10);assert.equal(TOTAL_STAGES,200);
assert.equal(STORY_CHAPTERS.length,20);assert.equal(CAMPAIGN_STAGES.length,200);
const ids=new Set(CAMPAIGN_STAGES.map(x=>x.id));
assert.equal(ids.size,200,'stage IDs unique');
const monsters=new Set(MONSTER_CATALOG.map(x=>x.id)),regions=new Set(TERRITORIES.map(t=>t.id));
for(let i=1;i<=20;i++){
 const stages=stagesInChapter(i);
 assert.equal(stages.length,10);
 assert.equal(stages[0].kind,'town');
 assert.equal(stages[0].canSave,true);
 assert.equal(stages[1].kind,'explore');
 assert.equal(stages[1].winCondition,'出現した全モンスターを討伐');
 assert.deepEqual(stages.map(s=>s.slot),[1,2,3,4,5,6,7,8,9,10]);
 for(const stage of stages){
  assert.ok(regions.has(stage.territoryId),'stage with valid region');
  assert.ok(stage.name.length>2);
  assert.ok(stage.scenePreset);
  assert.ok(stage.monsters.every(id=>monsters.has(id)),'all monsters registered');
  if(stage.kind==='explore'||stage.kind==='boss')assert.ok(stage.monsters.length>0);
 }
 if(i>1)assert.equal(stages[0].lockedAfter,'c'+String(i-1).padStart(2,'0')+'-s10');
}
assert.equal(chapterAvailable(1,[]),true);assert.equal(chapterAvailable(2,[]),false);
function storage(){const data=new Map();return {
 getItem:key=>data.get(key)??null,setItem:(key,val)=>data.set(key,String(val)),
 removeItem:key=>data.delete(key),size:()=>data.size};}
const local=storage(),session=storage();
const game=createNewGame('零章軍師',{gender:'female',faceId:3});
assert.equal(game.location,'town');
assert.equal(game.completedStages.length,1);
assert.equal(game.townStage,'c01-s01');
assert.equal(game.campaign.commander.gender,'female');
assert.ok(!local.getItem(GAME_SAVE_KEY),'creating a game alone must not save');
assert.equal(buyTownItem(game,'potion').balance,270);
assert.equal(game.inventory.potion,4);
assert.throws(()=>buyTownItem(game,'chain_mail',20),/不足/);
const buy=buyTownItem(game,'iron_sword');
assert.equal(buy.price,120);
equipTownItem(game,'iron_sword');
assert.equal(game.equipment.weapon,'iron_sword');
leaveTown(game);
assert.throws(()=>saveAtTown(game,local,session),/町/);
assert.equal(selectCampaignStage(game,'c01-s02').id,'c01-s02');
assert.throws(()=>selectCampaignStage(game,'c01-s04'),/未|まだ/);
assert.throws(()=>markStageVictory(game,'c01-s02',{verified:true,victory:true,monstersRemaining:1,objectiveCompleted:true}),/モンスター/);
const request=makeCoreBattleRequest(game,'c01-s02','core-qa-01');
assert.equal(request.origin,'game-core');assert.equal(request.enemyMode,'monsters');
assert.ok(request.enemyMonsterIds.length>0);
assert.equal(request.units.length,40);
assert.ok(request.commanders[0].name);
assert.throws(()=>settleCoreBattle(game,request,{battleId:'wrong',territoryId:request.territoryId,victory:true,casualties:[],monstersRemaining:0}),/不正/);
const outcome=settleCoreBattle(game,request,{
 battleId:request.battleId,territoryId:request.territoryId,stageId:'c01-s02',
 victory:true,monstersRemaining:0,objectiveCompleted:true,casualties:[]
});
assert.equal(outcome.victory,true);assert.equal(outcome.next.id,'c01-s03');
assert.ok(game.completedStages.includes('c01-s02'));
assert.ok(stageUnlocked(CAMPAIGN_STAGE_BY_ID['c01-s03'],game.completedStages));
assert.throws(()=>settleCoreBattle(game,request,{
 battleId:request.battleId,territoryId:request.territoryId,victory:true,monstersRemaining:0,casualties:[]
}),/二重/);
stageAtTown(game,'c01-s01');assert.equal(game.location,'town');
saveAtTown(game,local,session);
assert.ok(local.getItem(GAME_SAVE_KEY),'only town save writes persistent record');
assert.equal(loadGame(local,storage()).playerName,'零章軍師');
assert.equal(getSavedGame(local).wallet,150);
const legacy=createCampaign('旧軍師');
assert.ok(validateSavedCampaign(legacy));assert.equal(migrateLegacy(legacy).playerName,'旧軍師');
const oldOnly=storage();oldOnly.setItem('hai-gin-story-campaign-v1',JSON.stringify(legacy));
assert.equal(getSavedGame(oldOnly).playerName,'旧軍師');
assert.equal(TOWN_SHOP.length,7);
const root=path.dirname(fileURLToPath(import.meta.url)),base=path.resolve(root,'..');
for(const name of ['game.html','town-hub.html','world-map.html','tactics-wireframe.html']){
 const html=fs.readFileSync(path.join(base,name),'utf8');
 assert.match(html,/<!doctype html>/i);
 assert.match(html,/<\/html>/i);
 const js=[...html.matchAll(/<script\s+type="module">([\s\S]*?)<\/script>/g)];
 assert.equal(js.length,1,name+' must contain exactly one inline module');
 new vm.SourceTextModule(js[0][1],{identifier:name});
 const localImports=[...js[0][1].matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)].map(m=>m[1]);
 for(const relative of localImports)assert.ok(fs.existsSync(path.join(base,relative)),name+' missing '+relative);
}
for(const name of ['game.html','town-hub.html','world-map.html']){
 const html=fs.readFileSync(path.join(base,name),'utf8');
 assert.match(html,/overflow:hidden/i,name+' forbids free page scrolling');
}
const battleHtml=fs.readFileSync(path.join(base,'tactics-wireframe.html'),'utf8');
assert.ok(battleHtml.includes("storyRequest?.origin==='game-core'"),'battle returns to new world map');
assert.ok(battleHtml.includes("createMonsterModel(a.monsterSpec"),'3D monster integration present');
assert.ok(battleHtml.includes('monstersRemaining'),'battle return tracks all surviving monsters');
console.log('GAME CORE OK: 20 chapters / 200 stage slots / town-only save / 3D monster clear / no-scroll title, town and map');
