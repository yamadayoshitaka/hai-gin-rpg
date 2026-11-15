/**
 * User-directed three-team sortie planning. Teams are separate from strategists:
 * inventory remains in campaign.squads, while this plan assigns actual people.
 * A source squad may be split between teams but never duplicated.
 */
export const SORTIE_TEAM_IDS=Object.freeze([1,2,3]);
export const SORTIE_SQUADS_PER_GROUP=16;
/** Temporary level-99 battle/formation test without rewriting career XP. */
export const SORTIE_TEST_LEVEL=99;
export function sortieLevel(game){
 const requested=game?.sortieTestLevel;
 return Math.max(1,Math.min(99,Number.isFinite(Number(requested))?Math.trunc(Number(requested)):Number(game?.campaign?.commander?.level)||1));
}
export function sortieSquadCap(game){return Math.min(16,4+Math.floor(sortieLevel(game)/7));}
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
export const SORTIE_FORMATIONS=Object.freeze({
 attack:Object.freeze({name:'前進陣形',level:1,attack:.08,defense:0,mobility:0}),
 balanced:Object.freeze({name:'標準陣形',level:1,attack:.04,defense:.04,mobility:0}),
 support:Object.freeze({name:'後衛陣形',level:1,attack:0,defense:.06,mobility:.04,healing:.1}),
 wall:Object.freeze({name:'防壁陣形',level:5,attack:0,defense:.12,mobility:-.05}),
 spear:Object.freeze({name:'槍衾陣形',level:10,attack:.1,defense:.08,mobility:-.04}),
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
export const unlockedSortieFormations=game=>Object.entries(SORTIE_FORMATIONS)
 .filter(([,x])=>sortieLevel(game)>=x.level).map(([id])=>id);
export function sortieFormationBuff(game,teamId){
 const t=game?.sortiePlan?.teams?.find(x=>x.id===Number(teamId));
 const f=SORTIE_FORMATIONS[t?.formation]||SORTIE_FORMATIONS.balanced;
 return {attack:f.attack||0,defense:f.defense||0,mobility:f.mobility||0,healing:f.healing||0};
}
export const SORTIE_ENTRY_SLOTS=Object.freeze([9,10,11]);
export const SORTIE_TOTAL_RENDER_LIMIT=50; // The current campaign battle renderer.
const ACTIVE_ORDER_IDS=Object.freeze(['charge','defend','hold','retreat','support','explore','destroy','weaken']);
const allSlots=Object.freeze(Array.from({length:12},(_,i)=>i));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const ownSquads=game=>(game?.campaign?.squads||[]).filter(s=>s.count>0&&String(s.commanderId??'player')!=='reserve');
export const stageIsControlled=(game,stage)=>Boolean(stage?.id&&game?.completedStages?.includes(stage.id));
export const allowedSortieSlots=(game,stage)=>stageIsControlled(game,stage)?allSlots:SORTIE_ENTRY_SLOTS;
const blankTeam=id=>({id,slots:Array(SORTIE_SQUADS_PER_GROUP).fill(null),grid:Array(SORTIE_GRID_CELLS).fill(null),counts:{},divisions:{},captainId:null,formation:'balanced',deploymentSlot:SORTIE_ENTRY_SLOTS[id-1],initialOrder:'charge'});
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
  // Four distinct troop contingents per group. Migrate the former unbounded
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
  team.formation=Object.hasOwn(SORTIE_FORMATIONS,old.formation)&&
   SORTIE_FORMATIONS[old.formation].level<=sortieLevel(game)?old.formation:'balanced';
  const oldGrid=Array.isArray(old.grid)&&old.grid.length===SORTIE_GRID_CELLS?old.grid:null;
  team.slots.filter(Boolean).forEach((sid,index)=>{
   const savedIndex=oldGrid?.findIndex(v=>String(v)===sid);
   const desired=Number.isInteger(savedIndex)&&savedIndex>=0&&!team.grid[savedIndex]?savedIndex:SORTIE_FORMATION_CELLS[team.formation][index];
   const cell=!team.grid[desired]?desired:team.grid.indexOf(null);
   if(cell>=0)team.grid[cell]=sid;
  });
  team.deploymentSlot=Number.isInteger(old.deploymentSlot)&&allSlots.includes(old.deploymentSlot)?old.deploymentSlot:SORTIE_ENTRY_SLOTS[id-1];
  const candidates=Object.keys(team.counts).map(sid=>byId.get(sid)).filter(Boolean);
  const captain=candidates.find(s=>String(s.id)===String(old.captainId))||
   [...candidates].sort((a,b)=>rarityScore(b)-rarityScore(a))[0];
  team.captainId=captain?.id??null;
  team.initialOrder=ACTIVE_ORDER_IDS.includes(old.initialOrder)?old.initialOrder:'charge';
  return team;
 });
 if(!saved?.length){
  // Preserve as many existing troop contingents as possible, four per group.
  sources.slice(0,SORTIE_TEAM_IDS.length*sortieSquadCap(game)).forEach((s,index)=>{
   const cap=sortieSquadCap(game),team=teams[Math.floor(index/cap)];
   team.slots[index%cap]=String(s.id);
   team.counts[String(s.id)]=s.count;team.divisions[String(s.id)]=1;
  });
  teams.forEach(team=>{
   team.slots.filter(Boolean).forEach((sid,index)=>{team.grid[SORTIE_FORMATION_CELLS.balanced[index]]=sid;});
   const candidates=sources.filter(s=>team.counts[String(s.id)]);
   team.captainId=[...candidates].sort((a,b)=>rarityScore(b)-rarityScore(a))[0]?.id??null;
  });
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
 const sid=String(source.id);
 if(n){
  if(!team.slots.includes(sid)){
   const empty=team.slots.indexOf(null);
   if(empty<0||empty>=sortieSquadCap(game))throw Error('軍師レベルの隊数上限です（最大'+sortieSquadCap(game)+'隊）。');
   team.slots[empty]=sid;
   const preferred=SORTIE_FORMATION_CELLS[team.formation][empty];
   team.grid[team.grid[preferred]===null?preferred:team.grid.indexOf(null)]=sid;
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
/** Assign a job contingent to one of four visible formation cells. */
export function setSortieJobSlot(game,teamId,slotIndex,squadId){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),index=Number(slotIndex);
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
 if(sid&&available<=0&&!game.sortiePlan.teams.some(t=>t!==team&&(t.counts[sid]||0)>0))
  throw Error('このジョブの配属可能人数がありません。');
 if(previous){
  delete team.counts[previous];delete team.divisions[previous];team.slots[index]=null;
  team.grid=team.grid.map(id=>id===previous?null:id);
 }
 if(sid){
  // From the default all-in-first-group formation, move ten soldiers to
  // another group on a job tap; never duplicate real people.
  if(available<=0){
   const donor=game.sortiePlan.teams.find(t=>t!==team&&(t.counts[sid]||0)>0);
   const moved=Math.min(10,donor.counts[sid]);
   donor.counts[sid]-=moved;
   if(!donor.counts[sid]){
    delete donor.counts[sid];delete donor.divisions[sid];
    donor.slots=donor.slots.map(v=>v===sid?null:v);
    donor.grid=donor.grid.map(v=>v===sid?null:v);
   }
   available=moved;
  }
  team.slots[index]=sid;
  team.counts[sid]=Math.min(10,available);team.divisions[sid]=1;
  const target=SORTIE_FORMATION_CELLS[team.formation][index];
  team.grid[team.grid[target]===null?target:team.grid.indexOf(null)]=sid;
 }
 ensureSortiePlan(game);
 return teamOf(game,teamId);
}
/** Assign or move a real troop contingent on the 4x4 board.
 * One contingent occupies one cell and each group still holds at most four.
 */
export function setSortieGridCell(game,teamId,cellIndex,squadId){
 ensureSortiePlan(game);
 const team=teamOf(game,teamId),index=Number(cellIndex);
 if(!team||!Number.isInteger(index)||index<0||index>=SORTIE_GRID_CELLS)
  throw Error('4×4の有効なマスを選んでください。');
 const here=team.grid[index],sid=squadId===null||squadId===undefined||squadId===''?null:String(squadId);
 if(here===sid)return team;
 // Moving a deployed squad into another cell swaps with the occupant.
 if(sid&&team.slots.includes(sid)){
  const origin=team.grid.indexOf(sid);
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
 if(!team||!Object.hasOwn(SORTIE_FORMATIONS,formation)||SORTIE_FORMATIONS[formation].level>sortieLevel(game))throw Error('この陣形は軍師レベルが不足しています。');
 team.formation=formation;
 // A chosen preset rearranges current contingents on the same 4x4 board.
 const order=team.slots.filter(Boolean);
 team.grid=Array(SORTIE_GRID_CELLS).fill(null);
 order.forEach((sid,index)=>{team.grid[SORTIE_FORMATION_CELLS[formation][index]]=sid;});
 if(!availableSortieOrders(game,teamId).includes(team.initialOrder))team.initialOrder='hold';
 return team;
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
 const links=sortieAdjacentJobs(game,teamId);
 // A healer needs a neighboring unit to issue group support; a scout needs
 // a neighboring unit to cover a building search. Moving the same jobs
 // apart changes command availability without consuming personnel.
 if(links.some(link=>(link.a==='僧侶'&&link.b!=='僧侶')||(link.b==='僧侶'&&link.a!=='僧侶')))
  orders.push('support');
 if(links.some(link=>['忍者','シーフ'].includes(link.a)||['忍者','シーフ'].includes(link.b)))
  orders.push('explore');
 if([...jobs].some(j=>['魔法使い','忍者'].includes(j)))orders.push('destroy');
 if(links.some(link=>[link.a,link.b].some(j=>['忍者','シーフ','魔法使い'].includes(j))))
  orders.push('weaken');
 return orders;
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
 const jobs=new Set(sortieTeamSquads(game,teamId).map(s=>s.job));
 return [
  ...(jobs.has('忍者')?[{job:'忍者',stat:'speed',amount:.18,name:'機動力低下'}]:[]),
  ...(jobs.has('シーフ')?[{job:'シーフ',stat:'defense',amount:.15,name:'防御力低下'}]:[]),
  ...(jobs.has('魔法使い')?[{job:'魔法使い',stat:'attack',amount:.2,name:'攻撃力低下'}]:[])
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
 // Normalize duplicate saved cells when a formerly empty team gains soldiers.
 const occupied=new Set(),positions=new Map();
 for(const team of active){
  const valid=allowedSortieSlots(game,stage);
  const wanted=resolvedSortieSlot(game,stage,team);
  const slot=!occupied.has(wanted)?wanted:valid.find(x=>!occupied.has(x));
  if(slot===undefined)throw Error('出撃可能な場所が不足しています。');
  positions.set(team.id,slot);occupied.add(slot);
 }
 return allocations.filter(x=>x.count>0).map(x=>({
  teamId:x.team.id,squad:x.squad,count:x.count,
  formationCell:x.team.grid.indexOf(String(x.squad.id)),
  divisionCount:Math.min(x.count,Math.max(1,x.team.divisions?.[String(x.squad.id)]||1)),
  deploymentSlot:positions.get(x.team.id),
  captain:sources.get(String(x.team.captainId))||null,
  formation:x.team.formation,
  initialOrder:availableSortieOrders(game,x.team.id).includes(x.team.initialOrder)?x.team.initialOrder:'hold'
 }));
}
