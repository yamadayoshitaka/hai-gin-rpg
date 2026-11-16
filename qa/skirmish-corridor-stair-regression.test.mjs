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
 const dx=step.next.x-position.x,dz=step.next.z-position.z;
 assert.equal(Math.max(Math.abs(dx),Math.abs(dz)),1,
  'one legal cardinal/diagonal cell is traversed per step');
 if(dx&&dz)assert.ok(valid(position.x+dx,position.z)&&valid(position.x,position.z+dz),
  'the 50v50 route cannot cut a corner at the blocked wall');
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

// Bridge congestion must reuse an established route instead of running a
// full A* every 50ms while the same legal first cell remains occupied.
let routeChecks=0,bridgeQueueState=null,bridgeNext=null;
const bridgeLane=(x,z)=>{routeChecks++;return z===1&&x>=0&&x<=14;};
for(let t=0;t<12;t++){
 const result=stableGridNext(bridgeQueueState,{x:1,z:1},{x:12,z:1},{
  walkable:bridgeLane,occupied:(x,z)=>x===2&&z===1,
  now:t*.05,waitSeconds:.7,maxExpanded:8000
 });
 bridgeQueueState=result.state;bridgeNext=result.next;
 assert.equal(bridgeNext,null,'occupied bridge tile must never be crossed');
 if(t===0)assert.ok(routeChecks>0,'first request plans a real route');
 if(t===1)var firstRouteChecks=routeChecks;
}
assert.ok(routeChecks<=firstRouteChecks+3,
 'one stationary bridge queue must not rebuild A* every AI tick');
const released=stableGridNext(bridgeQueueState,{x:1,z:1},{x:12,z:1},{
 walkable:bridgeLane,occupied:()=>false,now:.65,waitSeconds:.7
});
assert.deepEqual(released.next,{x:2,z:1},
 'the queued soldier resumes immediately when the legal tile clears');
assert.match(game,/const result=incrementalStableGridNext\(actor\._exitRoute/,
 '50v50 bridge and doorway routing must use a persistent collision-safe cache');
assert.match(game,/if\(\(a\.cell\.x-center\)\*a\.crossing\.fromSide<=-10\)/,
 'land-side bridge traffic may move into a legal side lane, not the river');
assert.match(game,/if\(!traversableCell\(a\.cell\.x,nz,a\)\|\|!availableCell\(a\.cell\.x,nz,a\)\)continue/,
 'far-bank side-step must validate traversability and occupancy');

console.log('PASS: corridors, stable bottleneck waiting, fractional stair entry, no reverse wandering');
