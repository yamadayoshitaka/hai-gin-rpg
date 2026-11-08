import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {massGaitActive,sampleMassVisualMotion} from '../src/mass-visual-motion.js';

const u={id:12,alive:true,x:7,z:6,fromX:6,fromZ:6,
  moveDuration:0.5,moveElapsed:0,completedSteps:0,action:'walk',
  facingX:1,facingZ:0};
let previous=sampleMassVisualMotion(u,{x:0,y:0,z:0},1,1/60);
assert.equal(previous.phase,0);
for(let frame=2;frame<=48;frame++){
 const t=(frame-1)/47;
 u.moveElapsed=t*0.5;
 const current=sampleMassVisualMotion(u,{x:t,y:0,z:0},frame,1/60);
 assert.ok(current.x>=previous.x-1e-9,'Smooth root must never move backward');
 assert.ok(current.phase>=previous.phase-1e-9,'Footfall may not reverse at a Worker snapshot');
 assert.ok(t-current.x<=.221,'Visual interpolation must lag less than quarter a tile');
 previous={...current};
}
u.moveElapsed=u.moveDuration;u.completedSteps=1;
const atContact=sampleMassVisualMotion(u,{x:1,y:0,z:0},49,1/60);
assert.ok(massGaitActive(u),'Last tile-contact frame still plays the running clip');
assert.ok(atContact.phase>=previous.phase,'A planted foot cannot jump to a previous cycle');
u.fromX=7;u.x=8;u.moveElapsed=0;u.moveDuration=0.5;u.action='walk';
const next=sampleMassVisualMotion(u,{x:1,y:0,z:0},50,1/60);
assert.ok(next.phase>=atContact.phase,'Following tile keeps the same physical footfall clock');
for(let frame=51;frame<=70;frame++)sampleMassVisualMotion(u,{x:1+(frame-50)*.025,y:0,z:0},frame,1/60);
assert.ok(u._visualMotion.phase>Math.PI,'Second tile advances rather than repeating step zero');
u.action='blocked';u.moveElapsed=u.moveDuration;
assert.equal(massGaitActive(u),false,'A genuinely blocked unit must not run on the spot');
const jump=sampleMassVisualMotion(u,{x:40,y:0,z:40},71,1/60);
assert.equal(jump.x,40,'Forced relocation must not lerp through walls');

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const game=read('../tactics-wireframe.html');
const gpu=read('../src/mass-battle-real-army.js');
const atlas=read('../src/crowd-impostor-atlas.js');
const motion=read('../src/character-system/battle-motion-policy.js');
const squadOpen=game.split('function openSquadTactics(id){')[1]?.split('function beginSquadDestination')[0];
assert.ok(squadOpen,'Squad formation UI exists');
assert.doesNotMatch(squadOpen,/setBattlePaused\(true\)/,'Opening formation should never pause');
assert.match(game,/moveActor\(a,goal,0,stop\)/,
 '50v50 should reserve its next tile immediately after completing the current one');
assert.match(game,/function smoothSkirmishRenderPosition\(/,
 '50v50 soldiers must animate between 50ms AI ticks, not teleport each tick');
assert.match(game,/focusHumanAt\(e\.clientX,e\.clientY\)/,
 'Tapping humanoid soldiers must use the same zoom interaction as flying summons');
assert.match(game,/const candidates=massSim\?massSim\.units:actors/,
 '2,000 instanced soldiers must be available for screen-space tapping');
assert.match(game,/getStepPhase:\(u,alpha\)=>u\._visualMotion\?\.phase/,
 'Detailed and instanced skeletons must share the same visible distance phase');
assert.match(motion,/const moving=massGaitActive\(unit\)/,
 'Detailed unit animations should not stop between adjacent tiles');
assert.match(gpu,/const physicallyMoving=massGaitActive\(u\)/,
 'GPU soldier animations should not stop between adjacent tiles');
assert.match(gpu,/float shoeMask=1\.0-smoothstep\(0\.23,0\.84,position\.y\)/,
 'Grounded boot contact should use a GPU stance mask instead of linear skate');
assert.match(gpu,/vec3 runPose=mix\(neutralContact,swingContact/,
 'Four interpolated gait keys run on the same GPU buffers');
assert.match(atlas,/\(row-1\)\*Math\.PI\*\.5:null/,
 'Distance LOD captures four real footfall frames at 0/90/180/270 degrees');
assert.match(atlas,/const locomotion='run'/,
 'All professions use the real run clip, not a slow walk based on speed stat');
console.log('PASS battle 50v50/1000v1000 stride continuity, camera tap and live formation UI');
