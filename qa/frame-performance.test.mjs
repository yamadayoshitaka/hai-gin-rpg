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
console.log('FPS monitor: rolling frame time / P95 / WebGL GPU timer fallback OK');
