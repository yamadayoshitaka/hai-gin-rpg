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
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button=(attr,title,selected=false)=>'<button type="button" '+attr+' class="'+(selected?'selected':'')+'">'+title+'</button>';
export function renderThreeTeamPlanner({game,teamId=1,cellIndex=5,view='setup',jobPage=0,templatePage=0,strategyFamily='attack',strategyIntent='melee'}){
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
 const groupButtons='<div class="sortieTeams" role="group" aria-label="班の選択">'+teams.map(t=>{
  const total=sortieTeamCount(t),count=sortieTeamSquads(game,t.id).length;
  return button('data-sortie-team="'+t.id+'"','<strong>第'+t.id+'班 · '+total+'人</strong><small>'+count+'/'+(SORTIE_FORMATIONS[t.formation]?.slots||cap)+'隊</small>',t.id===team.id);
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
 const cells=Array.from({length:SORTIE_GRID_CELLS},(_,i)=>{
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
  '</div><div class="sortieGridHint"><b>配置盤 4×4</b><small>敵陣 ↑ '+(team.formation==='free'?'マスをタップして職業変更':'陣形固定・職業と位置は変更不可')+'</small></div>'+
  '<div class="sortieFormationGrid" role="group" aria-label="4×4のジョブ配置盤">'+cells+'</div>'+
  '<div class="sortieGridFooter"><small>固定テンプレート '+(quota.spec.slots)+'隊 · '+esc(status.reason)+'</small>'+
  button('data-sortie-view="count"','人数 ▸')+button('data-sortie-view="divisions"','分隊 ▸')+'</div>'+
  '<div class="sortieCompactStatus">'+(status.valid?'✓ 陣形成立':'⚠ '+esc(status.reason))+
  '　'+quota.total+'/'+quota.capacity+'人　'+esc(SORTIE_FORMATIONS[team.formation]?.name||'自由配置')+'</div>';
 const templateIds=Object.keys(SORTIE_FORMATIONS);
 const pageCap=6,templatePages=Math.ceil(templateIds.length/pageCap);
 const tPage=Math.max(0,Math.min(templatePages-1,Number(templatePage)||0));
 const templates='<div class="sortieSubHead"><b>陣形テンプレート · Lv.'+level+'</b>'+button('data-sortie-formation="free"','自由陣形',team.formation==='free')+back+'</div>'+
  '<div class="sortieTemplateChoices">'+templateIds.slice(tPage*pageCap,tPage*pageCap+pageCap).map(id=>{const entry=SORTIE_FORMATIONS[id],unlocked=entry.level<=level;
   const preview=Object.fromEntries(SORTIE_FORMATION_CELLS[id].slice(0,4).map((cell,index)=>[cell,FORMATION_ROLES[id][index]]));
   const extra=new Set(SORTIE_FORMATION_CELLS[id].slice(4,entry.slots));
   const grid=Array.from({length:16},(_,i)=>{
    const extraRank=SORTIE_FORMATION_CELLS[id].indexOf(i),role=extraRank>=0&&extraRank<entry.slots?FORMATION_ROLES[id][extraRank]:null;
    return '<i class="'+(preview[i]?'occupied':extra.has(i)?'extra':'')+'" title="'+esc(ROLE_NAMES[role]||'空き')+'">'+(role?esc(ROLE_NAMES[role].slice(0,1)):'')+'</i>';
   }).join('');
   return button('data-sortie-formation="'+id+'" '+(!unlocked?'disabled':'') ,'<b>'+esc(entry.name)+'</b><small>Lv.'+entry.level+' · '+entry.slots+'隊 · 最大'+entry.maxTroops+'人'+(unlocked?'':' 🔒')+'</small><span class="sortieMiniGrid">'+grid+'</span><small>'+esc(FORMATION_ROLES[id].slice(0,entry.slots).map(x=>ROLE_NAMES[x]+formationMinimumForRole(x)+'人').join('/'))+'</small><small>'+esc(SORTIE_RARITIES.map(t=>t+entry.rarityCaps[t]).join(' · '))+'</small><small>攻撃'+Math.round((entry.attack||0)*100)+'% / 防御'+Math.round((entry.defense||0)*100)+'%</small>',team.formation===id);
  }).join('')+'</div>'+
 '<div class="sortiePager">'+button('data-sortie-template-page="'+(tPage-1)+'" '+(!tPage?'disabled':''),'◀ 前')+
 '<small>'+(tPage+1)+' / '+templatePages+'</small>'+
 button('data-sortie-template-page="'+(tPage+1)+'" '+(tPage>=templatePages-1?'disabled':''),'次 ▶')+'</div>'+
 '<small class="sortieHint">通常陣形では職業・位置・形状は固定です。別の陣形を選択すると自動再編成します。陣形の隊数はテンプレートごとに固定し、レベルで新しい隊数の陣形が解放されます。自由陣形のみマスと職業の手動変更が可能（陣形バフなし）。</small>';
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
  '<small class="sortieHint">戦闘では本隊が隊長を保持し、すべての分隊は所属班の陣形バフを受けます。分隊ごとに敵・地点・オブジェクトを狙えます。</small>';
 const family=STRATEGY_TREE[strategyFamily]?strategyFamily:'attack';
 const intents=STRATEGY_TREE[family].intents;
 const intent=intents[strategyIntent]?strategyIntent:Object.keys(intents)[0];
 const methodAllowed=m=>orders.includes(m.mode)&&(!m.jobs.length||assigned.some(s=>m.jobs.includes(STORY_JOB_TO_STRATEGY_JOB[s.job])));
 const canFamily=entry=>Object.values(entry.intents).some(x=>x.methods.some(methodAllowed));
 const combatPlan={allowed:orders,squads:assigned.map(s=>({id:String(s.id),
  jobs:[STORY_JOB_TO_STRATEGY_JOB[s.job]].filter(Boolean),allowed:orders,
  soldiers:Number(team.counts[String(s.id)]||0)}))};
 const distribution=planStrategyDistribution(combatPlan,combatPlan.squads.map(s=>s.id),team.tactics||[]);
 const orderPanel='<div class="sortieSubHead"><b>第'+team.id+'班 · 3段階作戦</b>'+back+'</div>'+
  '<b class="sortieStep">① 作戦系統</b><div class="sortieStrategyGrid">'+
   Object.entries(STRATEGY_TREE).map(([id,entry])=>button('data-sortie-strategy-family="'+id+'" '+(!canFamily(entry)?'disabled':''),
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
 const tabList=[['setup','配置'],['templates','陣形'],['orders','作戦'],['battlePlans','テンプレ'],['assessment','評価'],['captains','隊長']];
 const tabBar='<nav class="sortieModeTabs" aria-label="宿屋の機能">'+tabList.map(([key,label])=>
 button('data-sortie-view="'+key+'"',esc(label),view===key)).join('')+'</nav>';
 const pagesByView={setup:main,templates,jobs,count:countPanel,orders:orderPanel,captains:captainPage,divisions:divisionPanel,battlePlans,assessment};
 return '<section class="sortiePlanner" aria-label="最大3班・Lvに応じた隊数・4×4配置">'+
  '<div class="sortieTop"><b>⚑ 最大3班・Lv.'+level+'（仮）</b><small>予定出撃 '+plannedTotal+'/'+battleCap+'人 · 予備'+Math.max(0,inventoryTotal-plannedTotal)+'人</small></div>'+
  groupButtons+tabBar+'<div class="sortieViewBody">'+(pagesByView[view]||main)+'</div>'+
  '<small class="sortieHint sortiePlannerFoot">次戦「'+esc(stageName)+'」 上限'+battleCap+'人。'+
    '陣形：攻撃+'+Math.round(formBuff.attack*100)+'%／防御+'+Math.round(formBuff.defense*100)+'%。</small></section>';
}
