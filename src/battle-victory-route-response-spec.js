/**
 * Canonical SPEC view:
 * WIN CONDITION -> PREBATTLE ROUTE -> ALLY RESPONSE -> ENEMY RESPONSE
 *               -> ALLY RE-RESPONSE.
 * Situations are explicit, observed conditions of a route, not extra layers.
 * Never claim this read-only graph is a live autonomous battle AI.
 */
import {objectiveForStage} from './battle-stage-objective.js';
import {TACTIC_DEFINITIONS} from './battle-tactics-preset-policy.js';
import {BATTLE_SITUATION_DEFINITIONS,BATTLE_COUNTERMEASURE_DEFINITIONS}
 from './battle-countermeasure-situation-matrix.js';
import {RESPONSE_REPLY_TEMPLATES} from './battle-strategy-countertree-spec.js';

export const VICTORY_ROUTE_SPEC_VERSION='2.0.0';
export const VICTORY_ROUTE_LAYERS=Object.freeze([
 'L0_WIN_CONDITION','L1_PREBATTLE_ROUTE','L2_ALLY_RESPONSE',
 'L3_ENEMY_COUNTER','L4_ALLY_COUNTER_COUNTER','L5_REASSESS'
]);
export const JOB_DISPLAY_NAMES=Object.freeze({
 sword:'剣士',shield:'盾騎士',ninja:'忍者',thief:'シーフ',
 archer:'弓兵',mage:'魔法使い',priest:'僧侶',
 summoner:'召喚士',lancer:'槍兵',fighter:'格闘家'
});
const ALL_JOBS=Object.freeze(Object.keys(JOB_DISPLAY_NAMES));
const FRONT=Object.freeze(['sword','shield','lancer','fighter','ninja']);
const STRIKE=Object.freeze(['sword','shield','ninja','thief','archer','mage','summoner','lancer','fighter']);
export const COUNTER_JOBS=Object.freeze({
 charge:STRIKE,
 defend:ALL_JOBS,
 hold:ALL_JOBS,
 retreat:ALL_JOBS,
 focus_squad:STRIKE,
 focus_commander:Object.freeze(['ninja','fighter','lancer','archer','mage','sword']),
 burn_building:Object.freeze(['mage']),
 burn_tree:Object.freeze(['mage']),
 demolish:Object.freeze(['ninja']),
 destroy_bridge:Object.freeze(['ninja','mage']),
 unlock_door:Object.freeze(['thief']),
 fortify:Object.freeze(['thief']),
 repair:Object.freeze(['mage','ninja']),
 extinguish:Object.freeze(['mage']),
 heal:Object.freeze(['priest']),
 summon_vanguard:Object.freeze(['summoner']),
 summon_intercept:Object.freeze(['summoner']),
 summon_rescue:Object.freeze(['summoner']),
 summon_roof:Object.freeze(['summoner'])
});
export const VICTORY_ROUTE_RULES=Object.freeze({
 goalComposition:'stage_specific_goal_OR_enemy_annihilation',
 whoWins:'existing_evaluateBattleObjective',
 routeAuthority:'prebattle_strategy_only',
 routeStatus:'templates_require_authored_waypoints_and_runtime_validation',
 routeAlternatePolicy:'preauthored_fallback_only',
 responseChangesRoute:false,
 responseJobUnit:'whole_single_job_squad',
 responseState:'conditional_candidates_not_guaranteed_enemy_moves',
 responseCooldownSeconds:[60,90,120,150,180],
 responseCooldownMaxSeconds:180,
 unreleasedSummonAbilities:'disabled',
 execution:'specification_only'
});
const freeze=r=>Object.freeze(r);
const nameJob=job=>JOB_DISPLAY_NAMES[job]||job;

/**
 * A route specifies geographic intent, prebattle path requirements and its
 * constituent squads. It deliberately does NOT invent real coordinates.
 * This is independent of live mission target positions.
 */
export const ROUTE_BLUEPRINTS=freeze({
 center_push:freeze({name:'中央正面突破路',tacticId:'balanced',
  features:['walkable_center_lane'],
  steps:['中央の通行可能区域を確認','前衛で接敵','後列から火力と支援'],
  teams:[['sword','lancer','fighter'],['shield'],['archer','mage'],['priest']],
  encounters:['rushing','fortified','concentrated','frontline_collapse','healer_available']}),
 flank:freeze({name:'側面迂回路',tacticId:'infiltration',
  features:['authored_side_passage'],
  steps:['開戦前に通行可能な側道を確定','機動隊が側面へ展開','前衛・弓兵が援護'],
  teams:[['ninja','thief','fighter'],['shield'],['archer','mage']],
  encounters:['flanked','encircled','ambush','fallback','isolated_squad']}),
 upper_fire:freeze({name:'高地・窓射撃路',tacticId:'highground',
  features:['authored_stairs_or_roof','valid_upper_floor_access'],
  steps:['建物の実在する階段・窓経路を指定','弓兵と魔法使いを高所へ配置','前衛で入口を守備'],
  teams:[['archer','mage'],['shield'],['ninja'],['priest']],
  encounters:['enemy_tower','roof_enemy','height_advantage','ranged_volley','roof_ally','enemy_air']}),
 gate_assault:freeze({name:'城門・施設突破路',tacticId:'siege_break',
  features:['authored_door_or_breach'],
  steps:['敵城門・脆弱な施設の接近路を事前指定','シーフが解錠、魔法使い・忍者が攻城','前衛が突破'],
  teams:[['thief'],['mage','ninja'],['shield','sword','lancer'],['priest']],
  encounters:['locked_door','siege_holding','building_defense','enemy_demolition','collapse_risk']}),
 bridge_crossing:freeze({name:'渡河・橋突破路',tacticId:'balanced',
  features:['authored_bridge','crossing_safety'],
  steps:['開戦前に橋と渡河順序を決定','盾隊が先行して橋頭堡を確保','後続が渡河'],
  teams:[['shield'],['sword','lancer'],['archer','mage'],['priest']],
  encounters:['bridge_blocked','bridge_destroyed','water_barrier','bridge_threat','rushing']}),
 bridge_denial:freeze({name:'渡河阻止・橋封鎖路',tacticId:'bridge_denial',
  features:['authored_bridge','friendly_safe_bank'],
  steps:['味方の退路を残す橋・防衛位置を事前決定','忍者・魔法隊が敵渡河橋を破壊','既定の守備位置で迎撃'],
  teams:[['ninja','mage'],['shield'],['archer'],['priest']],
  encounters:['bridge_threat','bridge_blocked','enemy_demolition','bridge_destroyed','flanked']}),
 zone_dash:freeze({name:'陣地直進・制圧路',tacticId:'objective_rush',
  features:['reachable_objective_zone'],
  steps:['制圧区域までの合法通路を事前確認','機動隊が制圧区域へ突入','盾隊・回復隊が確保を支援'],
  teams:[['ninja','fighter','lancer','thief'],['shield'],['priest']],
  encounters:['capture_clock','capture_contested','capture_near','rushing','low_hp']}),
 siege_commander:freeze({name:'敵主将討伐路',tacticId:'commander_hunt',
  features:['reachable_enemy_commander_area'],
  steps:['主将の想定配置へ既定経路を定義','忍者・機動隊が主将を攻撃','他隊が援護'],
  teams:[['ninja','fighter','lancer'],['shield'],['archer','mage'],['priest']],
  encounters:['siege_commander','enemy_stealth','encircled','healer_enemy','commander_lost']}),
 defense_gate:freeze({name:'城門・拠点正面防衛線',tacticId:'fortress_defense',
  features:['defensible_front_or_gate'],
  steps:['防衛対象の正面に盾・前衛を配置','弓兵・魔法使いが遮蔽物から迎撃','僧侶が後方支援'],
  teams:[['shield','sword','lancer'],['archer','mage'],['priest'],['thief']],
  encounters:['defense_clock','defense_breach','friendly_door','building_weak','rushing']}),
 defense_360:freeze({name:'陣地周囲防衛環',tacticId:'rear_guard',
  features:['defensible_objective_zone'],
  steps:['陣地の外周に各隊を割当','機動隊が側面防護','僧侶が中央支援'],
  teams:[['shield'],['ninja','fighter','sword'],['archer'],['priest']],
  encounters:['defense_breach','flanked','encircled','healer_available','frontline_collapse']}),
 rotation:freeze({name:'波状攻撃・交代路',tacticId:'rotation',
  features:['two_reachable_front_positions'],
  steps:['前衛2隊の投入位置・撤収位置を事前確定','突撃隊と守備隊を交代','僧侶を後方固定'],
  teams:[['sword','shield','fighter','lancer'],['sword','shield','fighter','lancer'],['priest'],['archer','mage']],
  encounters:['rushing','concentrated','frontline_collapse','healer_available','low_hp']}),
 smoke_fire:freeze({name:'魔法砲撃・建物制圧路',tacticId:'arcane_barrage',
  features:['valid_firing_line','destructible_enemy_structure'],
  steps:['魔法使いの射線・可燃施設を事前指定','盾隊が護衛し弾幕攻撃','前衛が破壊後の地点へ進軍'],
  teams:[['mage'],['shield'],['archer'],['priest']],
  encounters:['building_defense','building_burning','low_mp','enemy_air','arcane_cast']}),
 roof_infiltrate:freeze({name:'屋根・上階侵入路',tacticId:'infiltration',
  features:['authored_roof_or_window_route'],
  steps:['鉤縄・窓・屋根への実在経路を確定','忍者が先行しシーフが解錠','後続が作戦上の上階を確保'],
  teams:[['ninja'],['thief'],['archer','mage'],['shield']],
  encounters:['roof_enemy','stair_chokepoint','locked_door','flying_roof','trapped']}),
 rear_support:freeze({name:'後方支援・殿軍防衛路',tacticId:'rear_guard',
  features:['safe_rear_position'],
  steps:['退避と支援の位置を開戦前指定','盾隊が入口を守備','僧侶・弓兵が生存重視で支援'],
  teams:[['shield'],['priest'],['archer','mage']],
  encounters:['low_hp','healer_available','isolated_squad','fallen_rider','summon_lost']})
});
export const VICTORY_ROUTE_GOALS=freeze([
 {id:'eliminate_ally',objective:'eliminate',team:0,routes:['center_push','flank','upper_fire','rotation']},
 {id:'eliminate_enemy',objective:'eliminate',team:1,routes:['center_push','flank','upper_fire','rotation']},
 {id:'defend_ally',objective:'defend_timer',team:0,routes:['defense_gate','defense_360','bridge_denial','rear_support']},
 {id:'defend_enemy_attack',objective:'defend_timer',team:1,routes:['center_push','gate_assault','roof_infiltrate','zone_dash']},
 {id:'capture_ally',objective:'capture_zone',team:0,routes:['zone_dash','flank','bridge_crossing','upper_fire']},
 {id:'capture_enemy_defend',objective:'capture_zone',team:1,routes:['defense_360','defense_gate','bridge_denial','rotation']},
 {id:'siege_ally',objective:'siege',team:0,routes:['gate_assault','roof_infiltrate','siege_commander','smoke_fire']},
 {id:'siege_enemy_defend',objective:'siege',team:1,routes:['defense_gate','upper_fire','bridge_denial','rear_support']}
].map(x=>freeze({...x,routes:freeze(x.routes)})));
const kindForType=type=>({
 eliminate:'eliminate',defend_timer:'defend',
 capture_zone:'capture',siege:'siege'
})[type];
const MODE_EVENTS=freeze({
 defend_timer:freeze(['defense_clock','defense_breach']),
 capture_zone:freeze(['capture_clock','capture_contested','capture_near']),
 siege:freeze(['siege_commander','siege_holding'])
});
function relevantSituations(objectiveType,routeId,original){
 // A route blueprint is reusable across objectives, but a capture deadline
 // must not be displayed in a timed-defense or elimination battle.
 const restricted=new Set(Object.values(MODE_EVENTS).flat());
 const compatible=new Set(MODE_EVENTS[objectiveType]||[]);
 const filtered=original.filter(id=>!restricted.has(id)||compatible.has(id));
 // A zone-rush used by an attacker in a timed-defense stage is a BREACH,
 // not the separate capture-mode clock objective.
 if(objectiveType==='defend_timer'&&routeId==='zone_dash')
  filtered.unshift('defense_breach','defense_clock');
 return [...new Set(filtered)];
}
const actionById=new Map(BATTLE_COUNTERMEASURE_DEFINITIONS.map(a=>[a.id,a]));
const situationById=new Map(BATTLE_SITUATION_DEFINITIONS.map(s=>[s.id,s]));
const COOLDOWN_SIDE=0;
function annotateAction(id,ownerTeam,stage){
 const action=actionById.get(id);
 if(!action)throw Error('Unknown action '+id);
 const jobs=COUNTER_JOBS[id];
 if(!jobs?.length)throw Error('Missing job eligibility '+id);
 const expected=action.requiredJobs;
 if(expected.length&&!expected.some(j=>jobs.includes(j)))
  throw Error('Mismatched job eligibility '+id);
 return freeze({
  id,label:action.label,team:ownerTeam,
  squadJobs:jobs,
  squadNames:freeze(jobs.map(j=>nameJob(j)+'隊')),
  requiresWholeSquad:true,
  requiredJobs:expected,
  channel:action.channel,targetType:action.target,
  implementation:action.status,
  disabledUntilImplemented:action.status==='planned',
  noRouteEdits:true,
  manualCooldownApplies:ownerTeam===COOLDOWN_SIDE,
  level:stage
 });
}
/**
 * Expected situation determines which L2 options are described. Enemy L3
 * and ally L4 inherit concrete unit/job eligibility from the same catalog,
 * but are NOT automatically issued by this specification.
 */
function situationTree(id,observedAs='expected'){
 const s=situationById.get(id);
 if(!s)throw Error('Unknown situation '+id);
 return freeze({
  id:s.id,category:s.category,title:s.title,
  observedSignal:s.signal,source:observedAs,
  expectedOnlyUntilObserved:true,
  responses:freeze(s.actions.map(actionId=>{
   const ally=annotateAction(actionId,0,'L2');
   return freeze({
    ...ally,
    enemyReplies:freeze((RESPONSE_REPLY_TEMPLATES[actionId]||[]).map(reply=>freeze({
     ...annotateAction(reply.enemy,1,'L3'),
     condition:reply.why,hypothetical:true,
     allyReResponses:freeze(reply.answers.map(answer=>freeze({
      ...annotateAction(answer,0,'L4'),
      executeOnlyAfterObservedEnemyReply:true
     })))
    })))
   });
  }))
 });
}
const blueprintJobRequirements=teams=>freeze(teams.map((choices,i)=>freeze({
 roleOrdinal:i+1,eligibleJobs:freeze(choices),
 eligibleSquadNames:freeze(choices.map(j=>nameJob(j)+'隊'))
})));
export const VICTORY_ROUTE_RESPONSE_TREE=freeze(VICTORY_ROUTE_GOALS.map(def=>{
 const obj=objectiveForStage({kind:kindForType(def.objective)});
 const ownsGoal=def.team===0?obj.allyGoal:obj.enemyGoal;
 return freeze({
  level:'L0',
  id:def.id,objectiveType:def.objective,team:def.team,
  victoryCondition:ownsGoal,
  universalAlternative:'敵軍殲滅',
  winEvaluator:'evaluateBattleObjective',
  routes:freeze(def.routes.map(routeId=>{
   const r=ROUTE_BLUEPRINTS[routeId];if(!r)throw Error('Unknown route '+routeId);
   return freeze({
    level:'L1',id:routeId,name:r.name,
    owner:'prebattle_strategy',tacticId:r.tacticId,
    status:'route_template_not_verified_in_stage',
    featureRequirements:freeze(r.features),
    steps:freeze(r.steps),
    participatingSquadRoles:blueprintJobRequirements(r.teams),
    expectedSituations:freeze(relevantSituations(def.objective,routeId,r.encounters)
     .map(id=>situationTree(id))),
    unanticipatedEvents:'global_67_situation_catalog_after_telemetry_verification',
    pathCoordinates:'never_invented'
   });
  }))
 });
}));
export const JOB_COUNT=ALL_JOBS.length;
export const ROUTE_COUNT=Object.keys(ROUTE_BLUEPRINTS).length;
export const COVERAGE=freeze({
 winConditions:VICTORY_ROUTE_RESPONSE_TREE.length,
 routeChoices:VICTORY_ROUTE_RESPONSE_TREE.reduce((n,g)=>n+g.routes.length,0),
 expectedSituationEdges:VICTORY_ROUTE_RESPONSE_TREE.reduce((n,g)=>n+
  g.routes.reduce((z,r)=>z+r.expectedSituations.length,0),0),
 availableScenarioCatalog:BATTLE_SITUATION_DEFINITIONS.length,
 allScenariosAccessibleOnVerifiedEvent:true
});
/**
 * Inspect one explicit route -> situation -> intervention chain.
 * The "goal" and route are immutable; at each response tier the applicable
 * one-job squad must still exist and all object/job/MP safety checks run.
 */
export function findVictoryRouteResponsePath({goalId,routeId,situationId,
 allyActionId,enemyActionId,allyCounterCounterId}={}){
 const goal=VICTORY_ROUTE_RESPONSE_TREE.find(g=>g.id===goalId);
 const route=goal?.routes.find(r=>r.id===routeId);
 const situation=route?.expectedSituations.find(s=>s.id===situationId);
 const ally=situation?.responses.find(a=>a.id===allyActionId);
 const enemy=ally?.enemyReplies.find(e=>e.id===enemyActionId);
 const final=enemy?.allyReResponses.find(a=>a.id===allyCounterCounterId);
 if(!final)return null;
 return freeze({
  victory:goal.victoryCondition,route:route.name,
  situation:situation.title,
  ally:freeze({action:ally.label,jobSquads:ally.squadNames}),
  enemy:freeze({action:enemy.label,jobSquads:enemy.squadNames}),
  allyAgain:freeze({action:final.label,jobSquads:final.squadNames}),
  next:'L5: adjudicate or observe new situation',
  changesRoute:false
 });
}
/** List specific numbered one-job squads for the three response levels.
 * Job/commander eligibility is a PRECHECK, not proof that range, MP, target,
 * route or command cooldown allow immediate issue. */
export function resolveEligibleJobSquads({actionId,team=0,units=[]}={}){
 const candidates=new Map();
 const allowed=new Set(COUNTER_JOBS[actionId]||[]);
 const action=actionById.get(actionId);
 if(!action||!allowed.size)return [];
 for(const soldier of units){
  if(soldier.team!==team||soldier.isStrategist||soldier.alive===false||!(soldier.hp>0))continue;
  const key=String(soldier.squadId);
  if(!candidates.has(key))candidates.set(key,new Map());
  const found=candidates.get(key);
  found.set(soldier.jobId,(found.get(soldier.jobId)||0)+1);
 }
 return [...candidates].flatMap(([squadId,jobs])=>{
  // A mixed squad is excluded until prebattle recomposition makes it uniform.
  if(jobs.size!==1)return [];
  const [jobId,count]=jobs.entries().next().value;
  if(!allowed.has(jobId))return [];
  const commanders=units.filter(u=>u.team===team&&u.isStrategist&&
   String(u.squadId)===squadId);
  const commanderPresent=commanders.some(u=>u.alive!==false&&u.hp>0);
  return [freeze({
   squadId,jobId,jobName:nameJob(jobId),soldierCount:count,
   display:'第'+squadId+'隊（'+nameJob(jobId)+'）',
   jobEligible:true,
   commanderPresent,
   abilityImplemented:action.status==='supported',
   requiresRuntimeTargetMpAndRouteCheck:true,
   commandableByPolicy:commanderPresent&&action.status==='supported'
  })];
 }).sort((a,b)=>Number(a.squadId)-Number(b.squadId)||a.squadId.localeCompare(b.squadId));
}
/** Search the full global scenario catalog for contingencies that were NOT
 * anticipated by a route. They remain inactive until actually observed. */
export function lookupUnexpectedVictoryRouteEvent({goalId,routeId,situationId}={}){
 const goal=VICTORY_ROUTE_RESPONSE_TREE.find(g=>g.id===goalId);
 const route=goal?.routes.find(r=>r.id===routeId);
 if(!route||!situationById.has(situationId))return null;
 return situationTree(situationId,'unanticipated_verified_event');
}
