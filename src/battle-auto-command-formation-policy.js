/**
 * Pure policy for the allied auto-command / squad-formation prototype.
 * No scene/Worker mutations: the caller alone applies a proposed order.
 * Strategy and inventory remain owned by the existing battle systems.
 */
export const AUTO_ORDER_MODES=Object.freeze(['charge','defend','hold','retreat']);
export const AUTO_ORDER_CHECK_SECONDS=6;
export const AUTO_ORDER_MIN_DWELL_SECONDS=20;
export const FORMATION_DOCTRINES=Object.freeze({
 fish_scale:Object.freeze({name:'魚鱗',attack:1.20,defense:.90,ranged:1,speed:1,terrain:'open'}),
 crane_wing:Object.freeze({name:'鶴翼',attack:1.10,defense:.90,ranged:1.10,speed:.95,terrain:'open'}),
 square_circle:Object.freeze({name:'方円',attack:.90,defense:1.25,ranged:1,speed:.85,terrain:'hold'}),
 diagonal:Object.freeze({name:'雁行',attack:1,defense:.95,ranged:1.20,speed:1,terrain:'open'}),
 snake:Object.freeze({name:'長蛇',attack:.90,defense:.85,ranged:1,speed:1.20,terrain:'choke'}),
 arrowhead:Object.freeze({name:'鋒矢',attack:1.30,defense:.85,ranged:.90,speed:1,terrain:'open'})
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min));
const soldierAlive=u=>u&&u.alive!==false&&Number(u.hp)>0&&!u.isStrategist;
const jobRole=u=>{
 const name=String(u.jobId||u.job?.id||u.job?.name||'').toLowerCase();
 return ['priest','healer','僧侶'].includes(name)?'heal':
 ['archer','mage','summoner','弓使い','魔法使い','召喚士'].includes(name)?'range':'front';
};
export function summarizeSquad(members=[]){
 const soldiers=members.filter(u=>!u?.isStrategist);
 const living=soldiers.filter(soldierAlive);
 const hpMax=living.reduce((sum,u)=>sum+Math.max(0,Number(u.maxHp)||0),0);
 const hp=living.reduce((sum,u)=>sum+Math.max(0,Number(u.hp)||0),0);
 const roles={front:0,range:0,heal:0};
 for(const soldier of living)roles[jobRole(soldier)]++;
 return {total:soldiers.length,alive:living.length,
   aliveRatio:living.length/Math.max(1,soldiers.length),
   hpRatio:hpMax?clamp(hp/hpMax,0,1):0,roles,
   commanderAlive:members.some(u=>u?.isStrategist&&u.alive!==false&&Number(u.hp)>0)};
}
/**
 * A suggestion, not a new command. Existing cooldowns and manually targeted
 * missions are authoritative. Auto does not consume items or command time.
 */
export function chooseAutoSquadOrder({
 metrics,enabled=true,currentOrder='charge',lastChangedAt=-Infinity,now=0,
 manualOverride=false,activeObjective=false,enemyDistance=Infinity,
 localFriendCount=1,localEnemyCount=0,defendAnchor=false
}={}){
 if(!enabled)return {change:false,order:currentOrder,reason:'自動号令OFF'};
 if(!metrics?.alive)return {change:false,order:currentOrder,reason:'兵士不在'};
 if(!metrics.commanderAlive)return {change:false,order:currentOrder,reason:'軍師戦死・新規指揮不可'};
 if(manualOverride)return {change:false,order:currentOrder,reason:'手動号令を優先'};
 if(activeObjective||['mission','explore','move','heal','support'].includes(currentOrder))
   return {change:false,order:currentOrder,reason:'固定作戦・個別目標を優先'};
 const severelyWounded=metrics.hpRatio<.30||metrics.aliveRatio<=.25;
 const nearbyOutnumbered=localEnemyCount>=4&&localEnemyCount>Math.max(1,localFriendCount)*1.5;
 let order='charge',reason='攻勢を継続';
 if(severelyWounded){order='retreat';reason='壊滅を回避'}
 else if(metrics.hpRatio<.58||metrics.aliveRatio<.55||nearbyOutnumbered){
   order='defend';reason='損耗または局地的劣勢を立て直す';
 }else if(defendAnchor&&enemyDistance>20){order='hold';reason='防衛拠点を維持'}
 else if(localEnemyCount===0&&enemyDistance===Infinity){order='charge';reason='敵を探索しながら進軍'}
 if(order===currentOrder)return {change:false,order,reason};
 // Retreat overrides dwell only in a genuinely critical state.
 const elapsed=clamp(now,0,Infinity)-Number(lastChangedAt);
 if(!severelyWounded&&elapsed<AUTO_ORDER_MIN_DWELL_SECONDS)
   return {change:false,order:currentOrder,reason:'号令連打抑止'};
 return {change:true,order,reason};
}
/** Recommend a physical formation from real job composition and terrain. */
export function chooseSquadFormation({
 metrics,terrain='open',locked=null,enemyRatio=1,flankThreat=false,order='charge'
}={}){
 if(locked&&FORMATION_DOCTRINES[locked])return locked;
 if(terrain==='bridge'||terrain==='stairs'||terrain==='corridor'||terrain==='choke')
   return 'snake';
 if(order==='defend'||order==='hold'||metrics?.hpRatio<.48||enemyRatio>1.65)
   return 'square_circle';
 const roles=metrics?.roles||{front:0,range:0,heal:0};
 const total=Math.max(1,(roles.front||0)+(roles.range||0)+(roles.heal||0));
 if((roles.range||0)/total>=.44)return 'diagonal';
 if(flankThreat)return 'crane_wing';
 if((roles.front||0)/total>=.67&&enemyRatio<.85)return 'arrowhead';
 return 'fish_scale';
}
/**
 * Applied only while a squad maintains its slots. The commander aura is
 * calculated by the existing system, not included here.
 */
export function formationBuffMultipliers(formation,{
 cohesion=1,commanderAlive=true,aliveRatio=1,bonusCap=1.30
}={}){
 const base=FORMATION_DOCTRINES[formation]||FORMATION_DOCTRINES.fish_scale;
 const density=clamp(cohesion,0,1),survival=clamp(aliveRatio,0,1);
 const activation=(density<.55?0:(density-.55)/.45)*Math.min(1,survival/.6)*
   (commanderAlive?1:.25);
 const bonus=(factor)=>1+(factor-1)*activation;
 return {attack:clamp(bonus(base.attack),.75,bonusCap),
   defense:clamp(bonus(base.defense),.75,bonusCap),
   ranged:clamp(bonus(base.ranged),.75,bonusCap),
   speed:clamp(bonus(base.speed),.75,1.20),activation};
}
/**
 * Squad-level synergy is deliberately bounded. This is a recommendation
 * multiplier to combine centrally with aura / item buffs later.
 */
export function adjacentSquadSynergy({nearbySupport=0,nearbyShield=0,nearbyArchers=0}={}){
 const support=Math.min(2,Math.max(0,nearbySupport));
 const shields=Math.min(2,Math.max(0,nearbyShield));
 const archers=Math.min(2,Math.max(0,nearbyArchers));
 return {attack:1+Math.min(.10,support*.04+archers*.01),
  defense:1+Math.min(.10,shields*.04+support*.01),
  ranged:1+Math.min(.10,archers*.04+shields*.01)};
}
/** Army layout is strategic intent; it never overrides local terrain routes. */
export function chooseArmyDeployment({objective='eliminate',enemyFlankThreat=false,
 supportSquads=0,frontSquads=0}={}){
 if(objective==='recovery'||enemyFlankThreat)return 'layered_defense';
 if(objective==='environment_prepare')return 'siege';
 if(frontSquads>=supportSquads+3)return 'center_breakthrough';
 return 'flexible_wings';
}
