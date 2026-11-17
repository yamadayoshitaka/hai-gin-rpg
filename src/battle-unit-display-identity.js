/** Display identity only: a monster may reuse a combat job for AI internally,
 * but no human profession should leak into its name, roster or zoom panel. */
export function battleUnitDisplayName(unit,{fallback='兵士'}={}){
 if(!unit)return fallback;
 const species=unit.monsterSpec?.name||unit.monsterName||
  (unit.isMonster&&unit.speciesName)||null;
 if(species)return String(species);
 return String(unit.displayName||unit.job?.name||unit.jobName||
  (fallback!=='兵士'?fallback:unit.jobId)||fallback);
}
export function battleUnitDisplayClass(unit){
 return unit?.monsterSpec||unit?.monsterName||unit?.isMonster?'monster':'human';
}
