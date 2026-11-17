import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SKIRMISH_DASH_TEMPO,skirmishTravelTempo,realtimeBattleCinematicScale}
 from '../src/battle-tempo-policy.js';

assert.equal(SKIRMISH_DASH_TEMPO,1.28,'50v50 run speed rises moderately, not 3x');
for(const phase of [null,'approach','toStair','upstairs','roof'])
 assert.equal(skirmishTravelTempo({floorPhase:phase}),1.28,
  'ordinary pursuit and position changes stay fast: '+phase);
assert.equal(skirmishTravelTempo({floorPhase:'climb'}),1,
 'stairs remain safe and walk-speed');
assert.equal(skirmishTravelTempo({stealth:true}),1,
 'deliberate stealth movement remains deliberate');

for(const ceremony of ['idle','order','result','intro','outro']){
 assert.equal(realtimeBattleCinematicScale({mass:false,ceremony}),1,
  '50v50 gameplay must not enter slow motion during '+ceremony);
 assert.equal(realtimeBattleCinematicScale({mass:false,commander:true,ceremony}),1,
  'commander camera cut-in must not slow the 50v50 simulation');
}
assert.equal(realtimeBattleCinematicScale({mass:false,paused:true,ceremony:'result'}),1);
assert.equal(realtimeBattleCinematicScale({town:true,ceremony:'order'}),1);
assert.equal(realtimeBattleCinematicScale({mass:true,ceremony:'result'}),1,
 '1000v1000 combat must share the same real-time clock during reports');
assert.equal(realtimeBattleCinematicScale({mass:true,commander:true}),1,
 'camera cut-ins do not slow the mass Worker or soldier footfalls');
assert.equal(realtimeBattleCinematicScale({mass:true,ceremony:'idle'}),1);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/const cinematicPlaybackScale=realtimeBattleCinematicScale\(/,
 'runtime uses shared cinematic policy instead of always slowing 50v50');
assert.match(game,/town:TOWN_MODE,mass:Boolean\(MASS_SIZE\),paused,/);
assert.match(game,/skirmishTravelTempo\(\{\s*floorPhase:a\.floorTravel\?\.phase,stealth:a\.stealthMovement===true/,
 'authoritative tile movement consumes new tempo respecting stairs and stealth');
assert.match(game,/a\.character\.syncLocomotionPhase\(Math\.PI\*\(a\.gaitSteps\|\|0\)\)/,
 'actual world displacement continues driving real footfall and avoids sliding');
assert.match(game,/if\(!choice\|\|!startCellMove\(a,choice\.x,choice\.z\)\)/,
 'grid and collision reservations unchanged by faster animation');
assert.match(game,/if\(!paused&&!finished&&!a\.floorTravel\)moveActor\(a,goal,0,stop\)/,
 'next tile can still be reserved without teleporting');
assert.match(game,/skirmishRunTempo:SKIRMISH_DASH_TEMPO/,
 'speed ratio is available to the live diagnostic panel');
console.log('PASS: 50v50 true realtime cut-ins and +28% physical movement; safe stair/stealth, collision and gait');
