import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame,leaveTown} from '../src/game-core-flow.js';
import {makeCoreBattleRequest,settleCoreBattle} from '../src/core-battle-bridge.js';
import {armyTroops,maxSquads} from '../src/story-campaign.js';
import {
 commanderList,commanderGroup,resolvedCommanderDeployment,placeCommander,
 autoDeployCommanders,commandSquadIds
} from '../src/inn-commander-formation.js';

const game=createNewGame('主役軍師',{gender:'female',faceId:2});
assert.equal(commanderList(game.campaign).length,1);
assert.equal(commanderGroup(game.campaign,'player').length,2,
 'existing 30 knights and 10 priests remain two job records in one strategist formation');
assert.equal(resolvedCommanderDeployment(game.campaign).get('player'),10);
const treasury=game.campaign.treasury;
const result=autoDeployCommanders(game.campaign,{priority:'防御重視'});
assert.equal(result.hired,1,'level 1 unlocks only one extra commander');
assert.equal(result.leaders,2);
assert.equal(game.campaign.treasury,treasury-700,'600G strategist + 100G ten normal defenders');
assert.equal(armyTroops(game.campaign,'player'),40);
assert.equal(armyTroops(game.campaign,'1'),10);
assert.equal(commanderGroup(game.campaign,'1')[0].job,'盾騎士');
assert.equal(autoDeployCommanders(game.campaign).hired,0,'no duplicate auto-hiring');
const initial=resolvedCommanderDeployment(game.campaign);
assert.equal(initial.size,2,'one slot per commander, not per job subgroup');
const nextSlot=initial.get('1');
assert.ok(placeCommander(game.campaign,'player',nextSlot));
assert.equal(resolvedCommanderDeployment(game.campaign).get('player'),nextSlot);
assert.equal(resolvedCommanderDeployment(game.campaign).get('1'),10);
assert.equal(commandSquadIds(game.campaign.squads.filter(s=>s.commanderId!=='reserve')).size,2);

leaveTown(game);
const request=makeCoreBattleRequest(game,'c01-s02','hero-death-contract');
assert.equal(request.units.length,50);
assert.equal(new Set(request.units.map(u=>u.squadId)).size,2,
 'two strategists each have one command squad irrespective of job mix');
assert.equal(request.units.filter(u=>u.isStrategist).length,2);
assert.equal(request.units.filter(u=>u.isPlayerHero).length,1);
assert.equal(request.units.filter(u=>u.commanderId==='player').length,40);
assert.ok(request.units.filter(u=>u.commanderId==='player').every(u=>u.deploymentSlot===nextSlot));
const playerJobs=new Set(request.units.filter(u=>u.commanderId==='player').map(u=>u.sourceSquadId));
assert.equal(playerJobs.size,2,'job subgroup IDs remain available for valid casualties');
const priest=request.units.find(u=>u.commanderId==='player'&&u.job==='僧侶');
const beforePriest=game.campaign.squads.find(s=>s.id===priest.sourceSquadId).count;
const settled=settleCoreBattle(game,request,{
 battleId:request.battleId,territoryId:request.territoryId,victory:true,
 playerCommanderDead:true,monstersRemaining:0,casualties:[{squadId:priest.sourceSquadId,count:1}]
});
assert.equal(settled.victory,false,'a dead protagonist cannot be awarded victory');
assert.equal(settled.playerCommanderDead,true);
assert.ok(game.campaign.gameOver.includes('GAME OVER'));
assert.equal(game.campaign.commander.active,false);
assert.equal(game.location,'gameover');
assert.equal(game.campaign.squads.find(s=>s.id===priest.sourceSquadId).count,beforePriest-1);
assert.ok(!game.completedStages.includes('c01-s02'));
assert.equal(settled.rewards.gold,0);
assert.throws(()=>makeCoreBattleRequest(game,'c01-s02','again'),/地図上/);

const poor=createNewGame('資金不足');
poor.campaign.treasury=650;
const poorCount=poor.campaign.commanders.length;
assert.equal(autoDeployCommanders(poor.campaign).hired,0);
assert.equal(poor.campaign.commanders.length,poorCount);
assert.ok(maxSquads(poor.campaign)<=10);

const inn=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const map=readFileSync(new URL('../world-map.html',import.meta.url),'utf8');
assert.match(inn,/data-inn-auto-place/);
assert.match(inn,/data-inn-template-auto/);
assert.match(inn,/data-inn-commander/);
assert.match(inn,/data-inn-initial-order/);
assert.match(inn,/placeCommander\(game.campaign,innDeploymentSelected,slot\)/);
assert.match(inn,/autoDeployCommanders\(game.campaign/);
assert.doesNotMatch(inn,/<select id="innCommanderSelect"/);
assert.doesNotMatch(inn,/<select id="autoPriority"/);
assert.match(battle,/isPlayerHero/);
assert.match(battle,/completeBattle\(false,\{title:'GAME OVER'/);
assert.match(battle,/sourceSquadId\?\?a\.squadId/);
assert.match(map,/function showCampaignGameOver\(\)/);
for(const [id,html] of [['town',inn],['battle',battle],['map',map]]){
 const modules=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.ok(modules.length,id+' inline module');
 new SourceTextModule(modules.at(-1)[1],{identifier:id});
}
console.log('Inn commander formations, funded hiring, strategy buttons and protagonist game-over PASS');
