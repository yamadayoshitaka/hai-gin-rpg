import assert from 'node:assert/strict';
import {elevatedRangedStats} from '../src/elevation-combat.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {COMBAT_JOB_SPECS} from '../src/combat-action-spec.js';

for(const [floor,factor] of [[1,1],[2,2],[3,4]]){
 const attacker={indoorFloor:floor,floorTravel:{phase:'upstairs'}};
 assert.deepEqual(elevatedRangedStats(attacker,{range:10,damage:14,radius:3}),
  {floor,multiplier:factor,range:10*factor,damage:14*factor,radius:3*factor,eligible:true});
 assert.equal(elevatedRangedStats(attacker,{range:3,damage:20}).damage,20,'Melee never benefits');
 assert.equal(elevatedRangedStats(attacker,{range:8,damage:25,kind:'heal'}).damage,25,'Healing never benefits');
}
assert.equal(elevatedRangedStats({indoorFloor:3,floorTravel:{phase:'climb'}},{range:10,damage:20}).multiplier,1);

const simulate=(floor,kind='archer')=>{
 const combat=new CombatActionRuntime({width:80,height:80});
 const attacker={id:1,team:0,alive:true,hp:100,maxHp:100,mp:100,maxMp:100,
  jobId:kind,rarity:'N',indoorFloor:floor,floorTravel:{phase:'upstairs'},x:10,z:10};
 const target={id:2,team:1,alive:true,hp:400,maxHp:400,mp:100,x:24,z:10};
 const units=[attacker,target];
 combat.beginTick(.1,units,{sectors:new Map([['2:2',[attacker]],['4:2',[target]]])});
 const skill=COMBAT_JOB_SPECS[kind].skills.find(item=>item.kind==='damage');
 assert.equal(combat.fireSkill(attacker,skill,target,units),floor>1,'Second floor reaches fourteen tiles');
 return {target,combat};
};
assert.equal(simulate(1).target.hp,400);
assert.equal(simulate(2).target.hp,400-14*2);
assert.equal(simulate(3).target.hp,400-14*4);
const mage=simulate(2,'mage');
assert.ok(mage.target.hp<400,'Magic damage gains high-ground bonus');

const battle=(await import('node:fs')).readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/updateUpperFloorRangedCombat\(/,'Upstairs characters must actually attack');
assert.match(battle,/elevatedRangedStats\(/,'Normal ranged attacks must use height modifiers');
assert.match(battle,/buildFloorTravelRoute\(/,'Physical stair navigation stays intact');
console.log('Elevated ranged shots: 1F x1 / 2F x2 / 3F x4; skills and ordinary ranged attacks');
