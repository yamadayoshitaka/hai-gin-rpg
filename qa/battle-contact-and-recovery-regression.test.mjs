import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {makeBattleRpgStatusRows,aggregateBattleRpgTeams} from '../src/battle-rpg-squad-source.js';
import {rpgHudStateIcon} from '../src/battle-rpg-squad-hud.js';
import {chooseBlockedMovementDetour} from '../src/battle-movement-recovery.js';

const makeRows=(units,sums)=>makeBattleRpgStatusRows({
 units,sums:new Map(sums),allyIds:['a'],enemyIds:['b'],
 getJob:()=> '剣士',getMode:()=> 'charge'
});
const fighter=(team,squadId,x,z,more={})=>({
 team,squadId,x,z,hp:100,maxHp:100,alive:true,action:'walk',...more
});

test('an actual front-line melee contact marks BOTH squads despite distant centroids',()=>{
 const units=[fighter(0,'a',10,10),fighter(0,'a',-30,10),
  fighter(1,'b',12,10),fighter(1,'b',90,10)];
 const rows=makeRows(units,[['0:a',{n:2,total:2,hp:200,x:-20,z:20}],
  ['1:b',{n:2,total:2,hp:200,x:102,z:20}]]);
 assert.equal(rows[0].inContact,true);
 assert.equal(rows[1].inContact,true);
 const grouped=aggregateBattleRpgTeams(rows,{a:1},{b:1});
 assert.deepEqual(grouped.map(r=>r.inContact),[true,true]);
});

test('a misleading centroid must NOT mark squads engaged without nearby fighters',()=>{
 const rows=makeRows([fighter(0,'a',0,0),fighter(1,'b',40,0)],[
  ['0:a',{n:1,total:1,hp:100,x:0,z:0}],
  ['1:b',{n:1,total:1,hp:100,x:2,z:0}]]);
 assert.deepEqual(rows.map(r=>r.inContact),[false,false]);
});

test('ranged acquired enemy and a critical team show both engagement and SOS',()=>{
 const units=[fighter(0,'a',3,3,{action:'attack',currentTargetSquadId:7,hp:15}),
  fighter(1,'7',45,45)];
 const sums=new Map([['0:a',{n:1,total:1,hp:15,x:3,z:3}],
  ['1:7',{n:1,total:1,hp:100,x:45,z:45}]]);
 const rows=makeBattleRpgStatusRows({units,sums,allyIds:['a'],enemyIds:['7'],
  getJob:()=> '弓使い',getMode:()=> 'charge'});
 assert.deepEqual(rows.map(r=>r.inContact),[true,true]);
 assert.equal(rpgHudStateIcon(rows[0]),'🆘');
 const hud=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 assert.match(hud,/engaged\.hidden=!row\.inContact\|\|value==='⚔'/);
});

test('dead or vertically separated soldiers never create phantom contact',()=>{
 const units=[fighter(0,'a',10,10,{indoorFloor:2}),
  fighter(1,'b',11,10,{indoorFloor:1})];
 const sums=[['0:a',{n:1,total:1,hp:100,x:10,z:10}],
  ['1:b',{n:1,total:1,hp:100,x:11,z:10}]];
 assert.deepEqual(makeRows(units,sums).map(r=>r.inContact),[false,false]);
 assert.deepEqual(makeRows([fighter(0,'a',10,10,{alive:false,hp:0}),
  fighter(1,'b',11,10)],sums).map(r=>r.inContact),[false,false]);
});

test('route recovery is legal, and rally destination can resume pursuit',()=>{
 const legal=[{x:9,z:10},{x:10,z:11}];
 const result=chooseBlockedMovementDetour({
  x:10,z:10,goalX:15,goalZ:10,neighbors:legal,maxWorsening:1
 });
 assert.ok(result&&legal.some(p=>p.x===result.x&&p.z===result.z));
 assert.equal(chooseBlockedMovementDetour({
  x:10,z:10,goalX:15,goalZ:10,neighbors:[],maxWorsening:1
 }),null);
 const grid=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(grid,/const resumeCombat=assignedReached/);
 assert.match(grid,/\(!reachable\|\|resumeCombat\)/);
 assert.match(battle,/neighbors:legal\.filter\(cell=>!routeOccludedByTerrain\(cell,target,a\)\)/);
 assert.match(battle,/if\(!route\.state\?\.search\)recoverBlockedActor\(a,goal\)/);
});
