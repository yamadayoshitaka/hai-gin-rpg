import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {incrementalStableGridNext,createGridRoutingBudget,findStableGridPath}
 from '../src/battle-stable-grid-route.js';

// Actual occupied soldiers remain hard-blocked at commit time. A* can plan
// through temporary crowds at added cost, but cannot cross a stone wall.
const width=19,height=13,blocked=new Set();
for(let z=0;z<12;z++)if(z!==11)blocked.add('8,'+z);
const valid=(x,z)=>x>=0&&z>=0&&x<width&&z<height&&!blocked.has(x+','+z);
const start={x:3,z:2},goal={x:15,z:2};
const expected=findStableGridPath(start,goal,{walkable:valid,maxExpanded:8000});
assert.ok(expected?.some(p=>p.z===11),'the baseline route must use the real gate');
let state=null,current={...start},total=0,firstStepAt=-1;
for(let tick=0;tick<500;tick++){
 const budget=createGridRoutingBudget(8);
 const result=incrementalStableGridNext(state,current,goal,{walkable:valid,now:tick*.05,budget});
 assert.ok(budget.expanded<=8,'A* never exceeds shared frame budget');
 assert.ok(budget.remaining>=0);
 total+=budget.expanded;
 state=result.state;
 if(result.arrived)break;
 if(result.next){
  if(firstStepAt<0)firstStepAt=tick;
  const dx=result.next.x-current.x,dz=result.next.z-current.z;
  assert.ok(Math.abs(dx)<=1&&Math.abs(dz)<=1,'never teleport');
  if(dx&&dz)assert.ok(valid(current.x+dx,current.z)&&valid(current.x,current.z+dz),'no diagonal corner cut');
  current={...result.next};
 }
}
assert.ok(firstStepAt>0,'large A* path work was actually spread across AI ticks');
assert.ok(total>8,'search resumed a preserved frontier rather than calculating everything at once');
assert.deepEqual(current,goal,'incremental planner completes complex detour');

// Three simultaneous soldiers share ONE quota instead of getting 8k each.
let sharedBudget=createGridRoutingBudget(7);
for(let i=0;i<3;i++)
 incrementalStableGridNext(null,{x:2,z:2+i},{x:16,z:2+i},{
  walkable:valid,now:0,budget:sharedBudget
 });
assert.ok(sharedBudget.expanded<=7);
assert.ok(sharedBudget.deferred>=1,'deferred route work is visible in diagnostics');

// A full bridge will not be crossed merely because a path exists.
const narrow=(x,z)=>z===1&&x>=0&&x<=9;
let waitState=null,waitNext=null;
for(let tick=0;tick<100;tick++){
 const step=incrementalStableGridNext(waitState,{x:1,z:1},{x:8,z:1},{
  walkable:narrow,occupied:(x,z)=>x===2&&z===1,
  now:tick*.05,budget:createGridRoutingBudget(12)
 });
 waitState=step.state;waitNext=step.next;
 assert.equal(waitNext,null,'occupied bridge requires waiting, no collision teleport');
}
let resumed=null;
for(let tick=100;tick<150;tick++){
 const step=incrementalStableGridNext(waitState,{x:1,z:1},{x:8,z:1},{
  walkable:narrow,occupied:()=>false,now:tick*.05,
  budget:createGridRoutingBudget(12)
 });
 waitState=step.state;
 if(step.next){resumed=step.next;break;}
}
assert.deepEqual(resumed,{x:2,z:1},'releasing the lane restores a legal forward step');

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/skirmishGridRoutingBudget=createGridRoutingBudget\(320\)/);
assert.match(game,/budget:skirmishGridRoutingBudget/);
assert.match(game,/incrementalStableGridNext\(a\._stableMovementPath/);
assert.match(game,/incrementalStableGridNext\(actor\._exitRoute/);
assert.match(game,/!routeOccludedByTerrain\(actor\.cell,target,actor\)/,
 'open lanes use collision-checked cheap direct steps');
assert.match(game,/\'｜経路 \'\+skirmishGridRoutingBudget\.expanded/,
 'the HUD reports nodes expanded this frame');
console.log('PASS: 50v50 incremental A*, exact terrain/collision, common CPU budget, fair frontier continuation');
