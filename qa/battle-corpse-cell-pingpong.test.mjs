import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {chooseBlockedMovementDetour} from '../src/battle-movement-recovery.js';

test('a fallen soldier remains drawable but releases the physical grid cell',()=>{
 const width=90,height=90;
 const sim=new MassBattleGridSimulation(1,20261122,{
  width,height,walkable:new Uint8Array(width*height).fill(1),
  bridges:[],riverXAt:()=>45
 });
 sim.step(.1);
 const soldier=sim.units.find(u=>u.team===0),cell=soldier.z*width+soldier.x;
 const coords={x:soldier.x,z:soldier.z};
 sim.killAtCells(new Set([coords.x+','+coords.z]));
 assert.equal(soldier.alive,false);
 assert.ok(soldier.deathAt>=0,'corpse stays available for the death animation');
 assert.notEqual(sim._occupancy[cell],soldier.id,
  'dead soldier releases its tile immediately without waiting for the next AI tick');
 sim.step(.1);
 assert.notEqual(sim._occupancy[cell],soldier.id,'dead soldier must not reserve its old cell');
 const display=sim.getRenderCell(soldier);
 assert.ok(Number.isFinite(display.x)&&Number.isFinite(display.z));
 assert.ok(Math.abs(display.x-soldier.deathX)<.001);
 assert.ok(Math.abs(display.z-soldier.deathZ)<.001);
});

test('blocked detour never chooses the previous tile even if it looks closer to goal',()=>{
 const current={x:10,z:10};
 const result=chooseBlockedMovementDetour({
  ...current,goalX:1,goalZ:10,previousX:9,previousZ:10,
  neighbors:[{x:9,z:10,flow:2,escape:true},{x:10,z:11,flow:3,escape:true}],
  currentFlow:4,requireEscape:true
 });
 assert.deepEqual(result,{x:10,z:11});
});

test('army waits when the only sideways cell returns to the same dead end',()=>{
 const options={
  x:10,z:10,goalX:20,goalZ:10,previousX:9,previousZ:10,
  currentFlow:6,requireEscape:true
 };
 assert.equal(chooseBlockedMovementDetour({
  ...options,neighbors:[{x:10,z:11,flow:7,escape:false}]
 }),null,'a no-exit sidestep cannot start A-B-A oscillation');
 assert.deepEqual(chooseBlockedMovementDetour({
  ...options,neighbors:[{x:10,z:11,flow:7,escape:true}]
 }),{x:10,z:11},'legal two-step detours remain possible');
 assert.equal(chooseBlockedMovementDetour({
  ...options,neighbors:[{x:9,z:10,flow:1,escape:true}]
 }),null,'blocked return stays blocked even if its temporary cost looks good');
});

test('both Worker and browser battle use the collision-aware monotonic nav',()=>{
 const simSource=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const recovery=readFileSync(new URL('../src/battle-movement-recovery.js',import.meta.url),'utf8');
 assert.match(simSource,/if\(!u\.alive\)continue;/);
 assert.match(simSource,/if\(rawFlow>=here&&!higherStep\)continue;/);
 assert.match(simSource,/requireEscape:true/);
 assert.match(simSource,/escape=true;break;/);
 assert.match(recovery,/if\(reverse\)continue;/);
 assert.match(worker,/mass-battle-grid-sim\.js\?v=20261122-cell-pingpong2/);
 assert.match(page,/mass-battle-grid-sim\.js\?v=20261122-cell-pingpong2/);
 assert.match(page,/battle-movement-recovery\.js\?v=20261122-cell-pingpong2/);
 assert.match(page,/neighbors:exitCandidates,maxWorsening:1,requireEscape:true/,
  'skirmish crowded doors must verify a second-step escape');
 assert.doesNotMatch(page,/if\(alternate&&startCellMove/,
  'bridges must no longer have an immediate back-and-forth side scan');
 assert.match(page,/occupiedCells\.get\(cellKey\(a\.cell\.x,a\.cell\.z\)\)===a\)occupiedCells\.delete/);
});
