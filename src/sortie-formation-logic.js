/** Job-sensitive tactical presets. 4 initial slots are the recognizable footprint. */
export const ROLE_JOBS=Object.freeze({
 front:['騎士','盾騎士','格闘家'],guard:['盾騎士','騎士'],
 scout:['忍者','シーフ'],ranged:['魔法使い','召喚士','弓使い'],
 support:['僧侶','召喚士'],any:['騎士','盾騎士','忍者','シーフ','僧侶','魔法使い','召喚士','格闘家','弓使い']
});
export const FREE_FORMATION='free';
export const FREE_FORMATION_NAME='自由陣形';
/** Four core cells at Lv1; each seven commander levels unlock one more slot. */
export const formationCellsAtLevel=(formation,positions,capacity)=>{
 const count=Math.max(4,Math.min(16,Number(capacity)||4));
 return formation===FREE_FORMATION?Array.from({length:16},(_,i)=>i):positions?.[formation]?.slice(0,count)||[];
};
export const ROLE_NAMES=Object.freeze({front:'前衛',guard:'盾役',scout:'遊撃',ranged:'遠隔',support:'支援',any:'増援'});
/** Minimum living soldiers in EACH fixed formation cell, not only each role type.
 * Different cells may use the same job; both cells must independently qualify. */
export const FORMATION_MINIMUM_SOLDIERS=Object.freeze({front:3,guard:3,scout:2,ranged:2,support:2});
export const formationMinimumForRole=role=>FORMATION_MINIMUM_SOLDIERS[role]||1;
export function formationJobMinimums(team,ownedSquads,positions,slots=null){
 const ids=positions?.[team?.formation]?.slice(0,Number(slots)||team?.slots?.filter(Boolean).length||4)||[];
 const sources=new Map(ownedSquads.map(s=>[String(s.id),s]));
 return ids.map((cell,rank)=>{
  const sid=team?.grid?.[cell],squad=sources.get(String(sid)),role=FORMATION_ROLES[team.formation]?.[rank];
  const min=formationMinimumForRole(role),current=Number(team?.counts?.[String(sid)]||0);
  return {cell,rank,role,job:squad?.job||null,options:ROLE_JOBS[role]||[],sourceId:squad?String(squad.id):null,
   min,current,valid:Boolean(squad)&&current>=min};
 });
}

const LEADS=Object.freeze({
 attack:['front','front','scout','ranged'],
 balanced:['front','support','ranged','scout'],
 support:['support','ranged','guard','support'],
 wall:['guard','guard','support','ranged'],
 spear:['guard','front','front','ranged'],
 arrow:['ranged','scout','ranged','guard'],
 wedge:['front','front','front','support'],
 pincer:['scout','front','scout','ranged'],
 circle:['guard','support','ranged','scout'],
 ambush:['scout','scout','ranged','front'],
 cross:['front','guard','support','ranged'],
 fortress:['guard','guard','guard','support'],
 dragon:['front','ranged','scout','support'],
 constellation:['front','support','ranged','scout']
});
// Every unlocked reinforcement position is also a fixed role of its preset.
const REINFORCEMENT_ROLES=Object.freeze(['front','guard','ranged','support','scout']);
export const FORMATION_ROLES=Object.freeze(Object.fromEntries(Object.entries(LEADS)
 .map(([id,roles],formationIndex)=>[id,Object.freeze([...roles,
  ...Array.from({length:12},(_,i)=>REINFORCEMENT_ROLES[(formationIndex+i)%REINFORCEMENT_ROLES.length])])])));
export function formationStatus(team,ownedSquads,positions,capacity=16){
 if(team?.formation===FREE_FORMATION)return {id:'free',valid:false,reason:'自由陣形：全16マス配置可能・バフなし'};
 const roles=FORMATION_ROLES[team?.formation],cells=positions?.[team?.formation],ids=(team?.slots||[]).filter(Boolean);
 if(!roles||!cells||!ids.length||!Array.isArray(team.grid))
  return {id:'free',valid:false,reason:'自由配置：陣形未成立'};
 if(ids.length>=4&&cells.slice(0,4).some(cell=>!team.grid[cell]))
  return {id:'free',valid:false,reason:'陣形不成立：基本4枠に必要な職業隊が不足'};
 const jobs=new Map(ownedSquads.map(s=>[String(s.id),s.job]));
 for(const sid of ids){
  const cell=team.grid.indexOf(String(sid)),rank=cells.slice(0,Math.max(4,Math.min(ids.length,Number(capacity)||4))).indexOf(cell);
  if(rank<0||!ROLE_JOBS[roles[rank]]?.includes(jobs.get(String(sid))))
   return {id:'free',valid:false,reason:'自由配置：職業と位置が陣形条件に不一致'};
 }
 return {id:team.formation,valid:true,reason:'陣形成立：配置と職業が一致'};
}
export function arrangeFormation(team,ownedSquads,formation,positions,capacity=16){
 if(formation===FREE_FORMATION){team.formation=formation;return formationStatus(team,ownedSquads,positions,capacity);}
 const ids=team.slots.filter(Boolean),cells=positions[formation],roles=FORMATION_ROLES[formation],
  jobs=new Map(ownedSquads.map(s=>[String(s.id),s.job])),remaining=[...ids],grid=Array(16).fill(null);
 // Fill specialist positions first, leaving non-matching squads in a free layout.
 for(let i=0;i<Math.max(4,Math.min(ids.length,Number(capacity)||4));i++){
  const index=remaining.findIndex(sid=>ROLE_JOBS[roles[i]]?.includes(jobs.get(String(sid))));
  if(index>=0)grid[cells[i]]=remaining.splice(index,1)[0];
 }
 for(const sid of remaining){
  const cell=cells.slice(0,Math.max(4,Math.min(ids.length,Number(capacity)||4))).find(c=>grid[c]===null);
  if(cell!==undefined)grid[cell]=sid;
 }
 team.grid=grid;
 return formationStatus(team,ownedSquads,positions,capacity);
}
