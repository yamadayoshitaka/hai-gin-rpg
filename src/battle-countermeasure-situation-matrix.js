/**
 * Battle situation / countermeasure matrix.
 *
 * Routes (stairs, rooftops, rivers, flanking corridors, safe summon landing)
 * belong exclusively to PRE-BATTLE army strategy. Never create a route/order
 * destination from a reactive countermeasure. Live commands are the existing
 * four squad orders, supported object missions and support requests.
 *
 * A future mechanic is recorded with status=planned and is never executable.
 */
const rows = `
victory|objective|敵軍殲滅を確認|enemy_destroyed|hold
defeat_risk|objective|味方兵力が全滅寸前|ally_critical|retreat,defend,heal
defense_clock|objective|制限時間まで防衛|defend_timer|hold,defend,repair,fortify
defense_breach|objective|敵が味方の拠点を占拠|enemy_in_zone|defend,charge,heal
capture_clock|objective|敵陣制圧の残り時間が少ない|capture_deadline|charge,focus_squad,summon_vanguard
capture_contested|objective|制圧区域が敵味方で競合|zone_contested|charge,defend,focus_squad
capture_near|objective|敵拠点の制圧が間近|capture_near|hold,defend
siege_commander|objective|攻城対象の敵主将を確認|enemy_commander|focus_commander,charge
siege_holding|objective|攻城戦で敵が立てこもる|siege_blocked|burn_building,unlock_door,demolish,charge
attacker_defeated|objective|攻撃側が壊滅|attacker_destroyed|hold
rushing|enemy|敵の全軍突撃・進軍|rush|defend,hold,focus_squad,burn_building
fortified|enemy|敵軍が守備・待機|fortified|charge,burn_building,unlock_door
fallback|enemy|敵軍が後退|fallback|charge,focus_squad,hold
encircled|enemy|味方が包囲された|encircled|retreat,defend,summon_rescue
flanked|enemy|敵が側面・背面に回り込む|flanked|defend,charge,focus_squad
concentrated|enemy|味方の特定部隊に集中攻撃|concentrated|defend,heal,retreat
ranged_volley|enemy|弓兵による集中射撃|enemy_archers|defend,retreat,charge
arcane_cast|enemy|敵魔法使いが詠唱|enemy_casting|charge,defend,retreat
healer_enemy|enemy|敵の僧侶による回復|enemy_healing|focus_squad,charge
summoner_enemy|enemy|敵の召喚士・召喚獣が出現|enemy_summon|defend,focus_squad,charge
mounted_charge|enemy|敵騎兵の突撃|enemy_cavalry|defend,hold,focus_squad
enemy_air|enemy|敵の飛空召喚獣が接近|enemy_air|defend,focus_squad,summon_intercept
enemy_tower|enemy|敵が塔・屋上から攻撃|highground|defend,retreat,charge,summon_rescue
enemy_stealth|enemy|敵の忍者が潜入|enemy_ninja|defend,hold,focus_squad
enemy_unlock|enemy|敵に門の鍵を開けられた|enemy_unlock|fortify,defend,charge
enemy_demolition|enemy|敵が建物・橋を攻撃|enemy_demolition|defend,repair,extinguish
stair_chokepoint|terrain|狭い階段を敵が占有|stair_blocked|defend,charge,demolish
bridge_blocked|terrain|橋の通行を敵が封鎖|bridge_blocked|defend,charge,demolish
bridge_destroyed|terrain|橋が崩落した|bridge_destroyed|hold,defend
bridge_threat|terrain|破壊可能な敵の渡河橋を確認|enemy_bridge|destroy_bridge,defend
water_barrier|terrain|水域で移動が制限される|water_barrier|defend,hold
cliff_block|terrain|崖・段差で進軍が止まる|cliff_block|hold,defend,summon_rescue
roof_ally|terrain|味方が屋上で孤立|ally_rooftop_isolated|defend,heal,summon_rescue
roof_enemy|terrain|敵が屋上・2階に布陣|enemy_upper_floor|charge,retreat,defend
height_advantage|terrain|味方が高所を確保|ally_highground|hold,defend
trapped|terrain|味方が障害物に閉じ込められた|unit_trapped|demolish,retreat,summon_rescue
flying_roof|terrain|飛空召喚獣で屋上に届く|friendly_flying_summon|charge,summon_roof
locked_door|object|敵の施錠扉に阻まれる|enemy_locked_door|unlock_door,burn_building,defend
friendly_door|object|味方の城門が突破されそう|friendly_door|fortify,defend,hold
building_defense|object|敵が建物を盾にしている|enemy_building|burn_building,demolish,charge
building_weak|object|味方施設の耐久力低下|friendly_damaged|repair,defend
building_burning|object|味方施設が燃えている|friendly_fire|extinguish,repair,defend
tree_barricade|object|敵陣の樹木が射線を塞ぐ|enemy_tree|burn_tree,demolish,defend
collapse_risk|object|施設の崩落危険|collapse_risk|retreat,repair
loot_found|object|宝箱を発見|treasure_nearby|hold
frontline_collapse|force|前衛が崩壊寸前|ally_critical|retreat,defend,heal
healer_available|force|味方に負傷者と僧侶がいる|wounded_with_priest|heal,defend
low_hp|force|部隊の残HPが少ない|low_hp|retreat,heal,defend
low_mp|force|魔法部隊のMPが不足|low_mp|defend,retreat
outnumbered|force|敵より兵数が大幅に少ない|outnumbered|defend,retreat,heal
superiority|force|味方の兵数が大幅に多い|superiority|charge,focus_squad
commander_lost|force|味方軍師が戦死|commander_dead|hold
isolated_squad|force|味方部隊が孤立|ally_isolated|defend,retreat,summon_rescue
fallen_rider|force|騎乗者が落下・重傷|rider_fallen|heal,defend,summon_rescue
summon_lost|force|召喚獣が消滅|summon_lost|defend,heal
summon_ready|force|味方の召喚獣が行動可能|summon_ready|charge,summon_vanguard,summon_intercept
ally_slow|force|味方の部隊移動が低下|ally_slow|defend,hold
ambush|visibility|伏兵の接敵を確認|ambush|defend,retreat,focus_squad
night_low_vision|visibility|夜間で敵の視認が困難|night_visibility|defend,hold
smoke_obscured|visibility|煙で射線が通らない|smoke|defend,hold
unfavorable_weather|visibility|悪天候で攻撃効率が低下|storm|defend,hold
status_stun|status|味方が行動不能|status_stun|defend,heal,retreat
status_burn|status|味方が継続燃焼ダメージ|status_burn|heal,retreat,extinguish
status_freeze|status|味方が凍結|status_freeze|defend,heal
fall_hazard|status|味方が落下危険にある|fall_risk|defend,summon_rescue,retreat
surrender_enemy|result|敵が降参した|enemy_surrender|hold
time_winner|result|時間切れが目前|time_critical|charge,hold,defend
`.trim().split('\n');
export const BATTLE_SITUATION_DEFINITIONS=Object.freeze(rows.map(row=>{
 const [id,category,title,signal,actions]=row.split('|');
 return Object.freeze({id,category,title,signal,actions:Object.freeze(actions.split(','))});
}));
const actionRows=[
 ['charge','⚔ 突撃','order','charge',null,null],
 ['defend','🛡 守備','order','defend',null,null],
 ['hold','⏸ 待機','order','hold',null,null],
 ['retreat','↘ 退却','order','retreat',null,null],
 ['focus_squad','🎯 敵部隊集中攻撃','mission','eliminate_squad',null,'enemy_squad'],
 ['focus_commander','♟ 敵主将討伐','mission','eliminate_commander',null,'enemy_commander'],
 ['burn_building','🔥 魔法で建物を焼却','mission','burn_building',['mage'],'enemy_building'],
 ['burn_tree','🔥 魔法で樹木を焼却','mission','burn_tree',['mage'],'enemy_tree'],
 ['demolish','🧨 忍者で障害物破壊','mission','demolish_structure',['ninja'],'enemy_structure'],
 ['destroy_bridge','🌉 橋を破壊','mission','destroy_bridge',['ninja','mage'],'enemy_bridge'],
 ['unlock_door','🗝 敵門の解錠','mission','unlock_door',['thief'],'enemy_door'],
 ['fortify','🔒 味方門の施錠強化','mission','fortify_lock',['thief'],'friendly_door'],
 ['repair','🛠 施設修復','mission','repair_structure',['ninja','mage'],'friendly_damaged'],
 ['extinguish','💧 火災消火','mission','extinguish_fire',['mage'],'friendly_burning'],
 ['heal','✚ 僧侶の支援回復','support','heal',null,'friendly_wounded'],
 ['summon_vanguard','🐉 召喚獣を先駆け','planned','summon_vanguard',['summoner'],'flying_summon'],
 ['summon_intercept','🪽 飛行召喚獣で迎撃','planned','summon_intercept',['summoner'],'flying_summon'],
 ['summon_rescue','🪽 飛行召喚獣で高所救助','planned','summon_rescue',['summoner'],'flying_summon'],
 ['summon_roof','🪽 飛行召喚獣で屋上救出','planned','summon_roof',['summoner'],'flying_summon']
];
export const BATTLE_COUNTERMEASURE_DEFINITIONS=Object.freeze(actionRows.map(([id,label,channel,type,jobs,target])=>
 Object.freeze({id,label,channel,type,requiredJobs:Object.freeze(jobs||[]),target,
  status:channel==='planned'?'planned':'supported',changesRoute:false})));
const byAction=new Map(BATTLE_COUNTERMEASURE_DEFINITIONS.map(a=>[a.id,a]));
export const countermeasureById=id=>byAction.get(id)??null;
const live=u=>u&&u.alive!==false&&Number(u.hp??1)>0;
const unitsForTeam=(units,team)=>units.filter(u=>u.team===team&&live(u)&&!u.isStrategist);
const pct=u=>Number(u.hp)/Math.max(1,Number(u.maxHp)||1);
const structureAlive=o=>o&&o.alive!==false&&(o.hp==null||o.hp>0);
const structureList=o=>Array.isArray(o)?o:[];
const pos=u=>({x:Number(u.x??u.cell?.x),z:Number(u.z??u.cell?.z)});
const near=(a,b,range)=>Number.isFinite(pos(a).x)&&Number.isFinite(pos(b).x)&&
 Math.hypot(pos(a).x-pos(b).x,pos(a).z-pos(b).z)<=range;
/**
 * Signals with a known provider are inferred from real unit / structure state.
 * Other signals remain dormant until a combat event emitter supplies them.
 * This avoids claiming a stealth enemy is visible or a rescued rider exists.
 */
export function scanBattleSignals({enemySquads=[],allies=[],enemies=[],structures=[],
 objective=null,elapsedSeconds=0,allyInZone=false,enemyInZone=false,
 signals=[],remainingSeconds=null}={}){
 const values=new Set(signals.filter(s=>typeof s==='string'));
 const active=enemySquads.filter(s=>s.alive!==false&&(s.soldiers??1)>0);
 const mode=s=>String(s.mode||'charge');
 const charge=active.filter(s=>['charge','move','mission'].includes(mode(s))).length;
 const guard=active.filter(s=>['defend','hold'].includes(mode(s))).length;
 if(active.some(s=>s.highGround))values.add('highground');
 if(active.length&&charge>=Math.max(2,Math.ceil(active.length*.6)))values.add('rush');
 if(active.length&&guard>=Math.max(1,Math.ceil(active.length*.6)))values.add('fortified');
 if(active.some(s=>mode(s)==='retreat'))values.add('fallback');
 if(objective?.type==='defend_timer')values.add('defend_timer');
 if(objective?.type==='capture_zone'&&(remainingSeconds??Infinity)<45)values.add('capture_deadline');
 if(objective?.type==='siege')values.add('siege_blocked');
 if(enemyInZone&&objective?.defenderTeam===0)values.add('enemy_in_zone');
 if(enemyInZone&&allyInZone)values.add('zone_contested');
 if(allies.some(u=>live(u)&&!u.isStrategist&&pct(u)<.3))values.add('low_hp');
 const alliesAlive=unitsForTeam(allies,0),enemiesAlive=unitsForTeam(enemies,1);
 if(alliesAlive.length&&enemiesAlive.length>=alliesAlive.length*1.7)values.add('outnumbered');
 if(enemiesAlive.length&&alliesAlive.length>=enemiesAlive.length*1.7)values.add('superiority');
 if(alliesAlive.length&&alliesAlive.reduce((s,u)=>s+pct(u),0)/alliesAlive.length<.3)
  values.add('ally_critical');
 if(!enemiesAlive.length&&enemies.length)values.add('enemy_destroyed');
 if(allies.some(u=>u.team===0&&u.isStrategist&&!live(u)))values.add('commander_dead');
 if(enemies.some(u=>u.team===1&&u.isStrategist&&live(u)))values.add('enemy_commander');
 if(allies.some(u=>u.team===0&&live(u)&&!u.isStrategist&&pct(u)<.75)&&
  allies.some(u=>u.team===0&&live(u)&&u.jobId==='priest'))values.add('wounded_with_priest');
 if(allies.some(u=>u.team===0&&live(u)&&['mage','priest','summoner'].includes(u.jobId)&&
    Number(u.mp)<=1))values.add('low_mp');
 if(allies.some(u=>u.team===0&&live(u)&&
  (u.highGroundFloor>1&&u.highGroundPhase===2||Number(u.indoorFloor)>1)))
  values.add('ally_highground');
 if(enemies.some(u=>u.team===1&&live(u)&&
  (u.highGroundFloor>1&&u.highGroundPhase===2||Number(u.indoorFloor)>1)))
  values.add('enemy_upper_floor');
 if(structures.some(o=>structureAlive(o)&&o.category==='summon'&&o.team===0))values.add('summon_ready');
 if(structures.some(o=>structureAlive(o)&&o.category==='summon'&&o.team===0&&o.flying))
  values.add('friendly_flying_summon');
 if(structures.some(o=>structureAlive(o)&&o.category==='summon'&&o.team===1))
  values.add('enemy_summon');
 if(structures.some(o=>structureAlive(o)&&o.category==='summon'&&o.team===1&&o.flying))
  values.add('enemy_air');
 if(structures.some(o=>structureAlive(o)&&o.type==='door'&&o.team===1&&o.locked))
  values.add('enemy_locked_door');
 if(structures.some(o=>structureAlive(o)&&o.type==='door'&&o.team===0&&o.lockLevel<5))
  values.add('friendly_door');
 if(structures.some(o=>structureAlive(o)&&o.category==='structure'&&
  ['building','tree'].includes(o.type)&&o.team===1))
  values.add('enemy_building');
 if(structures.some(o=>structureAlive(o)&&o.type==='tree'&&o.team===1))
  values.add('enemy_tree');
 if(structures.some(o=>structureAlive(o)&&o.type==='bridge'&&o.team!==0))
  values.add('enemy_bridge');
 if(structures.some(o=>structureAlive(o)&&o.category==='structure'&&o.team===0&&
   o.maxHp>0&&o.hp<o.maxHp))values.add('friendly_damaged');
 if(structures.some(o=>structureAlive(o)&&o.category==='structure'&&o.team===0&&
  o.burningUntil>elapsedSeconds))values.add('friendly_fire');
 if(remainingSeconds!=null&&remainingSeconds>=0&&remainingSeconds<=30)values.add('time_critical');
 return values;
}
function candidateTarget(def,ctx){
 const structures=structureList(ctx.structures),units=ctx.units||[];
 const own=ctx.team??0;
 const enemy=1-own;
 const close=(a,b)=>{const x=pos(a),y=pos(b);return Number.isFinite(x.x)&&Number.isFinite(y.x)?
  Math.hypot(x.x-y.x,x.z-y.z):Infinity;};
 const source=ctx.squadCenter||ctx.members?.[0]||{x:0,z:0};
 const eligible=o=>structureAlive(o)&&o.category==='structure';
 let choices=[];
 switch(def.target){
  case 'enemy_building':choices=structures.filter(o=>eligible(o)&&o.team===enemy&&o.type==='building');break;
  case 'enemy_tree':choices=structures.filter(o=>eligible(o)&&o.team===enemy&&o.type==='tree');break;
  case 'enemy_structure':choices=structures.filter(o=>eligible(o)&&o.team===enemy&&['building','tree'].includes(o.type));break;
  case 'enemy_bridge':choices=structures.filter(o=>eligible(o)&&o.type==='bridge'&&o.team!==own);break;
  case 'enemy_door':choices=structures.filter(o=>eligible(o)&&o.team===enemy&&o.type==='door'&&o.locked);break;
  case 'friendly_door':choices=structures.filter(o=>eligible(o)&&o.team===own&&o.type==='door'&&(o.lockLevel??0)<5);break;
  case 'friendly_damaged':choices=structures.filter(o=>eligible(o)&&o.team===own&&
   o.maxHp>0&&o.hp<o.maxHp);break;
  case 'friendly_burning':choices=structures.filter(o=>eligible(o)&&o.team===own&&o.burningUntil>(ctx.elapsedSeconds??0));break;
  case 'enemy_commander':choices=units.filter(u=>u.team===enemy&&u.isStrategist&&live(u));break;
  case 'enemy_squad':choices=units.filter(u=>u.team===enemy&&!u.isStrategist&&live(u));break;
  case 'friendly_wounded':choices=units.filter(u=>u.team===own&&!u.isStrategist&&live(u)&&u.hp<u.maxHp);break;
  case 'flying_summon':choices=structures.filter(o=>structureAlive(o)&&o.category==='summon'&&o.team===own&&o.flying);break;
  default:return null;
 }
 choices.sort((a,b)=>close(a,source)-close(b,source)||String(a.id).localeCompare(String(b.id)));
 const target=choices[0];if(!target)return null;
 if(def.target==='enemy_squad'||def.target==='enemy_commander'||def.target==='friendly_wounded')
  return {targetSquadId:String(target.squadId),x:Math.round(pos(target).x),z:Math.round(pos(target).z)};
 return {targetId:String(target.id),x:Math.round(pos(target).x),z:Math.round(pos(target).z)};
}
/**
 * Multiple ranked options, not just one generic counter. Never offers an
 * unsupported ability as a clickable button, never rewrites a route.
 */
export function getCountermeasureOptions(context={}){
 const squad=context.members||[],jobs=new Set(squad.filter(live).map(u=>u.jobId));
 const allUnits=context.units||[];
 const signals=scanBattleSignals({...context,allies:allUnits,enemies:allUnits});
 const active=BATTLE_SITUATION_DEFINITIONS.filter(s=>signals.has(s.signal));
 const options=new Map();
 const statuses={};
 const append=(id,scenario,weight)=>{
  const definition=byAction.get(id);
  if(!definition)return;
  const hasJob=definition.requiredJobs.length===0||
   definition.requiredJobs.some(job=>jobs.has(job));
  const target=candidateTarget(definition,context);
  const targetOk=!definition.target||Boolean(target);
  const hasHealer=definition.channel!=='support'||allUnits.some(u=>u.team===(context.team??0)&&
   u.jobId==='priest'&&live(u));
  const engineSupports=!(definition.type==='eliminate_commander'&&!context.massBattle);
  const enabled=definition.status==='supported'&&hasJob&&targetOk&&hasHealer&&
   engineSupports&&context.commanderAlive!==false;
  const reason=definition.status==='planned'?'未実装：専用AI・救助/輸送判定が必要':
    !hasJob?'この部隊に必要ジョブがいません':
    !targetOk?'有効な対象がいません':
    !hasHealer?'僧侶がいません':!engineSupports?'この戦闘規模では未対応':
    context.commanderAlive===false?'軍師が戦死したため発令不可':'使用可能';
  const prior=options.get(id);
  const score=weight+(enabled?20:0);
  if(!prior||score>prior.score)options.set(id,{...definition,enabled,reason,target,
   scenarioId:scenario.id,scenarioTitle:scenario.title,score});
 };
 // Priority is stable and determined by the scenario, never random.
 for(let i=0;i<active.length;i++)for(const [j,id] of active[i].actions.entries())
  append(id,active[i],100-i*1.25-j*.1);
 // Ensure defensive and offensive fallbacks when no special signal exists.
 if(!active.length)for(const [i,id] of ['defend','charge','hold','retreat'].entries())
  append(id,{id:'standby',title:'戦況を確認中'},40-i);
 return {
  activeSituations:active,
  options:[...options.values()].sort((a,b)=>Number(b.enabled)-Number(a.enabled)||
   b.score-a.score||a.id.localeCompare(b.id)),
  signals:[...signals]
 };
}
export function validateResponseIsNotRoute(response){
 return !!response&&response.changesRoute===false&&
  (response.channel==='order'||response.channel==='mission'||response.channel==='support');
}
