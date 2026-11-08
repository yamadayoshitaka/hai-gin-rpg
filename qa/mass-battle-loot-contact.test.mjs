import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomItemRegistry} from '../src/room-item-registry.js';
import {MassBattleRoomLootCollector} from '../src/mass-battle-room-loot.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {JOBS} from '../src/mass-battle-sim.js';

const types=new RoomItemRegistry();
const lootA=types.place('house-1',{
 id:'room-a',floor:1,roomId:'a',roomName:'居間',x:0,z:0,
 itemId:'healing_potion',quantity:1
});
const overlapping=types.place('house-1',{
 id:'room-b-overlap',floor:1,roomId:'b',roomName:'居間',x:.2,z:.1,
 itemId:'healing_potion',quantity:1
});
const lootB=types.place('house-2',{
 id:'other-house',floor:1,roomId:'a',roomName:'居間',x:0,z:0,
 itemId:'healing_potion',quantity:1
});
const house=(uuid,x,z)=>({data:{kind:'house'},model:{
 uuid,position:{x,z},userData:{groundFloorRooms:[
  {id:'a',bounds:{minX:-1,maxX:1,minZ:-1,maxZ:1}},
  {id:'b',bounds:{minX:-1,maxX:1,minZ:-1,maxZ:1}}
 ]}}});
const buildingA=house('house-1',22,22),buildingB=house('house-2',44,22);
const door={building:buildingA,object:{locked:true,team:1}};
const collector=new MassBattleRoomLootCollector({
 registry:types,buildings:[buildingA,buildingB],
 doors:new Map([['gate',door]]),cellSize:2.2
});
const unit=(id,x,z,extra={})=>({id,team:0,alive:true,hp:100,isStrategist:false,
 x,z,moveElapsed:0,moveDuration:0,...extra});
// +6 world-to-grid offset: world (22,22) => (16,16)
const near=unit(42,16,16);
const candidates=[near,...Array.from({length:999},(_,i)=>
 unit(i+100,80+i%30,80+Math.floor(i/30)))];
assert.equal(collector.collect(candidates).length,0,'enemy-locked room is not lootable');
door.object.locked=false;
near.moveDuration=1;near.moveElapsed=.5;
assert.equal(collector.collect(candidates).length,0,'no loot before physical arrival');
near.moveElapsed=1;
const first=collector.collect(candidates);
assert.equal(first.length,1,'a single arrival picks up only one chest');
assert.equal(first[0].unit.id,42);
assert.equal(types.get(lootA.id).state,'collected');
assert.equal(types.get(overlapping.id).state,'empty','overlapping loot is not minted twice');
assert.equal(types.owned(42)[0].quantity,1);
assert.equal(collector.collect(candidates).length,0,'stationary troop cannot loot again');
near.x=26; // world 44 -> other building
const other=collector.collect(candidates);
assert.equal(other.length,1,'a different building remains independently lootable');
assert.equal(types.get(lootB.id).state,'collected');
assert.equal(types.owned(42)[0].quantity,2);
const foreign=unit(9,16,16,{team:1});
const dead=unit(10,16,16,{alive:false});
assert.equal(collector.collect([foreign,dead]).length,0,'hostiles and dead do not receive allied loot');

// Exercise the authoritative 100- and 1000-per-side simulator rather than
// accepting a static string assertion that the render layer was changed.
for(const count of [100,1000]){
 const width=232,height=232;
 const walkable=new Uint8Array(width*height).fill(1);
 const opaque=new Uint8Array(width*height);
 const location=(x,z)=>z*width+x;
 const sim=new MassBattleGridSimulation(count,31337,{
  width,height,walkable,opaque,bridges:[],riverXAt:()=>116
 });
 const archerIndex=JOBS.findIndex(job=>job.id==='archer');
 assert.ok(archerIndex>=0);
 const shooter=sim.units.find(u=>u.team===0&&!u.isStrategist);
 const opponents=sim.units.filter(u=>u.team===1&&!u.isStrategist);
 const occluded=opponents[0],visible=opponents[1];
 assert.ok(shooter&&occluded&&visible);
 for(const u of sim.units)if(u!==shooter&&u!==occluded&&u!==visible)u.alive=false;
 shooter.x=shooter.fromX=100;shooter.z=shooter.fromZ=100;
 shooter.jobIndex=archerIndex;shooter.jobId='archer';shooter.cooldown=0;
 shooter.moveElapsed=shooter.moveDuration=0;
 occluded.x=occluded.fromX=102;occluded.z=occluded.fromZ=100;
 occluded.moveElapsed=occluded.moveDuration=0;
 visible.x=visible.fromX=100;visible.z=visible.fromZ=103;
 visible.moveElapsed=visible.moveDuration=0;
 opaque[location(101,100)]=1;
 assert.equal(sim._canSee(shooter,occluded),false);
 assert.equal(sim._canSee(shooter,visible),true);
 const before=visible.hp;
 for(let t=0;t<6;t++)sim.step(.1);
 assert.ok(visible.hp<before,
  count+'v'+count+': visible nearby enemy should be attacked despite a closer hidden target');
 assert.equal(occluded.hp,occluded.maxHp,
  count+'v'+count+': wall blocks attacking the hidden soldier');
}

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/collectMassRoomItems\(\);\s*emitCombatEvents\(massSim\.actionEvents\)/,
 'each authoritative worker snapshot is checked for one-time loot');
assert.match(html,/new MassBattleRoomLootCollector\(/);
assert.match(html,/massRoomLootCollector\.collect\(massSim\.units/);
assert.match(html,/const owner=\(massSim\?\.units\?\?actors\)/,
 'all 1000 soldier IDs are valid item owners, not just the 24 detailed models');
console.log('PASS: 100v100 and 1000v1000 visible-nearest targeting; mass loot one-time, locked and proximity rules');
