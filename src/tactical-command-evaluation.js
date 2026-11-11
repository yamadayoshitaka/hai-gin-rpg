/**
 * Tactical command evaluation v2.1.
 * Shared by inn, deployment and battle UIs. Estimates are advisory until the
 * underlying battle resolver consumes a tactical outcome; ordinary orders
 * still execute through their existing authoritative handlers.
 */
export const RARITY_WEIGHTS=Object.freeze({N:1,R:1.5,UR:3});
export const COMMAND_LABELS=Object.freeze({charge:'突撃',defend:'守備',hold:'待機',retreat:'退却'});
export const STRATEGIST_SPECIALTIES=Object.freeze({
 assault:'攻城戦術',defense:'防衛戦術',mobility:'機動戦術',
 support:'支援戦術',magic:'魔導戦術',disruption:'妨害戦術'
});
const JOB_ALIASES=Object.freeze({
 knight:'knight',swordsman:'knight','騎士':'knight','剣士':'knight',
 paladin:'shield','盾騎士':'shield','盾戦士':'shield','盾騎士隊':'shield',
 monk:'monk','格闘家':'monk',spear:'spear','槍兵':'spear',
 ninja:'ninja','忍者':'ninja',assassin:'ninja',
 rogue:'thief',thief:'thief','盗賊':'thief','シーフ':'thief',
 archer:'archer','弓使い':'archer',ranger:'archer',
 mage:'mage','魔法使い':'mage',priest:'priest',healer:'priest','僧侶':'priest',
 summoner:'summoner','召喚士':'summoner'
});
export const COMMAND_TUNING=Object.freeze({
 charge:{threshold:50,coefficients:{knight:1.25,monk:1.25,spear:1.1,shield:.75},specialties:['assault','mobility']},
 defend:{threshold:40,coefficients:{shield:1.55,spear:1.25,knight:1.05},specialties:['defense']},
 hold:{threshold:20,coefficients:{archer:1.2,shield:1.1},specialties:['defense']},
 retreat:{threshold:45,coefficients:{ninja:1.4,knight:1.25,thief:1.15},specialties:['mobility','defense']}
});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const rarityWeight=rarity=>RARITY_WEIGHTS[String(rarity??'N').toUpperCase()]??1;
const count=value=>Math.max(0,Math.floor(Number(value)||0));
export const normalizeBattleJob=value=>JOB_ALIASES[String(value??'').toLowerCase()]??'other';
export function squadPower(groups=[]){
 return groups.reduce((sum,group)=>sum+count(group.count??1)*rarityWeight(group.rarity),0);
}
export function activeBattleUnits(units=[]){
 return units.filter(u=>u&&!u.isStrategist&&u.alive!==false&&
  (u.hp===undefined||u.hp>0)&&!u.defeated);
}
export function tacticalCooldownSeconds(level=1){
 const L=clamp(Math.floor(Number(level)||1),1,99);
 return Math.max(40,Math.round(120-80*(L-1)/98));
}
export function evaluateTacticalOrder({
 units=[],opponents=[],mode='charge',commander=null,difficulty=null,contextBonus=0,
 localResistance=null
}={}){
 const rule=COMMAND_TUNING[mode];
 const soldiers=activeBattleUnits(units);
 const power=squadPower(soldiers);
 if(!rule||!soldiers.length)return {mode,eligible:false,power,executionPower:0,effect:0,success:0,commanderBonus:0,expected:0};
 const executionPower=soldiers.reduce((sum,u)=>{
  const job=normalizeBattleJob(u.jobId??u.job?.id??u.job?.name??u.job);
  return sum+rarityWeight(u.rarity)*(rule.coefficients[job]??1);
 },0);
 const T=Math.max(1,Number.isFinite(Number(difficulty))&&difficulty!==null?Number(difficulty):rule.threshold);
 const resistance=localResistance==null?squadPower(activeBattleUnits(opponents)):Math.max(0,Number(localResistance)||0);
 const specialty=commander?.specialty;
 const commanderBonus=commander?.alive===false?0:
  rule.specialties.includes(specialty)?clamp(Math.round(Number(commander.specialtyBonusPt)||10),0,15):0;
 const effect=clamp(Math.round(100*executionPower/(executionPower+T)),0,100);
 const success=clamp(Math.round(50+45*(executionPower-T-resistance)/
  (executionPower+T+resistance)+commanderBonus+clamp(Number(contextBonus)||0,-15,15)),5,95);
 return {mode,eligible:true,power,executionPower,effect,success,
  commanderBonus,expected:Math.round(effect*success/100),resistance,difficulty:T};
}
export function rankTacticalOrders(orders,settings={}){
 return Object.keys(COMMAND_TUNING).map(mode=>evaluateTacticalOrder({...settings,mode}))
  .sort((a,b)=>b.expected-a.expected);
}
export function healthSituation(previous,current){
 if(!previous||!current||current.total<=0||current.n<=0)return null;
 const ratio=current.n/current.total,oldRatio=previous.n/Math.max(1,previous.total);
 if(ratio<=.25&&oldRatio>.25)return {severity:'critical',title:'味方部隊が壊滅寸前',ratio};
 if(ratio<=.5&&oldRatio>.5)return {severity:'warning',title:'味方部隊が半数以下',ratio};
 if(ratio<=.75&&oldRatio>.75)return {severity:'info',title:'部隊の損耗が進行',ratio};
 return null;
}
