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
import {trainingSoldierStock,inspectTrainingFormationPurchase} from './training-formation-purchase.js';
import {TOWN_SHOP,squadEquipmentBonus,trainingHireCapacity} from './game-core-flow.js';
import {INN_CONSUMABLES,teamItemStock,innTeamItemsSummary} from './inn-team-items.js';
import {formationUnlockLabels} from './formation-strategy-unlocks.js';
import {signatureStrategyFor,renderFormationSignaturePreview} from './formation-signature-strategies.js';
import {JOBS,RARITIES} from './story-campaign.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button=(attr,title,selected=false)=>'<button type="button" '+attr+' class="'+(selected?'selected':'')+'">'+title+'</button>';
const sourceLabel=s=>esc(s.characterName||s.name||s.job+'代表');
const gearName=id=>TOWN_SHOP.find(x=>x.id===id)?.name||'装備なし';
const names=['隊の選択','隊員と人数','装備','持参アイテム','リーダー','陣形','編成確認'];
const stageByStep={hire:0,teamPick:0,roster:1,rosterQuote:1,rosterPick:1,equipment:2,equipmentPick:2,items:3,leader:4,formation:5,review:6};
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
 (next?button('data-inn-wizard-next="1"',next==='equipment'?'次へ：武器・防具 ▶':'次へ ▶'):'<span></span>')+'</footer>';
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
 rosterPage=0,formationPage=0,gearSourceId='',gearCategory='武器',gearPage=0,
 rosterPreviewId='',rosterFormationPage=0,hireCount=1}={}){
 ensureSortiePlan(game);
 const teams=sortieTeams(game),team=currentTeam(game,teamId),members=currentSources(game,team);
 const step=stageByStep[view]??0;
 const total=teams.reduce((n,t)=>n+sortieTeamCount(t),0),limit=sortiePlanningLimit(game);
 const header='<div class="sortieWizardHeader"><small>軍訓練所｜'+names[step]+'　'+(step+1)+' / 7</small>'+
  '<strong>'+(view==='teamPick'?'どの隊を編成する？':view==='hire'?'兵士を雇用':view==='rosterPick'?'ジョブを選択':view==='equipmentPick'?'装備品を選択':
   view==='roster'?'第'+team.id+'隊の隊員・人数':view==='rosterQuote'?'陣形の兵数・費用確認':view==='equipment'?'第'+team.id+'隊の装備':view==='items'?'第'+team.id+'隊の持参アイテム':
   view==='leader'?'第'+team.id+'隊のリーダー':view==='formation'?'第'+team.id+'隊で使える陣形':
   '第'+team.id+'隊の編成内訳')+'</strong>'+
  '<span>'+(view==='teamPick'?'編成する隊を選ぶか、兵士を雇用してください。酒場のガチャも利用できます。':
   view==='hire'?'所持金で希望のジョブと人数を指定して雇用します。軍資金は使用しません。':
   view==='roster'?'最大3ジョブ。陣形の動きは下で確認できます。武器・防具は「次へ」で設定します。':
   view==='rosterQuote'?'在庫兵・追加雇用・支払額を確認して、陣形へ一括配置します。':
   view==='equipment'?'武器と防具はジョブごとの装備です。変更・解除ができます。':
   view==='items'?'道具屋で買ったアイテムを隊に分配します。共有在庫を超えて配布できません。':
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
  }).join('')+'</div>'+button('data-training-open="1"','⚔ 兵士を雇用する（所持金 '+Math.floor(game.wallet)+'G）');
 }else if(view==='hire'){
  const capacity=trainingHireCapacity(game,'N','player');
  const stock=trainingSoldierStock(game,team.id);
  const n=Math.max(1,Math.min(100,Math.trunc(Number(hireCount)||1)));
  const armyUsed=100-capacity.commanderSpace;
  body='<div class="trainingHireCapacity" aria-live="polite">'+
   '<b>所持金：'+capacity.wallet+'G ／ 雇用単価：'+capacity.unitCost+'G／人</b>'+
   '<strong>今、補充できる人数：最大 '+capacity.max+'人</strong>'+
   '<small>所持金で '+capacity.affordable+'人分 ／ 現在の軍師隊 '+armyUsed+'/100人（残り'+capacity.commanderSpace+'人）／全軍空き'+capacity.armySpace+'人</small>'+
   '</div>'+
   '<div class="trainingHireCount"><b>雇用人数</b>'+
    '<div class="trainingHireQuick">'+[1,5,10].map(q=>button('data-training-hire-count="'+q+'" '+(q>capacity.max?'disabled':''),q+'人',q===n)).join('')+
     button('data-training-hire-count="'+capacity.max+'" '+(!capacity.max?'disabled':''),'最大 '+capacity.max+'人',capacity.max===n)+
    '</div>'+
    '<label class="trainingHireNumber">希望人数 <input type="number" data-training-hire-input="1" inputmode="numeric" min="1" max="'+capacity.max+'" value="'+n+'" '+(!capacity.max?'disabled':'')+' aria-label="希望する雇用人数"></label>'+
   '</div>'+
   '<small class="innWizardInfo">'+n+'人の雇用費 '+(n*capacity.unitCost)+'G　'+
    (n>capacity.max?'⚠ 雇用できる最大人数を超えています':'雇用後の所持金 '+(capacity.wallet-n*capacity.unitCost)+'G')+'</small>'+
   '<div class="trainingHireJobs">'+JOBS.map(job=>{
    const price=n*RARITIES.N.hire;
    const ranks=stock.byJob.filter(r=>r.job===job);
    const onHand=ranks.reduce((sum,r)=>sum+r.available,0);
    const byRarity=ranks.filter(r=>r.available>0).map(r=>r.rarity+':'+r.available).join(' / ')||'なし';
    const waiting=ranks.reduce((sum,r)=>sum+r.reserve,0);
    const label='<span class="trainingHireJobLabel"><b>'+esc(job)+'</b>'+
     '<small>在庫兵 '+onHand+'人（'+esc(byRarity)+'）'+(waiting?' / 予備 '+waiting+'人':'')+'</small>'+
     '<small>N兵 '+n+'人補充：'+price+'G</small></span>';
    return button('data-training-hire="'+esc(job)+'" '+(n>capacity.max||!capacity.max?'disabled':''),label);
   }).join('')+'</div><small class="innWizardInfo">在庫兵は各ジョブ別に表示。配置済み兵は在庫に含めません。ガチャ仲間は酒場で獲得後に編成します。</small>';
  back='teamPick';
 }else if(view==='roster'){
  const rows=Array.from({length:3},(_,index)=>{
   const id=team.slots[index],s=game.campaign.squads.find(x=>String(x.id)===String(id));
   const count=s?team.counts[String(s.id)]||0:0;
   return '<div class="innWizardRosterRow"><div><b>'+(index+1)+'枠：'+(s?esc(s.job):'空き')+'</b>'+
    '<small>'+(s?'⚔ '+esc(gearName(s.equipment?.weapon))+' ／ 🛡 '+esc(gearName(s.equipment?.armor))+' · '+esc(s.rarity||'N'):'ジョブを追加できます')+'</small></div>'+
    '<div class="innWizardRosterControls">'+
    (s?button('data-inn-wizard-count="'+esc(s.id)+'" data-delta="-1"','−1')+
      '<b>'+count+'人</b>'+button('data-inn-wizard-count="'+esc(s.id)+'" data-delta="1"','＋1'):'')+
    button('data-inn-wizard-slot="'+index+'"',s?'変更':'選択')+'</div></div>';
  }).join('');

  const stock=trainingSoldierStock(game,team.id);
  const entries=Object.keys(SORTIE_FORMATIONS).map(id=>({
   id,...inspectInnFormation(game,team.id,id)
  }));
  const usable=entries.filter(entry=>entry.eligible).length;
  const allCount=entries.length,per=3;
  const maxPage=Math.max(0,Math.ceil(allCount/per)-1);
  const currentPage=Math.max(0,Math.min(maxPage,Number(rosterFormationPage)||0));
  const display=entries.slice(currentPage*per,(currentPage+1)*per);
  const previewEntry=display.find(entry=>entry.id===rosterPreviewId)||
   display.find(entry=>entry.id===team.formation)||display[0];
  const previewId=previewEntry?.id;
  const preview=previewId?SORTIE_FORMATIONS[previewId]:null;
  const plan=previewId?signatureStrategyFor(previewId):null;
  const purchase=previewId?inspectTrainingFormationPurchase(game,team.id,previewId):null;
  const needLabel=entry=>{
   if(entry.eligible)return '✓ 使用可能';
   const peopleLeft=Math.max(0,(entry.requirements?.people||0)-entry.total);
   return peopleLeft?'あと'+peopleLeft+'人':'職業・条件不足';
  };
  body='<div class="innWizardRoster">'+rows+'</div>'+
   '<small class="innWizardInfo">出撃予定 '+total+'/'+limit+'人 · 武器・防具は次の画面で設定</small>'+
   '<div class="innWizardRosterPreview" aria-label="陣形の使用可否と不足人数">'+
    '<div class="trainingFormationHeading"><b>陣形一覧　使用可 '+usable+' / '+allCount+'</b>'+
    '<small>不足条件もタップで確認</small></div>'+
    '<div class="trainingFormationList" role="group" aria-label="陣形一覧と残り必要人数">'+
     display.map(entry=>{
      const name=SORTIE_FORMATIONS[entry.id].name;
      return button('data-inn-wizard-preview="'+esc(entry.id)+'" aria-label="'+esc(name+' '+needLabel(entry))+'"',
       '<span>'+esc(name)+'</span><small>'+esc(needLabel(entry))+'</small>',entry.id===previewId)
       .replace('class="','class="'+(entry.eligible?'trainingAvailable ':'trainingLocked '));
     }).join('')+
    '</div>'+
    (maxPage?'<div class="trainingFormationPager">'+
     button('data-inn-wizard-roster-formation-page="-1" '+(!currentPage?'disabled':''),'◀')+
     '<small>'+(currentPage+1)+' / '+(maxPage+1)+'</small>'+
     button('data-inn-wizard-roster-formation-page="1" '+(currentPage===maxPage?'disabled':''),'▶')+
     '</div>':'')+
    (preview?
     '<div class="trainingFormationDemo" aria-label="選択した陣形の動作と補充見積り">'+
      '<b>'+esc(preview.name)+'：'+esc(plan?.name||'基本隊列')+'</b>'+
      '<div class="trainingFormationAnimation" aria-label="陣形の動作アニメーション">'+
       renderFormationSignaturePreview(previewId,{labels:FORMATION_ROLES[previewId].slice(0,3).map(role=>ROLE_NAMES[role]||'分隊')})+
      '</div>'+
      '<small class="trainingFormationPurpose">'+esc(plan?.summary||purpose(previewId).movement)+'</small>'+
      '<small class="trainingFormationRequirements">'+
       (previewEntry.eligible?'✓ 出撃条件達成':
         '不足：'+(Math.max(0,(previewEntry.requirements?.people||0)-previewEntry.total)?'あと'+
           Math.max(0,(previewEntry.requirements?.people||0)-previewEntry.total)+'人　':'')+
         esc(previewEntry.reason))+
      '</small>'+
       '<div class="trainingFormationQuick"><small>所持金 '+stock.wallet+'G・'+(purchase?.possible?'追加 '+(purchase.hireCount||0)+'人／'+(purchase.cost||0)+'G':'配置条件を確認')+'</small>'+
        button('data-inn-wizard-quote="'+esc(previewId)+'"','在庫・雇用見積り ▶')+'</div>'+
       '</div></div>':'')+
   '</div>';
  back='teamPick';next='equipment';
 }else if(view==='rosterQuote'){
  const id=SORTIE_FORMATIONS[rosterPreviewId]?rosterPreviewId:Object.keys(SORTIE_FORMATIONS)[0];
  const preview=SORTIE_FORMATIONS[id],plan=signatureStrategyFor(id);
  const inspection=inspectInnFormation(game,team.id,id);
  const purchase=inspectTrainingFormationPurchase(game,team.id,id);
  const stock=trainingSoldierStock(game,team.id);
  body='<div class="trainingFormationDetail">'+
   '<strong>'+esc(preview.name)+'：'+esc(plan?.name||'基本隊列')+'</strong>'+
   '<div class="trainingFormationAnimation" aria-label="陣形の動作アニメーション">'+
     renderFormationSignaturePreview(id,{labels:(FORMATION_ROLES[id]||[]).slice(0,3).map(role=>ROLE_NAMES[role]||'分隊')})+
   '</div>'+
   '<small>'+esc(plan?.summary||purpose(id).movement)+'</small>'+
   '<div class="trainingFormationQuote" aria-live="polite">'+
    '<b>所持金 '+stock.wallet+'G ／ 陣形必要人数 '+(purchase?.total||inspection.requirements?.people||0)+'人</b>'+
    (purchase?.allocations?.length?'<small>'+purchase.allocations.map(p=>
      esc(p.job)+' '+esc(p.rarity)+' '+p.count+'人（既存'+(p.count-p.hire)+'／補充'+p.hire+'）').join(' · ')+'</small>':'')+
    '<small>追加雇用 '+(purchase?.hireCount||0)+'人 ／ 支払 '+(purchase?.cost||0)+'G'+
     (purchase?.possible?' ／ 支払後 '+(stock.wallet-(purchase.cost||0))+'G':' ／ '+esc(purchase?.reason||'編成不可'))+'</small>'+
    button('data-training-auto-formation="'+esc(id)+'" '+(!purchase?.possible?'disabled':''),
     purchase?.possible?'✓ '+(purchase.hireCount?'在庫＋雇用で配置する':'在庫兵だけで配置する')+'（'+purchase.cost+'G）':'条件不足：雇用・配置できません')+
   '</div></div>';
  back='roster';next='equipment';
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
  back='roster';next='items';
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
 }else if(view==='items'){
  body='<div class="innWizardRoster">'+INN_CONSUMABLES.map(item=>{
   const stock=teamItemStock(game,team.id,item.id);
   return '<div class="innWizardMember"><div><b>🎒 '+esc(item.name)+'</b><small>'+esc(item.description)+'</small>'+
    '<small>全軍所持 '+stock.owned+'個 ／ 他隊へ '+stock.assigned+'個 ／ 残り '+stock.available+'個</small></div>'+
    '<div class="innWizardRosterControls">'+
    button('data-inn-wizard-item="'+esc(item.id)+'" data-delta="-1" '+(!stock.current?'disabled':''),'−')+
    '<b>'+stock.current+'個</b>'+
    button('data-inn-wizard-item="'+esc(item.id)+'" data-delta="1" '+(!stock.available?'disabled':''),'＋')+
    '</div></div>';
  }).join('')+'</div>'+
   '<small class="innWizardInfo">持参品はここで予約します。実際に使用すると戦闘中に1個減ります。</small>';
  back='equipment';next='leader';
 }else if(view==='leader'){
  body='<div class="sortieWizardChoices">'+members.map(s=>button('data-inn-wizard-leader="'+esc(s.id)+'"',
   '<span class="sortieWizardStrategyIcon">♛</span><span class="sortieWizardStrategyDetails"><b>'+sourceLabel(s)+'</b>'+
   '<small>'+esc(s.job)+' · '+esc(s.rarity||'N')+' · '+(team.counts[String(s.id)]||0)+'人</small></span>',
   String(team.captainId)===String(s.id))).join('')+'</div>'+
   (members.length?'':'<small class="innWizardInfo">隊員を選択してからリーダーを決めてください。</small>');
  back='items';next='formation';
 }else if(view==='formation'){
  const ids=Object.keys(SORTIE_FORMATIONS),per=1,pages=Math.ceil(ids.length/per);
  const page=Math.max(0,Math.min(pages-1,Number(formationPage)||0));
  const options=ids.slice(page*per,page*per+per);
  body='<div class="sortieWizardFormationChoices innWizardFormations">'+options.map(id=>{
   const f=SORTIE_FORMATIONS[id],elig=inspectInnFormation(game,team.id,id),brief=purpose(id);
   const signature=signatureStrategyFor(id);
   const cells=SORTIE_FORMATION_CELLS[id].slice(0,f.slots),roles=FORMATION_ROLES[id];
   const mini=Array.from({length:16},(_,i)=>{
    const roleIndex=cells.indexOf(i);
    const label=roleIndex<0?'':ROLE_NAMES[roles[roleIndex]]?.slice(0,1)||'●';
    return '<i class="'+(roleIndex<0?'':'occupied')+'">'+esc(label)+'</i>';
   }).join('');
   return button('data-inn-wizard-formation="'+id+'" '+(!elig.eligible?'disabled':''),
    '<span class="sortieWizardFormationTitle"><b>'+esc(f.name)+'</b></span>'+
    '<small>目的：'+esc(brief.purpose)+'</small>'+
    renderFormationSignaturePreview(id,{labels:roles.slice(0,3).map(role=>ROLE_NAMES[role]||'分隊')})+
    '<small>動き：'+esc(brief.movement)+'</small>'+ 
    '<strong class="signatureName">★ 専用作戦：'+esc(signature?.name||'未設定')+'</strong>'+
    '<small class="signatureSummary">'+esc(signature?.summary||'')+'</small>'+ 
    '<small>追加作戦：'+esc(formationUnlockLabels(id).join('・')||'基本作戦のみ')+'</small>'+
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
   '<small>動き：'+esc(brief.movement)+'</small>'+ 
   '<small>陣形専用作戦：'+esc(signatureStrategyFor(team.formation)?.name||'なし')+'</small>'+ 
   '<small>追加作戦：'+esc(formationUnlockLabels(team.formation).join('・')||'基本作戦のみ')+'</small></div>'+
   rosterBreakdown(game,team)+
   '<div class="innWizardReviewSummary"><b>🎒 持参アイテム</b><small>'+
    esc(innTeamItemsSummary(game,team.id).map(x=>x.name+' ×'+x.quantity).join(' ／ ')||'なし')+'</small></div>'+
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
 return '<section class="sortiePlanner sortieWizard innWizard" aria-label="軍訓練所の隊員から始める陣形編成">'+
  header+'<div class="sortieWizardBody innWizardBody">'+body+'</div>'+
  endActions(back,next)+'</section>';
}
