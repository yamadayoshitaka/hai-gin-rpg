/** Additional battle tactics unlocked by the inn's actual saved formation.
 * Baseline orders stay available; an advanced order also needs a live capable job.
 * Changing formation never grants a job, item, or soldier that is not present.
 */
export const ADVANCED_FORMATION_TACTICS=Object.freeze({
 melee_split:'複数敵へ分進',
 ranged_split:'遠距離分散',
 block_advance:'前進を阻止',
 regroup:'後退し再集結',
 boost_speed:'機動力を強化',
 scout_summon:'召喚獣で先行偵察',
 cut_speed:'機動力低下',
 prevent_buff:'強化を阻止',
 destroy_path:'橋・門・建物を破壊'
});
const UNLOCKS=Object.freeze({
 free:[],
 balanced:[],
 attack:['melee_split'],
 support:['boost_speed'],
 wall:['block_advance'],
 spear:['block_advance','melee_split'],
 arrow:['ranged_split'],
 wedge:['melee_split'],
 pincer:['melee_split','ranged_split'],
 circle:['regroup','boost_speed'],
 ambush:['melee_split','cut_speed'],
 cross:['melee_split','block_advance','regroup'],
 fortress:['block_advance','regroup','prevent_buff'],
 dragon:['melee_split','ranged_split','boost_speed','cut_speed'],
 constellation:Object.keys(ADVANCED_FORMATION_TACTICS)
});
export function unlockedFormationTactics(id,active=true){
 return active?UNLOCKS[String(id||'balanced')]||[]:[];
}
export function formationAllowsTactic(id,tacticId,active=true){
 const tactic=String(tacticId||'');
 return !Object.hasOwn(ADVANCED_FORMATION_TACTICS,tactic)||
  unlockedFormationTactics(id,active).includes(tactic);
}
export function formationUnlockLabels(id,active=true){
 return unlockedFormationTactics(id,active).map(key=>ADVANCED_FORMATION_TACTICS[key]);
}
