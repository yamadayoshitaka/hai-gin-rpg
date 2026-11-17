import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interpolatedSkirmishCameraAnchor,createVisibilityWorkPacer} from '../src/battle-frame-pacing.js';
import {FramePerformanceMonitor} from '../src/frame-performance.js';

// The camera must follow what the player sees, not the 20Hz authoritative grid.
const actor={root:{position:{x:18,y:7,z:30}},_skirmishRender:{x:17.32,z:29.41}};
const out={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
assert.equal(interpolatedSkirmishCameraAnchor(actor,out),out);
assert.deepEqual([out.x,out.y,out.z],[17.32,7,29.41]);
assert.deepEqual(actor.root.position,{x:18,y:7,z:30},'physics position must be untouched');
delete actor._skirmishRender;
interpolatedSkirmishCameraAnchor(actor,out);
assert.deepEqual([out.x,out.y,out.z],[18,7,30],'falls back before first visual frame');
assert.equal(interpolatedSkirmishCameraAnchor(null,out),null);

// Three occlusion and cutaway jobs are no longer executed in the SAME frame.
const pacer=createVisibilityWorkPacer();
const jobs=[];
for(let time=0;time<=1000;time+=16){
 const index=pacer.pick(time,{near:true});
 if(index>=0)jobs.push({time,index});
}
assert.deepEqual(jobs.slice(0,3).map(x=>x.index),[0,1,2]);
assert.deepEqual(jobs.slice(0,3).map(x=>x.time),[0,48,80]);
const counts=pacer.stats.counts;
assert.ok(counts.every(x=>x>=6),JSON.stringify(counts));
assert.ok(jobs.every((job,i)=>i===0||job.time!==jobs[i-1].time));
const lowFps=createVisibilityWorkPacer();
for(let ms=0;ms<3600;ms+=100)lowFps.pick(ms,{near:false});
assert.ok(lowFps.stats.counts.every(x=>x>0),'low FPS cannot starve any occlusion task');

// Averages alone can hide a 100ms hitch among otherwise good frames.
const monitor=new FramePerformanceMonitor({getContext:()=>null},{windowSize:8});
monitor.samples.set([16,17,18,16,22,108,18,70]);
monitor.count=8;
const stats=monitor.getStats();
assert.equal(stats.longFrames50,2);
assert.equal(stats.longFrames80,1);
assert.equal(stats.frameMaxMs,108);
assert.ok(stats.frameP99Ms>=stats.frameP95Ms);

// Regression: no model/animation downgrade; existing render loop still animates.
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/interpolatedSkirmishCameraAnchor\(followed,skirmishCameraAnchor\)/);
assert.match(battle,/sceneVisibilityPacer\.pick\(now,/);
assert.match(battle,/if\(visual\.update\)\{[\s\S]*?a\.character\.update\(/);
assert.match(battle,/renderBattleFrame\(\);/);
assert.match(battle,/1000 対 1000/);
console.log('PASS: smooth camera anchor, frame-paced occlusion, P95/P99 hitch diagnostics and unchanged rig updates');
