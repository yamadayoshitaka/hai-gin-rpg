/** Timeline for a zero-tap building cutaway preview.
 * The floor count, stair footprint and elevations come from the same
 * building-structure BOM as the in-game staircase. No hard-coded floors.
 */
export function buildingPreviewPhase(structure,seconds,{phaseSeconds=6}={}){
 const count=structure?.floors?.length??0;
 if(!count||!Number.isFinite(seconds))return null;
 const step=Math.floor(Math.max(0,seconds)/phaseSeconds)%(count+1);
 return {mode:step===0?'exterior':'interior',floor:step,phaseCount:count+1};
}

export function buildingPreviewCamera(structure,floor){
 if(!Number.isInteger(floor)||floor<1||floor>structure?.floors?.length)
  throw new RangeError('Preview floor does not exist');
 const staircase=structure?.stair?.stair;
 if(!staircase)throw new Error('Building preview needs a stair BOM');
 const deck=structure.floors[floor-1];
 const distance=Math.max(16,staircase.outerRadius*5.5);
 return {
  target:{x:staircase.x,y:deck.baseY+deck.height*.28,z:staircase.z},
  offset:{x:distance*.78,y:distance*.92,z:distance*.87},
  floor
 };
}
