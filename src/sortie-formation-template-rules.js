/** Every named formation requires exactly three job contingents; free allows one to three. Quotas are ceilings. */
export const SORTIE_RARITIES=Object.freeze(['N','R','SR','SSR','UR']);
const rule=(slots,maxTroops,N,R,SR,SSR,UR)=>Object.freeze({slots,maxTroops,rarityCaps:Object.freeze({N,R,SR,SSR,UR})});
export const FORMATION_TEMPLATE_LIMITS=Object.freeze({
 attack:rule(3,30,30,12,6,3,1),balanced:rule(3,40,40,14,8,4,2),
 support:rule(3,28,28,12,8,4,2),wall:rule(3,36,36,16,10,6,2),
 spear:rule(3,40,40,16,12,6,2),arrow:rule(3,38,38,18,12,6,2),
 highground:rule(3,36,36,16,10,6,2),
 wedge:rule(3,42,42,20,12,8,3),pincer:rule(3,42,42,20,14,8,3),
 circle:rule(3,42,42,20,16,8,3),ambush:rule(3,40,40,24,16,10,4),
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


/**
 * Higher-impact formations require a larger coordinated force and elite troops.
 * These are deployment minima; existing rarityCaps remain maxima.
 */
export const FORMATION_ENTRY_REQUIREMENTS=Object.freeze({
 attack:{people:7,rPlus:0,srPlus:0,ssrPlus:0,ur:0},
 balanced:{people:7,rPlus:0,srPlus:0,ssrPlus:0,ur:0},
 support:{people:7,rPlus:0,srPlus:0,ssrPlus:0,ur:0},
 wall:{people:8,rPlus:0,srPlus:0,ssrPlus:0,ur:0},
 spear:{people:10,rPlus:1,srPlus:0,ssrPlus:0,ur:0},
 arrow:{people:12,rPlus:1,srPlus:0,ssrPlus:0,ur:0},
 highground:{people:9,rPlus:0,srPlus:0,ssrPlus:0,ur:0},
 wedge:{people:14,rPlus:2,srPlus:0,ssrPlus:0,ur:0},
 pincer:{people:16,rPlus:3,srPlus:0,ssrPlus:0,ur:0},
 circle:{people:18,rPlus:3,srPlus:1,ssrPlus:0,ur:0},
 ambush:{people:20,rPlus:4,srPlus:2,ssrPlus:0,ur:0},
 cross:{people:22,rPlus:5,srPlus:3,ssrPlus:0,ur:0},
 fortress:{people:24,rPlus:5,srPlus:3,ssrPlus:1,ur:0},
 dragon:{people:28,rPlus:6,srPlus:4,ssrPlus:2,ur:0},
 constellation:{people:32,rPlus:8,srPlus:5,ssrPlus:3,ur:1}
});
export const FORMATION_BATTLE_PURPOSES=Object.freeze({
 attack:{purpose:'前線を押し上げ、近接部隊が先行する',movement:'前衛先行・遠隔後続'},
 balanced:{purpose:'前衛・支援・後衛の距離を維持して進軍',movement:'三層を保った連携前進'},
 support:{purpose:'回復・魔法部隊を後方に守る',movement:'後衛中心・護衛追従'},
 wall:{purpose:'盾役が先頭で突破を防ぐ',movement:'防御線維持・低速進軍'},
 spear:{purpose:'前列を揃えて敵の突進を迎撃',movement:'縦列を保ち槍衾を形成'},
 arrow:{purpose:'射撃部隊を中核に挟撃射線を確保',movement:'遠隔優先・側面展開'},
 highground:{purpose:'遠隔・召喚役が高所を確保し、盾役が敵を建物付近に誘導',movement:'高所確保→誘導→足止め→集中攻撃・召喚。高所が無ければ地上で連携'},
 wedge:{purpose:'先頭の攻撃力を集中して敵陣を突破',movement:'楔形で中央突破'},
 pincer:{purpose:'左右の遊撃部隊で敵を包み込む',movement:'両翼展開・側面包囲'},
 circle:{purpose:'全方向から味方の中心を守る',movement:'防衛円環を維持'},
 ambush:{purpose:'発見を避け機動力で背後に回る',movement:'分散接近・奇襲'},
 cross:{purpose:'中心を守りつつ四方向に対処',movement:'十字隊列を維持'},
 fortress:{purpose:'盾役を重ねて前線の損耗を防ぐ',movement:'密集防御・緩慢前進'},
 dragon:{purpose:'先鋒と翼の攻撃を連携して敵を崩す',movement:'先鋒突破・両翼追撃'},
 constellation:{purpose:'近接・回復・遠隔が一体で機能',movement:'全方向連携・距離維持'}
});
