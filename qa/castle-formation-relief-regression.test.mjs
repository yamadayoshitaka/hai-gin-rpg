import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {
 reachableRoomExit,reachableFormationWaypoint,
 sharedRoomExitFlow,sharedRoomExitStep
} from '../src/formation-ai-indoor-route.js';

const width=64,height=64,walkable=new Uint8Array(width*height).fill(1);
const index=(x,z)=>z*width+x;
for(let z=8;z<=31;z++)for(let x=8;x<=31;x++)
 if(x===8||x===31||z===8||z===31)walkable[index(x,z)]=0;
for(let x=19;x<=21;x++)walkable[index(x,31)]=1;
const pass=(x,z)=>x>=0&&z>=0&&x<width&&z<height&&walkable[index(x,z)]===1;
const bounds={minX:8,maxX:31,minZ:8,maxZ:31};
const start={x:12,z:12},target={x:20,z:40};
const door=reachableRoomExit(start,bounds,pass,{limit:16000});
assert.ok(door&&door.z===31&&door.x>=19&&door.x<=21,
 'castle inside route must leave through a real southern gateway');
assert.deepEqual(reachableFormationWaypoint(start,target,pass),
 target,'formation waypoint must be connected through the castle exit');
const field=sharedRoomExitFlow(width,height,pass,[{x:19,z:31},{x:20,z:31},{x:21,z:31}]);
assert.ok(field&&field[index(start.x,start.z)]<0x3fffffff);
let cursor={...start},last=field[index(cursor.x,cursor.z)];
for(let step=0;step<90&&last>0;step++){
 const next=sharedRoomExitStep(cursor,field,width,height,pass);
 assert.ok(next,'castle soldier must find a decreasing route to the actual gate');
 assert.ok(pass(next.x,next.z),'castle exit cannot walk through masonry');
 const distance=field[index(next.x,next.z)];
 assert.ok(distance<last,'castle path must always advance, never oscillate');
 cursor=next;last=distance;
}
assert.equal(last,0,'castle soldier must reach the real gate');
assert.equal(cursor.z,31);
assert.ok(cursor.x>=19&&cursor.x<=21);
const queued={x:20,z:30};
const busy=sharedRoomExitStep(queued,field,width,height,
 (x,z)=>pass(x,z)&&!(z===31&&x>=19&&x<=21));
assert.equal(busy,null,'a crowded gate waits rather than reversing through a wall');

const closed=walkable.slice();
for(let x=19;x<=21;x++)closed[index(x,31)]=0;
const noGate=(x,z)=>x>=0&&z>=0&&x<width&&z<height&&closed[index(x,z)]===1;
assert.equal(reachableRoomExit(start,bounds,noGate,{limit:16000}),null,
 'a sealed castle never uses a synthetic doorway');
assert.equal(reachableFormationWaypoint(start,target,noGate,{maxOffset:3}),null,
 'formation attack cannot select an unreachable outside waypoint');

const size=232;
const free=new Uint8Array(size*size).fill(1);
const fog=new Uint8Array(size*size);
for(let z=10;z<=30;z++)for(let x=10;x<=30;x++)
 if(x===10||x===30||z===10||z===30){free[z*size+x]=0;fog[z*size+x]=1;}
free[30*size+20]=1;fog[30*size+20]=0;
const sim=new MassBattleGridSimulation(50,20261124,{
 width:size,height:size,walkable:free,opaque:fog,bridges:[],riverXAt:()=>116
});
const intended=sim.units.find(u=>u.team===1&&!u.isStrategist);
assert.ok(intended);
for(const unit of sim.units)if(unit.team===1&&unit!==intended){
 unit.alive=false;unit.hp=0;
}
intended.x=20;intended.z=19;intended.fromX=20;intended.fromZ=19;
const pursuit=sim._enemyPursuitFlow(0,'sword');
assert.ok(pursuit,'castle survivors must remain a valid elimination target');
assert.ok(pursuit[9*size+20]<0x3fffffff,
 'elimination route must reach a soldier through the real castle gate');
assert.ok(pursuit[9*size+20]>0,'outside castle is not an attack arrival point');
const reverse=sim._enemyPursuitFlow(1,'sword');
assert.ok(reverse,'opposing army must retain an independent pursuit budget');
assert.deepEqual(sim._enemyBuildsPerTeam,[1,1],
 'one team may not consume the entire opponent path budget');

const source=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(source,/sharedCastleExit\(a,bounds\)/,
 'the live skirmish must use shared castle routing');
assert.match(source,/const castleIndoorBounds=townBuildings\.filter/,
 'castle path bounds must use authored building geometry');
assert.match(source,/reachableFormationWaypoint\(origin,goal/,
 'formation waypoints must follow connected grid cells');
assert.match(source,/const realUnit=squadRoster\.find/,
 'formation path must start from actual living soldier, not centroid through a wall');
assert.match(source,/const nearbyCounter=enemy&&shouldCounterNearbyThreat/,
 'local combat approach remains active for defenders');
assert.match(source,/allyRelief=true/,
 'real guarding skirmish squads must be allowed to reinforce nearby teammates');
console.log('PASS: castle gateway shared flow, formation connectedness, symmetric assault pursuit and ally relief');
