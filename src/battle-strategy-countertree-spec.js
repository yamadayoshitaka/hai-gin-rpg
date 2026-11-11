/**
 * Strategy -> observed situation -> allied response -> enemy reply ->
 * allied counter-counter. Specification graph, NOT a live AI controller.
 *
 * Every new battlefield observation starts a new chain; there are no turns.
 * Routes, target floors and crossings belong to the pre-battle tactic.
 */
import {TACTIC_DEFINITIONS} from './battle-tactics-preset-policy.js';
import {
 BATTLE_SITUATION_DEFINITIONS,
 BATTLE_COUNTERMEASURE_DEFINITIONS
} from './battle-countermeasure-situation-matrix.js';

export const HIERARCHY_SPEC_VERSION='1.0.0';
export const HIERARCHY_LAYERS=Object.freeze([
 'L0_PREBATTLE_ARMY_TACTIC',
 'L1_OBSERVED_SITUATION',
 'L2_ALLY_RESPONSE_CHOICES',
 'L3_ENEMY_REPLY_CHOICES',
 'L4_ALLY_COUNTER_COUNTER_CHOICES',
 'L5_REOBSERVE_OR_RESOLVE'
]);
export const HIERARCHY_RULES=Object.freeze({
 execution:'specification_only',
 simulation:'realtime_event_driven',
 maxMaterializedReplyDepth:2,
 winnerPolicy:'stage_objective_or_opposing_army_annihilation',
 routeOwner:'prebattle_strategy',
 routeChangeByManualResponse:false,
 whenRouteDestroyed:'choose_authored_fallback_route_automatically_or_hold',
 manualPlayerOrderCooldown:[60,90,120,150,180],
 manualCooldownCap:180,
 commandClock:'simulation_seconds',
 enemyAiImplementation:'not_guaranteed_by_spec',
 plannedActionsClickable:false,
 simultaneousThreats:'rank_events_then_reassess_after_each_confirmed_order',
 eventsAfterL4:'reenter_L1_on_observable_world_state_change'
});

/**
 * Expected or likely contacts for each opening multi-squad tactic.
 * Situation nodes are cross-linked (not copied) to the global 67-situation
 * registry. A shared contingency can occur under more than one strategy.
 */
export const STRATEGY_SCENARIO_LINKS=Object.freeze({
 balanced:[
  'victory','defeat_risk','rushing','fortified','fallback','encircled','flanked',
  'concentrated','outnumbered','superiority','ambush','surrender_enemy'
 ],
 fortress_defense:[
  'defense_clock','defense_breach','rushing','mounted_charge','flanked',
  'frontline_collapse','healer_available','friendly_door','building_weak',
  'enemy_unlock','attacker_defeated','time_winner'
 ],
 highground:[
  'enemy_tower','roof_enemy','height_advantage','ranged_volley','arcane_cast',
  'enemy_air','stair_chokepoint','roof_ally','flying_roof','fall_hazard'
 ],
 siege_break:[
  'siege_holding','locked_door','building_defense','tree_barricade',
  'enemy_demolition','collapse_risk','building_burning','cliff_block'
 ],
 bridge_denial:[
  'bridge_threat','bridge_blocked','bridge_destroyed','water_barrier',
  'enemy_demolition','ally_slow','flanked','trapped'
 ],
 objective_rush:[
  'capture_clock','capture_contested','capture_near','siege_commander',
  'time_winner','fallback','low_hp','encircled'
 ],
 rotation:[
  'rushing','concentrated','healer_enemy','healer_available',
  'frontline_collapse','low_hp','low_mp','status_stun','status_freeze'
 ],
 anti_siege:[
  'defense_clock','defense_breach','enemy_unlock','friendly_door','building_weak',
  'building_burning','collapse_risk','enemy_stealth','night_low_vision'
 ],
 arcane_barrage:[
  'ranged_volley','arcane_cast','smoke_obscured','unfavorable_weather',
  'enemy_air','summoner_enemy','low_mp','status_burn','tree_barricade'
 ],
 commander_hunt:[
  'siege_commander','commander_lost','enemy_stealth','mounted_charge',
  'superiority','healer_enemy','summoner_enemy','time_winner'
 ],
 infiltration:[
  'locked_door','stair_chokepoint','roof_enemy','enemy_stealth','enemy_unlock',
  'trapped','loot_found','ambush','status_stun'
 ],
 rear_guard:[
  'isolated_squad','fallen_rider','summon_lost','summon_ready','roof_ally',
  'fall_hazard','status_burn','healer_available','status_freeze','low_hp'
 ]
});
/**
 * For each L2 action, plausible enemy L3 replies and L4 player answers.
 * These are CONDITIONAL OPTIONS, not scripted forced enemy behaviour.
 * Every L3/L4 action still undergoes the same job, target and resource checks.
 * Basic AI may currently only support the four original orders.
 */
export const RESPONSE_REPLY_TEMPLATES=Object.freeze({
 charge:[
  {enemy:'defend',answers:['focus_squad','burn_building','retreat'],why:'敵が突撃を防御する'},
  {enemy:'retreat',answers:['focus_squad','hold'],why:'敵が退却し時間を稼ぐ'}
 ],
 defend:[
  {enemy:'burn_building',answers:['extinguish','retreat','focus_squad'],why:'敵が守備拠点を燃やす'},
  {enemy:'charge',answers:['hold','heal','focus_squad'],why:'敵が守備陣へ再突撃する'}
 ],
 hold:[
  {enemy:'charge',answers:['defend','focus_squad','heal'],why:'敵が待機陣へ突撃する'},
  {enemy:'burn_building',answers:['extinguish','retreat'],why:'敵が防衛施設を破壊する'}
 ],
 retreat:[
  {enemy:'charge',answers:['defend','focus_squad'],why:'敵が撤退を追撃する'},
  {enemy:'focus_squad',answers:['defend','heal','hold'],why:'敵が後退部隊へ集中攻撃する'}
 ],
 focus_squad:[
  {enemy:'defend',answers:['burn_building','charge','focus_squad'],why:'敵が狙われた部隊を防護する'},
  {enemy:'retreat',answers:['charge','hold'],why:'敵が狙われた部隊を退避する'}
 ],
 focus_commander:[
  {enemy:'defend',answers:['focus_squad','charge'],why:'敵が軍師に護衛隊を配置する'},
  {enemy:'retreat',answers:['focus_squad','hold'],why:'敵軍師が後退する'}
 ],
 burn_building:[
  {enemy:'extinguish',answers:['focus_squad','charge','burn_building'],why:'敵が火災を消火する'},
  {enemy:'repair',answers:['focus_squad','demolish','charge'],why:'敵が損傷建物を修復する'}
 ],
 burn_tree:[
  {enemy:'defend',answers:['focus_squad','charge'],why:'敵が焼却中の経路を防護する'},
  {enemy:'retreat',answers:['hold','focus_squad'],why:'敵が炎から退く'}
 ],
 demolish:[
  {enemy:'defend',answers:['focus_squad','burn_building'],why:'敵が障害物を守る'},
  {enemy:'repair',answers:['focus_squad','charge'],why:'敵が解体した構造を直す'}
 ],
 destroy_bridge:[
  {enemy:'defend',answers:['hold','focus_squad'],why:'敵が渡河路を封鎖する'},
  {enemy:'repair',answers:['focus_squad','defend'],why:'敵が橋を修復しようとする'}
 ],
 unlock_door:[
  {enemy:'fortify',answers:['unlock_door','burn_building','demolish'],why:'敵が城門を再施錠・補強する'},
  {enemy:'defend',answers:['focus_squad','charge'],why:'敵が開いた門を守備する'}
 ],
 fortify:[
  {enemy:'unlock_door',answers:['defend','focus_squad','fortify'],why:'敵盗賊が解錠を試みる'},
  {enemy:'burn_building',answers:['extinguish','repair','retreat'],why:'敵魔法使いが門を攻撃する'}
 ],
 repair:[
  {enemy:'burn_building',answers:['extinguish','defend','focus_squad'],why:'敵が修復施設を再攻撃する'},
  {enemy:'charge',answers:['defend','focus_squad'],why:'敵が修復作業中に突撃する'}
 ],
 extinguish:[
  {enemy:'burn_building',answers:['defend','focus_squad','extinguish'],why:'敵が再点火する'},
  {enemy:'charge',answers:['defend','heal'],why:'敵が消火作業中へ突撃する'}
 ],
 heal:[
  {enemy:'focus_squad',answers:['defend','retreat','charge'],why:'敵が僧侶隊・負傷隊を狙う'},
  {enemy:'charge',answers:['defend','hold','focus_squad'],why:'敵が治療を阻止する'}
 ],
 summon_vanguard:[
  {enemy:'defend',answers:['charge','focus_squad'],why:'敵が召喚獣の先行を阻む'},
  {enemy:'focus_squad',answers:['defend','summon_rescue'],why:'敵が先行召喚獣を集中攻撃する'}
 ],
 summon_intercept:[
  {enemy:'retreat',answers:['hold','charge'],why:'敵の飛行隊が距離を取る'},
  {enemy:'focus_squad',answers:['defend','summon_rescue'],why:'敵が迎撃召喚獣を狙う'}
 ],
 summon_rescue:[
  {enemy:'focus_squad',answers:['defend','retreat'],why:'敵が救助対象へ追撃する'},
  {enemy:'charge',answers:['defend','summon_intercept'],why:'敵が救助地点へ突撃する'}
 ],
 summon_roof:[
  {enemy:'defend',answers:['focus_squad','charge'],why:'敵が屋上を固める'},
  {enemy:'focus_squad',answers:['defend','summon_rescue'],why:'敵が上空の召喚獣を狙う'}
 ]
});
const situationById=new Map(BATTLE_SITUATION_DEFINITIONS.map(s=>[s.id,s]));
const actionById=new Map(BATTLE_COUNTERMEASURE_DEFINITIONS.map(a=>[a.id,a]));
const freezeRows=rows=>Object.freeze(rows.map(x=>Object.freeze(x)));
const meta=id=>{
 const a=actionById.get(id);
 if(!a)throw Error('Unknown countermeasure definition: '+id);
 return Object.freeze({
  actionId:a.id,label:a.label,engineStatus:a.status,
  channel:a.channel,requiredJobs:a.requiredJobs,targetType:a.target,
  routeEditAllowed:false
 });
};
function counterBranch(situation,actionId){
 const counter=meta(actionId),replies=RESPONSE_REPLY_TEMPLATES[actionId];
 if(!replies?.length)throw Error('No reply branches for '+actionId);
 return Object.freeze({
  stage:'L2_ALLY_RESPONSE',...counter,scenarioId:situation.id,
  opponentReplies:freezeRows(replies.map((reply,index)=>Object.freeze({
   stage:'L3_ENEMY_REPLY',
   ...meta(reply.enemy),
   hypothetical:true,
   enemyAiReady:['charge','defend','hold','retreat'].includes(reply.enemy),
   condition:reply.why,
   ordinal:index,
   counterCounterOptions:freezeRows(reply.answers.map((id,answerIndex)=>({
    stage:'L4_ALLY_COUNTER_COUNTER',
    ...meta(id),ordinal:answerIndex,
    after:'reobserve_or_adjudicate'
   })))
  })))
 });
}
const sharedCategories=new Set(['force','status','visibility','result']);
export const STRATEGY_RESPONSE_HIERARCHY=freezeRows(TACTIC_DEFINITIONS.map(strategy=>Object.freeze({
 stage:'L0_PREBATTLE_ARMY_TACTIC',
 tacticId:strategy.id,title:strategy.name,
 minSquads:strategy.minSquads,routeAuthority:strategy.routeAuthority,
 squadRolesBoundBeforeBattle:true,
 situationBranches:freezeRows((STRATEGY_SCENARIO_LINKS[strategy.id]||[]).map(id=>{
  const s=situationById.get(id);
  if(!s)throw Error('Unknown situation: '+id);
  return Object.freeze({
   stage:'L1_OBSERVED_SITUATION',id:s.id,title:s.title,category:s.category,
   observableSignal:s.signal,
   probability:'not_assumed',
   relationship:sharedCategories.has(s.category)?'shared_contingency':'strategic_contact',
   allyResponseChoices:freezeRows(s.actions.map(actionId=>counterBranch(s,actionId)))
  });
 }))
})));
export const HIERARCHY_SCENARIO_COVERAGE=Object.freeze(
 [...new Set(STRATEGY_RESPONSE_HIERARCHY.flatMap(p=>p.situationBranches.map(s=>s.id)))].sort()
);
export const describeHierarchyPath=(tacticId,situationId,allyActionId,enemyActionId,allyReplyId)=>{
 const strategy=STRATEGY_RESPONSE_HIERARCHY.find(t=>t.tacticId===tacticId);
 const situation=strategy?.situationBranches.find(s=>s.id===situationId);
 const response=situation?.allyResponseChoices.find(c=>c.actionId===allyActionId);
 const reply=response?.opponentReplies.find(c=>c.actionId===enemyActionId);
 const answer=reply?.counterCounterOptions.find(c=>c.actionId===allyReplyId);
 if(!answer)return null;
 return Object.freeze({
  tactic:strategy.title,situation:situation.title,allyResponse:response.label,
  enemyReply:reply.label,allyCounterCounter:answer.label,
  requirement:'Each action is valid only when actor, target, resources and cooldown permit',
  next:'new battlefield event or victory adjudicator'
 });
};
