import {M018_BATTLE_LENGTH_CELLS} from './m018-battle-size.js';

const BATTLE_LENGTH_CELLS=Object.freeze({
 m018:M018_BATTLE_LENGTH_CELLS,
 m020:14,
 m048:10,
});

export function monsterBattleLengthCells(speciesId){
 return Object.hasOwn(BATTLE_LENGTH_CELLS,speciesId)?BATTLE_LENGTH_CELLS[speciesId]:null;
}

/** Fit in rest pose so a turn or a strike never changes the model scale. */
export function monsterBattleLengthScale(bounds,cellSize,lengthCells){
 const length=bounds.max.z-bounds.min.z;
 return Number.isFinite(length)&&length>0?lengthCells*cellSize/length:1;
}
