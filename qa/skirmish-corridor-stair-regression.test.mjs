import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findStableGridPath,stableGridNext,sameNavigationCell,stableGridGoalCell}
 from '../src/battle-stable-grid-route.js';

// Regression for the 50v50 village corridors: a winding room exit requires
// moving away from the goal briefly, but must not reverse tile-to-tile.
const width=13,height=11;
const blocked=new Set();
for(let z=0;z<=9;z++)if(z!==9)blocked.add('5,'+z);
const valid=(x,z)=>x>=0&&z>=0&&x<width&&z<height&&!blocked.has(x+','+z);
const start={x:2,z:2},goal={x:9,z:2};
const path=findStableGridPath(start,goal,{walkable:valid,maxExpanded:4000});
assert.ok(path?.length>10,'a corridor with a solid wall must route via the real gap');
assert.ok(path.some(p=>p.z===9),'the route must follow the open doorway');
let state=null,position={...start},visited=new Set([position.x+','+position.z]);
for(let t=0;t<path.length+3;t++){
 const step=stableGridNext(state,position,goal,{walkable:valid,now:t*.2});
 state=step.state;
 if(step.arrived)break;
 assert.ok(step.next,'an unobstructed corridor has a valid next step');
 assert.equal(Math.abs(step.next.x-position.x)+Math.abs(step.next.z-position.z),1,
  'only one orthogonal cell is traversed each step');
 position={...step.next};
 const current=position.x+','+position.z;
 assert.ok(!visited.has(current),'a fixed corridor route never walks backwards to a visited tile');
 visited.add(current);
}
assert.ok(sameNavigationCell(position,goal),'unit reached the enemy-side goal');

// Congestion: one soldier holds a one-cell doorway for two seconds.
// Do NOT change the path to random left/right sidesteps each AI frame.
const narrow=(x,z)=>x>=0&&x<=8&&z===1;
let current={x:1,z:1},queue=null,moveCount=0;
for(let frame=0;frame<8;frame++){
 const step=stableGridNext(queue,current,{x:7,z:1},{
  walkable:narrow,occupied:(x,z)=>x===2&&z===1,now:frame*.2,waitSeconds:2
 });
 queue=step.state;
 assert.equal(step.next,null,'an occupied doorway must be waited out');
 assert.equal(step.blocked,true);
 assert.deepEqual(current,{x:1,z:1},'a waiting unit must not pace back and forth');
}
for(let frame=8;frame<18;frame++){
 const step=stableGridNext(queue,current,{x:7,z:1},{
  walkable:narrow,occupied:()=>false,now:frame*.2
 });
 queue=step.state;
 if(step.arrived)break;
 if(step.next){current={...step.next};moveCount++;}
}
assert.equal(moveCount,6,'a freed corridor is crossed in six forward steps');
assert.deepEqual(current,{x:7,z:1});

// Old stair code tested fractional world distance even after A* had reached
// the correct grid tile, then timed out and restarted its approach.
const CELL=2.2,offset=6,stairCell={x:20,z:18};
const stageWorld={x:(20-offset)*CELL+.94,z:(18-offset)*CELL-.89};
assert.ok(sameNavigationCell(stairCell,stableGridGoalCell(stageWorld,CELL)),
 'a stair landing with a fractional sub-cell offset is already reached');
assert.deepEqual(findStableGridPath(stairCell,stairCell,{walkable:()=>true}),[],
 'same-cell A* is an arrival, not an impossible route');

// Ensure gameplay uses the tested path/entry contract rather than retaining
// old reverse-greedy movement or a distance-only stair trigger.
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/function stableActorRouteStep\(a,goal/);
assert.match(game,/const route=stableActorRouteStep\(a,pathGoal\)/);
assert.match(game,/dist<before-\.01&&dist<best/);
assert.match(game,/function stairStageHasClearIngress\(/);
assert.match(game,/sameNavigationCell\(a\.cell,gridFromWorld\(target\)\)/);
assert.match(game,/if\(!paused&&!finished&&!a\.floorTravel\)moveActor\(a,goal,0,stop\)/,
 'stair controller must not accidentally call ordinary greedy movement');
console.log('PASS: corridors, stable bottleneck waiting, fractional stair entry, no reverse wandering');
