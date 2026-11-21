/**
 * Real-time battle control surface.
 * One prebattle positioning pass; live orders select an action and its target.
 * Movement is implicit in the selected action, not a standalone command.
 */
import {setBattleJobPortrait} from './battle-job-portraits.js';
import {mountBattleCommandWizard} from './battle-command-wizard.js?v=20261120-orderqueue2';
import {createBattleTapChoices} from './battle-tap-choices.js?v=20261119-mobile-choice1';
import {eligibleEnemyBattleTargets,battleAttackNeedsEnemy} from './battle-target-japanese-flow.js?v=20261120-skillfirst1';
import {visibleBattleSquadPins} from './battle-squad-leader-pins.js';
import {battleAttackCommand} from './battle-attack-choices.js';
import {renderFormationSignaturePreview,signatureStrategyFor} from './formation-signature-strategies.js';
import {formationUnlockLabels,ADVANCED_FORMATION_TACTICS} from './formation-strategy-unlocks.js';
import {BASIC_OPENING_TACTICS} from './prebattle-opening-tactics.js';
import {battleJobSpecialActions} from './battle-job-special-actions.js?v=20261120-specialjob-confirm4';
import {COMMAND_RALLY_TYPES} from './battle-command-doctrine.js';
import {squadRadarPins,radarHitPin} from './battle-center-radar.js?v=20261122-contact-frontline2';
import {findBattleMapPin,formatBattleMapPercent} from './battle-map-inspection.js';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const PREBATTLE_FORMATION_IDS=Object.freeze({
 '前進陣形':'attack','標準陣形':'balanced','後衛陣形':'support','防壁陣形':'wall',
 '槍衾陣形':'spear','弓月陣形':'arrow','楔形陣形':'wedge','包囲陣形':'pincer',
 '円環陣形':'circle','伏兵陣形':'ambush','十字陣形':'cross','鉄壁陣形':'fortress',
 '龍牙陣形':'dragon','星鐘陣形':'constellation','自由陣形':'free'
});
const formationPreviewId=plan=>String(plan?.formationId||
 PREBATTLE_FORMATION_IDS[plan?.formation]||plan?.formation||'balanced');
const PREBATTLE_TACTIC_NAMES=Object.freeze({
 assault:'殲滅',defense:'守備',balanced:'バランス',explore:'探索',
 ...ADVANCED_FORMATION_TACTICS
});
const escapePrebattle=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
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
 getDeploymentTeams=null,getInitialTeamPlan=()=>({strategy:'assault'}),getRadarEnemies=null,
 getMapBuildings=()=>[],
 battleTypeLabel='戦闘',victoryCondition='敵を撃破',requirePrebattleChoices=false,
 getRadarSquads=null,getRadarGroup=null,onRadarTeamCommand=null,
 getLegalPoint=(x,z)=>({x,z}),canDeploy=()=>true,previewDeploy=()=>true,
 onDeploy=()=>false,onStart=()=>{},onPrebattleMusic=()=>false,onMove=()=>false,onOrder=()=>false,
  onTargetOrder=()=>false,
 onSelect=()=>{},onFocus=()=>{},onEnemySelect=()=>{},onRoster=()=>{},onMenu=()=>{},onManageItems=()=>{},
 onPause=()=>{},getPaused=()=>false,
 getSpecialTargets=()=>[],onSpecial=()=>false,getAvailableItems=()=>[],onUseItem=()=>false,
 getMoveTargets=()=>[],getSharedItems=()=>[],onSharedItem=()=>false,
 getObjectiveCheckpoints=()=>[],getVictoryObjective=()=>null,getSquadDetails=()=>null,onCommandCommitted=()=>{},getOrderState=()=>({cooldown:0}),
 onReinforce=()=>false,getRallyInfo=()=>({level:1,maxTargets:1,targets:[]}),
 onRally=()=>false,getFormationOptions=()=>[],onFormationChange=()=>false,onMapOverview=()=>false
}={}){
 const doc=documentRef;
 if(!doc?.body?.append)throw Error('Real-time battle requires document.body');
 let started=false,mode='deploy',selectedId=null,zoom=1,centerX=worldSize/2,centerZ=worldSize/2;
 let dockTab='strategy',pendingStrategy=null,pendingRally=null;
 let targetZoom=1,targetCenterX=worldSize/2,targetCenterZ=worldSize/2,targetPoint=null;
 let lastInlineItemRefresh=-Infinity,lastInlineItemSignature='';
 const deploymentActions=new Map(),arrivalActions=new Map(),preferredActions=new Map();
 const initialTeamPlans=new Map(),placedTeams=new Set();
 let deployStep='placement';
 const prebattleStrategyPageByGroup=new Map();
 let choosingActionFor=null,actionDestination=null,planningOwnsPause=false;
 let planningDeadline=0,planningTicker=null,lastRadarRenderAt=-Infinity,radarPins=[];
 let inspectedMapPin=null,mapInspectionPins=[],inspectedBuilding=null,mapInspectionBuildings=[],lastInspectionRefreshAt=-Infinity;
  let deploymentTiles=[];
 const root=doc.createElement('section');root.id='battleRealtimeControls';
 root.innerHTML=`
  <div id="realtimeSquadRadar" hidden role="group" aria-label="中央部隊レーダー">
   <div class="realtimeRadarHeader"><strong id="realtimeRadarTitle">◎ 部隊レーダー｜${String(battleTypeLabel)}</strong>
    <button type="button" id="realtimeRadarExpand" aria-label="レーダーを拡大して初期配置">⛶ 拡大</button>
    <span id="realtimeRadarClock" hidden aria-label="作戦選択の残り時間"></span></div>
   <canvas id="realtimeRadarCanvas" width="224" height="178"
    aria-label="味方と敵の隊長位置。青が味方、赤が敵。番号は隊番号" tabindex="0"></canvas>
   <div class="realtimeRadarLegend">●味方 <span>●敵</span>　数字＝隊</div>
   <div id="realtimeRadarSetupPrompt" hidden role="status">レーダーを拡大して3隊の配置と作戦を設定</div>
  </div>
  <div id="realtimeBattleDock" hidden role="group" aria-label="選択中の隊の作戦">
   <button type="button" id="realtimeDockClose" aria-label="作戦を閉じて戦闘に戻る">✕ 戻る</button>
   <span id="realtimePlanSeconds" aria-live="off">作戦選択中（時間制限なし）</span>
   <div class="realtimeDockSquadPager" role="group" aria-label="作戦を選ぶ隊をページ切替">
    <button type="button" id="realtimeDockPrev" aria-label="前の隊">◀</button>
    <span class="realtimeDockPortrait" id="realtimeDockPortrait" aria-hidden="true"></span>
    <strong id="realtimeDockSquadName">味方隊</strong>
    <button type="button" id="realtimeDockNext" aria-label="次の隊">▶</button>
    <small id="realtimeDockPage">1/10</small>
   </div>
   <span id="realtimeSelectedState" role="status">軍師：部隊を選択</span>
   <div id="realtimeCommandTabs" role="tablist" aria-label="軍師の指示を選ぶ">
    <button type="button" id="realtimeTabStrategy" role="tab" aria-selected="true">⚔ 作戦</button>
    <button type="button" id="realtimeTabRally" role="tab" aria-selected="false">📣 強化号令</button>
    <button type="button" id="realtimeTabFormation" role="tab" aria-selected="false">📐 陣形変更</button>
    <button type="button" id="realtimeTabItems" role="tab" aria-selected="false">🎒 アイテム</button>
   </div>

   <span id="realtimeSkillStep" role="status">① 作戦・スキルを選択してください</span>
   <button type="button" id="realtimeDefend">🛡 守備</button>
   <button type="button" id="realtimeCharge">⚔ 攻撃</button>
   <button type="button" id="realtimeHold">◷ 待機</button>
   <button type="button" id="realtimeSupport" hidden>🎒 兵符で補充</button>
   <button type="button" id="realtimeManageItems" hidden>🎁 全軍の共有アイテムを使う</button>
   <button type="button" id="realtimeRally" hidden>📣 バフの種類と対象を選択</button>
   <button type="button" id="realtimeSpecial">★ 固有作戦</button>
   <button type="button" id="realtimeThiefUnlock" title="シーフ固有：鍵開け・盗む" hidden>🔓 鍵開け</button>
   <button type="button" id="realtimeThiefSteal" hidden>🎒 盗む</button>
   <button type="button" id="realtimeMenu" aria-label="ゲームメニュー">☰</button>
   <div id="realtimeStrategyTargets" hidden role="group" aria-label="選択した攻撃スキルで指定できる敵隊">
    <strong id="realtimeTargetStep">② 攻撃対象の敵隊を選択</strong>
    <select id="realtimeTargetKind" hidden aria-hidden="true">
     <option value="enemies">敵部隊</option>
    </select>
    <select id="realtimeTargetChoice" hidden aria-label="攻撃できる敵隊を選択"></select>
    <div id="realtimeInlineMapArea" hidden>
     <canvas id="realtimeInlineTargetMap" width="280" height="160" aria-label="作戦対象の地点を地図上で選択"></canvas>
     <div class="realtimeInlineZoom">
      <button type="button" id="realtimeInlineZoomIn">＋</button>
      <button type="button" id="realtimeInlineZoomOut">－</button>
     </div>
    </div>
    <small id="realtimeTargetMessage" role="status">攻撃方法を選んでから、対象の敵隊を指定してください。</small>
   </div>
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
   <button type="button" id="realtimeConfirmStrategy" class="realtimeMainConfirm">✅ 作戦を確定</button>
   <div id="realtimeRallyInline" hidden role="group" aria-label="軍師の号令（バフ）">
    <label for="realtimeRallyTarget">バフをかける隊</label>
    <select id="realtimeRallyTarget"></select>
    <label for="realtimeRallyKind">号令の種類</label>
    <select id="realtimeRallyKind"></select>
    <small id="realtimeInlineRallyStatus" role="status"></small>
    <button type="button" id="realtimeConfirmRally" class="realtimeMainConfirm">✅ 号令を確定</button>
   </div>
   <div id="realtimeFormationInline" hidden role="group" aria-label="陣形変更の号令">
    <strong>📐 陣形変更：生存兵の職業・レアリティ・人数で判定</strong>
    <div id="realtimeFormationChoices" role="group" aria-label="変更できる陣形一覧"></div>
    <small id="realtimeFormationStatus" role="status">陣形を選ぶと、その配置へ隊ごとに移動します。</small>
   </div>
   <div id="realtimeItemInline" hidden role="group" aria-label="全軍の共有アイテム">
    <label for="realtimeSharedItemChoice">共有所持品・取得アイテム</label>
    <select id="realtimeSharedItemChoice" aria-label="共有アイテムと現在数を選ぶ"></select>
    <label for="realtimeSharedItemTarget">使用先の味方隊</label>
    <select id="realtimeSharedItemTarget"></select>
    <small id="realtimeInlineItemStatus" role="status">戦闘中に拾ったアイテムもここに加算されます。</small>
    <button type="button" id="realtimeConfirmItem" class="realtimeMainConfirm">✅ アイテム使用を確定</button>
   </div>
  </div>
  <div id="realtimeBattleMapOverlay" hidden role="dialog" aria-modal="true" aria-label="レーダー拡大・初期配置と作戦">
   <div class="realtimeMapCard">
    <header><strong id="realtimeMapTitle">部隊レーダー・拡大</strong>
     <small id="realtimeMapBattleType">${String(battleTypeLabel)}｜${String(victoryCondition)}</small>
     <span id="realtimeMapPlanningClock" hidden>作戦選択中</span>
     <button type="button" id="realtimeMapClose" hidden>✕ 戻る</button></header>
    <div class="realtimeMapHelp" id="realtimeMapHelp">味方の隊を選び、味方陣地の地図をタップして配置してください。</div>
    <div class="realtimeDeploymentLegend" id="realtimeDeploymentLegend" role="status">
     <span>🟩 水色のマス：配置可能</span><span>🟥 赤いマス：配置不可</span>
     <button type="button" id="realtimePrebattleMusic">♪ 配置中のBGMを再生</button>
    </div>
    <div class="realtimeMapSquadPager" id="realtimeMapSquadPager" role="group" aria-label="配置する味方隊をページ切替">
     <button type="button" id="realtimeMapPrev" aria-label="前の味方隊">◀</button>
     <span class="realtimeMapPortrait" id="realtimeMapPortrait" aria-hidden="true"></span><strong id="realtimeMapSquadName" aria-live="polite">味方隊</strong>
     <button type="button" id="realtimeMapNext" aria-label="次の味方隊">▶</button>
     <span id="realtimeMapPage" aria-label="選択中の隊番号">1/1</span>
    </div>
    <div class="realtimeMapViewport" id="realtimeMapViewport">
     <div class="realtimeMapZoom" aria-label="地図の拡大縮小">
      <button type="button" data-realtime-zoom="1" aria-label="地図を拡大">＋ 拡大</button>
      <button type="button" data-realtime-zoom="-1" aria-label="地図を縮小">－ 縮小</button>
      <button type="button" id="realtimeMapReset">全域</button>
      <span id="realtimeMapScale">100%</span>
     </div>
     <canvas id="realtimeBattleCanvas" width="464" height="464"
      aria-label="味方隊を選択して初期配置する地図" tabindex="0"></canvas>
    </div>
    <section id="realtimeMapDetail" class="realtimeMapDetail" hidden aria-label="選択した隊の詳しい状態"></section>
    <div class="realtimeMapMessage" id="realtimeMapMessage" role="status"></div>
    <div id="realtimeInitialTeamPlanning" role="group" aria-label="隊ごとの初期作戦">
     <label for="realtimeInitialStrategy" id="realtimeInitialStrategyLabel">② この隊の初期作戦</label>
     <select id="realtimeInitialStrategy" hidden tabindex="-1" aria-hidden="true" aria-label="開戦時の隊連携作戦">
      <option value="">作戦を選択してください</option>
      <option value="assault">⚔ 相手殲滅・攻撃重視</option>
      <option value="defense">🛡 守備・陣形維持</option>
      <option value="balanced">⚖ バランス・攻防連携</option>
      <option value="explore">🔎 探索・目的遂行</option>
     </select>
     <div id="realtimeInitialStrategyChoices" class="realtimeInitialStrategyChoices" role="group" aria-label="利用できる初期作戦"></div>
     <div id="realtimeInitialStrategyPager" class="realtimeInitialStrategyPager" hidden>
      <button type="button" data-prebattle-strategy-page="-1" aria-label="前の作戦一覧">◀</button>
      <small id="realtimeInitialStrategyPageInfo" aria-live="polite">1 / 1</small>
      <button type="button" data-prebattle-strategy-page="1" aria-label="次の作戦一覧">▶</button>
     </div>
     <div id="realtimeInitialFormationPreview" class="realtimeInitialFormationPreview" aria-label="宿屋で選んだ陣形のアニメーション"></div>
     <small id="realtimeInitialFormationStatus" role="status"></small>
    </div>
    <div class="realtimeMapActionSheet" id="realtimeMapActionSheet" role="group" aria-label="初期配置時の行動を選択">
     <strong>② 隊の行動（兵符・物資の使用は軍師の指示）</strong>
     <small id="realtimeMapChosenAction" role="status">選択中：移動のみ</small>
     <div class="realtimeMapActionButtons">
      <button type="button" data-action-after-move="defend">🛡 守備</button>
      <button type="button" data-action-after-move="charge">⚔ 攻撃</button>
      <button type="button" data-action-after-move="hold">◷ 待機</button>
     </div>
     <div id="realtimeMapItemCategory" class="realtimeMapItemCategory" role="group" aria-label="軍師のアイテム">
      <strong>🎒 アイテム（軍師が使用）</strong>
      <button type="button" data-action-after-move="support">兵符で援軍を補充</button>
       <button type="button" id="realtimeMapManageItems">全軍共有アイテムを使用</button>
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
     <button type="button" class="realtimeActionSkip" id="realtimeActionSkip">追加行動を指定しない</button>
    </div>
    <button type="button" id="realtimeStart">3隊の配置と作戦を確定して開戦 ▶</button>
   </div>
  </div>`;
 doc.body.append(root);
 const missionNotice=doc.createElement('div');
 missionNotice.id='battleMissionNotice';missionNotice.setAttribute('role','status');
 missionNotice.setAttribute('aria-live','polite');
 missionNotice.textContent='⚑ '+String(battleTypeLabel)+'｜勝利条件：'+String(victoryCondition);
 root.append(missionNotice);
 const orderNotice=doc.createElement('div');orderNotice.id='battleActiveOrderNotice';
 orderNotice.setAttribute('role','status');orderNotice.textContent='📋 部隊作戦：選択待ち';
 root.append(orderNotice);
 let lastOrderSignature='';
 function refreshOrderNotice(){
  if(!started||!selectedId){orderNotice.hidden=true;return;}
  orderNotice.hidden=false;
  const live=getOrderState(String(selectedId))||{};
  const index=squads().findIndex(s=>String(s.id)===String(selectedId));
  const num=index>=0?index+1:'-';
  const pending=commandWizard.queuedOrder(String(selectedId));
  const failure=commandWizard.queuedError(String(selectedId));
  const cooldown=Math.max(0,Number(live.cooldown)||0);
  const status=failure?'⚠ '+failure:
   '第'+num+'隊｜'+String(live.label||'自動行動')+
   (pending?'｜📋 次：'+pending+(cooldown?'（'+Math.ceil(cooldown)+'秒後）':'（発令準備）'):
    cooldown?'｜命令間隔 '+Math.ceil(cooldown)+'秒':'｜次の命令可能');
  if(lastOrderSignature!==status){orderNotice.textContent=status;lastOrderSignature=status;}
 }
 let lastMissionSignature='',lastMissionUpdateAt=-Infinity;
 function refreshMissionNotice(){
  const now=nowMs();if(now-lastMissionUpdateAt<700)return;lastMissionUpdateAt=now;
  let checkpoints=[];
  try{checkpoints=getObjectiveCheckpoints()||[];}catch{}
  const latest=checkpoints.slice(-4),last=latest.at(-1);
  const completed=checkpoints.filter(p=>p.status==='達成'||p.status==='地点到着').length;
  const initialSummary=[...initialTeamPlans].map(([group,strategy])=>
   '第'+group+'隊 '+({assault:'殲滅',defense:'守備',balanced:'バランス',explore:'探索'}[strategy]||strategy)).join('／');
  const goal=getVictoryObjective();
  const captureMessage=goal?.kind==='capture'?
   '🏁 陣地制圧｜敵本陣 X'+goal.x+' / Z'+goal.z+
   '｜制圧 '+goal.progress+'%（'+goal.holdSeconds+'秒確保）'+
   '｜範囲内：味方'+goal.allies+'人・敵'+goal.enemies+'人':null;
  const message=captureMessage||'⚑ '+String(battleTypeLabel)+'｜'+(!last?(initialSummary?'勝利条件：'+String(victoryCondition)+'｜初期作戦：'+initialSummary:'勝利条件：'+String(victoryCondition)):
   (last.status==='達成'||last.status==='地点到着'?'✅ 目的達成：':
    last.status==='失敗'?'⚠ 作戦失敗：':'🎯 進行中：')+
    '第'+String(last.groupId||1)+'班 '+String(last.label||'目標')+
    '（'+Math.round(Number(last.progress)||0)+'%）｜達成 '+completed+'/'+checkpoints.length);
  if(lastMissionSignature!==message){missionNotice.textContent=message;lastMissionSignature=message;}
  missionNotice.hidden=!started;
 }
 const tapChoices=createBattleTapChoices(root,{pageSize:5});
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
   const planned=!started&&mode==='deploy'&&typeof getDeploymentTeams==='function'?getDeploymentTeams():null;
   const source=Array.isArray(planned)?planned:getSquads();
   squadSnapshot=(source||[]).filter(x=>x&&x.id!=null);
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
 /** Only one operation per prebattle page: actual placement OR initial order. */
 function syncPrebattleScreen(){
  if(started||mode!=='deploy')return;
  const row=getSelected(),key=String(row?.groupId??row?.id??'1');
  const placing=deployStep==='placement';
  $('realtimeMapViewport').hidden=!placing;
  $('realtimeDeploymentLegend').hidden=!placing;
  $('realtimeInitialTeamPlanning').hidden=placing;
  $('realtimeMapActionSheet').hidden=true;
  $('realtimeStart').hidden=false;
  $('realtimeMapTitle').textContent=placing?'① 第'+key+'隊の初期配置（推奨配置済み）':'② 第'+key+'隊の初期作戦';
  $('realtimeMapHelp').textContent=placing?
   '水色の配置可能マスをタップすると隊が移動します。推奨初期位置のままでも「次へ」で進めます。':
   '配置済みの第'+key+'隊について、使用できる初期作戦を1つ選んでください。';
  $('realtimeStart').textContent=placing?'配置を確定して作戦選択 ▶':
   '作戦を保存して次の隊へ ▶';
  if(!placing&&placedTeams.has(key)&&initialTeamPlans.get(key)){
   const own=squads(),allReady=own.every(team=>{
    const id=String(team.groupId??team.id);
    return placedTeams.has(id)&&Boolean(initialTeamPlans.get(id));
   });
   if(allReady)$('realtimeStart').textContent='3隊の配置と作戦を確定して開戦 ▶';
  }
  $('realtimeMapPortrait').setAttribute('aria-label','第'+key+'隊のリーダー');
 }
 function refreshOptions(){
  const own=squads();
  if(!own.length)return;
  if(!own.some(s=>String(s.id)===String(selectedId)))selectedId=String(own[0].id);
  const index=own.findIndex(s=>String(s.id)===String(selectedId));
  $('realtimeMapSquadName').textContent=String(own[index]?.label||'第'+(index+1)+'隊');
  if(!started&&mode==='deploy'){
   const row=own[index],key=String(row?.groupId??row?.id);
   const defaults=getInitialTeamPlan(row)||{};
   const allowed=Array.isArray(defaults.allowedStrategies)&&defaults.allowedStrategies.length?defaults.allowedStrategies:['assault','defense','balanced','explore'];
   const chooser=$('realtimeInitialStrategy');
   // The Android native picker is populated from the team's *actual* live
   // capabilities; selecting an additional tactic now issues that tactic.
   const basic=Object.keys(BASIC_OPENING_TACTICS).filter(id=>allowed.includes(id));
   const advanced=Object.keys(ADVANCED_FORMATION_TACTICS).filter(id=>allowed.includes(id));
   chooser.innerHTML='<option value="">作戦を選択してください</option>'+
    '<optgroup label="基本作戦">'+basic.map(id=>
      '<option value="'+id+'">'+escapePrebattle(BASIC_OPENING_TACTICS[id])+'</option>').join('')+'</optgroup>'+
    (advanced.length?'<optgroup label="陣形・ジョブの追加作戦">'+advanced.map(id=>
      '<option value="'+id+'">★ '+escapePrebattle(ADVANCED_FORMATION_TACTICS[id])+'</option>').join('')+'</optgroup>':'');
   let strategy=initialTeamPlans.get(key);
   if(!allowed.includes(strategy)){
    strategy=requirePrebattleChoices?'':allowed.includes(defaults.strategy)?defaults.strategy:allowed[0];
    if(strategy)initialTeamPlans.set(key,strategy);
   }
   chooser.value=strategy||'';chooser.disabled=false;
   // Android's native select menu expands over the entire modal and can
   // ignore taps at large text scale. Keep it as a hidden state bridge and
   // render fixed-size, accessible touch buttons instead.
   const options=[...basic,...advanced],perPage=6;
   const totalPages=Math.max(1,Math.ceil(options.length/perPage));
   const selectedPage=Math.max(0,Math.floor(options.indexOf(strategy)/perPage));
   const page=Math.max(0,Math.min(totalPages-1,
    prebattleStrategyPageByGroup.get(key)??selectedPage));
   prebattleStrategyPageByGroup.set(key,page);
   const pageItems=options.slice(page*perPage,page*perPage+perPage);
   const choices=$('realtimeInitialStrategyChoices');
   const signature=key+'|'+options.join(',')+'|'+page;
   if(choices.dataset.signature!==signature){
    choices.replaceChildren();
    for(const id of pageItems){
     const b=doc.createElement('button');
     b.type='button';b.dataset.prebattleStrategy=id;
     b.textContent=(advanced.includes(id)?'★ ':'')+
      String(PREBATTLE_TACTIC_NAMES[id]||BASIC_OPENING_TACTICS[id]||ADVANCED_FORMATION_TACTICS[id]||id);
     choices.append(b);
    }
    choices.dataset.signature=signature;
   }
   for(const b of choices.querySelectorAll('[data-prebattle-strategy]')){
    const chosen=b.dataset.prebattleStrategy===strategy;
    b.classList.toggle('selected',chosen);
    b.setAttribute('aria-pressed',String(chosen));
   }
   const pager=$('realtimeInitialStrategyPager');
   pager.hidden=totalPages<=1;
   $('realtimeInitialStrategyPageInfo').textContent=(page+1)+' / '+totalPages;
   pager.querySelector('[data-prebattle-strategy-page="-1"]').disabled=page===0;
   pager.querySelector('[data-prebattle-strategy-page="1"]').disabled=page>=totalPages-1;
   $('realtimeInitialStrategyLabel').textContent='② 第'+key+'隊の初期作戦';
   const formationId=formationPreviewId(defaults),formationRule=signatureStrategyFor(formationId);
   const preview=$('realtimeInitialFormationPreview'),active=defaults.formationActive!==false;
   const previewKey=key+'|'+formationId+'|'+active;
   if(preview.dataset.previewKey!==previewKey){
    const name=escapePrebattle(defaults.formation||'標準陣形');
    const unlocked=advanced.map(id=>ADVANCED_FORMATION_TACTICS[id]);
    preview.innerHTML='<strong>第'+escapePrebattle(key)+'隊｜'+name+
     (formationRule?'｜★ '+escapePrebattle(formationRule.name):'')+'</strong>'+
     (renderFormationSignaturePreview(formationId)||
      '<small>この陣形は専用の動作アニメーションがありません。</small>')+
     '<small>現在の編成で実行できる追加作戦：'+escapePrebattle(unlocked.join('・')||'なし')+'</small>';
    preview.dataset.previewKey=previewKey;
   }
   $('realtimeInitialFormationStatus').textContent=
    (requirePrebattleChoices?(placedTeams.has(key)?'✅ 配置済み｜':'📍 配置先を選択｜')+
    (strategy?'✅ 作戦：'+(PREBATTLE_TACTIC_NAMES[strategy]||strategy)+'｜':'⚠ 作戦未選択｜'):'')+
    '陣形：'+String(defaults.formation||'標準')+
    (defaults.formationActive===false?'（未成立：基本作戦のみ使用可能）':'（戦闘中も維持）')+
    (defaults.reason?'｜'+String(defaults.reason):'')+
    '｜選べる作戦：'+allowed.map(id=>PREBATTLE_TACTIC_NAMES[id]||id).join('・')+
    (strategy?'':'｜有効な作戦がありません');
  }
  const captain=getInitialTeamPlan(own[index])?.captain||null;
  const portraitJob=captain?.job||own[index]?.job,portraitId=captain?.id||own[index]?.id;
  const face=$('realtimeMapPortrait'),faceKey=String(portraitJob)+'|'+String(portraitId);
  if(face.dataset.signature!==faceKey){setBattleJobPortrait(face,portraitJob,portraitId,0);face.dataset.signature=faceKey;}
  $('realtimeMapPage').textContent=(index+1)+'/'+own.length;
  $('realtimeMapPrev').disabled=index<=0;
  $('realtimeMapNext').disabled=index>=own.length-1;
  $('realtimeDockPrev').disabled=index<=0;
  $('realtimeDockNext').disabled=index>=own.length-1;
  $('realtimeDockSquadName').textContent=String(own[index]?.label||'第'+(index+1)+'隊');
  $('realtimeDockPage').textContent=(index+1)+'/'+own.length;
  const dockFace=$('realtimeDockPortrait');
  if(dockFace.dataset.signature!==faceKey){
   setBattleJobPortrait(dockFace,portraitJob,portraitId,0);
   dockFace.dataset.signature=faceKey;
  }
  syncPrebattleScreen();
 }
 function getSelected(){return squads().find(s=>String(s.id)===String(selectedId))||null;}
 function setSelected(id,{focus=false}={}){
  if(!squads().some(s=>String(s.id)===String(id)))return false;
  if(choosingActionFor!=null&&String(id)!==String(choosingActionFor))hideActionSheet();
  selectedId=String(id);pendingStrategy=null;pendingRally=null;targetPoint=null;
  hideContextChoices();
  refreshOptions();renderActionSelection();
  onSelect(selectedId);
  if(started&&!$('realtimeBattleDock').hidden){
   if(dockTab==='strategy')refreshMoveTargetChoices();
   if(dockTab==='rally')showRallyChoices();
   if(dockTab==='formation')showFormationChoices();
   if(dockTab==='items')refreshInlineItems(true);
  }
  if(focus)onFocus(selectedId);
  renderStatus();drawMap();drawRadar(true);return true;
 }
 function drawRadar(force=false){
  if(!radarCtx||$('realtimeSquadRadar').hidden)return;
  const now=nowMs();if(!force&&now-lastRadarRenderAt<350)return;
  lastRadarRenderAt=now;
  const w=radarCanvas.width,h=radarCanvas.height,ctx=radarCtx;
  const own=squads(),plannedEnemies=typeof getRadarEnemies==='function'?getRadarEnemies():null;
  const enemies=Array.isArray(plannedEnemies)?plannedEnemies:getEnemies();
  const visibleAllies=typeof getRadarSquads==='function'?getRadarSquads(own):own;
  radarPins=squadRadarPins(visibleAllies,enemies,worldSize,currentRows);
  if(typeof getRadarSquads==='function'){
   const byId=new Map(visibleAllies.map(row=>[String(row.id),row]));
   for(const pin of radarPins)if(pin.team===0){
    const group=Number(byId.get(String(pin.id))?.groupId);
    if(Number.isInteger(group)&&group>=1&&group<=3){
     pin.number=group;pin.groupId=group;
    }
   }
  }
  ctx.clearRect(0,0,w,h);
  const background=getMapBackground();
  if(background)try{
   ctx.save?.();ctx.globalAlpha=started?.37:.72;ctx.drawImage(background,0,0,w,h);ctx.restore?.();ctx.globalAlpha=1;
  }catch{}
  ctx.fillStyle=started?'rgba(7,27,45,.04)':'rgba(7,27,45,.13)';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(194,222,239,.17)';ctx.lineWidth=1;
  for(let k=1;k<4;k++){
   ctx.beginPath();ctx.moveTo(k*w/4,0);ctx.lineTo(k*w/4,h);ctx.stroke();
   ctx.beginPath();ctx.moveTo(0,k*h/4);ctx.lineTo(w,k*h/4);ctx.stroke();
  }
  ctx.strokeStyle='rgba(232,239,229,.38)';ctx.lineWidth=1.4;
  ctx.strokeRect?.(.8,.8,w-1.6,h-1.6);
  const victory=getVictoryObjective();
  if(victory?.kind==='capture'){
   const gx=victory.x/worldSize*w,gy=victory.z/worldSize*h;
   ctx.strokeStyle='#ffe68c';ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(gx,gy,Math.max(6,victory.radius/worldSize*w),0,Math.PI*2);ctx.stroke();
   ctx.fillStyle='#ffe68c';ctx.font='bold 22px system-ui';
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⚑',gx,gy-9);
  }
  for(const pin of radarPins){
   const focusedGroup=typeof getRadarGroup==='function'?Number(getRadarGroup(selectedId)):null;
   const x=pin.x*w,y=pin.y*h,focus=pin.team===0&&
    (pin.id===String(selectedId)||pin.groupId!=null&&pin.groupId===focusedGroup);
   ctx.beginPath();ctx.arc(x,y,focus?10:8,0,Math.PI*2);
   ctx.fillStyle=pin.team===0?'#5aceff':'#ff7884';ctx.fill();
   ctx.strokeStyle=focus?'#ffea92':'#132c40';ctx.lineWidth=focus?3.2:1.6;ctx.stroke();
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 10px system-ui';
   ctx.fillStyle='#071625';ctx.fillText(String(pin.number),x,y);
   // Contact marker follows the exact fighting-front coordinates.
   if(pin.inContact){
    ctx.beginPath();ctx.arc(x,y,focus?14:12,0,Math.PI*2);
    ctx.strokeStyle='#ffe091';ctx.lineWidth=2;ctx.stroke();
   }
  }
 }
 function actionDescription(id=String(selectedId||'')){
  const draft=String(id)===String(selectedId)?pendingStrategy:null;
  const chosen=draft?.attackKind?'attack_'+draft.attackKind:
   draft?.command|| (draft?.special?'special_'+draft.special:null)||
   preferredActions.get(String(id));
  if(!chosen)return '対象を選択／作戦未指定';
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
  const status='軍師指示｜'+(pending||actionDescription())+
   '｜HP '+hp+' · '+count+'人'+(queued?' · 到着後予約':suffix==='move'?' · 移動中':'');
  if($('realtimeSelectedState').textContent!==status){
   $('realtimeSelectedState').textContent=status;$('realtimeSelectedState').title=status;
  }
  // The combat clock is frozen while this action tray is being operated.
 }
 function syncMapContext(){
  if(zoom>1&&getSelected()&&mode==='deploy'){
   const s=getSelected();centerX=clamp(s.x||worldSize/2,0,worldSize);
   centerZ=clamp(s.z||worldSize/2,0,worldSize);
  }
 }
 function renderMapInspectionDetail(){
  if(mode!=='inspect')return;
  const detail=$('realtimeMapDetail');detail.hidden=false;
  if(inspectedBuilding){
   const known=(getMapBuildings()||[]).find(b=>String(b.id)===String(inspectedBuilding.id));
   if(known){
    const floors=Math.max(1,Math.min(12,Number(known.floors)||1));
    const level=clamp(Number(inspectedBuilding.floor)||1,1,floors);
    const detailKey='building:'+String(known.id)+':'+level;
    // Inspect-mode redraws every 330 ms. Do not destroy an open mobile
    // <select> while the player is choosing a building floor.
    if(detail.dataset?.inspectorKey===detailKey)return;
    detail.dataset.inspectorKey=detailKey;
    detail.replaceChildren();
    const heading=doc.createElement('strong');
    heading.textContent='🏠 '+String(known.label||'建物')+'｜階数を選択';
    const label=doc.createElement('label');
    label.textContent='表示する階：';
    label.setAttribute('for','realtimeInspectBuildingFloor');
    const selection=doc.createElement('select');
    selection.id='realtimeInspectBuildingFloor';
    selection.setAttribute('aria-label','戦場マップの建物の表示階');
    for(let n=1;n<=floors;n++){
     const option=doc.createElement('option');option.value=String(n);
     option.textContent=n+'階';selection.append(option);
    }
    selection.value=String(level);
    selection.onchange=()=>{
     inspectedBuilding.floor=Number(selection.value);
     $('realtimeMapMessage').textContent=String(known.label||'建物')+'・'+selection.value+'階を表示中';
     drawMap();
    };
    const info=doc.createElement('small');
    info.textContent=level+'階 / '+floors+'階　｜　探索する階も部隊の探索指示から選べます。';
    detail.append(heading,label,selection,info);
    return;
   }
   inspectedBuilding=null;
  }
  detail.dataset.inspectorKey='';
  const pin=inspectedMapPin;
  if(!pin){detail.textContent='🔵 味方・🔴 敵の番号をタップすると、人数・HP/MP・作戦・行動状態・強化/弱体を表示します。';return;}
  const data=getSquadDetails(pin.team,pin.id,pin.groupId)||{};
  const escape=value=>String(value??'—').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
  const num=(value,max)=>Number.isFinite(Number(max))&&Number(max)>0?
   Math.round(Number(value)||0)+'/'+Math.round(Number(max))+'（'+formatBattleMapPercent(Number(value)||0,Number(max))+'%）':'—';
  const faction=pin.team===0?'🔵 味方':'🔴 敵';
  const groupLabel=pin.groupId!=null?'第'+pin.groupId+'隊':'第'+(data.number||pin.id)+'隊';
  const rows=Array.isArray(data.divisions)?data.divisions:[];
  const buffs=Array.isArray(data.buffs)?data.buffs:[];
  const debuffs=Array.isArray(data.debuffs)?data.debuffs:[];
  detail.innerHTML='<strong>'+faction+' '+escape(data.label||groupLabel)+'｜詳細状態</strong>'+
   '<div class="realtimeMapDetailStats"><span>兵数：'+escape(data.alive??'—')+'/'+escape(data.total??'—')+'</span>'+
   '<span>HP：'+num(data.hp,data.maxHp)+'</span><span>MP：'+num(data.mp,data.maxMp)+'</span></div>'+
   '<div>ジョブ：'+escape(data.job||'未確認')+'</div>'+
   '<div>陣形：'+escape(data.formation||'未確認')+'</div>'+
   '<div>現在の作戦：'+escape(data.order||'自動交戦')+'</div>'+
   '<div>目的：'+escape(data.objective||'現在の交戦対象を索敵中')+'</div>'+
   '<div>行動状態：'+escape(data.state||'情報なし')+'</div>'+
   '<div>バフ：'+escape(buffs.length?buffs.join('・'):'確認できる効果なし')+'</div>'+
   '<div>デバフ：'+escape(debuffs.length?debuffs.join('・'):'確認できる効果なし')+'</div>'+
   (rows.length?'<div class="realtimeMapDivisionList">内訳：'+rows.map(row=>
    escape(row.label)+' '+escape(row.alive)+'/'+escape(row.total)+'人'+
    (row.order?'｜'+escape(row.order):'')).join(' ／ ')+'</div>':'');
 }
 function drawMap(){
  if($('realtimeBattleMapOverlay').hidden||!ctx)return;
  const w=canvas.width||464,h=canvas.height||464;
  const span=worldSize/zoom;
  const minX=clamp(centerX-span/2,0,worldSize-span);
  const minZ=clamp(centerZ-span/2,0,worldSize-span);
  centerX=minX+span/2;centerZ=minZ+span/2;
  ctx.clearRect(0,0,w,h);
  const background=getMapBackground();
  if(background){ctx.save?.();ctx.globalAlpha=mode==='inspect'?.38:1;
   ctx.drawImage(background,minX,minZ,span,span,0,0,w,h);ctx.restore?.();ctx.globalAlpha=1;}
  else{ctx.fillStyle=mode==='inspect'?'rgba(36,67,62,.18)':'#24433e';ctx.fillRect(0,0,w,h);}
  ctx.strokeStyle='#ffffff20';ctx.lineWidth=1;
  for(let i=0;i<=8;i++){const v=i*w/8;ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,h);ctx.stroke();}
  // Expanded radar uses the same real friendly and opposing team anchors
  // as the compact radar; no second independent 12-slot map representation.
  deploymentTiles=[];
  if(mode==='deploy'){
   // The same complete-team planner must approve both the cyan highlight
   // and the click. Each tile stores its actual deployable anchor.
   const cellStep=Math.max(8,Math.round(span/15));
   for(let z=Math.floor(minZ/cellStep)*cellStep;z<minZ+span;z+=cellStep){
    for(let x=Math.floor(minX/cellStep)*cellStep;x<minX+span;x+=cellStep){
     const sx=Math.max(minX,x),sz=Math.max(minZ,z);
     const ex=Math.min(minX+span,x+cellStep),ez=Math.min(minZ+span,z+cellStep);
     if(ex<=sx||ez<=sz)continue;
     const sample={x:Math.round((sx+ex)/2),z:Math.round((sz+ez)/2)};
     const point=getLegalPoint(sample.x,sample.z,true);
     const nearby=point&&Math.abs(point.x-sample.x)<=cellStep*.5&&
      Math.abs(point.z-sample.z)<=cellStep*.5;
     const legal=Boolean(nearby&&canDeploy(point.x,point.z)&&
      previewDeploy(selectedId,point));
     deploymentTiles.push({left:(sx-minX)/span*w,top:(sz-minZ)/span*h,
      right:(ex-minX)/span*w,bottom:(ez-minZ)/span*h,
      x:point?.x,z:point?.z,legal});
     ctx.fillStyle=legal?'rgba(35,173,255,.44)':'rgba(176,56,70,.23)';
     ctx.fillRect((sx-minX)/span*w,(sz-minZ)/span*h,
      (ex-sx)/span*w+.3,(ez-sz)/span*h+.3);
    }
   }
   ctx.strokeStyle='rgba(114,254,225,.90)';ctx.lineWidth=2;
   ctx.strokeRect?.(1,1,w-2,h-2);
  }
  const goal=getVictoryObjective();
  if(goal?.kind==='capture'){
   const gx=(goal.x-minX)/span*w,gz=(goal.z-minZ)/span*h;
   if(gx>=0&&gx<=w&&gz>=0&&gz<=h){
    ctx.strokeStyle='#ffe68c';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(gx,gz,Math.max(8,goal.radius/span*w),0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ffe68c';ctx.font='bold 22px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⚑',gx,gz-12);
   }
  }
  const sourceAllies=squads();
  const allies=mode==='inspect'&&typeof getRadarSquads==='function'?
   getRadarSquads(sourceAllies):sourceAllies;
  const enemies=mode==='deploy'||mode==='inspect'&&typeof getRadarEnemies==='function'?
   (getRadarEnemies?.()||getEnemies()):getEnemies();
  const markers=visibleBattleSquadPins(allies,enemies,'live');
  mapInspectionPins=[];mapInspectionBuildings=[];
  if(mode==='inspect'){
   for(const building of getMapBuildings()||[]){
    if(!Number.isFinite(building?.x)||!Number.isFinite(building?.z))continue;
    const bx=(building.x-minX)/span*w,bz=(building.z-minZ)/span*h;
    if(bx<0||bx>w||bz<0||bz>h)continue;
    mapInspectionBuildings.push({id:String(building.id),px:bx,py:bz});
    const focused=String(inspectedBuilding?.id)===String(building.id);
    ctx.fillStyle=focused?'#ffe2a0':'#75dbbe';
    ctx.fillRect(bx-7,bz-7,14,14);
    ctx.strokeStyle=focused?'#fff2c7':'#193b47';ctx.lineWidth=focused?3:1.5;
    ctx.strokeRect?.(bx-7,bz-7,14,14);
    ctx.fillStyle='#0b2734';ctx.font='bold 13px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('⌂',bx,bz+1);
   }
  }
  for(const s of markers){
   if(!Number.isFinite(s.x)||!Number.isFinite(s.z))continue;
   const x=(s.x-minX)/span*w,z=(s.z-minZ)/span*h;
   if(x<0||x>w||z<0||z>h)continue;
   const own=s.team!==1,number=(own?allies:enemies)
    .findIndex(pin=>String(pin.id)===String(s.id))+1;
   if(mode==='inspect')mapInspectionPins.push({id:String(s.id),team:own?0:1,
    groupId:s.groupId??null,px:x,py:z});
   const highlighted=mode==='inspect'?
    inspectedMapPin?.team===(own?0:1)&&String(inspectedMapPin.id)===String(s.id):
    own&&String(s.id)===String(selectedId);
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
  if(mode==='inspect')renderMapInspectionDetail();
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
  if(origin==='dock'){
   pendingStrategy={special:entry.special,targetId:entry.targetId};
   hideContextChoices();
   $('realtimeTargetMessage').textContent=['high_ground','unlock_door'].includes(entry.special)?
    '対象を設定しました。確定後は自動で接近し、'+(entry.special==='unlock_door'?'鍵を開けます。':'高所から攻撃します。'):
    '固有作戦の対象を設定しました。作戦を確定してください。';
   renderActionSelection();
   return;
  }
  if(origin==='map'&&mode==='deploy'){
   $('realtimeMapMessage').textContent='固有作戦・道具は開戦後に使用できます。';return;
  }
  if(origin==='map'&&mode==='move'&&actionDestination&&!entry.itemId){
   arrivalActions.set(id,{...entry,point:{...actionDestination}});
   closeMap();closeSquadControls();return;
  }
  // Army supplies are commander actions, never postponed for arrival.
  const accepted=entry.itemId?onReinforce(id,entry.itemId):
   onSpecial(id,entry.special,entry.targetId);
  if(accepted?.openMove){openMap('move');return;}
  if(accepted){if(entry.special){preferredActions.set(id,'special_'+entry.special);renderActionSelection();}
   hideContextChoices();
   if(origin==='map'&&!$('realtimeBattleMapOverlay').hidden)closeMap();
   closeSquadControls();return;}
  $(origin==='map'?'realtimeMapMessage':'realtimeSelectedState').textContent=
   '実行できません。所持数・対象状態・軍師・命令制限を確認してください（アイテムに射程制限なし）。';
 }
 function setDockTab(next='strategy'){
  if(!['strategy','rally','formation','items'].includes(next))return;
  dockTab=next;hideContextChoices();
  const strategy=next==='strategy',rally=next==='rally',formation=next==='formation',items=next==='items';
  for(const id of ['realtimeDefend','realtimeCharge','realtimeHold','realtimeSpecial','realtimeThiefUnlock','realtimeThiefSteal'])
   $(id).hidden=!strategy;
  $('realtimeRally').hidden=true;
  $('realtimeSkillStep').hidden=!strategy;
  $('realtimeSupport').hidden=true;
  $('realtimeManageItems').hidden=true;
  $('realtimeStrategyTargets').hidden=!strategy||!battleAttackNeedsEnemy(pendingStrategy?.attackKind);
  $('realtimeConfirmStrategy').hidden=!strategy;
  $('realtimeRallyInline').hidden=!rally;
  $('realtimeFormationInline').hidden=!formation;
  $('realtimeItemInline').hidden=!items;
  for(const [id,selected] of [['realtimeTabStrategy',strategy],['realtimeTabRally',rally],['realtimeTabFormation',formation],['realtimeTabItems',items]]){
   const button=$(id);button.classList.toggle('selected',selected);
   button.setAttribute('aria-selected',String(selected));
  }
  if(strategy)refreshMoveTargetChoices();
  if(rally)showRallyChoices();
  if(formation)showFormationChoices();
  if(items)refreshInlineItems(true);
  tapChoices.renderAll();
  renderActionSelection();
 }
 function showFormationChoices(){
  const root=$('realtimeFormationChoices'),status=$('realtimeFormationStatus');
  root.replaceChildren();
  const options=getFormationOptions(String(selectedId))||[];
  if(!options.length){
   status.textContent='陣形変更は3隊編成のストーリー戦闘で使用できます。';
   return;
  }
  status.textContent='陣形変更は号令扱いです。条件を満たす陣形にのみ変更できます。';
  for(const entry of options){
   const item=doc.createElement('button');item.type='button';
   item.className='realtimeFormationChoice';
   const label=doc.createElement('strong');label.textContent=String(entry.name||entry.id);
   const description=doc.createElement('small');
   description.textContent='目的：'+String(entry.purpose||'')+'／動き：'+String(entry.movement||'');
   const reason=doc.createElement('small');
   reason.textContent=entry.current?'✓ 現在の陣形':
    entry.eligible?'✓ 変更可能':'🔒 '+String(entry.reason||'条件未達');
   item.append(label,description,reason);
   item.disabled=!entry.eligible||Boolean(entry.current);
   item.onclick=()=>{
    if(!onFormationChange(String(selectedId),String(entry.id))){
     status.textContent='陣形変更できません。軍師・生存兵・号令間隔を確認してください。';
     showFormationChoices();return;
    }
    status.textContent='✓ '+String(entry.name||entry.id)+'へ陣形変更を発令';
    closeSquadControls();
   };
   root.append(item);
  }
 }
 function showSupportChoices(origin){
  const node=actionPanel(origin,'Support'),items=getAvailableItems(String(selectedId))||[];
  if(!items.length){contextNote(node,'援軍の兵符を所持していません。');return;}
  contextNote(node,'プレイヤー＝軍師が兵符を使って予備兵を補充します。部隊はアイテムを使用しません。');
  let chosen=null;
  const buttons=[];
  for(const item of items){
   const button=contextButton(node,'📯 '+String(item.label||item.id)+' ×'+(item.quantity||0),()=>{
    chosen=String(item.id);
    for(const entry of buttons){
     const active=entry===button;
     entry.classList.toggle('selected',active);
     entry.setAttribute('aria-pressed',String(active));
    }
    confirm.disabled=false;
   });
   button.setAttribute('aria-pressed','false');buttons.push(button);
  }
  const confirm=contextButton(node,'✅ 選んだ兵符の使用を確定',()=>{
   if(chosen)confirmContextAction(origin,{itemId:chosen});
  });
  confirm.classList.add('realtimeMainConfirm');confirm.disabled=true;
 }
 function issueDockOrder(command){
  if(!started)return false;
  hideContextChoices();
  pendingStrategy={command};
  $('realtimeSkillStep').textContent='② '+(command==='defend'?'守備':command==='hold'?'待機':'作戦')+
   'を選択しました。対象指定は不要です。';
  refreshMoveTargetChoices();
  renderActionSelection();
  return true;
 }
 function showGuardChoices(){
  const node=actionPanel('dock','Guard');
  contextNote(node,'僧侶の守備：通常守備／負傷者を回復／戦闘不能者を蘇生（UR）');
  contextButton(node,'🛡 通常守備を選択',()=>issueDockOrder('defend'));
  for(const action of battleJobSpecialActions(getSelected()?.job)
   .filter(entry=>entry.id==='heal_ally'||entry.id==='revive_ally')){
   const button=contextButton(node,action.label,()=>showSpecialTargets('dock',action));
   button.disabled=!(getSpecialTargets(String(selectedId),action.id)||[]).length;
  }
  renderActionSelection();
 }
 function rallyPhaseText(info){
  if(info.phase==='active')return '📣 '+String(info.activeName||'強化号令')+
   ' 発動中 · 残り'+Math.max(0,Number(info.seconds)||0)+'秒（発動中は再発令不可）';
  if(info.phase==='interval')return '⏳ 号令インターバル · 残り'+
   Math.max(0,Number(info.seconds)||0)+'秒（終了すると再発令可能）';
  return '✅ 号令発令可能 · 効果22秒 → 終了後10秒のインターバル';
 }
 function refreshRallyState(){
  if($('realtimeRallyInline').hidden)return;
  const info=getRallyInfo(String(selectedId));
  $('realtimeInlineRallyStatus').textContent=rallyPhaseText(info);
  const enabled=info.phase==='ready'&&Boolean($('realtimeRallyTarget').value)&&
   Boolean($('realtimeRallyKind').value);
  $('realtimeConfirmRally').disabled=!enabled;
 }
 function showRallyChoices(){
  // No child popup: persistent inputs are always in the main tab.
  const info=getRallyInfo(String(selectedId));
  const target=$('realtimeRallyTarget'),kind=$('realtimeRallyKind');
  const previous=target.value,previousKind=kind.value;
  target.replaceChildren();kind.replaceChildren();
  for(const t of (info.targets||[]).filter(t=>t.alive)){
   const opt=doc.createElement('option');opt.value=String(t.id);
   opt.textContent=String(t.label||t.id);target.append(opt);
  }
  const prefer=[previous,String(selectedId)].find(id=>
   (info.targets||[]).some(t=>t.alive&&String(t.id)===id));
  if(prefer)target.value=prefer;
  for(const fx of COMMAND_RALLY_TYPES){
   const opt=doc.createElement('option');opt.value=fx.id.replace('command_','');
   opt.textContent=fx.name+'（効果22秒）';kind.append(opt);
  }
  if([...COMMAND_RALLY_TYPES].some(fx=>fx.id.replace('command_','')===previousKind))
   kind.value=previousKind;
  target.disabled=!target.options?.length;
  pendingRally={targetId:target.value,kind:kind.value};
  tapChoices.renderAll();
  refreshRallyState();
 }
 function refreshInlineItems(force=false){
  if($('realtimeItemInline').hidden)return;
  const stamp=nowMs();
  if(!force&&stamp-lastInlineItemRefresh<420)return;
  lastInlineItemRefresh=stamp;
  const items=getSharedItems(String(selectedId))||[];
  const allies=squads().filter(s=>Number(s.alive)>0);
  const signature=JSON.stringify([items.map(i=>[i.id,i.label,i.name,i.quantity,i.collected,i.usable]),
   allies.map(s=>[s.id,s.label,s.alive])]);
  if(!force&&signature===lastInlineItemSignature)return;
  lastInlineItemSignature=signature;
  const choice=$('realtimeSharedItemChoice'),target=$('realtimeSharedItemTarget');
  const previous=choice.value,oldTarget=target.value;
  choice.replaceChildren();target.replaceChildren();
  for(const item of items){
   const option=doc.createElement('option');
   option.value=String(item.id);
   const collected=Number(item.collected)||0;
   option.textContent=String(item.label||item.name||item.id)+' ×'+Math.max(0,Number(item.quantity)||0)+
    (collected>0?'（戦闘取得 +'+collected+'）':'')+
    (item.usable===false?'［使用不可］':'');
   option.disabled=item.usable===false||!(Number(item.quantity)>0);
   choice.append(option);
  }
  if(!items.length){
   const option=doc.createElement('option');option.value='';
   option.textContent='共有所持品はありません';choice.append(option);
  }
  const usable=items.filter(item=>item.usable!==false&&Number(item.quantity)>0);
  choice.value=usable.some(item=>String(item.id)===previous)?previous:
   usable.length?String(usable[0].id):'';
  for(const ally of allies){
   const option=doc.createElement('option');option.value=String(ally.id);
   option.textContent=String(ally.label||ally.id)+'（'+Number(ally.alive)+'人）';
   target.append(option);
  }
  target.value=allies.some(s=>String(s.id)===oldTarget)?oldTarget:
   allies.some(s=>String(s.id)===String(selectedId))?String(selectedId):
   String(allies[0]?.id||'');
  $('realtimeConfirmItem').disabled=!choice.value||!target.value;
  const all=items.reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)||0),0);
  const acquired=items.reduce((sum,item)=>sum+Math.max(0,Number(item.collected)||0),0);
  $('realtimeInlineItemStatus').textContent='全軍共有 '+all+'個／戦闘取得累計 '+acquired+
   '個。所持品を選び「アイテム使用を確定」で消費します（距離制限なし）。';
  tapChoices.renderAll();
 }
  function showSpecialTargets(origin,action,page=0){
  pendingStrategy=null;
  $('realtimeSkillStep').textContent='② '+action.label+'：実行できる対象を選んでください';
  refreshMoveTargetChoices();
  const node=actionPanel(origin,'Special');
  contextButton(node,'◀ 戻る',()=>showSpecialChoices(origin));
  const targets=getSpecialTargets(String(selectedId),action.id)||[];
  if(!targets.length){contextNote(node,action.id==='high_ground'?
   '利用できる高所がありません。階段・窓までの経路や高所の占有状況を確認してください。':
   '実行できる対象がありません。');return;}
  const perPage=['height','door','building','bridge'].includes(action.target)?8:4;
  const last=Math.max(0,Math.ceil(targets.length/perPage)-1);
  page=clamp(page,0,last);contextNote(node,action.label+'：対象を選択');
  const shown=targets.slice(page*perPage,(page+1)*perPage);
  const isStructure=['building','bridge','door','height'].includes(action.target)&&shown.some(t=>Number.isFinite(t.x)&&Number.isFinite(t.z));
  const focusHighGround=target=>{
   if(action.id!=='high_ground'||!started||!Number.isFinite(target?.x)||!Number.isFinite(target?.z))return;
   onMapOverview({x:Math.round(target.x),z:Math.round(target.z)});
  };
  if(isStructure){
   // Open the real 3D camera overhead, not only an inline two-dimensional map.
   focusHighGround(shown.find(t=>t.available!==false&&Number.isFinite(t.x)&&Number.isFinite(t.z))||shown[0]);
   contextNote(node,'🟨 地図の番号ピンか対象名を選択してください。確定後は自動で接近して実行します。');
   const preview=doc.createElement('canvas');preview.className='realtimeStructureMap';
   preview.width=260;preview.height=164;
   preview.setAttribute('aria-label','作戦対象の屋根・高所・建物・橋・扉の位置。番号をタップして選択');
   preview.setAttribute('role','img');node.append(preview);
   const status=doc.createElement('small');status.className='realtimeStructureSelection';
   status.setAttribute('role','status');node.append(status);
   const ctx=preview.getContext?.('2d');let chosen=null,confirmButton=null;
   const paint=()=>{
    if(!ctx)return;
    const w=preview.width,h=preview.height;
    ctx.clearRect(0,0,w,h);
    const background=getMapBackground();
    if(background)try{ctx.drawImage(background,0,0,w,h);}catch{}
    ctx.fillStyle='rgba(4,22,35,.26)';ctx.fillRect(0,0,w,h);
    shown.forEach((target,index)=>{
     if(!Number.isFinite(target.x)||!Number.isFinite(target.z))return;
     const x=clamp(target.x/worldSize*w,6,w-6),y=clamp(target.z/worldSize*h,6,h-6);
     const active=chosen&&String(chosen.id)===String(target.id);
     ctx.beginPath();ctx.arc(x,y,active?12:9,0,Math.PI*2);
      ctx.fillStyle=target.available===false?'#7b8490':active?'#ffe3a0':'#ffb66d';ctx.fill();
     ctx.lineWidth=active?3:1;ctx.strokeStyle='#152a3a';ctx.stroke();
     ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
     ctx.fillStyle='#183145';ctx.fillText(String(page*perPage+index+1),x,y);
    });
   };
   const choose=target=>{
    if(target.available===false){
     status.textContent='選択不可：'+String(target.reason||'現在は実行できません');
     return;
    }
    chosen=target;
    focusHighGround(target);
    status.textContent='選択中：'+String(target.label||target.id)+'。下の「作戦を確定」で実行します。';
    if(origin==='dock'){
     pendingStrategy={special:action.id,targetId:String(target.id)};
     renderActionSelection();
    }
    if(confirmButton)confirmButton.disabled=false;
    paint();
   };
   preview.addEventListener('click',event=>{
    const box=preview.getBoundingClientRect();
    if(!box.width||!box.height)return;
    const x=(event.clientX-box.left)/box.width*preview.width;
    const y=(event.clientY-box.top)/box.height*preview.height;
    let nearest=null,best=Infinity;
    for(const target of shown){
     if(!Number.isFinite(target.x)||!Number.isFinite(target.z))continue;
     const d=Math.hypot(x-target.x/worldSize*preview.width,y-target.z/worldSize*preview.height);
     if(d<best){nearest=target;best=d;}
    }
    if(nearest&&best<26)choose(nearest);
   });
   for(const target of shown){
    const button=contextButton(node,String(target.label||target.id),()=>choose(target));
    button.disabled=target.available===false;
    if(button.disabled)button.title=String(target.reason||'現在は実行できません');
   }
   confirmButton=contextButton(node,'✅ この高所・対象で固有技を確定',()=>{
    if(!chosen)return;
    if(origin==='dock')confirmDockStrategy();
    else confirmContextAction(origin,{special:action.id,targetId:String(chosen.id)});
   });
   confirmButton.classList.add('realtimeMainConfirm');
   confirmButton.disabled=true;
   status.textContent='対象を選ぶまで作戦は発令されません。';
   // The target-map canvas must be painted on first open, before any tap.
   paint();
  }else{
   let chosen=null,confirmButton=null;
   const status=doc.createElement('small');status.className='realtimeStructureSelection';
   status.setAttribute('role','status');node.append(status);
   for(const target of shown){
    const button=contextButton(node,String(target.label||target.id),()=>{
     if(target.available===false){
      status.textContent='選択不可：'+String(target.reason||'現在は実行できません');
      return;
     }
     chosen=target;
     if(confirmButton)confirmButton.disabled=false;
     status.textContent='選択中：'+String(target.label||target.id)+'。下の「固有技を確定」で実行します。';
     if(origin==='dock'){
      pendingStrategy={special:action.id,targetId:String(target.id)};
      renderActionSelection();
     }
     for(const child of node.querySelectorAll('button.realtimeContextTarget')){
      const active=child===button;child.classList.toggle('selected',active);
      child.setAttribute('aria-pressed',String(active));
     }
    });
    button.classList.add('realtimeContextTarget');button.setAttribute('aria-pressed','false');
    button.disabled=target.available===false;
    if(button.disabled)button.title=String(target.reason||'現在は実行できません');
   }
   confirmButton=contextButton(node,'✅ この対象で固有技を確定',()=>{
    if(!chosen)return;
    if(origin==='dock')confirmDockStrategy();
    else confirmContextAction(origin,{special:action.id,targetId:String(chosen.id)});
   });
   confirmButton.classList.add('realtimeMainConfirm');
   confirmButton.disabled=true;
   status.textContent='対象を選ぶまで作戦は発令されません。';
  }
  if(last>0){
   const nav=doc.createElement('div');nav.className='realtimeContextPager';node.append(nav);
   const prev=contextButton(nav,'◀',()=>showSpecialTargets(origin,action,page-1));
   prev.disabled=page===0;contextNote(nav,(page+1)+'/'+(last+1));
   const next=contextButton(nav,'▶',()=>showSpecialTargets(origin,action,page+1));
   next.disabled=page===last;
  }
 }
 function showSpecialChoices(origin){
  pendingStrategy=null;
  $('realtimeSkillStep').textContent='① 使用する固有スキルを選択してください';
  refreshMoveTargetChoices();
  const node=actionPanel(origin,'Special'),actions=battleJobSpecialActions(getSelected()?.job);
  if(!actions.length){contextNote(node,'このジョブの固有作戦はありません。');return;}
  contextNote(node,String(getSelected()?.job||'')+'隊の固有作戦');
  for(const action of actions)
   contextButton(node,action.label,()=>showSpecialTargets(origin,action));
  renderActionSelection();
 }

 let listedMoveTargets=[];
 function paintInlineTargetMap(){
  const canvas=$('realtimeInlineTargetMap'),context=canvas.getContext?.('2d');
  if(!context)return;
  const w=canvas.width,h=canvas.height,span=worldSize/targetZoom;
  const left=clamp(targetCenterX-span/2,0,worldSize-span);
  const top=clamp(targetCenterZ-span/2,0,worldSize-span);
  context.clearRect(0,0,w,h);
  const background=getMapBackground();
  if(background)try{context.drawImage(background,left,top,span,span,0,0,w,h);}catch{}
  else {context.fillStyle='#183f43';context.fillRect(0,0,w,h);}
  for(const [team,units] of [[0,squads()],[1,getEnemies()]]){
   for(const entry of units){
    if(!Number.isFinite(entry.x)||!Number.isFinite(entry.z))continue;
    const x=(entry.x-left)/span*w,z=(entry.z-top)/span*h;
    if(x<0||x>w||z<0||z>h)continue;
    context.beginPath();context.arc(x,z,3,0,Math.PI*2);
    context.fillStyle=team===0?'#63d7ff':'#ff8080';context.fill();
   }
  }
  if(targetPoint){
   const x=(targetPoint.x-left)/span*w,z=(targetPoint.z-top)/span*h;
   context.beginPath();context.arc(x,z,7,0,Math.PI*2);
   context.strokeStyle='#ffe69c';context.lineWidth=3;context.stroke();
  }
 }
 function refreshMoveTargetChoices(){
  // Command flow: skill -> only eligible enemy targets -> explicit confirm.
  const needsEnemy=battleAttackNeedsEnemy(pendingStrategy?.attackKind);
  const select=$('realtimeTargetChoice'),previous=select.value;
  $('realtimeStrategyTargets').hidden=dockTab!=='strategy'||!needsEnemy;
  select.hidden=!needsEnemy;
  $('realtimeTargetKind').hidden=true;
  $('realtimeInlineMapArea').hidden=true;
  listedMoveTargets=[];
  select.replaceChildren();
  if(needsEnemy){
   listedMoveTargets=eligibleEnemyBattleTargets(
    getMoveTargets('enemies',String(selectedId))||[]).slice(0,40);
   const placeholder=doc.createElement('option');placeholder.value='';
   placeholder.textContent=listedMoveTargets.length?'敵隊を選択':'攻撃可能な敵隊がいません';
   select.append(placeholder);
   for(const target of listedMoveTargets){
    const opt=doc.createElement('option');opt.value=String(target.id);
    opt.textContent=String(target.label||'敵第'+target.squadId+'隊');
    select.append(opt);
   }
   select.value=listedMoveTargets.some(t=>String(t.id)===previous)?previous:'';
  }
  $('realtimeTargetMessage').textContent=needsEnemy?
   (listedMoveTargets.length?'敵隊を選んでから「作戦を確定」を押してください。':
    'このスキルで指定できる敵隊がいません。'):'';
  tapChoices.renderAll();
 }
 function selectedMovementTarget(){
  if(!battleAttackNeedsEnemy(pendingStrategy?.attackKind))return null;
  return listedMoveTargets.find(t=>String(t.id)===$('realtimeTargetChoice').value)||null;
 }
 function nearestLegalApproach(target){
  const x=Math.round(Number(target.x)),z=Math.round(Number(target.z));
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  const firstRadius=1;
  for(let r=0;r<=5;r++){
   const radius=r===0?firstRadius:r<=firstRadius?r-1:r;
   for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
    const nx=x+dx,nz=z+dz;
    if(nx<0||nz<0||nx>=worldSize||nz>=worldSize)continue;
    const point=getLegalPoint(nx,nz,false);
    if(point&&Number.isInteger(point.x)&&Number.isInteger(point.z))return point;
   }
  }
  return null;
 }
 function confirmDockStrategy(){
  const id=String(selectedId||''),entry=pendingStrategy;
  const destination=selectedMovementTarget();
  let success=false,queuedArrival=false;
  if(!entry?.special&&!entry?.command){
   $('realtimeTargetMessage').textContent='移動だけの指示はありません。作戦または固有作戦を選択してください。';
   return false;
  }
  if(battleAttackNeedsEnemy(entry?.attackKind)){
   const current=eligibleEnemyBattleTargets(getMoveTargets('enemies',id)||[]);
   if(!destination||!current.some(t=>String(t.id)===String(destination.id))){
    $('realtimeTargetMessage').textContent='有効な敵隊を選んでから確定してください。';
    refreshMoveTargetChoices();renderActionSelection();return false;
   }
  }
  if(entry?.special){
   const valid=(getSpecialTargets(id,entry.special)||[]).some(t=>
    String(t.id)===String(entry.targetId)&&t.available!==false);
   if(!valid){
    $('realtimeSkillStep').textContent='対象が無効になりました。スキルから選び直してください。';
    pendingStrategy=null;renderActionSelection();return false;
   }
   success=onSpecial(id,entry.special,entry.targetId);
  }
  else if(destination&&entry?.command==='charge'&&Number(destination.team)===1&&destination.squadId!=null){
   // A targeted attack tracks the enemy squad until it can strike; it must
   // not stop at the enemy's old map coordinates.
   success=onTargetOrder(id,entry.command,destination);
  }else if(destination&&entry?.command){
   const point=nearestLegalApproach(destination);
   if(point)success=onMove(id,point);
   if(success&&entry?.command){
    arrivalActions.set(id,{command:entry.command,point:{...point}});
    queuedArrival=true;
   }
  }else if(entry?.command)success=onOrder(id,entry.command);
  if(success?.followup&&success?.point){
   arrivalActions.set(id,{command:success.followup,point:{...success.point}});
   queuedArrival=true;
  }
  if(success?.openMove){
   // Summon has already happened. Next confirmation only moves the existing
   // summon; never execute the summon skill twice while choosing a destination.
   if(entry?.special)preferredActions.set(id,'special_'+entry.special);
   pendingStrategy=null;
   $('realtimeSelectedState').textContent='召喚完了。移動する位置を選んで作戦を確定';
   $('realtimeTargetKind').value='point';refreshMoveTargetChoices();return;
  }
  if(success){
   // Ordinary dock orders also supersede stale arrival commands.
   if(!queuedArrival&&!success?.deferred)arrivalActions.delete(id);
   if(entry?.command)preferredActions.set(id,entry.attackKind?'attack_'+entry.attackKind:entry.command);
   if(entry?.special)preferredActions.set(id,'special_'+entry.special);
   const label=entry?.special?'固有作戦':'選択作戦';
   $('realtimeTargetMessage').textContent='✅ '+label+'を確定';
   pendingStrategy=null;closeSquadControls();
  }else $('realtimeTargetMessage').textContent=
   '対象と作戦を選択してください。指示不可の場合は軍師・地形・命令制限も確認してください。';
 }
 function confirmInlineRally(){
  const target=$('realtimeRallyTarget').value,kind=$('realtimeRallyKind').value;
  if(!target||!kind||getRallyInfo(String(selectedId)).phase!=='ready'){
   refreshRallyState();return false;
  }
  const success=onRally(String(selectedId),kind,[target]);
  if(success){closeSquadControls();return true;}
  $('realtimeInlineRallyStatus').textContent='号令できません。軍師とインターバルを確認してください。';
  refreshRallyState();return false;
 }
 function confirmInlineItem(){
  const itemId=$('realtimeSharedItemChoice').value,squadId=$('realtimeSharedItemTarget').value;
  if(!itemId||!squadId)return false;
  const valid=(getSharedItems(String(selectedId))||[]).some(item=>
   String(item.id)===itemId&&item.usable!==false&&Number(item.quantity)>0);
  if(!valid){refreshInlineItems(true);return false;}
  const success=onSharedItem(itemId,squadId);
  if(success){closeSquadControls();return true;}
  $('realtimeInlineItemStatus').textContent='使用できません。対象のHP／人数、軍師の命令制限を確認してください。';
  return false;
 }
 function renderActionSelection(){
  const chosen=pendingStrategy?.attackKind?'attack_'+pendingStrategy.attackKind:
   pendingStrategy?.command||
   (pendingStrategy?.special?'special_'+pendingStrategy.special:null)||
   preferredActions.get(String(selectedId));
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
  const specialJob=String(getSelected()?.job||'');
   const isThief=specialJob.includes('シーフ');
  $('realtimeSpecial').textContent=
   specialJob.includes('召喚士')?'🐉 召喚獣・固有技':
   ['弓使い','魔法使い','忍者'].some(name=>specialJob.includes(name))?'🏹 高所攻撃・固有技':
   specialJob.includes('盾騎士')||specialJob.includes('盾戦士')?'🛡 かばう・固有技':'★ 固有技';
  $('realtimeSpecial').hidden=dockTab!=='strategy'||isThief;
  $('realtimeThiefUnlock').hidden=dockTab!=='strategy'||!isThief;
  $('realtimeThiefSteal').hidden=dockTab!=='strategy'||!isThief;
  $('realtimeSpecial').disabled=!battleJobSpecialActions(specialJob).length;
  const mustPickEnemy=battleAttackNeedsEnemy(pendingStrategy?.attackKind);
  $('realtimeStrategyTargets').hidden=dockTab!=='strategy'||!mustPickEnemy;
  $('realtimeConfirmStrategy').disabled=
   !(pendingStrategy?.command||pendingStrategy?.special)||
   (mustPickEnemy&&!selectedMovementTarget())||
   (pendingStrategy?.special&&!pendingStrategy.targetId);
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
  // No deadline: the player decides when to confirm or cancel the order.
  $('realtimePlanSeconds').textContent='作戦選択中（時間制限なし）';
  $('realtimeRadarClock').hidden=true;$('realtimeMapPlanningClock').hidden=true;
 }
 function enterPlanning(){
  if(!started)return;
  if(!getPaused()){onPause();planningOwnsPause=Boolean(getPaused());}
  updatePlanningCountdown();
 }
 function exitPlanning(){
  planningDeadline=0;
  if(planningTicker!=null)globalThis.clearInterval?.(planningTicker);
  planningTicker=null;$('realtimeRadarClock').hidden=true;
  if(!planningOwnsPause)return;
  planningOwnsPause=false;if(getPaused())onPause();
 }
 function showSquadControls(id){
  if(!started)return false;
  if(!setSelected(id))return false;
  $('realtimeSkillStep').textContent='① 作戦・スキルを選択してください';
  enterPlanning();
  $('realtimeBattleDock').hidden=false;
  setDockTab('strategy');
  updatePlanningCountdown();
  commandWizard.open(id);
  drawRadar(true);
  return true;
 }
 function closeSquadControls(){
  commandWizard.hide();
  $('realtimeBattleDock').hidden=true;
  pendingStrategy=null;pendingRally=null;targetPoint=null;
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
  hideActionSheet();mode=next;
  if(next==='deploy')deployStep='placement';
  refreshOptions();
  if(next==='inspect'&&started){
   inspectedMapPin=null;inspectedBuilding=null;mapInspectionPins=[];mapInspectionBuildings=[];lastInspectionRefreshAt=-Infinity;
   $('realtimeBattleMapOverlay').hidden=false;
   $('realtimeMapClose').hidden=false;$('realtimeMapClose').textContent='✕ 戻る';
   $('realtimeMapTitle').textContent='⛶ 戦場マップ';
   $('realtimeMapHelp').textContent='＋／－で拡大縮小。青・赤の隊番号で戦況、緑の建物マークで表示階を選択できます。';
   $('realtimeMapSquadPager').hidden=true;
   $('realtimeInitialTeamPlanning').hidden=true;
   $('realtimeMapActionSheet').hidden=true;
   $('realtimeStart').hidden=true;
   $('realtimeMapPlanningClock').hidden=true;
   $('realtimeMapViewport').hidden=false;
   $('realtimeMapDetail').hidden=false;
   $('realtimeMapMessage').textContent='';
   zoom=1;centerX=centerZ=worldSize/2;
   drawMap();return;
  }
  $('realtimeMapSquadPager').hidden=false;$('realtimeMapDetail').hidden=true;

  if(started)enterPlanning();
  $('realtimeInitialTeamPlanning').hidden=next!=='deploy';
  $('realtimeMapActionSheet').hidden=next==='deploy';
  if(started)onMapOverview({x:Math.round(worldSize/2),z:Math.round(worldSize/2)});
  $('realtimeBattleMapOverlay').hidden=false;
  $('realtimeMapClose').hidden=false;
  $('realtimeMapClose').textContent=next==='deploy'?'⤢ 縮小':'✕ 戻る';
  $('realtimeStart').hidden=next!=='deploy';
  $('realtimeMapTitle').textContent=next==='deploy'?'⛶ 部隊レーダー拡大・初期配置':'移動先を選択';
  $('realtimeMapPlanningClock').hidden=next==='deploy';
  $('realtimeMapHelp').textContent=next==='deploy'?
   '①第1〜3隊を選ぶ → レーダーの味方陣地をタップして配置 → ②隊ごとに作戦を選ぶ → 開戦。宿屋の陣形を維持します。':
   '◀ ▶で移動する味方隊を選び、地図をタップ。戦闘はリアルタイムで進みます。';
  $('realtimeMapMessage').textContent=next==='deploy'?'① 地図に隊を配置 → ② 次の画面で初期作戦を選択。各隊を順番に設定します。':'';
  syncPrebattleScreen();
  root.querySelector('[data-action-after-move="support"]').hidden=next==='deploy';
  $('realtimeMapItemCategory').hidden=next==='deploy';
  root.querySelector('[data-action-after-move="special"]').hidden=next==='deploy';
  renderActionSelection();
  if(next==='move'){zoom=1.6;const own=getSelected();
   centerX=Number.isFinite(own?.x)?own.x:worldSize/2;
   centerZ=Number.isFinite(own?.z)?own.z:worldSize/2;}
  else {zoom=1;centerX=centerZ=worldSize/2;}
  drawMap();
 }
 function closeMap(){
  if(mode==='deploy'&&!started){
   $('realtimeBattleMapOverlay').hidden=true;drawRadar(true);return;
  }
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
  if(mode==='inspect')return false; // Expanded map is observation-only during battle.
  const squad=getSelected();
  if(!squad)return false;
  const point=mode==='deploy'?{x,z}:getLegalPoint(x,z,false);
  if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.z)){
   $('realtimeMapMessage').textContent='この地形は通行できません。別のマスを選択してください。';return false;
  }
  if(mode==='deploy'){
   if(!canDeploy(point.x,point.z)){
    $('realtimeMapMessage').textContent='初期配置は味方陣地だけです。青い陣地内の安全な場所を選んでください。';return false;
   }
   const applied=previewDeploy(selectedId,point)&&onDeploy(selectedId,point);
   $('realtimeMapMessage').textContent=applied?'配置を保存しました。別の隊も配置できます。':'配置場所が不足するか、建物・他隊に重なっています。';
   if(applied){
    const group=String(squad.groupId??squad.id);
    placedTeams.add(group);
    invalidateSquadSnapshot();refreshOptions();drawMap();
    $('realtimeMapMessage').textContent='第'+group+'隊の配置を保存しました。「配置を確定して作戦選択」を押してください。';
   }
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
  if(Math.hypot(dx,dy)>(mode==='deploy'?22:10))pointer.pan=true;
  if(pointer.pan){
   const rect=canvas.getBoundingClientRect(),span=worldSize/zoom;
   centerX=pointer.baseX-dx/Math.max(1,rect.width)*span;
   centerZ=pointer.baseZ-dy/Math.max(1,rect.height)*span;
   scheduleMapDraw();
  }
 });
 let lastMapTapAt=-Infinity,lastMapTapX=NaN,lastMapTapY=NaN;
 function handleMapCanvasTap(e,origin='pointer'){
  const rect=canvas.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return;
  const now=nowMs();
  if(origin==='click'&&now-lastMapTapAt<600&&
   Math.hypot(e.clientX-lastMapTapX,e.clientY-lastMapTapY)<22)return;
  const px=(e.clientX-rect.left)/rect.width,pz=(e.clientY-rect.top)/rect.height;
  if(px<0||px>1||pz<0||pz>1)return;
  lastMapTapAt=now;lastMapTapX=e.clientX;lastMapTapY=e.clientY;
  if(mode==='inspect'){
   const ix=px*(canvas.width||464),iy=pz*(canvas.height||464);
   const pin=findBattleMapPin(mapInspectionPins,ix,iy,{radius:26});
   if(pin){
    inspectedMapPin={...pin};inspectedBuilding=null;
    $('realtimeMapMessage').textContent='';drawMap();return;
   }
   const building=mapInspectionBuildings.map(b=>({...b,
     distance:Math.hypot(b.px-ix,b.py-iy)})).sort((a,b)=>a.distance-b.distance)[0];
   if(building&&building.distance<=23){
    inspectedBuilding={id:building.id,floor:1};inspectedMapPin=null;
    $('realtimeMapMessage').textContent='建物を選択しました。表示する階を選んでください。';
    drawMap();return;
   }
   $('realtimeMapMessage').textContent='隊番号、または緑の建物マークをタップしてください。';
   return;
  }
  if(mode==='deploy'){
   const ix=px*(canvas.width||464),iy=pz*(canvas.height||464);
   const hit=deploymentTiles.find(tile=>ix>=tile.left&&ix<tile.right&&
    iy>=tile.top&&iy<tile.bottom);
   if(!hit?.legal){
    $('realtimeMapMessage').textContent='赤いマスは配置不可です。青いマスをタップしてください。';
    return;
   }
   chooseMapCell(hit.x,hit.z);return;
  }
  const point=mapPoint(px,pz);chooseMapCell(point.x,point.z);
 }
 canvas.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dragged=pointer.pan;pointer=null;
  if(dragged){drawMap();return;}
  e.preventDefault?.();
  handleMapCanvasTap(e);
 });
 // Some Android WebViews deliver click after a lost pointerup. Never issue
 // the same order twice when both events arrive for a single touch.
 canvas.addEventListener('click',e=>handleMapCanvasTap(e,'click'));
 canvas.addEventListener('pointercancel',()=>{pointer=null;});
 function activateRadarPin(px,py,{strategy=false}={}){
 const pin=radarHitPin(radarPins,px,py);
 if(strategy&&pin){
  if(pin.team===0){
   if(pin.groupId!=null&&typeof onRadarTeamCommand==='function')
    onRadarTeamCommand(pin.groupId,pin.id);
   else showSquadControls(pin.id);
  }else onEnemySelect(pin.id);
  return;
 }
 // Single tap => live 3D overhead camera; double tap => squad strategy.
 if(pin?.team===0)setSelected(pin.id);
 const point=pin||{x:px,y:py};
 onMapOverview({x:Math.round(clamp(point.x*worldSize,0,worldSize-1)),
  z:Math.round(clamp(point.y,0,1)*(worldSize-1))});
}
$('realtimeRadarTitle').onclick=()=>{
 if(!started){openMap('deploy');return;}
 onMapOverview({x:Math.round(worldSize/2),z:Math.round(worldSize/2)});
};
$('realtimeRadarExpand').onclick=()=>openMap(started?'inspect':'deploy');
radarCanvas.addEventListener('click',event=>{
 if(!started){openMap('deploy');return;}
 const rect=radarCanvas.getBoundingClientRect();
 if(rect.width>0&&rect.height>0)
  activateRadarPin((event.clientX-rect.left)/rect.width,
   (event.clientY-rect.top)/rect.height,{strategy:event.detail>=2});
});
radarCanvas.addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 event.preventDefault();
 if(!started){openMap('deploy');return;}
 const pin=radarPins.find(p=>p.team===0&&p.id===String(selectedId))||
  radarPins.find(p=>p.team===0);
 if(pin)activateRadarPin(pin.x,pin.y,{strategy:event.shiftKey});
 else onMapOverview({x:Math.round(worldSize/2),z:Math.round(worldSize/2)});
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
   if(button.dataset.attackOrigin==='dock'){
    pendingStrategy={command,attackKind:kind};
    $('realtimeSkillStep').textContent='② '+button.textContent+
     (battleAttackNeedsEnemy(kind)?'：攻撃する敵隊を選んでください':'：確定してください');
    refreshMoveTargetChoices();
   }
   else preferredActions.set(id,'attack_'+kind);
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
    $('realtimeDockAttackChoices').hidden=true;
    $('realtimeSelectedState').textContent='攻撃方法を選択しました。指定可能な敵隊を選んで確定してください。';
    renderActionSelection();
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
 // Live movement is now chosen through a person, object or map-position target.
 $('realtimeMapClose').onclick=closeMap;
 $('realtimeDockClose').onclick=closeSquadControls;
 $('realtimeCharge').onclick=()=>{
  hideContextChoices();pendingStrategy=null;
  $('realtimeSkillStep').textContent='① 攻撃方法を選択してください';
  $('realtimeDockAttackChoices').hidden=false;
  refreshMoveTargetChoices();renderActionSelection();
 };
 $('realtimeSupport').onclick=()=>showSupportChoices('dock');
 $('realtimeMapManageItems').onclick=()=>{
  const targetId=String(selectedId||'');
  if(mode==='deploy')return;
  closeMap();closeSquadControls();onManageItems(targetId);
 };
 $('realtimeManageItems').onclick=()=>{
  const targetId=String(selectedId||'');
  closeSquadControls();onManageItems(targetId);
 };
 $('realtimeTargetKind').onchange=()=>{refreshMoveTargetChoices();};
 $('realtimeTargetChoice').onchange=()=>{
  const chosen=selectedMovementTarget();
  $('realtimeTargetMessage').textContent=chosen?
   '選択した敵隊：'+String(chosen.label||chosen.id)+'。確定で作戦を実行します。':
   '攻撃する敵隊を選択してください';
  renderActionSelection();
 };
 $('realtimeInlineTargetMap').addEventListener('click',event=>{
  const canvas=$('realtimeInlineTargetMap'),rect=canvas.getBoundingClientRect();
  const span=worldSize/targetZoom;
  const minX=clamp(targetCenterX-span/2,0,worldSize-span);
  const minZ=clamp(targetCenterZ-span/2,0,worldSize-span);
  const point=battleMapCell(event.clientX,event.clientY,rect,{
   worldSize,zoom:targetZoom,centerX:minX+span/2,centerZ:minZ+span/2
  });
  if(!point)return;
  targetPoint=point;
  $('realtimeTargetMessage').textContent='位置 X'+point.x+' / Z'+point.z+' を選択';
  paintInlineTargetMap();
 });
 for(const [id,amount] of [['realtimeInlineZoomIn',1.6],['realtimeInlineZoomOut',1/1.6]])
  $(id).onclick=()=>{targetZoom=clamp(targetZoom*amount,1,6);paintInlineTargetMap();};
 $('realtimeConfirmStrategy').onclick=confirmDockStrategy;
 $('realtimeRallyTarget').onchange=refreshRallyState;
 $('realtimeRallyKind').onchange=refreshRallyState;
 $('realtimeConfirmRally').onclick=confirmInlineRally;
 $('realtimeConfirmItem').onclick=confirmInlineItem;
 $('realtimeTabStrategy').onclick=()=>setDockTab('strategy');
 $('realtimeTabRally').onclick=()=>setDockTab('rally');
 $('realtimeTabFormation').onclick=()=>setDockTab('formation');
 $('realtimeTabItems').onclick=()=>setDockTab('items');
 $('realtimeRally').onclick=()=>showRallyChoices();
 $('realtimeSpecial').onclick=()=>showSpecialChoices('dock');
 $('realtimeThiefUnlock').onclick=()=>{
  const action=battleJobSpecialActions(getSelected()?.job).find(entry=>entry.id==='unlock_door');
  if(action)showSpecialTargets('dock',action);
 };
 $('realtimeThiefSteal').onclick=()=>{
  const action=battleJobSpecialActions(getSelected()?.job).find(entry=>entry.id==='steal_item');
  if(action)showSpecialTargets('dock',action);
 };
 $('realtimeDefend').onclick=()=>{
  if(String(getSelected()?.job||'').includes('僧侶'))showGuardChoices();
  else issueDockOrder('defend');
 };
 $('realtimeHold').onclick=()=>issueDockOrder('hold');
 function beginBattleWithPlans(){
  if(started)return true;
  const plans={};
  const plannedTeams=typeof getDeploymentTeams==='function'?getDeploymentTeams():squads();
  for(const team of plannedTeams||[]){
   const key=String(team.groupId??team.id);
   const selected=initialTeamPlans.get(key);
   if(requirePrebattleChoices&&(!placedTeams.has(key)||!selected)){
    selectedId=String(team.id);invalidateSquadSnapshot();refreshOptions();
    openMap('deploy');
    deployStep=!placedTeams.has(key)?'placement':'strategy';syncPrebattleScreen();
    $('realtimeMapMessage').textContent='第'+key+'隊：'+
     (!placedTeams.has(key)?'レーダーの味方陣地をタップして配置してください。':'初期作戦を選んでください。');
    return false;
   }
   plans[key]=selected||getInitialTeamPlan(team)?.strategy||'assault';
  }
  const accepted=onStart({initialPlans:plans});
  if(accepted===false){
   $('realtimeMapMessage').textContent='戦闘を開始できません。作戦停止状態を確認してください。';
   return false;
  }
  for(const [group,strategy] of Object.entries(plans))initialTeamPlans.set(group,strategy);
  started=true;mode='live';invalidateSquadSnapshot();hideActionSheet();$('realtimeBattleMapOverlay').hidden=true;
  $('realtimeRadarExpand').textContent='⛶ 地図';
  $('realtimeRadarExpand').setAttribute('aria-label','戦場マップを拡大して隊の状態を確認');
  $('realtimeRadarSetupPrompt').hidden=true;
  $('realtimeBattleDock').hidden=true;$('realtimeSquadRadar').hidden=false;
  renderStatus();drawRadar(true);return true;
 }
 $('realtimeStart').onclick=()=>{
  if(started||mode!=='deploy'){beginBattleWithPlans();return;}
  const own=squads(),selected=getSelected(),key=String(selected?.groupId??selected?.id??'');
  if(deployStep==='placement'){
   if(!placedTeams.has(key)){
    $('realtimeMapMessage').textContent='初期位置を確認し、水色の配置可能マスから変更してください。';
    return;
   }
   deployStep='strategy';syncPrebattleScreen();
   $('realtimeMapMessage').textContent='初期作戦を選択し、次の隊へ進んでください。';
   return;
  }
  if(!initialTeamPlans.get(key)){
   $('realtimeMapMessage').textContent='この隊の初期作戦を選択してください。';
   return;
  }
  const next=own.find(team=>{
   const id=String(team.groupId??team.id);
   return !placedTeams.has(id)||!initialTeamPlans.get(id);
  });
  if(next){
   const nextKey=String(next.groupId??next.id);
   deployStep=placedTeams.has(nextKey)?'strategy':'placement';
   setSelected(next.id);syncPrebattleScreen();
   $('realtimeMapMessage').textContent='第'+nextKey+'隊：'+
    (deployStep==='placement'?'地図で配置先を選択してください。':'初期作戦を選択してください。');
   return;
  }
  beginBattleWithPlans();
 };
 $('realtimeRoster')?.addEventListener('click',()=>onRoster());
 $('realtimeMenu').onclick=()=>{closeSquadControls();onMenu();};
 const commandWizard=mountBattleCommandWizard({
  documentRef:doc,dock:$('realtimeBattleDock'),worldSize,
  getSquads:squads,getEnemies,getSelected,selectSquad:setSelected,
  getMapBackground,getLegalPoint,getMoveTargets,getSpecialTargets,getSharedItems,getRallyInfo,
  onMove,onOrder,onTargetOrder,onSpecial,onSharedItem,onRally,onCommandCommitted,getOrderState,
  queueArrival:(id,entry)=>arrivalActions.set(String(id),entry),
  cancelArrival:id=>arrivalActions.delete(String(id)),
  setPreferred:(id,action)=>preferredActions.set(String(id),action),
  onClose:closeSquadControls
 });
 $('realtimePrebattleMusic').onclick=()=>{
  const result=onPrebattleMusic();
  $('realtimePrebattleMusic').textContent='♪ BGM再生を要求しました';
  if(result?.catch)result.catch(()=>{$('realtimePrebattleMusic').textContent='♪ もう一度タップしてBGM再生';});
 };
 // Custom buttons do not invoke the system picker on mobile.
 $('realtimeInitialStrategyChoices').addEventListener('click',event=>{
  const button=event.target.closest?.('button[data-prebattle-strategy]');
  if(!button||started||mode!=='deploy')return;
  $('realtimeInitialStrategy').value=button.dataset.prebattleStrategy;
  $('realtimeInitialStrategy').onchange?.();
  refreshOptions();
 });
 $('realtimeInitialStrategyPager').addEventListener('click',event=>{
  const button=event.target.closest?.('button[data-prebattle-strategy-page]');
  if(!button||button.disabled||started||mode!=='deploy')return;
  const group=String(getSelected()?.groupId??getSelected()?.id??'1');
  prebattleStrategyPageByGroup.set(group,
   Math.max(0,(prebattleStrategyPageByGroup.get(group)||0)+Number(button.dataset.prebattleStrategyPage)));
  refreshOptions();
 });
 $('realtimeInitialStrategy').onchange=()=>{
  const group=getSelected()?.groupId??getSelected()?.id;
  if(group==null||started)return;
  const strategy=$('realtimeInitialStrategy').value;
  const allowed=getInitialTeamPlan(getSelected())?.allowedStrategies||[];
  if(!allowed.includes(strategy)){
   $('realtimeMapMessage').textContent='この隊の陣形・ジョブでは選択できません。';
   refreshOptions();return;
  }
  initialTeamPlans.set(String(group),strategy);
  $('realtimeMapMessage').textContent='第'+group+'隊：「'+(PREBATTLE_TACTIC_NAMES[strategy]||strategy)+'」を初期作戦に設定しました。';
 };
 // Pause is controlled by entering/leaving the squad planning dock.
 return {
  openDeployment(){started=false;mode='deploy';deployStep='placement';exitPlanning();commandWizard.reset();planningOwnsPause=false;
   initialTeamPlans.clear();placedTeams.clear();
   // Real units already spawned at valid home positions: commit these as
   // defaults so a player can start without manually tapping three tiles.
   const teams=typeof getDeploymentTeams==='function'?getDeploymentTeams():getSquads();
   for(const team of teams||[]){
    const key=String(team.groupId??team.id),preset=getInitialTeamPlan(team)||{};
    const allowed=Array.isArray(preset.allowedStrategies)&&preset.allowedStrategies.length?
     preset.allowedStrategies:['assault','defense','balanced','explore'];
    const initial=allowed.includes(preset.strategy)?preset.strategy:allowed[0];
    if(initial)initialTeamPlans.set(key,initial);
    if(Number.isFinite(team.x)&&Number.isFinite(team.z)&&canDeploy(team.x,team.z))
     placedTeams.add(key);
   }
   deploymentActions.clear();arrivalActions.clear();preferredActions.clear();
   invalidateSquadSnapshot();$('realtimeBattleDock').hidden=true;
   // Open the full positioning screen immediately. Initial teams are visible
   // and playable without an extra radar tap or preliminary splash page.
   $('realtimeBattleMapOverlay').hidden=true;inspectedMapPin=null;
   $('realtimeSquadRadar').hidden=false;
   $('realtimeRadarSetupPrompt').hidden=true;
   refreshOptions();
   try{Promise.resolve(onPrebattleMusic()).catch(()=>{});}catch{} // Android may require the first touch.
   openMap('deploy');
   $('realtimeMapClose').hidden=true;
   $('realtimeMapMessage').textContent='✅ 推奨位置に配置済み。水色のマスをタップして調整するか、そのまま次へ進めます。';
  },
  selectSquad:setSelected,
  showSquadControls,
  closeSquadControls,
  get controlsOpen(){return !$('realtimeBattleDock').hidden;},
  get commandCategory(){return dockTab;},
  openMove(){return false;}, // Live movement must be tied to an action and target.
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
     if(entry.highGroundTarget!=null){
      const height=getOrderState(id)||{};
      if(!height.highGroundArrived||
       String(height.highGroundTarget)!==String(entry.highGroundTarget))continue;
     }else{
      if(!Number.isFinite(own.x)||!Number.isFinite(own.z))continue;
      if(Math.hypot(own.x-entry.point.x,own.z-entry.point.z)>3.5)continue;
     }
     // Arrival executes the action already authorized with this movement order.
     const accepted=entry.itemId?onUseItem(id,entry.itemId,true):
      entry.special?onSpecial(id,entry.special,entry.targetId,true):
      onOrder(id,entry.command,true);
     if(accepted)arrivalActions.delete(id);
    }
   }
   if(started&&!getPaused())commandWizard.tick();
   renderStatus();refreshMissionNotice();refreshOrderNotice();
   if(started&&!$('realtimeBattleDock').hidden){
    if(dockTab==='rally')refreshRallyState();
    if(dockTab==='items')refreshInlineItems();
   }
   if(started)drawRadar();
   if(planningDeadline)updatePlanningCountdown();
   // No physical positions change while initial deployment is paused.
   // Live map pins need only about 3 updates/sec, never every UI tick.
   if((mode==='move'||mode==='inspect')&&!$('realtimeBattleMapOverlay').hidden&&
      nowMs()-lastMapRedrawAt>=330)scheduleMapDraw();
  },
  get started(){return started;},
  get selectedId(){return selectedId;},
  get mode(){return mode;},
  get queuedArrivalActions(){return [...arrivalActions.keys()]},
  getQueuedOrder:id=>commandWizard.queuedOrder(id),
  getQueuedError:id=>commandWizard.queuedError(id),
  queueSpecialArrival:(id,special,targetId,point)=>arrivalActions.set(String(id),{
   special,targetId:String(targetId),point:{x:point.x,z:point.z}
  }),
  get deploymentActions(){return [...deploymentActions.keys()]},
  get preferredActions(){return [...preferredActions.entries()]},
  get isMapOpen(){return !$('realtimeBattleMapOverlay').hidden;},
  get planningSeconds(){return planningDeadline?Math.max(0,Math.ceil((planningDeadline-nowMs())/1000)):null;},
  get radarPins(){return [...radarPins];},
  root,dispose(){exitPlanning();commandWizard.dispose();root.remove();}
 };
}
