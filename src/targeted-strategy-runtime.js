/**
 * Tap-first, compact multi-platoon / multi-target strategy chooser.
 * Calls to the authoritative battle simulation are supplied by its host.
 */
export const TARGETED_STRATEGY_KINDS=Object.freeze({
 charge:{label:'突撃',type:'enemy'},defend:{label:'守備',type:'map'},
 hold:{label:'待機',type:'map'},retreat:{label:'退却',type:'map'},
 support:{label:'支援',type:'map'},explore:{label:'探索',type:'object'},
 destroy:{label:'破壊',type:'object'},weaken:{label:'弱体',type:'enemy'}
});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(attr,title,active=false)=>'<button type="button" '+attr+' class="'+(active?'active':'')+'">'+esc(title)+'</button>';
export function createTargetedStrategyUi({getPlan,getEnemyTargets,getObjects,onExecute,onMapRequest}){
 const panel=document.createElement('section');panel.id='targetedStrategyPanel';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','分隊別作戦');
 const style=document.createElement('style');
 style.textContent="#targetedStrategyPanel[hidden]{display:none!important}#targetedStrategyPanel{position:fixed;inset:0;z-index:95;background:#020b19ef;display:grid;place-items:center;padding:8px;color:#f2e6d0;font:12px system-ui,sans-serif}#targetedStrategyCard{width:min(96vw,620px);max-height:92dvh;overflow:hidden;background:#122b42;border:2px solid #dcc08b;border-radius:11px;padding:9px;display:grid;gap:7px;align-content:start}#targetedStrategyCard header{position:static;display:flex;justify-content:space-between;align-items:center;background:transparent;border:0;padding:0;color:#ffe0a6}#targetedStrategyCard b{font-size:14px}#targetedStrategyCard button{border:1px solid #779ab3;background:#26465d;color:#fcebd4;padding:8px 5px;border-radius:6px;min-width:0}#targetedStrategyCard button.active{background:#785a30;border-color:#ffe1a1}#targetedStrategyCard button:disabled{opacity:.35}#targetedStrategyCard small{color:#cad9e0;font-size:10px}.targetedStrategyGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.targetedStrategySubGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.targetedStrategyTargetGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.targetedStrategyActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.targetedStrategyFoot{display:flex;justify-content:space-between;align-items:center;gap:7px}@media(max-height:560px){#targetedStrategyCard{gap:4px;padding:5px}.targetedStrategyGrid button,.targetedStrategySubGrid button,.targetedStrategyTargetGrid button{padding:4px!important}}";
 document.head.append(style);document.body.append(panel);
 let groupId=null,mode='charge',selectedSquads=new Set(),selectedTargets=new Set(),page=0,error='';
 const kind=()=>TARGETED_STRATEGY_KINDS[mode]?.type||'enemy';
 const options=()=>kind()==='enemy'?getEnemyTargets():kind()==='object'?getObjects(mode):[];
 function render(){
  if(groupId==null||panel.hidden)return;
  const plan=getPlan(groupId)||{squads:[],allowed:[]},allowed=plan.allowed||[];
  if(!allowed.includes(mode))mode=allowed[0]||'hold';
  const targets=options().filter(t=>t.id!=null),maxPage=Math.max(0,Math.ceil(targets.length/6)-1);
  page=Math.min(page,maxPage);
  panel.innerHTML='<div id="targetedStrategyCard"><header><b>第'+esc(groupId)+'班・分隊別作戦</b>'+button('data-strategy-close','✕ 戻る')+'</header>'+
   '<small>作戦 → 動かす分隊（複数選択） → 目標（複数選択）</small>'+
   '<div class="targetedStrategyGrid">'+Object.entries(TARGETED_STRATEGY_KINDS).map(([id,x])=>
    '<button type="button" data-strategy-mode="'+id+'" class="'+(id===mode?'active':'')+'" '+(!allowed.includes(id)?'disabled':'')+'>'+esc(x.label)+'</button>').join('')+'</div>'+
   '<b>分隊（'+selectedSquads.size+'/'+plan.squads.length+'）</b><div class="targetedStrategySubGrid">'+
   plan.squads.map(s=>button('data-strategy-squad="'+esc(s.id)+'"',s.label,selectedSquads.has(String(s.id)))).join('')+'</div>'+
   (kind()==='map'?'<small>このあと実際の戦場レーダー／地面をタップして地点指定。別地点へ再指定できます。</small>':
    '<b>'+(kind()==='object'?'対象オブジェクト':'標的の敵部隊')+'（'+selectedTargets.size+'件）</b>'+
    '<div class="targetedStrategyTargetGrid">'+targets.slice(page*6,page*6+6).map(t=>
     button('data-strategy-target="'+esc(t.id)+'"',t.label,selectedTargets.has(String(t.id)))).join('')+'</div>'+
    (maxPage?'<div class="targetedStrategyFoot">'+button('data-strategy-page="'+(page-1)+'" '+(page===0?'disabled':''),'◀ 前')+
      '<small>'+(page+1)+'/'+(maxPage+1)+'</small>'+button('data-strategy-page="'+(page+1)+'" '+(page===maxPage?'disabled':''),'次 ▶')+'</div>':''))+
   '<div class="targetedStrategyActions">'+button('data-strategy-all','全分隊を選択')+
    button('data-strategy-apply',kind()==='map'?'🗺 マップで指定':'選択した目標へ実行')+'</div>'+
   '<small role="status" style="color:#ffe0a4">'+esc(error||'全分隊に隊長・陣形の共通バフが適用されます。')+'</small></div>';
 }
 function open(id){
  groupId=String(id);
  const plan=getPlan(groupId)||{squads:[],allowed:[]};
  selectedSquads=new Set(plan.squads.map(x=>String(x.id)));
  selectedTargets.clear();mode=plan.allowed?.includes('charge')?'charge':plan.allowed?.[0]||'hold';
  page=0;error='';panel.hidden=false;render();
 }
 function close(){panel.hidden=true;groupId=null;selectedTargets.clear();error='';}
 panel.addEventListener('click',event=>{
  const t=event.target.closest('button');if(!t)return;
  if(t.hasAttribute('data-strategy-close')){close();return;}
  if(t.hasAttribute('data-strategy-mode')){mode=t.dataset.strategyMode;page=0;selectedTargets.clear();}
  else if(t.hasAttribute('data-strategy-squad')){
   const id=t.dataset.strategySquad;if(selectedSquads.has(id))selectedSquads.delete(id);else selectedSquads.add(id);
  }else if(t.hasAttribute('data-strategy-target')){
   const id=t.dataset.strategyTarget;if(selectedTargets.has(id))selectedTargets.delete(id);else selectedTargets.add(id);
  }else if(t.hasAttribute('data-strategy-page'))page=Number(t.dataset.strategyPage)||0;
  else if(t.hasAttribute('data-strategy-all'))selectedSquads=new Set((getPlan(groupId)?.squads||[]).map(x=>String(x.id)));
  else if(t.hasAttribute('data-strategy-apply')){
   const command={groupId,mode,squadIds:[...selectedSquads],targetIds:[...selectedTargets]};
   if(!command.squadIds.length){error='分隊を1つ以上選んでください。';render();return;}
   if(kind()!=='map'&&!command.targetIds.length){error='目標を1つ以上選んでください。';render();return;}
   const result=kind()==='map'?onMapRequest(command):onExecute(command);
   if(result===true){close();return;}error=String(result||'命令できませんでした');
  }
  render();
 });
 return {open,close,isOpen:()=>!panel.hidden};
}
