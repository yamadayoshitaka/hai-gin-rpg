import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createNewGame,leaveTown} from '../src/game-core-flow.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {armyGroups,armyGroupFor,setArmyGroup,captainCandidates,armyCaptain,setArmyCaptain,captainBonus,battleGroupMembers} from '../src/army-groups.js';
const game=createNewGame('班試験',{gender:'female',faceId:0}),state=game.campaign;
state.commanders.push({id:1,name:'副軍師',level:1,active:true});
state.squads.push({id:3,count:10,commanderId:'1',job:'騎士',rarity:'UR'});
assert.equal(armyGroupFor(state,'player'),1,'old saves default to first group');
assert.equal(armyGroups(state).length,10);
setArmyGroup(state,'1',3);
assert.equal(armyGroupFor(state,'1'),3);
assert.throws(()=>setArmyGroup(state,'1',4));
assert.throws(()=>setArmyCaptain(state,'player',3),'cannot appoint someone outside the squad');
setArmyCaptain(state,'player',1);
assert.equal(captainCandidates(state,'player').length,2);
assert.equal(armyCaptain(state,'player').id,1);
assert.deepEqual(captainBonus(armyCaptain(state,'player')),{attack:.05,defense:0});
setArmyCaptain(state,'player',2);
assert.equal(armyCaptain(state,'player').id,2,'one captain replaces the previous appointment');
setArmyCaptain(state,'1',3);
assert.ok(captainBonus(armyCaptain(state,'1')).attack>.15);
assert.equal(armyCaptain(JSON.parse(JSON.stringify(state)),'1').id,3,'save data retains appointments');
game.armyGroupOrders={1:'defend',3:'charge'};
game.tacticalTemplate={strategy:'recovery'};
leaveTown(game);
const request=makeCoreBattleRequest(game,'c01-s02','groups');
assert.equal(request.tacticalTemplate,null,'retired strategies cannot return from old saves');
for(const u of request.units){
 const expected=u.commanderId==='1'?3:1;
 assert.equal(u.armyGroupId,expected);
 assert.equal(request.armyGroupBySquad[u.squadId],expected);
 assert.equal(request.initialSquadOrders[u.squadId],expected===3?'charge':'defend');
 if(u.commanderId==='1')assert.ok(u.equipmentBuff.attack>=.2);
}
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const wrapper=html.slice(html.indexOf('function issueSquadOrder('),html.indexOf('function issueIndividualSquadOrder('));
const calls=[],groups={'1':1,'2':1,'3':3};
const context={selectedSquadId:'1',orderedSquad:()=>context.selectedSquadId,
 squadCommanderUnavailableReason:()=>'',individualCommanderUnavailableReason:()=>'',canChangeSquadOrder:()=>true,
 commandGroupIds:id=>battleGroupMembers(id,['1','2','3'],groups),
 issueIndividualSquadOrder:(mode,point)=>{calls.push([context.selectedSquadId,mode,point]);return true;},refreshSquadOrderLabel:()=>{},log:()=>{}};
vm.createContext(context);vm.runInContext(wrapper,context);
for(const mode of ['charge','defend','hold','retreat']){
 calls.length=0;assert.equal(context.issueSquadOrder(mode),true);
 assert.deepEqual(calls.map(c=>c[0]),['1','2']);
 assert.equal(context.selectedSquadId,'1');
}
calls.length=0;context.canChangeSquadOrder=()=>false;
assert.equal(context.issueSquadOrder('charge'),false);assert.equal(calls.length,0,'cooldown rejects entire group');
context.canChangeSquadOrder=()=>true;context.squadCommanderUnavailableReason=()=> '軍師不在';
assert.equal(context.issueSquadOrder('charge'),false);assert.equal(calls.length,0,'no surviving group commander means no issue');
state.squads.find(s=>s.id===3).count=0;
assert.equal(armyCaptain(state,'1'),null,'removed character cannot continue supplying buffs');
console.log('Army groups: migration, max ten groups, captain ownership/replacement, passive buffs, sortie, four whole-group orders and atomic cooldown passed');
