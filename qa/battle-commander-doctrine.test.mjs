import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {COMMAND_RALLY_EFFECTS,commanderTargetLimit,strengthFromHp,
 squadCombatMeters,reinforcementSlots,REINFORCEMENT_ITEMS} from '../src/battle-command-doctrine.js';
import {makeBattleRpgStatusRows} from '../src/battle-rpg-squad-source.js';
import {ROOM_ITEM_TYPES,RoomItemRegistry} from '../src/room-item-registry.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {battleJobSpecialActions} from '../src/battle-job-special-actions.js';

test('wounded troops lose attack only; defense and speed are not changed',()=>{
 assert.equal(strengthFromHp(100,100),1);
 assert.equal(strengthFromHp(25,100),.25);
 assert.equal(strengthFromHp(0,100),0);
 const units=[
  {team:0,squadId:'A',alive:true,hp:25,maxHp:100,mp:10,maxMp:100},
  {team:0,squadId:'A',alive:false,hp:0,maxHp:100,mp:50,maxMp:100}
 ];
 const meter=squadCombatMeters(units,0,'A');
 assert.deepEqual(meter,{attackPercent:13,mp:10,maxMp:200});
 const sums=new Map([['0:A',{n:1,total:2,hp:25,maxHp:100,x:30,z:40}]]);
 const rows=makeBattleRpgStatusRows({sums,units,allyIds:['A'],getJob:()=> '剣士'});
 assert.equal(rows[0].attackPercent,13);
 assert.equal(rows[0].mp,10);
 assert.equal(rows[0].maxMp,200);
 assert.equal(rows[0].effects.length,0,'no invented buffs');
});
test('commander target cap is 1/2/3 squads, with finite reserve tokens',()=>{
 assert.deepEqual([1,9,10,19,20,99].map(commanderTargetLimit),[1,1,2,2,3,3]);
 assert.equal(reinforcementSlots('healing_potion',1),1);
 assert.equal(reinforcementSlots('elixir',1),2);
 assert.equal(reinforcementSlots('elixir',20),3);
 assert.equal(reinforcementSlots('invalid',99),0);
 assert.ok(REINFORCEMENT_ITEMS.every(id=>ROOM_ITEM_TYPES[id].category==='援軍'));
 assert.equal(ROOM_ITEM_TYPES.healing_potion.name,'援軍の兵符');
 assert.equal(ROOM_ITEM_TYPES.healing_potion.kind,'heal','retain stable save IDs');
 assert.deepEqual(Object.keys(COMMAND_RALLY_EFFECTS),['attack','defend','advance']);
});
test('actual positive commander buffs appear as badges until they expire',()=>{
 const units=[{team:0,squadId:'x',alive:true,hp:100,maxHp:100,mp:70,maxMp:100}];
 const sums=new Map([['0:x',{n:1,total:1,hp:100,x:0,z:0}]]);
 const commanderRallies=new Map([['x',[{...COMMAND_RALLY_EFFECTS.attack,until:30}]]]);
 const rows=makeBattleRpgStatusRows({units,sums,allyIds:['x'],now:12,commanderRallies});
 assert.deepEqual(rows[0].effects,[{kind:'buff',label:'攻↑20%',seconds:18}]);
 assert.equal(makeBattleRpgStatusRows({units,sums,allyIds:['x'],now:31,commanderRallies})[0].effects.length,0);
});
test('real 50v50 simulation refills fallen soldier slots, not squad size',()=>{
 const side=50,width=232,height=232;
 const sim=new MassBattleGridSimulation(side,20261119,{
  width,height,walkable:new Uint8Array(width*height).fill(1),
  riverXAt:()=>116,bridges:[{x:116,z:116,type:'stone'}]
 });
 const soldiers=sim.units.filter(u=>u.team===0&&String(u.squadId)==='0'&&!u.isStrategist);
 assert.ok(soldiers.length>1);
 const victim=soldiers[0];victim.hp=0;victim.alive=false;
 const originalSize=sim.units.length;
 const result=sim.reinforceSquadFromReserve('0',1);
 assert.equal(result.added,1);
 assert.equal(victim.alive,true);
 assert.equal(victim.hp,victim.maxHp);
 assert.equal(sim.units.length,originalSize);
 assert.equal(sim.reinforceSquadFromReserve('0',1).added,0);
});
test('summoner, thief and ranged job menu connects to real game functions',()=>{
 const thief=battleJobSpecialActions('シーフ');
 const mage=battleJobSpecialActions('魔法使い');
 const summon=battleJobSpecialActions('召喚士');
 assert.ok(thief.some(a=>a.id==='unlock_door'));
 assert.ok(summon.some(a=>a.id==='summon_and_attack'));
 assert.equal(summon.some(a=>a.id==='summon_and_move'),false,'no move-only summon action');
 assert.ok(mage.some(a=>a.id==='high_ground'));
 assert.ok(battleJobSpecialActions('弓使い').some(a=>a.id==='high_ground'));
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const menu=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const sim=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
 assert.match(game,/issueCommanderReinforcements/);
 assert.match(game,/issueCommanderRally/);
 assert.match(game,/massSim\?\.orderSquadHighGround/);
 assert.match(game,/massSim\.summonSquadCreature/);
 assert.match(menu,/id="realtimeRally"/);
 assert.match(menu,/onReinforce\(id,entry\.itemId\)/);
 assert.match(menu,/getRallyInfo\(String\(selectedId\)\)/);
 assert.match(sim,/orderSquadHighGround\(squadId,routeIndex,team=0\)/);
 assert.match(worker,/case 'reinforceSquad'/);
 assert.match(worker,/case 'summonSquadCreature'/);
 assert.match(worker,/case 'orderSquadHighGround'/);
});

test('commander-owned inventory, priest defense options and persistent action focus',()=>{
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 assert.deepEqual(battleJobSpecialActions('僧侶').map(action=>action.id),['heal_ally','revive_ally']);
 assert.match(ui,/showGuardChoices\(\)/);
 assert.match(ui,/realtimeDockGuardChoices/);
 assert.match(ui,/actionDescription\(/);
 assert.match(ui,/aria-pressed/);
 assert.match(ui,/軍師が兵符/);
 assert.match(game,/action==='revive_ally'/);
 assert.match(game,/massSim\.requestSquadHealing/);
 assert.match(game,/Player is the commander: never auto-spend/);
 assert.match(styles,/rpgSquadMpMeter\{width:50%;max-width:50%/);
});

test('tabs separate tactics, buffs and army-shared battle pickups',()=>{
 const command=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 for(const id of ['realtimeTabStrategy','realtimeTabRally','realtimeTabItems','realtimeManageItems'])
  assert.match(command,new RegExp('id="'+id+'"'));
 assert.match(command,/function setDockTab\(next='strategy'\)/);
 assert.match(command,/if\(rally\)showRallyChoices\(\)/);
 assert.match(command,/closeSquadControls\(\);onManageItems\(targetId\)/);
 assert.match(css,/realtimeCommandTabs button\[aria-selected="true"\]/);
 assert.match(game,/onManageItems:id=>openBattleItemsForSquad\(id\)/);
 assert.match(game,/function sharedInventoryCommanderId\(/);
 assert.match(game,/for\(const stack of stocks\)amounts\.set\(stack\.itemId/);
 assert.match(game,/roomItemRegistry\.owned\(\)\.filter\(stack=>stack\.quantity>0&&alliedIds\.has/);
 assert.match(game,/sharedInventoryCommanderId\(issuerSquadId\?\?squadId\)/);
 assert.match(game,/戦闘中の取得品も全軍共有/);
});

test('commander consumables never await movement and buildings have confirmable numbered map pins',()=>{
 const ui=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(ui,/mode==='move'&&actionDestination&&!entry\.itemId/);
 assert.match(ui,/const accepted=entry\.itemId\?onReinforce\(id,entry\.itemId\)/);
 assert.match(ui,/id="realtimeMapManageItems"/);
 assert.match(ui,/onManageItems\(targetId\)/);
 assert.match(ui,/className='realtimeStructureMap'/);
 assert.match(ui,/\['building','bridge','door','height'\]\.includes\(action\.target\)/);
 assert.match(ui,/✅ 選択した対象に作戦を実行/);
 assert.match(css,/realtimeContextChoices:has\(\.realtimeStructureMap\)/);
 assert.match(html,/return \{id:String\(o\.id\),x:o\.x,z:o\.z/);
 assert.match(html,/label:.*kind==='bridge'/);
 assert.match(html,/全軍共通アイテム（距離制限なし）/);
 assert.match(html,/performSquadBattleItem\(itemId,squadId/);
});

test('actual battlefield pickup increments friendly shared stock and spending decrements it',()=>{
 const reg=new RoomItemRegistry();
 const loot=reg.registerBuilding('fort-A',[
  {id:'banner-A',roomId:'hall',floor:1,x:1,z:1,itemId:'war_banner',quantity:1},
  {id:'banner-B',roomId:'hall',floor:1,x:3,z:3,itemId:'war_banner',quantity:1}
 ]);
 assert.equal(reg.pickup(loot[0].id,'ally-1'),true);
 assert.equal(reg.pickup(loot[0].id,'ally-2'),false,'one chest cannot be collected twice');
 assert.equal(reg.pickup(loot[1].id,'ally-2'),true);
 const count=()=>reg.owned().filter(s=>['ally-1','ally-2'].includes(s.ownerId))
  .reduce((n,s)=>n+s.quantity,0);
 assert.equal(count(),2,'two different allied owners aggregate to army inventory');
 assert.equal(reg.consumeSquad('ally-1','war_banner').id,'war_banner');
 assert.equal(count(),1,'spending reduces shared stock without affecting other owner');
 assert.equal(reg.consumeSquad('ally-2','war_banner').id,'war_banner');
 assert.equal(count(),0,'once depleted the inventory cannot be reused');
});
test('no standalone move or rally popup; tactics, buffs and inventory all need Confirm',()=>{
 const command=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 assert.doesNotMatch(command,/id="realtimeMove"/);
 for(const id of ['realtimeStrategyTargets','realtimeTargetKind','realtimeTargetChoice',
  'realtimeInlineTargetMap','realtimeConfirmStrategy','realtimeRallyInline',
  'realtimeConfirmRally','realtimeItemInline','realtimeConfirmItem'])
  assert.match(command,new RegExp('id="'+id+'"'));
 assert.match(command,/function confirmDockStrategy\(\)/);
 assert.match(command,/function confirmInlineRally\(\)/);
 assert.match(command,/function confirmInlineItem\(\)/);
 assert.match(command,/getMoveTargets\(kind,String\(selectedId\)\)/);
 assert.match(command,/onSharedItem\(itemId,squadId\)/);
 assert.match(css,/No rally\/item child windows/);
 assert.match(game,/getMoveTargets:\(kind,id\)=>realtimeMoveTargets\(kind,id\)/);
 assert.match(game,/getSharedItems:\(\)=>realtimeSharedItems\(\)/);
 assert.match(game,/onSharedItem:\(itemId,id\)=>useSquadBattleItem\(itemId,id\)/);
 assert.match(game,/battleTreasureAcquiredLedger\.set\(id/);
 assert.match(game,/window\.getBattleSharedItemQA/);
});
