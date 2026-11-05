import assert from 'node:assert/strict';
import {BUILDING_ENTRY_GRADES,CATALOG_ENTRY_GRADES,resolveBuildingEntryDoor,evaluateBuildingEntry} from '../src/building-entry-locks.js';
import {STARTER_TOWN} from '../src/starter-town.js';

assert.deepEqual(Object.values(BUILDING_ENTRY_GRADES).every(value=>value>=1&&value<=5),true);
const buildings=STARTER_TOWN.buildings;
const byId=id=>buildings.find(building=>building.id===id);

// Every world building has one independent external entry lock definition.
for(const building of buildings){
 const door=resolveBuildingEntryDoor(building);
 assert.equal(door.id,building.id+':entrance');
 assert.equal(door.type,'door');
 assert.equal(door.entranceOnly,true);
 assert.ok(door.lockLevel>=1&&door.lockLevel<=5);
 assert.ok(door.grade>=1&&door.grade<=5);
}

assert.equal(resolveBuildingEntryDoor(byId('home-hero')).locked,false);
assert.equal(evaluateBuildingEntry(byId('weapon-shop')).allowed,true);
assert.equal(evaluateBuildingEntry(byId('item-shop')).allowed,true);
assert.equal(evaluateBuildingEntry(byId('tavern')).allowed,true);

const residence=byId('home-east');
assert.equal(resolveBuildingEntryDoor(residence).lockLevel,1);
assert.equal(evaluateBuildingEntry(residence).allowed,false);
assert.equal(evaluateBuildingEntry(residence,{keyLevel:1}).reason,'key');

const castle=byId('castle');
assert.equal(resolveBuildingEntryDoor(castle).grade,5);
assert.equal(resolveBuildingEntryDoor(castle).lockLevel,5);
assert.equal(evaluateBuildingEntry(castle).allowed,false);
assert.equal(evaluateBuildingEntry(castle,{permissions:['royal-visitor']}).reason,'permission');
assert.equal(evaluateBuildingEntry(castle,{keyLevel:4}).allowed,false);
assert.equal(evaluateBuildingEntry(castle,{keyLevels:[2,5]}).reason,'key');

// The tactical battle map uses object-catalog IDs rather than house kinds.
for(const [id,grade] of Object.entries(CATALOG_ENTRY_GRADES)){
 const entry=resolveBuildingEntryDoor({id,kind:'town_building'});
 assert.equal(entry.grade,grade,id);
 assert.equal(entry.lockLevel,grade,id);
}
assert.equal(evaluateBuildingEntry({id:'castle_001',kind:'town_building'}).allowed,false);
assert.equal(evaluateBuildingEntry({id:'castle_001',kind:'town_building'},{permissions:['royal-visitor']}).allowed,true);
assert.equal(evaluateBuildingEntry({id:'weapon_shop_001',kind:'town_building'}).allowed,true);
assert.equal(evaluateBuildingEntry({id:'town_house_001',kind:'town_building'},{keyLevel:1}).allowed,true);

// An unlocked entrance still reports its grade; interior rooms are untouched.
const guardAccessOff={id:'fort',kind:'manor',entryDoor:{locked:true,permission:'guards-only'}};
assert.equal(evaluateBuildingEntry(guardAccessOff,{permissions:['royal-visitor']}).allowed,false);
assert.equal(evaluateBuildingEntry(guardAccessOff,{permissions:['guards-only']}).allowed,true);
assert.equal(evaluateBuildingEntry({...guardAccessOff,entryDoor:{lockLevel:3,locked:false}}).reason,'open');
assert.throws(()=>resolveBuildingEntryDoor({id:'bad',grade:6}),/Invalid building grade/);
assert.throws(()=>resolveBuildingEntryDoor({id:'bad',entryDoor:{lockLevel:-1}}),/Invalid entrance lock level/);

console.log('Building-grade entrance locks validated');
