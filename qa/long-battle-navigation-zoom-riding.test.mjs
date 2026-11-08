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

// In 1000v1000 the defender on an actual second-floor window must not
// monopolise the entire building: an enemy can climb the same authored path.
const upper=new MassBattleGridSimulation(1000,20261109,{
 width:size,height:size,walkable,bridges:[],riverXAt:()=>116
});
const defender=upper.units.find(u=>u.team===1&&u.jobId==='archer');
const pursuer=upper.units.find(u=>u.team===0&&u.jobId==='sword');
assert.ok(defender&&pursuer,'both squads have real jobs');
for(const u of upper.units)if(u!==defender&&u!==pursuer)u.alive=false;
const stairRoute={id:'test-upper-window',buildingIndex:0,structureId:null,
 team:1,kind:'window',level:2,access:{x:118,z:80},
 points:[{x:246.4,y:0,z:162.8},{x:246.4,y:4,z:162.8}],
 window:{aperture:{x:118,z:80},normal:{x:1,z:0},inset:.1,halfWidth:10}};
upper.configureHighGroundRoutes([stairRoute]);
defender.highGroundRouteIndex=0;defender.highGroundPhase=2;defender.highGroundFloor=2;
upper._highGroundClaims.set('0:1',defender.id);
pursuer.x=pursuer.fromX=117;pursuer.z=pursuer.fromZ=80;
upper._assignHighGroundUnits();
assert.equal(pursuer.highGroundRouteIndex,0,
 'the 1000v1000 attacker can pursue an occupied upstairs window');
assert.equal(upper._highGroundClaims.get('0:0'),pursuer.id,
 'the armies have independent entrance claims');
pursuer.x=pursuer.fromX=118;pursuer.z=pursuer.fromZ=80;
pursuer.moveElapsed=pursuer.moveDuration=0;
upper._tickHighGroundUnit(pursuer,.1);
assert.equal(pursuer.highGroundPhase,1,'physically climbs stair route');
for(let i=0;i<100&&pursuer.highGroundPhase===1;i++)upper._tickHighGroundUnit(pursuer,.1);
assert.equal(pursuer.highGroundPhase,2,'reaches the same upstairs landing');
assert.equal(upper._canSee(pursuer,defender),true,'same-level contact is visible');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const creatures=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
assert.match(battle,/if\(tap\.doubleTap\)\{\s*zoomToSquadMember\(id,team\)/,
 'double-tap must zoom without reopening squad information');
assert.match(battle,/body\.squad-closeup #squadCircleInfo/,
 'close-up hides the horizontal squad status strip');
assert.match(battle,/const hide=followCamera\|\|pageZoomed\|\|shouldHideSquadLabelsAtDistance/,
 'following a character always hides commander ribbons');
assert.match(battle,/body\.squad-closeup #allySquadRibbon/,
 'close-up hides the side command list');
assert.match(battle,/o\.mountedBy===\(massSim&&unit\.massUnitId!=null\?unit\.massUnitId:unit\.id\)/,
 'detailed mass-battle actors must resolve the authoritative rider ID');
assert.match(creatures,/riderSmooth=rider\?\._visualMotion/,
 'mounts need the same interpolated world position as their GPU riders');
assert.match(creatures,/const travel=rider\?\{x,z\}:\{x:motion\.x,z:motion\.z\}/,
 'mounted creature always follows its rider, including when it is the last survivor');
assert.match(battle,/route\.lastStairRecoveryAt/,
 'a blocked stair landing should invoke bounded alternate routing');
assert.match(battle,/if\(route\.phase==='toStair'\)route\.stairStage=center/,
 'a reachable and collision-checked stair stage must replace the old entry point');
assert.match(battle,/if\(!target\|\|target\.hp<=0\|\|target\.team===a\.team\)a\.targetId=null/,
 'a dead targeted enemy must be forgotten by the small-battle AI');
assert.match(battle,/stickyDistance<=nearestDistance\+CELL\*3/,
 'manual targeting must release a stale enemy once a closer enemy appears');
console.log('PASS: late-battle pursuit, independent mounts, stair recovery, hidden close-up squad labels');
