import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {objectiveForStage,evaluateBattleObjective} from '../src/battle-stage-objective.js';
import {TACTIC_DEFINITIONS} from '../src/battle-tactics-preset-policy.js';
import {BATTLE_SITUATION_DEFINITIONS,BATTLE_COUNTERMEASURE_DEFINITIONS}
 from '../src/battle-countermeasure-situation-matrix.js';
import {waitAfterManualOrder} from '../src/battle-reactive-command-policy.js';
import {
 VICTORY_ROUTE_SPEC_VERSION,VICTORY_ROUTE_LAYERS,VICTORY_ROUTE_RULES,JOB_DISPLAY_NAMES,
 COUNTER_JOBS,ROUTE_BLUEPRINTS,VICTORY_ROUTE_GOALS,VICTORY_ROUTE_RESPONSE_TREE,
 JOB_COUNT,ROUTE_COUNT,COVERAGE,findVictoryRouteResponsePath,lookupUnexpectedVictoryRouteEvent,resolveEligibleJobSquads
} from '../src/battle-victory-route-response-spec.js';

assert.equal(VICTORY_ROUTE_SPEC_VERSION,'2.0.0');
assert.deepEqual(VICTORY_ROUTE_LAYERS,[
 'L0_WIN_CONDITION','L1_PREBATTLE_ROUTE','L2_ALLY_RESPONSE',
 'L3_ENEMY_COUNTER','L4_ALLY_COUNTER_COUNTER','L5_REASSESS']);
assert.equal(VICTORY_ROUTE_RULES.execution,'specification_only');
assert.equal(VICTORY_ROUTE_RULES.goalComposition,'stage_specific_goal_OR_enemy_annihilation');
assert.equal(VICTORY_ROUTE_RULES.routeAuthority,'prebattle_strategy_only');
assert.equal(VICTORY_ROUTE_RULES.responseChangesRoute,false);
assert.equal(VICTORY_ROUTE_RULES.routeStatus,'templates_require_authored_waypoints_and_runtime_validation');
assert.deepEqual(VICTORY_ROUTE_RULES.responseCooldownSeconds,[60,90,120,150,180]);
assert.deepEqual([1,2,3,4,5,9].map(waitAfterManualOrder),[60,90,120,150,180,180]);

assert.equal(JOB_COUNT,10);
assert.equal(ROUTE_COUNT,14);
assert.equal(COVERAGE.winConditions,8);
assert.equal(COVERAGE.routeChoices,32);
assert.equal(BATTLE_SITUATION_DEFINITIONS.length,67);
assert.equal(BATTLE_COUNTERMEASURE_DEFINITIONS.length,19);
assert.equal(new Set(VICTORY_ROUTE_GOALS.map(g=>g.id)).size,8);
for(const type of ['eliminate','defend_timer','capture_zone','siege']){
 for(const team of [0,1])
  assert.equal(VICTORY_ROUTE_RESPONSE_TREE.filter(g=>g.objectiveType===type&&g.team===team).length,1);
}
const validJobs=new Set(Object.keys(JOB_DISPLAY_NAMES));
const scenarioIndex=new Map(BATTLE_SITUATION_DEFINITIONS.map(s=>[s.id,s]));
const catalogIndex=new Map(BATTLE_COUNTERMEASURE_DEFINITIONS.map(a=>[a.id,a]));
const tacticIds=new Set(TACTIC_DEFINITIONS.map(t=>t.id));
assert.deepEqual(Object.keys(COUNTER_JOBS).sort(),[...catalogIndex.keys()].sort());
let totalSituations=0,totalResponses=0,totalEnemyResponses=0,totalAllyReResponses=0;
for(const g of VICTORY_ROUTE_RESPONSE_TREE){
 assert.equal(g.level,'L0');
 assert.match(g.victoryCondition,/殲滅|全滅/);
 assert.equal(g.universalAlternative,'敵軍殲滅');
 assert.equal(g.winEvaluator,'evaluateBattleObjective');
 assert.equal(g.routes.length,4);
 assert.deepEqual(g.routes.map(r=>r.id),VICTORY_ROUTE_GOALS.find(x=>x.id===g.id).routes);
 for(const route of g.routes){
  assert.equal(route.level,'L1');
  assert.equal(route.owner,'prebattle_strategy');
  assert.equal(route.pathCoordinates,'never_invented');
  assert.equal(route.status,'route_template_not_verified_in_stage');
  assert.ok(ROUTE_BLUEPRINTS[route.id]);
  assert.ok(tacticIds.has(route.tacticId));
  assert.ok(route.featureRequirements.length>0);
  assert.ok(route.steps.length>=3);
  assert.ok(route.participatingSquadRoles.length>=2);
  for(const role of route.participatingSquadRoles){
   assert.ok(role.eligibleJobs.length>=1);
   assert.equal(role.eligibleSquadNames.length,role.eligibleJobs.length);
   for(const job of role.eligibleJobs)assert.ok(validJobs.has(job),job);
   assert.ok(role.eligibleSquadNames.every(label=>label.endsWith('隊')));
  }
  assert.ok(route.expectedSituations.length>=3);
  for(const sit of route.expectedSituations){
   totalSituations++;
   assert.ok(scenarioIndex.has(sit.id));
   assert.equal(sit.source,'expected');
   assert.equal(sit.expectedOnlyUntilObserved,true);
   assert.equal(sit.responses.length,scenarioIndex.get(sit.id).actions.length);
   for(const response of sit.responses){
    totalResponses++;
    assert.equal(response.level,'L2');
    assert.equal(response.team,0);
    assert.equal(response.manualCooldownApplies,true);
    assert.equal(response.noRouteEdits,true);
    assert.equal(response.requiresWholeSquad,true);
    assert.ok(catalogIndex.has(response.id));
    assert.ok(response.squadJobs.length>0);
    assert.ok(response.squadNames.length===response.squadJobs.length);
    assert.ok(response.squadJobs.every(j=>validJobs.has(j)));
    assert.equal(response.implementation,catalogIndex.get(response.id).status);
    for(const needed of response.requiredJobs)assert.ok(response.squadJobs.includes(needed));
    assert.equal(response.disabledUntilImplemented,response.implementation==='planned');
    assert.ok(response.enemyReplies.length>=2);
    for(const enemy of response.enemyReplies){
     totalEnemyResponses++;
     assert.equal(enemy.level,'L3');
     assert.equal(enemy.team,1);
     assert.equal(enemy.manualCooldownApplies,false);
     assert.equal(enemy.noRouteEdits,true);
     assert.equal(enemy.hypothetical,true);
     assert.ok(enemy.squadNames.length>0);
     assert.ok(enemy.condition);
     assert.ok(enemy.allyReResponses.length>=2);
     for(const final of enemy.allyReResponses){
      totalAllyReResponses++;
      assert.equal(final.level,'L4');
      assert.equal(final.team,0);
      assert.equal(final.noRouteEdits,true);
      assert.equal(final.manualCooldownApplies,true);
      assert.equal(final.executeOnlyAfterObservedEnemyReply,true);
      assert.ok(final.squadNames.length>0);
      for(const job of final.squadJobs)assert.ok(validJobs.has(job),job);
      assert.equal(final.disabledUntilImplemented,final.implementation==='planned');
     }
    }
   }
  }
 }
}
assert.ok(totalSituations>=120);
assert.ok(totalResponses>200);
assert.ok(totalEnemyResponses>400);
assert.ok(totalAllyReResponses>800);
assert.equal(COVERAGE.expectedSituationEdges,totalSituations);
assert.equal(COVERAGE.availableScenarioCatalog,67);
assert.equal(COVERAGE.allScenariosAccessibleOnVerifiedEvent,true);

const siege=findVictoryRouteResponsePath({
 goalId:'siege_ally',routeId:'gate_assault',situationId:'locked_door',
 allyActionId:'unlock_door',enemyActionId:'fortify',allyCounterCounterId:'burn_building'});
assert.ok(siege);
assert.match(siege.victory,/城/);
assert.match(siege.route,/城門/);
assert.deepEqual(siege.ally.jobSquads,['シーフ隊']);
assert.deepEqual(siege.enemy.jobSquads,['シーフ隊']);
assert.deepEqual(siege.allyAgain.jobSquads,['魔法使い隊']);
assert.equal(siege.changesRoute,false);
const capture=findVictoryRouteResponsePath({
 goalId:'capture_ally',routeId:'zone_dash',situationId:'capture_contested',
 allyActionId:'focus_squad',enemyActionId:'defend',allyCounterCounterId:'charge'});
assert.ok(capture);
const defend=findVictoryRouteResponsePath({
 goalId:'defend_ally',routeId:'defense_gate',situationId:'friendly_door',
 allyActionId:'fortify',enemyActionId:'unlock_door',allyCounterCounterId:'focus_squad'});
assert.ok(defend);
assert.deepEqual(defend.enemy.jobSquads,['シーフ隊']);
assert.equal(findVictoryRouteResponsePath({
 goalId:'siege_ally',routeId:'gate_assault',situationId:'locked_door',
 allyActionId:'unlock_door',enemyActionId:'charge',allyCounterCounterId:'burn_tree'}),null);
const fallback=lookupUnexpectedVictoryRouteEvent({
 goalId:'siege_ally',routeId:'gate_assault',situationId:'status_freeze'});
assert.equal(fallback.id,'status_freeze');
assert.equal(fallback.source,'unanticipated_verified_event');
assert.ok(fallback.responses.every(c=>c.noRouteEdits));
assert.equal(lookupUnexpectedVictoryRouteEvent({
 goalId:'capture_ally',routeId:'missing',situationId:'status_freeze'}),null);
assert.equal(lookupUnexpectedVictoryRouteEvent({
 goalId:'capture_ally',routeId:'zone_dash',situationId:'missing'}),null);
for(const obj of ['eliminate','defend','capture','siege']){
 const spec=objectiveForStage({kind:obj});
 assert.equal(evaluateBattleObjective(spec,{allyAlive:12,enemyAlive:0,elapsedSeconds:10}).winnerTeam,0);
 assert.equal(evaluateBattleObjective(spec,{allyAlive:0,enemyAlive:12,elapsedSeconds:10}).winnerTeam,1);
}
const concrete=[
 {id:11,team:0,jobId:'mage',squadId:'3',isStrategist:false,alive:true,hp:55},
 {id:12,team:0,jobId:'mage',squadId:'3',isStrategist:false,alive:true,hp:55},
 {id:13,team:0,jobId:'thief',squadId:'4',isStrategist:false,alive:true,hp:55},
 {id:20,team:0,jobId:'summoner',squadId:'5',isStrategist:false,alive:true,hp:75},
 {id:91,team:0,squadId:'3',isStrategist:true,alive:true,hp:100},
 {id:92,team:0,squadId:'4',isStrategist:true,alive:false,hp:0},
 {id:93,team:0,squadId:'5',isStrategist:true,alive:true,hp:100},
 {id:14,team:1,jobId:'mage',squadId:'2',isStrategist:false,alive:true,hp:70},
 {id:94,team:1,squadId:'2',isStrategist:true,alive:true,hp:90}
];
const mages=resolveEligibleJobSquads({actionId:'burn_building',team:0,units:concrete});
assert.equal(mages.length,1);
assert.equal(mages[0].display,'第3隊（魔法使い）');
assert.equal(mages[0].soldierCount,2);
assert.equal(mages[0].commandableByPolicy,true);
assert.equal(mages[0].requiresRuntimeTargetMpAndRouteCheck,true);
assert.equal(resolveEligibleJobSquads({actionId:'burn_building',team:1,units:concrete})[0].display,
 '第2隊（魔法使い）');
assert.equal(resolveEligibleJobSquads({actionId:'unlock_door',team:0,units:concrete})[0].commandableByPolicy,false,
 'A squad whose strategist died cannot issue a manual response');
const plannedSummoner=resolveEligibleJobSquads({actionId:'summon_rescue',team:0,units:concrete})[0];
assert.equal(plannedSummoner.display,'第5隊（召喚士）');
assert.equal(plannedSummoner.abilityImplemented,false);
assert.equal(plannedSummoner.commandableByPolicy,false);
assert.equal(resolveEligibleJobSquads({actionId:'heal',team:0,units:concrete}).length,0);
assert.equal(resolveEligibleJobSquads({actionId:'missing',team:0,units:concrete}).length,0);
assert.ok(VICTORY_ROUTE_RESPONSE_TREE.find(g=>g.id==='defend_enemy_attack')
 .routes.find(r=>r.id==='zone_dash').expectedSituations.some(x=>x.id==='defense_breach'),
 'The same route adapts expected situation triggers to the win objective');
assert.ok(!VICTORY_ROUTE_RESPONSE_TREE.find(g=>g.id==='defend_enemy_attack')
 .routes.find(r=>r.id==='zone_dash').expectedSituations.some(x=>x.id==='capture_clock'),
 'A timed-defense attack is not incorrectly given capture-mode clock events');

assert.deepEqual(COUNTER_JOBS.summon_rescue,['summoner']);
assert.deepEqual(COUNTER_JOBS.burn_building,['mage']);
assert.deepEqual(COUNTER_JOBS.unlock_door,['thief']);
assert.deepEqual(COUNTER_JOBS.heal,['priest']);

const doc=readFileSync(new URL('../docs/battle-victory-route-response-spec.md',import.meta.url),'utf8');
for(const phrase of ['勝利条件','ルート','L2','L3','L4','敵の対応','味方の再対応','ジョブ',
 '全ジョブ','シーフ隊','魔法使い隊','忍者','召喚士','未実装','67','32','60秒','90秒','120秒','150秒','180秒']){
 assert.ok(doc.includes(phrase),'Missing documentation: '+phrase);
}
for(const goal of VICTORY_ROUTE_RESPONSE_TREE){
 const titles=['敵軍殲滅・味方','敵軍殲滅・敵側','時間防衛・味方守備側','時間防衛・敵攻撃側',
 '陣地制圧・味方攻撃側','陣地制圧・敵防衛側','攻城戦・味方攻撃側','攻城戦・敵防衛側'];
 assert.ok(doc.includes(titles[VICTORY_ROUTE_RESPONSE_TREE.indexOf(goal)]));
 for(const route of goal.routes)assert.ok(doc.includes(route.name),'Missing route: '+route.name);
}
console.log('PASS 8 victory condition roots, 32 route choices, 14 route templates, 67 situational triggers, 19 job-labeled counters and '+
 totalResponses+' L2 / '+totalEnemyResponses+' L3 / '+totalAllyReResponses+' L4 examples');
