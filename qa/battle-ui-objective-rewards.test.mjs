import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {makeCoreBattleRequest,settleCoreBattle} from '../src/core-battle-bridge.js';
import {coreVictoryReward,verifiedBattleLoot,territoryVictoryReward} from '../src/battle-victory-rewards.js';
import {CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';

const stage=CAMPAIGN_STAGE_BY_ID['c01-s02'];
const reward=coreVictoryReward(stage);
assert.ok(reward.gold>0&&reward.xp>0);
assert.deepEqual(coreVictoryReward(null),{gold:0,xp:0,loot:[]});
assert.deepEqual(verifiedBattleLoot([{itemId:'old_map',quantity:1},{itemId:'old_map',quantity:2}])
 .map(x=>[x.itemId,x.quantity]),[['old_map',3]]);
assert.deepEqual(verifiedBattleLoot([{itemId:'made-up-treasure',quantity:100}]),[]);
assert.equal(territoryVictoryReward({base:true}).xp,200);

const game=createNewGame('テスト軍師');
game.location='map';
const request=makeCoreBattleRequest(game,stage.id,'victory-gold-xp-loot');
const beforeWallet=game.wallet,beforeXp=game.campaign.commander.xp;
const result={battleId:request.battleId,territoryId:request.territoryId,
 victory:true,casualties:[],monstersRemaining:0,objectiveCompleted:true,
 loot:[{itemId:'old_map',quantity:1},{itemId:'arcane_crystal',quantity:2}]};
const settled=settleCoreBattle(game,request,result);
assert.equal(settled.rewards.gold,reward.gold);
assert.equal(settled.rewards.xp,reward.xp);
assert.equal(game.wallet-beforeWallet,reward.gold);
assert.ok(game.campaign.commander.xp>beforeXp||game.campaign.commander.level>1);
assert.equal(game.inventory.old_map,1);
assert.equal(game.inventory.arcane_crystal,2);
assert.throws(()=>settleCoreBattle(game,request,result),/二重/);

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const inn=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/battle-ui-refinement.css',import.meta.url),'utf8');
assert.match(battle,/battle-finished/);
assert.match(battle,/showBattleVictoryRewards\(Boolean\(victory\)\)/);
assert.match(battle,/battleTreasureReceipt\(\)/);
assert.match(battle,/const visibleRibbonPageSize=Math\.max\(3,/);
assert.match(battle,/squadPrimaryJob\(row\.id,team,sums\)/);
assert.match(battle,/function confirmCircleActionTarget\(\)/);
assert.match(battle,/action\.selectedTargetId=String\(id\)/);
assert.match(battle,/getObjective:/);
assert.match(battle,/getStrategies:/);
assert.match(inn,/renderInnPages\(\)/);
assert.match(inn,/次の戦場/);
assert.match(css,/body\.battle-finished #allySquadRibbon/);
assert.match(css,/#victoryRewards/);
assert.match(css,/#battleTargetConfirm/);
const scripts=[...battle.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length>0);
new SourceTextModule(scripts.at(-1)[1]);
const townScripts=[...inn.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
assert.ok(townScripts.length>0);
new SourceTextModule(townScripts.at(-1)[1]);
console.log('Battle UI v2.2: stage win rewards, physical treasure, camera target confirm, no-scroll pages OK');
