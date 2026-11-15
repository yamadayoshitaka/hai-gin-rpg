import {SORTIE_FORMATIONS,SORTIE_SQUADS_PER_GROUP,ensureSortiePlan,sortieTeams,sortieTeamCount,
 sortieTeamSquads,availableSortieOrders} from './three-team-sortie.js';
import {TACTICAL_ORDERS} from './tactical-command-descriptions.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const FORMATION_POSITIONS={
 attack:['最前衛・左','最前衛・右','中衛','後衛'],
 balanced:['前衛','中衛・左','中衛・右','後衛'],
 support:['前衛','後衛・左','後衛・右','本陣']
};
export function renderThreeTeamPlanner({game,teamId=1,slotIndex=0,view='setup'}){
 ensureSortiePlan(game);
 const teams=sortieTeams(game),team=teams.find(t=>t.id===teamId)||teams[0];
 const sources=game.campaign.squads.filter(s=>s.count>0&&String(s.commanderId??'player')!=='reserve');
 const byId=new Map(sources.map(s=>[String(s.id),s]));
 const index=Math.max(0,Math.min(SORTIE_SQUADS_PER_GROUP-1,Number(slotIndex)||0));
 const sid=team.slots[index],source=byId.get(sid);
 const assigned=sortieTeamSquads(game,team.id);
 const elsewhere=source?teams.filter(t=>t.id!==team.id).reduce((n,t)=>n+(t.counts[String(source.id)]||0),0):0;
 const count=source?(team.counts[String(source.id)]||0):0;
 const availableCount=source?source.count-elsewhere:0;
 const groups=teams.map(t=>{
  const units=sortieTeamSquads(game,t.id),captain=units.find(s=>String(s.id)===String(t.captainId));
  return '<button type="button" data-sortie-team="'+t.id+'" class="'+(t.id===team.id?'selected':'')+'"><strong>第'+t.id+'班・'+sortieTeamCount(t)+'人</strong>'+
   '<small>'+units.length+'/4隊 · '+esc(SORTIE_FORMATIONS[t.formation])+'</small>'+
   '<small>隊長：'+esc(captain?.characterName||captain?.name||captain?.job||'未選定')+'</small></button>';
 }).join('');
 const formationButtons=Object.entries(SORTIE_FORMATIONS).map(([id,name])=>
  '<button type="button" data-sortie-formation="'+id+'" class="'+(team.formation===id?'selected':'')+'">'+esc(name)+'</button>').join('');
 const positions=FORMATION_POSITIONS[team.formation];
 const cells=Array.from({length:SORTIE_SQUADS_PER_GROUP},(_,i)=>{
  const placed=byId.get(team.slots[i]),soldiers=team.counts[String(placed?.id)]||0;
  return '<button type="button" data-sortie-slot-index="'+i+'" class="'+(index===i?'selected':'')+'">'+
   '<small>'+esc(positions[i])+' · 第'+(i+1)+'隊</small>'+
   '<strong>'+esc(placed?.job||'＋ ジョブ選択')+'</strong>'+
   '<small>'+(placed?esc(placed.rarity)+' · '+soldiers+'人':'空き枠')+'</small></button>';
 }).join('');
 const jobButtons=sources.map(s=>{
  const current=String(s.id)===sid;
  const taken=teams.filter(t=>t!==team).reduce((sum,t)=>sum+(t.counts[String(s.id)]||0),0);
  const otherCell=team.slots.some((id,i)=>i!==index&&id===String(s.id));
  return '<button type="button" data-sortie-job="'+esc(s.id)+'" class="'+(current?'selected':'')+'" '+(otherCell?'disabled':'')+'>'+
   esc(s.job)+'<small>'+esc(s.rarity)+' · #'+s.id+' · '+(current?team.counts[String(s.id)]:Math.max(0,s.count-taken))+'人</small></button>';
 }).join('');
 const captainButtons=assigned.map(s=>
  '<button type="button" data-sortie-captain="'+esc(s.id)+'" class="'+(String(s.id)===String(team.captainId)?'selected':'')+'">'+
  esc(s.characterName||s.name||s.job+'代表')+'<small>'+esc(s.job)+' '+esc(s.rarity)+'</small></button>').join('');
 const edit='<div class="sortieFormationTitle"><b>陣形テンプレート</b><small>陣形を選択</small></div>'+
  '<div class="sortieFormations">'+formationButtons+'</div>'+
  '<div class="sortieFormationGrid" role="group" aria-label="第'+team.id+'班の最大4隊の配置">'+cells+'</div>'+
  '<div class="sortieSection"><b>第'+(index+1)+'隊に配置するジョブ</b><small>マスをタップ → ジョブをタップ</small></div>'+
  '<div class="sortieJobs">'+jobButtons+
   '<button type="button" data-sortie-job="" '+(!sid?'disabled':'')+'>✕ 空き枠にする</button></div>'+
  '<div class="sortieBottom"><div class="sortieCounts"><span>選択した隊の人数</span>'+
   '<button type="button" data-sortie-step="-1" '+(!source||count<=1?'disabled':'')+'>−</button>'+
   '<input type="number" aria-label="選択した隊の人数" data-sortie-count min="1" max="'+availableCount+'" value="'+count+'" '+(!source?'disabled':'')+'>'+
   '<button type="button" data-sortie-step="1" '+(!source||count>=availableCount?'disabled':'')+'>＋</button></div>'+
   '<div class="sortieCaptains"><span>班の隊長</span>'+captainButtons+'</div></div>';
 const orders=availableSortieOrders(game,team.id);
 const orderPanel='<div class="sortieOrders">'+orders.map(id=>
  '<button type="button" data-sortie-order="'+esc(id)+'" class="'+(team.initialOrder===id?'selected':'')+'">'+esc(TACTICAL_ORDERS[id]?.name||id)+
  '<small>'+esc(TACTICAL_ORDERS[id]?.effect||'')+'</small></button>').join('')+
  (orders.length?'':'<p>ジョブを配置すると号令が表示されます。</p>')+
  '</div><small class="sortieHint">号令は班にいるジョブで解放されます。陣形の種類で号令を制限しません。</small>';
 return '<section class="sortiePlanner" aria-label="最大3班・1班4隊">'+
  '<div class="sortieTop"><b>⚑ 最大3班 × 各班4隊</b><small>宿屋：編成テンプレート保存</small></div>'+
  '<nav class="sortieModes"><button type="button" data-sortie-view="setup" class="'+(view==='setup'?'selected':'')+'">陣形・ジョブ編成</button>'+
  '<button type="button" data-sortie-view="orders" class="'+(view==='orders'?'selected':'')+'">📯 号令を確認</button></nav>'+
  '<div class="sortieTeams">'+groups+'</div>'+(view==='orders'?orderPanel:edit)+
  '<small class="sortieHint">変更は自動保存。出撃場所は戦闘前に設定します。3D戦闘は現状最大50人を比例抽出します。</small></section>';
}
