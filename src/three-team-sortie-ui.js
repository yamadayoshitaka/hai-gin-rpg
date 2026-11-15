import {
 SORTIE_FORMATIONS,SORTIE_GRID_CELLS,SORTIE_FORMATION_CELLS,ensureSortiePlan,sortieTeams,
 sortieTeamCount,sortieTeamSquads,sortieAdjacentJobs,availableSortieOrders
} from './three-team-sortie.js';
import {TACTICAL_ORDERS} from './tactical-command-descriptions.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button=(attr,title,selected=false)=>'<button type="button" '+attr+' class="'+(selected?'selected':'')+'">'+title+'</button>';
export function renderThreeTeamPlanner({game,teamId=1,cellIndex=5,view='setup',jobPage=0}){
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
 const orders=availableSortieOrders(game,team.id);
 const groupButtons='<div class="sortieTeams" role="group" aria-label="班の選択">'+teams.map(t=>{
  const total=sortieTeamCount(t),count=sortieTeamSquads(game,t.id).length;
  return button('data-sortie-team="'+t.id+'"','<strong>第'+t.id+'班 · '+total+'人</strong><small>'+count+'/4隊</small>',t.id===team.id);
 }).join('')+'</div>';
 const back=button('data-sortie-view="setup"','◀ 配置へ戻る');
 const captainChoices=assigned.map(s=>button('data-sortie-captain="'+esc(s.id)+'"',
   esc(s.characterName||s.name||s.job+'代表')+' <small>'+esc(s.job)+'</small>',String(s.id)===String(team.captainId))).join('');
 const captainPanel='<div class="sortieCaptains"><b>班の隊長</b><div class="sortieCaptainButtons">'+
  (captainChoices||'<small>ジョブを配置すると隊長を選べます</small>')+'</div></div>';
 const cells=Array.from({length:SORTIE_GRID_CELLS},(_,i)=>{
  const source=byId.get(String(team.grid?.[i])),count=source?team.counts[String(source.id)]||0:0;
  const label=source?esc(source.job):'＋';
  return button('data-sortie-cell="'+i+'" aria-label="'+(Math.floor(i/4)+1)+'行'+(i%4+1)+'列 '+(source?esc(source.job)+' '+count+'人':'空きマス')+'"',
    '<span>'+label+'</span>'+(source?'<small>'+count+'人</small>':''),
    i===pos&&view!=='setup' );
 }).join('');
 const main='<div class="sortieBar">'+
  button('data-sortie-view="templates"','陣形：'+esc(SORTIE_FORMATIONS[team.formation])+' ▾')+
  button('data-sortie-view="orders"','号令 '+orders.length+'種 ▸')+
  '</div><div class="sortieGridHint"><b>配置盤 4×4</b><small>敵陣 ↑　マスをタップしてジョブ選択</small></div>'+
  '<div class="sortieFormationGrid" role="group" aria-label="4×4のジョブ配置盤">'+cells+'</div>'+
  '<div class="sortieGridFooter"><small>最大4隊 · '+links.length+'組の隣接ジョブ</small>'+
  button('data-sortie-view="count"','人数変更 ▸')+'</div>'+captainPanel;
 const templates='<div class="sortieSubHead"><b>陣形テンプレートを選択</b>'+back+'</div>'+
  '<div class="sortieTemplateChoices">'+Object.entries(SORTIE_FORMATIONS).map(([id,name])=>{
   const grid=Array.from({length:16},(_,i)=>'<i class="'+(SORTIE_FORMATION_CELLS[id].includes(i)?'occupied':'')+'"></i>').join('');
   return button('data-sortie-formation="'+id+'"','<b>'+esc(name)+'</b><span class="sortieMiniGrid">'+grid+'</span>',team.formation===id);
  }).join('')+'</div><small class="sortieHint">選択すると現在の最大4隊をテンプレートに合わせて並べ直します。その後、個別のマスへ移動もできます。</small>';
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
  (selectedSid?button('data-sortie-view="count"','人数を変更する'):'')+'</div>';
 const maxCount=selectedSource?selectedSource.count-elsewhere:0;
 const countPanel='<div class="sortieSubHead"><b>人数を変更</b>'+back+'</div>'+
  '<p class="sortieSelectedLabel">'+(selectedSource?esc(selectedSource.job)+' · '+squadCount+'人':'マスを選択してジョブを配置してください')+'</p>'+
  (selectedSource?'<div class="sortieCountControl">'+
   button('data-sortie-step="-10"','−10')+button('data-sortie-step="-1"','−1')+
   '<input type="number" data-sortie-count min="1" max="'+maxCount+'" value="'+squadCount+'" aria-label="配置人数">'+
   button('data-sortie-step="1"','＋1')+button('data-sortie-step="10"','＋10')+
   '</div><small class="sortieHint">この隊に配属可能な人数：'+maxCount+'人。0人にする場合はジョブ選択でマスを空けてください。</small>':
   button('data-sortie-view="jobs"','ジョブを選択する')) ;
 const orderPanel='<div class="sortieSubHead"><b>第'+team.id+'班の号令</b>'+back+'</div>'+
  '<div class="sortieOrders">'+orders.map(id=>button('data-sortie-order="'+esc(id)+'"',
    '<strong>'+esc(TACTICAL_ORDERS[id]?.name||id)+'</strong><small>'+esc(TACTICAL_ORDERS[id]?.effect||'')+'</small>',team.initialOrder===id)).join('')+'</div>'+
  '<small class="sortieHint">待機・退却・突撃・守備は基本号令。支援は僧侶と別ジョブ、探索は忍者/シーフと別隊が上下左右に隣接すると解放します。</small>'+
  '<div class="sortieAdjacency"><b>隣接ジョブ</b><small>'+(links.map(x=>esc(x.a)+' × '+esc(x.b)).join(' ／ ')||'なし（マスを移動して隣接させてください）')+'</small></div>';
 const pagesByView={setup:main,templates,jobs,count:countPanel,orders:orderPanel};
 return '<section class="sortiePlanner" aria-label="最大3班・1班4隊・4×4配置">'+
  '<div class="sortieTop"><b>⚑ 最大3班 × 各班4隊</b><small>宿屋のテンプレート</small></div>'+
  groupButtons+(pagesByView[view]||main)+
  '<small class="sortieHint">設定は自動保存。出撃地点は戦闘前に選択します。</small></section>';
}
