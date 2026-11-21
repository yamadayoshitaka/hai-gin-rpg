import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planSkirmishGroupDeployment} from '../src/battle-realtime-deployment.js';
import {aggregateBattleRpgTeams} from '../src/battle-rpg-squad-source.js';

const unit=(squadId,team,x,z)=>({squadId,team,x,z,
 cell:{x,z},hp:100,maxHp:100,alive:true});

test('whole command team deploys together in named 4x4 formation without mutating actors during planning',()=>{
 const actors=[unit('1',0,20,20),unit('1',0,21,20),unit('2',0,24,20),
  unit('2',0,25,20),unit('e',1,170,60)];
 const before=actors.map(a=>({...a.cell}));
 const plan=planSkirmishGroupDeployment(actors,{
  squadIds:['1','2'],formationCells:{1:0,2:15},team:0,x:56,z:55,
  homeRiverX:()=>120,passable:()=>true
 });
 assert.equal(plan.length,4);
 assert.deepEqual(actors.map(a=>a.cell),before,'planning must not move real actors');
 assert.equal(new Set(plan.map(p=>p.x+':'+p.z)).size,4,'no overlap');
 assert.ok(plan.every(p=>p.actor.team===0));
 const left=plan.filter(p=>p.actor.squadId==='1'),right=plan.filter(p=>p.actor.squadId==='2');
 assert.equal(left.length,2);
 assert.equal(right.length,2);
 assert.ok(Math.max(...left.map(p=>p.x))<Math.min(...right.map(p=>p.x)),
  'job formation orientation is preserved');
});
test('a blocked formation returns null with no partial deployment',()=>{
 const actors=[unit('1',0,20,20),unit('2',0,24,20)];
 const before=actors.map(a=>({...a.cell}));
 assert.equal(planSkirmishGroupDeployment(actors,{
  squadIds:['1','2'],formationCells:{1:0,2:15},team:0,x:55,z:60,
  homeRiverX:()=>120,passable:()=>false
 }),null);
 assert.deepEqual(actors.map(a=>a.cell),before);
});
test('enemy units deploy on enemy side, not allied territory',()=>{
 const actors=[unit('e1',1,180,50),unit('e2',1,185,50)];
 const positions=planSkirmishGroupDeployment(actors,{
  squadIds:['e1','e2'],team:1,x:175,z:50,homeRiverX:()=>120,passable:()=>true
 });
 assert.equal(positions.length,2);
 assert.ok(positions.every(p=>p.x>=129));
});
test('both armies report three command teams and preserve division HP and effects',()=>{
 const jobs=['剣士','騎士','僧侶','忍者','魔法使い','弓使い'];
 const ally=jobs.map((job,i)=>({team:0,id:String(i+1),job,alive:2,total:2,
  hp:80,maxHp:100,mp:10,maxMp:15,mode:'charge',effects:[]}));
 const enemy=jobs.map((job,i)=>({team:1,id:'e'+(i+1),job,alive:2,total:2,
  hp:60,maxHp:100,mp:8,maxMp:15,mode:'defend',
  effects:i===0?[{kind:'debuff',label:'防御低下'}]:[]}));
 const allyMapping=Object.fromEntries(ally.map((x,i)=>[x.id,Math.floor(i/2)+1]));
 const enemyMapping=Object.fromEntries(enemy.map((x,i)=>[x.id,Math.floor(i/2)+1]));
 const summary=aggregateBattleRpgTeams([...ally,...enemy],allyMapping,enemyMapping);
 assert.deepEqual(summary.filter(s=>s.team===0).map(s=>s.id),['team:1','team:2','team:3']);
 assert.deepEqual(summary.filter(s=>s.team===1).map(s=>s.id),['enemy-team:1','enemy-team:2','enemy-team:3']);
 assert.equal(summary.find(s=>s.id==='enemy-team:1').hp,120);
 assert.equal(summary.find(s=>s.id==='enemy-team:1').members.length,2);
 assert.equal(summary.find(s=>s.id==='enemy-team:1').effects[0].label,'防御低下');
});
