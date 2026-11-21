/**
 * Mobile first: one decision at a time, starting from the team chooser.
 * Roster -> equipment -> captain -> eligible formation -> summary.
 */
import {
 ensureSortiePlan,sortieTeams,sortieTeamCount,sortiePlanningLimit,sortieLevel,
 SORTIE_FORMATIONS,SORTIE_FORMATION_CELLS
} from './three-team-sortie.js';
import {FORMATION_ROLES,ROLE_NAMES} from './sortie-formation-logic.js';
import {FORMATION_ENTRY_REQUIREMENTS,FORMATION_BATTLE_PURPOSES} from './sortie-formation-template-rules.js';
import {inspectInnFormation} from './inn-formation-rules.js';
import {TOWN_SHOP,squadEquipmentBonus} from './game-core-flow.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button=(attr,title,selected=false)=>'<button type="button" '+attr+' class="'+(selected?'selected':'')+'">'+title+'</button>';
const sourceLabel=s=>esc(s.characterName||s.name||s.job+'代表');
const gearName=id=>TOWN_SHOP.find(x=>x.id===id)?.name||'装備なし';
const names=['隊の選択','隊員と人数','装備','リーダー','陣形','編成確認'];
const stageByStep={teamPick:0,roster:1,rosterPick:1,equipment:2,equipmentPick:2,leader:3,formation:4,review:5};
const purpose=id=>FORMATION_BATTLE_PURPOSES[id]||{purpose:'汎用隊列',movement:'隊列を維持'};
const requirement=id=>{
 const r=FORMATION_ENTRY_REQUIREMENTS[id];
 if(!r)return '';
 const parts=['最低'+r.people+'人'];
 if(r.rPlus)parts.push('R以上'+r.rPlus);
 if(r.srPlus)parts.push('SR以上'+r.srPlus);
 if(r.ssrPlus)parts.push('SSR以上'+r.ssrPlus);
 if(r.ur)parts.push('UR'+r.ur);
 return parts.join('・');
};
const endActions=(back,next)=>'<footer class="innWizardFooter">'+
 (back?button('data-inn-wizard-back="1"','◀ 戻る'):'<span></span>')+
 (next?button('data-inn-wizard-next="1"','次へ ▶'):'<span></span>')+'</footer>';
const currentTeam=(game,id)=>sortieTeams(game).find(t=>t.id===Number(id))||sortieTeams(game)[0];
const currentSources=(game,team)=>game.campaign.squads.filter(s=>Number(team.counts[String(s.id)]||0)>0);
const employed=(game,team,source)=>game.sortiePlan.teams.filter(t=>t!==team)
 .reduce((n,t)=>n+Number(t.counts[String(source.id)]||0),0);

function rosterBreakdown(game,team){
 const selected=currentSources(game,team);
 return selected.map(s=>{
  const c=team.counts[String(s.id)]||0,gear=s.equipment||{};
  return '<div class="innWizardMember"><div><b>'+esc(s.job)+' · '+c+'人</b>'+
   '<small>'+esc(s.rarity||'N')+' · '+sourceLabel(s)+'</small>'+
   '<small>武器：'+esc(gearName(gear.weapon))+'／防具：'+esc(gearName(gear.armor))+'</small></div>'+
   '<small class="innWizardBonus">攻撃+'+Math.round(squadEquipmentBonus(s).attack*100)+'% / 防御+'+
   Math.round(squadEquipmentBonus(s).defense*100)+'%</small></div>';
 }).join('');
}

export function renderInnFormationWizard({game,view='teamPick',teamId=1,rosterSlot=0,
 rosterPage=0,formationPage=0,gearSourceId='',gearCategory='武器',gearPage=0}={}){
 ensureSortiePlan(game);
 const teams=sortieTeams(game),team=currentTeam(game,teamId),members=currentSources(game,team);
 const step=stageByStep[view]??0;
 const total=teams.reduce((n,t)=>n+sortieTeamCount(t),0),limit=sortiePlanningLimit(game);
 const header='<div class="sortieWizardHeader"><small>宿屋｜'+names[step]+'　'+(step+1)+' / 6</small>'+
  '<strong>'+(view==='teamPick'?'どの隊を編成する？':view==='rosterPick'?'ジョブを選択':view==='equipmentPick'?'装備品を選択':
   view==='roster'?'第'+team.id+'隊の隊員・人数':view==='equipment'?'第'+team.id+'隊の装備':
   view==='leader'?'第'+team.id+'隊のリーダー':view==='formation'?'第'+team.id+'隊で使える陣形':
   '第'+team.id+'隊の編成内訳')+'</strong>'+
  '<span>'+(view==='teamPick'?'編成する隊を選ぶと、その隊の隊員から順に設定します。':
   view==='roster'?'最大3ジョブ。先に隊員と人数を決め、条件に合う陣形を後から選びます。':
   view==='equipment'?'武器と防具はジョブごとの装備です。変更・解除ができます。':
   view==='leader'?'この隊に配属したジョブの代表からリーダーを選びます。':
   view==='formation'?'人数・レアリティ・職業・軍師Lv.を満たす陣形のみ選べます。戦闘中も陣形の目的に沿って動きます。':
   view==='review'?'隊員・装備・リーダー・陣形を確認して保存します。':
   '選択した内容は前の画面に戻っても残ります。')+'</span></div>';
 let body='',back=null,next=null;
 if(view==='teamPick'){
  body='<div class="sortieWizardChoices innWizardTeamChoices">'+teams.map(t=>{
   const tMembers=currentSources(game,t),captain=game.campaign.squads.find(s=>String(s.id)===String(t.captainId));
   const formation=SORTIE_FORMATIONS[t.formation];
   return button('data-inn-wizard-team="'+t.id+'"',
    '<span class="sortieWizardStrategyIcon">⚑</span><span class="sortieWizardStrategyDetails"><b>第'+t.id+'隊</b>'+
    '<small>'+sortieTeamCount(t)+'人・'+tMembers.length+'ジョブ・'+esc(formation?.name||'未設定')+'</small>'+
    '<small>リーダー：'+(captain?sourceLabel(captain):'未選択')+'</small></span>');
  }).join('')+'</div>';
 }else if(view==='roster'){
  const rows=Array.from({length:3},(_,index)=>{
   const id=team.slots[index],s=game.campaign.squads.find(x=>String(x.id)===String(id));
   const count=s?team.counts[String(s.id)]||0:0;
   return '<div class="innWizardRosterRow"><div><b>'+(index+1)+'枠：'+(s?esc(s.job):'空き')+'</b>'+
    '<small>'+(s?esc(s.rarity||'N')+' · '+sourceLabel(s)+' · '+count+'人':'ジョブを追加できます')+'</small></div>'+
    '<div class="innWizardRosterControls">'+
    (s?button('data-inn-wizard-count="'+esc(s.id)+'" data-delta="-1"','−1')+
      '<b>'+count+'人</b>'+button('data-inn-wizard-count="'+esc(s.id)+'" data-delta="1"','＋1'):'')+
    button('data-inn-wizard-slot="'+index+'"',s?'変更':'選択')+'</div></div>';
  }).join('');
  body='<div class="innWizardRoster">'+rows+'</div>'+
   '<small class="innWizardInfo">全隊の出撃予定 '+total+'/'+limit+'人。兵員の複製はせず、ほかの隊で編成中の人数を除外します。</small>';
  back='teamPick';next='equipment';
 }else if(view==='rosterPick'){
  const options=game.campaign.squads.filter(s=>s.count>0);
  const per=5,page=Math.max(0,Math.min(Math.ceil(options.length/per)-1,Number(rosterPage)||0));
  body='<div class="sortieWizardChoices">'+options.slice(page*per,page*per+per).map(s=>{
   const inTeam=Number(team.counts[String(s.id)]||0),elsewhere=employed(game,team,s),available=s.count-elsewhere-inTeam;
   const inOtherSlot=team.slots.some((id,i)=>i!==Number(rosterSlot)&&String(id)===String(s.id));
   return button('data-inn-wizard-roster-job="'+esc(s.id)+'" '+(inOtherSlot||(!available&&String(team.slots[rosterSlot])!==String(s.id))?'disabled':''),
    '<span class="sortieWizardStrategyIcon">⚔</span><span class="sortieWizardStrategyDetails"><b>'+
    esc(s.job)+' · '+esc(s.rarity||'N')+'</b><small>'+sourceLabel(s)+'</small>'+
    '<small>保有'+s.count+'人／他隊'+elsewhere+'人／追加可能'+Math.max(0,available)+'人</small></span>',
    String(team.slots[rosterSlot])===String(s.id));
  }).join('')+'</div>'+
   '<div class="sortieWizardPager">'+button('data-inn-wizard-roster-page="-1" '+(page===0?'disabled':''),'◀ 前')+
   '<small>'+(page+1)+' / '+Math.max(1,Math.ceil(options.length/per))+'</small>'+
   button('data-inn-wizard-roster-page="1" '+(page>=Math.ceil(options.length/per)-1?'disabled':''),'次 ▶')+'</div>'+
   button('data-inn-wizard-roster-job=""','この枠を空ける');
  back='roster';
 }else if(view==='equipment'){
  body='<div class="innWizardRoster">'+members.map(s=>{
   const gear=s.equipment||{};
   return '<div class="innWizardMember"><b>'+esc(s.job)+' · '+esc(s.rarity||'N')+'</b>'+
    '<div class="innWizardGearLinks">'+
    button('data-inn-wizard-gear-source="'+esc(s.id)+'" data-category="武器"','武器：'+esc(gearName(gear.weapon)))+
    button('data-inn-wizard-gear-source="'+esc(s.id)+'" data-category="防具"','防具：'+esc(gearName(gear.armor)))+'</div></div>';
  }).join('')+'</div>'+
   '<small class="innWizardInfo">保有装備は共有在庫です。同じ装備を別ジョブにも使う場合は個数が必要です。</small>';
  back='roster';next='leader';
 }else if(view==='equipmentPick'){
  const s=members.find(x=>String(x.id)===String(gearSourceId));
  const slot=gearCategory==='防具'?'armor':'weapon';
  const options=TOWN_SHOP.filter(x=>x.category===gearCategory&&(!x.jobs||x.jobs.includes(s?.job)));
  body='<small class="innWizardInfo">'+(s?esc(s.job):'隊員未選択')+' ／ '+esc(gearCategory)+'</small>'+
   '<div class="sortieWizardChoices">'+
   button('data-inn-wizard-equip=""','<span class="sortieWizardStrategyIcon">×</span><span class="sortieWizardStrategyDetails"><b>装備を外す</b></span>',!s?.equipment?.[slot])+
   options.map(item=>{
    const used=game.campaign.squads.filter(x=>x.id!==s?.id&&x.count>0&&x.equipment?.[slot]===item.id).length;
    const own=Number(game.inventory[item.id]||0);
    const equipped=s?.equipment?.[slot]===item.id;
    return button('data-inn-wizard-equip="'+esc(item.id)+'" '+(own<=used&&!equipped?'disabled':''),
     '<span class="sortieWizardStrategyIcon">'+(gearCategory==='防具'?'🛡':'⚔')+'</span><span class="sortieWizardStrategyDetails"><b>'+esc(item.name)+'</b><small>'+esc(item.description)+'</small>'+
     '<small>所持 '+own+'／他の隊が使用 '+used+(own<=used&&!equipped?' · 在庫不足':'')+'</small></span>',equipped);
   }).join('')+'</div>';
  back='equipment';
 }else if(view==='leader'){
  body='<div class="sortieWizardChoices">'+members.map(s=>button('data-inn-wizard-leader="'+esc(s.id)+'"',
   '<span class="sortieWizardStrategyIcon">♛</span><span class="sortieWizardStrategyDetails"><b>'+sourceLabel(s)+'</b>'+
   '<small>'+esc(s.job)+' · '+esc(s.rarity||'N')+' · '+(team.counts[String(s.id)]||0)+'人</small></span>',
   String(team.captainId)===String(s.id))).join('')+'</div>'+
   (members.length?'':'<small class="innWizardInfo">隊員を選択してからリーダーを決めてください。</small>');
  back='equipment';next='formation';
 }else if(view==='formation'){
  const ids=Object.keys(SORTIE_FORMATIONS),per=4,pages=Math.ceil(ids.length/per);
  const page=Math.max(0,Math.min(pages-1,Number(formationPage)||0));
  const options=ids.slice(page*per,page*per+per);
  body='<div class="sortieWizardFormationChoices innWizardFormations">'+options.map(id=>{
   const f=SORTIE_FORMATIONS[id],elig=inspectInnFormation(game,team.id,id),brief=purpose(id);
   const cells=SORTIE_FORMATION_CELLS[id].slice(0,f.slots),roles=FORMATION_ROLES[id];
   const mini=Array.from({length:16},(_,i)=>{
    const roleIndex=cells.indexOf(i);
    const label=roleIndex<0?'':ROLE_NAMES[roles[roleIndex]]?.slice(0,1)||'●';
    return '<i class="'+(roleIndex<0?'':'occupied')+'">'+esc(label)+'</i>';
   }).join('');
   return button('data-inn-wizard-formation="'+id+'" '+(!elig.eligible?'disabled':''),
    '<span class="sortieWizardFormationTitle"><b>'+esc(f.name)+'</b></span>'+
    '<small>目的：'+esc(brief.purpose)+'</small>'+
    '<span class="sortieWizardOldMiniGrid sortieMiniGrid">'+mini+'</span>'+
    '<small>動き：'+esc(brief.movement)+'</small>'+
    '<small>条件：Lv.'+f.level+'・'+esc(requirement(id))+'</small>'+
    '<small class="sortieWizardFormationBonus">攻撃+'+Math.round((f.attack||0)*100)+'%／防御+'+Math.round((f.defense||0)*100)+'%</small>'+
    '<small>'+(elig.eligible?'✓ 利用可能':'🔒 '+esc(elig.reason))+'</small>',team.formation===id);
  }).join('')+'</div>'+
   '<div class="sortieWizardPager">'+button('data-inn-wizard-formation-page="-1" '+(!page?'disabled':''),'◀ 前の陣形')+
   '<small>'+(page+1)+' / '+pages+'</small>'+
   button('data-inn-wizard-formation-page="1" '+(page>=pages-1?'disabled':''),'次の陣形 ▶')+'</div>'+
   '<small class="innWizardInfo">必要なジョブ・レアリティ・人数が足りない陣形は選べません。高性能ほど厳しい条件です。</small>';
  back='leader';
 }else{
  const f=SORTIE_FORMATIONS[team.formation],brief=purpose(team.formation);
  body='<div class="innWizardReview"><div class="innWizardReviewSummary"><b>第'+team.id+'隊 · '+esc(f?.name||'自由陣形')+'</b>'+
   '<small>合計 '+sortieTeamCount(team)+'人／'+members.length+'ジョブ</small>'+
   '<small>目的：'+esc(brief.purpose)+'</small>'+
   '<small>動き：'+esc(brief.movement)+'</small></div>'+
   rosterBreakdown(game,team)+
   '<div class="innWizardReviewSummary"><b>隊長：'+
   (members.find(s=>String(s.id)===String(team.captainId))?
     sourceLabel(members.find(s=>String(s.id)===String(team.captainId))):'未選択')+'</b>'+
   '<small>陣形補正：攻撃+'+Math.round((f?.attack||0)*100)+
   '%／防御+'+Math.round((f?.defense||0)*100)+
   '%／移動'+Math.round((f?.mobility||0)*100)+'%／魔法+'+
   Math.round((f?.magic||0)*100)+'%</small></div></div>'+
   button('data-inn-wizard-save="1"','✓ この隊の編成を保存');
  back='formation';
 }
 return '<section class="sortiePlanner sortieWizard innWizard" aria-label="宿屋の隊員から始める陣形編成">'+
  header+'<div class="sortieWizardBody innWizardBody">'+body+'</div>'+
  endActions(back,next)+'</section>';
}
