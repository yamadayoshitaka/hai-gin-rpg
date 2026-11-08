import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {massLocomotionKind,massGpuMotionCode,massDashCoverage}
 from '../src/mass-dash-parity.js';
import {selectMassBattleMotion} from '../src/character-system/battle-motion-policy.js';
import {massGaitActive} from '../src/mass-visual-motion.js';
import {MASS_MOVEMENT_SCALE,MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {resolveJobMotion} from '../src/character-system/job-motion-source.js';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const jobMotion=JSON.parse(read('../job-command-motion-map.json')).jobs;
const names=Object.keys(jobMotion);
assert.ok(names.length>=10,'entire mass army roster uses real rig animation clips');
for(const name of names){
 const clip=resolveJobMotion(jobMotion,name,'run');
 assert.ok(clip?.available,name+' must have actual RUN source');
 assert.match(clip.clip,/^Running(?:_|$)/,name+' must not use Walking_A or Sneaking');
}
assert.equal(MASS_MOVEMENT_SCALE,.88,'50v50 and 1000v1000 keep same ground speed scale');

const u={id:7,alive:true,action:'walk',highGroundPhase:0,mountId:null,
 completedSteps:4,moveElapsed:.18,moveDuration:.36,hitFlash:.6};
assert.equal(massGaitActive(u),true);
assert.equal(massLocomotionKind(u),'run');
assert.equal(massGpuMotionCode(u,{striking:false}),1);
assert.equal(selectMassBattleMotion(u,3.1,10).state,'run',
 '24 detailed units use the same real RUN as 50v50 even during a hit');
for(const action of ['walk','attack','skill','idle','advance']){
 u.action=action;u.moveElapsed=.18;u.hitFlash=.6;
 assert.equal(massLocomotionKind(u),'run','physical movement overrides AI '+action);
 assert.equal(massGpuMotionCode(u,{striking:true}),1);
}
u.action='walk';u.moveElapsed=.36;
assert.equal(massLocomotionKind(u),'run',
 'last contact frame stays in RUN instead of resetting gait at every cell');
u.highGroundPhase=1;u.moveDuration=0;u.action='walk';
assert.equal(massLocomotionKind(u),'walk','only actual stair tread uses WALK');
assert.equal(massGpuMotionCode(u),1.25,'GPU slows to cautious gait on stairs');
assert.equal(selectMassBattleMotion(u,3.1,10).state,'walk');
u.highGroundPhase=0;u.action='blocked';
assert.equal(massLocomotionKind(u),'idle','blocked troops do not run on the spot');
u.moveElapsed=0;u.moveDuration=0;u.action='idle';
assert.equal(massLocomotionKind(u),'idle');
u.mountId=33;
assert.equal(massLocomotionKind(u),'mounted');
assert.equal(massGpuMotionCode(u),5);
u.mountId=null;u.alive=false;
assert.equal(massLocomotionKind(u),'dead');
assert.equal(massGpuMotionCode(u),4);

const copies=Array.from({length:75},(_,i)=>({
 ...u,id:i,alive:true,mountId:null,highGroundPhase:i<3?1:0,
 moveDuration:.5,moveElapsed:.2,action:'walk'
}));
assert.deepEqual(massDashCoverage(copies),{
 dash:72,stairs:3,other:0,locomoting:75,dashPercent:96
},'normal outdoor movement is overwhelmingly dash, stairs are exceptions');

const sim=new MassBattleGridSimulation(1000,20261109,{
 width:232,height:232,walkable:new Uint8Array(232*232).fill(1),
 bridges:[],riverXAt:()=>116
});
const member=sim.units.find(s=>s.alive&&!s.isStrategist);
assert.ok(member,'one representative of 2000 full units exists');
member.action='walk';member.moveDuration=.4;member.moveElapsed=.2;
assert.equal(massGpuMotionCode(member),1,'full 1000v1000 uses the RUN action');
sim.step(.1);
assert.equal(member.alive,true,'simulation is still authoritative (no motion-only deaths)');

const gpu=read('../src/mass-battle-real-army.js');
const atlas=read('../src/crowd-impostor-atlas.js');
const game=read('../tactics-wireframe.html');
const policy=read('../src/character-system/battle-motion-policy.js');
assert.match(gpu,/const locomotion='run'/,
 'GPU samples the real run, not a walk sped up');
assert.match(gpu,/await capture\(locomotion,\.18,'crowdWalkA'\)/,
 'no fall back from true RUN to walking during first GPU bake');
assert.match(gpu,/await capture\(locomotion,\.55,'crowdWalkB'\)/);
assert.doesNotMatch(gpu,/capture\(locomotion[^\n]*'walk'/,
 'two GPU pose samples may never use a Walking_A fallback');
assert.match(gpu,/capturedClip=representative\.character\.diagnostics/);
assert.match(gpu,/const motionCode=massGpuMotionCode\(u,\{striking\}\)/,
 'all mass GPU visible soldiers use same dash policy');
assert.match(gpu,/get visibleDashSoldiers\(\)/);
assert.match(gpu,/get visibleStairWalkSoldiers\(\)/);
assert.match(gpu,/runCaptureCoverage\(\)/);
assert.match(gpu,/try\{\s*impostorAsset=await captureCrowdImpostorAtlas/,
 'if RUN atlas is unavailable retain dressed 3D GPU soldiers');
assert.doesNotMatch(atlas,/if\(!played&&state==='run'\)played=await actor\.character\.play\('walk'\)/,
 'distance GPU render must never turn failed RUN into WALK');
assert.match(atlas,/RUNの実モーションではありません/,
 'capture explicitly checks real Running_A/HoldingBow');
assert.match(policy,/massLocomotionKind\(unit\)==='walk'\?'walk':'run'/,
 'detailed 1000v1000 uses dash unless taking a stair');
assert.match(game,/window\.getMassDashReport/,
 'browser exposes actual visible mass dash/stair ratio');
assert.match(game,/actionVfx\.emit\('run',\{position:a\.root\.position/,
 'running dust/audio matches actual dash instead of walk');
assert.match(game,/const fallback=state==='run'\?'idle':/,
 'no detailed run-to-walk fallback');

console.log('PASS: every 1000v1000 combat job uses a real run, GPU/detailed/LOD share dash, stairs walk and diagnostics count visible units');
