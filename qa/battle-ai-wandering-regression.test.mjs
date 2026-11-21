import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {resolveDefensiveGuardIntent} from '../src/battle-defensive-doctrine.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

test('defenders return with hysteresis and never chase past the guard perimeter',()=>{
 const atEdge=resolveDefensiveGuardIntent({
  distanceFromPost:4.6,enemyDistanceFromPost:5.2,
  enemyDistance:3,attackRange:1.5
 });
 assert.equal(atEdge.returnToPost,false);
 assert.equal(atEdge.allowPursuit,false,'do not chase an enemy beyond the guarded perimeter');
 const forcedBack=resolveDefensiveGuardIntent({
  distanceFromPost:6.2,enemyDistanceFromPost:7,
  enemyDistance:4,attackRange:1.5
 });
 assert.equal(forcedBack.returnToPost,true);
 const stillReturning=resolveDefensiveGuardIntent({
  distanceFromPost:4,returning:true,enemyDistance:Infinity
 });
 assert.equal(stillReturning.returnToPost,true,'keep returning past the old oscillation boundary');
 assert.equal(resolveDefensiveGuardIntent({
  distanceFromPost:3,returning:true,enemyDistance:Infinity
 }).returnToPost,false,'re-enter attack mode only inside the safe inner radius');
 assert.equal(resolveDefensiveGuardIntent({
  distanceFromPost:6.5,enemyDistanceFromPost:7,
  enemyDistance:.8,attackRange:1.5
 }).allowPursuit,true,'a soldier can still strike an enemy already in weapon range');
});

const size=90;
const make=()=>new MassBattleGridSimulation(1,20261122,{
 width:size,height:size,walkable:new Uint8Array(size*size).fill(1),
 bridges:[],riverXAt:()=>size/2
});

test('guard and hold orders do not wander before the enemy enters range',()=>{
 for(const mode of ['defend','hold']){
  const sim=make(),unit=sim.units.find(u=>u.team===0);
  const start=[unit.x,unit.z];
  assert.equal(sim.setSquadCommand(unit.squadId,mode,0),true);
  for(let i=0;i<35;i++)sim.step(.1);
  assert.deepEqual([unit.x,unit.z],start,mode+' is a stationary command');
 }
});

test('idle soldiers stop on the shared navigation goal instead of circling it',()=>{
 const sim=make(),unit=sim.units.find(u=>u.team===0);
 const enemy=sim.units.find(u=>u.team===1);
 const initialX=unit.x;
 // Isolate navigation from combat; victory UI stops the game in production,
 // while the deterministic simulator itself can still be stepped directly.
 enemy.alive=false;enemy.hp=0;sim.live[1]=0;
 const visited=[];
 for(let i=0;i<1100;i++){
  sim.step(.1);
  if(i>=980)visited.push(unit.x+','+unit.z);
 }
 assert.ok(unit.x>initialX+10,'assault formation still advances toward the front');
 assert.equal(new Set(visited).size,1,'the reached BFS goal remains a stationary post');
 assert.equal(unit.action,'hold');
});

test('both real-time and Worker entrypoints use updated anti-wander logic',()=>{
 const source=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
 assert.match(page,/resolveDefensiveGuardIntent\(/);
 assert.match(source,/if\(here===0&&!nearest&&!taskNeedsApproach\)/);
 assert.match(source,/rawFlow>=here\)continue/);
 assert.match(worker,/mass-battle-grid-sim\.js\?v=20261122-cell-pingpong2/);
 assert.match(page,/mass-battle-grid-sim\.js\?v=20261122-cell-pingpong2/);
});
