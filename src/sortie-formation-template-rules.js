/** Fixed formation preset sizes and tier quotas. Quotas are ceilings, not required minima. */
export const SORTIE_RARITIES=Object.freeze(['N','R','SR','SSR','UR']);
const rule=(slots,maxTroops,N,R,SR,SSR,UR)=>Object.freeze({slots,maxTroops,rarityCaps:Object.freeze({N,R,SR,SSR,UR})});
export const FORMATION_TEMPLATE_LIMITS=Object.freeze({
 attack:rule(2,30,30,12,6,3,1),balanced:rule(3,40,40,14,8,4,2),
 support:rule(2,28,28,12,8,4,2),wall:rule(2,36,36,16,10,6,2),
 spear:rule(3,40,40,16,12,6,2),arrow:rule(3,38,38,18,12,6,2),
 wedge:rule(3,42,42,20,12,8,3),pincer:rule(3,42,42,20,14,8,3),
 circle:rule(3,42,42,20,16,8,3),ambush:rule(2,40,40,24,16,10,4),
 cross:rule(3,44,44,26,18,12,4),fortress:rule(3,46,46,28,20,12,5),
 dragon:rule(3,48,48,30,22,14,6),constellation:rule(3,50,50,32,24,16,8),
 free:rule(3,50,50,40,30,20,10)
});
export const formationTemplate=id=>FORMATION_TEMPLATE_LIMITS[id]||null;
export const rarityOf=squad=>SORTIE_RARITIES.includes(String(squad?.rarity))?String(squad.rarity):'N';
export function formationRarityCounts(team,squads){
 const byId=new Map(squads.map(s=>[String(s.id),s]));
 const counts=Object.fromEntries(SORTIE_RARITIES.map(t=>[t,0]));
 for(const [id,n] of Object.entries(team?.counts||{}))
  if(Number(n)>0)counts[rarityOf(byId.get(id))]+=Number(n);
 return counts;
}
export function formationCapacityStatus(team,squads,stageLimit=50){
 const spec=formationTemplate(team?.formation)||formationTemplate('free');
 const rarity=formationRarityCounts(team,squads);
 const total=Object.values(rarity).reduce((a,b)=>a+b,0);
 const capacity=Math.min(spec.maxTroops,Math.max(0,Number(stageLimit)||0));
 const excess=Object.keys(rarity).find(t=>rarity[t]>spec.rarityCaps[t]);
 return {spec,rarity,total,capacity,valid:total<=capacity&&!excess,
 error:total>capacity?'総人数上限'+capacity+'人を超過':excess?excess+'は最大'+spec.rarityCaps[excess]+'人':''};
}
