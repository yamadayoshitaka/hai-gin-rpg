/**
 * User-directed three-team sortie planning. Teams are separate from strategists:
 * inventory remains in campaign.squads, while this plan assigns actual people.
 * A source squad may be split between teams but never duplicated.
 */
export const SORTIE_TEAM_IDS=Object.freeze([1,2,3]);
export const SORTIE_FORMATIONS=Object.freeze({
 attack:'前進陣形',balanced:'標準陣形',support:'後衛陣形'
});
export const SORTIE_ENTRY_SLOTS=Object.freeze([9,10,11]);
export const SORTIE_TOTAL_RENDER_LIMIT=50; // The current campaign battle renderer.
const ACTIVE_ORDER_IDS=Object.freeze(['charge','defend','hold','retreat','support','explore']);
const allSlots=Object.freeze(Array.from({length:12},(_,i)=>i));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const ownSquads=game=>(game?.campaign?.squads||[]).filter(s=>s.count>0&&String(s.commanderId??'player')!=='reserve');
export const stageIsControlled=(game,stage)=>Boolean(stage?.id&&game?.completedStages?.includes(stage.id));
export const allowedSortieSlots=(game,stage)=>stageIsControlled(game,stage)?allSlots:SORTIE_ENTRY_SLOTS;
const blankTeam=id=>({id,counts:{},captainId:null,formation:'balanced',deploymentSlot:SORTIE_ENTRY_SLOTS[id-1],initialOrder:'charge'});
const teamOf=(game,id)=>game.sortiePlan?.teams?.find(t=>t.id===Number(id));
const rarityScore=s=>({N:0,R:1,SR:2,SSR:3,UR:4})[s?.rarity]??0;

/**
 * Normalizes old saves and post-battle casualties without creating extra units.
 * Only create the default plan when the user opens the new sortie editor.
 */
export function ensureSortiePlan(game){
 if(!game?.campaign)throw Error('編成データがありません。');
 const sources=ownSquads(game),byId=new Map(sources.map(s=>[String(s.id),s]));
 const saved=game.sortiePlan?.version===1?game.sortiePlan.teams:[];
 const remaining=new Map(sources.map(s=>[String(s.id),s.count]));
 const teams=SORTIE_TEAM_IDS.map(id=>{
  const old=saved?.find(t=>Number(t?.id)===id),team=blankTeam(id);
  if(!old)return team;
  for(const [sid,count] of Object.entries(old.counts||{})){
   const available=remaining.get(sid)||0;
   const valid=clamp(Number.isFinite(Number(count))?Math.trunc(Number(count)):0,0,available);
   if(valid){team.counts[sid]=valid;remaining.set(sid,available-valid);}
  }
  team.formation=Object.hasOwn(SORTIE_FORMATIONS,old.formation)?old.formation:'balanced';
  team.deploymentSlot=Number.isInteger(old.deploymentSlot)&&allSlots.includes(old.deploymentSlot)?old.deploymentSlot:SORTIE_ENTRY_SLOTS[id-1];
  const candidates=Object.keys(team.counts).map(sid=>byId.get(sid)).filter(Boolean);
  const captain=candidates.find(s=>String(s.id)===String(old.captainId))||
   [...candidates].sort((a,b)=>rarityScore(b)-rarityScore(a))[0];
  team.captainId=captain?.id??null;
  team.initialOrder=ACTIVE_ORDER_IDS.includes(old.initialOrder)?old.initialOrder:'charge';
  return team;
 });
 if(!saved?.length){
  // Default: preserve all existing non-reserve soldiers as Team 1.
  for(const s of sources)teams[0].counts[String(s.id)]=s.count;
  teams[0].captainId=[...sources].sort((a,b)=>rarityScore(b)-rarityScore(a))[0]?.id??null;
 }
 game.sortiePlan={version:1,teams};
 return game.sortiePlan;
}
export const sortieTeams=game=>ensureSortiePlan(game).teams;
export const sortieTeamCount=team=>Object.values(team?.counts||{}).reduce((a,b)=>a+Number(b||0),0);
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
 if(n)team.counts[String(source.id)]=n;else delete team.counts[String(source.id)];
 const candidates=sortieTeamSquads(game,teamId);
 if(!candidates.some(s=>String(s.id)===String(team.captainId))){
  team.captainId=[...candidates].sort((a,b)=>rarityScore(b)-rarityScore(a))[0]?.id??null;
 }
 if(!availableSortieOrders(game,teamId).includes(team.initialOrder))team.initialOrder='hold';
 return team;
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
 if(!team||!Object.hasOwn(SORTIE_FORMATIONS,formation))throw Error('有効な隊列を選んでください。');
 team.formation=formation;return team;
}
export function setSortieSlot(game,stage,teamId,slot){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),value=Number(slot);
 if(!team||!Number.isInteger(value)||!allowedSortieSlots(game,stage).includes(value))
  throw Error('未制圧では入口のみ選択できます。');
 // Teams must have distinct starting positions.
 if(game.sortiePlan.teams.some(t=>t!==team&&sortieTeamCount(t)>0&&t.deploymentSlot===value))
  throw Error('その出撃地点は別の隊が使用中です。');
 team.deploymentSlot=value;return team;
}
export function resolvedSortieSlot(game,stage,team){
 const valid=allowedSortieSlots(game,stage);
 if(valid.includes(team.deploymentSlot))return team.deploymentSlot;
 return SORTIE_ENTRY_SLOTS[team.id-1];
}
export function availableSortieOrders(game,teamId){
 const jobs=new Set(sortieTeamSquads(game,teamId).map(s=>s.job));
 if(!jobs.size)return [];
 const orders=['charge','defend','hold','retreat'];
 if(jobs.has('僧侶'))orders.push('support');
 if(jobs.has('忍者')||jobs.has('シーフ'))orders.push('explore');
 return orders;
}
export function setSortieOrder(game,teamId,order){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId);
 if(!team||!availableSortieOrders(game,teamId).includes(order))
  throw Error('この隊の編成では、その号令を使えません。');
 team.initialOrder=order;return team;
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
 const target=Math.min(Math.trunc(limit),total);
 const allocations=entries.map(x=>({...x,count:Math.floor(x.available*target/total),
  fraction:(x.available*target/total)%1}));
 let rest=target-allocations.reduce((sum,x)=>sum+x.count,0);
 for(const item of [...allocations].sort((a,b)=>b.fraction-a.fraction||a.team.id-b.team.id)){
  if(!rest)break;
  if(item.count<item.available){item.count++;rest--;}
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
 return allocations.filter(x=>x.count>0).map(x=>({
  teamId:x.team.id,squad:x.squad,count:x.count,
  deploymentSlot:resolvedSortieSlot(game,stage,x.team),
  captain:sources.get(String(x.team.captainId))||null,
  formation:x.team.formation,
  initialOrder:availableSortieOrders(game,x.team.id).includes(x.team.initialOrder)?x.team.initialOrder:'hold'
 }));
}
