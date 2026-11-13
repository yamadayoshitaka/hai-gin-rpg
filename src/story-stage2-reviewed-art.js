/**
 * Approved Chapter 1 Stage 2 extra illustrations, protected by a manual P0
 * registration gate. Intentionally empty until all 25 actual WebPs have
 * been reviewed against their own canonical shot and actor master bytes.
 */
export const REGISTERED_C01_S02_REVIEWED=Object.freeze({});
export function stage2ReviewedPanelAsset(shot){
 if(!shot||shot.stageId!=='c01-s02')return null;
 const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
 return REGISTERED_C01_S02_REVIEWED[key]||null;
}
