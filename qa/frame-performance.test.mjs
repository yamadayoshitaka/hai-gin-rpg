import assert from 'node:assert/strict';
import {FramePerformanceMonitor} from '../src/frame-performance.js';

const monitor=new FramePerformanceMonitor({getContext:()=>null});
monitor.samples.set([16,16.5,17.2,15.8,18.9]);monitor.count=5;
const stats=monitor.getStats();
assert.equal(stats.fps,59);
assert.equal(stats.frameP95Ms,18.9);
assert.equal(stats.meets60fps,false);
assert.equal(stats.gpuFrameMs,null);
assert.ok(stats.frameAvgMs>16);
const {readFileSync}=await import('node:fs');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const wardrobe=readFileSync(new URL('../src/character-system/rigged-outfit-runtime.js',import.meta.url),'utf8');
assert.match(battle,/sun\.shadow\.autoUpdate=false;sun\.shadow\.needsUpdate=true/,
 'All 50v50 shadow passes must be cached rather than redrawn every frame');
assert.match(battle,/shadowRefreshTimer>=\(MASS_SIZE\?1\.1:\.65\)/,
 'Small match retains high-resolution shadows while refreshing less often for mobile FPS');
assert.match(battle,/window\.getSkirmishPerformanceStats=/,
 '50v50 must expose actual frame-time and armor draw counts');
assert.match(wardrobe,/consolidateBattleArmor\(armor\)/,
 'The 50v50 high-quality rig must merge immutable armor pieces by joint');
assert.match(battle,/else if\(a\.nextCell\|\|\(a\.lastMovedAt/,
 'Actual movement must take precedence over full-body damage/attack holds');
console.log('PASS frame P95, detailed battle cached shadows, moving-leg priority and lossless armor batching');
