/**
 * Reviewed, bounded quality stages. Only assets in this allowlist can advance.
 * Human characters, humanoid summons, undead, fiends, golems and the tengu
 * monster are excluded; another workflow owns the replacement human models.
 *
 * A stage is a geometric change, NOT proof of improved visual aesthetics.
 */
export const NONHUMAN_QUALITY_PROGRESS=Object.freeze({
  cycle:5,
  buildingDetails:1,
  beast:1,
  canineCoat:1,
  feline:1,
  avian:1,
  reptile:0,
  insect:0,
  arachnid:0,
  aquatic:0,
});

export const NONHUMAN_QUALITY_LIMITS=Object.freeze({
  buildingDetails:6,
  beast:8,
  canineCoat:6,
  feline:8,
  avian:8,
  reptile:8,
  insect:8,
  arachnid:8,
  aquatic:8,
});

export function nonhumanMonsterStage(spec){
  if(!spec || spec.id==='m015')return 0; // Tengu: humanoid anatomy
  return NONHUMAN_QUALITY_PROGRESS[spec.family]??0;
}
export function buildingDetailStage(){
  return NONHUMAN_QUALITY_PROGRESS.buildingDetails;
}
export function canineCoatStage(){
  return NONHUMAN_QUALITY_PROGRESS.canineCoat;
}
