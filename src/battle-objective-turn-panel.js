import {createObjectiveTurnEngine,TURN_MOVE_OPTIONS,TURN_ACTION_OPTIONS} from './battle-objective-turns.js?v=20261118-move-action-hp1';
/** Ten-group move -> arrival action panel. The orders persist for subsequent turns. */
export function installObjectiveTurnPanel({groupIds,getGroups,getMoveTargets=()=>[],hasArrived=null,onPause,onMove,onAction,onReport}){
 const engine=createObjectiveTurnEngine({groupIds,getGroups,hasArrived,onPause,onMove,onAction,onReport});
 const root=document.createElement('section');
 root.id='battleObjectiveTurnPanel';root.hidden=true;root.setAttribute('role','dialog');
 root.setAttribute('aria-label','最大10班 移動と行動の指示');
 root.innerHTML='<div class="objectiveTurnCard"><header><strong id="objectiveTurnTitle"></strong><small id="objectiveTurnHint"></small></header>'+
  '<div id="objectiveTurnGroups" class="objectiveTurnGroups"></div>'+
  '<div id="objectiveTurnReport" class="objectiveTurnReport"></div>'+
  '<button id="objectiveTurnAdvance" type="button">全軍移動開始</button></div>';
 document.body.append(root);
 const status=document.createElement('div');status.id='battleObjectiveTurnStatus';status.hidden=true;
 document.body.append(status);
 const $=id=>root.querySelector('#'+id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const makeOpts=(list,selected)=>list.map(x=>'<option value="'+esc(x.id)+'"'+(String(x.id)===String(selected)?' selected':'')+'>'+esc(x.label)+'</option>').join('');
 let shown=false;
 function render(){
  const state=engine.snapshot(),planning=state.phase==='planning',report=state.phase==='report';
  const visible=planning||(report&&(state.urgent||state.manualHold));
  root.hidden=!visible;status.hidden=state.phase==='idle'||state.phase==='done';
  status.textContent='TURN '+state.turn+' ｜ '+({
   planning:'移動先→行動を設定',moving:'移動中・到着班から行動',acting:'到着後の行動中',report:'戦況報告'
  }[state.phase]||'')+((state.phase==='moving'||state.phase==='acting'||report)&&Number.isFinite(state.remaining)?' · '+Math.ceil(state.remaining)+'秒':'')+
   (report&&!state.manualHold?' · 命令継続':'');
  if(!visible)return;
  $('objectiveTurnTitle').textContent='TURN '+state.turn+'｜①移動先 → ②到着後の行動';
  $('objectiveTurnHint').textContent=planning?
   '各班の移動先と行動を選択。陣形は保持、前回の命令は自動継承されます。建物・橋は候補を選べます。':
   '前ターンの命令を継続します。変更したい班のみ操作してください。';
  $('objectiveTurnGroups').innerHTML=state.groups.map(g=>{
   const id=Number(g.id),count=Number(g.alive)||0,order=state.ordersByGroup[id]||{move:'enemy',action:'charge'};
   const targets=['building','bridge_front'].includes(order.move)?getMoveTargets(id,order.move):[];
   const selectedTarget=targets.some(x=>String(x.id)===String(order.targetId))?order.targetId:targets[0]?.id;
   const max=Math.round(Number(g.initialMaxHp||g.maxHp)||0),hp=Math.round(Number(g.hp)||0);
   const percent=max?Math.max(0,Math.min(100,Math.round(hp/max*100))):0;
   return '<div class="objectiveTurnGroup'+(!count?' empty':'')+'"><b>第'+id+'班 <small>'+count+'人</small></b>'+
    '<div class="objectiveTurnHp"><span style="width:'+percent+'%"></span></div>'+
    '<small>総合HP '+hp+' / '+max+' ('+percent+'%)</small>'+
    '<label>① 移動先<select aria-label="第'+id+'班の移動先" data-move-group="'+id+'" '+(!count?'disabled':'')+'>'+makeOpts(TURN_MOVE_OPTIONS,order.move)+'</select></label>'+
    (targets.length?'<label>場所<select aria-label="第'+id+'班の移動対象" data-target-group="'+id+'">'+makeOpts(targets,selectedTarget)+'</select></label>':'')+
    '<label>② 到着後<select aria-label="第'+id+'班の到着後の行動" data-action-group="'+id+'" '+(!count?'disabled':'')+'>'+makeOpts(TURN_ACTION_OPTIONS,order.action)+'</select></label>'+
    '</div>';
  }).join('');
  const rows=report?state.report:[];
  $('objectiveTurnReport').hidden=!report;
  $('objectiveTurnReport').textContent=report?
   (rows.filter(x=>x.losses||x.danger).map(x=>'第'+x.id+'班：'+(x.losses?'戦死 '+x.losses+'人':'損耗注意')+(x.danger?' ⚠':'')).join('／')||'大きな損耗なし。命令は次ターンへ継続します。'):'';
  $('objectiveTurnAdvance').textContent=report?'同じ命令で次ターンへ':'この移動先と行動で開始';
  if(state.error)$('objectiveTurnHint').textContent+=' ⚠ '+state.error;
 }
 root.addEventListener('change',event=>{
  const move=event.target.closest('[data-move-group]');
  if(move){
   const candidates=getMoveTargets(Number(move.dataset.moveGroup),move.value);
   engine.setMove(move.dataset.moveGroup,move.value,candidates[0]?.id??null);
   render();return;
  }
  const target=event.target.closest('[data-target-group]');
  if(target){
   const id=Number(target.dataset.targetGroup),state=engine.snapshot();
   engine.setMove(id,state.ordersByGroup[id]?.move,target.value);
   return;
  }
  const action=event.target.closest('[data-action-group]');
  if(action)engine.setAction(action.dataset.actionGroup,action.value);
 });
 $('objectiveTurnAdvance').addEventListener('click',()=>{engine.start();render();});
 function update(dt,wallDt=dt){
  const prior=engine.status();
  engine.update(dt,{wallDt});
  const next=engine.status();
  if(prior.phase!==next.phase||Math.ceil(prior.remaining)!==Math.ceil(next.remaining))render();
 }
 return {begin:()=>{if(!shown){shown=true;engine.begin();render();}},update,
  open:()=>{if(engine.interrupt())render();},finish:()=>{engine.finish();render();},
  snapshot:engine.snapshot,engine};
}
