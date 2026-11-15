import {SORTIE_FORMATIONS,allowedSortieSlots,ensureSortiePlan,sortieTeams,sortieTeamCount,
 sortieTeamSquads,availableSortieOrders,resolvedSortieSlot,stageIsControlled} from './three-team-sortie.js';
import {TACTICAL_ORDERS} from './tactical-command-descriptions.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function renderThreeTeamPlanner({game,stage,stages=[],teamId=1,sourceId=null,view='setup'}){
 ensureSortiePlan(game);
 const teams=sortieTeams(game),selected=teams.find(t=>t.id===teamId)||teams[0];
 const sources=game.campaign.squads.filter(s=>s.count>0&&String(s.commanderId??'player')!=='reserve');
 const assigned=sortieTeamSquads(game,selected.id);
 const source=sources.find(s=>String(s.id)===String(sourceId))||sources[0]||null;
 const count=source?(selected.counts[String(source.id)]||0):0;
 const elsewhere=source?teams.filter(t=>t.id!==selected.id).reduce((n,t)=>n+(t.counts[String(source.id)]||0),0):0;
 const slots=allowedSortieSlots(game,stage),slot=resolvedSortieSlot(game,stage,selected);
 const stageSelect='<select data-sortie-stage aria-label="設定対象のステージ">'+stages.map(s=>
  '<option value="'+esc(s.id)+'" '+(stage?.id===s.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select>';
 const cards=teams.map(team=>{
  const group=sortieTeamSquads(game,team.id);
  const boss=group.find(s=>String(s.id)===String(team.captainId));
  return '<button type="button" data-sortie-team="'+team.id+'" class="'+(team.id===selected.id?'selected':'')+'"><strong>第'+team.id+'隊 · '+sortieTeamCount(team)+'人</strong>'+
   '<small>'+esc([...new Set(group.map(s=>s.job))].join('／')||'未編成')+'</small>'+
   '<small>隊長：'+esc(boss?.characterName||boss?.name||boss?.job||'未選定')+' / '+esc(SORTIE_FORMATIONS[team.formation])+'</small></button>';
 }).join('');
 const config='<div class="sortieEdit">'+
  '<label>兵種（保有兵）<select data-sortie-source>'+sources.map(s=>
   '<option value="'+s.id+'" '+(source?.id===s.id?'selected':'')+'>'+esc(s.job)+' '+esc(s.rarity)+' · #'+s.id+'</option>').join('')+'</select></label>'+
  '<label>人数<input type="number" data-sortie-count min="0" max="'+(source?source.count-elsewhere:0)+'" step="1" value="'+count+'" '+(!source?'disabled':'')+'></label>'+
  '<label>隊長<select data-sortie-captain '+(!assigned.length?'disabled':'')+'>'+assigned.map(s=>
   '<option value="'+s.id+'" '+(String(s.id)===String(selected.captainId)?'selected':'')+'>'+esc(s.characterName||s.name||s.job+'代表')+' '+esc(s.rarity)+'</option>').join('')+'</select></label>'+
  '<label>隊列<select data-sortie-formation>'+Object.entries(SORTIE_FORMATIONS).map(([id,name])=>
   '<option value="'+id+'" '+(id===selected.formation?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>'+
  '<label>出撃位置<select data-sortie-slot>'+slots.map(n=>
   '<option value="'+n+'" '+(n===slot?'selected':'')+'>'+(n<9?'戦場'+(Math.floor(n/3)+1)+'列':'入口')+'・'+['左','中央','右'][n%3]+'</option>').join('')+'</select></label>'+
  '</div><small class="sortieHint">'+(stageIsControlled(game,stage)?'制圧済み：全12か所から選択可能。':'未制圧：入口3か所のみ。')+
  ' 保有兵の人数を3隊へ配分します。現行の3D戦闘は最大50人を比例抽出します。</small>';
 const available=availableSortieOrders(game,selected.id);
 const orders='<div class="sortieOrders">'+available.map(id=>
  '<button type="button" data-sortie-order="'+esc(id)+'" class="'+(selected.initialOrder===id?'selected':'')+'">'+esc(TACTICAL_ORDERS[id]?.name||id)+'</button>').join('')+
  '</div><small class="sortieHint">編成したジョブで使える号令のみ表示。選択した号令をこの隊の初期号令として保存します。</small>';
 return '<section class="sortiePlanner" aria-label="最大3隊の配列"><div class="sortieTop"><b>⚑ 最大3隊・軍師配置不要</b>'+stageSelect+'</div>'+
  '<nav class="sortieModes"><button type="button" data-sortie-view="setup" class="'+(view==='setup'?'selected':'')+'">配列・出撃設定</button>'+
  '<button type="button" data-sortie-view="orders" class="'+(view==='orders'?'selected':'')+'">📯 号令を確認</button></nav>'+
  '<div class="sortieTeams">'+cards+'</div>'+(view==='orders'?orders:config)+'</section>';
}
