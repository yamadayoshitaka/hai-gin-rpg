// Use rest-pose nose-to-tail length. A turn or an attack must not resize the actor.
export const M018_BATTLE_LENGTH_CELLS=4;

export function m018BattleScale(bounds,cellSize){
 const length=bounds.max.z-bounds.min.z;
 return Number.isFinite(length)&&length>0?M018_BATTLE_LENGTH_CELLS*cellSize/length:1;
}
