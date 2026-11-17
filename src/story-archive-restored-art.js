/**
 * Owner-authorized restoration of archived free image generation results.
 * Every asset originates from the SAME repository and has an exact
 * stage/edition/gender/shot match. This is reversible playable PROVISIONAL
 * registration; it is NOT a fabricated P0 visual approval.
 *
 * Additions must pass qa/story-archive-restoration.test.mjs and retain
 * generation proof alongside their true binary WebP.
 */
export const RESTORED_STORY_ARCHIVE=Object.freeze({
  "c01-s05|pre|male|c01-s05-m1": {
    "asset": "./assets/story/chapter1-provisional-live/c01-s05__pre__male__c01-s05-m1.webp",
    "proof": "./assets/story/chapter1-provisional-live/c01-s05__pre__male__c01-s05-m1.webp.generation.json",
    "sha256": "57cb6bf166acbc620403ea272659845f1afdebcdbedc1c71bbe597e9fd2895c7",
    "gitBlobSha": "513621049eda10159e1480e560217c0f6f29cd80",
    "sourceBranch": "story/chapter1-free-actual-art",
    "nativePixels": [
      1024,
      576
    ],
    "visibleActorIds": [],
    "reviewStatus": "PROVISIONAL_ARCHIVE_RESTORED_NOT_P0",
    "visualIdentityApproved": false,
    "stageId": "c01-s05",
    "edition": "pre",
    "gender": "male",
    "panelId": "c01-s05-m1"
  },
  "c01-s05|pre|male|c01-s05-m15": {
    "asset": "./assets/story/chapter1-provisional-live/c01-s05__pre__male__c01-s05-m15.webp",
    "proof": "./assets/story/chapter1-provisional-live/c01-s05__pre__male__c01-s05-m15.webp.generation.json",
    "sha256": "83df01b2a4ebfddea418fd00bec95ac9fc0d7ac11d53106b7bd89dfa5f219016",
    "gitBlobSha": "701bb3ea7fe3ed771841411459f449065efde76c",
    "sourceBranch": "story/chapter1-free-actual-art",
    "nativePixels": [
      1024,
      576
    ],
    "visibleActorIds": [
      "garan",
      "iris"
    ],
    "reviewStatus": "PROVISIONAL_ARCHIVE_RESTORED_NOT_P0",
    "visualIdentityApproved": false,
    "stageId": "c01-s05",
    "edition": "pre",
    "gender": "male",
    "panelId": "c01-s05-m15"
  },
  "c01-s05|post-victory|male|c01-s05-m6": {
    "asset": "./assets/story/chapter1-provisional-live/c01-s05__post-victory__male__c01-s05-m6.webp",
    "proof": "./assets/story/chapter1-provisional-live/c01-s05__post-victory__male__c01-s05-m6.webp.generation.json",
    "sha256": "91f0667d5c1c40c83e8744a51ccebc09536d93663720ca4e08c97d59e67bb4e9",
    "gitBlobSha": "ad2cf43d4f662fc96ba07775489fcf3acc72b090",
    "sourceBranch": "story/chapter1-free-actual-art",
    "nativePixels": [
      1024,
      576
    ],
    "visibleActorIds": [],
    "reviewStatus": "PROVISIONAL_ARCHIVE_RESTORED_NOT_P0",
    "visualIdentityApproved": false,
    "stageId": "c01-s05",
    "edition": "post-victory",
    "gender": "male",
    "panelId": "c01-s05-m6"
  },
  "c01-s05|post-victory|male|c01-s05-m10": {
    "asset": "./assets/story/chapter1-provisional-live/c01-s05__post-victory__male__c01-s05-m10.webp",
    "proof": "./assets/story/chapter1-provisional-live/c01-s05__post-victory__male__c01-s05-m10.webp.generation.json",
    "sha256": "72af149206b590e2040aa062245c2698049593f285380834ad6a3e57029176d6",
    "gitBlobSha": "cc49923b558de08fee26baa76c33d77c0e2b47db",
    "sourceBranch": "story/chapter1-free-actual-art",
    "nativePixels": [
      1024,
      576
    ],
    "visibleActorIds": [
      "vess",
      "garan"
    ],
    "reviewStatus": "PROVISIONAL_ARCHIVE_RESTORED_NOT_P0",
    "visualIdentityApproved": false,
    "stageId": "c01-s05",
    "edition": "post-victory",
    "gender": "male",
    "panelId": "c01-s05-m10"
  },
  "c01-s05|post-victory|female|c01-s05-m6": {
    "asset": "./assets/story/chapter1-provisional-live/c01-s05__post-victory__female__c01-s05-m6.webp",
    "proof": "./assets/story/chapter1-provisional-live/c01-s05__post-victory__female__c01-s05-m6.webp.generation.json",
    "sha256": "14a5afef7dff3574d636bd6632679e07d1d5d2738dd4b12ff4ed9dd77ba02190",
    "gitBlobSha": "02c4e33aab3a6831c0bef26d65c21cede2db6b5c",
    "sourceBranch": "story/chapter1-free-actual-art",
    "nativePixels": [
      1024,
      576
    ],
    "visibleActorIds": [],
    "reviewStatus": "PROVISIONAL_ARCHIVE_RESTORED_NOT_P0",
    "visualIdentityApproved": false,
    "stageId": "c01-s05",
    "edition": "post-victory",
    "gender": "female",
    "panelId": "c01-s05-m6"
  }
});
export const RESTORED_STORY_ARCHIVE_COUNT=Object.keys(RESTORED_STORY_ARCHIVE).length;
export function restoredStoryArchivePanel(shot){
 if(!shot?.stageId||!shot?.comicEdition||!shot?.protagonistGender||!shot?.id)return null;
 const key=[shot.stageId,shot.comicEdition,shot.protagonistGender,shot.id].join('|');
 return RESTORED_STORY_ARCHIVE[key]||null;
}
