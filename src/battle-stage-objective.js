/**
 * Opposing victory objectives for the 20-chapter campaign.
 * Every non-elimination battle has an attacker and a defender:
 * holding until the deadline wins for the defender, securing the objective
 * before the deadline wins for the attacker. No draw or double-win state.
 * This is a pure policy: all time values are simulation seconds.
 */
export const BATTLE_OBJECTIVE_TYPES=Object.freeze({
 ELIMINATE:'eliminate',
 DEFEND_TIMER:'defend_timer',
 CAPTURE_ZONE:'capture_zone',
 SIEGE:'siege'
});
const finite=(n,fallback)=>Number.isFinite(Number(n))?Number(n):fallback;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

/** Relative roles are independent of which side the player controls. */
export function objectiveForStage(stage){
 const kind=stage?.kind||'explore',difficulty=Math.max(1,finite(stage?.difficulty,1));
 switch(kind){
  case 'defend':{
   const durationSeconds=Math.min(240,120+Math.floor((difficulty-1)/20)*30);
   return Object.freeze({
    type:BATTLE_OBJECTIVE_TYPES.DEFEND_TIMER,title:'防衛戦・拠点を守り抜け',
    attackerTeam:1,defenderTeam:0,durationSeconds,breachSeconds:12,
    allyGoal:durationSeconds+'秒間、拠点を防衛する、または敵軍を殲滅する',
    enemyGoal:durationSeconds+'秒以内に拠点を12秒間占拠する、または味方軍を殲滅する'
   });
  }
  case 'capture':return Object.freeze({
   type:BATTLE_OBJECTIVE_TYPES.CAPTURE_ZONE,title:'陣地制圧・敵陣に旗を掲げろ',
   attackerTeam:0,defenderTeam:1,durationSeconds:180,holdSeconds:18,
   allyGoal:'180秒以内に敵陣を18秒間確保する、または敵軍を殲滅する',
   enemyGoal:'180秒間、敵陣の占拠を阻止する、または味方軍を殲滅する'
  });
  case 'siege':return Object.freeze({
   type:BATTLE_OBJECTIVE_TYPES.SIEGE,title:'攻城戦・敵陣を突破せよ',
   attackerTeam:0,defenderTeam:1,durationSeconds:240,holdSeconds:24,
   allyGoal:'240秒以内に城を24秒間確保、敵主将を撃破、または敵軍を殲滅する',
   enemyGoal:'240秒間、城と主将を守り抜く、または味方軍を殲滅する'
  });
  default:return Object.freeze({
   type:BATTLE_OBJECTIVE_TYPES.ELIMINATE,
   title:kind==='boss'?'決戦・敵軍を打ち破れ':'敵軍殲滅',
   attackerTeam:0,defenderTeam:1,
   allyGoal:'敵軍を全滅させる',enemyGoal:'味方軍を全滅させる'
  });
 }
}

/**
 * The opposing goals share one authoritative adjudicator.
 * winnerTeam/loserTeam are mutually exclusive team IDs (0=ally, 1=enemy).
 * outcome is retained as a convenience for the existing player victory UI.
 */
export function evaluateBattleObjective(spec,{
 elapsedSeconds=0,deltaSeconds=0,allyAlive=0,enemyAlive=0,
 allyInZone=false,enemyInZone=false,
 captureSeconds=0,breachSeconds=0,
 enemyCommanderDefeated=false,allyCommanderDefeated=false
}={}){
 const type=spec?.type||BATTLE_OBJECTIVE_TYPES.ELIMINATE;
 const attackerTeam=spec?.attackerTeam===1?1:0;
 const defenderTeam=1-attackerTeam;
 const limit=Math.max(1,finite(spec?.durationSeconds,180));
 const elapsed=Math.max(0,finite(elapsedSeconds,0));
 const dt=clamp(finite(deltaSeconds,0),0,1);
 const living=[Math.max(0,finite(allyAlive,0)),Math.max(0,finite(enemyAlive,0))];
 const occupies=[Boolean(allyInZone),Boolean(enemyInZone)];
 const attackerAlive=living[attackerTeam],defenderAlive=living[defenderTeam];
 const attackerInZone=occupies[attackerTeam],defenderInZone=occupies[defenderTeam];
 let capture=Math.max(0,finite(captureSeconds,0));
 let breach=Math.max(0,finite(breachSeconds,0));
 const decide=(winnerTeam,reason,progress)=>({
  outcome:winnerTeam===null?null:winnerTeam===0?'victory':'defeat',
  winnerTeam,loserTeam:winnerTeam===null?null:1-winnerTeam,
  attackerTeam,defenderTeam,reason,progress:clamp(progress,0,1),
  captureSeconds:capture,breachSeconds:breach
 });
 const attackerWin=(reason,progress=1)=>decide(attackerTeam,reason,progress);
 const defenderWin=(reason,progress=1)=>decide(defenderTeam,reason,progress);
 const running=(reason,progress=0)=>decide(null,reason,progress);

 // Annihilation is a universal alternative win condition, regardless of the
 // positional mission or elapsed time. When both armies fall on one tick,
 // the defender wins by the previously specified no-draw tie-break.
 // Both sides annihilated in the same simulation tick: the side charged with
 // taking the objective failed, so the defender wins. There is never a draw.
 if(!attackerAlive&&!defenderAlive)
  return defenderWin('双方壊滅・攻撃側が目的を達成できず防衛側の勝利');
 if(!attackerAlive)return defenderWin('攻撃軍を殲滅した（攻撃軍壊滅）');
 if(!defenderAlive)return attackerWin('防衛軍を殲滅した（防衛軍壊滅）');

 if(type===BATTLE_OBJECTIVE_TYPES.DEFEND_TIMER){
  const occupyTime=Math.max(1,finite(spec?.breachSeconds,12));
  breach=attackerInZone&&!defenderInZone?breach+dt:0;
  // Completion exactly at the deadline counts. Time-out follows the
  // completed occupation check so neither team can win simultaneously.
  if(breach>=occupyTime&&elapsed<=limit)return attackerWin('防衛拠点が攻撃軍に奪われた');
  if(elapsed>=limit)return defenderWin('制限時間まで拠点を守り抜いた');
  return running('防衛残り'+Math.ceil(limit-elapsed)+'秒 · 敵の占拠'+
   Math.floor(breach)+'/'+occupyTime+'秒',elapsed/limit);
 }
 if(type===BATTLE_OBJECTIVE_TYPES.CAPTURE_ZONE||type===BATTLE_OBJECTIVE_TYPES.SIEGE){
  const occupyTime=Math.max(1,finite(spec?.holdSeconds,18));
  capture=attackerInZone&&!defenderInZone?capture+dt:0;
  if(capture>=occupyTime&&elapsed<=limit)return attackerWin('攻撃軍が敵拠点を制圧した');
  const commanderDefeated=defenderTeam===1?enemyCommanderDefeated:allyCommanderDefeated;
  if(type===BATTLE_OBJECTIVE_TYPES.SIEGE&&commanderDefeated&&elapsed<=limit)
   return attackerWin('防衛側の主将が討ち取られた');
  if(elapsed>=limit)return defenderWin('制限時間まで攻撃を阻止し拠点を守り抜いた');
  return running('制圧 '+Math.floor(capture)+'/'+occupyTime+
   '秒 · 残り'+Math.ceil(limit-elapsed)+'秒',capture/occupyTime);
 }
 // Elimination is symmetric and has no deadline. Team 0 and team 1 compete
 // exclusively to destroy the other side, not to defend a positional goal.
 return running('敵軍を撃破せよ');
}
