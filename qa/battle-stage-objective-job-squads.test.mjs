import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {objectiveForStage,evaluateBattleObjective} from '../src/battle-stage-objective.js';
import {uniformJobSquadPlan} from '../src/battle-uniform-job-squads.js';
import {createSquadFormationPlan} from '../src/mass-battle-formations.js';

// The 20 x 10 story stage types carry executable objective metadata.
assert.equal(CAMPAIGN_STAGES.length,200);
for(const stage of CAMPAIGN_STAGES){
 const objective=objectiveForStage(stage);
 assert.ok(['eliminate','defend_timer','capture_zone','siege'].includes(objective.type));
 if(stage.kind==='defend')assert.ok(objective.durationSeconds>=120&&objective.breachSeconds>0);
 if(stage.kind==='capture')assert.ok(objective.holdSeconds>0);
 if(stage.kind==='siege')assert.ok(objective.holdSeconds>0);
}
const defend=objectiveForStage({kind:'defend',difficulty:1});
const cap=objectiveForStage({kind:'capture',difficulty:8});
const siege=objectiveForStage({kind:'siege',difficulty:20});
const tick=(spec,opt)=>evaluateBattleObjective(spec,{allyAlive:20,enemyAlive:20,...opt});
assert.equal(tick(defend,{elapsedSeconds:119}).outcome,null,'Defense cannot win before timer');
assert.equal(tick(defend,{elapsedSeconds:120}).outcome,'victory','Defense wins by survival');
assert.equal(tick(defend,{elapsedSeconds:120,allyAlive:0}).outcome,'defeat','Annihilation overrides timer');
assert.equal(tick(defend,{elapsedSeconds:30,enemyAlive:0}).outcome,'victory','Repelling all attackers is valid');
assert.equal(tick(defend,{elapsedSeconds:50,enemyInZone:true,allyInZone:false,breachSeconds:11.5,deltaSeconds:.5}).outcome,'defeat');
assert.equal(tick(defend,{elapsedSeconds:50,enemyInZone:true,allyInZone:true,breachSeconds:11.5,deltaSeconds:.5}).breachSeconds,0,'Defenders contest capture');
assert.equal(tick(cap,{allyInZone:true,enemyInZone:false,captureSeconds:17,deltaSeconds:1}).outcome,'victory');
assert.equal(tick(cap,{allyInZone:true,enemyInZone:true,captureSeconds:17,deltaSeconds:1}).captureSeconds,0,'Enemy contest interrupts capture');
assert.equal(tick(cap,{allyInZone:false,enemyInZone:false,captureSeconds:17,deltaSeconds:1}).outcome,null);
assert.equal(tick(siege,{enemyCommanderDefeated:true}).outcome,'victory');
assert.equal(tick(siege,{enemyCommanderDefeated:false}).outcome,null);
assert.equal(tick(cap,{allyAlive:0,enemyAlive:0}).outcome,'defeat','Total allied loss is not victory');

// 1-to-10 squads. Real people retain professions, HP, IDs and costumes.
const jobs=['sword','shield','fighter','ninja','thief','archer','mage','priest','summoner','lancer'];
const units=jobs.flatMap((job,i)=>[
 ...Array.from({length:10},(_,n)=>({id:i*11+n,team:0,squadId:i,jobId:job,
  hp:100+n,maxHp:130,isStrategist:false})),
 {id:i*11+10,team:0,squadId:i,isStrategist:true,jobId:'priest',hp:200}
]);
const types=Object.fromEntries(jobs.map((job,i)=>[String(i),i%3===2?'support':'attack']));
const plan=uniformJobSquadPlan(units,types);
assert.equal(plan.summaries.length,10);
assert.equal(plan.assignments.length,100);
assert.equal(new Set(plan.assignments.map(a=>a.id)).size,100);
assert.equal(new Set(plan.assignments.map(a=>a.slotId)).size,100);
for(const row of plan.summaries){
 assert.equal(new Set(plan.assignments.filter(a=>a.squadId===row.squadId)
  .map(a=>units.find(u=>u.id===a.id).jobId)).size,1,'Each squad has exactly one class');
 assert.equal(row.total,10);
}
const switched=uniformJobSquadPlan(units,types,0,{'0':'ninja'});
assert.equal(switched.summaries[0].jobId,'ninja');
assert.equal(switched.summaries[3].jobId,'sword','Auto squads recycle the displaced profession');
assert.equal(uniformJobSquadPlan(units,types,0,{'0':'unknown'}),null);
assert.equal(uniformJobSquadPlan(units,types,0,{'0':'ninja','3':'ninja'}),null);
assert.ok(units.every(u=>u.hp>=100),'Real HP remains unchanged');
assert.equal(uniformJobSquadPlan([...units,{id:999,team:0,squadId:10,jobId:'sword',hp:100}],types),null);

for(const side of [50,100,1000]){
 const formations=createSquadFormationPlan(side,3,0);
 assert.ok(formations.length<=10);
 assert.ok(formations.every(f=>new Set(f.slots.map(u=>u.jobIndex)).size===1),'Every mass squad is mono-job');
}
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/uniformJobSquadPlan\(massSim\.units,types,team/);
assert.match(html,/uniformJobSquadPlan\(actors,types,team/);
assert.match(html,/const objectiveMonitor=createStageObjectiveMonitor/);
assert.match(html,/if\(checkStageObjective\(\)\)return;/);
assert.match(html,/objectiveType:stageObjective\?\.type/);
const moduleCode=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleCode);
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:moduleCode,encoding:'utf8',timeout:20000
});
assert.equal(syntax.status,0,syntax.stderr||'Game module must compile');
console.log('PASS 200 stage objectives, timed defense, capture, siege and single-job squads');
