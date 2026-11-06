import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';

const walkable=new Uint8Array(32*32).fill(1);
const combat=new CombatActionRuntime({width:32,height:32,walkable});
const attacker={id:1,team:0,jobId:'sword',x:5,z:7,alive:true,hp:100,maxHp:100};
const victim={id:2,team:1,jobId:'mage',x:6,z:7,alive:true,hp:100,maxHp:100};
combat.beginTick(.1,[attacker,victim]);
assert.equal(combat.damageUnit(victim,23,attacker,'physical'),23);
assert.deepEqual(combat.events.find(e=>e.type==='unitHit'),{
  type:'unitHit',time:.1,targetId:2,sourceId:1,team:1,x:6,z:7,
  sourceX:5,sourceZ:7,damage:23,effect:'physical'
},'Physical impacts identify the actual damaged soldier and their attacker');
const before=combat.events.length;
victim.fireWardUntil=.5;
assert.equal(combat.damageUnit(victim,29,attacker,'fire'),0);
assert.equal(combat.events.length,before,'Blocked damage must not show a false impact');
combat.beginTick(.1,[attacker,victim]);
victim.fireWardUntil=0;
assert.equal(combat.damageUnit(victim,11,attacker,'fire'),11);
assert.equal(combat.events.find(e=>e.type==='unitHit').effect,'fire',
 'Elemental magic hits keep the spell element for impact coloring');

const army=Array.from({length:2000},(_,id)=>({id,team:id%2,jobId:'sword',x:id%32,z:Math.floor(id/32)%32,
  alive:true,hp:100,maxHp:100}));
combat.beginTick(.1,army);
for(const soldier of army)combat.damageUnit(soldier,1,null,'physical');
const contacts=combat.events.filter(e=>e.type==='unitHit');
assert.ok(contacts.length>0&&contacts.length<=96,
 '2000-person combat samples real hits without saturating the event bus');
assert.ok(combat.events.length<=256,'Main simulation event capacity is preserved');

const vfx=readFileSync(new URL('../src/character-system/action-vfx-runtime.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(vfx,/emitConfirmedHit\(point,\{source=null,element='physical'/,
 'Confirmed hits have a dedicated target-bound visual');
assert.match(vfx,/this\.hitGroundMesh=new THREE\.InstancedMesh/,
 'The target ground indicator is drawn as one GPU batch');
assert.match(vfx,/this\.hitHaloMesh=new THREE\.InstancedMesh/,
 'The target head halo is drawn as one GPU batch');
assert.match(vfx,/this\.emitTether\(source,at,\{element:effect,life:\.34,thick:true\}\)/,
 'Magic reveals the attack route as a thick elemental streak');
assert.match(vfx,/this\.emitSlashArc\(at,source,\{scale:1\.45,heavy:true\}\)/,
 'Melee slashes burst around the actual victim, not only the attacker');
assert.match(vfx,/for\(const mesh of \[this\.hitGroundMesh,this\.hitHaloMesh\]\)\{/,
 'Hit marker instance matrices and materials are reclaimed');
assert.match(page,/if\(e\.type==='unitHit'\)/,
 'Gameplay unit damage events are consumed in the battlefield view');
assert.match(page,/actionVfx\.emitConfirmedHit\(at,\{source:from,element:e\.effect,team:e\.team/,
 'The hit display is anchored at the actual victim position');
assert.match(page,/\.slice\(0,MASS_SIZE\?8:12\)/,
 'Thousands of impacts are culled and capped per snapshot');
assert.match(page,/' 命中 '\+fx\.confirmedHitMarkers/,
 'Performance panel shows actual active confirmed-hit markers');
console.log('PASS target-specific heavy slashes, large magic impact markers and bounded GPU instancing');
