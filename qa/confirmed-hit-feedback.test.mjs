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
assert.match(page,/actionVfx\.emitConfirmedHit\(ground,\{source:sourceGround,element:e\.effect,team:e\.team/,
 '3D effects are anchored at the hit victim ground position');
assert.match(page,/const target=hitTargetWorld\(e\),source=hitSourceWorld\(e\)/,
 'Hit numbers and attack direction must use actual source and target coordinates');
assert.match(page,/selectConfirmedHitEvents\(events,camera,/,
 'Current camera frustum, not world distance or first event order, selects impacts');
assert.match(page,/confirmedHitOverlay\.add\(\{target,source,element:e\.effect,team:e\.team/,
 'A confirmed damage event must create a visible numeric victim marker');
assert.match(page,/confirmedHitOverlay\.render\(dt,\{paused\}\)/,
 'Hit overlays must follow camera motion every display frame');
const overlay=readFileSync(new URL('../src/confirmed-hit-overlay.js',import.meta.url),'utf8');
assert.match(overlay,/const text='−'\+hit\.damage/,'Real damage is shown at the victim');
assert.match(overlay,/ctx\.arc\(to\.x,to\.y,outer/,'Victim receives a clear reticle');
assert.match(overlay,/if\(from\)/,'Hit markers connect to known attackers');
assert.match(overlay,/pointer-events:none/,'Hit overlay must never intercept game controls');
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
assert.match(page,/' 命中 '\+fx\.confirmedHitMarkers/,
 'Performance panel shows actual active confirmed-hit markers');
console.log('PASS target-specific heavy slashes, large magic impact markers and bounded GPU instancing');
