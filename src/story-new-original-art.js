/**
 * Single authority for NEW (post-2026-11-17) character event CGs, stage 5+.
 * Old archive branches, old provisional live rows, and reused screenshots
 * must NEVER be added here. Each entry requires its OWN new image bytes and
 * original generation provenance plus scene/gender/outcome QA before activation.
 */
export const NEW_STORY_ORIGINAL_ART=Object.freeze({});
export function newOriginalStoryPanelAsset(shot){
 if(!shot?.stageId||!shot?.comicEdition||!shot?.protagonistGender||!shot?.id)return null;
 const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
 const row=NEW_STORY_ORIGINAL_ART[key];
 if(!row||row.origin!=='NEW_SCENE_GENERATED_AFTER_2026_11_17'||
    row.stageId!==shot.stageId||row.comicEdition!==shot.comicEdition||
    row.protagonistGender!==shot.protagonistGender||row.sceneId!==shot.id||
    row.provenanceVerified!==true||row.nativeQAComplete!==true||
    typeof row.asset!=='string'||!row.asset.startsWith('./assets/story/new-originals/'))
  return null;
 return row.asset;
}
