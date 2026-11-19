import {createObjectiveTurnEngine,TURN_MOVE_OPTIONS,TURN_ACTION_OPTIONS} from './battle-objective-turns.js?v=20261119-touch-enditems';

/**
 * Phone-sized objective turn interface.
 * One army group per page -> tap a real location on the battlefield map ->
 * choose one arrival action; owned items are available only when the turn ends.
 */
export function installObjectiveTurnPanel({
 groupIds,getGroups,getMoveTargets=()=>[],getMapChoices=()=>[],
 getGroupPowers=()=>({}),getGroupJobs=()=>[],getGroupLabel=()=>'',getEnemyGroups=()=>[],getGroupOrigin=()=>null,
 getLegalMapPoint=(x,z)=>({x,z}),
 getItems=()=>[],getBattleStatusRows=()=>[],drawMapBackground=null,worldSize=232,
 hasArrived=null,onPause,onMove,onAction,onItem,onReport
}){
 const engine=createObjectiveTurnEngine({groupIds,getGroups,hasArrived,onPause,onMove,onAction,onItem,onReport});
 const root=document.createElement('section');
 root.id='battleObjectiveTurnPanel';root.hidden=true;root.setAttribute('role','dialog');
 root.setAttribute('aria-label','ターン制：地図で移動先を決めて作戦を選ぶ');
 root.innerHTML='<div class="objectiveTurnCard">'+
  '<header><strong id="objectiveTurnTitle"></strong><small id="objectiveTurnHint"></small></header>'+
  '<div id="objectiveTurnForces" class="objectiveTurnForces"></div>'+ 
  '<div id="objectiveTurnRpgMini" class="objectiveTurnRpgMini" aria-label="味方と敵の隊別HPと強化弱体"></div>'+
  '<div class="objectiveTurnPager"><button type="button" data-pager="-1">◀ 前の班</button><b id="objectiveTurnPage"></b><button type="button" data-pager="1">次の班 ▶</button></div>'+
  '<div id="objectiveTurnGroup" class="objectiveTurnGroup"></div>'+
  '<div class="objectiveTurnSteps"><button type="button" data-step="map">① 地図で移動</button><button type="button" data-step="action">② 到着後の作戦</button><button type="button" data-step="intel">戦力一覧</button></div>'+
  '<div id="objectiveTurnMapStep"><div class="objectiveTurnMapTools"><strong>🗺 移動先をタップ</strong><button type="button" data-map-zoom="out" aria-label="地図を縮小">−</button><span id="objectiveTurnZoomLevel">100%</span><button type="button" data-map-zoom="in" aria-label="地図を拡大">＋</button><button type="button" data-map-zoom="reset">全体</button><button type="button" data-map-expand aria-expanded="false">⛶ 大きく</button></div><canvas id="objectiveTurnMap" width="464" height="464" aria-label="戦場地図。二本指で拡大、ドラッグで移動、地点をタップして選択"></canvas><div id="objectiveTurnMapHint"></div><div id="objectiveTurnChoices" class="objectiveTurnChoices"></div><div class="objectiveChoicePager"><button type="button" data-choice-page="-1">◀</button><span id="objectiveChoicePage"></span><button type="button" data-choice-page="1">▶</button></div></div>'+
  '<div id="objectiveTurnActionStep" hidden><div id="objectiveTurnArrival"></div><div id="objectiveTurnActions" class="objectiveTurnActions"></div><div id="objectiveTurnItems" class="objectiveTurnItems"></div></div>'+
  '<div id="objectiveTurnIntel" hidden><div id="objectiveTurnIntelRows"></div><div class="objectiveChoicePager"><button type="button" data-intel-page="-1">◀ 前</button><span id="objectiveIntelPage"></span><button type="button" data-intel-page="1">次 ▶</button></div></div>'+
  '<div id="objectiveTurnReport" class="objectiveTurnReport"></div>'+ 
  '<div id="objectiveTurnEndItems" class="objectiveTurnEndItems" hidden></div>'+
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
 let zoom=1,mapCenterX=(Number(worldSize)||232)/2,mapCenterZ=mapCenterX;
 let lastGestureAt=-Infinity,lastTapHandledAt=-Infinity;
 const pointers=new Map();
 const zoomBounds=[1,6];
 const activeGroups=state=>{
  const all=state.groups.filter(g=>groupIds.includes(Number(g.id)));
  return all.filter(g=>Number(g.alive)>0||Number(g.initial)>0).length?
   all.filter(g=>Number(g.alive)>0||Number(g.initial)>0):all;
 };
 const visibleGroup=state=>activeGroups(state)[clamp(page,0,Math.max(0,activeGroups(state).length-1))]||null;
 const choicesFor=(id,order=null)=>{
  const incoming=getMapChoices(id);
  const choices=Array.isArray(incoming)?incoming.filter(c=>c&&TURN_MOVE_OPTIONS.some(x=>x.id===c.move)&&
   Number.isFinite(Number(c.x))&&Number.isFinite(Number(c.z))):[];
  if(order?.move==='point'&&order.targetId){
   const match=/^(\d+),(\d+)$/.exec(String(order.targetId));
   if(match){
    const x=Number(match[1]),z=Number(match[2]);
    if(Number.isFinite(x)&&Number.isFinite(z))choices.push({
     move:'point',targetId:order.targetId,label:'指定地点 ('+x+', '+z+')',x,z
    });
   }
  }
  return choices;
 };
 function clampCenter(){
  const world=Math.max(1,Number(worldSize)||232),half=world/(2*zoom);
  mapCenterX=clamp(mapCenterX,half,world-half);
  mapCenterZ=clamp(mapCenterZ,half,world-half);
 }
 function renderMap(id,order){
  const canvas=$('objectiveTurnMap'),ctx=canvas.getContext('2d');
  if(!ctx)return;
  const world=Math.max(1,Number(worldSize)||232),w=canvas.width,h=canvas.height;
  clampCenter();
  const screen=(x,z)=>({
   x:(.5+(Number(x)-mapCenterX)*zoom/world)*w,
   z:(.5+(Number(z)-mapCenterZ)*zoom/world)*h
  });
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);
  ctx.save();
  ctx.setTransform(w/world*zoom,0,0,h/world*zoom,
   w*.5-mapCenterX*w/world*zoom,h*.5-mapCenterZ*h/world*zoom);
  ctx.fillStyle='#132c42';ctx.fillRect(0,0,world,world);
  if(typeof drawMapBackground==='function'){
   try{drawMapBackground(ctx,world,world)}catch(error){console.warn('Objective map background',error)}
  }else{
   ctx.strokeStyle='#4a7085';ctx.lineWidth=.6;
   for(let n=0;n<=world;n+=world/8){
    ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,world);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,n);ctx.lineTo(world,n);ctx.stroke();
   }
  }
  ctx.restore();
  const origin=getGroupOrigin(id);
  if(origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.z)){
   const center=screen(origin.x,origin.z);
   ctx.beginPath();ctx.arc(center.x,center.z,11,0,Math.PI*2);
   ctx.fillStyle='#5dd7ff';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
   ctx.fillStyle='#08263a';ctx.font='bold 12px system-ui';ctx.textAlign='center';
   ctx.fillText('味',center.x,center.z+4);
  }
  for(const enemy of getEnemyGroups()){
   if(!Number.isFinite(Number(enemy.x))||!Number.isFinite(Number(enemy.z))||!(enemy.alive>0))continue;
   const p=screen(enemy.x,enemy.z);
   ctx.beginPath();ctx.arc(p.x,p.z,8,0,Math.PI*2);
   ctx.fillStyle='#ff6f83';ctx.fill();
  }
  mapMarkers=choicesFor(id,order).map(c=>({...c,...(()=>{
   const p=screen(c.x,c.z);return {px:p.x,pz:p.z};
  })()}));
  let lastLabel=[];
  for(const [index,c] of mapMarkers.entries()){
   if(c.px<-20||c.pz<-20||c.px>w+20||c.pz>h+20)continue;
   const chosen=c.move===order.move&&String(c.targetId??'')===String(order.targetId??'');
   const radius=chosen?13:11;
   ctx.beginPath();ctx.arc(c.px,c.pz,radius,0,Math.PI*2);
   ctx.fillStyle=chosen?'#ffdb76':c.move==='building'?'#83dfc9':c.move==='bridge_front'?'#ffbb7a':'#a5c6ff';
   ctx.fill();ctx.strokeStyle='#0a1728';ctx.lineWidth=2;ctx.stroke();
   if(chosen){
    ctx.fillStyle='#08192d';ctx.font='bold 15px system-ui';ctx.textAlign='center';
    ctx.fillText('✓',c.px,c.pz+5);
   }
   const labelAllowed=chosen||(zoom>=1.75&&index<25);
   if(labelAllowed&&!lastLabel.some(p=>Math.hypot(p.x-c.px,p.z-c.pz)<46)){
    const label=String(c.label||movingLabel(c.move)).slice(0,12);
    const lx=clamp(c.px+15,0,w-110),ly=clamp(c.pz-11,15,h-5);
    ctx.font='bold 15px system-ui';ctx.textAlign='left';
    const width=Math.min(w-lx,ctx.measureText(label).width+10);
    ctx.fillStyle='#071a29e6';ctx.fillRect(lx-3,ly-14,width,19);
    ctx.fillStyle='#fff';ctx.fillText(label,lx,ly);lastLabel.push({x:c.px,z:c.pz});
   }
  }
 }
 function zoomMap(next,canvasX=null,canvasY=null){
  const canvas=$('objectiveTurnMap'),world=Math.max(1,Number(worldSize)||232);
  const x=canvasX??canvas.width/2,z=canvasY??canvas.height/2;
  const anchorX=mapCenterX+(x/canvas.width-.5)*world/zoom;
  const anchorZ=mapCenterZ+(z/canvas.height-.5)*world/zoom;
  zoom=clamp(next,zoomBounds[0],zoomBounds[1]);
  mapCenterX=anchorX-(x/canvas.width-.5)*world/zoom;
  mapCenterZ=anchorZ-(z/canvas.height-.5)*world/zoom;
  clampCenter();
  $('objectiveTurnZoomLevel').textContent=Math.round(zoom*100)+'%';
  redrawMap();
 }
 function redrawMap(){
  if(step!=='map'||root.hidden)return;
  const state=engine.snapshot(),group=visibleGroup(state);
  if(group)renderMap(Number(group.id),state.ordersByGroup[group.id]||{move:'hold'});
 }
 function recenterMap(id){
  const origin=getGroupOrigin(id);
  mapCenterX=Number.isFinite(Number(origin?.x))?Number(origin.x):(Number(worldSize)||232)/2;
  mapCenterZ=Number.isFinite(Number(origin?.z))?Number(origin.z):(Number(worldSize)||232)/2;
  clampCenter();
 }
 let rpgStatusSignature='';
 function renderRpgMini(){
  const target=$('objectiveTurnRpgMini');
  const incoming=getBattleStatusRows(),rows=Array.isArray(incoming)?incoming:[];
  const signature=JSON.stringify(rows.map(r=>[r.team,r.id,r.name,r.alive,r.total,r.hp,r.maxHp,r.effects]));
  if(signature===rpgStatusSignature)return;
  rpgStatusSignature=signature;
  const preservedScroll=[...target.querySelectorAll('.objectiveTurnRpgStrip')].map(node=>node.scrollLeft);
  target.innerHTML=[0,1].map(team=>{
   const selected=rows.filter(r=>Number(r.team)===team);
   return '<div class="objectiveTurnRpgSide '+(team?'enemy':'ally')+'">'+
    '<b>'+(team?'🔴 敵隊':'🔵 味方隊')+' '+selected.filter(r=>Number(r.alive)>0).length+'/'+selected.length+'</b>'+
    '<div class="objectiveTurnRpgStrip">'+(selected.length?selected.map(r=>{
     const pct=Math.max(0,Math.min(100,Math.round((Number(r.hp)||0)/Math.max(1,Number(r.maxHp)||0)*100)));
     const buff=(r.effects||[]).slice(0,2).map(e=>esc(e.label)).join(' ');
     return '<span class="objectiveTurnRpgChip"><strong>'+esc(r.name)+'</strong>'+
      '<i style="width:'+pct+'%"></i><small>HP '+Math.ceil(Number(r.hp)||0)+'/'+Math.ceil(Number(r.maxHp)||0)+
      ' 残'+(Number(r.alive)||0)+'/'+(Number(r.total)||0)+(buff?' '+buff:'')+'</small></span>';
    }).join(''):'<small>隊情報を取得中</small>')+'</div></div>';
  }).join('');
  [...target.querySelectorAll('.objectiveTurnRpgStrip')].forEach((node,index)=>{
   node.scrollLeft=preservedScroll[index]||0;
  });
 }
 function render(){
  const state=engine.snapshot(),planning=state.phase==='planning',report=state.phase==='report';
  const visible=planning||report;
  root.hidden=!visible;status.hidden=state.phase==='idle'||state.phase==='done';
  document.body.classList.toggle('objective-turn-running',['moving','acting','report'].includes(state.phase));
  status.textContent='TURN '+state.turn+' ｜ '+({
   planning:'地図 → 作戦',moving:'移動中',acting:'到着後の作戦を実行中',report:'戦況報告'
  }[state.phase]||'')+((state.phase==='moving'||state.phase==='acting'||report)&&Number.isFinite(state.remaining)?
   ' · '+Math.ceil(state.remaining)+'秒':'');
  if(!visible)return;
  renderRpgMini();
  const groups=activeGroups(state),group=visibleGroup(state);
  page=clamp(page,0,Math.max(0,groups.length-1));
  const id=Number(group?.id)||1,order=state.ordersByGroup[id]||{move:'enemy',action:'charge',targetId:null};
  const power=getGroupPowers(),enemies=getEnemyGroups();
  const enemyPower=enemies.reduce((n,e)=>n+(Number(e.power)||0),0);
  const allyPower=Object.values(power).reduce((n,p)=>n+(Number(p)||0),0);
  $('objectiveTurnTitle').textContent='TURN '+state.turn+'｜'+(planning?'移動 → 作戦':'戦況・次ターン');
  $('objectiveTurnHint').textContent=planning?'各班をページで切り替え。地図の印から移動先を選び、次に到着後の作戦を設定します。変更しない班は命令を継続します。戦力Pはレアリティ換算値です。':
   'ターン終了。必要な隊だけ道具を使用できます（各隊1個）。次ターンへ進むと移動先と作戦を引き継ぎます。';
  $('objectiveTurnForces').innerHTML='<span>🔵 味方合計戦力 <b>'+Math.round(allyPower*10)/10+'</b></span><span>🔴 敵合計戦力 <b>'+Math.round(enemyPower*10)/10+'</b></span>';
  $('objectiveTurnPage').textContent='第'+id+'隊（'+(page+1)+' / '+groups.length+'）';
  const nav=root.querySelectorAll('[data-pager]');
  nav[0].disabled=page<=0;nav[1].disabled=page>=groups.length-1;
  const max=Math.round(Number(group?.initialMaxHp||group?.maxHp)||0),hp=Math.round(Number(group?.hp)||0);
  const pct=max?clamp(Math.round(hp/max*100),0,100):0;
  const jobs=getGroupJobs(id);
  const groupLabel=String(getGroupLabel(id,jobs)||((jobs[0]?.name||'混成')+'隊'));
  $('objectiveTurnGroup').innerHTML='<strong>🔵 '+esc(groupLabel)+'（第'+id+'隊） · '+(Math.round((Number(power[id])||0)*10)/10)+' 戦力P · '+(Number(group?.alive)||0)+'人</strong>'+
   '<div class="objectiveTurnHp"><span style="width:'+pct+'%"></span></div>'+
   '<small>総合HP '+hp+' / '+max+' ('+pct+'%)　現在：'+esc(movingLabel(order.move))+' → '+esc(actionLabel(order.action))+'</small>'+
   '<div class="objectiveTurnJobs" aria-label="味方のジョブ別戦力">'+
   (jobs.length?jobs.map(job=>'<span>'+esc(job.name)+' '+Number(job.count||0)+'人 · P'+(Math.round(Number(job.power||0)*10)/10)+'</span>').join(''):'<small>所属する生存兵なし</small>')+'</div>';
  for(const el of root.querySelectorAll('[data-step]'))el.classList.toggle('active',el.dataset.step===step);
  $('objectiveTurnMapStep').hidden=step!=='map';
  $('objectiveTurnActionStep').hidden=step!=='action';
  $('objectiveTurnIntel').hidden=step!=='intel';
  if(step==='map'){
   renderMap(id,order);
   const options=mapMarkers;
   const pages=Math.max(1,Math.ceil(options.length/4));choicePage=clamp(choicePage,0,pages-1);
   $('objectiveTurnMapHint').textContent='地図のどこでもタップして移動先を指定できます。印は候補地点。ドラッグで地図移動、＋／−で拡大。';
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
   $('objectiveTurnItems').innerHTML='';
  }else{
   const allies=groups.map(g=>({team:0,id:g.id,alive:g.alive,hp:g.hp,maxHp:g.initialMaxHp||g.maxHp,power:Number(power[g.id])||0,jobs:getGroupJobs(Number(g.id))}));
   const all=[...allies,...enemies.map(e=>({...e,team:1}))];
   const pages=Math.max(1,Math.ceil(all.length/5));intelPage=clamp(intelPage,0,pages-1);
   $('objectiveTurnIntelRows').innerHTML=all.slice(intelPage*5,intelPage*5+5).map(r=>'<div class="'+(r.team?'enemy':'ally')+'">'+
    (r.team?'🔴 敵 第':'🔵 味方 第')+esc(r.id)+'隊 ｜戦力 <b>'+Math.round(Number(r.power)||0)+
    '</b> ｜'+(Number(r.alive)||0)+'人 ｜HP '+Math.round(Number(r.hp)||0)+' / '+
    Math.round(Number(r.maxHp)||0)+
    '<div class="objectiveIntelJobs">'+(r.jobs?.length?r.jobs.map(job=>esc(job.name)+' '+Number(job.count||0)+'人 P'+(Math.round(Number(job.power||0)*10)/10)).join(' ／ '):'ジョブ情報なし')+'</div></div>').join('');
   $('objectiveIntelPage').textContent=(intelPage+1)+' / '+pages;
   for(const el of root.querySelectorAll('[data-intel-page]'))el.disabled=Number(el.dataset.intelPage)<0?intelPage===0:intelPage>=pages-1;
  }
  const rows=report?state.report:[];
  $('objectiveTurnReport').hidden=!report;
  $('objectiveTurnReport').textContent=report?
   (rows.filter(x=>x.losses||x.danger).map(x=>'第'+x.id+'班 '+(x.losses?'戦死'+x.losses+'人':'損耗注意')+(x.danger?' ⚠':'')).join('／')||'大きな損耗なし。命令は次ターンへ継続します。'):'';
  const endItems=$('objectiveTurnEndItems');
  endItems.hidden=!report;
  if(report){
   const used=state.endItemsByGroup?.[id];
   const items=getItems(id).filter(item=>Number.isFinite(Number(item.count))?Number(item.count)>0:true);
   endItems.innerHTML='<strong>🎒 ターン終了時の道具（第'+id+'隊・1回まで）</strong>'+
    (used?'<small>✓ この隊は道具を使用済みです。</small>':
     (items.length?items.map(item=>'<button type="button" data-end-item-id="'+esc(item.id)+'">'+esc(item.label)+'</button>').join(''):
      '<small>使用可能な道具はありません。そのまま次ターンへ進めます。</small>'));
  }
  $('objectiveTurnAdvance').textContent=report?'道具を使わず／使用後に次ターンへ':'設定した作戦でターン開始';
  $('objectiveTurnAdvance').disabled=state.groups.every(g=>!g.alive);
  if(state.error)$('objectiveTurnHint').textContent+=' ⚠ '+state.error;
  $('objectiveTurnZoomLevel').textContent=Math.round(zoom*100)+'%';
  root.querySelector('[data-map-expand]').setAttribute('aria-expanded',String($('objectiveTurnMapStep').classList.contains('expanded')));
 }
 function chooseChoice(index){
  const g=visibleGroup(engine.snapshot());if(!g||!(g.alive>0))return;
  const choice=mapMarkers[index];if(!choice)return;
  if(engine.setMove(g.id,choice.move,choice.targetId??null)){$('objectiveTurnMapStep').classList.remove('expanded');const button=root.querySelector('[data-map-expand]');button.textContent='⛶ 大きく';button.setAttribute('aria-expanded','false');step='action';render();}
 }
 root.addEventListener('click',event=>{
  const zoomButton=event.target.closest('[data-map-zoom]');
  if(zoomButton){
   const mode=zoomButton.dataset.mapZoom;
   if(mode==='reset'){zoom=1;recenterMap(Number(visibleGroup(engine.snapshot())?.id)||1);redrawMap();}
   else zoomMap(zoom*(mode==='in'?1.6:1/1.6));
   $('objectiveTurnZoomLevel').textContent=Math.round(zoom*100)+'%';
   return;
  }
  const expand=event.target.closest('[data-map-expand]');
  if(expand){
   const expanded=$('objectiveTurnMapStep').classList.toggle('expanded');
   expand.textContent=expanded?'↙ 戻る':'⛶ 大きく';
   expand.setAttribute('aria-expanded',String(expanded));
   redrawMap();return;
  }
  const pager=event.target.closest('[data-pager]');
  if(pager){page+=Number(pager.dataset.pager);choicePage=0;step='map';recenterMap(Number(visibleGroup(engine.snapshot())?.id)||1);render();return;}
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
   render();return;
  }
  const item=event.target.closest('[data-end-item-id]');
  if(item&&engine.status().phase==='report'){
   const g=visibleGroup(engine.snapshot());
   if(g?.alive>0)engine.useEndTurnItem(g.id,item.dataset.endItemId);
   render();return;
  }
 });
 const mapCanvas=$('objectiveTurnMap');
 const canvasPoint=(event,rect=mapCanvas.getBoundingClientRect())=>({
  x:(event.clientX-rect.left)/Math.max(1,rect.width)*mapCanvas.width,
  z:(event.clientY-rect.top)/Math.max(1,rect.height)*mapCanvas.height
 });
 const pointerMid=(a,b)=>({x:(a.x+b.x)/2,z:(a.z+b.z)/2});
 const pointerDist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 mapCanvas.addEventListener('pointerdown',event=>{
  if(root.hidden||step!=='map')return;
  try{mapCanvas.setPointerCapture?.(event.pointerId)}catch{}
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,
   sx:event.clientX,sy:event.clientY,moved:false,type:event.pointerType});
 });
 mapCanvas.addEventListener('pointermove',event=>{
  const current=pointers.get(event.pointerId);if(!current)return;
  const oldValues=[...pointers.values()].map(p=>({...p}));
  const dx=event.clientX-current.x,dy=event.clientY-current.y;
  current.x=event.clientX;current.y=event.clientY;
  if(Math.hypot(current.x-current.sx,current.y-current.sy)>(current.type==='touch'?18:8))current.moved=true;
  if(current.moved)lastGestureAt=performance.now();
  const rect=mapCanvas.getBoundingClientRect();
  if(pointers.size===2){
   const newValues=[...pointers.values()];
   newValues.forEach(p=>p.moved=true);
   const oldDistance=pointerDist({x:oldValues[0].x,y:oldValues[0].y},{x:oldValues[1].x,y:oldValues[1].y});
   const newDistance=pointerDist({x:newValues[0].x,y:newValues[0].y},{x:newValues[1].x,y:newValues[1].y});
   const before=pointerMid({x:oldValues[0].x,y:oldValues[0].y},{x:oldValues[1].x,y:oldValues[1].y});
   const after=pointerMid({x:newValues[0].x,y:newValues[0].y},{x:newValues[1].x,y:newValues[1].y});
   if(oldDistance>5&&newDistance>5){
    const point=canvasPoint({clientX:after.x,clientY:after.y},rect);
    zoomMap(zoom*newDistance/oldDistance,point.x,point.z);
   }
   mapCenterX-=(after.x-before.x)/Math.max(1,rect.width)*(Number(worldSize)||232)/zoom;
   mapCenterZ-=(after.y-before.y)/Math.max(1,rect.height)*(Number(worldSize)||232)/zoom;
   clampCenter();redrawMap();
  }else if(current.moved&&zoom>1){
   mapCenterX-=dx/Math.max(1,rect.width)*(Number(worldSize)||232)/zoom;
   mapCenterZ-=dy/Math.max(1,rect.height)*(Number(worldSize)||232)/zoom;
   clampCenter();redrawMap();
  }
  if(current.moved||pointers.size>1)event.preventDefault();
 });
 function selectMapAt(clientX,clientY){
  if(root.hidden||step!=='map')return false;
  const rect=mapCanvas.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return false;
  if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return false;
  const xy=canvasPoint({clientX,clientY},rect);
  let index=-1,min=Infinity;
  for(let i=0;i<mapMarkers.length;i++){
   const distance=Math.hypot(xy.x-mapMarkers[i].px,xy.z-mapMarkers[i].pz);
   if(distance<min){min=distance;index=i;}
  }
  // CSS-sized hit area, regardless of device resolution or zoom.
  const hitRadius=Math.max(15,20/Math.max(1,rect.width)*mapCanvas.width);
  if(index>=0&&min<=hitRadius){chooseChoice(index);return true;}
  const world=Math.max(1,Number(worldSize)||232);
  const mapX=mapCenterX+(xy.x/mapCanvas.width-.5)*world/zoom;
  const mapZ=mapCenterZ+(xy.z/mapCanvas.height-.5)*world/zoom;
  if(mapX<0||mapZ<0||mapX>=world||mapZ>=world){
   $('objectiveTurnMapHint').textContent='戦場の範囲内をタップしてください。';return false;
  }
  const point=getLegalMapPoint(Math.round(mapX),Math.round(mapZ));
  const g=visibleGroup(engine.snapshot());
  if(!g?.alive||!point||!Number.isFinite(Number(point.x))||!Number.isFinite(Number(point.z))){
   $('objectiveTurnMapHint').textContent='その場所は進入できません。通れる地形を選んでください。';return false;
  }
  if(!engine.setMove(g.id,'point',Math.round(point.x)+','+Math.round(point.z)))return false;
  step='action';$('objectiveTurnMapStep').classList.remove('expanded');
  const button=root.querySelector('[data-map-expand]');button.textContent='⛶ 大きく';
  button.setAttribute('aria-expanded','false');render();
  return true;
 }
 function dropPointer(event,cancelled=false){
  const p=pointers.get(event.pointerId);if(!p)return;
  const solitary=pointers.size===1;
  pointers.delete(event.pointerId);
  if(cancelled||!solitary||p.moved||root.hidden||step!=='map'){
   if(cancelled||p.moved)lastGestureAt=performance.now();
   return;
  }
  lastTapHandledAt=performance.now();
  selectMapAt(p.x,p.y);
 }
 mapCanvas.addEventListener('pointerup',event=>dropPointer(event));
 mapCanvas.addEventListener('pointercancel',event=>dropPointer(event,true));
 mapCanvas.addEventListener('click',event=>{
  if(performance.now()-lastTapHandledAt<400||performance.now()-lastGestureAt<450||pointers.size)return;
  selectMapAt(event.clientX,event.clientY);
 });
 mapCanvas.addEventListener('wheel',event=>{
  if(root.hidden||step!=='map')return;
  event.preventDefault();
  const xy=canvasPoint(event);
  zoomMap(zoom*(event.deltaY<0?1.3:1/1.3),xy.x,xy.z);
 },{passive:false});
  $('objectiveTurnAdvance').addEventListener('click',()=>{engine.start();render();});
 let rpgRefreshAt=0;
 function update(dt,wallDt=dt){
  const before=engine.status();engine.update(dt,{wallDt});const after=engine.status();
  rpgRefreshAt+=Math.max(0,Number(wallDt)||0);
  if(rpgRefreshAt>=1){rpgRefreshAt=0;if(!root.hidden)renderRpgMini();}
  if(before.phase!==after.phase||Math.ceil(before.remaining)!==Math.ceil(after.remaining))render();
 }
 return {begin:()=>{if(!shown){shown=true;engine.begin();render();}},update,
  open:()=>{if(engine.interrupt()){step='map';render();}},finish:()=>{engine.finish();render();},
  snapshot:engine.snapshot,engine};
}
