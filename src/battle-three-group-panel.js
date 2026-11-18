import {threeGroupOverview,reinforceDivision,mergeDivision} from './battle-three-group-hierarchy.js';
/** Campaign HUD: ten groups -> subdivisions -> personnel/status/actions.
 * The old job list remains in the DOM for targeting and compatibility, hidden
 * until the player expands enemy selection. */
export function createBattleThreeGroupPanel({
 alliedNav,enemyNav,actors,groupBySquad,initialUnits=[],enemyInitial=0,
 onSquadSelect=()=>{},onStrategy=()=>{},onInspect=()=>{},onReinforce=()=>{},
 onMerge=()=>{},onLog=()=>{}
}){
 const ally=document.createElement('div');ally.id='battleThreeGroupPanel';ally.className='battleThreeGroupPanel';
 ally.setAttribute('aria-label','班・分隊・状況');
 alliedNav.insertBefore(ally,alliedNav.querySelector('.ribbonList'));
 const enemy=document.createElement('button');enemy.type='button';enemy.id='battleEnemyGroupSummary';
 enemyNav.insertBefore(enemy,enemyNav.querySelector('.ribbonList'));
 document.body.classList.add('story-three-group-ui');
 let level='groups',groupId=1,divisionId=null,enemyOpen=false,pointerDown=false,lastPointerAt=-Infinity,oldMarkup='',oldEnemy='';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const summaries=()=>threeGroupOverview(actors,groupBySquad,initialUnits);
 const back=(where,label)=>'<button type="button" data-back="'+where+'">◀ '+label+'</button>';
 const groupTitle=group=>'第'+group.id+'班';
 function render(force=false,targetsActive=false){
  const groups=summaries(),selected=groups.find(g=>g.id===groupId)||groups[0];
  let html='';
  if(level==='groups'){
   html='<div class="threeGroupStep">① 班を選択（最大10班）</div><div class="tenGroupGrid">'+
    groups.map(g=>'<button data-group="'+g.id+'" class="'+(g.danger?'danger':'')+'"><strong>'+groupTitle(g)+'</strong><small>生存 '+g.alive+'/'+Math.max(g.initial,g.alive)+'人 · '+g.divisions.length+'分隊'+(g.danger?' ⚠':'')+'</small></button>').join('')+'</div>';
  }else if(level==='divisions'){
   html=back('groups','10班に戻る')+
    '<div class="threeGroupStep">② '+groupTitle(selected)+' · 分隊を選択</div>'+
    (selected.divisions.map(d=>{
     const job=Object.entries(d.jobCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'兵士';
     const hp=Math.round(d.hp/Math.max(1,d.maxHp)*100);
     return '<button data-division="'+escape(d.id)+'" class="'+(hp<45||d.alive<2?'danger':'')+'"><strong>'+escape(job)+'分隊</strong><small>'+d.alive+'人 · HP '+hp+'%</small></button>';
    }).join('')||'<small>生存している分隊がありません</small>');
  }else{
   const d=selected.divisions.find(x=>x.id===String(divisionId)),hp=d?Math.round(d.hp/Math.max(1,d.maxHp)*100):0;
   const job=d?Object.entries(d.jobCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'兵士':'分隊消滅';
   html=back('divisions','分隊に戻る')+'<div class="threeGroupStep">③ 分隊状況・対処</div>'+
    '<strong>'+escape(job)+'分隊 · '+(d?.alive||0)+'人</strong>'+
    '<small>残HP '+hp+'%　'+(hp<45?'⚠ 援軍・再統合を推奨':'戦闘継続可能')+'</small>'+
    '<div class="threeGroupActions">'+
    '<button data-action="strategy" '+(!d?'disabled':'')+'>🎯 作戦</button>'+
    '<button data-action="inspect" '+(!d?'disabled':'')+'>📊 詳細</button>'+
    '<button data-action="reinforce" '+(!d||selected.divisions.length<2?'disabled':'')+'>🛡 同班から援軍</button>'+
    '<button data-action="merge" '+(!d||selected.divisions.length<2?'disabled':'')+'>⇄ 再統合</button></div>';
  }
  if((force||html!==oldMarkup)&&!pointerDown&&
   (force||performance.now()-lastPointerAt>400)){ally.innerHTML=html;oldMarkup=html;}
  const live=actors.filter(u=>u.team===1&&u.hp>0&&!u.defeated).length;
  const label='🔴 敵軍 '+live+'/'+Math.max(enemyInitial,live)+'人 '+(enemyOpen?'▲':'▼');
  if(label!==oldEnemy){enemy.textContent=label;oldEnemy=label;}
  document.body.classList.toggle('story-enemy-details',enemyOpen||targetsActive);
 }
 ally.addEventListener('pointerdown',()=>pointerDown=true);
 for(const type of ['pointerup','pointercancel','blur'])ally.addEventListener(type,()=>{
  pointerDown=false;lastPointerAt=performance.now();
 });
 ally.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.group){groupId=Number(button.dataset.group);level='divisions';}
  else if(button.dataset.division){divisionId=String(button.dataset.division);level='status';onSquadSelect(divisionId);}
  else if(button.dataset.back){level=button.dataset.back;}
  else if(button.dataset.action){
   const id=divisionId;
   if(button.dataset.action==='strategy')onStrategy(groupId,id);
   else if(button.dataset.action==='inspect')onInspect(id);
   else if(button.dataset.action==='reinforce'){
    const result=reinforceDivision(actors,groupBySquad,id);
    if(result.ok){onReinforce(result);onLog('第'+groupId+'班：'+result.fromId+'分隊から'+id+'分隊へ'+result.count+'人の援軍');}
    else onLog(result.reason);
   }else if(button.dataset.action==='merge'){
    const result=mergeDivision(actors,groupBySquad,id);
    if(result.ok){
     divisionId=result.toId;onSquadSelect(divisionId);onMerge(result);
     onLog('第'+groupId+'班：'+result.count+'人を'+result.toId+'分隊へ再統合');
    }else onLog(result.reason);
   }
  }
  pointerDown=false;render(true);
 });
 enemy.onclick=()=>{enemyOpen=!enemyOpen;render(true)};
 return {render,reset:()=>{level='groups';groupId=1;divisionId=null;enemyOpen=false;render(true);}};
}
