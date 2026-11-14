/**
 * Visibly provisional live chapter-1 artwork. Entries are real, SHA-verified WebPs
 * (NOT P0 or human-approved). Removable per canonical shot for rollback.
 * Never modify approved human-reviewed registries from this file.
 */
export const CHAPTER1_PROVISIONAL_LIVE=Object.freeze({});
export function chapter1ProvisionalLivePanel(shot){
 if(!shot?.stageId||!shot?.comicEdition||!shot?.protagonistGender||!shot?.id)return null;
 const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
 return CHAPTER1_PROVISIONAL_LIVE[key]||null;
}
