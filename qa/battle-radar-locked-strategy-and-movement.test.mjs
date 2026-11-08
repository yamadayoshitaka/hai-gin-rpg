import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseBlockedMovementDetour} from '../src/battle-movement-recovery.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {MASS_GRID_DIRECTIONS,massDiagonalClear} from '../src/mass-battle-directional-nav.js';

// A detour is only chosen from caller-supplied *legal and unoccupied* tiles.
// This guards crowded hut/bridge exits without allowing teleportation.
assert.deepEqual(chooseBlockedMovementDetour({
 x:10,z:10,goalX:14,goalZ:10,
 previousX:9,previousZ:10,
 neighbors:[{x:9,z:10},{x:10,z:9},{x:10,z:11}]
}),{x:10,z:9});
assert.equal(chooseBlockedMovementDetour({
 x:10,z:10,goalX:14,goalZ:10,neighbors:[]
}),null,'No legal step means wait without clipping through terrain');
assert.equal(chooseBlockedMovementDetour({
 x:10,z:10,goalX:Infinity,goalZ:10,neighbors:[{x:11,z:10}]
}),null,'Invalid goal cannot move a soldier');

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const grid=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
assert.match(html,/id="showAllySquadRibbon" type="checkbox" checked/);
assert.match(html,/id="showEnemySquadRibbon" type="checkbox" checked/);
assert.match(html,/ribbon\.hidden=!control\.checked/);
assert.match(html,/#allySquadRibbon\[hidden\],#enemySquadRibbon\[hidden\]\{display:none!important\}/);
assert.match(html,/id="lockedSquadStrategies"/);
assert.match(html,/refreshLockedSquadStrategyList\(\)/);
assert.match(html,/開戦後は変更不可/);
assert.match(html,/\$\('strategy'\)\.disabled=true/);
const strategyListener=html.match(/\$\('strategy'\)\.onchange=e=>\{([^}]+)\}/);
assert.ok(strategyListener);
assert.doesNotMatch(strategyListener[1],/setStrategy|lastGlobalOrderAt/);
const radarStart=html.indexOf("miniCanvas.addEventListener('pointerup',event=>{");
const radarEnd=html.indexOf('drawSquadMiniMap();\n});',radarStart);
assert.ok(radarStart>0&&radarEnd>radarStart);
const radarHandler=html.slice(radarStart,radarEnd);
assert.doesNotMatch(radarHandler,/openSquadTactics\(/,'Radar may move the camera, but must never open orders');
assert.match(radarHandler,/setBattleCamera\(/);
assert.match(html,/function recoverBlockedActor\(/);
assert.match(html,/recoverBlockedActor\(a,goal\)/);
assert.match(html,/if\(!enemy&&squadDirective\?\.mode!=='move'\)/);
assert.match(grid,/chooseBlockedMovementDetour\(/);
assert.match(grid,/u\.blockedTicks>=6/);
assert.match(grid,/occupied\[index\]!==-1/);
// A selected destination behind opaque walls or room furniture must not
// disappear from navigation when it is temporarily outside line of sight.
// The resulting shared BFS must route through a real opening, never through
// the blocked tiles or by teleportation.
const width=23,height=23,walkable=new Uint8Array(width*height).fill(1);
const opaque=new Uint8Array(width*height);
for(let z=0;z<21;z++){walkable[z*width+11]=0;opaque[z*width+11]=1;}
const routing=Object.create(MassBattleGridSimulation.prototype);
Object.assign(routing,{width,height,walkable,water:new Uint8Array(width*height),
 ninjaWalkable:walkable.slice(),opaque,time:1,_pursuitFlows:new Map(),
 _pursuitBuildsThisTick:0});
const invisibleGoal={x:18,z:8},start={x:4,z:8};
assert.equal(routing._canSee(start,invisibleGoal),false,'The physical wall blocks LOS');
const route=routing._pursuitFlow(invisibleGoal,'swordsman');
assert.ok(route&&route[start.z*width+start.x]<0x3fffffff,
 'The obstacle-aware route remains available behind a wall');
assert.equal(route[8*width+11],0x3fffffff,'The route never crosses the wall');
let at={...start},steps=0;
while(route[at.z*width+at.x]>0&&steps++<100){
 const current=route[at.z*width+at.x];
 const next=MASS_GRID_DIRECTIONS
  .map(([dx,dz])=>({x:at.x+dx,z:at.z+dz,dx,dz}))
  .filter(p=>p.x>=0&&p.z>=0&&p.x<width&&p.z<height&&
    walkable[p.z*width+p.x]&&
    massDiagonalClear(at.x,at.z,p.dx,p.dz,width,walkable)&&
    route[p.z*width+p.x]<current)
  .sort((a,b)=>route[a.z*width+a.x]-route[b.z*width+b.x])[0];
 assert.ok(next,'Each navigation step must reduce remaining path length');
 at=next;
}
assert.ok(steps<100&&route[at.z*width+at.x]===0,
 'Soldier reaches a legal visible tile via the opening at the end of the wall');
console.log('PASS: radar is navigation only, side labels toggle independently, strategy read-only, movement detour is collision-safe');
