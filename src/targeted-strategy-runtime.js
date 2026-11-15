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
 const rows=allocations.filter(x=>x.squadIds.length);
 let running=0;
 return {total,unmatched,rows:rows.map((x,i)=>{
  const percent=i===rows.length-1?100-running:Math.round(x.squadIds.length/total*100);
  running+=percent;return {...x,percent};
 })};
}
export function createTargetedStrategyUi({getPlan,getEnemyTargets,getObjects,onExecute,onMapRequest}){
 const panel=document.createElement('section');
 panel.id='targetedStrategyPanel';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','3段階作戦');
 const style=document.createElement('style');
 style.textContent=`#targetedStrategyPanel[hidden]{display:none!important}#targetedStrategyPanel{position:fixed;inset:0;z-index:95;background:#020b19ed;display:grid;place-items:center;padding:7px;color:#f2e6d0;font:12px system-ui,sans-serif}#targetedStrategyCard{width:min(96vw,620px);max-height:94dvh;overflow-y:auto;overscroll-behavior:contain;background:#122b42;border:2px solid #dcc08b;border-radius:11px;padding:9px;display:grid;gap:6px;align-content:start}#targetedStrategyCard header{position:static;display:flex;justify-content:space-between;align-items:center;background:transparent;border:0;padding:0;color:#ffe0a6}#targetedStrategyCard b{font-size:13px}#targetedStrategyCard button{border:1px solid #779ab3;background:#26465d;color:#fcebd4;padding:7px 3px;border-radius:6px;min-width:0;font-size:11px}#targetedStrategyCard button.active{background:#785a30;border-color:#ffe1a1}#targetedStrategyCard button:disabled{opacity:.35}#targetedStrategyCard small{color:#cad9e0;font-size:10px}.targetedStrategyGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.targetedStrategySubGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.targetedStrategyTargetGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.targetedStrategyActions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.targetedStrategyFoot{display:flex;justify-content:space-between;align-items:center;gap:5px}.targetedShares{display:grid;gap:3px;font-size:11px}.targetedShares>div{display:flex;gap:6px;justify-content:space-between}.targetedShares meter{width:46%;height:11px;accent-color:#e0b76a}#targetedStrategyCard .step{color:#ffe2a6}#targetedStrategyCard .quiet{color:#b8cdd9}@media(max-height:620px){#targetedStrategyCard{gap:3px;padding:5px}#targetedStrategyCard button{padding:4px 2px}}`;
 document.head.append(style);document.body.append(panel);
 let groupId=null,family='attack',intent='melee',selectedSquads=new Set(),selectedMethods=new Set(),
  selectedTargets=new Set(),page=0,squadPage=0,error='';
 const availableMethods=(plan)=>Object.values(STRATEGY_METHODS).filter(method=>
  (plan.allowed||[]).includes(method.mode)&&
  (plan.squads||[]).some(s=>(s.allowed||plan.allowed||[]).includes(method.mode)&&
   (!method.jobs.length||method.jobs.some(job=>(s.jobs||[]).includes(job)))));
 function selectedType(){
  const types=new Set([...selectedMethods].map(id=>STRATEGY_METHODS[id]?.type).filter(Boolean));
  return types.size===1?[...types][0]:types.size>1?'mixed':null;
 }
 function options(type){
  if(type==='enemy')return getEnemyTargets();
  if(type==='object')return [...new Map([...getObjects('explore'),...getObjects('destroy')].map(x=>[String(x.id),x])).values()];
  return [];
 }
 function render(){
  if(groupId===null||panel.hidden)return;
  const plan=getPlan(groupId)||{squads:[],allowed:[]};
  const tactics=STRATEGY_TREE[family].intents;
  if(!tactics[intent])intent=Object.keys(tactics)[0];
  const eligible=new Set(availableMethods(plan).map(m=>m.id));
  const current=tactics[intent].methods;
  const distribution=planStrategyDistribution(plan,selectedSquads,[...selectedMethods]);
  const type=selectedType(),targets=options(type),maxPage=Math.max(0,Math.ceil(targets.length/6)-1),
   maxSquadPage=Math.max(0,Math.ceil(plan.squads.length/6)-1);
  page=Math.min(page,maxPage);squadPage=Math.min(squadPage,maxSquadPage);
  panel.innerHTML='<div id="targetedStrategyCard"><header><b>第'+esc(groupId)+'班 · 3段階作戦</b>'+
   button('data-strategy-close','✕ 閉じる')+'</header>'+
   '<b class="step">① 系統を選択</b><div class="targetedStrategyGrid">'+Object.entries(STRATEGY_TREE).map(([id,x])=>
    button('data-strategy-family="'+id+'"',x.name,family===id,!
     Object.values(x.intents).some(y=>y.methods.some(m=>eligible.has(m.id))))).join('')+'</div>'+
   '<b class="step">② 目的を選択</b><div class="targetedStrategyGrid">'+Object.entries(tactics).map(([id,x])=>
    button('data-strategy-intent="'+id+'"',x.name,intent===id,!x.methods.some(m=>eligible.has(m.id)))).join('')+'</div>'+
   '<b class="step">③ 実行方法を複数選択</b><div class="targetedStrategyGrid">'+current.map(m=>
    button('data-strategy-method="'+m.id+'"',(selectedMethods.has(m.id)?'☑ ':'□ ')+m.name,selectedMethods.has(m.id),!eligible.has(m.id))).join('')+'</div>'+
   '<small>選択済 '+selectedMethods.size+'種。別系統へ切替後も選択を保持します。同じ分隊を重複配属しません。</small>'+
   '<div class="targetedStrategyFoot"><b>分隊 '+selectedSquads.size+'/'+plan.squads.length+'</b>'+
   button('data-strategy-all','全分隊')+'</div>'+
   '<div class="targetedStrategySubGrid">'+plan.squads.slice(squadPage*6,squadPage*6+6).map(s=>
    button('data-strategy-squad="'+esc(s.id)+'"',s.label,selectedSquads.has(String(s.id)))).join('')+'</div>'+
   (maxSquadPage?'<div class="targetedStrategyFoot">'+button('data-strategy-squad-page="'+(squadPage-1)+'"','◀ 分隊',false,squadPage===0)+
    '<small>'+(squadPage+1)+'/'+(maxSquadPage+1)+'</small>'+
    button('data-strategy-squad-page="'+(squadPage+1)+'"','次 ▶',false,squadPage===maxSquadPage)+'</div>':'')+
   '<b>兵力配分率（成功率ではありません）</b>'+
   '<div class="targetedShares">'+(distribution.rows.map(x=>
    '<div><span>'+esc(x.method.name)+' · '+x.squadIds.length+'隊</span><meter value="'+x.percent+'" min="0" max="100"></meter><b>'+x.percent+'%</b></div>').join('')||'<small>第③段階の実行方法を選択してください</small>')+'</div>'+
   (distribution.unmatched.length?'<small>職業条件が合わず配属できない分隊：'+distribution.unmatched.length+'隊</small>':'')+
   (type==='map'?'<small>次にレーダー／地面で作戦位置を指定します。</small>':
    type==='mixed'?'<small>敵／オブジェクト／地図の作戦は種類を分けて実行してください。</small>':
    '<b>対象を複数選択</b><div class="targetedStrategyTargetGrid">'+targets.slice(page*6,page*6+6).map(t=>
     button('data-strategy-target="'+esc(t.id)+'"',t.label,selectedTargets.has(String(t.id)))).join('')+'</div>'+
    (maxPage?'<div class="targetedStrategyFoot">'+button('data-strategy-page="'+(page-1)+'"','◀ 対象',false,page===0)+
     '<small>'+(page+1)+'/'+(maxPage+1)+'</small>'+
     button('data-strategy-page="'+(page+1)+'"','次 ▶',false,page===maxPage)+'</div>':''))+
   '<div class="targetedStrategyActions">'+button('data-strategy-reset','選択解除')+
    button('data-strategy-apply',type==='map'?'🗺 マップで位置指定':'作戦を実行',false,!distribution.total||type==='mixed')+'</div>'+
   '<small role="status" style="color:#ffe0a4">'+esc(error||'有効な陣形と対応職業の分隊だけが実行できます。')+'</small></div>';
 }
 function open(id){
  groupId=String(id);const plan=getPlan(groupId)||{squads:[],allowed:[]};
  selectedSquads=new Set(plan.squads.map(x=>String(x.id)));selectedMethods.clear();
  selectedTargets.clear();family='attack';intent='melee';page=0;squadPage=0;error='';panel.hidden=false;render();
 }
 function close(){panel.hidden=true;groupId=null;selectedMethods.clear();selectedTargets.clear();}
 panel.addEventListener('click',event=>{
  const t=event.target.closest('button');if(!t)return;
  if(t.hasAttribute('data-strategy-close')){close();return;}
  if(t.hasAttribute('data-strategy-family')){family=t.dataset.strategyFamily;intent=Object.keys(STRATEGY_TREE[family].intents)[0];}
  else if(t.hasAttribute('data-strategy-intent'))intent=t.dataset.strategyIntent;
  else if(t.hasAttribute('data-strategy-method')){
   const id=t.dataset.strategyMethod;
   if(selectedMethods.has(id))selectedMethods.delete(id);else selectedMethods.add(id);
   page=0;selectedTargets.clear();
  }else if(t.hasAttribute('data-strategy-squad')){
   const id=t.dataset.strategySquad;if(selectedSquads.has(id))selectedSquads.delete(id);else selectedSquads.add(id);
  }else if(t.hasAttribute('data-strategy-target')){
   const id=t.dataset.strategyTarget;if(selectedTargets.has(id))selectedTargets.delete(id);else selectedTargets.add(id);
  }else if(t.hasAttribute('data-strategy-page'))page=Math.max(0,Number(t.dataset.strategyPage)||0);
  else if(t.hasAttribute('data-strategy-squad-page'))squadPage=Math.max(0,Number(t.dataset.strategySquadPage)||0);
  else if(t.hasAttribute('data-strategy-all'))selectedSquads=new Set((getPlan(groupId)?.squads||[]).map(x=>String(x.id)));
  else if(t.hasAttribute('data-strategy-reset')){selectedMethods.clear();selectedTargets.clear();}
  else if(t.hasAttribute('data-strategy-apply')){
   const plan=getPlan(groupId)||{squads:[],allowed:[]};
   const shares=planStrategyDistribution(plan,selectedSquads,[...selectedMethods]);
   const type=selectedType();
   if(type==='mixed'){error='対象の種類が異なるため、作戦を分けて実行してください。';render();return;}
   if(!shares.total){error='実行可能な分隊と作戦を選択してください。';render();return;}
   if(type!=='map'&&!selectedTargets.size){error='敵またはオブジェクトを1つ以上選択してください。';render();return;}
   if(type==='map'){
    const result=onMapRequest({groupId,mode:shares.rows[0].method.mode,
     plans:shares.rows.map(x=>({mode:x.method.mode,tacticId:x.method.id,squadIds:x.squadIds})),
     squadIds:[...new Set(shares.rows.flatMap(x=>x.squadIds))]});
    if(result===true){close();return;}error=String(result||'地点指定を開始できませんでした');
   }else{
    let completed=0,failed=[];
    for(const x of shares.rows){
     const result=onExecute({groupId,mode:x.method.mode,tacticId:x.method.id,
      squadIds:x.squadIds,targetIds:[...selectedTargets]});
     if(result===true)completed++;else failed.push(x.method.name+'：'+String(result||'実行不可'));
    }
    if(completed&&!failed.length){close();return;}
    error='実行 '+completed+'/'+shares.rows.length+'種。'+failed.join('／');
   }
  }
  render();
 });
 return {open,close,isOpen:()=>!panel.hidden};
}
