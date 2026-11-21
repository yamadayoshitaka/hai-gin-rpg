import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNewGame,getSavedGame,getSaveSlots,saveAtTown} from '../src/game-core-flow.js';
import {tavernQuestStages,runTavernSideQuest,tavernQuestBattleSettings,tavernQuestBattleReward} from '../src/town-side-quests.js';
import {makeCoreBattleRequest,settleCoreBattle} from '../src/core-battle-bridge.js';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,val)=>map.set(key,String(val))};};
const local=storage(),session=storage(),game=createNewGame('三枠QA');
assert.equal(getSaveSlots(local).length,3);
assert.equal(getSaveSlots(local).filter(x=>x.game).length,0);
game.wallet=111;saveAtTown(game,local,session,1);
game.wallet=222;saveAtTown(game,local,session,2);
game.wallet=333;saveAtTown(game,local,session,3);
assert.deepEqual([1,2,3].map(n=>getSavedGame(local,n).wallet),[111,222,333]);
assert.equal(getSavedGame(local,4),null);
assert.throws(()=>saveAtTown(game,local,session,4),/1〜3/);
assert.equal(getSavedGame(local,1).wallet,111);
game.location='map';
assert.throws(()=>saveAtTown(game,local,session,1),/町/);
game.location='town';
assert.equal(tavernQuestStages(game).length,0,'first town does not count as a battle victory');
game.completedStages.push('c01-s02');
const unlocked=tavernQuestStages(game);
assert.equal(unlocked.length,1);
assert.equal(unlocked[0].quests.length,2);
const initialWallet=game.wallet;
const initialCompleted=[...game.completedStages];
assert.throws(()=>runTavernSideQuest(game,unlocked[0].quests[0].id,0),/戦闘ID/);
const first=runTavernSideQuest(game,unlocked[0].quests[0].id,0,'battle-loss');
assert.equal(game.wallet,initialWallet,'clicking a tavern button must NEVER grant a reward');
game.location='map';
const defeated=makeCoreBattleRequest(game,first.quest.stageId,'battle-loss');
Object.assign(defeated,tavernQuestBattleSettings(game,first.pending));
assert.equal(defeated.enemyMode,'monsters');
assert.equal(defeated.stageKind,'explore');
assert.ok(defeated.enemyMonsterIds.length>=1);
const lose=settleCoreBattle(game,defeated,{
 battleId:defeated.battleId,territoryId:defeated.territoryId,victory:false,
 casualties:[],monstersRemaining:2,objectiveCompleted:false,loot:[]
});
assert.equal(lose.victory,false);
assert.equal(game.wallet,initialWallet,'defeat must not award gold');
assert.equal(game.pendingTavernQuest,undefined,'failed mission must be retryable');
assert.equal(tavernQuestStages(game)[0].quests[0].completed,false);
game.location='town';
const retry=runTavernSideQuest(game,first.quest.id,1,'battle-victory');
game.location='map';
const request=makeCoreBattleRequest(game,retry.quest.stageId,'battle-victory');
Object.assign(request,tavernQuestBattleSettings(game,retry.pending));
const expectation=tavernQuestBattleReward(request);
assert.throws(()=>settleCoreBattle(game,{...request,sideQuestId:'c01-s02-recon'},{
 battleId:request.battleId,territoryId:request.territoryId,victory:true,
 casualties:[],monstersRemaining:0,objectiveCompleted:true,loot:[]
}),/照合/,'tampered side quest ID must be rejected');
assert.equal(game.wallet,initialWallet);
const win=settleCoreBattle(game,request,{
 battleId:request.battleId,territoryId:request.territoryId,victory:true,
 casualties:[],monstersRemaining:0,objectiveCompleted:true,loot:[]
});
assert.equal(win.victory,true);
assert.equal(win.rewards.gold,expectation.gold);
assert.equal(win.rewards.xp,expectation.xp);
assert.equal(game.wallet,initialWallet+expectation.gold);
assert.deepEqual(game.completedStages,initialCompleted,'side quest must never unlock story stages');
assert.equal(tavernQuestStages(game)[0].quests[0].completed,true);
assert.equal(tavernQuestStages(game)[0].quests[1].completed,false);
assert.throws(()=>settleCoreBattle(game,request,{
 battleId:request.battleId,territoryId:request.territoryId,victory:true,
 casualties:[],monstersRemaining:0,objectiveCompleted:true
}),/二重/);
game.location='town';
assert.throws(()=>runTavernSideQuest(game,first.quest.id,0,'another'),/受取済み/);
game.completedStages.push('c01-s03');
assert.equal(tavernQuestStages(game).flatMap(g=>g.quests).length,4);
const hub=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const title=readFileSync(new URL('../game.html',import.meta.url),'utf8');
const map=readFileSync(new URL('../world-map.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const token of ['id="equipSquadSelect"','data-save-slot','data-tavern-section','data-tavern-quest','facilityBackdrop','panelSceneBanner','makeCoreBattleRequest(game,pending.stageId'])
 assert.ok(hub.includes(token),'town UI missing '+token);
assert.ok(title.includes('getSaveSlots(localStorage)'));
assert.ok(map.includes('if(request.sideQuestId)'));
assert.ok(battle.includes("storyRequest?.sideQuestId?'🍺 酒場へ戻る'"));
for(const kind of ['tavern','weapons','items','formation','save','story']){
 const interior=readFileSync(new URL('../assets/town/facilities/'+kind+'.svg',import.meta.url),'utf8');
 const keeper=readFileSync(new URL('../assets/town/portraits/'+kind+'.svg',import.meta.url),'utf8');
 assert.ok(interior.startsWith('<svg')&&interior.includes('viewBox="0 0 960 560"'));
 assert.ok(keeper.startsWith('<svg')&&keeper.includes('viewBox="0 0 160 180"'));
}
console.log('3 independent saves, 6 facilities, 6 portraits and battle-only tavern reward settlement: PASS');
