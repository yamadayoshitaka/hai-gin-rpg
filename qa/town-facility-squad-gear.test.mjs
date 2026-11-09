import assert from 'node:assert/strict';
import {
 createNewGame,buyTownItem,equipSquadItem,squadEquipmentBonus,
 acceptTownEvent,claimTownEvent,leaveTown
} from '../src/game-core-flow.js';
import {autoFormArmy} from '../src/story-campaign.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';

const game=createNewGame('QA軍師',{gender:'male',faceId:0});
assert.equal(game.campaign.squads[0].equipment.weapon,'iron_sword');
assert.equal(squadEquipmentBonus(game.campaign.squads[0]).attack,.14);
assert.equal(squadEquipmentBonus(game.campaign.squads[0]).defense,.10);
assert.throws(()=>equipSquadItem(game,game.campaign.squads[1].id,'iron_sword','武器'),/装備できません/);
const first=game.campaign.squads[0];
game.campaign.squads.push({id:999,job:'騎士',count:1,rarity:'N',purpose:'前線',commanderId:'reserve'});
assert.throws(()=>equipSquadItem(game,999,'iron_sword','武器'),/使用中/);
buyTownItem(game,'iron_sword');
equipSquadItem(game,999,'iron_sword','武器');
assert.equal(squadEquipmentBonus(game.campaign.squads.at(-1)).attack,.14);
assert.equal(game.inventory.iron_sword,2);

acceptTownEvent(game,'revna-patrol');
assert.throws(()=>acceptTownEvent(game,'revna-patrol'),/受注済み/);
assert.throws(()=>claimTownEvent(game,'revna-patrol'),/未達成/);
game.completedStages.push('c01-s02');
const wallet=game.wallet;
claimTownEvent(game,'revna-patrol');
assert.equal(game.wallet,wallet+110);
assert.throws(()=>claimTownEvent(game,'revna-patrol'),/受取済み/);

const fresh=createNewGame('編成QA',{gender:'female',faceId:0});
autoFormArmy(fresh.campaign,'player','均衡');
assert.equal(fresh.campaign.squads.filter(s=>s.equipment?.weapon==='iron_sword').length,1,
 'auto-formation must not duplicate purchased squad gear');
assert.equal(fresh.campaign.squads.filter(s=>s.equipment?.armor==='leather_armor').length,1,
 'armor must survive auto-formation exactly once');
leaveTown(fresh);
const battle=makeCoreBattleRequest(fresh,'c01-s02','qa-passive-gear');
const equipped=battle.units.filter(u=>u.equipmentBuff?.attack===.14);
assert.ok(equipped.length>0,'active squad equipment must reach the actual battle units');
assert.ok(equipped.every(u=>u.equipmentBuff.defense===.10));
console.log('town facility contracts, squad equipment inventory and battle passives: PASS');
