import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomItemRegistry,createRoomItemPlan} from '../src/room-item-registry.js';
import {createCatalogBuildingStructure,createUpperFloorLootPlan} from '../src/building-structure.js';
import {createCastleUpperRoomPlan} from '../src/castle-upper-rooms.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

// Every authored castle chamber, including those on the ground floor,
// gets an independently tracked healing potion, not one chest per storey.
const castle=createCatalogBuildingStructure({id:'castle_001',widthCells:95,depthCells:95});
const castleRooms=createCastleUpperRoomPlan(castle).flatMap(p=>p.rooms);
const castleLoot=createUpperFloorLootPlan(castle);
assert.equal(castleLoot.length,castleRooms.length);
assert.ok(castleLoot.length>20,'Castle has many individually provisioned rooms');
assert.ok(castleLoot.some(x=>x.floor===1),'Ground floor rooms also have potions');
assert.ok(castleLoot.every(x=>x.itemId==='healing_potion'&&x.quantity===1));
assert.equal(new Set(castleLoot.map(x=>x.id)).size,castleLoot.length,'No room item ID collisions');
const home=createCatalogBuildingStructure({id:'town_house_001',kind:'house',widthCells:10,depthCells:10});
assert.equal(createRoomItemPlan(home).length,home.floors.length);

// Reusing one catalog template for many houses MUST NOT share collected state.
const reg=new RoomItemRegistry();
const [plan]=createRoomItemPlan(home);
const [a]=reg.registerBuilding('house-a',[plan]),[b]=reg.registerBuilding('house-b',[plan]);
assert.notEqual(a.id,b.id);
assert.equal(reg.setPlacement(a.id,{quantity:2}),true);
assert.equal(reg.setPlacement(a.id,{quantity:0}),false);
assert.equal(reg.pickup(a.id,'soldier-1'),true);
assert.equal(reg.pickup(a.id,'soldier-2'),false,'Cannot duplicate a collected item');
assert.equal(reg.get(b.id).state,'placed','Other house stays stocked');
assert.equal(reg.owned('soldier-1')[0].quantity,2);
const wounded={hp:30,maxHp:100};
assert.equal(reg.consume('soldier-1','healing_potion',wounded),50);
assert.equal(wounded.hp,80);
assert.equal(reg.owned('soldier-1')[0].quantity,1);
assert.equal(reg.consume('soldier-1','healing_potion',{hp:100,maxHp:100}),0,'No potion wasted on full HP');

// Lock upgrades are friendly-side only. Thieves open enemy locks at ground
// level, while ninjas require the SAME building's rooftop route.
const combat=new CombatActionRuntime({width:32,height:32,walkable:new Uint8Array(32*32).fill(1)});
const friendly=combat.registerStructure({id:'friendly-entrance',type:'door',x:7,z:8,
 team:0,lockLevel:1,locked:true,blocking:false});
const enemy=combat.registerStructure({id:'enemy-entrance',type:'door',x:11,z:8,
 team:1,buildingId:'enemy-building',roofLevel:3,lockLevel:2,locked:true,blocking:false});
const thief={id:1,team:0,jobId:'thief',rarity:'R',x:7,z:8,alive:true,hp:80};
assert.equal(combat.reinforceFriendlyDoor(friendly.id,thief),true);
assert.equal(friendly.lockLevel,2);
assert.equal(combat.reinforceFriendlyDoor(enemy.id,thief),false);
thief.x=11;
assert.equal(combat.unlockEnemyDoor(enemy.id,{...thief,rarity:'N'}),false,'N thief lacks level');
assert.equal(combat.unlockEnemyDoor(enemy.id,thief),true);
assert.equal(enemy.locked,false);
assert.equal(combat.unlockEnemyDoor(friendly.id,thief),false);

const roofDoor=combat.registerStructure({id:'roof-door',type:'door',x:13,z:7,
 team:1,buildingId:'keep-uuid',roofLevel:4,lockLevel:3,locked:true,blocking:false});
const ninja={id:2,team:0,jobId:'ninja',rarity:'R',alive:true,hp:80,x:10,z:5,
 indoorFloor:4,floorTravel:{phase:'roof',building:{model:{uuid:'other-building'}}}};
assert.equal(combat.unlockEnemyDoor(roofDoor.id,ninja,{viaRoof:true}),false);
ninja.floorTravel.building.model.uuid='keep-uuid';
assert.equal(combat.unlockEnemyDoor(roofDoor.id,ninja),false,'Must specify the rooftop route');
assert.equal(combat.unlockEnemyDoor(roofDoor.id,ninja,{viaRoof:true}),true);
assert.equal(roofDoor.locked,false);

// The active menu shows exactly three strategies and preserves four orders.
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/id='battleItemManagement'/);
assert.match(html,/roomItemRegistry\.registerBuilding\(g\.uuid/);
assert.match(html,/roof_unlock:'屋上からの解錠'/);
assert.match(html,/STRATEGY_LABELS=\{eliminate:[^}]*environment_prepare:[^}]*recovery:/);
assert.doesNotMatch(html,/environment_destroy/);
assert.match(html,/instant\('⚔ 突撃','charge'\)/);
assert.match(html,/instant\('🛡 守備','defend'\)/);
assert.match(html,/instant\('⏸ 待機','hold'\)/);
assert.match(html,/instant\('↘ 退却','retreat'\)/);
const mass=new MassBattleGridSimulation(50,20261108,{
 width:64,height:64,walkable:new Uint8Array(64*64).fill(1),bridges:[],
});
for(const strategy of ['eliminate','environment_prepare','recovery'])
 assert.equal(mass.setSquadStrategy('0',strategy),true);
assert.equal(mass.setSquadStrategy('0','environment_destroy'),false);
console.log('PASS: all-room healing pickups, per-instance inventory, potion use, thief locks, roof ninja locks, three strategies');
