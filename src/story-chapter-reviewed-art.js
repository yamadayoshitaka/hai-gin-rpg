/**
 * Registered, human-reviewed, canonical one-panel images across story chapters.
 * This table can ONLY be changed by the page transaction after real WebP +
 * human review proofs have passed; do not add drafts or placeholders.
 */
export const REGISTERED_CHAPTER_REVIEWED=Object.freeze({});
export function chapterReviewedPanelAsset(shot){
 if(!shot?.stageId||!shot?.comicEdition||!shot?.protagonistGender||!shot?.id)return null;
 const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
 return REGISTERED_CHAPTER_REVIEWED[key]||null;
}
