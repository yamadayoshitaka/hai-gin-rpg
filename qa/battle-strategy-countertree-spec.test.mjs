import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BATTLE_SITUATION_DEFINITIONS,BATTLE_COUNTERMEASURE_DEFINITIONS} from
 '../src/battle-countermeasure-situation-matrix.js';
import {TACTIC_DEFINITIONS} from '../src/battle-tactics-preset-policy.js';
import {COMMAND_PACING,waitAfterManualOrder} from '../src/battle-reactive-command-policy.js';
import {objectiveForStage,evaluateBattleObjective} from '../src/battle-stage-objective.js';
import {
 HIERARCHY_SPEC_VERSION,HIERARCHY_LAYERS,HIERARCHY_RULES,
 STRATEGY_SCENARIO_LINKS,STRATEGY_RESPONSE_HIERARCHY,
 HIERARCHY_SCENARIO_COVERAGE,RESPONSE_REPLY_TEMPLATES,describeHierarchyPath
} from '../src/battle-strategy-countertree-spec.js';

assert.equal(HIERARCHY_SPEC_VERSION,'1.0.0');
assert.equal(HIERARCHY_RULES.execution,'specification_only');
assert.equal(HIERARCHY_RULES.simulation,'realtime_event_driven');
assert.equal(HIERARCHY_RULES.routeOwner,'prebattle_strategy');
assert.equal(HIERARCHY_RULES.routeChangeByManualResponse,false);
assert.equal(HIERARCHY_LAYERS.length,6);
assert.deepEqual([1,2,3,4,5,8].map(waitAfterManualOrder),[60,90,120,150,180,180]);
assert.equal(COMMAND_PACING.maxWaitSeconds,HIERARCHY_RULES.manualCooldownCap);

const tacticIds=TACTIC_DEFINITIONS.map(x=>x.id).sort();
const situationIds=BATTLE_SITUATION_DEFINITIONS.map(x=>x.id).sort();
const actionIds=BATTLE_COUNTERMEASURE_DEFINITIONS.map(x=>x.id).sort();
assert.equal(tacticIds.length,12);
assert.equal(situationIds.length,67);
assert.equal(actionIds.length,19);
assert.deepEqual(Object.keys(STRATEGY_SCENARIO_LINKS).sort(),tacticIds);
assert.deepEqual(STRATEGY_RESPONSE_HIERARCHY.map(x=>x.tacticId).sort(),tacticIds);
assert.deepEqual(HIERARCHY_SCENARIO_COVERAGE,situationIds,
 'Every registered battle situation must participate in at least one strategy response hierarchy');
assert.deepEqual(Object.keys(RESPONSE_REPLY_TEMPLATES).sort(),actionIds,
 'Every legal or planned response must have enemy replies and counter-counter answers');

let scenarios=0,responses=0,enemyReplies=0,counterCounters=0;
const idset=new Set(actionIds);
for(const tree of STRATEGY_RESPONSE_HIERARCHY){
 const origin=TACTIC_DEFINITIONS.find(x=>x.id===tree.tacticId);
 assert.equal(tree.stage,'L0_PREBATTLE_ARMY_TACTIC');
 assert.equal(tree.routeAuthority,'prebattle_strategy');
 assert.equal(tree.minSquads,origin.minSquads);
 assert.ok(tree.situationBranches.length>=6);
 assert.equal(new Set(tree.situationBranches.map(s=>s.id)).size,tree.situationBranches.length);
 assert.deepEqual(tree.situationBranches.map(x=>x.id),STRATEGY_SCENARIO_LINKS[tree.tacticId]);
 for(const situation of tree.situationBranches){
  scenarios++;
  assert.equal(situation.stage,'L1_OBSERVED_SITUATION');
  assert.ok(situation.observableSignal);
  const catalog=BATTLE_SITUATION_DEFINITIONS.find(x=>x.id===situation.id);
  assert.ok(catalog);
  assert.equal(situation.title,catalog.title);
  assert.deepEqual(situation.allyResponseChoices.map(x=>x.actionId),catalog.actions);
  for(const choice of situation.allyResponseChoices){
   responses++;
   assert.equal(choice.stage,'L2_ALLY_RESPONSE');
   assert.equal(choice.routeEditAllowed,false);
   assert.ok(idset.has(choice.actionId));
   const definition=BATTLE_COUNTERMEASURE_DEFINITIONS.find(x=>x.id===choice.actionId);
   assert.equal(choice.engineStatus,definition.status);
   assert.deepEqual(choice.requiredJobs,definition.requiredJobs);
   assert.ok(choice.opponentReplies.length>=2);
   for(const reply of choice.opponentReplies){
    enemyReplies++;
    assert.equal(reply.stage,'L3_ENEMY_REPLY');
    assert.equal(reply.hypothetical,true);
    assert.equal(reply.routeEditAllowed,false);
    assert.ok(reply.condition);
    assert.ok(idset.has(reply.actionId));
    assert.equal(reply.enemyAiReady,['charge','defend','hold','retreat'].includes(reply.actionId));
    assert.ok(reply.counterCounterOptions.length>=2);
    for(const final of reply.counterCounterOptions){
     counterCounters++;
     assert.equal(final.stage,'L4_ALLY_COUNTER_COUNTER');
     assert.ok(idset.has(final.actionId));
     assert.equal(final.routeEditAllowed,false);
     assert.equal(final.after,'reobserve_or_adjudicate');
    }
   }
  }
 }
}
assert.ok(scenarios>=67);
assert.ok(responses>200);
assert.ok(enemyReplies>400);
assert.ok(counterCounters>800);

const resolved=describeHierarchyPath('siege_break','locked_door','unlock_door',
 'fortify','burn_building');
assert.ok(resolved);
assert.match(resolved.tactic,/破城工作/);
assert.match(resolved.situation,/施錠扉/);
assert.match(resolved.allyCounterCounter,/建物/);
assert.ok(describeHierarchyPath('balanced','rushing','defend','charge','heal'));
const planned=describeHierarchyPath('highground','enemy_tower','summon_rescue','focus_squad','defend');
assert.ok(planned,'Planned flying rescue remains documented in the counter-response tree');
assert.equal(describeHierarchyPath('siege_break','locked_door','unlock_door','retreat','burn_tree'),null);
assert.equal(describeHierarchyPath('none','none','none','none','none'),null);

for(const kind of ['defend','capture','siege','eliminate']){
 const spec=objectiveForStage({kind});
 const win=evaluateBattleObjective(spec,{allyAlive:5,enemyAlive:0,elapsedSeconds:10});
 assert.equal(win.winnerTeam,0,'Tactics cannot override victory adjudication');
 assert.equal(win.loserTeam,1);
}

const doc=readFileSync(new URL('../docs/battle-strategy-response-hierarchy-spec.md',import.meta.url),'utf8');
for(const token of ['L0','L1','L2','L3','L4','L5',
 '67','12','20','60','90','120','150','180','勝敗','ルート','召喚獣',
 '敵の対策','味方の再対策','実装済み','未実装','同時']){
 assert.ok(doc.includes(token),'Required specification topic missing: '+token);
}
console.log('PASS 12 tactics, 67 situations, 20 reactions and '+responses+
 ' L2 / '+enemyReplies+' L3 / '+counterCounters+' L4 branches, route ownership and realtime outcome invariants');
