import assert from 'node:assert/strict';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

const size=232,walkable=new Uint8Array(size*size).fill(1);
const bridges=[{x:116,z:55,type:'stone'},{x:116,z:116,type:'stone'},{x:116,z:177,type:'timber'}];
const setup=()=>new MassBattleGridSimulation(100,20261106,{width:size,height:size,
  walkable:walkable.slice(),bridges,riverXAt:()=>116});

const siege=setup();
const mage=siege.units.find(u=>u.team===0&&u.jobId==='mage'&&u.formationType==='ranged');
assert.ok(mage,'遠距離固定編成に魔法使いがいる');
const target={x:mage.x+3,z:mage.z};
siege.actions.registerStructure({id:'mission-house',type:'building',...target,hp:80,
  bounds:{minX:target.x,maxX:target.x,minZ:target.z,maxZ:target.z}});
assert.ok(siege.setSquadMission(mage.squadId,'burn_building',{targetId:'mission-house',...target}));
assert.equal(siege.squadCommands.get(String(mage.squadId)),'mission');
const building=siege.objects.find(o=>o.id==='mission-house');
for(let i=0;i<140&&building.hp===building.maxHp;i++)siege.step(.1);
assert.ok(building.hp<building.maxHp,'放火命令で魔法使いが実際に建物のHPを減らす');
assert.ok(siege.attacks>=0);
assert.ok(siege.units.filter(u=>u.team===0&&u.squadId===mage.squadId).every(u=>u.formationType==='ranged'),
  '放火後も遠距離編成のまま');

const demolish=setup();
const attacker=demolish.units.find(u=>u.team===0&&u.jobId==='sword'&&u.formationType==='attack');
assert.ok(attacker);
const bridgeTarget={x:attacker.x+2,z:attacker.z};
demolish.actions.registerStructure({id:'mission-bridge',type:'bridge',...bridgeTarget,hp:70,
  bounds:{minX:bridgeTarget.x,maxX:bridgeTarget.x,minZ:bridgeTarget.z,maxZ:bridgeTarget.z},
  blocking:false,walkableWhenOpened:false});
assert.ok(demolish.setSquadMission(attacker.squadId,'destroy_bridge',{targetId:'mission-bridge',...bridgeTarget}));
const bridgeObject=demolish.objects.find(o=>o.id==='mission-bridge');
for(let i=0;i<130&&bridgeObject.hp===bridgeObject.maxHp;i++)demolish.step(.1);
assert.ok(bridgeObject.hp<bridgeObject.maxHp,'橋破壊命令で兵士が橋の耐久を削る');
assert.ok(demolish.setSquadMission(attacker.squadId,'eliminate_squad',{targetSquadId:0,
  x:demolish.units.find(u=>u.team===1).x,z:demolish.units.find(u=>u.team===1).z}),
  '指定した敵部隊の殲滅を目標登録できる');
assert.equal(demolish.squadMissions.get(String(attacker.squadId)).targetSquadId,'0');

const rescue=setup();
const priest=rescue.units.find(u=>u.team===0&&u.jobId==='priest'&&u.formationType==='support');
const patient=rescue.units.find(u=>u.team===0&&u.squadId===0);
assert.ok(priest&&patient);
const occupied=new Set(rescue.units.map(u=>u.x+':'+u.z));
const nearby=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]]
  .map(([dx,dz])=>({x:priest.x+dx,z:priest.z+dz}))
  .find(p=>p.x>0&&p.z>0&&!occupied.has(p.x+':'+p.z));
assert.ok(nearby,'負傷兵を隣の空きマスに移せる');
patient.x=patient.fromX=nearby.x;patient.z=patient.fromZ=nearby.z;
patient.moveElapsed=patient.moveDuration=0;patient.hp=Math.floor(patient.maxHp*.4);
const before=patient.hp;
const call=rescue.requestSquadHealing(patient.squadId,String(priest.squadId));
assert.ok(call&&call.supportId===String(priest.squadId));
assert.equal(patient.hp,before,'UIから回復ボタンを押すだけでHPを増やさない');
for(let i=0;i<170&&patient.hp===before;i++)rescue.step(.1);
assert.ok(patient.hp>before,'僧侶が実際に回復魔法を使い負傷部隊のHPを回復する');
assert.ok(patient.hp<=patient.maxHp);
console.log('部隊別: 建物放火 / 橋破壊 / 敵部隊指定 / 編成固定 / 僧侶の回復支援 PASS');
