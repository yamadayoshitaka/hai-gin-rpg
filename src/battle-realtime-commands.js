/**
 * Real-time battle control surface.
 * One prebattle positioning pass; afterwards the user selects a squad and
 * its real destination while the combat simulation continues uninterrupted.
 */
import {setBattleJobPortrait} from './battle-job-portraits.js';
import {visibleBattleSquadPins} from './battle-squad-leader-pins.js';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function battleMapCell(clientX,clientY,rect,{worldSize=232,zoom=1,centerX=worldSize/2,centerZ=worldSize/2}={}){
 if(!(rect?.width>0&&rect?.height>0))return null;
 const px=(clientX-rect.left)/rect.width,pz=(clientY-rect.top)/rect.height;
 if(px<0||px>1||pz<0||pz>1)return null;
 const span=worldSize/zoom;
 return {x:Math.round(clamp(centerX+(px-.5)*span,0,worldSize-1)),
  z:Math.round(clamp(centerZ+(pz-.5)*span,0,worldSize-1))};
}
export function createRealtimeBattleCommands({
 documentRef=globalThis.document,worldSize=232,
 getSquads=()=>[],getEnemies=()=>[],getMapBackground=()=>null,
 getLegalPoint=(x,z)=>({x,z}),canDeploy=()=>true,
 onDeploy=()=>false,onStart=()=>{},onMove=()=>false,onOrder=()=>false,
 onSelect=()=>{},onFocus=()=>{},onRoster=()=>{},onMenu=()=>{},
 onPause=()=>{},getPaused=()=>false
}={}){
 const doc=documentRef;
 if(!doc?.body?.append)throw Error('Real-time battle requires document.body');
 let started=false,mode='deploy',selectedId=null,zoom=1,centerX=worldSize/2,centerZ=worldSize/2;
 const deploymentActions=new Map(),arrivalActions=new Map();
 let choosingActionFor=null,actionDestination=null;
 const root=doc.createElement('section');root.id='battleRealtimeControls';
 root.innerHTML=`
  <div id="realtimeBattleDock" hidden>
   <button type="button" id="realtimeRoster" aria-label="味方と敵の部隊一覧を開閉">☷ 戦力</button>
   <label class="realtimeSquadPicker">味方隊<select id="realtimeSquadSelect" aria-label="移動を指示する味方隊"></select></label>
   <span id="realtimeSelectedState" role="status">部隊を選択</span>
   <button type="button" id="realtimeMove">📍 移動先</button>
   <button type="button" id="realtimeDefend">守備</button>
   <button type="button" id="realtimeCharge">突撃</button>
   <button type="button" id="realtimePause">一時停止</button>
   <button type="button" id="realtimeMenu" aria-label="ゲームメニュー">☰</button>
  </div>
  <div id="realtimeBattleMapOverlay" hidden role="dialog" aria-modal="true" aria-label="戦場地図で移動先を選択">
   <div class="realtimeMapCard">
    <header><strong id="realtimeMapTitle">開戦前の隊列配置</strong>
     <button type="button" id="realtimeMapClose" hidden>✕ 戻る</button></header>
    <div class="realtimeMapHelp" id="realtimeMapHelp">味方の隊を選び、味方陣地の地図をタップして配置してください。</div>
    <div class="realtimeMapSquadPager" role="group" aria-label="配置・移動する味方隊をページ切替">
     <button type="button" id="realtimeMapPrev" aria-label="前の味方隊">◀</button>
     <span class="realtimeMapPortrait" id="realtimeMapPortrait" aria-hidden="true"></span><strong id="realtimeMapSquadName" aria-live="polite">味方隊</strong>
     <button type="button" id="realtimeMapNext" aria-label="次の味方隊">▶</button>
     <span id="realtimeMapPage" aria-label="選択中の隊番号">1/1</span>
    </div>
    <div class="realtimeMapZoom">
     <button type="button" data-realtime-zoom="-1">－ 縮小</button>
     <button type="button" data-realtime-zoom="1">＋ 拡大</button>
     <button type="button" id="realtimeMapReset">全域</button>
     <span id="realtimeMapScale">100%</span>
    </div>
    <canvas id="realtimeBattleCanvas" width="464" height="464"
     aria-label="味方隊を選択して、移動先の地図をタップ" tabindex="0"></canvas>
    <div class="realtimeMapMessage" id="realtimeMapMessage" role="status"></div>
    <div class="realtimeMapActionSheet" id="realtimeMapActionSheet" hidden role="group" aria-label="移動後の行動を選択">
     <strong>② 移動後の行動を選択</strong>
     <div class="realtimeMapActionButtons">
      <button type="button" data-action-after-move="defend">🛡 守備</button>
      <button type="button" data-action-after-move="charge">⚔ 突撃</button>
      <button type="button" data-action-after-move="hold">◷ 待機</button>
      <button type="button" data-action-after-move="support" title="守備効果を使用する支援行動">✚ 支援</button>
     </div>
     <button type="button" class="realtimeActionSkip" id="realtimeActionSkip">行動指定なし（移動のみ）</button>
    </div>
    <button type="button" id="realtimeStart">配置を確定して戦闘開始 ▶</button>
   </div>
  </div>`;
 doc.body.append(root);
 const $=id=>root.querySelector('#'+id);
 const canvas=$('realtimeBattleCanvas'),ctx=canvas.getContext('2d');
 let currentRows=[];
 function squads(){return getSquads().filter(x=>x&&x.id!=null);}
 function refreshOptions(){
  const own=squads();
  if(!own.length)return;
  if(!own.some(s=>String(s.id)===String(selectedId)))selectedId=String(own[0].id);
  for(const select of [$('realtimeSquadSelect')]){
   const keys=own.map(s=>String(s.id)+':'+String(s.label||''));
   if(select.dataset.signature!==keys.join('|')){
    select.replaceChildren(...own.map(s=>{
     const option=doc.createElement('option');option.value=String(s.id);
     option.textContent=String(s.label||'第'+s.id+'隊');
     return option;
    }));select.dataset.signature=keys.join('|');
   }
   select.value=String(selectedId);
  }
  const index=own.findIndex(s=>String(s.id)===String(selectedId));
  $('realtimeMapSquadName').textContent=String(own[index]?.label||'第'+(index+1)+'隊');
  const face=$('realtimeMapPortrait'),faceKey=String(own[index]?.job)+'|'+String(own[index]?.id);
  if(face.dataset.signature!==faceKey){setBattleJobPortrait(face,own[index]?.job,own[index]?.id,0);face.dataset.signature=faceKey;}
  $('realtimeMapPage').textContent=(index+1)+'/'+own.length;
  $('realtimeMapPrev').disabled=index<=0;
  $('realtimeMapNext').disabled=index>=own.length-1;
 }
 function getSelected(){return squads().find(s=>String(s.id)===String(selectedId))||null;}
 function setSelected(id,{focus=false}={}){
  if(!squads().some(s=>String(s.id)===String(id)))return false;
  if(choosingActionFor!=null&&String(id)!==String(choosingActionFor))hideActionSheet();
  selectedId=String(id);refreshOptions();onSelect(selectedId);
  if(focus)onFocus(selectedId);
  renderStatus();drawMap();return true;
 }
 function renderStatus(){
  const own=getSelected();
  if(!own)return;
  const count=String(own.alive??0)+'/'+String(own.total??0);
  const hp=Math.round(Number(own.hp)||0)+'/'+Math.round(Number(own.maxHp)||0);
  const suffix=(currentRows.find(r=>r.team===0&&String(r.id)===String(selectedId))?.mode||'');
  const queued=arrivalActions.get(String(selectedId));
  $('realtimeSelectedState').textContent='HP '+hp+' · '+count+'人'+(queued?' · 到着後の行動予約':suffix==='move'?' · 移動中':'');
  $('realtimePause').textContent=getPaused()?'再開':'一時停止';
 }
 function syncMapContext(){
  if(zoom>1&&getSelected()&&mode==='deploy'){
   const s=getSelected();centerX=clamp(s.x||worldSize/2,0,worldSize);
   centerZ=clamp(s.z||worldSize/2,0,worldSize);
  }
 }
 function drawMap(){
  if($('realtimeBattleMapOverlay').hidden||!ctx)return;
  const w=canvas.width,h=canvas.height;
  const span=worldSize/zoom;
  const minX=clamp(centerX-span/2,0,worldSize-span);
  const minZ=clamp(centerZ-span/2,0,worldSize-span);
  centerX=minX+span/2;centerZ=minZ+span/2;
  ctx.clearRect(0,0,w,h);
  const background=getMapBackground();
  if(background)ctx.drawImage(background,minX,minZ,span,span,0,0,w,h);
  else{ctx.fillStyle='#24433e';ctx.fillRect(0,0,w,h);}
  ctx.strokeStyle='#ffffff20';ctx.lineWidth=1;
  for(let i=0;i<=8;i++){const v=i*w/8;ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,h);ctx.stroke();}
  // Before battle, only the ten friendly squad leader markers are useful.
  // Enemy squads enter the map only after combat begins.
  const allies=squads(),enemies=mode==='deploy'?[]:getEnemies();
  const markers=visibleBattleSquadPins(allies,enemies,mode);
  for(const s of markers){
   if(!Number.isFinite(s.x)||!Number.isFinite(s.z))continue;
   const x=(s.x-minX)/span*w,z=(s.z-minZ)/span*h;
   if(x<0||x>w||z<0||z>h)continue;
   const own=s.team!==1,number=(own?allies:enemies)
    .findIndex(pin=>String(pin.id)===String(s.id))+1;
   const highlighted=own&&String(s.id)===String(selectedId);
   // One numbered dot per squad. Never render individual soldier positions.
   ctx.beginPath();ctx.arc(x,z,number>=10?10:9,0,Math.PI*2);
   ctx.fillStyle=own?'#5bc8ef':'#ff858a';ctx.fill();
   ctx.strokeStyle=highlighted?'#ffe39d':'#183647';
   ctx.lineWidth=highlighted?3:1.5;ctx.stroke();
   ctx.fillStyle='#0c2a3b';ctx.font='bold 10px system-ui';
   ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(String(number),x,z);
  }
  $('realtimeMapScale').textContent=Math.round(zoom*100)+'%';
 }
 function hideActionSheet(){
  choosingActionFor=null;actionDestination=null;
  $('realtimeMapActionSheet').hidden=true;
 }
 function showActionSheet(id,point){
  choosingActionFor=String(id);actionDestination={x:point.x,z:point.z};
  $('realtimeMapActionSheet').hidden=false;
  $('realtimeMapMessage').textContent=mode==='deploy'?'① 配置完了。② 移動後の行動を選択してください。':
   '① 移動先を設定しました。② 到着後の行動を選択してください。';
 }
 function openMap(next='move'){
  hideActionSheet();mode=next;refreshOptions();
  $('realtimeBattleMapOverlay').hidden=false;
  $('realtimeMapClose').hidden=next==='deploy';
  $('realtimeStart').hidden=next!=='deploy';
  $('realtimeMapTitle').textContent=next==='deploy'?'開戦前の初期配置':'移動先を選択';
  $('realtimeMapHelp').textContent=next==='deploy'?
   '◀ ▶で隊を切替え、隊長の番号ピンを目印に味方陣地へ配置。敵隊は開戦後に表示します。':
   '◀ ▶で移動する味方隊を選び、地図をタップ。戦闘はリアルタイムで進みます。';
  $('realtimeMapMessage').textContent='';
  if(next==='move'){zoom=1.6;const own=getSelected();
   centerX=Number.isFinite(own?.x)?own.x:worldSize/2;
   centerZ=Number.isFinite(own?.z)?own.z:worldSize/2;}
  else {zoom=1;centerX=centerZ=worldSize/2;}
  drawMap();
 }
 function closeMap(){if(mode==='deploy')return;hideActionSheet();$('realtimeBattleMapOverlay').hidden=true;mode='live';}
 function mapPoint(px,pz){
  const span=worldSize/zoom;
  const minX=clamp(centerX-span/2,0,worldSize-span);
  const minZ=clamp(centerZ-span/2,0,worldSize-span);
  return {x:Math.round(minX+px*span),z:Math.round(minZ+pz*span)};
 }
 function chooseMapCell(x,z){
  const squad=getSelected();
  if(!squad)return false;
  const point=getLegalPoint(x,z,mode==='deploy');
  if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.z)){
   $('realtimeMapMessage').textContent='この地形は通行できません。別のマスを選択してください。';return false;
  }
  if(mode==='deploy'){
   if(!canDeploy(point.x,point.z)){
    $('realtimeMapMessage').textContent='初期配置は味方陣地だけです。青い陣地内の安全な場所を選んでください。';return false;
   }
   const applied=onDeploy(selectedId,point);
   $('realtimeMapMessage').textContent=applied?'配置を保存しました。別の隊も配置できます。':'配置場所が不足するか、建物・他隊に重なっています。';
   if(applied){refreshOptions();drawMap();showActionSheet(selectedId,point);}
   return applied;
  }
  const applied=onMove(selectedId,point);
  $('realtimeMapMessage').textContent=applied?'移動命令を発令しました。':'現在は移動を指示できません。';
  if(applied){deploymentActions.delete(String(selectedId));arrivalActions.delete(String(selectedId));showActionSheet(selectedId,point);}
  return applied;
 }
 let pointer=null;
 canvas.addEventListener('pointerdown',e=>{
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,pan:false,baseX:centerX,baseZ:centerZ};
  canvas.setPointerCapture?.(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  if(Math.hypot(dx,dy)>10)pointer.pan=true;
  if(pointer.pan){
   const rect=canvas.getBoundingClientRect(),span=worldSize/zoom;
   centerX=pointer.baseX-dx/Math.max(1,rect.width)*span;
   centerZ=pointer.baseZ-dy/Math.max(1,rect.height)*span;
   drawMap();
  }
 });
 canvas.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dragged=pointer.pan;pointer=null;
  if(dragged)return;
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)/rect.width,pz=(e.clientY-rect.top)/rect.height;
  if(px<0||px>1||pz<0||pz>1)return;
  const point=mapPoint(px,pz);chooseMapCell(point.x,point.z);
 });
 canvas.addEventListener('pointercancel',()=>{pointer=null;});
 $('realtimeSquadSelect').addEventListener('change',()=>setSelected($('realtimeSquadSelect').value));
 for(const [button,offset] of [['realtimeMapPrev',-1],['realtimeMapNext',1]])
  $(button).addEventListener('click',()=>{
   const own=squads(),index=own.findIndex(s=>String(s.id)===String(selectedId));
   const next=own[index+offset];
   if(next)setSelected(next.id);
  });
 for(const button of root.querySelectorAll('[data-action-after-move]'))
  button.addEventListener('click',()=>{
   if(choosingActionFor==null)return;
   const id=String(choosingActionFor),chosen=button.dataset.actionAfterMove;
   // The simulator exposes charge/defend/hold. Support uses the defensive healing stance.
   const command=chosen==='support'?'defend':chosen;
   if(mode==='deploy'){
    deploymentActions.set(id,command);
    hideActionSheet();
    $('realtimeMapMessage').textContent='移動後の行動を保存しました。別の隊も設定できます。';
   }else{
    arrivalActions.set(id,{command,point:{...actionDestination}});
    closeMap();
    renderStatus();
   }
  });
 $('realtimeActionSkip').onclick=()=>{
  if(mode==='deploy'&&choosingActionFor!=null)deploymentActions.delete(String(choosingActionFor));
  if(mode==='move')closeMap();else hideActionSheet();
 };
 for(const button of root.querySelectorAll('[data-realtime-zoom]'))
  button.onclick=()=>{zoom=clamp(zoom*(button.dataset.realtimeZoom==='1'?1.6:1/1.6),1,6);drawMap();};
 $('realtimeMapReset').onclick=()=>{zoom=1;centerX=centerZ=worldSize/2;drawMap();};
 $('realtimeMove').onclick=()=>openMap('move');
 $('realtimeMapClose').onclick=closeMap;
 $('realtimeStart').onclick=()=>{
  if(started)return;
  started=true;mode='live';hideActionSheet();$('realtimeBattleMapOverlay').hidden=true;
  $('realtimeBattleDock').hidden=false;onStart();renderStatus();
 };
 for(const [id,command] of [['realtimeDefend','defend'],['realtimeCharge','charge']])
  $(id).onclick=()=>{if(!started)return;const ok=onOrder(selectedId,command);if(!ok)renderStatus();};
 $('realtimeRoster').onclick=()=>onRoster();
 $('realtimeMenu').onclick=()=>onMenu();
 $('realtimePause').onclick=()=>{onPause();renderStatus();};
 return {
  openDeployment(){started=false;mode='deploy';deploymentActions.clear();arrivalActions.clear();$('realtimeBattleDock').hidden=true;openMap('deploy');},
  selectSquad:setSelected,
  openMove(){if(started)openMap('move');},
  update(rows=[]){
   currentRows=rows;refreshOptions();
   if(started){
    // Intro lock or order cooldown can reject commands; retry on subsequent updates.
    for(const [id,command] of deploymentActions){
     if(onOrder(id,command))deploymentActions.delete(id);
    }
    for(const [id,entry] of arrivalActions){
     const own=squads().find(s=>String(s.id)===String(id));
     if(!own||Number(own.alive)<=0){arrivalActions.delete(id);continue;}
     if(!Number.isFinite(own.x)||!Number.isFinite(own.z))continue;
     if(Math.hypot(own.x-entry.point.x,own.z-entry.point.z)>3.5)continue;
     if(onOrder(id,entry.command))arrivalActions.delete(id);
    }
   }
   renderStatus();if(!$('realtimeBattleMapOverlay').hidden)drawMap();
  },
  get started(){return started;},
  get selectedId(){return selectedId;},
  get mode(){return mode;},
  get queuedArrivalActions(){return [...arrivalActions.keys()]},
  get deploymentActions(){return [...deploymentActions.keys()]},
  get isMapOpen(){return !$('realtimeBattleMapOverlay').hidden;},
  root,dispose(){root.remove();}
 };
}
