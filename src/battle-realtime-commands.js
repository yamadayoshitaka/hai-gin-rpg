/**
 * Real-time battle control surface.
 * One prebattle positioning pass; afterwards the user selects a squad and
 * its real destination while the combat simulation continues uninterrupted.
 */
import {setBattleJobPortrait} from './battle-job-portraits.js';
import {visibleBattleSquadPins} from './battle-squad-leader-pins.js';
import {battleAttackCommand} from './battle-attack-choices.js';
import {battleJobSpecialActions} from './battle-job-special-actions.js';
import {COMMAND_RALLY_TYPES} from './battle-command-doctrine.js';
import {squadRadarPins,radarHitPin} from './battle-center-radar.js';
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
 onSelect=()=>{},onFocus=()=>{},onEnemySelect=()=>{},onRoster=()=>{},onMenu=()=>{},
 onPause=()=>{},getPaused=()=>false,
 getSpecialTargets=()=>[],onSpecial=()=>false,getAvailableItems=()=>[],onUseItem=()=>false,
 onReinforce=()=>false,getRallyInfo=()=>({level:1,maxTargets:1,targets:[]}),
 onRally=()=>false
}={}){
 const doc=documentRef;
 if(!doc?.body?.append)throw Error('Real-time battle requires document.body');
 let started=false,mode='deploy',selectedId=null,zoom=1,centerX=worldSize/2,centerZ=worldSize/2;
 const deploymentActions=new Map(),arrivalActions=new Map(),preferredActions=new Map();
 let choosingActionFor=null,actionDestination=null,planningOwnsPause=false;
 const PLAN_LIMIT_MS=30000;
 let planningDeadline=0,planningTicker=null,lastRadarRenderAt=-Infinity,radarPins=[];
 const root=doc.createElement('section');root.id='battleRealtimeControls';
 root.innerHTML=`
  <div id="realtimeSquadRadar" hidden role="group" aria-label="中央部隊レーダー">
   <div class="realtimeRadarHeader"><strong>◎ 部隊レーダー</strong>
    <span id="realtimeRadarClock" hidden aria-label="作戦選択の残り時間"></span></div>
   <canvas id="realtimeRadarCanvas" width="224" height="178"
    aria-label="味方と敵の隊長位置。青が味方、赤が敵。番号は隊番号" tabindex="0"></canvas>
   <div class="realtimeRadarLegend">●味方 <span>●敵</span>　数字＝隊</div>
  </div>
  <div id="realtimeBattleDock" hidden role="group" aria-label="選択中の隊の作戦">
   <button type="button" id="realtimeDockClose" aria-label="作戦を閉じて戦闘に戻る">✕ 戻る</button>
   <span id="realtimePlanSeconds" aria-live="off">作戦選択 残り30秒</span>
   <div class="realtimeDockSquadPager" role="group" aria-label="作戦を選ぶ隊をページ切替">
    <button type="button" id="realtimeDockPrev" aria-label="前の隊">◀</button>
    <span class="realtimeDockPortrait" id="realtimeDockPortrait" aria-hidden="true"></span>
    <strong id="realtimeDockSquadName">味方隊</strong>
    <button type="button" id="realtimeDockNext" aria-label="次の隊">▶</button>
    <small id="realtimeDockPage">1/10</small>
   </div>
   <span id="realtimeSelectedState" role="status">軍師：部隊を選択</span>
   <button type="button" id="realtimeMove">📍 移動先</button>
   <button type="button" id="realtimeDefend">🛡 守備</button>
   <button type="button" id="realtimeCharge">⚔ 攻撃</button>
   <button type="button" id="realtimeHold">◷ 待機</button>
   <button type="button" id="realtimeSupport">🎒 軍師補充</button>
   <button type="button" id="realtimeRally">📣 号令・バフ</button>
   <button type="button" id="realtimeSpecial">★ 固有作戦</button>
   <button type="button" id="realtimeMenu" aria-label="ゲームメニュー">☰</button>
   <div id="realtimeDockAttackChoices" class="realtimeAttackChoices" hidden role="group" aria-label="攻撃種別">
    <strong>攻撃種別</strong>
    <button type="button" data-attack-kind="near" data-attack-origin="dock">近距離</button>
    <button type="button" data-attack-kind="far" data-attack-origin="dock">遠距離</button>
    <button type="button" data-attack-kind="intercept" data-attack-origin="dock">迎撃</button>
    <button type="button" data-attack-kind="delay" data-attack-origin="dock">延期</button>
   </div>
   <div id="realtimeDockGuardChoices" class="realtimeContextChoices" hidden role="group" aria-label="僧侶の守備・回復・蘇生"></div>
   <div id="realtimeDockSupportChoices" class="realtimeContextChoices" hidden role="group" aria-label="軍師の援軍補充"></div>
   <div id="realtimeDockRallyChoices" class="realtimeContextChoices" hidden role="group" aria-label="軍師の号令"></div>
   <div id="realtimeDockSpecialChoices" class="realtimeContextChoices" hidden role="group" aria-label="ジョブ固有作戦"></div>
  </div>
  <div id="realtimeBattleMapOverlay" hidden role="dialog" aria-modal="true" aria-label="戦場地図で移動先を選択">
   <div class="realtimeMapCard">
    <header><strong id="realtimeMapTitle">開戦前の隊列配置</strong>
     <span id="realtimeMapPlanningClock" hidden>作戦 残り30秒</span>
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
     <strong>② 隊の行動（兵符・物資の使用は軍師の指示）</strong>
     <small id="realtimeMapChosenAction" role="status">選択中：移動のみ</small><strong hidden></strong>
     <div class="realtimeMapActionButtons">
      <button type="button" data-action-after-move="defend">🛡 守備</button>
      <button type="button" data-action-after-move="charge">⚔ 攻撃</button>
      <button type="button" data-action-after-move="hold">◷ 待機</button>
      <button type="button" data-action-after-move="support">🎒 軍師から補充</button>
     </div>
     <div id="realtimeMapAttackChoices" class="realtimeAttackChoices" hidden role="group" aria-label="攻撃種別">
      <strong>攻撃種別</strong>
      <button type="button" data-attack-kind="near" data-attack-origin="map">近距離</button>
      <button type="button" data-attack-kind="far" data-attack-origin="map">遠距離</button>
      <button type="button" data-attack-kind="intercept" data-attack-origin="map">迎撃</button>
      <button type="button" data-attack-kind="delay" data-attack-origin="map">延期</button>
     </div>
     <button type="button" data-action-after-move="special">★ 固有作戦</button>
     <div id="realtimeMapSupportChoices" class="realtimeContextChoices" hidden role="group" aria-label="援軍の召集"></div>
     <div id="realtimeMapSpecialChoices" class="realtimeContextChoices" hidden role="group" aria-label="ジョブ固有作戦"></div>
     <button type="button" class="realtimeActionSkip" id="realtimeActionSkip">行動指定なし（移動のみ）</button>
    </div>
    <button type="button" id="realtimeStart">配置を確定して戦闘開始 ▶</button>
   </div>
  </div>`;
 doc.body.append(root);
 const $=id=>root.querySelector('#'+id);
 const canvas=$('realtimeBattleCanvas'),ctx=canvas.getContext('2d');
 const radarCanvas=$('realtimeRadarCanvas'),radarCtx=radarCanvas.getContext('2d');
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
  hideContextChoices();
  refreshOptions();renderActionSelection();onSelect(selectedId);
  if(focus)onFocus(selectedId);
  renderStatus();drawMap();drawRadar(true);return true;
 }
 function drawRadar(force=false){
  if(!started||!radarCtx||$('realtimeSquadRadar').hidden)return;
  const now=nowMs();if(!force&&now-lastRadarRenderAt<350)return;
  lastRadarRenderAt=now;
  const w=radarCanvas.width,h=radarCanvas.height,ctx=radarCtx;
  const own=squads(),enemies=getEnemies();
  radarPins=squadRadarPins(own,enemies,worldSize,currentRows);
  ctx.clearRect(0,0,w,h);
  const background=getMapBackground();
  if(background)try{ctx.drawImage(background,0,0,w,h);}catch{}
  ctx.fillStyle='rgba(7,27,45,.36)';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(194,222,239,.17)';ctx.lineWidth=1;
  for(let k=1;k<4;k++){
   ctx.beginPath();ctx.moveTo(k*w/4,0);ctx.lineTo(k*w/4,h);ctx.stroke();
   ctx.beginPath();ctx.moveTo(0,k*h/4);ctx.lineTo(w,k*h/4);ctx.stroke();
  }
  ctx.strokeStyle='rgba(232,239,229,.38)';ctx.lineWidth=1.4;
  ctx.strokeRect?.(.8,.8,w-1.6,h-1.6);
  for(const pin of radarPins){
   const x=pin.x*w,y=pin.y*h,focus=pin.team===0&&pin.id===String(selectedId);
   ctx.beginPath();ctx.arc(x,y,focus?10:8,0,Math.PI*2);
   ctx.fillStyle=pin.team===0?'#5aceff':'#ff7884';ctx.fill();
   ctx.strokeStyle=focus?'#ffea92':'#132c40';ctx.lineWidth=focus?3.2:1.6;ctx.stroke();
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 10px system-ui';
   ctx.fillStyle='#071625';ctx.fillText(String(pin.number),x,y);
  }
 }
 function actionDescription(id=String(selectedId||'')){
  const chosen=preferredActions.get(String(id));
  if(!chosen)return '移動のみ／行動未指定';
  if(String(chosen).startsWith('attack_')){
   const kind=String(chosen).slice(7);
   return '⚔ 攻撃：'+({near:'近距離',far:'遠距離',intercept:'迎撃',delay:'延期'}[kind]||kind);
  }
  return {defend:'🛡 守備',charge:'⚔ 攻撃',hold:'◷ 待機',
   support:'🎒 軍師補充',special_heal_ally:'✚ 回復支援',
   special_revive_ally:'✧ 蘇生支援'}[chosen]||'★ 固有作戦';
 }
 function renderStatus(){
  const own=getSelected();
  if(!own)return;
  const count=String(own.alive??0)+'/'+String(own.total??0);
  const hp=Math.round(Number(own.hp)||0)+'/'+Math.round(Number(own.maxHp)||0);
  const suffix=(currentRows.find(r=>r.team===0&&String(r.id)===String(selectedId))?.mode||'');
  const queued=arrivalActions.get(String(selectedId));
  const pending=!$('realtimeDockAttackChoices').hidden?'⚔ 攻撃種別を選択中':
   !$('realtimeDockGuardChoices').hidden?'🛡 僧侶の守備内容を選択中':null;
  $('realtimeSelectedState').textContent='軍師指示｜'+(pending||actionDescription())+
   '｜HP '+hp+' · '+count+'人'+(queued?' · 到着後予約':suffix==='move'?' · 移動中':'');
  $('realtimeSelectedState').title=$('realtimeSelectedState').textContent;
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
  for(const id of ['realtimeDockAttackChoices','realtimeMapAttackChoices','realtimeDockGuardChoices','realtimeDockRallyChoices','realtimeDockSupportChoices',
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
  const accepted=entry.itemId?onReinforce(id,entry.itemId):
   onSpecial(id,entry.special,entry.targetId);
  if(accepted?.openMove){openMap('move');return;}
  if(accepted){if(entry.special){preferredActions.set(id,'special_'+entry.special);renderActionSelection();}
   hideContextChoices();closeSquadControls();return;}
  $(origin==='map'?'realtimeMapMessage':'realtimeSelectedState').textContent=
   '実行できません。対象との距離、所持数、軍師、命令制限を確認してください。';
 }
 function showSupportChoices(origin){
  const node=actionPanel(origin,'Support'),items=getAvailableItems(String(selectedId))||[];
  if(!items.length){contextNote(node,'援軍の兵符を所持していません。');return;}
  contextNote(node,'プレイヤー＝軍師が兵符を使って予備兵を補充します。部隊はアイテムを使用しません。');
  for(const item of items)
   contextButton(node,'📯 '+String(item.label||item.id)+' ×'+(item.quantity||0),
    ()=>confirmContextAction(origin,{itemId:String(item.id)}));
 }
 function issueDockOrder(command){
  if(!started)return false;
  if(onOrder(selectedId,command)){
   preferredActions.set(String(selectedId),command);
   renderActionSelection();closeSquadControls();return true;
  }
  $('realtimeSelectedState').textContent='発令できません。軍師と命令制限を確認してください。';
  return false;
 }
 function showGuardChoices(){
  const node=actionPanel('dock','Guard');
  contextNote(node,'僧侶の守備：通常守備／負傷者を回復／戦闘不能者を蘇生（UR）');
  contextButton(node,'🛡 通常守備',()=>issueDockOrder('defend'));
  for(const action of battleJobSpecialActions(getSelected()?.job)
   .filter(entry=>entry.id==='heal_ally'||entry.id==='revive_ally')){
   const button=contextButton(node,action.label,()=>showSpecialTargets('dock',action));
   button.disabled=!(getSpecialTargets(String(selectedId),action.id)||[]).length;
  }
  renderActionSelection();
 }
 function showRallyChoices(){
  const node=actionPanel('dock','Rally'),info=getRallyInfo(String(selectedId));
  const limit=Math.min(3,Math.max(1,Number(info.maxTargets)||1));
  contextNote(node,'軍師Lv'+Math.max(1,Number(info.level)||1)+
   '：同時に最大'+limit+'隊へ強化号令（22秒）');
  const targets=(info.targets||[]).filter(t=>t.alive);
  const chosen=new Set([String(selectedId)].filter(id=>targets.some(t=>String(t.id)===id)));
  const buttons=[];
  for(const target of targets){
   const button=contextButton(node,'□ '+String(target.label||target.id),()=>{
    const id=String(target.id);
    if(chosen.has(id))chosen.delete(id);
    else if(chosen.size<limit)chosen.add(id);
    for(const [b,item] of buttons){
     const checked=chosen.has(String(item.id));
     b.textContent=(checked?'☑ ':'□ ')+String(item.label||item.id);
     b.setAttribute('aria-pressed',String(checked));
    }
   });
   buttons.push([button,target]);
  }
  for(const [button,target] of buttons){
   const selected=chosen.has(String(target.id));
   button.textContent=(selected?'☑ ':'□ ')+String(target.label||target.id);
   button.setAttribute('aria-pressed',String(selected));
  }
  for(const fx of COMMAND_RALLY_TYPES)
   contextButton(node,fx.name+'　22秒',()=>{
    if(!chosen.size){contextNote(node,'対象隊を選択してください');return;}
    if(onRally(String(selectedId),fx.id.replace('command_',''),[...chosen])){
     closeSquadControls();
    }else contextNote(node,'現在は号令できません。軍師または命令制限を確認してください。');
   });
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
  const attackOpen=!$('realtimeDockAttackChoices').hidden||!$('realtimeMapAttackChoices').hidden;
  const guardOpen=!$('realtimeDockGuardChoices').hidden;
  for(const [id,active] of [['realtimeCharge',String(chosen||'').startsWith('attack_')||attackOpen],
   ['realtimeDefend',chosen==='defend'||String(chosen||'').startsWith('special_heal_')||
     String(chosen||'').startsWith('special_revive_')||guardOpen],
   ['realtimeHold',chosen==='hold']]){
   const button=$(id);button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
  }
  $('realtimeMapChosenAction').textContent='現在の選択：'+
   (attackOpen&&!String(chosen||'').startsWith('attack_')?'⚔ 攻撃種別を選択中':actionDescription());
  renderStatus();
  for(const button of root.querySelectorAll('[data-action-after-move]')){
   const active=button.dataset.actionAfterMove===chosen||
    (button.dataset.actionAfterMove==='charge'&&(String(chosen||'').startsWith('attack_')||attackOpen))||
    (button.dataset.actionAfterMove==='defend'&&String(chosen||'').startsWith('special_'));
   button.classList.toggle('selected',active);
   button.setAttribute('aria-pressed',String(active));
  }
  $('realtimeActionSkip').classList.toggle('selected',!chosen);
  $('realtimeSpecial').disabled=!battleJobSpecialActions(getSelected()?.job).length;
  for(const button of root.querySelectorAll('[data-action-after-move="special"]'))
   button.disabled=!battleJobSpecialActions(getSelected()?.job).length;
  for(const button of root.querySelectorAll('[data-attack-kind="far"]'))
   button.textContent=String(getSelected()?.job||'').includes('忍者')?'手裏剣（遠距離）':'遠距離';
  for(const button of root.querySelectorAll('[data-attack-kind]')){
   const active=chosen==='attack_'+button.dataset.attackKind;
   button.classList.toggle('selected',active);
   button.setAttribute('aria-pressed',String(active));
   button.disabled=button.dataset.attackKind==='far'&&
    battleAttackCommand('far',getSelected()?.job)==null;
  }
 }
 function updatePlanningCountdown(){
  if(!planningDeadline)return;
  const remain=Math.max(0,Math.ceil((planningDeadline-nowMs())/1000));
  $('realtimePlanSeconds').textContent='作戦選択 残り'+remain+'秒';
  $('realtimeRadarClock').hidden=false;
  $('realtimeRadarClock').textContent='作戦 '+remain+'秒';
  $('realtimeMapPlanningClock').textContent='残り'+remain+'秒';
  if(remain===0){
   // Do not silently overwrite a team's existing order when the time expires.
   if(!$('realtimeBattleMapOverlay').hidden)closeMap();
   closeSquadControls();
  }
 }
 function enterPlanning(){
  if(!started)return;
  if(!getPaused()){
   onPause();planningOwnsPause=Boolean(getPaused());
  }
  // Never start a countdown while simulation is still advancing.
  if(!getPaused())return;
  if(!planningDeadline){
   planningDeadline=nowMs()+PLAN_LIMIT_MS;
   planningTicker=globalThis.setInterval?.(updatePlanningCountdown,200)??null;
  }
  updatePlanningCountdown();
 }
 function exitPlanning(){
  planningDeadline=0;
  if(planningTicker!=null)globalThis.clearInterval?.(planningTicker);
  planningTicker=null;
  $('realtimeRadarClock').hidden=true;
  if(!planningOwnsPause)return;
  planningOwnsPause=false;
  if(getPaused())onPause();
 }
 function showSquadControls(id){
  if(!started)return false;
  if(!setSelected(id))return false;
  enterPlanning();
  $('realtimeBattleDock').hidden=false;
  updatePlanningCountdown();
  drawRadar(true);
  return true;
 }
 function closeSquadControls(){
  $('realtimeBattleDock').hidden=true;
  hideContextChoices();
  if($('realtimeBattleMapOverlay').hidden)exitPlanning();
 }
 function hideActionSheet(){
  choosingActionFor=null;actionDestination=null;
  hideContextChoices();renderActionSelection();
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
  $('realtimeMapPlanningClock').hidden=next==='deploy';
  $('realtimeMapHelp').textContent=next==='deploy'?
   '◀ ▶で隊を切替え、隊長の番号ピンを目印に味方陣地へ配置。敵隊は開戦後に表示します。':
   '◀ ▶で移動する味方隊を選び、地図をタップ。戦闘はリアルタイムで進みます。';
  $('realtimeMapMessage').textContent='';
  $('realtimeMapActionSheet').querySelector('[data-action-after-move="support"]').hidden=next==='deploy';
  $('realtimeMapActionSheet').querySelector('[data-action-after-move="special"]').hidden=next==='deploy';
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
    battleAttackCommand(preferred.slice(7),squad.job):preferred;
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
 function activateRadarPin(px,py){
  const pin=radarHitPin(radarPins,px,py);
  if(!pin)return;
  if(pin.team===0)showSquadControls(pin.id);
  else onEnemySelect(pin.id);
 }
 radarCanvas.addEventListener('click',event=>{
  if(!started)return;
  const rect=radarCanvas.getBoundingClientRect();
  if(rect.width>0&&rect.height>0)
   activateRadarPin((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);
 });
 radarCanvas.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  const pin=radarPins.find(p=>p.team===0&&p.id===String(selectedId))||
   radarPins.find(p=>p.team===0);
  if(pin)showSquadControls(pin.id);
 });
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
   if(chosen==='support'){showSupportChoices('map');return;}
   if(chosen==='special'){showSpecialChoices('map');return;}
   if(chosen==='charge'){
    hideContextChoices();$('realtimeMapAttackChoices').hidden=false;
    renderActionSelection();
    $('realtimeMapMessage').textContent='⚔ 攻撃を選択中。近距離・遠距離・迎撃・延期から選んでください。';
    return;
   }
   $('realtimeMapAttackChoices').hidden=true;
   const command=chosen;
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
    $(status).textContent='このジョブに遠距離攻撃はありません。';
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
 $('realtimeCharge').onclick=()=>{hideContextChoices();$('realtimeDockAttackChoices').hidden=false;renderActionSelection();};
 $('realtimeSupport').onclick=()=>showSupportChoices('dock');
 $('realtimeRally').onclick=()=>showRallyChoices();
 $('realtimeSpecial').onclick=()=>showSpecialChoices('dock');
 $('realtimeDefend').onclick=()=>{
  if(String(getSelected()?.job||'').includes('僧侶'))showGuardChoices();
  else issueDockOrder('defend');
 };
 $('realtimeHold').onclick=()=>issueDockOrder('hold');
 $('realtimeStart').onclick=()=>{
  if(started)return;
  started=true;mode='live';hideActionSheet();$('realtimeBattleMapOverlay').hidden=true;
  $('realtimeBattleDock').hidden=true;$('realtimeSquadRadar').hidden=false;
  onStart();renderStatus();drawRadar(true);
 };
 $('realtimeRoster')?.addEventListener('click',()=>onRoster());
 $('realtimeMenu').onclick=()=>{closeSquadControls();onMenu();};
 // Pause is controlled by entering/leaving the squad planning dock.
 return {
  openDeployment(){started=false;mode='deploy';exitPlanning();planningOwnsPause=false;
   $('realtimeSquadRadar').hidden=true;deploymentActions.clear();arrivalActions.clear();preferredActions.clear();invalidateSquadSnapshot();$('realtimeBattleDock').hidden=true;openMap('deploy');},
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
     // Arrival executes the action already authorized with this movement order.
     const accepted=entry.itemId?onUseItem(id,entry.itemId,true):
      entry.special?onSpecial(id,entry.special,entry.targetId,true):
      onOrder(id,entry.command,true);
     if(accepted)arrivalActions.delete(id);
    }
   }
   renderStatus();
   if(started)drawRadar();
   if(planningDeadline)updatePlanningCountdown();
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
  get planningSeconds(){return planningDeadline?Math.max(0,Math.ceil((planningDeadline-nowMs())/1000)):null;},
  get radarPins(){return [...radarPins];},
  root,dispose(){exitPlanning();root.remove();}
 };
}
