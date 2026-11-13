import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyMonsterBiologicalMotion} from '../src/monster-joint-motion.js';
import {animateMonsterModel,startMonsterAction} from '../src/monster-animation.js';

const source=(name)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const geo=source('monster-geometry.js'),shape=source('monster-shape-kit.js');
const battle=source('combat-world-object-renderer.js');

// Every spider and beetle leg must contain a genuinely nested chain;
// surface rings alone do not constitute joints.
for(const joint of ['Femur','Patella','Tibia','Tarsus'])
 assert.ok(geo.includes("name+'"+joint+"'"),joint+' geometry pivot is absent');
assert.match(geo,/const distal=\[foot\[0\]-bend\[0\]/,
 'distal leg geometry must be expressed in its parent joint space');

const node=()=>({rotation:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},
 position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},
 scale:{x:1,y:1,z:1,setScalar(n){this.x=this.y=this.z=n;}},
 userData:{}});
const pivots={};
for(const side of ['L','R'])for(let i=0;i<4;i++){
 const base='leg'+side+i;
 for(const suffix of ['', 'Femur','Patella','Tibia','Tarsus'])
  pivots[base+suffix]=node();
}
const spider={...node(),userData:{speciesId:'m026',pivots,homeScale:1}};
assert.equal(applyMonsterBiologicalMotion(spider,{
 phase:0,locomotion:true,run:true,action:'run',pulse:.4}),true);
const left=pivots.legL0Patella.rotation.z;
const right=pivots.legR0Patella.rotation.z;
assert.ok(left<-.20&&right>.05,'opposite sides lift with alternating support');
assert.ok(pivots.legL0Tibia.rotation.z>0,
 'tibia counter-rotates against the supporting patella');
assert.notEqual(pivots.legL0Tarsus.rotation.x,
 pivots.legR0Tarsus.rotation.x,'distal foot follows its own swing cycle');

assert.match(shape,/nictitating-membrane/,
 'avian/reptile eyelids should be actual sculpted meshes');
assert.match(shape,/organic&&\['avian','reptile'\]/,
 'insect compound eyes and humanoid replacement rigs must remain unaffected');
const lid=node();lid.position.y=.30;lid.userData={restY:.30,blinkTravel:.07};
const bird={...node(),userData:{
 speciesId:'m011',pivots:{eyelidL:lid},blinkOffset:0,
 homeScale:1,action:'idle',actionAt:0}};
animateMonsterModel(bird,4.50);
assert.ok(lid.position.y<.24,'bird nictitating membrane closes');
animateMonsterModel(bird,4.0);
assert.equal(lid.position.y,.30,'eyelid must reopen without accumulating drift');

startMonsterAction(bird,'defeat',10);
const terminal=animateMonsterModel(bird,15);
assert.equal(terminal.action,'defeat',
 'defeated model must not return to idle after the duration');
assert.equal(terminal.progress,1);
assert.equal(bird.scale.x,.84);

assert.match(battle,/const airborne=!!object\.flying;/,
 'wing animation must consult the creature flight state');
assert.match(battle,/const beat=airborne\?/,
 'flight and idle wings must use distinct beat amplitudes');
console.log('Creature articulation: 6/8-leg hinges, eyelid blink, terminal defeat, airborne summon wing animation PASS');
