import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomItemRegistry} from '../src/room-item-registry.js';

// Exercise the exact battle HTML implementation. Static syntax tests could not
// catch a missing global function that was only called during a live AI tick.
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const start=html.indexOf('let lastNearbyRoomItemScanAt=-Infinity;');
const end=html.indexOf('function tickAI(dt){',start);
assert.ok(start>0&&end>start,'Room pickup function must be defined before the AI tick');
const section=html.slice(start,end);
assert.match(section,/function collectNearbyRoomItems\s*\(/);
assert.match(html.slice(end,end+400),/collectNearbyRoomItems\(\)/);
const reg=new RoomItemRegistry();
const marker={visible:true};
const building={
 data:{kind:'house'},
 model:{uuid:'house-1',position:{x:100,z:100},userData:{
  groundFloorRooms:[{id:'room-a',bounds:{minX:1,maxX:3,minZ:1,maxZ:3}}],
  upperFloorRooms:[{floor:2,rooms:[{id:'room-b',bounds:{minX:1,maxX:3,minZ:1,maxZ:3}}]}]
 },getObjectByName(){return marker}}
};
const floor1=reg.place('house-1',{
 id:'room-a-potion',floor:1,roomId:'room-a',roomName:'居間',
 itemId:'healing_potion',item:'回復薬',quantity:1,x:2,z:2
});
const floor2=reg.place('house-1',{
 id:'room-b-potion',floor:2,roomId:'room-b',roomName:'寝室',
 itemId:'healing_potion',item:'回復薬',quantity:1,x:2,z:2
});
const actor={
 id:22,team:0,job:{name:'剣士'},hp:80,maxHp:100,indoorFloor:1,
 root:{position:{x:125,z:125}},inventory:[]
};
const gate={locked:true,team:1};
const gateRegistry=new Map([['house-gate',{building,object:gate}]]);
let itemUiUpdates=0,gameUiUpdates=0;
const makeRunner=new Function('townInstances','roomItemRegistry','actors',
 'massSim','destroyedTownBuildings','battleDoorDefinitions','CELL','itemPanel',
 'renderBattleItemManagement','updateUI','log','openTreasureChestModel',`
 let elapsed=0;
 ${section}
 return {collectNearbyRoomItems,advance:seconds=>elapsed+=seconds};
`);
const runner=makeRunner([building],reg,[actor],null,new Set(),gateRegistry,2.2,
 {hidden:false},()=>{itemUiUpdates++;},()=>{gameUiUpdates++;},()=>{},chest=>{chest.userData={opened:true};chest.visible=true;});
runner.advance(.4);
runner.collectNearbyRoomItems();
assert.equal(reg.get(floor1.id).state,'placed','Cannot collect from far outside a house');
actor.root.position={x:102,z:102};
runner.advance(.4);runner.collectNearbyRoomItems();
assert.equal(reg.get(floor1.id).state,'placed','An enemy locked gate prevents stealing through walls');
gate.locked=false;
runner.advance(.4);runner.collectNearbyRoomItems();
assert.equal(reg.get(floor1.id).state,'collected','Ground-floor potion is collected at the room position');
assert.equal(reg.owned(actor.id)[0].quantity,1);
assert.equal(marker.visible,true,'Opened treasure chest remains in the room');
assert.equal(marker.userData.opened,true,'Collected treasure chest lid stays open');
assert.ok(itemUiUpdates>=1&&gameUiUpdates>=1,'Inventory changes refresh the HUD');
runner.advance(.4);runner.collectNearbyRoomItems();
assert.equal(reg.owned(actor.id)[0].quantity,1,'Cannot collect the same potion twice');
actor.indoorFloor=2;
runner.advance(.4);runner.collectNearbyRoomItems();
assert.equal(reg.get(floor2.id).state,'placed','Cannot collect upstairs loot without walking upstairs');
actor.floorTravel={phase:'upstairs',building};
runner.advance(.4);runner.collectNearbyRoomItems();
assert.equal(reg.get(floor2.id).state,'collected');
assert.equal(reg.owned(actor.id)[0].quantity,2);
console.log('PASS: callable AI room-loot handler, walls, locked door, floor access, single pickup and UI refresh');
