import {
 SORTIE_FORMATIONS,SORTIE_GRID_CELLS,SORTIE_FORMATION_CELLS,sortieFormationStatus,sortieAllowedCells,sortieCellJobs,ensureSortiePlan,sortieTeams,sortieSquadCap,sortieLevel,sortieFormationBuff,unlockedSortieFormations,sortieDebuffTypes,
 sortieTeamCount,sortieTeamSquads,sortieAdjacentJobs,availableSortieOrders,sortiePlanningStage,sortiePlanningLimit,sortieTemplateCapacity
} from './three-team-sortie.js';
import {FORMATION_ROLES,ROLE_NAMES,FREE_FORMATION_NAME,formationJobMinimums,formationMinimumForRole} from './sortie-formation-logic.js';
import {SORTIE_RARITIES,rarityOf} from './sortie-formation-template-rules.js';
import {STRATEGY_TREE,STRATEGY_METHODS,STORY_JOB_TO_STRATEGY_JOB} from './three-step-strategy-catalog.js';
import {planStrategyDistribution} from './targeted-strategy-runtime.js';
import {battleTeamParameters,BATTLE_TRAIT_LABELS,recommendBattlePlans,battleStageContext} from './battle-plan-recommendations.js';
import {TACTICAL_ORDERS} from './tactical-command-descriptions.js';
import {THREE_TEAM_AUTO_MODES} from './three-team-auto-composition.js';
import {THREE_TEAM_STRATEGY_TYPES,savedThreeTeamStrategy,selectedThreeTeamStrategy,orderedThreeTeamFormations,suggestedThreeTeamFormations} from './three-team-strategy-presets.js';
const FOUR_STRATEGY_FAMILIES=Object.freeze({attack:STRATEGY_TREE.attack,defense:STRATEGY_TREE.defense,
 balanced:{name:'バランス',intents:{...STRATEGY_TREE.support.intents,...STRATEGY_TREE.weaken.intents}},
 explore:{name:'探索',intents:{...STRATEGY_TREE.explore.intents,...STRATEGY_TREE.environment.intents}}});
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button=(attr,title,selected=false)=>'<button type="button" '+attr+' class="'+(selected?'selected':'')+'">'+title+'</button>';

/**
 * Primary inn flow: one decision per screen, with a single three-team
 * formation template saved for each battle strategy.
 */
function renderThreeTeamStrategyWizard({game,teamId,view,templatePage}){
 const strategy=selectedThreeTeamStrategy(game),rule=THREE_TEAM_STRATEGY_TYPES[strategy];
 const teams=sortieTeams(game),cap=sortiePlanningLimit(game);
 const total=teams.reduce((n,t)=>n+sortieTeamCount(t),0);
 const current=teams[Math.max(0,Math.min(2,Number(teamId)-1))];
 const step=view==='strategy'?1:view==='review'?5:current.id+1;
 const header='<header class="sortieWizardHeader"><small>作戦別・3隊陣形テンプレート　'+step+' / 5</small>'+
  '<strong>'+(view==='strategy'?'どの作戦で戦う？':view==='review'?'3隊の編成を確認':rule.name+'：第'+current.id+'隊の陣形は？')+'</strong>'+
  '<span>'+(view==='strategy'?'作戦を1つ選ぶと、第1隊から順番に設定します。':
   view==='review'?'この組み合わせを「'+esc(rule.name)+'」のテンプレートとして保存します。':
   '第'+current.id+'隊は最大3ジョブ。陣形を1つ選ぶと次の隊へ進みます。')+'</span></header>';
 const back=view==='strategy'?'':button('data-sortie-plan-back="1"',view==='review'?'◀ 第3隊へ戻る':current.id===1?'◀ 作戦を選び直す':'◀ 第'+(current.id-1)+'隊へ戻る');
 let content='';
 if(view==='strategy'){
  content='<div class="sortieWizardChoices" role="group" aria-label="作戦を1つ選択">'+
   Object.entries(THREE_TEAM_STRATEGY_TYPES).map(([id,entry])=>{
    const saved=savedThreeTeamStrategy(game,id);
    const names=(saved?.teams?.map(t=>SORTIE_FORMATIONS[t.formation]?.name||'未設定')||
     suggestedThreeTeamFormations(game,id).map(key=>SORTIE_FORMATIONS[key]?.name||'未設定')).join(' / ');
    return button('data-sortie-plan-strategy="'+id+'"',
     '<b>'+esc(entry.name)+'</b><small>'+esc(entry.description)+'</small>'+
     '<small>'+(saved?'保存済み：':'推奨：')+esc(names)+'</small>');
   }).join('')+'</div>';
 }else if(view==='formationPick'){
  const ids=orderedThreeTeamFormations(game,strategy),limit=4;
  const pages=Math.max(1,Math.ceil(ids.length/limit));
  const page=Math.max(0,Math.min(pages-1,Number(templatePage)||0));
  const suggestions=new Set(rule.recommended.flat());
  content='<div class="sortieWizardTeamState">現在：<b>'+esc(SORTIE_FORMATIONS[current.formation]?.name||'自由陣形')+
   '</b><small>第'+current.id+'隊 '+sortieTeamCount(current)+'人</small></div>'+
   '<div class="sortieWizardChoices" role="group" aria-label="第'+current.id+'隊の陣形を1つ選択">'+
   ids.slice(page*limit,(page+1)*limit).map(id=>{
    const f=SORTIE_FORMATIONS[id],enabled=f.level<=sortieLevel(game);
    const jobs=FORMATION_ROLES[id].slice(0,f.slots).map(x=>ROLE_NAMES[x]).join('・');
    return button('data-sortie-plan-formation="'+id+'" '+(!enabled?'disabled':''),
     '<b>'+esc(f.name)+(suggestions.has(id)?' <em>推奨</em>':'')+'</b>'+
     '<small>'+f.slots+'ジョブ・'+esc(jobs)+' · Lv.'+f.level+(!enabled?' 未解放':'')+'</small>'+
     '<small>攻撃 '+Math.round((f.attack||0)*100)+'% / 防御 '+Math.round((f.defense||0)*100)+
     '% / 移動 '+Math.round((f.mobility||0)*100)+'%</small>',current.formation===id);
   }).join('')+'</div>'+
   '<div class="sortieWizardPager">'+
    button('data-sortie-template-page="'+(page-1)+'" '+(!page?'disabled':''),'◀ 前の陣形')+
    '<small>'+(page+1)+' / '+pages+'</small>'+
    button('data-sortie-template-page="'+(page+1)+'" '+(page===pages-1?'disabled':''),'次の陣形 ▶')+
   '</div>';
 }else{
  const saved=savedThreeTeamStrategy(game,strategy);
  content='<div class="sortieWizardReview">'+teams.map(t=>{
   const f=SORTIE_FORMATIONS[t.formation],status=sortieFormationStatus(game,t.id),buff=sortieFormationBuff(game,t.id);
   return '<div class="sortieWizardReviewTeam"><div><b>第'+t.id+'隊　'+esc(f?.name||'自由陣形')+'</b>'+
    '<small>'+sortieTeamCount(t)+'人・'+sortieTeamSquads(game,t.id).length+'ジョブ · '+
    (status.valid?'陣形成立':'陣形条件未達')+'</small>'+
    '<small>攻撃 '+Math.round(buff.attack*100)+'% / 防御 '+Math.round(buff.defense*100)+'% / 魔法 '+
    Math.round((buff.magic||0)*100)+'%</small></div>'+
    button('data-sortie-plan-edit="'+t.id+'"','変更')+'</div>';
  }).join('')+'</div>'+
   '<div class="sortieWizardSummary">出撃予定 <b>'+total+' / '+cap+'人</b>'+
   '<small>条件未達の隊は陣形補正が有効になりません。兵士は複製されません。</small></div>'+
   button('data-sortie-plan-save="1"','この3隊を「'+esc(rule.name)+'」用に保存')+
   (saved?'<small class="sortieWizardSaved">この作戦の保存済みテンプレートがあります。保存すると上書きします。</small>':'')+
   '<details class="sortieWizardAdvanced"><summary>人数・ジョブ・固有作戦を細かく調整</summary>'+
   '<p>必要なときだけ既存の詳細編成画面へ進めます。</p>'+
   button('data-sortie-view="setup"','詳細調整を開く')+'</details>';
 }
 return '<section class="sortiePlanner sortieWizard" aria-label="作戦ごとに3隊の陣形を設定">'+
   header+'<div class="sortieWizardBody">'+content+'</div>'+
   '<footer class="sortieWizardFooter">'+back+(view==='review'?button('data-sortie-view="strategy"','別の作戦を選ぶ'):'')+'</footer></section>';
}

export function renderThreeTeamPlanner({game,teamId=1,cellIndex=5,view='setup',jobPage=0,templatePage=0,strategyFamily='attack',strategyIntent='melee'}){
 ensureSortiePlan(game);
 if(['strategy','formationPick','review'].includes(view))return renderThreeTeamStrategyWizard({game,teamId,view,templatePage});
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
 const plannedTotal=teams.reduce((n,t)=>n+sortieTeamCount(t),0),battleCap=sortiePlanningLimit(game);
 const inventoryTotal=sources.reduce((n,x)=>n+Number(x.count||0),0);
 const stageName=sortiePlanningStage(game)?.name||'次の戦闘';
 const quota=sortieTemplateCapacity(game,team.id);
 const tierSummary=SORTIE_RARITIES.map(t=>t+' '+quota.rarity[t]+'/'+quota.spec.rarityCaps[t]+'人').join(' · ');
 const capSummary=(quota.total+'/'+quota.capacity+'人 · '+tierSummary);
 const requiredJobs=team.formation==='free'?[]:formationJobMinimums(
  team,sources,SORTIE_FORMATION_CELLS,quota.spec.slots);
 const minByCell=new Map(requiredJobs.map(x=>[x.cell,x]));
 const minSummary=requiredJobs.map(x=>'<span class="'+(x.valid?'ok':'missing')+'">'+
  esc(x.job||x.options.join('/'))+'（'+esc(ROLE_NAMES[x.role])+'） '+
  x.current+'/'+x.min+'人</span>').join('');
 const groupButtons='<div class="sortieTeams" role="group" aria-label="隊の選択">'+teams.map(t=>{
  const total=sortieTeamCount(t),count=sortieTeamSquads(game,t.id).length;
  return button('data-sortie-team="'+t.id+'"','<strong>第'+t.id+'隊 · '+total+'人</strong><small>'+count+'/'+(SORTIE_FORMATIONS[t.formation]?.slots||cap)+'ジョブ</small>',t.id===team.id);
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
 const allowedCells=sortieAllowedCells(game,team.id);
 const cells=allowedCells.map(i=>{
  const source=byId.get(String(team.grid?.[i])),count=source?team.counts[String(source.id)]||0:0;
  const available=allowedCells.includes(i),jobs=sortieCellJobs(game,team.id,i),
   canMove=team.formation==='free'&&available,canAdjust=available&&Boolean(source);
  const inactive=!canMove&&!canAdjust;
  const minimum=minByCell.get(i);
  const label=source?esc(source.job):!available?'🔒':team.formation==='free'?'＋':'・';
  return button('data-sortie-cell="'+i+'" data-sortie-state="'+(!available?'locked':team.formation==='free'?'free':'formation')+'" '+(inactive?'disabled':'')+
    ' aria-label="'+(Math.floor(i/4)+1)+'行'+(i%4+1)+'列 '+(!available?'陣形枠外':source?esc(source.job)+' '+count+'人':'配置可能・'+(jobs?jobs.join('・'):'自由'))+'"',
    '<span>'+label+'</span>'+(source?'<small>'+count+'人'+(minimum?' / 最低'+minimum.min+'人':'')+'</small>':
     available&&jobs?'<small>最低'+(minimum?.min||1)+'人</small>':''),
    i===pos&&view!=='setup' );
 }).join('');
 const main='<div class="sortieBar">'+
  button('data-sortie-view="templates"','陣形：'+esc(team.formation==='free'?FREE_FORMATION_NAME:SORTIE_FORMATIONS[team.formation]?.name||'標準陣形')+' ▾')+
  button('data-sortie-view="orders"','作戦 '+(team.tactics||[]).length+'件選択 ▸')+
  '</div><div class="sortieGridHint"><b>第'+team.id+'隊・最大3ジョブ</b><small>陣形を先に選択してから配置</small></div>'+
  '<div class="sortieFormationGrid" role="group" aria-label="最大3ジョブの配置枠">'+cells+'</div>'+
  '<div class="sortieGridFooter"><small>陣形：'+quota.spec.slots+'ジョブ · '+esc(status.reason)+'</small>'+
  button('data-sortie-view="count"','人数 ▸')+button('data-sortie-view="divisions"','分隊 ▸')+'</div>'+
  '<div class="sortieCompactStatus">'+(status.valid?'✓ 陣形成立':'⚠ '+esc(status.reason))+
  '<div>この陣形 '+quota.total+'/'+quota.capacity+'人　'+esc(SORTIE_FORMATIONS[team.formation]?.name||'自由配置')+'</div>'+
  '<small class="sortieRarityCompact">'+esc(tierSummary)+'</small></div>'+
  '<details class="sortieMinimumDisclosure"><summary>各ジョブの最低配置人数と条件</summary>'+
  '<div class="sortieMinimumSummary"><b>各ジョブの最低配置人数（未達成はバフなし）</b><div>'+
  (minSummary||'<small>自由陣形：職業別最低人数なし・陣形バフなし</small>')+'</div></div></details>';
 const templateIds=Object.keys(SORTIE_FORMATIONS);
 const pageCap=6,templatePages=Math.ceil(templateIds.length/pageCap);
 const tPage=Math.max(0,Math.min(templatePages-1,Number(templatePage)||0));
 const templates='<div class="sortieSubHead"><b>陣形テンプレート · Lv.'+level+'</b>'+button('data-sortie-formation="free"','自由陣形',team.formation==='free')+back+'</div>'+
  '<div class="sortieTemplateChoices">'+templateIds.slice(tPage*pageCap,tPage*pageCap+pageCap).map(id=>{const entry=SORTIE_FORMATIONS[id],unlocked=entry.level<=level;
   const preview=Object.fromEntries(SORTIE_FORMATION_CELLS[id].slice(0,entry.slots).map((cell,index)=>[cell,FORMATION_ROLES[id][index]]));
   const extra=new Set(SORTIE_FORMATION_CELLS[id].slice(entry.slots,entry.slots));
   const grid=Array.from({length:16},(_,i)=>{
    const extraRank=SORTIE_FORMATION_CELLS[id].indexOf(i),role=extraRank>=0&&extraRank<entry.slots?FORMATION_ROLES[id][extraRank]:null;
    return '<i class="'+(preview[i]?'occupied':extra.has(i)?'extra':'')+'" title="'+esc(ROLE_NAMES[role]||'空き')+'">'+(role?esc(ROLE_NAMES[role].slice(0,1)):'')+'</i>';
   }).join('');
   return button('data-sortie-formation="'+id+'" '+(!unlocked?'disabled':'') ,'<b>'+esc(entry.name)+'</b><small>Lv.'+entry.level+' · '+entry.slots+'ジョブ · 最大'+entry.maxTroops+'人'+(unlocked?'':' 🔒')+'</small><span class="sortieMiniGrid">'+grid+'</span><small>'+esc(FORMATION_ROLES[id].slice(0,entry.slots).map(x=>ROLE_NAMES[x]+formationMinimumForRole(x)+'人').join('/'))+'</small><small>'+esc(SORTIE_RARITIES.map(t=>t+entry.rarityCaps[t]).join(' · '))+'</small><small>攻撃'+Math.round((entry.attack||0)*100)+'% / 防御'+Math.round((entry.defense||0)*100)+'%</small>',team.formation===id);
  }).join('')+'</div>'+
 '<div class="sortiePager">'+button('data-sortie-template-page="'+(tPage-1)+'" '+(!tPage?'disabled':''),'◀ 前')+
 '<small>'+(tPage+1)+' / '+templatePages+'</small>'+
 button('data-sortie-template-page="'+(tPage+1)+'" '+(tPage>=templatePages-1?'disabled':''),'次 ▶')+'</div>'+
 '<small class="sortieHint">各隊の陣形は2～3ジョブで構成します。陣形を選んでから人数を調整してください。自由陣形のみジョブを手動変更できます（陣形バフなし）。</small>';
 const pages=Math.max(1,Math.ceil(sources.length/6));
 const page=Math.max(0,Math.min(pages-1,Number(jobPage)||0));
 const jobs='<div class="sortieSubHead"><b>行'+(Math.floor(pos/4)+1)+'・列'+(pos%4+1)+'のジョブを選択</b>'+back+'</div>'+
  '<div class="sortieJobChoices">'+sources.slice(page*6,page*6+6).map(s=>{
   const sid=String(s.id),usedByOthers=teams.filter(t=>t.id!==team.id).reduce((n,t)=>n+(t.counts[sid]||0),0);
   const needed=sortieCellJobs(game,team.id,pos),wrongJob=needed&&!needed.includes(s.job);
   const mine=team.counts[sid]||0,free=s.count-usedByOthers-mine;
   return button('data-sortie-job="'+esc(s.id)+'" '+(wrongJob?'disabled':''),
    '<strong>'+esc(s.job)+'</strong><small>'+esc(s.rarity)+' · '+(wrongJob?'枠の職業条件外':mine?'配置済み '+mine+'人':free>0?'残り '+free+'人':'他班から移動')+'</small>',
    sid===String(selectedSid));
  }).join('')+'</div>'+
  (pages>1?'<div class="sortiePager">'+button('data-sortie-job-page="'+(page-1)+'" '+(page===0?'disabled':''),'◀ 前')+
  '<small>'+(page+1)+' / '+pages+'</small>'+
  button('data-sortie-job-page="'+(page+1)+'" '+(page===pages-1?'disabled':''),'次 ▶')+'</div>':'')+
  '<div class="sortieSubActions">'+button('data-sortie-job=""'+(!selectedSid?' disabled':''),'このマスを空ける')+
  (selectedSid?button('data-sortie-view="count"','人数を変更する')+button('data-sortie-view="divisions"','分隊を設定する'):'')+'</div>';
 const selectedTier=rarityOf(selectedSource),teamAssigned=sortieTeamCount(team);
 const tierAvailable=quota.spec.rarityCaps[selectedTier]-(quota.rarity[selectedTier]||0)+squadCount;
 const groupAvailable=quota.spec.maxTroops-teamAssigned+squadCount;
 const stageAvailable=battleCap-plannedTotal+squadCount;
 const maxCount=selectedSource?Math.max(squadCount,Math.min(selectedSource.count-elsewhere,
  tierAvailable,groupAvailable,stageAvailable)):0;
 const countPanel='<div class="sortieSubHead"><b>人数を変更</b>'+back+'</div>'+
  '<p class="sortieSelectedLabel">'+(selectedSource?esc(selectedSource.job)+' · '+squadCount+'人':'マスを選択してジョブを配置してください')+'</p>'+
  (selectedSource?'<div class="sortieCountControl">'+
   button('data-sortie-step="-10"','−10')+button('data-sortie-step="-1"','−1')+
   '<input type="number" data-sortie-count min="1" max="'+maxCount+'" value="'+squadCount+'" aria-label="配置人数">'+
   button('data-sortie-step="1"','＋1')+button('data-sortie-step="10"','＋10')+
   '</div><small class="sortieHint">最低配置人数：'+(minByCell.get(pos)?.min||1)+
   '人（必要職業：'+esc(minByCell.get(pos)?.options?.join('・')||selectedSource.job)+
   '）。最大'+maxCount+'人。陣形とレアリティ'+selectedTier+'の上限を適用中。</small>':
   button('data-sortie-view="jobs"','ジョブを選択する')) ;
 const divisionParts=selectedSource?Math.max(1,team.divisions?.[String(selectedSource.id)]||1):1;
 const divisionPanel='<div class="sortieSubHead"><b>分隊を設定（最大4分隊）</b>'+back+'</div>'+
  '<p class="sortieSelectedLabel">'+(selectedSource?esc(selectedSource.job)+'・'+squadCount+'人':'まず配置盤のマスにジョブを配置してください')+'</p>'+
  '<div class="sortieDivisions">'+(selectedSource?[1,2,3,4].map(n=>button('data-sortie-division="'+n+'" '+(n>squadCount?'disabled':''),
   '<strong>'+n+'分隊</strong><small>各隊 約'+Math.ceil(squadCount/n)+'人</small>',divisionParts===n)).join(''):'')+'</div>'+
  '<small class="sortieHint">戦闘では分隊も所属隊全体の連携作戦に追従します。ジョブ固有技は条件が成立した場合に実行します。</small>';
 const family=FOUR_STRATEGY_FAMILIES[strategyFamily]?strategyFamily:'attack';
 const intents=FOUR_STRATEGY_FAMILIES[family].intents;
 const intent=intents[strategyIntent]?strategyIntent:Object.keys(intents)[0];
 const methodAllowed=m=>orders.includes(m.mode)&&(!m.jobs.length||assigned.some(s=>m.jobs.includes(STORY_JOB_TO_STRATEGY_JOB[s.job])));
 const canFamily=entry=>Object.values(entry.intents).some(x=>x.methods.some(methodAllowed));
 const combatPlan={allowed:orders,squads:assigned.map(s=>({id:String(s.id),
  jobs:[STORY_JOB_TO_STRATEGY_JOB[s.job]].filter(Boolean),allowed:orders,
  soldiers:Number(team.counts[String(s.id)]||0)}))};
 const distribution=planStrategyDistribution(combatPlan,combatPlan.squads.map(s=>s.id),team.tactics||[]);
 const orderPanel='<div class="sortieSubHead"><b>第'+team.id+'隊 · 連携作戦</b>'+back+'</div>'+
  '<b class="sortieStep">① 作戦系統</b><div class="sortieStrategyGrid">'+
   Object.entries(FOUR_STRATEGY_FAMILIES).map(([id,entry])=>button('data-sortie-strategy-family="'+id+'" '+(!canFamily(entry)?'disabled':''),
    esc(entry.name),id===family)).join('')+'</div>'+
  '<b class="sortieStep">② 目的</b><div class="sortieStrategyGrid">'+
   Object.entries(intents).map(([id,entry])=>button('data-sortie-strategy-intent="'+id+'" '+(!entry.methods.some(methodAllowed)?'disabled':''),
    esc(entry.name),id===intent)).join('')+'</div>'+
  '<b class="sortieStep">③ 実行方法（複数選択）</b><div class="sortieStrategyGrid">'+
   intents[intent].methods.map(method=>button('data-sortie-strategy-method="'+method.id+'" '+(!methodAllowed(method)?'disabled':''),
    (team.tactics?.includes(method.id)?'☑ ':'□ ')+esc(method.name),team.tactics?.includes(method.id))).join('')+'</div>'+
  '<small class="sortieHint">実行方法は複数系統から選択可能。戦闘中に敵・地図・オブジェクトの目標を指定します。</small>'+
  '<b class="sortieStep">設定済み作戦・兵員配分率</b><div class="sortieStrategyShares">'+
   (distribution.rows.map(x=>'<div><span>'+esc(x.method.name)+' · '+x.soldiers+'人</span><b>'+x.percent+'%</b></div>').join('')||
    '<small class="sortieHint">③から作戦を1つ以上選んでください。</small>')+'</div>'+
  (distribution.unmatched.length?'<small class="sortieHint">役割不一致で未配属 '+distribution.unmatched.length+'隊</small>':'')+
  '<small class="sortieHint">'+esc(status.reason)+'。配分率は人数に基づく計画値で、成功率ではありません。陣形が成立しない自由配置は作戦を実行できません。</small>';
 const stage=battleStageContext(sortiePlanningStage(game));
 const params=battleTeamParameters(game,team.id);
 const recommendations=recommendBattlePlans(game,stage,team.id,{limit:9});
 const activePlan=game.activeBattlePlanByTeam?.[String(team.id)]||'';
 const assessment='<div class="sortieSubHead"><b>第'+team.id+'班：得意分野の評価</b>'+back+'</div>'+
 '<small class="sortieHint">配置済み兵士の職業構成から算出する編成適性（0〜100）。勝率ではありません。</small>'+
 '<div class="sortieTraitBars">'+Object.entries(params.parameters).map(([key,value])=>
 '<div><span>'+esc(BATTLE_TRAIT_LABELS[key])+'</span><meter min="0" max="100" value="'+value+'"></meter><b>'+value+'</b></div>').join('')+'</div>'+
 '<div class="sortieCompactStatus">得意：'+esc(params.highlights.join('・')||'未編成')+
 ' ／ 編成人数：'+params.people+' ／ 陣形：'+esc(params.formation)+'</div>'+
 '<div class="sortieMinimumSummary"><b>陣形成立条件</b><div>'+
 (minSummary||'<small>自由陣形：人数制限なし／バフなし</small>')+'</div></div>'+
 '<div class="sortieQuotaSummary"><b>'+quota.total+'/'+quota.capacity+'人</b><small>'+esc(tierSummary)+'</small></div>'+
 captainPanel;
 const battlePlans='<div class="sortieSubHead"><b>次戦に合う作戦テンプレート</b>'+back+'</div>'+
 '<small class="sortieHint">目的：'+esc(stage.winCondition||stage.name)+' ／ 地形：'+esc(stage.biome)+
 '。適合度は作戦との相性を示す参考スコアです。</small>'+
 '<div class="sortieBattlePlanList">'+recommendations.map((plan,i)=>
 '<div class="sortieBattlePlan"><strong>'+(i===0?'★ 推奨 ':'')+esc(plan.name)+
 ' <small>適合 '+plan.score+'/100</small></strong><small>'+esc(plan.reason)+'</small>'+
 button('data-sortie-battle-plan="'+esc(plan.id)+'" '+(!plan.eligible?'disabled':''),
  activePlan===plan.id?'✓ 選択中':'この班へ採用',activePlan===plan.id)+'</div>').join('')+'</div>'+
 '<div class="sortiePlanSave"><b>独自テンプレートを保存</b>'+
 '<input data-battle-plan-name maxlength="28" aria-label="新しいテンプレート名" placeholder="例：橋頭堡防衛A">'+
 '<select data-battle-plan-method aria-label="実行方法">'+
 Object.values(STRATEGY_METHODS).map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join('')+
 '</select><button type="button" data-sortie-battle-save>現在のステージ目的で保存</button></div>';
 const tabList=[['templates','①陣形'],['setup','②配置'],['orders','③作戦'],['battlePlans','テンプレ'],['assessment','評価'],['captains','隊長']];
 const tabBar='<nav class="sortieModeTabs" aria-label="宿屋の機能">'+tabList.map(([key,label])=>
 button('data-sortie-view="'+key+'"',esc(label),view===key)).join('')+'</nav>';
 const pagesByView={setup:main,templates,jobs,count:countPanel,orders:orderPanel,captains:captainPage,divisions:divisionPanel,battlePlans,assessment};
 const autoButtons='<div class="sortieAutoOptions" role="group" aria-label="自動編成方式">'+Object.entries(THREE_TEAM_AUTO_MODES).map(([id,entry])=>button('data-sortie-auto="'+id+'"','自動：'+entry.name,game.sortieAutoMode===id)).join('')+'</div>';
 return '<section class="sortiePlanner" aria-label="最大3隊・各隊2～3ジョブの陣形">'+
  '<div class="sortieTop"><b>⚑ 最大3隊・各隊3ジョブまで</b><small>予定出撃 '+plannedTotal+'/'+battleCap+'人 · 予備'+Math.max(0,inventoryTotal-plannedTotal)+'人</small></div>'+
  groupButtons+autoButtons+tabBar+'<div class="sortieViewBody">'+(pagesByView[view]||main)+'</div>'+
  '<small class="sortieHint sortiePlannerFoot">次戦「'+esc(stageName)+'」 上限'+battleCap+'人。'+
    '陣形補正：攻撃'+Math.round(formBuff.attack*100)+'%／防御'+Math.round(formBuff.defense*100)+'%／移動'+Math.round(formBuff.mobility*100)+'%／魔法'+Math.round(formBuff.magic*100)+'%。</small></section>';
}
