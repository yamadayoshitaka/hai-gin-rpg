import assert from 'node:assert/strict';
import {createNewGame,leaveTown} from '../src/game-core-flow.js';
import {makeCoreBattleRequest,settleCoreBattle} from '../src/core-battle-bridge.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {objectiveForStage,evaluateBattleObjective} from '../src/battle-stage-objective.js';
import {createStageObjectiveMonitor} from '../src/battle-objective-runtime.js';

const types=['defend','capture','siege'];
for(const stage of CAMPAIGN_STAGES.filter(stage=>types.includes(stage.kind))){
 const spec=objectiveForStage(stage);
 assert.ok(Number.isFinite(spec.durationSeconds)&&spec.durationSeconds>0,stage.id);
 assert.deepEqual([spec.attackerTeam,spec.defenderTeam].sort(),[0,1],stage.id);
 assert.ok(spec.allyGoal&&spec.enemyGoal,stage.id);
 assert.notEqual(spec.allyGoal,spec.enemyGoal,stage.id);
 assert.match(spec.allyGoal,/または敵軍を殲滅/,stage.id+' player can win by annihilation');
 assert.match(spec.enemyGoal,/または味方軍を殲滅/,stage.id+' enemy can win by annihilation');
 const base={allyAlive:5,enemyAlive:5};
 const resolve=extra=>evaluateBattleObjective(spec,{...base,...extra});
 const awaiting=resolve({elapsedSeconds:spec.durationSeconds-1});
 assert.equal(awaiting.outcome,null,stage.id+' must be undecided before deadline');
 assert.equal(awaiting.winnerTeam,null);
 const timeout=resolve({elapsedSeconds:spec.durationSeconds});
 assert.equal(timeout.winnerTeam,spec.defenderTeam,stage.id+' defender always wins at timeout');
 assert.equal(timeout.loserTeam,spec.attackerTeam);
 // Annihilation works even when no zone is occupied, before the deadline
 // and at the deadline. This is independent of the stage-specific objective.
 const playerEliminatesEnemy=resolve({allyAlive:7,enemyAlive:0,
  elapsedSeconds:15,allyInZone:false,enemyInZone:false});
 assert.equal(playerEliminatesEnemy.winnerTeam,0,stage.id+' ally elimination victory');
 assert.match(playerEliminatesEnemy.reason,/殲滅/);
 const enemyEliminatesPlayer=resolve({allyAlive:0,enemyAlive:7,
  elapsedSeconds:15,allyInZone:false,enemyInZone:false});
 assert.equal(enemyEliminatesPlayer.winnerTeam,1,stage.id+' enemy elimination victory');
 assert.match(enemyEliminatesPlayer.reason,/殲滅/);
 const playerKillsAtDeadline=resolve({allyAlive:2,enemyAlive:0,
  elapsedSeconds:spec.durationSeconds});
 assert.equal(playerKillsAtDeadline.winnerTeam,0,stage.id+' elimination resolves before time expiry');
 const enemyKillsAtDeadline=resolve({allyAlive:0,enemyAlive:2,
  elapsedSeconds:spec.durationSeconds});
 assert.equal(enemyKillsAtDeadline.winnerTeam,1,stage.id+' enemy elimination resolves before time expiry');
 const winOnSoldierLoss=resolve({allyAlive:spec.defenderTeam===0?0:5,
  enemyAlive:spec.defenderTeam===1?0:5});
 assert.equal(winOnSoldierLoss.winnerTeam,spec.attackerTeam);
 const attackingArmyGone=resolve({allyAlive:spec.attackerTeam===0?0:5,
  enemyAlive:spec.attackerTeam===1?0:5});
 assert.equal(attackingArmyGone.winnerTeam,spec.defenderTeam);
 const bothGone=resolve({allyAlive:0,enemyAlive:0});
 assert.equal(bothGone.winnerTeam,spec.defenderTeam);
 assert.equal(bothGone.loserTeam,spec.attackerTeam);
 for(const scenario of [timeout,winOnSoldierLoss,attackingArmyGone,bothGone]){
  assert.ok(['victory','defeat'].includes(scenario.outcome));
  assert.equal(scenario.winnerTeam+scenario.loserTeam,1);
  assert.equal(scenario.outcome,scenario.winnerTeam===0?'victory':'defeat');
 }
 if(spec.type==='defend_timer'){
  assert.equal(spec.attackerTeam,1);
  const before=resolve({elapsedSeconds:30,enemyInZone:true,allyInZone:false,
   breachSeconds:spec.breachSeconds-1,deltaSeconds:.5});
  assert.equal(before.winnerTeam,null);
  const capture=resolve({elapsedSeconds:30,enemyInZone:true,allyInZone:false,
   breachSeconds:spec.breachSeconds-1,deltaSeconds:1});
  assert.equal(capture.winnerTeam,1);
  const contested=resolve({elapsedSeconds:30,enemyInZone:true,allyInZone:true,
   breachSeconds:spec.breachSeconds-1,deltaSeconds:1});
  assert.equal(contested.breachSeconds,0);
  const deadline=resolve({elapsedSeconds:spec.durationSeconds,
   enemyInZone:true,allyInZone:false,
   breachSeconds:spec.breachSeconds-1,deltaSeconds:1});
  assert.equal(deadline.winnerTeam,1,'Goal completed at deadline wins before the clock');
  const tooLate=resolve({elapsedSeconds:spec.durationSeconds+1,
   enemyInZone:true,allyInZone:false,
   breachSeconds:spec.breachSeconds-1,deltaSeconds:1});
  assert.equal(tooLate.winnerTeam,0);
 }else{
  assert.equal(spec.attackerTeam,0);
  const during=resolve({elapsedSeconds:20,allyInZone:true,enemyInZone:false,
   captureSeconds:spec.holdSeconds-1,deltaSeconds:1});
  assert.equal(during.winnerTeam,0);
  const contested=resolve({elapsedSeconds:20,allyInZone:true,enemyInZone:true,
   captureSeconds:spec.holdSeconds-1,deltaSeconds:1});
  assert.equal(contested.captureSeconds,0);
  const deadline=resolve({elapsedSeconds:spec.durationSeconds,
   allyInZone:true,enemyInZone:false,
   captureSeconds:spec.holdSeconds-1,deltaSeconds:1});
  assert.equal(deadline.winnerTeam,0);
  const expired=resolve({elapsedSeconds:spec.durationSeconds+1,
   allyInZone:true,enemyInZone:false,
   captureSeconds:spec.holdSeconds-1,deltaSeconds:1});
  assert.equal(expired.winnerTeam,1);
 }
}
// The policy also supports swapped human/AI roles without reversing coordinates.
const opposite={...objectiveForStage({kind:'capture'}),
 attackerTeam:1,defenderTeam:0};
let swapped=evaluateBattleObjective(opposite,{allyAlive:9,enemyAlive:8,
 allyInZone:false,enemyInZone:true,
 captureSeconds:17,deltaSeconds:1,elapsedSeconds:55});
assert.equal(swapped.winnerTeam,1);
assert.equal(swapped.loserTeam,0);
swapped=evaluateBattleObjective(opposite,{allyAlive:9,enemyAlive:8,
 elapsedSeconds:opposite.durationSeconds});
assert.equal(swapped.winnerTeam,0);

// The actual UI monitor reports the same single winner and announces both
// goals, including an unambiguous defeat with no remaining attackers.
const previousDocument=globalThis.document;
globalThis.document={createElement:()=>({style:{},setAttribute(){},textContent:''}),
 body:{append(){}}};
try{
 const completions=[],spec=objectiveForStage({kind:'capture'});
 const monitor=createStageObjectiveMonitor(spec,{
  onComplete:(victory,reason,result)=>completions.push({victory,reason,result})
 });
 const soldiers=[{id:0,team:0,hp:50,x:0,z:0},
  {id:1,team:1,hp:100,x:40,z:0}];
 assert.equal(monitor.update(0,soldiers,{mass:true}),false);
 assert.match(monitor.element.textContent,/味方：/);
 assert.match(monitor.element.textContent,/敵：/);
 assert.equal(monitor.update(spec.durationSeconds,soldiers,{mass:true}),true);
 assert.equal(completions.length,1);
 assert.equal(completions[0].victory,false);
 assert.equal(completions[0].result.winnerTeam,1);
 assert.equal(completions[0].result.loserTeam,0);
 assert.equal(monitor.getState().lastResult.winnerTeam,1);
 assert.equal(monitor.update(spec.durationSeconds+1,soldiers,{mass:true}),true);
 assert.equal(completions.length,1,'End of battle must only be reported once');
}finally{
 if(previousDocument===undefined)delete globalThis.document;
 else globalThis.document=previousDocument;
}

// Story settlement may not receive contradictory victory flags for side goals.
for(const kind of types){
 const stage=CAMPAIGN_STAGES.find(x=>x.kind===kind);
 const game=createNewGame('非対称作戦QA');
 leaveTown(game);
 const request=makeCoreBattleRequest(game,stage.id,'opposed-'+kind);
 assert.equal(request.battleObjective.type,objectiveForStage(stage).type);
 const result={battleId:request.battleId,territoryId:request.territoryId,
  victory:true,casualties:[],objectiveCompleted:true,
  objectiveType:request.battleObjective.type,winnerTeam:1,loserTeam:0};
 assert.throws(()=>settleCoreBattle(game,request,result),/勝敗が一致しません/);
 assert.equal(game.lastCoreBattleId,undefined,'Invalid result must not mutate campaign progress');
}
console.log('PASS all mission types: opposing goals OR universal annihilation, timer precedence, and decisive winner/loser results');
