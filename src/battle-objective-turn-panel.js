import {createObjectiveTurnEngine,TURN_MOVE_OPTIONS,TURN_ACTION_OPTIONS} from './battle-objective-turns.js?v=20261118-map-paging2';

/**
 * Phone-sized objective turn interface.
 * One army group per page -> tap a real location on the battlefield map ->
 * choose one arrival action, optionally choosing an owned item.
 */
export function installObjectiveTurnPanel({
 groupIds,getGroups,getMoveTargets=()=>[],getMapChoices=()=>[],
 getGroupPowers=()=>({}),getGroupJobs=()=>[],getEnemyGroups=()=>[],getGroupOrigin=()=>null,
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
  '<div id="objectiveTurnMapStep"><div class="objectiveTurnMapTools"><strong>🗺 移動先をタップ</strong><button type="button" data-map-zoom="out" aria-label="地図を縮小">−</button><span id="objectiveTurnZoomLevel">100%</span><button type="button" data-map-zoom="in" aria-label="地図を拡大">＋</button><button type="button" data-map-zoom="reset">全体</button><button type="button" data-map-expand aria-expanded="false">⛶ 大きく</button></div><canvas id="objectiveTurnMap" width="464" height="464" aria-label="戦場地図。二本指で拡大、ドラッグで移動、地点をタップして選択"></canvas><div id="objectiveTurnMapHint"></div><div id="objectiveTurnChoices" class="objectiveTurnChoices"></div><div class="objectiveChoicePager"><button type="button" data-choice-page="-1">◀</button><span id="objectiveChoicePage"></span><button type="button" data-choice-page="1">▶</button></div></div>'+
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
 let zoom=1,mapCenterX=(Number(worldSize)||232)/2,mapCenterZ=mapCenterX,lastTap=0;
 const pointers=new Map();
 const zoomBounds=[1,6];
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
  mapMarkers=choicesFor(id).map(c=>({...c,...(()=>{
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
  const jobs=getGroupJobs(id);
  $('objectiveTurnGroup').innerHTML='<strong>🔵 味方 第'+id+'班 · '+(Math.round((Number(power[id])||0)*10)/10)+' 戦力P · '+(Number(group?.alive)||0)+'人</strong>'+
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
   $('objectiveTurnMapHint').textContent=options.length?'＋／−で拡大・縮小、指でドラッグ／ピンチ操作。地点をタップすると作戦選択へ進みます。':'移動可能な地点がありません。現在地で待機を選択してください。';
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
  $('objectiveTurnAdvance').textContent=report?'この作戦で次ターンへ':'設定した作戦でターン開始';
  $('objectiveTurnAdvance').disabled=state.groups.every(g=>!g.alive);
  if(state.error)$('objectiveTurnHint').textContent+=' ⚠ '+state.error;
  $('objectiveTurnZoomLevel').textContent=Math.round(zoom*100)+'%';
  root.querySelector('[data-map-expand]').setAttribute('aria-expanded',String($('objectiveTurnMapStep').classList.contains('expanded')));
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
