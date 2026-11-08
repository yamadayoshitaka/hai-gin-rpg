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
  sourceX:5,sourceZ:7,damage:23,effect:'physical',remainingHp:77,maxHp:100
},'Physical impacts identify the actual damaged soldier and their attacker');
const before=combat.events.length;
victim.fireWardUntil=.5;
assert.equal(combat.damageUnit(victim,29,attacker,'fire'),0);
assert.equal(combat.events.length,before,'Blocked damage must not show a false impact');
combat.beginTick(.1,[attacker,victim]);
victim.fireWardUntil=0;
assert.equal(combat.damageUnit(victim,11,attacker,'fire'),11);
assert.equal(combat.events.find(e=>e.type==='unitHit').effect,'fire',
 'Elemental damage remains tagged for the gameplay simulation');
assert.equal(combat.events.find(e=>e.type==='unitHit').remainingHp,66,
 'The victim remaining HP must be the actual post-damage value');

const army=Array.from({length:2000},(_,id)=>({id,team:id%2,jobId:'sword',x:id%32,z:Math.floor(id/32)%32,
  alive:true,hp:100,maxHp:100}));
combat.beginTick(.1,army);
for(const soldier of army)combat.damageUnit(soldier,1,null,'physical');
const contacts=combat.events.filter(e=>e.type==='unitHit');
assert.ok(contacts.length>=80&&contacts.length<=112,
 '2000-person combat retains a useful bounded reservoir of confirmed hits');
assert.ok(contacts.some(e=>e.targetId>=1500)&&contacts.some(e=>e.targetId<500),
 'Confirmed hits must sample distant, later IDs as well as the first army');
assert.ok(combat.events.length<=256,'Main simulation event capacity is preserved');

const vfx=readFileSync(new URL('../src/character-system/action-vfx-runtime.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(vfx,/emitConfirmedHit\(point,\{source=null,element='physical'/,
 'Confirmed hits have a dedicated target-bound visual');
assert.match(vfx,/this\.hitGroundMesh=new THREE\.InstancedMesh/,
 'The target ground indicator is drawn as one GPU batch');
assert.match(vfx,/this\.hitHaloMesh=new THREE\.InstancedMesh/,
 'The target head halo is drawn as one GPU batch');
assert.match(vfx,/this\.hitBurstMesh=new THREE\.InstancedMesh/,
 'Jagged confirmed-hit corona is a shared GPU batch');
assert.match(vfx,/hitDrawCalls:3/,'Three fixed batches bound the expanded impact effect');
assert.match(vfx,/this\.emitTether\(source,at,\{element:effect,life:\.34,thick:true\}\)/,
 'Magic reveals the attack route as a thick elemental streak');
assert.match(vfx,/this\.emitSlashArc\(at,source,\{scale:1\.45,heavy:true\}\)/,
 'Melee slashes burst around the actual victim, not only the attacker');
assert.match(vfx,/for\(const mesh of \[this\.hitGroundMesh,this\.hitHaloMesh,this\.hitBurstMesh\]\)\{/,
 'Hit marker instance matrices and materials are reclaimed');
assert.match(page,/if\(e\.type==='unitHit'\)/,
 'Gameplay unit damage events are consumed in the battlefield view');
assert.doesNotMatch(page,/actionVfx\.emitConfirmedHit\(ground/,
 'Confirmed victim overlays must not spawn separate heavy 3D impact bursts');
assert.match(page,/const target=hitTargetWorld\(e\)/,
 'The impact indicator anchors to the actual damaged soldier');
assert.match(page,/selectConfirmedHitEvents\(events,camera,/,
 'Impacts are selected by the camera view');
assert.match(page,/confirmedHitOverlay\.add\(\{target,team:e\.team,damage:e\.damage,/,
 'Damage is displayed only for a confirmed HP loss');
assert.match(page,/remainingHp:e\.remainingHp,maxHp:e\.maxHp/,
 'Real remaining health comes from the authoritative combat event');
assert.match(page,/confirmedHitOverlay\.render\(dt,\{paused\}\)/,
 'The damage label follows the camera during combat');
const overlay=readFileSync(new URL('../src/confirmed-hit-overlay.js',import.meta.url),'utf8');
assert.match(overlay,/const text='−'\+hit\.damage/,'Show damage over a wounded soldier');
assert.doesNotMatch(overlay,/ctx\.arc\(/,'Avoid victim circles that obscure large battles');
assert.match(overlay,/const style=damageNumberStyle\(hit\.damage,hit\.remainingHp\)/,
 'Colour the HP-loss number by severity, not team affiliation');
assert.match(overlay,/const hp='HP '\+hit\.remainingHp/,
 'Show victim remaining HP and maximum HP');
assert.doesNotMatch(overlay,/ctx\.fillText\('HIT'/,'No redundant HIT label');
assert.doesNotMatch(overlay,/if\(from\)/,'No attack-direction arrows');
assert.match(overlay,/this\.drawElapsed<1\/24/,'Limit overlay redrawing on mobile');
assert.match(overlay,/pointer-events:none/,'Hit overlay cannot steal battle touch events');
const THREE=await import('three').catch(()=>null);
if(THREE){
 const {projectCombatPoint,selectConfirmedHitEvents}=
   await import('../src/confirmed-hit-overlay.js');
 const camera=new THREE.PerspectiveCamera(60,1,.1,150);
 camera.position.set(0,10,18);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 assert.ok(projectCombatPoint({x:0,y:0,z:0},camera,400,400),
  'Central victim must be visible');
 assert.equal(projectCombatPoint({x:180,y:0,z:0},camera,400,400),null,
  'Off-screen damage cannot steal an on-screen marker');
 const hits=[
  {type:'unitHit',targetId:41,x:180,z:0,damage:90},
  {type:'unitHit',targetId:42,x:0,z:0,damage:12},
  {type:'unitHit',targetId:43,x:1,z:0,damage:21},
  {type:'skill',targetId:44,x:0,z:0,damage:99}
 ];
 const chosen=selectConfirmedHitEvents(hits,camera,
  event=>({x:event.x,y:0,z:event.z}),8);
 assert.deepEqual(chosen.map(e=>e.targetId).sort((a,b)=>a-b),[42,43],
  'Only truly damaged visible victims can show confirmed damage feedback');
}
assert.match(page,/' 命中 '\+confirmedHitOverlay\.activeCount/,
 'Performance panel shows only actual simplified visible hits');
console.log('PASS camera-centered damage circles, remaining HP, and low-cost overlay');
