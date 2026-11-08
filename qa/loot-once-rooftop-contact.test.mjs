import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomItemRegistry} from '../src/room-item-registry.js';
import {canDetectSkirmishEnemy,nearestSkirmishEnemy,sameElevatedBattleSurface}
 from '../src/skirmish-elevation-targeting.js';

// Every visible treasure site gives one reward, even when two overlapping
// room definitions create two different IDs at the same world position.
const reg=new RoomItemRegistry();
const place=(building,id,floor,x,z)=>reg.place(building,{
 id,roomId:id,roomName:id,floor,x,z,
 itemId:'healing_potion',item:'回復薬',quantity:1
});
const one=place('castle-1','hall-chest',2,3,4);
const overlapping=place('castle-1','wall-overlap-chest',2,3.25,4.1);
const anotherRoom=place('castle-1','other-room-chest',2,8,4);
const anotherLevel=place('castle-1','ground-chest',1,3,4);
const anotherBuilding=place('castle-2','hall-chest',2,3,4);
assert.equal(reg.pickup(one.id,100),true);
assert.equal(reg.get(overlapping.id).state,'empty');
assert.equal(reg.pickup(overlapping.id,101),false,'a second occupant cannot loot the same chest twice');
assert.equal(reg.pickup(one.id,101),false,'the same ID cannot be picked up repeatedly');
assert.equal(reg.owned(100)[0].quantity,1,'duplicate loot never mints inventory');
for(const loot of [anotherRoom,anotherLevel,anotherBuilding]){
 assert.equal(reg.pickup(loot.id,102),true,'separate rooms/floors/buildings remain independently lootable');
}
assert.equal(reg.owned(102)[0].quantity,3);

const roofBuilding={model:{uuid:'castle-1'}};
const roof=(id,team,x,z,b=roofBuilding)=>({
 id,team,hp:100,alive:true,indoorFloor:4,
 floorTravel:{phase:'roof',building:b},root:{position:{x,y:24,z}}
});
const ally=roof(1,0,0,0);
const nearbyFoe=roof(2,1,1,0);
const distantFoe=roof(3,1,100,0);
const friendly=roof(4,0,.2,.1);
const otherBuilding=roof(5,1,.5,0,{model:{uuid:'other-castle'}});
const ground=(id,team,x,z)=>({
 id,team,hp:100,alive:true,indoorFloor:1,root:{position:{x,y:0,z}}
});
const groundEnemy=ground(6,1,.1,.1);
assert.ok(sameElevatedBattleSurface(ally,nearbyFoe));
assert.equal(canDetectSkirmishEnemy(ally,nearbyFoe),true);
assert.equal(canDetectSkirmishEnemy(ally,groundEnemy),false,'ground and roof are different melee surfaces');
assert.equal(canDetectSkirmishEnemy(groundEnemy,ally),false,'ground melee must not hit through ceiling');
assert.equal(canDetectSkirmishEnemy(groundEnemy,ally,{allowGroundRoof:true}),true,
 'ranged ground units may recognize exposed roof occupants');
assert.equal(canDetectSkirmishEnemy(ally,otherBuilding),false,'adjacent roofs with separate structure are not melee neighbors');
assert.equal(nearestSkirmishEnemy(ally,[friendly,groundEnemy,distantFoe,nearbyFoe,otherBuilding],{maxDistance:2}),nearbyFoe,
 'nearby hostile on same roof is recognized even if ground enemies are closer');
const upstairs={...nearbyFoe,id:8,indoorFloor:2,floorTravel:{phase:'upstairs',building:roofBuilding}};
assert.equal(canDetectSkirmishEnemy(ally,upstairs),false,'separate floors never share melee targets');
assert.equal(canDetectSkirmishEnemy(ally,{...nearbyFoe,hp:0}),false);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const local=game.indexOf('const localEnemy=healing?null:nearestSkirmishEnemy(a,actors');
const waiting=game.indexOf("if(travel.phase==='upstairs'&&!travel.windowReady&&!localEnemy)");
assert.ok(local>0&&waiting>local,'same-roof detection must precede wait-for-window guard');
assert.match(game,/const actualDamage=localEnemy===target\?a\.job\.damage:stats\.damage/,
 'same-level combat uses ordinary attack strength, not an elevated shooting bonus');
assert.match(game,/function hideCollectedRoomLootMarkers\(/,
 'all exhausted overlapping treasure objects must disappear');
assert.match(game,/if\(a\.floorTravel&&\['approach','toStair'\]\.includes\(a\.floorTravel\.phase\)\)/,
 'a soldier walking toward stairs must monitor nearby hostile troops');
assert.match(game,/a\._highGroundRetryUntil=elapsed\+7;\s*a\.floorTravel=null;a\.thinkTimer=0/,
 'a nearby hostile cancels stair scouting and returns the soldier to normal combat AI');
console.log('PASS: one-time physical treasure pickup, same-roof enemy recognition, no through-floor melee');
