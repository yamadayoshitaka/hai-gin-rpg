/**
 * User-directed three-team sortie planning. Teams are separate from strategists:
 * inventory remains in campaign.squads, while this plan assigns actual people.
 * A source squad may be split between teams but never duplicated.
 */
import {formationStatus,arrangeFormation,formationCellsAtLevel,FREE_FORMATION,FORMATION_ROLES,ROLE_JOBS,formationJobMinimums,formationMinimumForRole} from './sortie-formation-logic.js';
import {STRATEGY_METHODS,STORY_JOB_TO_STRATEGY_JOB} from './three-step-strategy-catalog.js';
import {CAMPAIGN_STAGES,CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';
import {FORMATION_TEMPLATE_LIMITS,formationTemplate,rarityOf,formationCapacityStatus,formationRarityCounts} from './sortie-formation-template-rules.js';
export const SORTIE_TEAM_IDS=Object.freeze(Array.from({length:3},(_,i)=>i+1));
export const SORTIE_SQUADS_PER_GROUP=3;
/** Temporary level-99 battle/formation test without rewriting career XP. */
export const SORTIE_TEST_LEVEL=99;
export function sortieLevel(game){
 const requested=game?.sortieTestLevel;
 return Math.max(1,Math.min(99,Number.isFinite(Number(requested))?Math.trunc(Number(requested)):Number(game?.campaign?.commander?.level)||1));
}
export function sortieSquadCap(game){return 3;}
export const SORTIE_GRID_EDGE=4;
export const SORTIE_GRID_CELLS=SORTIE_GRID_EDGE*SORTIE_GRID_EDGE;
const permutation=(first)=>Object.freeze([...first,...Array.from({length:16},(_,i)=>i).filter(i=>!first.includes(i))]);
export const SORTIE_FORMATION_CELLS=Object.freeze({
 attack:permutation([1,2,5,6]),
 balanced:permutation([5,6,9,10]),
 support:permutation([9,10,13,14]),
 wall:permutation([4,5,6,7]),
 spear:permutation([0,4,8,12]),
 arrow:permutation([2,5,6,10]),
 wedge:permutation([1,5,6,9]),
 pincer:permutation([4,7,8,11]),
 circle:permutation([1,4,7,13]),
 ambush:permutation([0,3,12,15]),
 cross:permutation([1,4,6,9]),
 fortress:permutation([8,9,10,11]),
 dragon:permutation([0,5,10,15]),
 constellation:permutation([0,6,9,15])
});
/** Buffs are fractional, passive, and shared by all children of a leader's group. */
const FORMATION_BASE=Object.freeze({
 attack:Object.freeze({name:'前進陣形',level:1,attack:.08,defense:0,mobility:0}),
 balanced:Object.freeze({name:'標準陣形',level:1,attack:.04,defense:.04,mobility:0}),
 support:Object.freeze({name:'後衛陣形',level:1,attack:0,defense:.06,mobility:.04,healing:.1}),
 wall:Object.freeze({name:'防壁陣形',level:5,attack:0,defense:.12,mobility:-.05}),
 spear:Object.freeze({name:'槍衾陣形',level:7,attack:.1,defense:.08,mobility:-.04}),
 arrow:Object.freeze({name:'弓月陣形',level:15,attack:.1,defense:.04,mobility:.04}),
 wedge:Object.freeze({name:'楔形陣形',level:20,attack:.16,defense:-.04,mobility:.08}),
 pincer:Object.freeze({name:'包囲陣形',level:30,attack:.12,defense:0,mobility:.12}),
 circle:Object.freeze({name:'円環陣形',level:40,attack:0,defense:.19,mobility:0,healing:.1}),
 ambush:Object.freeze({name:'伏兵陣形',level:50,attack:.17,defense:-.04,mobility:.18}),
 cross:Object.freeze({name:'十字陣形',level:60,attack:.13,defense:.13,mobility:0}),
 fortress:Object.freeze({name:'鉄壁陣形',level:70,attack:0,defense:.26,mobility:-.1}),
 dragon:Object.freeze({name:'龍牙陣形',level:85,attack:.23,defense:.12,mobility:.09}),
 constellation:Object.freeze({name:'星鐘陣形',level:99,attack:.25,defense:.22,mobility:.14,healing:.12})
});
const MAGIC_FORMATION_BONUS=Object.freeze({attack:.04,balanced:.08,support:.20,wall:.04,spear:.02,arrow:.14,wedge:.04,pincer:.09,circle:.13,ambush:.08,cross:.11,fortress:.05,dragon:.18,constellation:.24});
export const SORTIE_FORMATIONS=Object.freeze(Object.fromEntries(
 Object.entries(FORMATION_BASE).map(([id,base])=>[id,Object.freeze({...base,magic:MAGIC_FORMATION_BONUS[id]||0,...formationTemplate(id)})])
));
const FORMATION_ROLE_CELL_JOBS=(formation,cell)=>{
 const rank=SORTIE_FORMATION_CELLS[formation]?.indexOf(cell);
 return rank>=0?ROLE_JOBS[FORMATION_ROLES[formation]?.[rank]]||null:null;
};
export const sortieCellJobs=(game,teamId,cell)=>teamOf(game,teamId)?.formation===FREE_FORMATION?null:FORMATION_ROLE_CELL_JOBS(teamOf(game,teamId)?.formation,cell);
export const sortieAllowedCells=(game,teamId)=>{
 const team=teamOf(game,teamId),spec=formationTemplate(team?.formation);
 return formationCellsAtLevel(team?.formation,SORTIE_FORMATION_CELLS,
  Math.min(sortieSquadCap(game),spec?.slots||4));
};
export const sortieTemplateCapacity=(game,teamId)=>
 formationCapacityStatus(teamOf(game,teamId),ownSquads(game),sortiePlanningLimit(game));
export function sortieFormationStatus(game,teamId){
 const team=teamOf(game,teamId),spec=formationTemplate(team?.formation);
 const status=formationStatus(team,ownSquads(game),SORTIE_FORMATION_CELLS,sortieSquadCap(game));
 if(team?.formation===FREE_FORMATION||!spec||!status.valid)return status;
 const expected=SORTIE_FORMATION_CELLS[team.formation].slice(0,spec.slots);
 if(spec.slots>sortieSquadCap(game)||expected.some(cell=>!team.grid[cell]))
  return {id:'free',valid:false,reason:'陣形未完成：テンプレートの'+spec.slots+'隊を配置してください'};
 const budget=sortieTemplateCapacity(game,teamId);
 if(!budget.valid)return {id:'free',valid:false,reason:budget.error};
 const missing=formationJobMinimums(team,ownSquads(game),SORTIE_FORMATION_CELLS,spec.slots)
  .filter(entry=>!entry.valid);
 if(missing.length){
  const first=missing[0];
  return {id:'free',valid:false,reason:'陣形の最低人数が不足：'+
   (first.job||first.options.join('・'))+' '+first.current+'/'+first.min+'人'};
 }
 return status;
}
export const unlockedSortieFormations=game=>Object.entries(SORTIE_FORMATIONS)
 .filter(([,x])=>sortieLevel(game)>=x.level).map(([id])=>id);
export function sortieFormationBuff(game,teamId){
 const t=game?.sortiePlan?.teams?.find(x=>x.id===Number(teamId));
 const f=SORTIE_FORMATIONS[sortieFormationStatus(game,teamId).id]||{};
 return {attack:f.attack||0,defense:f.defense||0,mobility:f.mobility||0,magic:f.magic||0,healing:f.healing||0};
}
export const SORTIE_ENTRY_SLOTS=Object.freeze([9,10,11,6,7,8,3,4,5,0]);
export const SORTIE_TOTAL_RENDER_LIMIT=50; // The current campaign battle renderer.
/** This is the next battle's real cap, not the total number in the army inventory. */
export function sortiePlanningStage(game){
 const current=CAMPAIGN_STAGE_BY_ID[game?.townStage]||CAMPAIGN_STAGE_BY_ID[game?.stage];
 const completed=new Set(game?.completedStages||[]);
 const future=CAMPAIGN_STAGES.filter(stage=>stage.kind!=='town'&&stage.number>(current?.number||0));
 return future.find(stage=>!completed.has(stage.id))||future[0]||CAMPAIGN_STAGES.find(stage=>stage.kind!=='town');
}
export const sortiePlanningLimit=game=>Math.min(SORTIE_TOTAL_RENDER_LIMIT,sortiePlanningStage(game)?.deploymentLimit||SORTIE_TOTAL_RENDER_LIMIT);
/** Shrink only planned deployment, never the underlying inventory. */
function clampPlannedHeadcount(teams,limit){
 const entries=teams.flatMap(team=>Object.entries(team.counts).map(([id,count])=>({team,id,count:Number(count)||0}))).filter(x=>x.count>0);
 const total=entries.reduce((n,x)=>n+x.count,0);
 if(total<=limit)return false;
 const limitCount=Math.max(0,Math.floor(limit));
 const allotments=entries.map((x,index)=>({...x,index,amount:index<limitCount?1:0,weight:x.count}));
 let remaining=limitCount-allotments.reduce((n,x)=>n+x.amount,0);
 while(remaining>0){
  const best=allotments.filter(x=>x.amount<x.count).sort((a,b)=>
   (b.weight/(b.amount+1))-(a.weight/(a.amount+1))||a.index-b.index)[0];
  if(!best)break;best.amount++;remaining--;
 }
 for(const x of allotments){
  if(x.amount>0){x.team.counts[x.id]=x.amount;x.team.divisions[x.id]=Math.min(x.team.divisions[x.id]||1,4,x.amount)}
  else{
   delete x.team.counts[x.id];delete x.team.divisions[x.id];
   x.team.slots=x.team.slots.map(s=>String(s)===x.id?null:s);
   x.team.grid=x.team.grid.map(s=>String(s)===x.id?null:s);
  }
 }
 return true;
}
const ACTIVE_ORDER_IDS=Object.freeze(['charge','defend','hold','retreat','support','explore','destroy','weaken']);
const allSlots=Object.freeze(Array.from({length:12},(_,i)=>i));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const ownSquads=game=>(game?.campaign?.squads||[]).filter(s=>s.count>0&&String(s.commanderId??'player')!=='reserve');
export const stageIsControlled=(game,stage)=>Boolean(stage?.id&&game?.completedStages?.includes(stage.id));
export const allowedSortieSlots=(game,stage)=>stageIsControlled(game,stage)?allSlots:SORTIE_ENTRY_SLOTS;
const blankTeam=id=>({id,slots:Array(SORTIE_SQUADS_PER_GROUP).fill(null),grid:Array(SORTIE_GRID_CELLS).fill(null),counts:{},divisions:{},captainId:null,formation:'balanced',tactics:[],deploymentSlot:SORTIE_ENTRY_SLOTS[id-1],initialOrder:'charge'});
/** Normalize old free-layout saves as well: no rarity can bypass its ceiling. */
function clampFreeTeam(team,squads){
 const spec=formationTemplate('free'),byId=new Map(squads.map(x=>[String(x.id),x]));
 const rarity={N:0,R:0,SR:0,SSR:0,UR:0};let total=0;
 for(const raw of team.slots){
  const id=String(raw||''),count=Math.trunc(Number(team.counts[id])||0);
  if(!count)continue;
  const tier=rarityOf(byId.get(id));
  const keep=Math.max(0,Math.min(count,spec.rarityCaps[tier]-rarity[tier],spec.maxTroops-total));
  if(keep){
   team.counts[id]=keep;rarity[tier]+=keep;total+=keep;
   team.divisions[id]=Math.min(team.divisions[id]||1,4,keep);
  }else{
   delete team.counts[id];delete team.divisions[id];
   team.slots=team.slots.map(v=>String(v)===id?null:v);
   team.grid=team.grid.map(v=>String(v)===id?null:v);
  }
 }
}
const teamOf=(game,id)=>game.sortiePlan?.teams?.find(t=>t.id===Number(id));
const rarityScore=s=>({N:0,R:1,SR:2,SSR:3,UR:4})[s?.rarity]??0;

/**
 * Normalizes old saves and post-battle casualties without creating extra units.
 * Only create the default plan when the user opens the new sortie editor.
 */
export function ensureSortiePlan(game){
 if(!game?.campaign)throw Error('編成データがありません。');
 if(game.sortieTestLevel===undefined)game.sortieTestLevel=SORTIE_TEST_LEVEL; // Reversible Lv.99 playtest flag.
 const sources=ownSquads(game),byId=new Map(sources.map(s=>[String(s.id),s]));
 const saved=game.sortiePlan?.version===1?game.sortiePlan.teams:[];
 const remaining=new Map(sources.map(s=>[String(s.id),s.count]));
 const teams=SORTIE_TEAM_IDS.map(id=>{
  const old=saved?.find(t=>Number(t?.id)===id),team=blankTeam(id);
  if(!old)return team;
  // Only three job contingents per team; old extra jobs return to the reserve. Migrate the former unbounded
  // counts object without deleting troop inventory from the campaign.
  const slotSource=Array.isArray(old.slots)?old.slots:Object.keys(old.counts||{});
  const seen=new Set();
  slotSource.slice(0,SORTIE_SQUADS_PER_GROUP).forEach((raw,index)=>{
   const sid=String(raw??'');
   if(!byId.has(sid)||seen.has(sid))return;
   const count=old.counts?.[sid];
   const available=remaining.get(sid)||0;
   const valid=clamp(Number.isFinite(Number(count))?Math.trunc(Number(count)):0,0,available);
   if(valid){team.slots[index]=sid;team.counts[sid]=valid;team.divisions[sid]=clamp(Math.trunc(Number(old.divisions?.[sid])||1),1,Math.min(4,valid));remaining.set(sid,available-valid);seen.add(sid);}
  });
  team.formation=old.formation===FREE_FORMATION?FREE_FORMATION:
   Object.hasOwn(SORTIE_FORMATIONS,old.formation)&&
   SORTIE_FORMATIONS[old.formation].level<=sortieLevel(game)?old.formation:'balanced';
  const oldGrid=Array.isArray(old.grid)&&old.grid.length===SORTIE_GRID_CELLS?old.grid:null;
  team.slots.filter(Boolean).forEach((sid,index)=>{
   const savedIndex=oldGrid?.findIndex(v=>String(v)===sid);
   const legal=formationCellsAtLevel(team.formation,SORTIE_FORMATION_CELLS,sortieSquadCap(game));
   const desired=Number.isInteger(savedIndex)&&legal.includes(savedIndex)&&!team.grid[savedIndex]?
    savedIndex:legal[index%legal.length];
   const cell=legal.includes(desired)&&!team.grid[desired]?desired:legal.find(c=>team.grid[c]===null);
   if(cell!==undefined&&cell>=0)team.grid[cell]=sid;
  });
  team.deploymentSlot=Number.isInteger(old.deploymentSlot)&&allSlots.includes(old.deploymentSlot)?old.deploymentSlot:SORTIE_ENTRY_SLOTS[id-1];
  const candidates=Object.keys(team.counts).map(sid=>byId.get(sid)).filter(Boolean);
  const captain=candidates.find(s=>String(s.id)===String(old.captainId))||
   [...candidates].sort((a,b)=>rarityScore(b)-rarityScore(a))[0];
  team.captainId=captain?.id??null;
  if(team.formation!==FREE_FORMATION&&!formationStatus(team,sources,SORTIE_FORMATION_CELLS,sortieSquadCap(game)).valid)
   arrangeFormation(team,sources,team.formation,SORTIE_FORMATION_CELLS,sortieSquadCap(game));
  team.initialOrder=ACTIVE_ORDER_IDS.includes(old.initialOrder)?old.initialOrder:'charge';
  team.tactics=Array.isArray(old.tactics)?old.tactics.filter((id,index,arr)=>STRATEGY_METHODS[id]&&arr.indexOf(id)===index).slice(0,16):[];
  return team;
 });
 if(!saved?.length){
  // Preserve up to three job contingents per active team.
  sources.slice(0,SORTIE_TEAM_IDS.length*sortieSquadCap(game)).forEach((s,index)=>{
   const cap=sortieSquadCap(game),team=teams[Math.floor(index/cap)];
   team.slots[index%cap]=String(s.id);
   team.counts[String(s.id)]=s.count;team.divisions[String(s.id)]=1;
  });
  teams.forEach(team=>{
   arrangeFormation(team,sources,'balanced',SORTIE_FORMATION_CELLS,sortieSquadCap(game));
   const candidates=sources.filter(s=>team.counts[String(s.id)]);
   team.captainId=[...candidates].sort((a,b)=>rarityScore(b)-rarityScore(a))[0]?.id??null;
  });
 }
 clampPlannedHeadcount(teams,sortiePlanningLimit(game));
 for(const team of teams)if(team.formation===FREE_FORMATION)clampFreeTeam(team,sources);
 for(const team of teams)if(team.formation!==FREE_FORMATION&&sortieTeamCount(team)){
  // Older saves may contain job swaps; fixed presets always reconstruct the layout.
  rebuildNamedFormation(game,teams,team,team.formation,team.slots.filter(Boolean).length);
 }
 game.sortiePlan={version:1,teams};
 return game.sortiePlan;
}
export const sortieTeams=game=>ensureSortiePlan(game).teams;
export const sortieTeamCount=team=>Object.values(team?.counts||{}).reduce((a,b)=>a+Number(b||0),0);

/** A named formation owns its job-to-cell mapping. Rebuild from inventory
 * rather than preserving user-swapped cells or incompatible old-save jobs.
 */
function rebuildNamedFormation(game,teams,team,formation,desired){
 const candidates=ownSquads(game),other=new Map();
 for(const t of teams)if(t!==team)for(const [id,count] of Object.entries(t.counts))
  other.set(id,(other.get(id)||0)+Number(count||0));
 const current={...team.counts},currentTotal=Object.values(current).reduce((n,x)=>n+Number(x||0),0);
 const spec=formationTemplate(formation),maxRows=Math.min(sortieSquadCap(game),spec.slots);
 const slots=Array(SORTIE_SQUADS_PER_GROUP).fill(null),chosen=[],used=new Set(),pickedRarity={N:0,R:0,SR:0,SSR:0,UR:0};
 for(let i=0;i<maxRows;i++){
  const role=FORMATION_ROLES[formation][i],jobs=ROLE_JOBS[role]||[];
  const eligible=candidates.filter(item=>{
   const id=String(item.id);
   const rarity=rarityOf(item);
   return !used.has(id)&&jobs.includes(item.job)&&item.count>(other.get(id)||0)&&
    pickedRarity[rarity]<spec.rarityCaps[rarity];
  });
  eligible.sort((a,b)=>{
   const av=Number(current[String(a.id)]||0),bv=Number(current[String(b.id)]||0);
   return (bv>0?1:0)-(av>0?1:0)||bv-av||
    (b.count-(other.get(String(b.id))||0))-(a.count-(other.get(String(a.id))||0));
  });
  const candidate=eligible[0];if(!candidate)continue;
  const id=String(candidate.id),rarity=rarityOf(candidate);
  used.add(id);slots[i]=id;pickedRarity[rarity]++;
  chosen.push({id,rarity,capacity:candidate.count-(other.get(id)||0),
   minimum:formationMinimumForRole(role),
   weight:Math.max(1,Number(current[id]||Math.min(10,candidate.count)))});
 }
 const maxTotal=Math.max(0,sortiePlanningLimit(game)-teams.filter(t=>t!==team)
  .reduce((n,t)=>n+sortieTeamCount(t),0));
 const target=Math.min(Math.max(currentTotal,chosen.reduce((n,x)=>n+x.minimum,0)),maxTotal,spec.maxTroops,
  chosen.reduce((n,x)=>n+x.capacity,0));
 const counts={},divisions={},shares=chosen.map(x=>({...x,count:0})),
  rarityUsed={N:0,R:0,SR:0,SSR:0,UR:0};
 if(target>0){
  // Reserve the minimum headcount for each job cell first. If the stage or
  // rarity cap cannot cover it, this template remains invalid (no buff).
  let available=target;
  for(const x of shares){
   if(available<=0)break;
   const minimum=Math.max(1,x.minimum);
   const picked=Math.max(0,Math.min(minimum,x.capacity,
    spec.rarityCaps[x.rarity]-rarityUsed[x.rarity],available));
   x.count=picked;rarityUsed[x.rarity]+=picked;available-=picked;
  }
  let left=target-shares.reduce((n,x)=>n+x.count,0);
  while(left>0){
   const best=shares.filter(x=>x.count<x.capacity&&rarityUsed[x.rarity]<spec.rarityCaps[x.rarity])
    .sort((a,b)=>b.weight/(b.count+1)-a.weight/(a.count+1)||a.id.localeCompare(b.id))[0];
   if(!best)break;best.count++;rarityUsed[best.rarity]++;left--;
  }
 }
 for(const x of shares)if(x.count){
  counts[x.id]=x.count;divisions[x.id]=Math.max(1,Math.min(team.divisions[x.id]||1,x.count,4));
 }
 team.formation=formation;team.slots=slots;team.counts=counts;team.divisions=divisions;
 // Positions are owned by the template; never reshuffle into other role cells.
 team.grid=Array(SORTIE_GRID_CELLS).fill(null);
 slots.forEach((id,i)=>{if(id&&counts[id])team.grid[SORTIE_FORMATION_CELLS[formation][i]]=id;});
 if(!counts[String(team.captainId)]){
  const people=candidates.filter(x=>counts[String(x.id)]);
  team.captainId=[...people].sort((a,b)=>rarityScore(b)-rarityScore(a))[0]?.id??null;
 }
 return team;
}
/** Deprecated: preset sizes are immutable and only preset selection may change them. */
export function setSortieFormationSize(){
 throw Error('陣形の隊数はテンプレート固定です。別の陣形を選択してください。');
}

export function sortieTeamSquads(game,teamId){
 const team=teamOf(game,teamId);
 if(!team)return [];
 return ownSquads(game).filter(s=>(team.counts[String(s.id)]||0)>0);
}
export function setSortieCount(game,teamId,squadId,count){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),source=ownSquads(game).find(s=>String(s.id)===String(squadId));
 const n=Number(count);
 if(!team||!source||!Number.isInteger(n)||n<0)throw Error('隊・兵種・人数を確認してください。');
 const elsewhere=game.sortiePlan.teams.filter(t=>t!==team)
  .reduce((sum,t)=>sum+(Number(t.counts[String(source.id)])||0),0);
 if(n+elsewhere>source.count)throw Error('他隊に配属済みです。利用可能人数は'+(source.count-elsewhere)+'人です。');
 const budget=sortiePlanningLimit(game);
 const assigned=game.sortiePlan.teams.reduce((sum,t)=>sum+sortieTeamCount(t),0);
 if(assigned-(team.counts[String(source.id)]||0)+n>budget)
  throw Error('このステージの出撃上限は'+budget+'人です。他の隊の人数を減らしてから割り当ててください。');
 const sid=String(source.id);
 const cap=formationTemplate(team.formation)||formationTemplate('free');
 const rarity=rarityOf(source),old=Number(team.counts[sid]||0);
 const rarityCount=formationRarityCounts(team,ownSquads(game))[rarity];
 if(n&&sortieTeamCount(team)-old+n>cap.maxTroops)
  throw Error('この陣形の総人数上限は'+cap.maxTroops+'人です。');
 if(n&&rarityCount-old+n>cap.rarityCaps[rarity])
  throw Error(rarity+'はこの陣形で最大'+cap.rarityCaps[rarity]+'人までです。');
 if(!n&&team.formation!==FREE_FORMATION)
  throw Error('通常陣形の枠はテンプレート固定です。必要なら人数を1人以上にしてください。');
 if(n){
  if(!team.slots.includes(sid)&&team.formation!==FREE_FORMATION)
   throw Error('通常陣形の職業とマスは固定です。別の陣形か自由陣形を選んでください。');
  if(!team.slots.includes(sid)){
   const empty=team.slots.indexOf(null);
   if(empty<0||empty>=sortieSquadCap(game))throw Error('軍師レベルの隊数上限です（最大'+sortieSquadCap(game)+'隊）。');
   team.slots[empty]=sid;
   const legal=sortieAllowedCells(game,teamId),preferred=legal.find(c=>team.grid[c]===null);
   if(preferred===undefined)throw Error('陣形に空き枠がありません。');
   team.grid[preferred]=sid;
  }
  team.counts[sid]=n;team.divisions[sid]=Math.min(team.divisions[sid]||1,Math.min(4,n));
 }else{
  delete team.counts[sid];delete team.divisions[sid];
  team.slots=team.slots.map(id=>id===sid?null:id);
  team.grid=team.grid.map(id=>id===sid?null:id);
 }
 const candidates=sortieTeamSquads(game,teamId);
 if(!candidates.some(s=>String(s.id)===String(team.captainId))){
  team.captainId=[...candidates].sort((a,b)=>rarityScore(b)-rarityScore(a))[0]?.id??null;
 }
 if(!availableSortieOrders(game,teamId).includes(team.initialOrder))team.initialOrder='hold';
 return team;
}
/** Assign a job contingent to one of three visible formation cells. */
export function setSortieJobSlot(game,teamId,slotIndex,squadId){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),index=Number(slotIndex);
 if(team?.formation!==FREE_FORMATION)throw Error('通常陣形は固定配置です。自由陣形でのみ職業を変更できます。');
 if(!team||!Number.isInteger(index)||index<0||index>=SORTIE_SQUADS_PER_GROUP)
  throw Error('班の配置枠を選択してください。');
 const previous=team.slots[index],sid=squadId==null||squadId===''?null:String(squadId);
 if(sid===previous)return team;
 if(sid&&team.slots.some((x,i)=>i!==index&&x===sid))
  throw Error('同じ兵種の隊は、この班の別の配置枠にいます。');
 const source=sid?ownSquads(game).find(s=>String(s.id)===sid):null;
 if(sid&&!source)throw Error('保有兵からジョブを選択してください。');
 const elsewhere=sid?game.sortiePlan.teams.filter(t=>t!==team)
  .reduce((n,t)=>n+(t.counts[sid]||0),0):0;
 let available=source?source.count-elsewhere:0;
 const assignedTotal=game.sortiePlan.teams.reduce((n,t)=>n+sortieTeamCount(t),0);
 const replacing=previous?Number(team.counts[previous]||0):0;
 const tier=rarityOf(source),oldRarity=previous?rarityOf(ownSquads(game).find(x=>String(x.id)===String(previous))):null;
 const freeSpec=formationTemplate('free');
 const tierCount=formationRarityCounts(team,ownSquads(game))[tier],
  tierRoom=freeSpec.rarityCaps[tier]-tierCount+(oldRarity===tier?replacing:0);
 const groupRoom=freeSpec.maxTroops-sortieTeamCount(team)+replacing;
 const budget=Math.max(0,Math.min(sortiePlanningLimit(game)-assignedTotal+replacing,tierRoom,groupRoom));
 if(sid&&(tierRoom<=0||groupRoom<=0))throw Error('自由陣形の'+tier+'または総人数上限です。');
 const donorAvailable=sid?game.sortiePlan.teams.some(t=>t!==team&&(t.counts[sid]||0)>0):false;
 if(sid&&Math.min(available,budget)<=0&&!donorAvailable)
  throw Error('ステージ出撃上限または保有兵数に空きがありません。先に人数を減らしてください。');
 if(previous){
  delete team.counts[previous];delete team.divisions[previous];team.slots[index]=null;
  team.grid=team.grid.map(id=>id===previous?null:id);
 }
 if(sid){
  // From the default all-in-first-group formation, move ten soldiers to
  // another group on a job tap; never duplicate real people.
  // Reserve troops only fill the remaining stage budget. If none fits,
  // transfer soldiers out of another group rather than cloning them.
  if(Math.min(available,budget)<=0){
   const donor=game.sortiePlan.teams.find(t=>t!==team&&(t.counts[sid]||0)>0);
   const moved=Math.min(10,donor.counts[sid],tierRoom,groupRoom);
   donor.counts[sid]-=moved;
   if(!donor.counts[sid]){
    delete donor.counts[sid];delete donor.divisions[sid];
    donor.slots=donor.slots.map(v=>v===sid?null:v);
    donor.grid=donor.grid.map(v=>v===sid?null:v);
   }
   available=moved;
  }else available=Math.min(available,budget);
  team.slots[index]=sid;
  team.counts[sid]=Math.min(10,available);team.divisions[sid]=1;
  const legal=sortieAllowedCells(game,teamId),target=legal.find(c=>team.grid[c]===null);
  if(target===undefined)throw Error('陣形の配置枠が不足しています。');
  team.grid[target]=sid;
 }
 ensureSortiePlan(game);
 return teamOf(game,teamId);
}
/** Assign or move a real troop contingent on the 4x4 board.
 * One job contingent occupies one cell and each team holds at most three.
 */
export function setSortieGridCell(game,teamId,cellIndex,squadId){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),index=Number(cellIndex);
 if(!team||!Number.isInteger(index)||index<0||index>=SORTIE_GRID_CELLS)
  throw Error('4×4の有効なマスを選んでください。');
 const here=team.grid[index],sid=squadId===null||squadId===undefined||squadId===''?null:String(squadId);
 if(team.formation!==FREE_FORMATION)throw Error('通常陣形は固定配置です。自由陣形を選んだときだけマスを編集できます。');
 const allowedCells=sortieAllowedCells(game,teamId);
 if(!allowedCells.includes(index))throw Error('陣形の指定マス以外には配置できません。');
 const roles=team.formation===FREE_FORMATION?null:FORMATION_ROLE_CELL_JOBS(team.formation,index);
 const source=sid?ownSquads(game).find(s=>String(s.id)===sid):null;
 if(sid&&roles&&!roles.includes(source?.job))throw Error('このマスに配置できる職業は '+roles.join('・')+' です。');
 if(here===sid)return team;
 // Moving a deployed squad into another cell swaps with the occupant.
 if(sid&&team.slots.includes(sid)){
  const origin=team.grid.indexOf(sid);
  const originRoles=team.formation===FREE_FORMATION?null:FORMATION_ROLE_CELL_JOBS(team.formation,origin);
  const displaced=here?ownSquads(game).find(s=>String(s.id)===here):null;
  if(here&&originRoles&&!originRoles.includes(displaced?.job))
   throw Error('交換先の職業が陣形条件に一致しません。');
  if(origin>=0)team.grid[origin]=here;
  team.grid[index]=sid;
 }else{
  let slot=here?team.slots.indexOf(here):team.slots.indexOf(null);
  if(slot<0||slot>=sortieSquadCap(game))throw Error('軍師レベルの隊数上限です（最大'+sortieSquadCap(game)+'隊）。');
  setSortieJobSlot(game,teamId,slot,sid);
  const updated=teamOf(game,teamId);
  updated.grid=updated.grid.map(value=>value===sid||value===here?null:value);
  if(sid)updated.grid[index]=sid;
 }
 const refreshed=ensureSortiePlan(game).teams.find(t=>t.id===Number(teamId));
 if(!availableSortieOrders(game,teamId).includes(refreshed.initialOrder))refreshed.initialOrder='hold';
 return refreshed;
}
/** Orthogonal adjacency (up/down/left/right) of different jobs within a group. */
export function sortieAdjacentJobs(game,teamId){
 const team=teamOf(game,teamId);
 if(!team)return [];
 const squadMap=new Map(ownSquads(game).map(s=>[String(s.id),s]));
 const links=[];
 for(let i=0;i<SORTIE_GRID_CELLS;i++){
  const left=team.grid?.[i],a=squadMap.get(String(left));
  if(!left||!a)continue;
  const neighbors=[];
  if(i%SORTIE_GRID_EDGE<SORTIE_GRID_EDGE-1)neighbors.push(i+1);
  if(i+SORTIE_GRID_EDGE<SORTIE_GRID_CELLS)neighbors.push(i+SORTIE_GRID_EDGE);
  for(const other of neighbors){
   const right=team.grid[other],b=squadMap.get(String(right));
   if(right&&left!==right&&b)links.push({a:a.job,b:b.job,first:i,second:other});
  }
 }
 return links;
}
/** Pre-battle division: splits real men from one contingent, without duplicate troops. */
export function setSortieDivisions(game,teamId,squadId,parts){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),sid=String(squadId),n=Number(parts);
 if(!team||!team.counts[sid]||!Number.isInteger(n)||n<1||n>Math.min(4,team.counts[sid]))
  throw Error('分隊数は1～4、かつ実人数以下で選択してください。');
 team.divisions[sid]=n;return team;
}
export function setSortieCaptain(game,teamId,squadId){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId);
 if(!team||!sortieTeamSquads(game,teamId).some(s=>String(s.id)===String(squadId)))
  throw Error('隊長はその隊に編成された兵士から選んでください。');
 team.captainId=Number(squadId);return team;
}
export function setSortieFormation(game,teamId,formation){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId);
 if(!team||(formation!==FREE_FORMATION&&(!Object.hasOwn(SORTIE_FORMATIONS,formation)||SORTIE_FORMATIONS[formation].level>sortieLevel(game))))throw Error('この陣形は軍師レベルが不足しています。');
 if(formation===FREE_FORMATION){team.formation=formation;clampFreeTeam(team,ownSquads(game));}
 else rebuildNamedFormation(game,game.sortiePlan.teams,team,formation,formationTemplate(formation).slots);
 if(!availableSortieOrders(game,teamId).includes(team.initialOrder))team.initialOrder='hold';
 return team;
}
export function setSortieSlot(game,stage,teamId,slot){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),value=Number(slot);
 if(!team||!Number.isInteger(value)||!allowedSortieSlots(game,stage).includes(value))
  throw Error('未制圧では入口のみ選択できます。');
 // Teams must have distinct starting positions.
 if(allowedSortieSlots(game,stage).length>=game.sortiePlan.teams.filter(t=>sortieTeamCount(t)>0).length&&
    game.sortiePlan.teams.some(t=>t!==team&&sortieTeamCount(t)>0&&t.deploymentSlot===value))
  throw Error('その出撃地点は別の隊が使用中です。');
 team.deploymentSlot=value;return team;
}
export function resolvedSortieSlot(game,stage,team){
 const valid=allowedSortieSlots(game,stage);
 if(valid.includes(team.deploymentSlot))return team.deploymentSlot;
 return valid[(team.id-1)%valid.length];
}
export function availableSortieOrders(game,teamId){
 const jobs=new Set(sortieTeamSquads(game,teamId).map(s=>s.job));
 if(!jobs.size||!sortieFormationStatus(game,teamId).valid)return [];
 const orders=['charge','defend','hold','retreat'];
 const links=sortieAdjacentJobs(game,teamId);
 // A healer needs a neighboring unit to issue group support; a scout needs
 // a neighboring unit to cover a building search. Moving the same jobs
 // apart changes command availability without consuming personnel.
 if(jobs.has('僧侶')||jobs.has('召喚士'))orders.push('support');
 if(['忍者','シーフ','召喚士'].some(job=>jobs.has(job)))orders.push('explore');
 if([...jobs].some(j=>['魔法使い','忍者'].includes(j)))orders.push('destroy');
 if(['忍者','シーフ','魔法使い'].some(job=>jobs.has(job)))orders.push('weaken');
 return orders;
}
/** Store several battle methods during inn planning. Targets are chosen in battle. */
export function setSortieTactics(game,teamId,tacticIds){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),allowed=availableSortieOrders(game,teamId);
 if(!team||!Array.isArray(tacticIds))throw Error('作戦を選択してください。');
 const jobs=new Set(sortieTeamSquads(game,teamId).map(s=>STORY_JOB_TO_STRATEGY_JOB[s.job]).filter(Boolean));
 const unique=[...new Set(tacticIds)];
 if(unique.length>16||unique.some(id=>{
  const method=STRATEGY_METHODS[id];
  return !method||!allowed.includes(method.mode)||
   (method.jobs.length>0&&!method.jobs.some(job=>jobs.has(job)));
 }))throw Error('配置陣形・職業の条件を満たさない作戦があります。');
 team.tactics=unique;return team;
}
export function setSortieOrder(game,teamId,order){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId);
 if(!team||!availableSortieOrders(game,teamId).includes(order))
  throw Error('この隊の編成では、その号令を使えません。');
 team.initialOrder=order;return team;
}
/** Job-specific suppression effects; activated only by a real planned debuff order. */
export function sortieDebuffTypes(game,teamId){
 if(!sortieFormationStatus(game,teamId).valid)return [];
 const jobs=new Set(sortieTeamSquads(game,teamId).map(s=>s.job));
 return [
  ...(jobs.has('忍者')?[{job:'忍者',stat:'speed',amount:.18,name:'機動力低下'}]:[]),
  ...(jobs.has('シーフ')?[{job:'シーフ',stat:'defense',amount:.15,name:'防御力低下'}]:[]),
  ...(jobs.has('魔法使い')?[{job:'魔法使い',stat:'attack',amount:.2,name:'攻撃力低下'},{job:'魔法使い',stat:'heal_block',amount:1,name:'回復阻止'}]:[]),
  ...(jobs.has('シーフ')||jobs.has('忍者')?[{job:jobs.has('シーフ')?'シーフ':'忍者',stat:'buff_block',amount:1,name:'強化阻止'}]:[])
 ];
}
/** Convert assigned inventory into at most 50 actual battle participants. */
export function allocateThreeTeamSortie(game,stage,limit=SORTIE_TOTAL_RENDER_LIMIT){
 if(!game?.sortiePlan||game.sortiePlan.version!==1)return null;
 const teams=sortieTeams(game),sources=new Map(ownSquads(game).map(s=>[String(s.id),s]));
 const entries=teams.flatMap(team=>Object.entries(team.counts).map(([sid,count])=>({
  team,squad:sources.get(sid),available:count
 }))).filter(x=>x.squad&&x.available>0);
 const total=entries.reduce((sum,x)=>sum+x.available,0);
 if(!total)throw Error('出撃する隊に兵士を編成してください。');
 const stageCap=Number.isInteger(stage?.deploymentLimit)?stage.deploymentLimit:limit;
 const target=Math.min(Math.trunc(limit),Math.max(0,stageCap),total);
 if(!target)throw Error('このステージは兵士を出撃させられません。');
 const allocations=entries.map(x=>({...x,count:Math.floor(x.available*target/total),
  fraction:(x.available*target/total)%1}));
 let rest=target-allocations.reduce((sum,x)=>sum+x.count,0);
 for(const item of [...allocations].sort((a,b)=>b.fraction-a.fraction||a.team.id-b.team.id)){
  if(!rest)break;
  if(item.count<item.available){item.count++;rest--;}
 }
 // Preserve one soldier per occupied role if the stage deployment limit permits.
 if(target>=entries.length){
  for(const missing of allocations.filter(a=>a.count===0)){
   const donor=allocations.filter(a=>a.count>1).sort((a,b)=>b.count-a.count)[0];
   if(donor){donor.count--;missing.count++;}
  }
 }
 // Each nonempty team must exist on the field (if the renderer has capacity).
 const active=teams.filter(t=>sortieTeamCount(t)>0);
 if(target>=active.length){
  for(const team of active){
   if(allocations.some(a=>a.team===team&&a.count>0))continue;
   const reserve=allocations.filter(a=>a.count>1)
    .sort((a,b)=>b.count-a.count)[0];
   const receiver=allocations.find(a=>a.team===team);
   if(reserve&&receiver){reserve.count--;receiver.count++;}
  }
 }
 // Normalize duplicate saved cells when a formerly empty team gains soldiers.
 const occupied=new Set(),positions=new Map();
 for(const team of active){
  const valid=allowedSortieSlots(game,stage);
  const wanted=resolvedSortieSlot(game,stage,team);
  const slot=!occupied.has(wanted)?wanted:(valid.find(x=>!occupied.has(x))??wanted);
  if(slot===undefined)throw Error('出撃可能な場所が不足しています。');
  positions.set(team.id,slot);occupied.add(slot);
 }
 return allocations.filter(x=>x.count>0).map(x=>({
  teamId:x.team.id,squad:x.squad,count:x.count,
  formationCell:x.team.grid.indexOf(String(x.squad.id)),
  divisionCount:Math.min(x.count,Math.max(1,x.team.divisions?.[String(x.squad.id)]||1)),
  deploymentSlot:positions.get(x.team.id),
  captain:sources.get(String(x.team.captainId))||null,
  formation:sortieFormationStatus(game,x.team.id).id,
  initialOrder:availableSortieOrders(game,x.team.id).includes(x.team.initialOrder)?x.team.initialOrder:'hold'
 }));
}
