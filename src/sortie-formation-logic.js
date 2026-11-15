/** Job-sensitive tactical presets. 4 initial slots are the recognizable footprint. */
export const ROLE_JOBS=Object.freeze({
 front:['騎士','盾騎士','格闘家'],guard:['盾騎士','騎士'],
 scout:['忍者','シーフ'],ranged:['魔法使い','召喚士'],
 support:['僧侶','召喚士'],any:['騎士','盾騎士','忍者','シーフ','僧侶','魔法使い','召喚士','格闘家']
});
export const ROLE_NAMES=Object.freeze({front:'前衛',guard:'盾役',scout:'遊撃',ranged:'遠隔',support:'支援',any:'増援'});
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
export const FORMATION_ROLES=Object.freeze(Object.fromEntries(Object.entries(LEADS)
 .map(([id,roles])=>[id,Object.freeze([...roles,...Array(12).fill('any')])])));
export function formationStatus(team,ownedSquads,positions){
 const roles=FORMATION_ROLES[team?.formation],cells=positions?.[team?.formation],ids=(team?.slots||[]).filter(Boolean);
 if(!roles||!cells||!ids.length||!Array.isArray(team.grid))
  return {id:'free',valid:false,reason:'自由配置：陣形未成立'};
 const jobs=new Map(ownedSquads.map(s=>[String(s.id),s.job]));
 for(const sid of ids){
  const cell=team.grid.indexOf(String(sid)),rank=cells.slice(0,Math.max(4,ids.length)).indexOf(cell);
  if(rank<0||!ROLE_JOBS[roles[rank]]?.includes(jobs.get(String(sid))))
   return {id:'free',valid:false,reason:'自由配置：職業と位置が陣形条件に不一致'};
 }
 return {id:team.formation,valid:true,reason:'陣形成立：配置と職業が一致'};
}
export function arrangeFormation(team,ownedSquads,formation,positions){
 const ids=team.slots.filter(Boolean),cells=positions[formation],roles=FORMATION_ROLES[formation],
  jobs=new Map(ownedSquads.map(s=>[String(s.id),s.job])),remaining=[...ids],grid=Array(16).fill(null);
 // Fill specialist positions first, leaving non-matching squads in a free layout.
 for(let i=0;i<Math.max(4,ids.length);i++){
  const index=remaining.findIndex(sid=>ROLE_JOBS[roles[i]]?.includes(jobs.get(String(sid))));
  if(index>=0)grid[cells[i]]=remaining.splice(index,1)[0];
 }
 for(const sid of remaining){
  const cell=cells.find(c=>grid[c]===null);
  if(cell!==undefined)grid[cell]=sid;
 }
 team.grid=grid;
 return formationStatus(team,ownedSquads,positions);
}
