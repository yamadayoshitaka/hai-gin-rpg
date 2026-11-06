import assert from 'node:assert/strict';
import {COMBAT_JOB_SPECS,COMBAT_OBJECT_SPECS,COMBAT_RULES} from '../src/combat-action-spec.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {CREATURE_PERFORMANCE} from '../src/combat-creature-performance.js';
import {readFileSync} from 'node:fs';
for(const [id,rank] of [['forest_archer','R'],['seraph_guardian','UR']]){
 const spec=COMBAT_OBJECT_SPECS[id],skill=COMBAT_JOB_SPECS.summoner.skills.find(s=>s.objectType===id);
 assert.equal(spec.category,'summon');assert.equal(skill.rank,rank);
 assert.equal(CREATURE_PERFORMANCE[id].mountable,false);
}
const source=readFileSync(new URL('../src/combat-humanoid-summons.js',import.meta.url),'utf8');
assert.match(source,/buildWings/);assert.match(source,/addBow/);
const owner={id:0,team:0,jobId:'summoner',rarity:'UR',x:4,z:4,hp:100,maxHp:100,mp:100,alive:true};
const ally={id:1,team:0,jobId:'sword',x:5,z:4,hp:35,maxHp:100,alive:true};
const enemy={id:2,team:1,jobId:'sword',x:7,z:4,hp:100,maxHp:100,alive:true};
const units=[owner,ally,enemy],runtime=new CombatActionRuntime({width:20,height:20});
const sectors=new Map([['0:0',[owner,ally]],['1:0',[enemy]]]);
runtime.beginTick(.1,units,{sectors});
const elf=runtime.spawnObject('forest_archer',owner);assert.ok(elf);
const angel=runtime.spawnObject('seraph_guardian',owner);assert.ok(angel);
assert.equal(runtime.summonOf(owner).length,1);assert.equal(elf.alive,false);
runtime.beginTick(.1,units,{sectors});
assert.ok(ally.hp>35,'天使が味方を治癒する');
assert.ok(runtime.events.some(e=>e.type==='skill'&&e.effect==='heal'));
runtime.damageObject(angel,20,null,'arcane');
assert.ok(owner.hp<100,'召喚獣の被ダメージが召喚士へ連動する');
assert.equal(COMBAT_RULES.maximumSummonsPerCaster,1);
console.log('人型召喚獣2体・共通枠・回復・被ダメージ連動 PASS');
