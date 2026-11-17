/**
 * Single authority for NEW (post-2026-11-17) character event CGs, stage 5+.
 * Old archive branches, old provisional live rows, and reused screenshots
 * must NEVER be added here. Each entry requires its OWN new image bytes and
 * original generation provenance plus scene/gender/outcome QA before activation.
 */
export const NEW_STORY_ORIGINAL_ART=Object.freeze({
  "c01-s05|pre|male|c01-s05-m1": {
    "origin": "NEW_SCENE_GENERATED_AFTER_2026_11_17",
    "stageId": "c01-s05",
    "comicEdition": "pre",
    "protagonistGender": "male",
    "sceneId": "c01-s05-m1",
    "asset": "./assets/story/new-originals/c01-s05__pre__male__c01-s05-m1.webp",
    "sha256": "57cb6bf166acbc620403ea272659845f1afdebcdbedc1c71bbe597e9fd2895c7",
    "provenance": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-pre-male/p01/c01-s05-m01-pre-male.webp.generation.json",
    "sourceDraft": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-pre-male/p01/c01-s05-m01-pre-male.webp",
    "provenanceVerified": true,
    "nativeQAComplete": true,
    "visualP0Approved": false,
    "status": "PROVISIONAL_NATIVE_AND_SOURCE_QA_PENDING_VISUAL_P0"
  },
  "c01-s05|pre|male|c01-s05-m15": {
    "origin": "NEW_SCENE_GENERATED_AFTER_2026_11_17",
    "stageId": "c01-s05",
    "comicEdition": "pre",
    "protagonistGender": "male",
    "sceneId": "c01-s05-m15",
    "asset": "./assets/story/new-originals/c01-s05__pre__male__c01-s05-m15.webp",
    "sha256": "83df01b2a4ebfddea418fd00bec95ac9fc0d7ac11d53106b7bd89dfa5f219016",
    "provenance": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-pre-male/p02/c01-s05-m15-pre-male.webp.generation.json",
    "sourceDraft": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-pre-male/p02/c01-s05-m15-pre-male.webp",
    "provenanceVerified": true,
    "nativeQAComplete": true,
    "visualP0Approved": false,
    "status": "PROVISIONAL_NATIVE_AND_SOURCE_QA_PENDING_VISUAL_P0"
  },
  "c01-s05|post-victory|male|c01-s05-m6": {
    "origin": "NEW_SCENE_GENERATED_AFTER_2026_11_17",
    "stageId": "c01-s05",
    "comicEdition": "post-victory",
    "protagonistGender": "male",
    "sceneId": "c01-s05-m6",
    "asset": "./assets/story/new-originals/c01-s05__post-victory__male__c01-s05-m6.webp",
    "sha256": "91f0667d5c1c40c83e8744a51ccebc09536d93663720ca4e08c97d59e67bb4e9",
    "provenance": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-post-victory-male/p01/c01-s05-m06-post-victory-male.webp.generation.json",
    "sourceDraft": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-post-victory-male/p01/c01-s05-m06-post-victory-male.webp",
    "provenanceVerified": true,
    "nativeQAComplete": true,
    "visualP0Approved": false,
    "status": "PROVISIONAL_NATIVE_AND_SOURCE_QA_PENDING_VISUAL_P0"
  },
  "c01-s05|post-victory|male|c01-s05-m10": {
    "origin": "NEW_SCENE_GENERATED_AFTER_2026_11_17",
    "stageId": "c01-s05",
    "comicEdition": "post-victory",
    "protagonistGender": "male",
    "sceneId": "c01-s05-m10",
    "asset": "./assets/story/new-originals/c01-s05__post-victory__male__c01-s05-m10.webp",
    "sha256": "72af149206b590e2040aa062245c2698049593f285380834ad6a3e57029176d6",
    "provenance": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-post-victory-male/p02/c01-s05-m10-post-victory-male.webp.generation.json",
    "sourceDraft": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-post-victory-male/p02/c01-s05-m10-post-victory-male.webp",
    "provenanceVerified": true,
    "nativeQAComplete": true,
    "visualP0Approved": false,
    "status": "PROVISIONAL_NATIVE_AND_SOURCE_QA_PENDING_VISUAL_P0"
  },
  "c01-s05|post-victory|female|c01-s05-m6": {
    "origin": "NEW_SCENE_GENERATED_AFTER_2026_11_17",
    "stageId": "c01-s05",
    "comicEdition": "post-victory",
    "protagonistGender": "female",
    "sceneId": "c01-s05-m6",
    "asset": "./assets/story/new-originals/c01-s05__post-victory__female__c01-s05-m6.webp",
    "sha256": "14a5afef7dff3574d636bd6632679e07d1d5d2738dd4b12ff4ed9dd77ba02190",
    "provenance": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-post-victory-female/p01/c01-s05-m06-post-victory-female.webp.generation.json",
    "sourceDraft": "assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s05-post-victory-female/p01/c01-s05-m06-post-victory-female.webp",
    "provenanceVerified": true,
    "nativeQAComplete": true,
    "visualP0Approved": false,
    "status": "PROVISIONAL_NATIVE_AND_SOURCE_QA_PENDING_VISUAL_P0"
  }
});
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
