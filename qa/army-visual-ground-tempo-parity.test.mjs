import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {realtimeBattleCinematicScale} from '../src/battle-tempo-policy.js';
import {massGpuMotionCode,massLocomotionKind} from '../src/mass-dash-parity.js';
import {crowdRunFrame} from '../src/crowd-run-grounding.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

// Tactical orders, damage and inventory are handled by the same underlying
// action system, while large troops use the worker/GPU for throughput.
const map=new Uint8Array(232*232).fill(1);
const mass=new MassBattleGridSimulation(100,20261104,{width:232,height:232,
 walkable:map,bridges:[],riverXAt:()=>116});
const normal=new CombatActionRuntime({width:232,height:232,walkable:map});
assert.equal(mass.actions.constructor.name,'CombatActionRuntime',
 'mass Worker and skirmish use the same combat action class');
assert.ok(normal instanceof CombatActionRuntime);
assert.equal(typeof mass.setSquadCommand,'function');
for(const ceremony of ['idle','order','result','intro','outro']){
 assert.equal(realtimeBattleCinematicScale({mass:true,ceremony,commander:true}),1,
  '1000v1000 follows the same real-time tempo as 50v50: '+ceremony);
 assert.equal(realtimeBattleCinematicScale({mass:false,ceremony,commander:true}),1);
}
const runUnit={alive:true,action:'walk',moveDuration:.5,moveElapsed:.2,mountId:null};
assert.equal(massLocomotionKind(runUnit),'run');
assert.equal(massGpuMotionCode(runUnit),1);
assert.deepEqual([0,.5*Math.PI,Math.PI,1.5*Math.PI].map(crowdRunFrame),[0,1,2,3],
 'the real running atlas uses four distinct gait frames');

// The original mobile 1000v1000 screenshots had detached boots, characters
// half underground and cardboard torsos. Test the responsible code paths.
const army=read('src/mass-battle-real-army.js');
const atlas=read('src/crowd-impostor-atlas.js');
const game=read('tactics-wireframe.html');
assert.match(army,/rotation\.setFromAxisAngle\(up,Math\.atan2\(cameraDx,cameraDz\)\)/,
 'photo impostor stays vertical when the player looks down at the army');
assert.doesNotMatch(army,/rotation\.copy\(camera\.quaternion\)/,
 'do not pitch standing humans into grass with the camera');
assert.match(army,/vec3 runPose=mix\(crowdWalkA,crowdWalkB,0\.5\+0\.5\*swing\)/,
 'real skinned gait samples interpolate smoothly through both leg contacts');
assert.match(army,/float upperBody=smoothstep\(0\.78,1\.35,position\.y\)/,
 'shoulder accent does not scale legs and split the outfit at the knees');
assert.doesNotMatch(army,/runPose=neutralContact\+\(runPose-neutralContact\)\*1\.24/,
 'old 24%-amplified entire human was visually damaged');
assert.match(atlas,/verifiedRows:3/,
 'idle, run and attack images all have anatomical silhouette checks');
assert.match(atlas,/maxY-minY<tileSize\*\.36/,
 'short torso-only/legless photos are rejected at startup');
assert.match(game,/const seat=u\.mountId\?riderElevation\(u,creatureVisualTime\):0;/,
 'mount riders use the same current-frame seat as the 50v50 horse model');
assert.match(game,/const corrected=anchoredStandingY\(floor,seat\);/,
 'foot Y is clamped after worker interpolation, not before it');
assert.match(game,/out\.y=corrected;smooth\.y=corrected;/,
 'saddle and both terrain directions are authoritative after worker smoothing');
assert.match(game,/const cinematicPlaybackScale=realtimeBattleCinematicScale\(/);
assert.match(game,/town:TOWN_MODE,mass:Boolean\(MASS_SIZE\),paused,/);
assert.match(game,/battleCommandBridge\.issue\(\{squadId:id,team:side,mode\}\)/,
 'tactical UI commands reach authoritative mass AI as in 50v50');
console.log('PASS 50/1000 tactical engine parity + grounded 2000-body run/ride + upright complete photo LOD');
