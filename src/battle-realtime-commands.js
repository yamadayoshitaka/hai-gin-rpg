/**
 * Real-time battle control surface.
 * One prebattle positioning pass; afterwards the user selects a squad and
 * its real destination while the combat simulation continues uninterrupted.
 */
import {setBattleJobPortrait} from './battle-job-portraits.js';
import {visibleBattleSquadPins} from './battle-squad-leader-pins.js';
import {battleAttackCommand} from './battle-attack-choices.js';
import {battleJobSpecialActions} from './battle-job-special-actions.js';
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
 onPause=()=>{},getPaused=()=>false,
 getSpecialTargets=()=>[],onSpecial=()=>false,getAvailableItems=()=>[],onUseItem=()=>false
}={}){
 const doc=documentRef;
 if(!doc?.body?.append)throw Error('Real-time battle requires document.body');
 let started=false,mode='deploy',selectedId=null,zoom=1,centerX=worldSize/2,centerZ=worldSize/2;
 const deploymentActions=new Map(),arrivalActions=new Map(),preferredActions=new Map();
 let choosingActionFor=null,actionDestination=null,planningOwnsPause=false;
 const root=doc.createElement('section');root.id='battleRealtimeControls';
 root.innerHTML=`
  <div id="realtimeBattleDock" hidden role="group" aria-label="選択中の隊の作戦">
   <button type="button" id="realtimeDockClose" aria-label="作戦を閉じて戦闘に戻る">✕ 戻る</button>
   <div class="realtimeDockSquadPager" role="group" aria-label="作戦を選ぶ隊をページ切替">
    <button type="button" id="realtimeDockPrev" aria-label="前の隊">◀</button>
    <span class="realtimeDockPortrait" id="realtimeDockPortrait" aria-hidden="true"></span>
    <strong id="realtimeDockSquadName">味方隊</strong>
    <button type="button" id="realtimeDockNext" aria-label="次の隊">▶</button>
    <small id="realtimeDockPage">1/10</small>
   </div>
   <span id="realtimeSelectedState" role="status">部隊を選択</span>
   <button type="button" id="realtimeMove">📍 移動先</button>
   <button type="button" id="realtimeDefend">🛡 守備</button>
   <button type="button" id="realtimeCharge">⚔ 攻撃</button>
   <button type="button" id="realtimeHold">◷ 待機</button>
   <button type="button" id="realtimeSupport">✚ 支援・道具</button>
   <button type="button" id="realtimeSpecial">★ 固有作戦</button>
   <button type="button" id="realtimeMenu" aria-label="ゲームメニュー">☰</button>
   <div id="realtimeDockAttackChoices" class="realtimeAttackChoices" hidden role="group" aria-label="攻撃種別">
    <strong>攻撃種別</strong>
    <button type="button" data-attack-kind="near" data-attack-origin="dock">近距離</button>
    <button type="button" data-attack-kind="far" data-attack-origin="dock">遠距離</button>
    <button type="button" data-attack-kind="intercept" data-attack-origin="dock">迎撃</button>
    <button type="button" data-attack-kind="delay" data-attack-origin="dock">延期</button>
   </div>
   <div id="realtimeDockSupportChoices" class="realtimeContextChoices" hidden role="group" aria-label="支援アイテム"></div>
   <div id="realtimeDockSpecialChoices" class="realtimeContextChoices" hidden role="group" aria-label="ジョブ固有作戦"></div>
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
    <div class="realtimeMapViewport">
     <div class="realtimeMapZoom" aria-label="地図の拡大縮小">
      <button type="button" data-realtime-zoom="1" aria-label="地図を拡大">＋ 拡大</button>
      <button type="button" data-realtime-zoom="-1" aria-label="地図を縮小">－ 縮小</button>
      <button type="button" id="realtimeMapReset">全域</button>
      <span id="realtimeMapScale">100%</span>
     </div>
     <canvas id="realtimeBattleCanvas" width="464" height="464"
      aria-label="味方隊を選択して、移動先の地図をタップ" tabindex="0"></canvas>
    </div>
    <div class="realtimeMapMessage" id="realtimeMapMessage" role="status"></div>
    <div class="realtimeMapActionSheet" id="realtimeMapActionSheet" role="group" aria-label="移動後の行動を選択">
     <strong>② 行動を選択（移動前でも設定可能）</strong>
     <div class="realtimeMapActionButtons">
      <button type="button" data-action-after-move="defend">🛡 守備</button>
      <button type="button" data-action-after-move="charge">⚔ 攻撃</button>
      <button type="button" data-action-after-move="hold">◷ 待機</button>
      <button type="button" data-action-after-move="support">🎒 支援・道具</button>
     </div>
     <div id="realtimeMapAttackChoices" class="realtimeAttackChoices" hidden role="group" aria-label="攻撃種別">
      <strong>攻撃種別</strong>
      <button type="button" data-attack-kind="near" data-attack-origin="map">近距離</button>
      <button type="button" data-attack-kind="far" data-attack-origin="map">遠距離</button>
      <button type="button" data-attack-kind="intercept" data-attack-origin="map">迎撃</button>
      <button type="button" data-attack-kind="delay" data-attack-origin="map">延期</button>
     </div>
     <button type="button" data-action-after-move="special">★ 固有作戦</button>
     <div id="realtimeMapSupportChoices" class="realtimeContextChoices" hidden role="group" aria-label="支援アイテム"></div>
     <div id="realtimeMapSpecialChoices" class="realtimeContextChoices" hidden role="group" aria-label="ジョブ固有作戦"></div>
     <button type="button" class="realtimeActionSkip" id="realtimeActionSkip">行動指定なし（移動のみ）</button>
    </div>
    <button type="button" id="realtimeStart">配置を確定して戦闘開始 ▶</button>
   </div>
  </div>`;
 doc.body.append(root);
 const $=id=>root.querySelector('#'+id);
 const canvas=$('realtimeBattleCanvas'),ctx=canvas.getContext('2d');
 let currentRows=[];
 let squadSnapshot=[],squadSnapshotAt=-Infinity,lastMapRedrawAt=-Infinity;
 let mapDrawPending=false;
 const nowMs=()=>globalThis.performance?.now?.()??Date.now();
 const invalidateSquadSnapshot=()=>{squadSnapshotAt=-Infinity;};
 function squads(){
  const now=nowMs();
  if(squadSnapshotAt<0||now-squadSnapshotAt>=300){
   squadSnapshot=getSquads().filter(x=>x&&x.id!=null);
   squadSnapshotAt=now;
  }
  return squadSnapshot;
 }
 function scheduleMapDraw(){
  if(mapDrawPending)return;
  if(typeof globalThis.requestAnimationFrame!=='function'){drawMap();return;}
  mapDrawPending=true;
  globalThis.requestAnimationFrame(()=>{mapDrawPending=false;drawMap();});
 }
 function refreshOptions(){
  const own=squads();
  if(!own.length)return;
  if(!own.some(s=>String(s.id)===String(selectedId)))selectedId=String(own[0].id);
  const index=own.findIndex(s=>String(s.id)===String(selectedId));
  $('realtimeMapSquadName').textContent=String(own[index]?.label||'第'+(index+1)+'隊');
  const face=$('realtimeMapPortrait'),faceKey=String(own[index]?.job)+'|'+String(own[index]?.id);
  if(face.dataset.signature!==faceKey){setBattleJobPortrait(face,own[index]?.job,own[index]?.id,0);face.dataset.signature=faceKey;}
  $('realtimeMapPage').textContent=(index+1)+'/'+own.length;
  $('realtimeMapPrev').disabled=index<=0;
  $('realtimeMapNext').disabled=index>=own.length-1;
  $('realtimeDockPrev').disabled=index<=0;
  $('realtimeDockNext').disabled=index>=own.length-1;
  $('realtimeDockSquadName').textContent=String(own[index]?.label||'第'+(index+1)+'隊');
  $('realtimeDockPage').textContent=(index+1)+'/'+own.length;
  const dockFace=$('realtimeDockPortrait');
  if(dockFace.dataset.signature!==faceKey){
   setBattleJobPortrait(dockFace,own[index]?.job,own[index]?.id,0);
   dockFace.dataset.signature=faceKey;
  }
 }
 function getSelected(){return squads().find(s=>String(s.id)===String(selectedId))||null;}
 function setSelected(id,{focus=false}={}){
  if(!squads().some(s=>String(s.id)===String(id)))return false;
  if(choosingActionFor!=null&&String(id)!==String(choosingActionFor))hideActionSheet();
  selectedId=String(id);
  $('realtimeDockAttackChoices').hidden=true;
  $('realtimeMapAttackChoices').hidden=true;
  refreshOptions();renderActionSelection();onSelect(selectedId);
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
  // The combat clock is frozen while this action tray is being operated.
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
  lastMapRedrawAt=nowMs();
 }

 function hideContextChoices(){
  for(const id of ['realtimeDockAttackChoices','realtimeMapAttackChoices','realtimeDockSupportChoices',
   'realtimeMapSupportChoices','realtimeDockSpecialChoices','realtimeMapSpecialChoices'])$(id).hidden=true;
 }
 function actionPanel(origin,kind){
  const node=$(origin==='map'?'realtimeMap'+kind+'Choices':'realtimeDock'+kind+'Choices');
  hideContextChoices();node.hidden=false;node.replaceChildren();return node;
 }
 function contextButton(parent,label,fn){
  const button=doc.createElement('button');button.type='button';
  button.textContent=label;button.onclick=fn;parent.append(button);return button;
 }
 function contextNote(parent,message){
  const note=doc.createElement('small');note.textContent=message;parent.append(note);
 }
 function confirmContextAction(origin,entry){
  const id=String(selectedId||'');
  if(origin==='map'&&mode==='deploy'){
   $('realtimeMapMessage').textContent='固有作戦・道具は開戦後に使用できます。';return;
  }
  if(origin==='map'&&mode==='move'&&actionDestination){
   arrivalActions.set(id,{...entry,point:{...actionDestination}});
   closeMap();closeSquadControls();return;
  }
  const accepted=entry.itemId?onUseItem(id,entry.itemId):onSpecial(id,entry.special,entry.targetId);
  if(accepted){hideContextChoices();closeSquadControls();return;}
  $(origin==='map'?'realtimeMapMessage':'realtimeSelectedState').textContent=
   '実行できません。対象との距離、所持数、軍師、命令制限を確認してください。';
 }
 function showSupportChoices(origin){
  const node=actionPanel(origin,'Support'),items=getAvailableItems(String(selectedId))||[];
  if(!items.length){contextNote(node,'使える道具がありません。');return;}
  contextNote(node,'使用する道具を選択（所持品から1個消費）');
  for(const item of items)
   contextButton(node,'🎒 '+String(item.label||item.id)+' ×'+(item.quantity||0),
    ()=>confirmContextAction(origin,{itemId:String(item.id)}));
 }
 function showSpecialTargets(origin,action,page=0){
  const node=actionPanel(origin,'Special');
  contextButton(node,'◀ 戻る',()=>showSpecialChoices(origin));
  const targets=getSpecialTargets(String(selectedId),action.id)||[];
  if(!targets.length){contextNote(node,'実行できる対象がありません。');return;}
  const perPage=4,last=Math.max(0,Math.ceil(targets.length/perPage)-1);
  page=clamp(page,0,last);contextNote(node,action.label+'：対象を選択');
  for(const target of targets.slice(page*perPage,(page+1)*perPage))
   contextButton(node,String(target.label||target.id),
    ()=>confirmContextAction(origin,{special:action.id,targetId:String(target.id)}));
  if(last>0){
   const nav=doc.createElement('div');nav.className='realtimeContextPager';node.append(nav);
   const prev=contextButton(nav,'◀',()=>showSpecialTargets(origin,action,page-1));
   prev.disabled=page===0;contextNote(nav,(page+1)+'/'+(last+1));
   const next=contextButton(nav,'▶',()=>showSpecialTargets(origin,action,page+1));
   next.disabled=page===last;
  }
 }
 function showSpecialChoices(origin){
  const node=actionPanel(origin,'Special'),actions=battleJobSpecialActions(getSelected()?.job);
  if(!actions.length){contextNote(node,'このジョブの固有作戦はありません。');return;}
  contextNote(node,String(getSelected()?.job||'')+'隊の固有作戦');
  for(const action of actions)
   contextButton(node,action.label,()=>showSpecialTargets(origin,action));
 }
 function renderActionSelection(){
  const chosen=preferredActions.get(String(selectedId));
  for(const button of root.querySelectorAll('[data-action-after-move]')){
   const active=button.dataset.actionAfterMove===chosen||
    (button.dataset.actionAfterMove==='charge'&&String(chosen||'').startsWith('attack_'));
   button.classList.toggle('selected',active);
   button.setAttribute('aria-pressed',String(active));
  }
  $('realtimeActionSkip').classList.toggle('selected',!chosen);
  for(const button of root.querySelectorAll('[data-attack-kind]')){
   const active=chosen==='attack_'+button.dataset.attackKind;
   button.classList.toggle('selected',active);
   button.setAttribute('aria-pressed',String(active));
   button.disabled=button.dataset.attackKind==='far'&&
    battleAttackCommand('far',getSelected()?.job)==null;
  }
 }
 function enterPlanning(){
  if(!started||getPaused())return;
  onPause();planningOwnsPause=Boolean(getPaused());
 }
 function exitPlanning(){
  if(!planningOwnsPause)return;
  planningOwnsPause=false;
  if(getPaused())onPause();
 }
 function showSquadControls(id){
  if(!started)return false;
  if(!setSelected(id))return false;
  enterPlanning();
  $('realtimeBattleDock').hidden=false;
  return true;
 }
 function closeSquadControls(){
  $('realtimeBattleDock').hidden=true;
  $('realtimeDockAttackChoices').hidden=true;
  $('realtimeMapAttackChoices').hidden=true;
  if($('realtimeBattleMapOverlay').hidden)exitPlanning();
 }
 function hideActionSheet(){
  choosingActionFor=null;actionDestination=null;
  renderActionSelection();
 }
 function showActionSheet(id,point){
  choosingActionFor=String(id);actionDestination={x:point.x,z:point.z};
  renderActionSelection();
  $('realtimeMapMessage').textContent=mode==='deploy'?'配置を保存しました。行動を変更できます。':
   '移動先を指定しました。到着後の行動を選択できます。';
 }
 function openMap(next='move'){
  hideActionSheet();mode=next;refreshOptions();
  if(started)enterPlanning();
  $('realtimeBattleMapOverlay').hidden=false;
  $('realtimeMapClose').hidden=next==='deploy';
  $('realtimeStart').hidden=next!=='deploy';
  $('realtimeMapTitle').textContent=next==='deploy'?'開戦前の初期配置':'移動先を選択';
  $('realtimeMapHelp').textContent=next==='deploy'?
   '◀ ▶で隊を切替え、隊長の番号ピンを目印に味方陣地へ配置。敵隊は開戦後に表示します。':
   '◀ ▶で移動する味方隊を選び、地図をタップ。戦闘はリアルタイムで進みます。';
  $('realtimeMapMessage').textContent='';
  renderActionSelection();
  if(next==='move'){zoom=1.6;const own=getSelected();
   centerX=Number.isFinite(own?.x)?own.x:worldSize/2;
   centerZ=Number.isFinite(own?.z)?own.z:worldSize/2;}
  else {zoom=1;centerX=centerZ=worldSize/2;}
  drawMap();
 }
 function closeMap(){
  if(mode==='deploy')return;
  hideActionSheet();$('realtimeBattleMapOverlay').hidden=true;mode='live';
  if($('realtimeBattleDock').hidden)exitPlanning();
 }
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
   if(applied){invalidateSquadSnapshot();refreshOptions();drawMap();showActionSheet(selectedId,point);}
   return applied;
  }
  const applied=onMove(selectedId,point);
  $('realtimeMapMessage').textContent=applied?'移動命令を発令しました。':'現在は移動を指示できません。';
  if(applied){
   deploymentActions.delete(String(selectedId));arrivalActions.delete(String(selectedId));
   showActionSheet(selectedId,point);
   const preferred=preferredActions.get(String(selectedId));
   const queuedCommand=String(preferred||'').startsWith('attack_')?
    battleAttackCommand(preferred.slice(7),squad.job):
    preferred==='support'?'defend':preferred;
   if(queuedCommand)arrivalActions.set(String(selectedId),{
    command:queuedCommand,point:{...point}});
  }
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
   scheduleMapDraw();
  }
 });
 canvas.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dragged=pointer.pan;pointer=null;
  if(dragged){drawMap();return;}
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)/rect.width,pz=(e.clientY-rect.top)/rect.height;
  if(px<0||px>1||pz<0||pz>1)return;
  const point=mapPoint(px,pz);chooseMapCell(point.x,point.z);
 });
 canvas.addEventListener('pointercancel',()=>{pointer=null;});
 for(const [button,offset] of [['realtimeMapPrev',-1],['realtimeMapNext',1],['realtimeDockPrev',-1],['realtimeDockNext',1]])
  $(button).addEventListener('click',()=>{
   const own=squads(),index=own.findIndex(s=>String(s.id)===String(selectedId));
   const next=own[index+offset];
   if(next)setSelected(next.id);
  });
 for(const button of root.querySelectorAll('[data-action-after-move]'))
  button.addEventListener('click',()=>{
   const id=String(selectedId||'');if(!id)return;
   const chosen=button.dataset.actionAfterMove;
   if(chosen==='charge'){
    $('realtimeMapAttackChoices').hidden=false;
    return;
   }
   $('realtimeMapAttackChoices').hidden=true;
   const command=chosen==='support'?'defend':chosen;
   preferredActions.set(id,chosen);renderActionSelection();
   if(mode==='deploy'){
    deploymentActions.set(id,command);
    $('realtimeMapMessage').textContent='行動を保存しました。地図での配置前でも有効です。';
   }else if(choosingActionFor===id&&actionDestination){
    arrivalActions.set(id,{command,point:{...actionDestination}});
    closeMap();closeSquadControls();renderStatus();
   }else{
    $('realtimeMapMessage').textContent='行動を選びました。地図で移動先を指定してください。';
   }
  });
 for(const button of root.querySelectorAll('[data-attack-kind]'))
  button.onclick=()=>{
   const id=String(selectedId||''),own=getSelected();
   if(!id||!own)return;
   const kind=button.dataset.attackKind,command=battleAttackCommand(kind,own.job);
   const status=button.dataset.attackOrigin==='map'?'realtimeMapMessage':'realtimeSelectedState';
   if(!command){
    $(status).textContent='遠距離攻撃は弓・魔法・僧侶・召喚士の隊のみ選択できます。';
    return;
   }
   preferredActions.set(id,'attack_'+kind);
   renderActionSelection();
   if(button.dataset.attackOrigin==='map'){
    if(mode==='deploy'){
     deploymentActions.set(id,command);
     $('realtimeMapMessage').textContent='攻撃方法を保存しました。隊の配置も変更できます。';
    }else if(choosingActionFor===id&&actionDestination){
     arrivalActions.set(id,{command,point:{...actionDestination}});
     closeMap();closeSquadControls();
    }else $('realtimeMapMessage').textContent='地図で移動先を指定してください。';
    $('realtimeMapAttackChoices').hidden=true;
   }else{
    if(onOrder(id,command))closeSquadControls();
    else $('realtimeSelectedState').textContent='今は命令できません。軍師や命令制限を確認してください。';
   }
  };
 $('realtimeActionSkip').onclick=()=>{
  const id=String(selectedId||'');
  preferredActions.delete(id);
  if(mode==='deploy')deploymentActions.delete(id);
  else arrivalActions.delete(id);
  renderActionSelection();
  if(mode==='move'&&actionDestination){closeMap();closeSquadControls();}
  else $('realtimeMapMessage').textContent='行動指定を解除しました。移動のみ設定できます。';
 };
 for(const button of root.querySelectorAll('[data-realtime-zoom]'))
  button.onclick=()=>{zoom=clamp(zoom*(button.dataset.realtimeZoom==='1'?1.6:1/1.6),1,6);drawMap();};
 $('realtimeMapReset').onclick=()=>{zoom=1;centerX=centerZ=worldSize/2;drawMap();};
 $('realtimeMove').onclick=()=>openMap('move');
 $('realtimeMapClose').onclick=closeMap;
 $('realtimeDockClose').onclick=closeSquadControls;
 $('realtimeCharge').onclick=()=>{$('realtimeDockAttackChoices').hidden=false;};
 for(const [button,command] of [['realtimeDefend','defend'],['realtimeHold','hold']])
  $(button).onclick=()=>{
   if(!started)return;
   if(onOrder(selectedId,command))closeSquadControls();
   else $('realtimeSelectedState').textContent='今は命令できません。軍師や命令制限を確認してください。';
  };
 $('realtimeStart').onclick=()=>{
  if(started)return;
  started=true;mode='live';hideActionSheet();$('realtimeBattleMapOverlay').hidden=true;
  $('realtimeBattleDock').hidden=true;onStart();renderStatus();
 };
 $('realtimeRoster')?.addEventListener('click',()=>onRoster());
 $('realtimeMenu').onclick=()=>onMenu();
 // Pause is controlled by entering/leaving the squad planning dock.
 return {
  openDeployment(){started=false;mode='deploy';planningOwnsPause=false;deploymentActions.clear();arrivalActions.clear();preferredActions.clear();invalidateSquadSnapshot();$('realtimeBattleDock').hidden=true;openMap('deploy');},
  selectSquad:setSelected,
  showSquadControls,
  closeSquadControls,
  get controlsOpen(){return !$('realtimeBattleDock').hidden;},
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
   renderStatus();
   // No physical positions change while initial deployment is paused.
   // Live map pins need only about 3 updates/sec, never every UI tick.
   if(mode==='move'&&!$('realtimeBattleMapOverlay').hidden&&
      nowMs()-lastMapRedrawAt>=330)scheduleMapDraw();
  },
  get started(){return started;},
  get selectedId(){return selectedId;},
  get mode(){return mode;},
  get queuedArrivalActions(){return [...arrivalActions.keys()]},
  get deploymentActions(){return [...deploymentActions.keys()]},
  get preferredActions(){return [...preferredActions.entries()]},
  get isMapOpen(){return !$('realtimeBattleMapOverlay').hidden;},
  root,dispose(){root.remove();}
 };
}
