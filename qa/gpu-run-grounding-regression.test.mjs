import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createCrowdGroundAnchor,crowdGroundShift,applyCrowdGroundShift,
 crowdRunFrame,crowdGaitBlend,
} from '../src/crowd-run-grounding.js';
import {massGaitActive,sampleMassVisualMotion} from '../src/mass-visual-motion.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

// Representative foot/torso points (model-local Y): one source skinned human,
// a clothed boot and a blade extending below the boots. Weapon NEVER changes
// the grounded human baseline or foot-contact selector.
const human=new Float32Array([
 -0.1,0.0,-.2, .1,.01,.2, -.1,.10,.2, .1,.13,-.2, 0,1.6,0, .1,1.8,0
]);
const armor=new Float32Array([0,.015,0, .1,.14,0]);
const weapon=new Float32Array([0,-.9,0,0,1.2,0]);
const parts=[
 {isHumanBody:true,base:human},
 {isHumanBody:false,base:armor},
 {isHumanBody:false,base:weapon}
];
const anchor=createCrowdGroundAnchor(parts);
assert.ok(anchor?.samples?.length>0);
assert.ok(anchor.floor>=-.001&&anchor.floor<.001,'the sword below the sole is ignored');
for(const pose of ['hit','guard','attack','skill']){
 const hit=new Float32Array(human);
 for(let i=1;i<hit.length;i+=3)hit[i]-=.34;
 const poses=[{pose:hit,base:human},{pose:armor,base:armor},{pose:weapon,base:weapon}];
 const shift=crowdGroundShift(anchor,poses);
 assert.ok(Math.abs(shift-.34)<.00001,pose+' retargeted pelvis correction');
 const grounded=applyCrowdGroundShift(hit,shift);
 assert.ok(Math.abs(grounded[1])<1e-5,'no hit boot sinks below Y=0');
 assert.equal(grounded.length,hit.length,'no vertex, mesh or outfit is dropped');
}
const deadHuman=new Float32Array(human);
deadHuman[1]=-0.28;deadHuman[4]=.09;deadHuman[7]=.12;
const fallen=crowdGroundShift(anchor,[{pose:deadHuman,base:human}],{dead:true});
assert.ok(Math.abs(fallen-.28)<.001,'dead pose grounded to foot plane');
assert.equal(crowdGroundShift(anchor,[{pose:human,base:human}]),0);
assert.equal(crowdGroundShift(null,[{pose:human,base:human}]),0);
assert.equal(crowdRunFrame(0),0);
assert.equal(crowdRunFrame(Math.PI*.5),1);
assert.equal(crowdRunFrame(Math.PI),2);
assert.equal(crowdRunFrame(Math.PI*1.5),3);
assert.equal(crowdRunFrame(Math.PI*2),0);
assert.ok(crowdGaitBlend(Math.PI/2).swing>.99);
assert.equal(crowdGaitBlend(Math.PI*1.5).alternate,true);

// A complete running cycle is TWO step tiles. All class speeds/diagonals
// use the same metre-based phase; a hit can never force a moving soldier
// into an idle or recoil animation while its position continues moving.
const walkable=new Uint8Array(24*24).fill(1);
const sim=new MassBattleGridSimulation(10,999,{
 width:24,height:24,walkable,bridges:[],riverXAt:()=>12
});
const runner=sim.units.find(u=>u.alive&&!u.isStrategist);
runner.fromX=runner.x;runner.fromZ=runner.z;
runner.x=runner.fromX+1;runner.z=runner.fromZ+1;
runner.moveDuration=.5;runner.moveElapsed=.25;runner.action='walk';
runner.hitFlash=.2;
assert.equal(massGaitActive(runner),true,'received damage does not freeze running');
const raw={x:(runner.fromX-6+.5)*2.2,y:1,z:(runner.fromZ-6+.5)*2.2};
const a=sampleMassVisualMotion(runner,raw,1,.016,2.2);
const phase=a.phase;
assert.ok(Number.isFinite(phase)&&phase>=0&&phase<Math.PI*2);
runner.action='hit';
assert.equal(massGaitActive(runner),true,'hit action cannot override active gait');
runner.action='idle';runner.moveElapsed=runner.moveDuration;
assert.equal(massGaitActive(runner),false,'only actual completed movement becomes idle');

const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const atlas=readFileSync(new URL('../src/crowd-impostor-atlas.js',import.meta.url),'utf8');
const character=readFileSync(new URL('../src/character-system/shared-character-runtime.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(gpu,/crowdGroundShift\(footAnchor,snapshots/);
assert.match(gpu,/applyCrowdGroundShift\(pose\|\|base\.slice\(\),shift\)/);
assert.doesNotMatch(gpu,/world\.y[^;]*-\.3\*eased/,
 'GPU body roots are NEVER submerged to simulate a hit/death');
assert.doesNotMatch(gpu,/Math\.PI\*\.47\*eased/,
 'do not rotate the ground-anchored corpse a second time');
assert.match(gpu,/vec3 runPose=mix\(neutralContact,swingContact/);
assert.match(gpu,/shoeMask=1\.0-smoothstep/);
assert.match(gpu,/massGaitActive\(u\)/);
assert.match(gpu,/shared\.motion=new THREE\.InstancedBufferAttribute|motion:new THREE\.InstancedBufferAttribute/,
 'the batched motion buffer remains a single vec4');
assert.match(atlas,/const RUN_FRAMES=4,ROWS=RUN_FRAMES\+2/);
assert.match(atlas,/new THREE\.WebGLRenderTarget\(tileSize\*GRID,tileSize\*ROWS/);
assert.match(atlas,/const locomotion='run'/,'ALL jobs use dash');
assert.match(atlas,/const poses=\[\['idle',\.01\],\.\.\.Array\.from\(\{length:RUN_FRAMES\}/);
assert.match(atlas,/float runRow=1\.0\+min\(3\.0,floor\(phase\*0\.63661977\)\)/);
assert.doesNotMatch(atlas,/vec4 nextFrame=texture2D/,'no transparent duplicate soldier');
assert.match(character,/const groundedImpactY=impact\?Math\.max\(baselineY-height\*\.012,desiredY\):desiredY/);
assert.match(page,/const floor=unitGroundY\(u,out\.x,out\.z\)/);
console.log('PASS: hit and death grounded, four dash frames per two steps, GPU shoe-lock, zero extra draw calls');
