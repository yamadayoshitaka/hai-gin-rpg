import {OBJECTIVE_TURN_GOALS,createObjectiveTurnEngine} from './battle-objective-turns.js';
/** Mobile compact turn panel: selects goals only; movement and arrival reactions execute automatically. */
export function installObjectiveTurnPanel({groupIds,getGroups,onPause,onMove,onAction,onReport}){
 const engine=createObjectiveTurnEngine({groupIds,getGroups,onPause,onMove,onAction,onReport});
 const root=document.createElement('section');
 root.id='battleObjectiveTurnPanel';root.hidden=true;root.setAttribute('role','dialog');
 root.setAttribute('aria-label','10部隊のターン作戦');
 root.innerHTML='<div class="objectiveTurnCard"><header><strong id="objectiveTurnTitle"></strong><small id="objectiveTurnHint"></small></header>'+
  '<div id="objectiveTurnGroups" class="objectiveTurnGroups"></div>'+
  '<div id="objectiveTurnReport" class="objectiveTurnReport"></div>'+
  '<button id="objectiveTurnAdvance" type="button">全軍移動開始</button></div>';
 document.body.append(root);
 const status=document.createElement('div');status.id='battleObjectiveTurnStatus';status.hidden=true;
 document.body.append(status);
 const $=id=>root.querySelector('#'+id);
 let shown=false;
 const goals=OBJECTIVE_TURN_GOALS.map(g=>'<option value="'+g.id+'">'+g.label+'</option>').join('');
 function render(){
  const state=engine.snapshot(),plan=state.phase==='planning',report=state.phase==='report';
  const visible=plan||report;
  root.hidden=!visible;status.hidden=state.phase==='idle'||state.phase==='done';
  status.textContent='TURN '+state.turn+' ｜ '+({
   planning:'目的設定',moving:'移動中',acting:'到着後の自動対応',report:'戦況報告'
  }[state.phase]||'')+(state.phase==='moving'||state.phase==='acting'?' · 残り'+Math.ceil(state.remaining)+'秒':'');
  if(!visible)return;
  $('objectiveTurnTitle').textContent='TURN '+state.turn+' — '+(plan?'目的を確認':'戦況報告');
  $('objectiveTurnHint').textContent=plan?'前ターンの目的を維持します。変更したい部隊だけ選択してください。':
   '全10部隊の結果を確認して、目的を維持したまま次ターンへ進めます。';
  $('objectiveTurnGroups').innerHTML=state.groups.map(g=>{
   const id=Number(g.id),count=Number(g.alive)||0,selected=state.goalByGroup[id]||'attack';
   return '<label class="objectiveTurnGroup'+(!count?' empty':'')+'"><b>第'+id+'班 <small>'+count+'人</small></b>'+
    '<select aria-label="第'+id+'班の目的" data-objective-group="'+id+'" '+(!count?'disabled':'')+'>'+
    goals.replace('value="'+selected+'"','value="'+selected+'" selected')+'</select></label>';
  }).join('');
  const rows=report?state.report:[];
  $('objectiveTurnReport').hidden=!report;
  $('objectiveTurnReport').textContent=report?
   (rows.filter(x=>x.losses||x.danger).map(x=>'第'+x.id+'班：'+(x.losses?'戦死 '+x.losses+'人':'損耗注意')+(x.danger?' ⚠':'')).join('／')||'大きな損耗なし。目的を維持して続行できます。'):'';
  $('objectiveTurnAdvance').textContent=report?'同じ目的で次ターンへ':'この目的で全軍移動開始';
  if(state.error)$('objectiveTurnHint').textContent+='　⚠ '+state.error;
 }
 root.addEventListener('change',event=>{
  const input=event.target.closest('[data-objective-group]');
  if(input)engine.setGoal(input.dataset.objectiveGroup,input.value);
 });
 $('objectiveTurnAdvance').addEventListener('click',()=>{engine.start();render();});
 function update(dt){
  const prior=engine.snapshot(),next=engine.update(dt);
  if(prior.phase!==next.phase||Math.ceil(prior.remaining)!==Math.ceil(next.remaining))render();
 }
 return {begin:()=>{if(!shown){shown=true;engine.begin();render();}},update,open:()=>{
   const state=engine.snapshot();
   if(state.phase==='planning'||state.phase==='report')render();
  },finish:()=>{engine.finish();render();},snapshot:engine.snapshot,engine};
}
