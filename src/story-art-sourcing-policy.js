/**
 * Story artwork sourcing contract (owner decision, 2026-11-17).
 *
 * ONLY chapter 1, stages 1-4 may reuse old manga/draft/sheet originals.
 * Chapter 1 stage 5 onward (and chapters 2-20) require NEW, shot-specific
 * illustrations. A historical matching image is NOT a substitute.
 *
 * Shared generic defeat art is a separate global outcome contract.
 */
export const STORY_OLD_ART_REUSE_LAST_STAGE='c01-s04';
export const STORY_NEW_ART_FIRST_STAGE='c01-s05';
export const STORY_NEW_ART_START_DATE='2026-11-17';
export function oldStoryArtReuseAllowed(stageId){
 return /^c01-s0[1-4]$/.test(String(stageId||''));
}
export function requiresNewStoryArt(stageId){
 if(!/^c(?:0[1-9]|1[0-9]|20)-s(?:0[1-9]|10)$/.test(String(stageId||'')))
  return false;
 return !oldStoryArtReuseAllowed(stageId);
}
