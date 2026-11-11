import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {TACTIC_DEFINITIONS,tacticAvailability,buildTacticPlan} from '../src/battle-tactics-preset-policy.js';
import {COMMAND_PACING,commandReadiness,waitAfterManualOrder,afterManualOrder,
 observeEnemyTactic,recommendCounterOrder} from '../src/battle-reactive-command-policy.js';
import {objectiveForStage,evaluateBattleObjective} from '../src/battle-stage-objective.js';

const s=(...jobs)=>jobs.map((jobId,i)=>({squadId:String(i),jobId,total:10}));
assert.deepEqual(TACTIC_DEFINITIONS.map(t=>t.id).length,12);
assert.ok(TACTIC_DEFINITIONS.every(t=>t.scope==='army'&&t.minSquads>=1));
assert.ok(TACTIC_DEFINITIONS.filter(t=>t.id!=='balanced').every(t=>t.minSquads===2));
for(const stageKind of ['defend','capture','siege']){
 const mission=objectiveForStage({kind:stageKind,difficulty:1});
 assert.equal(tacticAvailability({squads:s('ninja'),objective:mission})
  .filter(t=>t.enabled).map(t=>t.id).join(','),'balanced',
  'One squad cannot execute multi-squad combined tactics');
 const troops=s('shield','archer','priest');
 const plan=buildTacticPlan({tacticId:'fortress_defense',squads:troops,objective:mission});
 assert.equal(plan.scope,'army');
 assert.equal(plan.coordinated,true);
 assert.deepEqual(plan.participatingSquadIds,['0','1','2']);
 assert.equal(plan.orders.length,3);
 assert.equal(plan.orders[0].role,'guard');
 assert.equal(plan.orders[1].role,'fire_support');
 assert.equal(plan.orders[2].role,'healer');
 assert.equal(evaluateBattleObjective(mission,{allyAlive:3,enemyAlive:0}).winnerTeam,0,
  'Tactic selection must not alter victory by annihilation');
}

assert.deepEqual([1,2,3,4,5,6,12].map(waitAfterManualOrder),
 [60,90,120,150,180,180,180]);
assert.equal(COMMAND_PACING.maxWaitSeconds,180);
let army={issuedCount:0,globalNextAt:0};
assert.equal(commandReadiness({now:0,...army}).ready,true);
for(let i=1,now=0;i<=7;i++){
 const next=afterManualOrder(army,now);
 assert.equal(next.issuedCount,i);
 assert.equal(next.cooldownSeconds,waitAfterManualOrder(i));
 assert.equal(commandReadiness({now,issuedCount:next.issuedCount,globalNextAt:next.globalNextAt}).ready,false);
 assert.equal(commandReadiness({now:now+next.cooldownSeconds-1,...next}).ready,false);
 assert.equal(commandReadiness({now:now+next.cooldownSeconds,...next}).ready,true);
 assert.throws(()=>afterManualOrder(next,now+1),/再発令/);
 army=next;now=next.globalNextAt;
}
assert.equal(commandReadiness({now:20,issuedCount:0,globalNextAt:0,lastSquadAt:0,
 squadWaitSeconds:60}).remainingSeconds,40,'Local item cooldown stays independent');
assert.equal(commandReadiness({now:20,issuedCount:2,globalNextAt:90,lastSquadAt:0,
 squadWaitSeconds:60}).remainingSeconds,70,'Army cooldown applies to every squad');
assert.equal(commandReadiness({now:180,issuedCount:4,globalNextAt:160}).ready,true);
assert.throws(()=>afterManualOrder({},-1),RangeError);

const defender=objectiveForStage({kind:'defend'});
const attacker=objectiveForStage({kind:'capture'});
function counter(enemySquads,jobId,objective=attacker,options={}){
 const threat=observeEnemyTactic({enemySquads,objective,...options});
 const response=recommendCounterOrder({observation:threat,jobId,objective,...options});
 assert.ok(['charge','defend','hold','retreat'].includes(response.order));
 return {threat,response};
}
const troops=(mode,qty,extras={})=>Array.from({length:qty},(_,i)=>({
 id:i,mode,soldiers:10,...extras
}));
assert.equal(counter(troops('charge',3),'shield').response.order,'defend');
assert.equal(counter(troops('charge',3),'priest',{type:'capture_zone',defenderTeam:1}).threat.kind,'rush');
assert.equal(counter(troops('defend',3),'fighter').response.order,'charge');
assert.equal(counter(troops('retreat',1),'fighter').response.order,'charge');
assert.equal(counter(troops('charge',2,{highGround:true}),'ninja').response.order,'charge');
assert.equal(counter(troops('charge',2,{highGround:true}),'archer').response.order,'retreat');
assert.equal(counter(troops('charge',2),'shield',defender,{enemyNearOurZone:true}).response.order,'hold');
assert.equal(counter(troops('charge',2),'fighter',defender,{enemyNearOurZone:true}).response.order,'defend');
assert.equal(counter(troops('charge',2),'fighter',attacker,{allyHpRatio:.1}).response.order,'retreat');
assert.equal(counter([],'fighter').response.order,'hold');
assert.ok(counter(troops('charge',3),'shield').threat.basis.includes('3部隊'));

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const required of [
 'import {commandReadiness,afterManualOrder,observeEnemyTactic,recommendCounterOrder}',
 'const manuallyOrderedSquads=new Set()',
 'armyManualOrderState=afterManualOrder(armyManualOrderState,elapsed)',
 "markRibbonOrderIssued(commandSquad,{countAsOrder:false})",
 'manuallyOrderedSquads.has(row.id)',
 '★ 対抗号令：',
 '敵の動向：',
 '発令済み',
 'window.getBattleReactiveOrderQA',
 'counter.order',
 'requestSquadRecovery(id,{issuerSquadId:action.source})',
 'if(countAsOrder){'
])assert.ok(html.includes(required),'Missing runtime connection: '+required);
const module=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(module,'Main battle module exists');
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:module,encoding:'utf8',timeout:20000});
assert.equal(syntax.status,0,syntax.stderr||'Main battle module must compile');
console.log('PASS coordinated tactics, opponent-driven counter-orders, 60/90/120/150/180 cooldown and one charge per manual order');
