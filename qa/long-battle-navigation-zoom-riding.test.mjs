import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

// A survivor can be behind either front after minutes of battle. A fixed
// east/west front-line flow must not be the only navigation objective.
const size=232,walkable=new Uint8Array(size*size).fill(1);
const sim=new MassBattleGridSimulation(50,20261108,{
 width:size,height:size,walkable,bridges:[],riverXAt:()=>116
});
const survivingEnemy=sim.units.find(u=>u.team===1);
assert.ok(survivingEnemy,'enemy setup');
for(const u of sim.units)if(u.team===1&&u!==survivingEnemy)u.alive=false;
const z=82,at=x=>z*size+x;
survivingEnemy.x=195;survivingEnemy.z=z;
sim.time=20;
const forward=sim._enemyPursuitFlow(0,'warrior');
assert.ok(forward&&forward[at(190)]<forward[at(80)],
 'army should follow the remaining enemy east, not a static formation marker');
sim.time+=2;sim._enemyBuildsThisTick=0;
survivingEnemy.x=25;
const rear=sim._enemyPursuitFlow(0,'warrior');
assert.ok(rear&&rear[at(30)]<rear[at(190)],
 'enemy behind the lines must become the new goal when the field refreshes');
assert.notStrictEqual(forward,rear,'shared fields refresh as the last enemy moves');

// A ninja can still use a water-aware flow, and eliminated targets do not
// produce a phantom goal.
sim.time+=2;sim._enemyBuildsThisTick=0;
const ninja=sim._enemyPursuitFlow(0,'ninja');
assert.ok(ninja&&ninja[at(30)]<ninja[at(190)]);
sim.time+=2;sim._enemyBuildsThisTick=0;
assert.equal(sim._enemyPursuitFlow(0,'warrior','nonexistent-squad'),null);

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const creatures=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
assert.match(battle,/if\(tap\.doubleTap\)\{\s*if\(zoomToSquadMember\(id,team\)\)/,
 'double-tap must zoom and retain the selected squad inspection');
assert.match(battle,/positionSquadCircleInfo\(null\)/,
 'inspection must remain docked when zoom leaves the circular marker offscreen');
assert.match(battle,/o\.mountedBy===\(massSim&&unit\.massUnitId!=null\?unit\.massUnitId:unit\.id\)/,
 'detailed mass-battle actors must resolve the authoritative rider ID');
assert.match(creatures,/riderSmooth=rider\?\._visualMotion/,
 'mounts need the same interpolated world position as their GPU riders');
assert.match(creatures,/riderWorld\|\|riderSmooth\?\{x,z\}/,
 'mounted creature drawing must not lag behind its rider');
assert.match(battle,/route\.lastStairRecoveryAt/,
 'a blocked stair landing should invoke bounded alternate routing');
assert.match(battle,/route\.stairStage=new THREE\.Vector3\(world\.x/,
 'a successful stair alternate must actually update the climb entry point');
assert.match(battle,/if\(!target\|\|target\.hp<=0\|\|target\.team===a\.team\)a\.targetId=null/,
 'a dead targeted enemy must be forgotten by the small-battle AI');
assert.match(battle,/stickyDistance<=nearestDistance\+CELL\*3/,
 'manual targeting must release a stale enemy once a closer enemy appears');
console.log('PASS: late-battle pursuit, independent mounts, stair recovery, close-up squad information');
