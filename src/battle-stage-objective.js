/**
 * Stage-specific victory conditions for the 20-chapter campaign.
 * Pure and deterministic: time advances in simulation seconds, never wall time.
 * A unit-centre is supplied by the caller (works for skirmish and mass battles).
 */
export const BATTLE_OBJECTIVE_TYPES=Object.freeze({
 ELIMINATE:'eliminate',
 DEFEND_TIMER:'defend_timer',
 CAPTURE_ZONE:'capture_zone',
 SIEGE:'siege'
});
export function objectiveForStage(stage){
 const kind=stage?.kind||'explore',difficulty=Math.max(1,Number(stage?.difficulty)||1);
 switch(kind){
  case 'defend':return Object.freeze({
   type:BATTLE_OBJECTIVE_TYPES.DEFEND_TIMER,
   title:'防衛戦・拠点を守り抜け',
   durationSeconds:Math.min(240,120+Math.floor((difficulty-1)/20)*30),
   breachSeconds:12
  });
  case 'capture':return Object.freeze({
   type:BATTLE_OBJECTIVE_TYPES.CAPTURE_ZONE,
   title:'陣地制圧・敵陣に旗を掲げろ',
   holdSeconds:18
  });
  case 'siege':return Object.freeze({
   type:BATTLE_OBJECTIVE_TYPES.SIEGE,
   title:'攻城戦・敵陣を突破せよ',
   holdSeconds:24
  });
  default:return Object.freeze({type:BATTLE_OBJECTIVE_TYPES.ELIMINATE,title:
   kind==='boss'?'決戦・敵軍を打ち破れ':'敵軍殲滅'});
 }
}
export function evaluateBattleObjective(spec,{
 elapsedSeconds=0,deltaSeconds=0,allyAlive=0,enemyAlive=0,
 allyInZone=false,enemyInZone=false,
 captureSeconds=0,breachSeconds=0,
 enemyCommanderDefeated=false
}={}){
 const type=spec?.type||BATTLE_OBJECTIVE_TYPES.ELIMINATE;
 const elapsed=Math.max(0,Number(elapsedSeconds)||0);
 const dt=Math.max(0,Math.min(1,Number(deltaSeconds)||0));
 let capture=Math.max(0,Number(captureSeconds)||0);
 let breach=Math.max(0,Number(breachSeconds)||0);
 const result=(outcome,reason,progress)=>({
  outcome,reason,progress,
  captureSeconds:capture,breachSeconds:breach
 });
 if(allyAlive<=0)return result('defeat','味方軍が壊滅した',0);
 if(type===BATTLE_OBJECTIVE_TYPES.DEFEND_TIMER){
  const limit=Math.max(1,Number(spec.durationSeconds)||120);
  const maxBreach=Math.max(1,Number(spec.breachSeconds)||12);
  breach=enemyInZone&&!allyInZone?breach+dt:0;
  if(breach>=maxBreach)return result('defeat','防衛拠点を奪われた',Math.min(1,elapsed/limit));
  if(enemyAlive<=0)return result('victory','攻撃軍を撃退した',1);
  if(elapsed>=limit)return result('victory','制限時間まで拠点を守り抜いた',1);
  return result(null,'防衛残り'+Math.ceil(limit-elapsed)+'秒 · 敵の占拠'+Math.floor(breach)+'/'+maxBreach+'秒',Math.min(1,elapsed/limit));
 }
 if(type===BATTLE_OBJECTIVE_TYPES.CAPTURE_ZONE||type===BATTLE_OBJECTIVE_TYPES.SIEGE){
  const hold=Math.max(1,Number(spec.holdSeconds)||18);
  capture=allyInZone&&!enemyInZone?capture+dt:0;
  if(capture>=hold)return result('victory','敵拠点を制圧した',1);
  if(enemyAlive<=0)return result('victory','敵軍を排除して拠点を制圧した',1);
  if(type===BATTLE_OBJECTIVE_TYPES.SIEGE&&enemyCommanderDefeated)
   return result('victory','敵主将を討ち取った',1);
  return result(null,'敵拠点を確保 '+Math.floor(capture)+'/'+hold+'秒（敵が侵入すると中断）',Math.min(1,capture/hold));
 }
 if(enemyAlive<=0)return result('victory','敵軍を殲滅した',1);
 return result(null,'敵軍を撃破せよ',0);
}
