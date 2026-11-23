import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {buildSkirmishAssaultFlow,nextSkirmishAssaultStep,ASSAULT_FLOW_UNREACHABLE}
 from '../src/battle-skirmish-assault-flow.js';

const width=36,height=30;
const makeMap=()=>{
 const passable=new Uint8Array(width*height).fill(1);
 // Town's long stone fence. Only the physically open gateway at row 26
 // allows a legal route between the two armies.
 for(let z=0;z<height;z++)if(z!==26)passable[z*width+16]=0;
 return passable;
};

test('annihilation routes the whole squad around a stone fence through the actual gate',()=>{
 const passable=makeMap();
 const field=buildSkirmishAssaultFlow(width,height,passable,[{x:29,z:3}]);
 assert.ok(field,'an enemy-side route field is constructed');
 let cell={x:5,z:3},steps=0,usedGate=false,visited=new Set();
 while(field[cell.z*width+cell.x]>0&&steps<130){
  const next=nextSkirmishAssaultStep(cell,field,width,height,passable,
   (x,z)=>!!passable[z*width+x]);
  assert.ok(next,'a living attacker must progress even when the fence forces a long detour');
  assert.ok(field[next.z*width+next.x]<field[cell.z*width+cell.x],
   'every step strictly reduces remaining navigable distance');
  const dx=next.x-cell.x,dz=next.z-cell.z;
  if(dx&&dz)assert.ok(passable[cell.z*width+next.x]&&passable[next.z*width+cell.x],
   'a soldier cannot cut diagonally through two fence blocks');
  cell=next;steps++;
  const key=cell.x+','+cell.z;
  assert.ok(!visited.has(key),'no backwards/forwards oscillation');
  visited.add(key);
  if(cell.x===16&&cell.z===26)usedGate=true;
 }
 assert.ok(usedGate,'the unit crosses the only actual opening in the stone fence');
 assert.ok(steps>40&&steps<130,'a long route finishes without the old per-unit A* expansion cap');
 assert.equal(field[cell.z*width+cell.x],0,'the soldier arrives beside a living enemy');
});

test('soldiers wait behind a closed gate and do not ghost across a fence',()=>{
 const passable=makeMap();
 passable[26*width+16]=0;
 const field=buildSkirmishAssaultFlow(width,height,passable,[{x:29,z:3}]);
 const start={x:5,z:3};
 assert.equal(field[start.z*width+start.x],ASSAULT_FLOW_UNREACHABLE);
 assert.equal(nextSkirmishAssaultStep(start,field,width,height,passable,
  (x,z)=>!!passable[z*width+x]),null);
});

test('occupation cannot force soldiers backwards or through another unit',()=>{
 const passable=makeMap(),field=buildSkirmishAssaultFlow(width,height,passable,[{x:29,z:3}]);
 const cell={x:5,z:3};
 const free=nextSkirmishAssaultStep(cell,field,width,height,passable,()=>true);
 assert.ok(free);
 const allBlocked=nextSkirmishAssaultStep(cell,field,width,height,passable,()=>false);
 assert.equal(allBlocked,null,'when all forward cells are occupied, wait instead of pacing');
 const deferred=nextSkirmishAssaultStep(cell,field,width,height,passable,
  (x,z)=>x!==free.x||z!==free.z);
 if(deferred)assert.ok(field[deferred.z*width+deferred.x]<field[cell.z*width+cell.x]);
});

test('the real 3-team command and skirmish runtime use the same assault path',()=>{
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(game,/buildSkirmishAssaultFlow\(WORLD_SIZE,WORLD_SIZE,passable,targets\)/);
 assert.match(game,/currentSkirmishDirective\(a\)\?\.mode==='charge'/);
 assert.match(game,/const attackStep=sharedSkirmishAssaultStep\(a\)/);
 assert.match(game,/const mode=strategy==='assault'\?'charge'/);
 assert.match(game,/skirmishAssaultFlowCache=new Map\(\)/);
});
