import assert from 'node:assert/strict';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {WebGpuMassBattleEngine,MASS_WEBGPU_SHADER} from '../src/mass-battle-webgpu.js';
import {MASS_UNIT_FIELDS,MASS_UNIT_STRIDE,packMassUnits,applyMassUnits} from '../src/mass-battle-worker-protocol.js';

const width=232,height=232,walkable=new Uint8Array(width*height).fill(1);
const bridges=[{x:116,z:55},{x:116,z:116},{x:116,z:177}];
const sim=new MassBattleGridSimulation(50,20261105,{width,height,walkable,bridges,riverXAt:()=>116});
assert.equal(await WebGpuMassBattleEngine.create(sim,()=>116,null),null,'WebGPU未対応ならCPUに戻す');
assert.equal(MASS_UNIT_STRIDE,MASS_UNIT_FIELDS.length);
for(const [index,name] of MASS_UNIT_FIELDS.entries()){
  assert.ok(MASS_WEBGPU_SHADER.includes(`const F_${name.toUpperCase()}:u32=${index}u;`),
    `GPUとWorkerの状態フィールドが一致する: ${name}`);
}
for(const entry of ['reset','occupy','decide','commit'])
  assert.match(MASS_WEBGPU_SHADER,new RegExp(`fn ${entry}\\(`));
assert.match(MASS_WEBGPU_SHADER,/atomicMin\(&scratch\.data\[cells\(\)\+destination\],id\)/,
  '移動先の競合はGPU原子操作で排他する');
assert.match(MASS_WEBGPU_SHADER,/fn lineClear\(/,'壁・障害物の射線遮蔽がある');
assert.match(MASS_WEBGPU_SHADER,/F_DEATHAT/,'戦闘不能と転倒状態をGPUで更新する');
const copy=sim.units.map(u=>({...u}));
sim.units[0].order='retreat';sim.units[1].order='defend';sim.units[2].action='skill';
sim.units[2].mp=37;sim.units[2].skillPoseUntil=12;
applyMassUnits(copy,packMassUnits(sim.units).buffer);
assert.equal(copy[0].order,'retreat');assert.equal(copy[1].order,'defend');
assert.equal(copy[2].action,'skill');
assert.equal(copy[2].mp,37);assert.equal(copy[2].skillPoseUntil,12);
assert.equal(copy[0].x,sim.units[0].x);
console.log(`GPU compute contract: ${MASS_UNIT_STRIDE} fields, target/physics/attack/death kernels, atomic tile claims and CPU fallback OK`);
