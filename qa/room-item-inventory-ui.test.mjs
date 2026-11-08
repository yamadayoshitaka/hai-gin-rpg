import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomItemRegistry,createRoomItemPlan} from '../src/room-item-registry.js';


const structure={
 id:'castle_001',
 floors:[
  {index:1,baseY:0,footprint:{width:18,depth:18}},
  {index:2,baseY:7,footprint:{width:18,depth:18}}
 ],
 stair:{stair:{outerRadius:2}}
};
const rooms=[
 {floor:1,rooms:[
  {id:'hall',label:'大広間',bounds:{minX:-7,maxX:-1,minZ:-7,maxZ:-1}},
  {id:'kitchen',label:'調理室',bounds:{minX:1,maxX:7,minZ:1,maxZ:7}}
 ]},
 {floor:2,rooms:[{id:'bed',label:'寝室',bounds:{minX:-3,maxX:3,minZ:-3,maxZ:3}}]}
];
const plan=createRoomItemPlan(structure,rooms);
assert.equal(plan.length,3,'Every authored room has a recovery potion, including ground floor');
assert.ok(plan.every(x=>x.itemId==='healing_potion'&&x.quantity===1));
const catalogue=new RoomItemRegistry();
const inHouse=catalogue.registerBuilding('building-1',plan);
const anotherHouse=catalogue.registerBuilding('building-2',plan);
assert.equal(catalogue.list().length,6,'Duplicated catalogue templates get independent room items');
const first=inHouse[0],unitA={hp:60,maxHp:100,alive:true},unitB={hp:15,maxHp:130,alive:true};
assert.ok(catalogue.pickup(first.id,'100'));
assert.equal(catalogue.pickup(first.id,'100'),false,'No duplicate pickup');
assert.equal(catalogue.owned('100')[0].quantity,1);
assert.equal(catalogue.transfer('100','101','healing_potion'),true);
assert.equal(catalogue.owned('100').length,0);
assert.equal(catalogue.owned('101')[0].quantity,1);
assert.equal(catalogue.consume('101','healing_potion',unitA),40,'Potion heals up to 50 without overflowing');
assert.equal(unitA.hp,100);
assert.equal(catalogue.consume('101','healing_potion',unitB),0,'Already consumed potions are unavailable');
assert.ok(catalogue.pickup(anotherHouse[0].id,'101'),'Another house still has its own potion');
assert.equal(catalogue.consume('101','healing_potion',unitB),50);
assert.equal(unitB.hp,65);
assert.ok(catalogue.setPlacement(inHouse[1].id,{quantity:3}),'Placement quantities can be managed');
assert.equal(catalogue.get(inHouse[1].id).quantity,3);
assert.equal(catalogue.setPlacement(first.id,{quantity:4}),false,'Collected placement is locked');
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/battleItemsPanel/);
assert.match(html,/回復薬を使う/);
assert.match(html,/回復薬を渡す/);
assert.match(html,/roomItemRegistry\.registerBuilding/);
assert.match(html,/massWorker\.healItem\(target\.id,healed\)/);
assert.doesNotMatch(html,/environment_destroy:'🔥 環境破壊'/,'Opening screen must contain exactly three approved strategies');
console.log('PASS room item placement, no duplicate pickup, inventory transfer, potion usage, UI and three strategies');
