import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BattlePhaseProfiler} from '../src/battle-phase-profiler.js';

const p=new BattlePhaseProfiler({windowSize:4});
assert.equal(p.getStats().ai.avg,0,'empty profile is valid');
for(const ms of [10,20,30,40,50])p.record('ai',ms);
p.record('rig',16.25);
p.record('submit',3.5);
p.record('invalid',42);
p.record('ai',NaN);
const stats=p.getStats();
assert.equal(stats.ai.avg,35,'bounded rolling profile discards old frames');
assert.equal(stats.ai.p95,50,'long AI stalls remain visible');
assert.equal(stats.rig.avg,16.25);
assert.equal(stats.submit.avg,3.5);
assert.equal(stats.scene.avg,0);
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/const battleCpuProfiler=new BattlePhaseProfiler\(\)/);
for(const phase of ['ai','scene','rig','objects','hud','submit'])
 assert.match(game,new RegExp("battleCpuProfiler\\.record\\('"+phase+"'"),phase+' phase instrumented');
assert.match(game,/const useGpuFxaa=!TOWN_MODE&&\(MASS_SIZE>0\|\|battleParams\.get\('gpuFxaa'\)!=='0'\)/,
 'non-town Android skirmish can use WebGL GPU FXAA with opt-out for QA');
assert.match(game,/const fxaaComposer=useGpuFxaa\?new EffectComposer\(renderer\):null/);
assert.match(game,/if\(!MASS_SIZE&&!TOWN_MODE\)return;/,
 '50v50 GPU framebuffer must not be reallocated during active combat');
assert.match(game,/renderer\.domElement\.addEventListener\('webglcontextlost'/,
 'actual GPU context loss is monitored separately from CPU frame stalls');
assert.match(game,/gpuLifecycle\.bufferResizes\+\+/,
 'drawing buffer reallocations are independently counted');
assert.match(game,/if\(typeof renderer\.compileAsync==='function'\)await renderer\.compileAsync\(scene,camera\)/,
 'shader compilation performed during long loading phase');
assert.match(game,/GPU '\+\(perf\.gpuFrameMs\?\?'--'\)/,
 'GPU query timing remains available where supported');
assert.match(game,/if\(visual\.update\)\{a\.character\.update/,
 'real full-body rig update is preserved; no new impostor for closeups');
console.log('PASS: GPU framebuffer stability, FXAA, context-loss monitoring and six CPU-phase diagnostics');
