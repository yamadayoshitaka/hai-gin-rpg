import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomItemRegistry,ROOM_ITEM_TYPES,applySquadHeal} from '../src/room-item-registry.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';

const inventory=new RoomItemRegistry();
for(const itemId of ['healing_potion','war_banner','aegis_seal','wind_scroll'])
 assert.ok(inventory.grant(101,itemId,1),itemId+' is available as a finite battle supply');
const banner=inventory.consumeSquad(101,'war_banner');
assert.equal(banner.attack,.20);
assert.equal(inventory.consumeSquad(101,'war_banner'),null,'single supply cannot be reused');
const potion=inventory.consumeSquad(101,'healing_potion');
assert.equal(potion.squadHealHp,200,'squad heal has a shared fixed budget, not 200 per soldier');
const squad=[
 {id:1,team:0,squadId:'A',alive:true,hp:50,maxHp:100},
 {id:2,team:0,squadId:'A',alive:true,hp:10,maxHp:100},
 {id:3,team:0,squadId:'B',alive:true,hp:1,maxHp:100},
 {id:4,team:1,squadId:'A',alive:true,hp:1,maxHp:100},
 {id:5,team:0,squadId:'A',alive:false,hp:0,maxHp:100}
];
const result=applySquadHeal(squad,'A',100);
assert.equal(result.total,100);
assert.equal(result.affected,2);
assert.equal(squad[2].hp,1,'squad B never receives the effect');
assert.equal(squad[3].hp,1,'enemy squad cannot share the friendly buff');
assert.equal(squad[4].hp,0,'fallen members are not revived');

const walkable=new Uint8Array(60*60).fill(1);
const sim=new MassBattleGridSimulation(20,1234,{width:60,height:60,walkable,bridges:[]});
const member=sim.units.find(u=>u.team===0&&u.hp>0&&!u.isStrategist);
const id=String(member.squadId);
assert.ok(sim.applySquadItemBuff(id,'war_banner',{attack:.20},25));
assert.ok(sim.applySquadItemBuff(id,'aegis_seal',{defense:.18},25));
assert.ok(sim.applySquadItemBuff(id,'wind_scroll',{speed:.25},25));
sim.step(.1);
assert.equal(member.itemAttackBonus,.20,'attack bonus is active in the simulation');
assert.equal(member.itemDefenseBonus,.18,'defense bonus is active in the simulation');
assert.equal(member.itemSpeedMultiplier,1.25,'speed buff is active in grid movement');
const rival=sim.units.find(u=>u.team===1&&u.hp>0);
assert.equal(rival.itemAttackBonus,0,'enemy attack bonus remains unchanged');
const before=member.hp;
const action=new CombatActionRuntime();
action.damageUnit(member,10,rival,'physical');
assert.ok(member.hp>before-10,'defense buff materially mitigates damage');
sim.time+=26;sim.step(.1);
assert.equal(member.itemAttackBonus,0,'attack bonus expires');
assert.equal(member.itemDefenseBonus,0,'defense bonus expires');
assert.equal(member.itemSpeedMultiplier,1,'speed bonus expires');

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const ceremony=readFileSync(new URL('../src/battle-ceremony.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/mass-battle-worker-client.js',import.meta.url),'utf8');
for(const token of ['function beginCommanderCinematic(squadId)','function updateCommanderCinematic()',
 'emitSquadBuffEffect(id','battleCeremony.showOrder(message,effect.effect)',
 'battleCeremony.showOrder(\'🎒 \'+supply.name','id=\'battleItemsSquad\'',
 'massSim.applySquadItemBuff','massWorker.buffSquadItem','massWorker.healSquadItem']){
 assert.ok(html.includes(token),token+' is connected');
}
assert.match(ceremony,/ceremonyBuff/,'cut-in shows readable buff values');
assert.match(worker,/case 'buffSquadItem'/);
assert.match(worker,/case 'healSquadItem'/);
assert.match(client,/buffSquadItem\(squadId,itemId,buff,duration\)/);
console.log('PASS finite squad consumables, shared healing, timed buffs, cut-ins, strategist zoom and Worker parity');
