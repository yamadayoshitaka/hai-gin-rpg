import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {COMBAT_RULES} from '../src/combat-action-spec.js';
import {describeSquadOrder,describeCommanderBuff} from '../src/battle-order-message.js';

const unit=(id,team,jobId,x,z)=>({id,team,jobId,x,z,hp:100,maxHp:100,mp:100,maxMp:100,alive:true,cooldown:0});
const units=[unit(0,0,'summoner',8,8),unit(1,0,'sword',9,8),unit(2,1,'fighter',24,24)];
const runtime=new CombatActionRuntime({width:32,height:32,walkable:new Uint8Array(1024).fill(1)});
const tick=dt=>runtime.beginTick(dt,units);
tick(.1);
const wolf=runtime.spawnObject('wolf',units[0]);
assert.ok(wolf&&runtime.mountObject(units[1],wolf));
assert.equal(wolf.expiresAt,Infinity,'riding suspends the normal contract timer');
const left=wolf.pausedLifetimeRemaining;
assert.ok(left>0&&left<=45);
tick(65);
assert.equal(wolf.alive,true,'a passenger cannot fall merely because 45 seconds passed');
assert.equal(units[1].mountId,wolf.id);
assert.equal(runtime.events.filter(e=>e.type==='riderFall').length,0);
const priorHp=wolf.hp;
runtime.damageUnit(units[0],20,units[2]);
assert.equal(wolf.hp,priorHp-Math.round(20*COMBAT_RULES.mountedSummonDamageLinkRatio),
 'a mounted familiar takes only the riding-specific link damage');
assert.equal(runtime.dismountObject(units[1]),true);
assert.ok(Number.isFinite(wolf.expiresAt)&&wolf.expiresAt>runtime.time,
 'dismount restores the remaining finite lifetime');
tick(left+9);
assert.equal(wolf.alive,false,'an unmounted familiar eventually expires');
assert.equal(runtime.events.some(e=>e.type==='riderFall'),false,
 'normal unmounted expiry causes no fall');

const fresh=runtime.spawnObject('wolf',units[0]);
assert.ok(fresh&&runtime.mountObject(units[1],fresh));
runtime.damageObject(fresh,999,units[2]);
assert.equal(units[1].mountId,null,'real mount defeat still dismounts');
assert.equal(runtime.events.filter(e=>e.type==='riderFall').length,1,
 'a real mount defeat has precisely one rider fall');

assert.match(describeSquadOrder('charge',{massBattle:true}).effect,/\+30%/);
assert.match(describeSquadOrder('charge',{massBattle:false}).effect,/\+25%/);
assert.match(describeSquadOrder('defend').effect,/物理被ダメージ -9〜24%/);
assert.match(describeSquadOrder('defend').effect,/HP自動回復/);
assert.match(describeCommanderBuff({attack:.2,defense:.15,duration:20}),/攻撃力 \+20%／被ダメージ -15%／持続 20秒/);
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const id of ['allyItemToggle','enemyItemToggle'])assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/function toggleBattleItems\(side\)/);
assert.match(html,/battleItemSide==='enemy'/);
assert.match(html,/renderEnemyBattleItems\(\)/);
assert.match(html,/describeSquadOrder\(mode,\{massBattle:Boolean\(massSim\)\}\)/);
assert.match(html,/describeCommanderBuff\(order\)/);
assert.match(html,/battleDialogue\.push\(\{key:'squad-order:'/);
console.log('PASS mounted lifetime, damage link, actual mount defeat, command buffs, mirrored item displays');
