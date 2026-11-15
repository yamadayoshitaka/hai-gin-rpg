import {
 SORTIE_FORMATIONS,SORTIE_GRID_CELLS,SORTIE_FORMATION_CELLS,sortieFormationStatus,ensureSortiePlan,sortieTeams,sortieSquadCap,sortieLevel,sortieFormationBuff,unlockedSortieFormations,sortieDebuffTypes,
 sortieTeamCount,sortieTeamSquads,sortieAdjacentJobs,availableSortieOrders
} from './three-team-sortie.js';
import {FORMATION_ROLES,ROLE_NAMES} from './sortie-formation-logic.js';
import {TACTICAL_ORDERS} from './tactical-command-descriptions.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button=(attr,title,selected=false)=>'<button type="button" '+attr+' class="'+(selected?'selected':'')+'">'+title+'</button>';
export function renderThreeTeamPlanner({game,teamId=1,cellIndex=5,view='setup',jobPage=0,templatePage=0}){
 ensureSortiePlan(game);
 const teams=sortieTeams(game),team=teams.find(t=>t.id===Number(teamId))||teams[0];
 const sources=game.campaign.squads.filter(s=>s.count>0&&String(s.commanderId??'player')!=='reserve');
 const byId=new Map(sources.map(s=>[String(s.id),s]));
 const pos=Math.max(0,Math.min(SORTIE_GRID_CELLS-1,Number(cellIndex)||0));
 const selectedSid=team.grid?.[pos],selectedSource=byId.get(String(selectedSid));
 const squadCount=selectedSource?team.counts[String(selectedSource.id)]||0:0;
 const elsewhere=selectedSource?teams.filter(t=>t.id!==team.id).reduce((n,t)=>n+(t.counts[String(selectedSource.id)]||0),0):0;
 const assigned=sortieTeamSquads(game,team.id);
 const links=sortieAdjacentJobs(game,team.id);
 const status=sortieFormationStatus(game,team.id);
 const orders=availableSortieOrders(game,team.id),cap=sortieSquadCap(game),level=sortieLevel(game),formBuff=sortieFormationBuff(game,team.id);
 const groupButtons='<div class="sortieTeams" role="group" aria-label="班の選択">'+teams.map(t=>{
  const total=sortieTeamCount(t),count=sortieTeamSquads(game,t.id).length;
  return button('data-sortie-team="'+t.id+'"','<strong>第'+t.id+'班 · '+total+'人</strong><small>'+count+'/'+cap+'隊</small>',t.id===team.id);
 }).join('')+'</div>';
 const back=button('data-sortie-view="setup"','◀ 配置へ戻る');
 const captainChoices=assigned.map(s=>button('data-sortie-captain="'+esc(s.id)+'"',
   esc(s.characterName||s.name||s.job+'代表')+' <small>'+esc(s.job)+'</small>',String(s.id)===String(team.captainId))).join('');
 const captainPanel='<div class="sortieCaptains"><b>班の隊長</b>'+
  button('data-sortie-view="captains"','隊長を選ぶ ▸')+
  '<div class="sortieCaptainButtons">'+
  (captainChoices||'<small>ジョブを配置すると隊長を選べます</small>')+'</div></div>';
 const captainPage='<div class="sortieSubHead"><b>班の隊長を選択</b>'+back+'</div>'+
  '<div class="sortieCaptainChoices">'+(captainChoices||'<small>ジョブを先に配置してください</small>')+'</div>';
 const cells=Array.from({length:SORTIE_GRID_CELLS},(_,i)=>{
  const source=byId.get(String(team.grid?.[i])),count=source?team.counts[String(source.id)]||0:0;
  const label=source?esc(source.job):'＋';
  return button('data-sortie-cell="'+i+'" aria-label="'+(Math.floor(i/4)+1)+'行'+(i%4+1)+'列 '+(source?esc(source.job)+' '+count+'人':'空きマス')+'"',
    '<span>'+label+'</span>'+(source?'<small>'+count+'人</small>':''),
    i===pos&&view!=='setup' );
 }).join('');
 const main='<div class="sortieBar">'+
  button('data-sortie-view="templates"','陣形：'+esc(status.valid?SORTIE_FORMATIONS[team.formation]?.name:'自由配置')+' ▾')+
  button('data-sortie-view="orders"','作戦 '+orders.length+'種 ▸')+
  '</div><div class="sortieGridHint"><b>配置盤 4×4</b><small>敵陣 ↑　マスをタップしてジョブ選択</small></div>'+
  '<div class="sortieFormationGrid" role="group" aria-label="4×4のジョブ配置盤">'+cells+'</div>'+
  '<div class="sortieGridFooter"><small>'+esc(status.reason)+' · 上限'+cap+'隊</small>'+
  button('data-sortie-view="count"','人数 ▸')+button('data-sortie-view="divisions"','分隊 ▸')+'</div>'+captainPanel;
 const templateIds=Object.keys(SORTIE_FORMATIONS);
 const pageCap=6,templatePages=Math.ceil(templateIds.length/pageCap);
 const tPage=Math.max(0,Math.min(templatePages-1,Number(templatePage)||0));
 const templates='<div class="sortieSubHead"><b>陣形テンプレートを選択 · Lv.'+level+'</b>'+back+'</div>'+
  '<div class="sortieTemplateChoices">'+templateIds.slice(tPage*pageCap,tPage*pageCap+pageCap).map(id=>{const entry=SORTIE_FORMATIONS[id],unlocked=entry.level<=level;
   const preview=Object.fromEntries(SORTIE_FORMATION_CELLS[id].slice(0,4).map((cell,index)=>[cell,FORMATION_ROLES[id][index]]));
   const grid=Array.from({length:16},(_,i)=>'<i class="'+(preview[i]?'occupied':'')+'" title="'+esc(ROLE_NAMES[preview[i]]||'空き')+'">'+(preview[i]?esc((ROLE_NAMES[preview[i]]||'').slice(0,1)):'')+'</i>').join('');
   return button('data-sortie-formation="'+id+'" '+(!unlocked?'disabled':'') ,'<b>'+esc(entry.name)+'</b><small>Lv.'+entry.level+'解放'+(unlocked?'':' 🔒')+'</small><span class="sortieMiniGrid">'+grid+'</span><small>'+esc(FORMATION_ROLES[id].slice(0,4).map(x=>ROLE_NAMES[x]).join('/'))+'</small><small>攻撃'+Math.round((entry.attack||0)*100)+'% / 防御'+Math.round((entry.defense||0)*100)+'%</small>',team.formation===id);
  }).join('')+'</div>'+
 '<div class="sortiePager">'+button('data-sortie-template-page="'+(tPage-1)+'" '+(!tPage?'disabled':''),'◀ 前')+
 '<small>'+(tPage+1)+' / '+templatePages+'</small>'+
 button('data-sortie-template-page="'+(tPage+1)+'" '+(tPage>=templatePages-1?'disabled':''),'次 ▶')+'</div>'+
 '<small class="sortieHint">色付き4マスが陣形の主要配置。指定職業と配置が一致しない場合は自由配置となり、陣形バフ・作戦は無効です。</small>';
 const pages=Math.max(1,Math.ceil(sources.length/6));
 const page=Math.max(0,Math.min(pages-1,Number(jobPage)||0));
 const jobs='<div class="sortieSubHead"><b>行'+(Math.floor(pos/4)+1)+'・列'+(pos%4+1)+'のジョブを選択</b>'+back+'</div>'+
  '<div class="sortieJobChoices">'+sources.slice(page*6,page*6+6).map(s=>{
   const sid=String(s.id),usedByOthers=teams.filter(t=>t.id!==team.id).reduce((n,t)=>n+(t.counts[sid]||0),0);
   const mine=team.counts[sid]||0,free=s.count-usedByOthers-mine;
   return button('data-sortie-job="'+esc(s.id)+'"',
    '<strong>'+esc(s.job)+'</strong><small>'+esc(s.rarity)+' · '+(mine?'配置済み '+mine+'人':free>0?'残り '+free+'人':'他班から移動')+'</small>',
    sid===String(selectedSid));
  }).join('')+'</div>'+
  (pages>1?'<div class="sortiePager">'+button('data-sortie-job-page="'+(page-1)+'" '+(page===0?'disabled':''),'◀ 前')+
  '<small>'+(page+1)+' / '+pages+'</small>'+
  button('data-sortie-job-page="'+(page+1)+'" '+(page===pages-1?'disabled':''),'次 ▶')+'</div>':'')+
  '<div class="sortieSubActions">'+button('data-sortie-job=""'+(!selectedSid?' disabled':''),'このマスを空ける')+
  (selectedSid?button('data-sortie-view="count"','人数を変更する')+button('data-sortie-view="divisions"','分隊を設定する'):'')+'</div>';
 const maxCount=selectedSource?selectedSource.count-elsewhere:0;
 const countPanel='<div class="sortieSubHead"><b>人数を変更</b>'+back+'</div>'+
  '<p class="sortieSelectedLabel">'+(selectedSource?esc(selectedSource.job)+' · '+squadCount+'人':'マスを選択してジョブを配置してください')+'</p>'+
  (selectedSource?'<div class="sortieCountControl">'+
   button('data-sortie-step="-10"','−10')+button('data-sortie-step="-1"','−1')+
   '<input type="number" data-sortie-count min="1" max="'+maxCount+'" value="'+squadCount+'" aria-label="配置人数">'+
   button('data-sortie-step="1"','＋1')+button('data-sortie-step="10"','＋10')+
   '</div><small class="sortieHint">この隊に配属可能な人数：'+maxCount+'人。0人にする場合はジョブ選択でマスを空けてください。</small>':
   button('data-sortie-view="jobs"','ジョブを選択する')) ;
 const divisionParts=selectedSource?Math.max(1,team.divisions?.[String(selectedSource.id)]||1):1;
 const divisionPanel='<div class="sortieSubHead"><b>分隊を設定（最大4分隊）</b>'+back+'</div>'+
  '<p class="sortieSelectedLabel">'+(selectedSource?esc(selectedSource.job)+'・'+squadCount+'人':'まず配置盤のマスにジョブを配置してください')+'</p>'+
  '<div class="sortieDivisions">'+(selectedSource?[1,2,3,4].map(n=>button('data-sortie-division="'+n+'" '+(n>squadCount?'disabled':''),
   '<strong>'+n+'分隊</strong><small>各隊 約'+Math.ceil(squadCount/n)+'人</small>',divisionParts===n)).join(''):'')+'</div>'+
  '<small class="sortieHint">戦闘では本隊が隊長を保持し、すべての分隊は所属班の陣形バフを受けます。分隊ごとに敵・地点・オブジェクトを狙えます。</small>';
 const orderPanel='<div class="sortieSubHead"><b>第'+team.id+'班の作戦</b>'+back+'</div>'+
  '<div class="sortieOrders">'+orders.map(id=>button('data-sortie-order="'+esc(id)+'"',
    '<strong>'+esc(TACTICAL_ORDERS[id]?.name||id)+'</strong><small>'+esc(TACTICAL_ORDERS[id]?.effect||'')+'</small>',team.initialOrder===id)).join('')+'</div>'+
  '<small class="sortieHint">作戦は戦場で目標を指定します。突撃は敵を複数指定可能、守備・支援・退却・待機は地図、探索・破壊はオブジェクトを指定。弱体は忍者・シーフ・魔法使いが担当します。</small>'+
  '<div class="sortieAdjacency"><b>隣接ジョブ</b><small>'+(links.map(x=>esc(x.a)+' × '+esc(x.b)).join(' ／ ')||'なし（マスを移動して隣接させてください）')+'</small></div>';
 const pagesByView={setup:main,templates,jobs,count:countPanel,orders:orderPanel,captains:captainPage,divisions:divisionPanel};
 return '<section class="sortiePlanner" aria-label="最大3班・Lvに応じた隊数・4×4配置">'+
  '<div class="sortieTop"><b>⚑ 最大3班・Lv.'+level+'（仮）</b><small>各班上限'+cap+'隊</small></div>'+
  groupButtons+(pagesByView[view]||main)+
  '<small class="sortieHint">主人公Lv.'+level+'（暫定検証）・班ごと'+cap+'隊、3班合計最大'+(cap*3)+'隊。'+esc(status.reason)+'。有効バフ：攻撃'+Math.round(formBuff.attack*100)+'%／防御'+Math.round(formBuff.defense*100)+'%。分隊後も隊長の班に所属する限り維持。出撃地点は戦闘前に選択。</small></section>';
}
