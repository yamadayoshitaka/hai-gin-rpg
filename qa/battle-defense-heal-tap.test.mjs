import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {updateDefensivePosture,defensiveDamageMultiplier} from '../src/battle-defensive-doctrine.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {COMBAT_JOB_SPECS} from '../src/combat-action-spec.js';
import {MASS_UNIT_FIELDS} from '../src/mass-battle-worker-protocol.js';

const main=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const grid=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
assert.match(main,/function requestSquadRecovery\(targetId\)/);
assert.match(main,/add\('✨ 回復要請','request_healing'/);
assert.doesNotMatch(main,/add\('📍 行き先','move'/,'Remove duplicate destination button');
assert.doesNotMatch(main,/add\('🔍 部隊へズーム','inspect'/,'Squad label itself zooms');
assert.match(main,/squadOrderText\(id\)/);
assert.match(main,/squadObjectiveShort\(id\)/);
assert.match(main,/label\.setPointerCapture\(event\.pointerId\)/);
assert.match(main,/if\(activeSquadLabelPress\)return/);
assert.match(main,/updateDefensivePosture\(a,dt,defending\)/);
assert.match(grid,/updateDefensivePosture\(u,dt,defending\)/);
for(const field of ['defendSeconds','defendPhysicalReduction','defendElementalReduction'])
 assert.ok(MASS_UNIT_FIELDS.includes(field),'Worker must mirror '+field);

const defender={hp:20,maxHp:100,alive:true};
let recovered=0;
for(let i=0;i<70;i++)recovered+=updateDefensivePosture(defender,.1,true);
assert.ok(recovered>2&&defender.hp>20,'A defensive order heals injured soldiers steadily');
assert.ok(defender.hp<=80,'Only real priest magic can fully heal past 80%');
assert.equal(defender.defendPhysicalReduction,.24);
assert.equal(defender.defendElementalReduction,.32);
assert.equal(defensiveDamageMultiplier(defender,'physical'),.76);
assert.equal(defensiveDamageMultiplier(defender,'fire'),.68);
defender.hp=95;updateDefensivePosture(defender,.1,true);
assert.equal(defender.hp,95,'Regen cap must never decrease healthy soldier HP');
updateDefensivePosture(defender,.1,false);
assert.equal(defender.defendPhysicalReduction,0,'Leaving defense removes the buff');
const fallen={hp:0,maxHp:100,alive:false};
updateDefensivePosture(fallen,.1,true);
assert.equal(fallen.hp,0,'No resurrection through a passive defense order');

const heal=COMBAT_JOB_SPECS.priest.skills.find(s=>s.id==='heal');
const big=COMBAT_JOB_SPECS.priest.skills.find(s=>s.id==='group_heal');
assert.ok(heal.radius>=5&&heal.range>=12);
assert.ok(big.radius>=10&&big.range>=14);
const actor={id:1,team:0,alive:true,hp:100,maxHp:100,mp:100,maxMp:100,
 jobId:'priest',rarity:'R',x:3,z:4};
const wounded={id:2,team:0,alive:true,hp:20,maxHp:100,x:14,z:4};
const nearby={id:3,team:0,alive:true,hp:15,maxHp:100,x:22,z:5};
const far={id:4,team:0,alive:true,hp:15,maxHp:100,x:30,z:5};
const foe={id:5,team:1,alive:true,hp:15,maxHp:100,x:14,z:5};
const units=[actor,wounded,nearby,far,foe];
const sectors=new Map();
for(const u of units){
 const key=Math.floor(u.x/5)+':'+Math.floor(u.z/5);
 if(!sectors.has(key))sectors.set(key,[]);
 sectors.get(key).push(u);
}
const runtime=new CombatActionRuntime({width:48,height:48,walkable:new Uint8Array(48*48).fill(1)});
runtime.beginTick(.1,units,{sectors});
assert.equal(runtime.fireSkill(actor,big,wounded,units),true,'R priest casts AoE at a distant wounded ally');
assert.ok(wounded.hp>20);
assert.ok(nearby.hp>15,'Other allies inside 10 tiles also heal');
assert.equal(far.hp,15,'Outside radius receives no heal');
assert.equal(foe.hp,15,'Enemy receives no heal');
assert.ok(runtime.events.some(e=>e.type==='groupHeal'&&e.radius>=10&&e.count>=2));
console.log('PASS reliable mobile tap, objective UI, defense regen/resistances, large-area allied-only healing');
