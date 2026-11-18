import {createObjectiveTurnEngine,TURN_MOVE_OPTIONS,TURN_ACTION_OPTIONS} from './battle-objective-turns.js?v=20261118-map-paging2';

/**
 * Phone-sized objective turn interface.
 * One army group per page -> tap a real location on the battlefield map ->
 * choose one arrival action, optionally choosing an owned item.
 */
export function installObjectiveTurnPanel({
 groupIds,getGroups,getMoveTargets=()=>[],getMapChoices=()=>[],
 getGroupPowers=()=>({}),getEnemyGroups=()=>[],getGroupOrigin=()=>null,
 getItems=()=>[],drawMapBackground=null,worldSize=232,
 hasArrived=null,onPause,onMove,onAction,onReport
}){
 const engine=createObjectiveTurnEngine({groupIds,getGroups,hasArrived,onPause,onMove,onAction,onReport});
 const root=document.createElement('section');
 root.id='battleObjectiveTurnPanel';root.hidden=true;root.setAttribute('role','dialog');
 root.setAttribute('aria-label','ターン制：地図で移動先を決めて作戦を選ぶ');
 root.innerHTML='<div class="objectiveTurnCard">'+
  '<header><strong id="objectiveTurnTitle"></strong><small id="objectiveTurnHint"></small></header>'+
  '<div id="objectiveTurnForces" class="objectiveTurnForces"></div>'+
  '<div class="objectiveTurnPager"><button type="button" data-pager="-1">◀ 前の班</button><b id="objectiveTurnPage"></b><button type="button" data-pager="1">次の班 ▶</button></div>'+
  '<div id="objectiveTurnGroup" class="objectiveTurnGroup"></div>'+
  '<div class="objectiveTurnSteps"><button type="button" data-step="map">① 地図で移動</button><button type="button" data-step="action">② 到着後の作戦</button><button type="button" data-step="intel">戦力一覧</button></div>'+
  '<div id="objectiveTurnMapStep"><canvas id="objectiveTurnMap" width="232" height="232" aria-label="戦場地図。目的地の印をタップして移動先を選択"></canvas><div id="objectiveTurnMapHint"></div><div id="objectiveTurnChoices" class="objectiveTurnChoices"></div><div class="objectiveChoicePager"><button type="button" data-choice-page="-1">◀</button><span id="objectiveChoicePage"></span><button type="button" data-choice-page="1">▶</button></div></div>'+
  '<div id="objectiveTurnActionStep" hidden><div id="objectiveTurnArrival"></div><div id="objectiveTurnActions" class="objectiveTurnActions"></div><div id="objectiveTurnItems" class="objectiveTurnItems"></div></div>'+
  '<div id="objectiveTurnIntel" hidden><div id="objectiveTurnIntelRows"></div><div class="objectiveChoicePager"><button type="button" data-intel-page="-1">◀ 前</button><span id="objectiveIntelPage"></span><button type="button" data-intel-page="1">次 ▶</button></div></div>'+
  '<div id="objectiveTurnReport" class="objectiveTurnReport"></div>'+
  '<button id="objectiveTurnAdvance" type="button">この作戦でターン開始</button></div>';
 document.body.append(root);
 document.body.classList.add('objective-turn-enabled');
 const status=document.createElement('div');status.id='battleObjectiveTurnStatus';status.hidden=true;
 document.body.append(status);
 const $=id=>root.querySelector('#'+id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const movingLabel=id=>TURN_MOVE_OPTIONS.find(x=>x.id===id)?.label||'移動先未設定';
 const actionLabel=id=>TURN_ACTION_OPTIONS.find(x=>x.id===id)?.label||'作戦未設定';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 let shown=false,page=0,step='map',choicePage=0,intelPage=0,mapMarkers=[];
 const activeGroups=state=>{
  const all=state.groups.filter(g=>groupIds.includes(Number(g.id)));
  return all.filter(g=>Number(g.alive)>0||Number(g.initial)>0).length?
   all.filter(g=>Number(g.alive)>0||Number(g.initial)>0):all;
 };
 const visibleGroup=state=>activeGroups(state)[clamp(page,0,Math.max(0,activeGroups(state).length-1))]||null;
 const choicesFor=id=>{
  const incoming=getMapChoices(id);
  return Array.isArray(incoming)?incoming.filter(c=>c&&TURN_MOVE_OPTIONS.some(x=>x.id===c.move)&&
   Number.isFinite(Number(c.x))&&Number.isFinite(Number(c.z))):[];
 };
 function renderMap(id,order){
  const canvas=$('objectiveTurnMap'),ctx=canvas.getContext('2d');
  if(!ctx)return;
  const world=Math.max(1,Number(worldSize)||232),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#132c42';ctx.fillRect(0,0,w,h);
  if(typeof drawMapBackground==='function'){
   try{drawMapBackground(ctx,w,h)}catch(error){console.warn('Objective map background',error)}
  }else{
   ctx.strokeStyle='#4a7085';ctx.lineWidth=.6;
   for(let n=0;n<=w;n+=29){ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,h);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,n);ctx.lineTo(w,n);ctx.stroke();}
  }
  const origin=getGroupOrigin(id);
  if(origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.z)){
   ctx.beginPath();ctx.arc(origin.x/world*w,origin.z/world*h,6,0,Math.PI*2);
   ctx.fillStyle='#5dd7ff';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
  }
  const enemies=getEnemyGroups();
  for(const enemy of enemies){
   if(!Number.isFinite(Number(enemy.x))||!Number.isFinite(Number(enemy.z))||!(enemy.alive>0))continue;
   ctx.beginPath();ctx.arc(enemy.x/world*w,enemy.z/world*h,3.8,0,Math.PI*2);
   ctx.fillStyle='#ff6f83';ctx.fill();
  }
  mapMarkers=choicesFor(id).map(c=>({...c,px:Number(c.x)/world*w,pz:Number(c.z)/world*h}));
  for(const [index,c] of mapMarkers.entries()){
   const chosen=c.move===order.move&&String(c.targetId??'')===String(order.targetId??'');
   ctx.beginPath();ctx.arc(c.px,c.pz,chosen?7:5,0,Math.PI*2);
   ctx.fillStyle=chosen?'#ffdb76':c.move==='building'?'#83dfc9':c.move==='bridge_front'?'#ffbb7a':'#a5c6ff';
   ctx.fill();ctx.strokeStyle='#0a1728';ctx.lineWidth=1.6;ctx.stroke();
   if(chosen){ctx.fillStyle='#08192d';ctx.font='bold 10px system-ui';ctx.textAlign='center';
    ctx.fillText('✓',c.px,c.pz+3.5);}
   if(index<6&&(!chosen||index<3)){
    ctx.fillStyle='#fff';ctx.font='bold 9px system-ui';ctx.textAlign='left';
    ctx.fillText(String(c.label||movingLabel(c.move)).slice(0,8),clamp(c.px+7,0,w-52),clamp(c.pz-7,9,h-4));
   }
  }
 }
 function render(){
  const state=engine.snapshot(),planning=state.phase==='planning',report=state.phase==='report';
  const visible=planning||(report&&(state.urgent||state.manualHold));
  root.hidden=!visible;status.hidden=state.phase==='idle'||state.phase==='done';
  document.body.classList.toggle('objective-turn-running',['moving','acting','report'].includes(state.phase));
  status.textContent='TURN '+state.turn+' ｜ '+({
   planning:'地図 → 作戦',moving:'移動中',acting:'到着後の作戦を実行中',report:'戦況報告'
  }[state.phase]||'')+((state.phase==='moving'||state.phase==='acting'||report)&&Number.isFinite(state.remaining)?
   ' · '+Math.ceil(state.remaining)+'秒':'');
  if(!visible)return;
  const groups=activeGroups(state),group=visibleGroup(state);
  page=clamp(page,0,Math.max(0,groups.length-1));
  const id=Number(group?.id)||1,order=state.ordersByGroup[id]||{move:'enemy',action:'charge',targetId:null};
  const power=getGroupPowers(),enemies=getEnemyGroups();
  const enemyPower=enemies.reduce((n,e)=>n+(Number(e.power)||0),0);
  const allyPower=Object.values(power).reduce((n,p)=>n+(Number(p)||0),0);
  $('objectiveTurnTitle').textContent='TURN '+state.turn+'｜'+(planning?'移動 → 作戦':'戦況・次ターン');
  $('objectiveTurnHint').textContent=planning?'各班をページで切り替え。地図の印から移動先を選び、次に到着後の作戦を設定します。変更しない班は命令を継続します。戦力Pはレアリティ換算値です。':
   '前ターンの移動先と作戦を引き継ぎます。変更したい班だけ選んでください。';
  $('objectiveTurnForces').innerHTML='<span>🔵 味方合計戦力 <b>'+Math.round(allyPower*10)/10+'</b></span><span>🔴 敵合計戦力 <b>'+Math.round(enemyPower*10)/10+'</b></span>';
  $('objectiveTurnPage').textContent='第'+id+'班（'+(page+1)+' / '+groups.length+'）';
  const nav=root.querySelectorAll('[data-pager]');
  nav[0].disabled=page<=0;nav[1].disabled=page>=groups.length-1;
  const max=Math.round(Number(group?.initialMaxHp||group?.maxHp)||0),hp=Math.round(Number(group?.hp)||0);
  const pct=max?clamp(Math.round(hp/max*100),0,100):0;
  $('objectiveTurnGroup').innerHTML='<strong>🔵 第'+id+'班 · '+Math.round(Number(power[id])||0)+' 戦力P · '+(Number(group?.alive)||0)+'人</strong>'+
   '<div class="objectiveTurnHp"><span style="width:'+pct+'%"></span></div>'+
   '<small>総合HP '+hp+' / '+max+' ('+pct+'%)　現在：'+esc(movingLabel(order.move))+' → '+esc(actionLabel(order.action))+'</small>';
  for(const el of root.querySelectorAll('[data-step]'))el.classList.toggle('active',el.dataset.step===step);
  $('objectiveTurnMapStep').hidden=step!=='map';
  $('objectiveTurnActionStep').hidden=step!=='action';
  $('objectiveTurnIntel').hidden=step!=='intel';
  if(step==='map'){
   renderMap(id,order);
   const options=mapMarkers;
   const pages=Math.max(1,Math.ceil(options.length/4));choicePage=clamp(choicePage,0,pages-1);
   $('objectiveTurnMapHint').textContent=options.length?'目的地の印、または下の地点ボタンを選んでください（青＝味方、赤＝敵）':'移動可能な地点がありません。現在地で待機を選択してください。';
   $('objectiveTurnChoices').innerHTML=options.slice(choicePage*4,choicePage*4+4).map((c,i)=>
    '<button type="button" data-map-choice="'+(choicePage*4+i)+'" class="'+
    (c.move===order.move&&String(c.targetId??'')===String(order.targetId??'')?'selected':'')+'">'+
    esc(c.label||movingLabel(c.move))+'</button>').join('');
   $('objectiveChoicePage').textContent=choicePage+1+' / '+pages;
   for(const el of root.querySelectorAll('[data-choice-page]'))el.disabled=Number(el.dataset.choicePage)<0?choicePage===0:choicePage>=pages-1;
  }else if(step==='action'){
   $('objectiveTurnArrival').textContent='📍 '+movingLabel(order.move)+
    ' → 到着後に実行する作戦を選択（未到着なら移動を継続）';
   $('objectiveTurnActions').innerHTML=TURN_ACTION_OPTIONS.map(a=>'<button type="button" data-action-id="'+esc(a.id)+'"'+
    (a.id===order.action?' class="selected"':'')+'>'+esc(a.label)+'</button>').join('');
   const items=getItems(id);
   $('objectiveTurnItems').innerHTML=order.action==='item'?(
    '<strong>使用するアイテム（1班・1ターンにつき1個）</strong>'+
    (items.length?items.map(item=>'<button type="button" data-item-id="'+esc(item.id)+'" class="'+
     (String(item.id)===String(order.itemId)?'selected':'')+'">'+esc(item.label)+'</button>').join(''):
     '<small>使用可能なアイテムがありません。別の作戦を選んでください。</small>')):'';
  }else{
   const allies=groups.map(g=>({team:0,id:g.id,alive:g.alive,hp:g.hp,maxHp:g.initialMaxHp||g.maxHp,power:Number(power[g.id])||0}));
   const all=[...allies,...enemies.map(e=>({...e,team:1}))];
   const pages=Math.max(1,Math.ceil(all.length/5));intelPage=clamp(intelPage,0,pages-1);
   $('objectiveTurnIntelRows').innerHTML=all.slice(intelPage*5,intelPage*5+5).map(r=>'<div class="'+(r.team?'enemy':'ally')+'">'+
    (r.team?'🔴 敵 第':'🔵 味方 第')+esc(r.id)+'隊 ｜戦力 <b>'+Math.round(Number(r.power)||0)+
    '</b> ｜'+(Number(r.alive)||0)+'人 ｜HP '+Math.round(Number(r.hp)||0)+' / '+
    Math.round(Number(r.maxHp)||0)+'</div>').join('');
   $('objectiveIntelPage').textContent=(intelPage+1)+' / '+pages;
   for(const el of root.querySelectorAll('[data-intel-page]'))el.disabled=Number(el.dataset.intelPage)<0?intelPage===0:intelPage>=pages-1;
  }
  const rows=report?state.report:[];
  $('objectiveTurnReport').hidden=!report;
  $('objectiveTurnReport').textContent=report?
   (rows.filter(x=>x.losses||x.danger).map(x=>'第'+x.id+'班 '+(x.losses?'戦死'+x.losses+'人':'損耗注意')+(x.danger?' ⚠':'')).join('／')||'大きな損耗なし。命令は次ターンへ継続します。'):'';
  $('objectiveTurnAdvance').textContent=report?'この作戦で次ターンへ':'設定した作戦でターン開始';
  $('objectiveTurnAdvance').disabled=state.groups.every(g=>!g.alive);
  if(state.error)$('objectiveTurnHint').textContent+=' ⚠ '+state.error;
 }
 function chooseChoice(index){
  const g=visibleGroup(engine.snapshot());if(!g||!(g.alive>0))return;
  const choice=choicesFor(Number(g.id))[index];if(!choice)return;
  if(engine.setMove(g.id,choice.move,choice.targetId??null)){step='action';render();}
 }
 root.addEventListener('click',event=>{
  const pager=event.target.closest('[data-pager]');
  if(pager){page+=Number(pager.dataset.pager);choicePage=0;step='map';render();return;}
  const tab=event.target.closest('[data-step]');
  if(tab){step=tab.dataset.step;render();return;}
  const choice=event.target.closest('[data-map-choice]');
  if(choice){chooseChoice(Number(choice.dataset.mapChoice));return;}
  const optPage=event.target.closest('[data-choice-page]');
  if(optPage){choicePage+=Number(optPage.dataset.choicePage);render();return;}
  const intPage=event.target.closest('[data-intel-page]');
  if(intPage){intelPage+=Number(intPage.dataset.intelPage);render();return;}
  const action=event.target.closest('[data-action-id]');
  if(action){
   const g=visibleGroup(engine.snapshot());if(!g||!(g.alive>0))return;
   engine.setAction(g.id,action.dataset.actionId);
   if(action.dataset.actionId==='item'){
    const items=getItems(Number(g.id));
    const selected=engine.snapshot().ordersByGroup[g.id]?.itemId;
    if(!items.some(x=>String(x.id)===String(selected))&&items[0])engine.setItem(g.id,items[0].id);
   }
   render();return;
  }
  const item=event.target.closest('[data-item-id]');
  if(item){const g=visibleGroup(engine.snapshot());if(g?.alive>0){engine.setItem(g.id,item.dataset.itemId);render();}}
 });
 $('objectiveTurnMap').addEventListener('click',event=>{
  const rect=event.currentTarget.getBoundingClientRect();
  if(!rect.width||!rect.height||!mapMarkers.length)return;
  const x=(event.clientX-rect.left)/rect.width*232,z=(event.clientY-rect.top)/rect.height*232;
  let best=-1,distance=Infinity;
  for(let i=0;i<mapMarkers.length;i++){
   const d=Math.hypot(x-mapMarkers[i].px,z-mapMarkers[i].pz);
   if(d<distance){distance=d;best=i;}
  }
  if(distance<=13&&best>=0)chooseChoice(best);
 });
 $('objectiveTurnAdvance').addEventListener('click',()=>{engine.start();render();});
 function update(dt,wallDt=dt){
  const before=engine.status();engine.update(dt,{wallDt});const after=engine.status();
  if(before.phase!==after.phase||Math.ceil(before.remaining)!==Math.ceil(after.remaining))render();
 }
 return {begin:()=>{if(!shown){shown=true;engine.begin();render();}},update,
  open:()=>{if(engine.interrupt()){step='map';render();}},finish:()=>{engine.finish();render();},
  snapshot:engine.snapshot,engine};
}
