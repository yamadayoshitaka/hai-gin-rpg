/**
 * Compact battle plan: family -> objective -> specific execution.
 * Multiple methods can be combined and physical squads are shared without duplication.
 */
import {STRATEGY_TREE,STRATEGY_METHODS} from './three-step-strategy-catalog.js';
export const TARGETED_STRATEGY_KINDS=Object.freeze({
 charge:{label:'攻撃',type:'enemy'},defend:{label:'守備',type:'map'},
 hold:{label:'待機',type:'map'},retreat:{label:'退却',type:'map'},
 support:{label:'支援',type:'map'},explore:{label:'探索',type:'object'},
 destroy:{label:'破壊',type:'object'},weaken:{label:'弱体',type:'enemy'}
});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const button=(attr,label,active=false,disabled=false)=>'<button type="button" '+attr+' class="'+(active?'active':'')+'" '+(disabled?'disabled':'')+'>'+esc(label)+'</button>';
export function planStrategyDistribution(plan,selectedSquads,methodIds){
 const squadById=new Map((plan?.squads||[]).map(s=>[String(s.id),s]));
 const methods=[...new Set(methodIds)].map(id=>STRATEGY_METHODS[id]).filter(Boolean);
 const allocations=methods.map(m=>({method:m,squadIds:[]}));
 const unmatched=[];
 for(const id of selectedSquads){
  const squad=squadById.get(String(id));
  if(!squad)continue;
  const possible=allocations.filter(x=>(squad.allowed||plan?.allowed||[]).includes(x.method.mode)&&
   (!x.method.jobs.length||x.method.jobs.some(job=>(squad.jobs||[]).includes(job)))&&
   (!x.method.requiresSummon||squad.hasSummon));
  if(!possible.length){unmatched.push(String(id));continue;}
  possible.sort((a,b)=>a.squadIds.length-b.squadIds.length);
  possible[0].squadIds.push(String(id));
 }
 const total=allocations.reduce((n,x)=>n+x.squadIds.length,0);
 const rows=allocations.filter(x=>x.squadIds.length).map(x=>({...x,soldiers:x.squadIds.reduce((n,id)=>n+Math.max(1,Number(squadById.get(id)?.soldiers)||1),0)}));
 const totalSoldiers=rows.reduce((n,x)=>n+x.soldiers,0);
 let running=0;
 return {total,totalSoldiers,unmatched,rows:rows.map((x,i)=>{
  const percent=i===rows.length-1?100-running:Math.round(x.soldiers/totalSoldiers*100);
  running+=percent;return {...x,percent};
 })};
}
/**
 * The authoritative pause-and-command controller. No side menus or separate
 * map picker: scope -> tactic category -> purpose -> method -> target -> confirm.
 * The DOM renders one step at a time and owns the enlarged existing radar.
 */
export function createTargetedStrategyUi({
 getPlan,getEnemyTargets,getObjects,onExecute,onMapRequest,
 getAllyTargets=()=>[],getRadarTargets=()=>[],
 onMapPick=()=>false,getRadarCanvas=()=>null,getMapSize=()=>232,
 getItems=()=>[],getTemplates=()=>[],onItemExecute=()=>false,onOpen=()=>{},onClose=()=>{}
}){
 const panel=document.createElement('section');
 panel.id='targetedStrategyPanel';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 panel.setAttribute('aria-label','戦闘停止中の中央作戦指示');
 document.body.append(panel);
 let groupId='1',scope='group',step='scope',family='attack',intent='melee';
 let selectedSquads=new Set(),selectedMethods=new Set(),selectedTargets=new Set(),
  chosenItem=null,mapPoint=null,error='',preferredSquad=null;
 let radarHotspots=[];
 const b=(attr,label,active=false,disabled=false)=>button(attr,label,active,disabled);
 const planFor=(id=groupId)=>getPlan(String(id))||{squads:[],allowed:[]};
 const liveSquads=(p=planFor())=>(p.squads||[]).filter(s=>Number(s.soldiers)>0);
 const grouped=()=>[1,2,3].map(id=>({id,plan:planFor(id)}));
 const allSquadGroups=()=>grouped().flatMap(g=>liveSquads(g.plan).map((s,i)=>({
  ...s,id:String(s.id),groupId:g.id,rank:i+1
 })));
 const groupSummary=g=>{
  const jobs=new Map();
  for(const s of liveSquads(g.plan)){
   const job=String(s.job||s.label||'兵士').replace(/^.*・/,'').replace(/隊$/,'');
   jobs.set(job,(jobs.get(job)||0)+Number(s.soldiers||0));
  }
  return [...jobs].sort((a,b)=>b[1]-a[1]).slice(0,2)
   .map(([job,count])=>job+count+'人').join('・')||'未編成';
 };
 const groupColor=id=>({'1':'#59dcfa','2':'#c7a0ff','3':'#93e5a1'}[String(id)]||'#59dcfa');
 const available=()=>Object.values(STRATEGY_METHODS).filter(m=>
  [...selectedSquads].some(sid=>{
   const s=liveSquads().find(x=>String(x.id)===String(sid));
   return s&&(s.allowed||planFor().allowed||[]).includes(m.mode)&&
    (!m.jobs.length||m.jobs.some(job=>(s.jobs||[]).includes(job)))&&
    (!m.requiresSummon||s.hasSummon);
  }));
 const type=()=>{const t=new Set([...selectedMethods].map(id=>STRATEGY_METHODS[id]?.type).filter(Boolean));return t.size===1?[...t][0]:t.size>1?'mixed':null};
 const distribution=()=>planStrategyDistribution(planFor(),[...selectedSquads],[...selectedMethods]);
 // Every command exposes only targets which can execute that mode.
 // A destroy command must not advertise treasure chests, for example.
 const targets=()=>{
  if(type()==='enemy')return getEnemyTargets();
  if(type()!=='object')return [];
  const modes=[...new Set([...selectedMethods].map(id=>STRATEGY_METHODS[id]?.mode)
   .filter(mode=>mode==='explore'||mode==='destroy'))];
  return [...new Map(modes.flatMap(mode=>getObjects(mode)).map(x=>[String(x.id),x])).values()];
 };
 const allyTargets=()=>getAllyTargets().filter(t=>liveSquads(grouped().find(g=>
   String(g.id)===String(t.groupId))?.plan||{}).some(s=>String(s.id)===String(t.id)));
 const selectableRadarTargets=()=>{
  if(step==='scope'){
   const details=new Map(getAllyTargets().map(x=>[String(x.id),x]));
   return allSquadGroups().map(s=>({...details.get(String(s.id)),...s,
    team:'ally',label:'第'+s.groupId+'班 '+(s.label||details.get(String(s.id))?.label||'味方分隊')}));
  }
   if(chosenItem)return allyTargets();
  return targets();
 };
 const stepText={scope:'① 指示する単位',family:'② 作戦を選択',intent:'③ 目的を選択',method:'④ 実行方法を選択',target:'⑤ 対象を選択',confirm:'⑥ 作戦内容の確認',items:'③ アイテムを選択'};
 const controls=(back,next,nextLabel='次へ',disable=false)=>
  '<div class="centerActions">'+b('data-strategy-back',back)+
  b('data-strategy-next',nextLabel,false,disable)+'</div>';
 function render(){
  if(panel.hidden)return;
  const plan=planFor(),skills=available(),eligible=new Set(skills.map(x=>x.id));
  const dist=distribution(),kind=type(),groupInfo=grouped(),activeMethod=[...selectedMethods].map(id=>STRATEGY_METHODS[id]).filter(Boolean);
  let html='';
  if(step==='scope'){
   html='<div class="centerStep">① 班単位か個別の作戦を選択</div>'+
    '<div class="centerScopeGrid">'+b('data-strategy-scope="group"','🛡 班単位の作戦',scope==='group')+
    b('data-strategy-scope="squad"','⚔ 個別の作戦（分隊）',scope==='squad')+'</div>'+
    '<div class="centerStep">指示する班（色・職業・人数で識別）</div><div class="centerGrid centerGroupCards">'+groupInfo.map(g=>
     b('data-strategy-group="'+g.id+'"','● 第'+g.id+'班 · '+liveSquads(g.plan).reduce((n,x)=>n+Number(x.soldiers||0),0)+'人 / '+
      liveSquads(g.plan).length+'分隊 / '+groupSummary(g),
       String(g.id)===String(groupId),!liveSquads(g.plan).length)).join('')+'</div>'+
    '<div class="centerStep">'+(scope==='squad'?'味方レーダーで分隊を選択':'味方の点をタップして班を切替')+'</div>'+
    radarMarkup(scope==='squad'?'別の班もタップして切り替えられます':'色と数字で班を選択')+
    (scope==='squad'?'<div class="centerSquadGrid">'+liveSquads(plan).map(s=>b('data-strategy-squad="'+esc(s.id)+'"',
       '第'+groupId+'班 '+s.label+' · '+s.soldiers+'人',selectedSquads.has(String(s.id)))).join('')+'</div>':
       '<small class="centerHelp">選択班の全分隊へ指示します。実行可能な職業だけが行動します。</small>')+
     controls('キャンセル','次へ','作戦を選ぶ',!selectedSquads.size);
  }else if(step==='family'){
   const recommended=getTemplates(String(groupId)).filter(x=>STRATEGY_METHODS[x.methodId]);
   html='<div class="centerStep">② 戦場に合う宿屋テンプレート</div>'+
    '<div class="centerBattleRecommendations">'+recommended.slice(0,5).map((x,i)=>
      b('data-strategy-template="'+esc(x.id)+'"',(i===0?'★ 推奨 ':'')+x.name+
      ' · 適合'+x.score+'/100'+(x.reason?' · '+x.reason:''),false,!eligible.has(x.methodId))).join('')+
    (recommended.length?'':'<small class="centerHelp">利用できるテンプレートなし。通常作戦を選択してください。</small>')+
    '</div><div class="centerStep">または作戦の系統を選択</div><div class="centerGrid">'+
    Object.entries(STRATEGY_TREE).map(([id,x])=>b('data-strategy-family="'+id+'"',x.name,
     family===id,!Object.values(x.intents).some(y=>y.methods.some(m=>eligible.has(m.id))))).join('')+
    b('data-strategy-family="item"','🎒 アイテム',false,!getItems().length)+'</div>'+
    '<small class="centerHelp">突撃なら敵部隊、守備・退却なら大型レーダー、探索ならオブジェクトを選びます。</small>'+
    controls('◀ 指示単位へ戻る','次へ','目的を選ぶ',false);
  }else if(step==='intent'){
   const entries=STRATEGY_TREE[family]?.intents||{};
   html='<div class="centerStep">③ '+esc(STRATEGY_TREE[family]?.name)+'：目的を選択</div><div class="centerGrid">'+
    Object.entries(entries).map(([id,x])=>b('data-strategy-intent="'+id+'"',x.name,
      intent===id,!x.methods.some(m=>eligible.has(m.id)))).join('')+'</div>'+
    controls('◀ 作戦へ戻る','次へ','実行方法へ',false);
  }else if(step==='method'){
   const entry=STRATEGY_TREE[family]?.intents[intent];
   html='<div class="centerStep">④ '+esc(entry?.name||'')+'：実行方法を選択</div>'+
    '<div class="centerGrid">'+(entry?.methods||[]).map(m=>
      b('data-strategy-method="'+m.id+'"',(selectedMethods.has(m.id)?'☑ ':'□ ')+m.name,
      selectedMethods.has(m.id),!eligible.has(m.id))).join('')+'</div>'+
    '<small class="centerHelp">複数方法を選択できます。ただし敵・地点・オブジェクトは種類ごとに別の指示となります。</small>'+
    '<div class="centerShares">'+dist.rows.map(x=>'<div><span>'+esc(x.method.name)+' · '+x.soldiers+'人</span><b>'+x.percent+'%</b></div>').join('')+'</div>'+
    controls('◀ 目的へ戻る','次へ','対象を選ぶ',!dist.total||kind==='mixed');
  }else if(step==='items'){
   html='<div class="centerStep">③ アイテムを選択</div><div class="centerSquadGrid">'+
    getItems().map(x=>b('data-strategy-item="'+esc(x.id)+'"',x.label+' · '+x.quantity+'個',
     chosenItem===String(x.id),!x.quantity)).join('')+'</div>'+
    '<small class="centerHelp">アイテムは作戦の一種です。使用する味方分隊を対象に選択します。</small>'+
    controls('◀ 作戦へ戻る','次へ','味方対象へ',!chosenItem);
  }else if(step==='target'){
   const isItem=Boolean(chosenItem),typeName=isItem?'ally':kind;
   html='<div class="centerStep">⑤ '+(typeName==='enemy'?'敵部隊を選択（複数可）':
    typeName==='map'?'大型レーダーで地点を選択':
    typeName==='object'?'対象オブジェクトを選択（複数可）':'アイテムを使う味方分隊を選択')+'</div>'+
    radarMarkup(typeName==='enemy'?'🔴 敵部隊の赤いマーカーをタップ（複数可）':
      typeName==='ally'?'🔵 味方分隊の青いマーカーをタップ':
      typeName==='object'?'🟡 オブジェクトをレーダーから選択':
      '🗺 マップ上の地点をタップして指定')+
    (typeName==='map'?'':'<div class="centerTargetGrid" aria-label="レーダーで選択しづらい場合は一覧でも選べます">'+
      selectableRadarTargets().map(x=>b('data-strategy-target="'+esc(x.id)+'"',x.label||'第'+x.id+'分隊',
       selectedTargets.has(String(x.id)))).join('')+'</div>')+
    '<small class="centerHelp">'+(typeName==='enemy'?'複数の敵を選ぶと分隊を割り当てて攻撃します。':
    typeName==='map'?'青＝味方・赤＝敵。タップした地点は確定するまで移動先になりません。':
    typeName==='ally'?'アイテムは1回につき1分隊へ使用します。':'探索・破壊できる対象のみ選択します。')+'</small>'+
    controls('◀ 方法へ戻る','次へ','内容を確認',typeName==='map'?!mapPoint:!selectedTargets.size);
  }else if(step==='confirm'){
   const isItem=Boolean(chosenItem),kindName=isItem?'味方部隊':kind==='enemy'?'敵部隊':
    kind==='object'?'オブジェクト':'マップ地点';
   html='<div class="centerStep">⑥ 作戦の内容を確認</div>'+
    '<div class="centerQuota"><b>第'+esc(groupId)+'班 · '+(scope==='group'?'班全体':'選択した分隊')+'</b>'+
    '<div>実行 '+selectedSquads.size+'分隊 / '+dist.totalSoldiers+'人</div>'+
    '<div>'+(isItem?'🎒 '+esc(getItems().find(x=>String(x.id)===chosenItem)?.label||chosenItem):
      activeMethod.map(m=>esc(m.name)).join('・'))+'</div>'+
    '<div>'+kindName+'：'+(mapPoint?'('+mapPoint.x+', '+mapPoint.z+')':
       [...selectedTargets].map(id=>esc((chosenItem?
       grouped().flatMap(g=>liveSquads(g.plan)):targets()).find(x=>String(x.id)===id)?.label||id)).join('、'))+'</div></div>'+
    '<small class="centerHelp">確定後に指示を発行し、戦闘を再開します。</small>'+
    controls('◀ 対象を選び直す','作戦を実行','✓ 確定して再開',false);
  }
  panel.innerHTML='<div id="targetedStrategyCard"><header><b>⚔ 作戦指示</b>'+
   b('data-strategy-close','✕ 中止')+'</header>'+
   '<div class="centerPauseRibbon">⏸ 戦闘停止中 · 指示を確定するまで兵士と敵は停止します</div>'+
   '<div class="centerTopRow"><span>第'+esc(groupId)+'班</span><span>'+
   (scope==='group'?'班単位':'個別分隊')+'</span><span>'+esc(stepText[step])+'</span></div>'+
   html+(error?'<small class="centerDanger" role="alert">'+esc(error)+'</small>':'')+'</div>';
  if(step==='target'||step==='scope')drawLargeRadar();
 }
 function radarMarkup(hint){
  return '<div class="centerMapBoard"><canvas id="centralCommandMap" width="464" height="464" '+
   'aria-label="拡大戦場レーダー・赤が敵、青が味方、タップで対象選択" role="img"></canvas>'+
   '<small class="centerMapCoords">'+esc(hint)+'</small>'+
   (mapPoint&&type()==='map'?'<small class="centerMapCoords">📍 指定地点 ('+mapPoint.x+', '+mapPoint.z+')</small>':'')+
   '<small class="centerMapLegend"><span class="g1">● 第1班（水色）</span><span class="g2">● 第2班（紫）</span><span class="g3">● 第3班（緑）</span> 🔴 敵　🟡 物　◎ 選択</small>'+
    '<small class="centerMapCoords">数字：班番号-分隊番号（例 2-3＝第2班の第3分隊）</small></div>';
 }
 function drawLargeRadar(){
  const canvas=panel.querySelector('#centralCommandMap'),radar=getRadarCanvas();
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const width=canvas.width,height=canvas.height,size=Math.max(1,Number(getMapSize())||232);
  ctx.fillStyle='#19394c';ctx.fillRect(0,0,width,height);
  if(radar)ctx.drawImage(radar,0,0,width,height);
  const options=selectableRadarTargets(),eligible=new Set(options.map(x=>String(x.id)));
  const allyMeta=new Map(allSquadGroups().map(x=>[String(x.id),x]));
  const enemyMeta=new Map(getEnemyTargets().map((x,i)=>[String(x.id),i+1]));
  const side=step==='scope'||chosenItem?'ally':type()==='enemy'?'enemy':type()==='object'?'object':'none';
  const radarAll=[...getRadarTargets(),...options.map(x=>({...x,team:x.team??side}))];
  const combined=[...new Map(radarAll.map(x=>[String(x.team??'object')+':'+String(x.id),x])).values()];
  const placements=[],hotspots=[];
  for(const t of combined){
   const group=String(t.team??(chosenItem?'ally':type()==='enemy'?'enemy':'object'));
   const x=Number(t.x),z=Number(t.z);
   if(!Number.isFinite(x)||!Number.isFinite(z))continue;
   let px=Math.max(15,Math.min(width-15,x/size*width));
   let py=Math.max(15,Math.min(height-15,z/size*height));
   const baseX=px,baseY=py;
   // Spread overlapping markers but draw a subtle connector to their real location.
   for(let ring=0;ring<=4;ring++){
    const candidateCount=ring?ring*10:1;let placed=false;
    for(let j=0;j<candidateCount;j++){
     const angle=j*Math.PI*2/candidateCount;
     const ox=baseX+Math.cos(angle)*ring*22,oy=baseY+Math.sin(angle)*ring*22;
     if(ox<14||ox>width-14||oy<14||oy>height-14)continue;
     if(placements.every(p=>Math.hypot(ox-p.x,oy-p.y)>=25)){
      px=ox;py=oy;placed=true;break;
     }
    }
    if(placed)break;
   }
   placements.push({x:px,y:py});
   const selectable=eligible.has(String(t.id))&&(
    step==='scope'?group==='ally':
    chosenItem?group==='ally':
    type()==='enemy'?group==='enemy':
    type()==='object'?group==='object':false);
   const meta=allyMeta.get(String(t.id));
   const selected=selectable&&(step==='scope'?(scope==='group'?
     String(meta?.groupId)===String(groupId):selectedSquads.has(String(t.id))):selectedTargets.has(String(t.id)));
   const color=group==='enemy'?'#f56d6e':group==='ally'?groupColor(meta?.groupId??t.groupId):'#f6cd75';
   if(Math.hypot(px-baseX,py-baseY)>4){
    ctx.strokeStyle='#a8c5d788';ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(baseX,baseY);ctx.lineTo(px,py);ctx.stroke();
   }
   ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,selectable?13:9,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=selected?'#fff6bc':selectable?'#edf8ff':'#173041';
   ctx.lineWidth=selected?5:2;ctx.beginPath();ctx.arc(px,py,selected?16:selectable?14:10,0,Math.PI*2);ctx.stroke();
   const n=group==='enemy'?'敵'+(enemyMeta.get(String(t.id))||''):
    group==='ally'?(meta?meta.groupId+'-'+meta.rank:'味'):'物';
   ctx.fillStyle='#09202d';ctx.font='bold 10px system-ui';ctx.textAlign='center';
   ctx.textBaseline='middle';ctx.fillText(n,px,py);
   if(selectable)hotspots.push({id:String(t.id),groupId:meta?.groupId,
    x:px,y:py,team:group,radius:21});
   if(selected&&group==='ally'&&meta&&scope==='squad'){
    const name='第'+meta.groupId+'班 '+String(meta.job||meta.label||'分隊').replace(/^.*・/,'');
    ctx.font='bold 11px system-ui';
    const labelW=Math.min(width-12,Math.max(72,name.length*11+12));
    const lx=Math.min(width-labelW-3,Math.max(3,px-labelW/2));
    const ly=py<height-34?py+19:py-34;
    ctx.fillStyle='#091b2eea';ctx.fillRect(lx,ly,labelW,16);
    ctx.fillStyle='#fff5d1';ctx.fillText(name,lx+labelW/2,ly+8);
   }
   }
  radarHotspots=hotspots;
  if(mapPoint&&type()==='map'){
   const x=mapPoint.x/size*width,y=mapPoint.z/size*height;
   ctx.strokeStyle='#ffe08a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.moveTo(x-18,y);ctx.lineTo(x+18,y);ctx.moveTo(x,y-18);ctx.lineTo(x,y+18);ctx.stroke();
  }
 }
 function selectGroup(id){
  groupId=String(id);selectedSquads=new Set();
  const all=liveSquads();
  if(scope==='group')all.forEach(s=>selectedSquads.add(String(s.id)));
  else{
   const found=all.find(x=>String(x.id)===preferredSquad)||all[0];
   if(found)selectedSquads.add(String(found.id));
  }
 }
 function open(id=null,{squadId=null}={}){
  if(!panel.hidden)return;
  const first=grouped().find(g=>liveSquads(g.plan).length);
  if(!first)return false;
  groupId=String(id&&liveSquads(planFor(id)).length?id:first.id);
  scope=squadId==null?'group':'squad';preferredSquad=squadId==null?null:String(squadId);
  selectGroup(groupId);step='scope';family='attack';intent='melee';
  selectedMethods=new Set();selectedTargets=new Set();chosenItem=null;mapPoint=null;error='';
  if(onOpen()===false)return false;
  panel.hidden=false;render();return true;
 }
 function close(){
  if(panel.hidden)return;
  panel.hidden=true;selectedMethods.clear();selectedTargets.clear();mapPoint=null;
  onClose();
 }
 function back(){
  error='';
  if(step==='scope'){close();return;}
  step={family:'scope',intent:'family',method:'intent',items:'family',target:chosenItem?'items':'method',confirm:'target'}[step]||'scope';
  render();
 }
 function next(){
  error='';
  if(step==='scope'){if(!selectedSquads.size){error='生存する部隊を選択してください';render();return;}step='family';}
  else if(step==='family'){step='intent';}
  else if(step==='intent'){step='method';}
  else if(step==='items'){if(!chosenItem){error='アイテムを選択してください';}else step='target';}
  else if(step==='method'){
   if(!distribution().total){error='実行方法と実行可能な分隊が必要です';}
   else if(type()==='mixed')error='敵・地図・オブジェクトへの指示は分けて実行してください';
   else{selectedTargets.clear();mapPoint=null;step='target';}
  }else if(step==='target'){
   if((chosenItem||type()!=='map')&&!selectedTargets.size)error='作戦対象を選択してください';
   else if(type()==='map'&&!mapPoint)error='レーダー上で地点を選択してください';
   else step='confirm';
  }else if(step==='confirm'){execute();return;}
  render();
 }
 function execute(){
  const shares=distribution(),kind=type();
  if(chosenItem){
   const recipient=[...selectedTargets][0];
   const issuer=[...selectedSquads][0];
   const result=onItemExecute({groupId,issuerSquadId:issuer,targetSquadId:recipient,itemId:chosenItem});
   if(result===true){close();return;}
   error=String(result||'アイテムを使えませんでした');render();return;
  }
  if(!shares.total||kind==='mixed'||!kind){error='対応する部隊と方法を確認してください';render();return;}
  if(kind==='map'){
   const payload={groupId,mode:shares.rows[0].method.mode,
    plans:shares.rows.map(x=>({mode:x.method.mode,tacticId:x.method.id,squadIds:x.squadIds})),
    squadIds:[...new Set(shares.rows.flatMap(x=>x.squadIds))]};
   const accepted=onMapRequest(payload);
   if(accepted!==true){error=String(accepted||'地点指示を開始できません');render();return;}
   const result=onMapPick(mapPoint);
   if(result===true){close();return;}
   error=String(result||'その地点には指示できません');render();return;
  }
  let completed=0;const failed=[];
  for(const row of shares.rows){
   const result=onExecute({groupId,mode:row.method.mode,tacticId:row.method.id,
    squadIds:row.squadIds,targetIds:[...selectedTargets]});
   if(result===true)completed++;else failed.push(row.method.name+'：'+String(result||'実行不可'));
  }
  if(completed===shares.rows.length){close();return;}
  error='実行 '+completed+'/'+shares.rows.length+'種。'+failed.join('／');render();
 }
 panel.addEventListener('click',event=>{
  const t=event.target.closest('button');if(!t||t.disabled)return;
  if(t.hasAttribute('data-strategy-close')){close();return;}
  if(t.hasAttribute('data-strategy-back')){back();return;}
  if(t.hasAttribute('data-strategy-next')){next();return;}
  if(t.hasAttribute('data-strategy-scope')){
   scope=t.dataset.strategyScope;selectGroup(groupId);
  }else if(t.hasAttribute('data-strategy-group')){selectGroup(t.dataset.strategyGroup);}
  else if(t.hasAttribute('data-strategy-template')){
   const chosen=getTemplates(String(groupId)).find(x=>String(x.id)===String(t.dataset.strategyTemplate));
   if(!chosen||!eligible.has(chosen.methodId)){error='この班ではテンプレートの作戦を実行できません';render();return;}
   const chosenBranch=Object.entries(STRATEGY_TREE).flatMap(([f,x])=>
    Object.entries(x.intents).map(([intent,y])=>({f,intent,methods:y.methods})))
    .find(x=>x.methods.some(m=>m.id===chosen.methodId));
   if(!chosenBranch){error='テンプレートの作戦が見つかりません';render();return;}
   family=chosenBranch.f;intent=chosenBranch.intent;selectedMethods=new Set([chosen.methodId]);
   selectedTargets.clear();mapPoint=null;chosenItem=null;step='method';
  }
  else if(t.hasAttribute('data-strategy-squad')){
   const id=String(t.dataset.strategySquad);selectedSquads=new Set([id]);preferredSquad=id;
  }else if(t.hasAttribute('data-strategy-family')){
   if(t.dataset.strategyFamily==='item'){chosenItem=null;selectedTargets.clear();step='items';}
   else{family=t.dataset.strategyFamily;intent=Object.keys(STRATEGY_TREE[family].intents)[0];step='intent';selectedMethods.clear();}
  }else if(t.hasAttribute('data-strategy-intent')){
   intent=t.dataset.strategyIntent;step='method';selectedMethods.clear();
  }else if(t.hasAttribute('data-strategy-method')){
   const id=t.dataset.strategyMethod;
   if(selectedMethods.has(id))selectedMethods.delete(id);else selectedMethods.add(id);
  }else if(t.hasAttribute('data-strategy-item')){
   chosenItem=String(t.dataset.strategyItem);selectedTargets.clear();step='target';
  }else if(t.hasAttribute('data-strategy-target')){
   const id=String(t.dataset.strategyTarget);
   if(chosenItem){selectedTargets=new Set([id]);}
   else if(selectedTargets.has(id))selectedTargets.delete(id);else selectedTargets.add(id);
  }
  error='';render();
 });
 panel.addEventListener('pointerup',event=>{
  const canvas=event.target.closest('#centralCommandMap');
  if(!canvas)return;
  if(step!=='target'&&step!=='scope')return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const px=(event.clientX-rect.left)/rect.width*canvas.width,
   py=(event.clientY-rect.top)/rect.height*canvas.height;
  if(step==='target'&&!chosenItem&&type()==='map'){
   const size=Number(getMapSize())||232;
   mapPoint={x:Math.max(0,Math.min(size-1,Math.round(px/canvas.width*size))),
    z:Math.max(0,Math.min(size-1,Math.round(py/canvas.height*size)))};
   error='';render();return;
  }
  const nearest=radarHotspots.map(h=>({...h,distance:Math.hypot(h.x-px,h.y-py)}))
   .filter(h=>h.distance<=h.radius).sort((a,b)=>a.distance-b.distance)[0];
  if(!nearest){error='赤または青の部隊マーカーを直接タップしてください';render();return;}
  if(step==='scope'){
   const source=allSquadGroups().find(s=>String(s.id)===nearest.id);
   if(source&&String(source.groupId)!==String(groupId))selectGroup(source.groupId);
   if(scope==='squad'){selectedSquads=new Set([nearest.id]);preferredSquad=nearest.id;}
  }else if(chosenItem)selectedTargets=new Set([nearest.id]);
  else if(selectedTargets.has(nearest.id))selectedTargets.delete(nearest.id);
  else selectedTargets.add(nearest.id);
  error='';render();
 });
 return {open,close,isOpen:()=>!panel.hidden,currentStep:()=>step};
}
