/**
 * Army-wide command fatigue and live countermeasure suggestions.
 *
 * The selected multi-squad tactic is the automatic baseline.
 * A manual order is a temporary response to observed enemy behaviour, never
 * a new tactic, and successive player orders become progressively scarcer.
 * No wall clock: timers use the battle's simulation seconds (pausing is safe).
 */
export const COMMAND_PACING=Object.freeze({
 initialWaitSeconds:60,stepSeconds:30,maxWaitSeconds:180
});
export const COUNTER_ORDER_NAMES=Object.freeze({
 charge:'突撃',defend:'守備',hold:'待機',retreat:'退却'
});
export function waitAfterManualOrder(numberIssued){
 const n=Math.max(1,Math.floor(Number(numberIssued)||1));
 return Math.min(COMMAND_PACING.maxWaitSeconds,
  COMMAND_PACING.initialWaitSeconds+(n-1)*COMMAND_PACING.stepSeconds);
}
export function commandReadiness({now=0,issuedCount=0,globalNextAt=0,lastSquadAt=null,
 squadWaitSeconds=60}={}){
 const seconds=Math.max(0,Number(now)||0);
 const globalRemaining=Math.max(0,Math.ceil(Number(globalNextAt)-seconds-1e-6)||0);
 const squadRemaining=lastSquadAt==null?0:Math.max(0,
  Math.ceil(Number(lastSquadAt)+squadWaitSeconds-seconds-1e-6)||0);
 return {ready:globalRemaining===0&&squadRemaining===0,
  remainingSeconds:Math.max(globalRemaining,squadRemaining),
  globalRemainingSeconds:globalRemaining,squadRemainingSeconds:squadRemaining,
  issuedCount:Math.max(0,Math.floor(Number(issuedCount)||0)),
  nextWaitSeconds:waitAfterManualOrder(Math.max(0,Number(issuedCount)||0)+1)};
}
export function afterManualOrder({issuedCount=0,globalNextAt=0}={},now){
 const seconds=Number(now);
 if(!Number.isFinite(seconds)||seconds<0)throw RangeError('戦闘時間が不正です');
 if(globalNextAt>seconds+1e-6)throw Error('号令の再発令まで待ってください');
 const count=Math.max(0,Math.floor(Number(issuedCount)||0))+1;
 const cooldown=waitAfterManualOrder(count);
 return Object.freeze({issuedCount:count,globalNextAt:seconds+cooldown,
  cooldownSeconds:cooldown});
}
/**
 * Signals are observable order/position facts; they are NOT a claimed
 * knowledge of an opponent's private tactic selection.
 */
export function observeEnemyTactic({enemySquads=[],objective=null,allyHpRatio=1,
 enemyNearOurZone=false}={}){
 const active=enemySquads.filter(s=>s.alive!==false&&(s.soldiers??1)>0);
 const mode=s=>String(s.mode||'charge');
 if(!active.length)return {kind:'no_enemy',name:'敵軍なし',basis:'敵の生存部隊なし'};
 if(active.some(s=>s.highGround))return {
  kind:'highground',name:'高所攻撃の兆候',basis:'敵兵が2階または屋上に展開中'};
 if(enemyNearOurZone&&objective?.defenderTeam===0)return {
  kind:'breach',name:'拠点突破の兆候',basis:'敵部隊が味方防衛区域に接近中'};
 const charging=active.filter(s=>['charge','move','mission'].includes(mode(s))).length;
 const guarding=active.filter(s=>['defend','hold'].includes(mode(s))).length;
 if(allyHpRatio<.32&&charging>=1)return {
  kind:'overrun',name:'自軍の損耗が深刻',basis:'味方の平均HPが低く、敵が攻勢を継続'};
 if(charging>=Math.max(2,Math.ceil(active.length*.6)))return {
  kind:'rush',name:'敵の突撃・進軍',basis:charging+'部隊が前進中'};
 if(guarding>=Math.max(1,Math.ceil(active.length*.6)))return {
  kind:'fortified',name:'敵が防御陣形',basis:guarding+'部隊が守備・待機中'};
 if(active.some(s=>mode(s)==='retreat'))return {
  kind:'fallback',name:'敵の後退',basis:'敵部隊が退却中'};
 return {kind:'unknown',name:'敵軍の動向を監視中',basis:'確認できる決定的な動きなし'};
}
/**
 * Uses only the four existing order modes, so a recommendation can be issued
 * directly through the existing main/Worker squad command channel.
 */
export function recommendCounterOrder({observation=null,jobId='',objective=null,
 allyHpRatio=1}={}){
 const job=String(jobId).toLowerCase();
 const threat=observation?.kind||'unknown';
 const defender=objective?.defenderTeam===0;
 let order=defender?'hold':'charge',reason='戦術を維持し、敵の動きを監視する';
 if(allyHpRatio<.22){order='retreat';reason='戦力壊滅を回避して再編する'}
 else if(threat==='highground'){
  order=job==='ninja'?'charge':job==='shield'||job==='sword'?'defend':'retreat';
  reason=job==='ninja'?'忍者が高所への侵入を狙う':'敵高所火力の射線から味方を守る';
 }else if(threat==='breach'){order=job==='shield'?'hold':'defend';reason='拠点突破を阻止する'}
 else if(threat==='overrun'){order='retreat';reason='敵の攻勢を避けて損耗を抑える'}
 else if(threat==='rush'){order='defend';reason='突撃を受け止めて反撃機会を作る'}
 else if(threat==='fortified'){order=job==='priest'?'hold':'charge';
  reason='防衛陣の弱点を攻めるか支援を継続する'}
 else if(threat==='fallback'){order='charge';reason='後退する敵への追撃'}
 else if(threat==='no_enemy'){order='hold';reason='敵軍殲滅の勝敗判定を待つ'}
 return Object.freeze({order,label:COUNTER_ORDER_NAMES[order],reason,
  threat,observed:observation?.basis||''});
}
