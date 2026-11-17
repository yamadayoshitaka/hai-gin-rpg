import {stage2ReviewedPanelAsset} from './story-stage2-reviewed-art.js';
import {chapterReviewedPanelAsset} from './story-chapter-reviewed-art.js';
import {chapter1ProvisionalLivePanel} from './story-chapter1-provisional-live.js';
import {provisionalRegisteredStoryPanel} from './story-provisional-registered-art.js';
import {restoredStoryArchivePanel} from './story-archive-restored-art.js';
import {oldStoryArtReuseAllowed,requiresNewStoryArt} from './story-art-sourcing-policy.js';
import {newOriginalStoryPanelAsset} from './story-new-original-art.js';
/**
 * Exactly registered and already sliced Chapter 1 manga panels.
 * A registered original is NOT an approved/quality-reviewed image.
 * Do not borrow images from different genders or battle outcomes.
 */
const REGISTERED=Object.freeze({
 'c01-s01|pre|male':Object.freeze([1,2,3,4,5,11,12,13,14,15]),
 'c01-s01|pre|female':Object.freeze([1,2,3,4,5,11,12,13,14,15]),
 'c01-s01|post-town|male':Object.freeze([6,7,8,9,10]),
 'c01-s01|post-town|female':Object.freeze([6,7,8,9,10]),
 'c01-s02|pre|male':Object.freeze([1,2,3,4,5,11,13,15]),
 'c01-s02|post-victory|male':Object.freeze([6,7,8,9,16,19,10])
});
export function registeredStoryPanelAsset(shot){
 if(!shot||typeof shot.id!=='string')return null;
 // Stage 5+ must use an independently generated NEW original, never an old
 // provisional, archive recovery, legacy sheet or prior-generation WebP.
 if(requiresNewStoryArt(shot.stageId))return newOriginalStoryPanelAsset(shot);
 if(!oldStoryArtReuseAllowed(shot.stageId))return null;
 const chapterReviewed=chapterReviewedPanelAsset(shot);
 if(chapterReviewed)return chapterReviewed;
 const reviewedStage2=stage2ReviewedPanelAsset(shot);
 if(reviewedStage2)return reviewedStage2;
 // Staged live art takes precedence over old legacy sheets but never over
 // per-image human-reviewed final artwork. Removing entry restores old source.
 const draftLive=chapter1ProvisionalLivePanel(shot);
 if(draftLive)return draftLive.asset;
 // Exact archived originals are playable as provisional scene assets; never
 // supersede the existing owner-reviewed/provisional copy.
 const restored=restoredStoryArchivePanel(shot);
 if(restored)return restored.asset;
 const provisional=provisionalRegisteredStoryPanel(shot);
 if(provisional)return provisional.asset;
 const allowed=REGISTERED[shot.stageId+'|'+shot.comicEdition+'|'+shot.protagonistGender];
 const id=/^c\d{2}-s\d{2}-m(\d{1,2})$/.exec(shot.id);
 if(!allowed||!id||!allowed.includes(Number(id[1])))return null;
 // Scene IDs use m1..m9, but the on-disk WebP files use m01..m09.
 // Normalize only the asset filename; keep the original scene/voice ID stable.
 const assetId=shot.stageId+'-m'+String(Number(id[1])).padStart(2,'0');
 return './assets/story/chapters/'+shot.stageId.slice(0,3)+'/panels/'+assetId+'-'+shot.protagonistGender+'.webp';
}
/** Geometry for a 2-column composite; only the selected 16:9 cell is visible. */
export function storySheetCrop(shot,pageCellCount){
 const count=Number(pageCellCount),cell=Number(shot?.comicCell);
 if(!Number.isInteger(count)||count<1||count>10||!Number.isInteger(cell)||cell<0||cell>=count)
  throw Error('Invalid manga cell '+String(cell)+'/'+String(count));
 const rows=Math.ceil(count/2);
 return Object.freeze({rows,column:cell%2,row:Math.floor(cell/2),
  widthPercent:200,heightPercent:rows*100,
  leftPercent:-(cell%2)*100,topPercent:-Math.floor(cell/2)*100});
}

/**
 * Source-of-truth for the public manga UI and the actual RPG.
 * The Pages publishing step replaces the SHA placeholder in its output ONLY.
 * The git source keeps local asset URLs for source tests and local development.
 *
 * Large provisional WebPs are deliberately not bundled into the 83+ MiB Pages
 * archive. Use the EXACT Pages release commit's verified GitHub raw art instead
 * of depending on an asynchronous service worker and falling back to old art.
 */
export const STORY_PAGES_COMMIT='__HAI_GIN_STORY_RELEASE_SHA__';
export function isPublishedStoryRevision(){
 return /^[a-f0-9]{40}$/.test(STORY_PAGES_COMMIT);
}
export function storyArtDisplayUrl(url){
 if(typeof url!=='string'||!url)return url;
 if(isPublishedStoryRevision()){
  if(url.startsWith('./assets/story/chapter1-provisional-live/'))
   return 'https://raw.githubusercontent.com/yamadayoshitaka/hai-gin-rpg/'+
    STORY_PAGES_COMMIT+'/'+url.slice(2);
  // Existing stage sheets are published inside Pages: pin their cache identity.
  if(url.startsWith('./assets/story/'))
   return url+(url.includes('?')?'&':'?')+'release='+STORY_PAGES_COMMIT.slice(0,12);
 }
 if(url.includes('/assets/story/chapter-drafts/c01/mobile-5x5-20261113/'))
  return url+(url.includes('?')?'&':'?')+'artrev=c01s02female20261113';
 if(!/\/assets\/story\/chapters\/c01\/(?:panels\/)?c01-s01-/.test(url))return url;
 return url+(url.includes('?')?'&':'?')+'artrev=c01s01-20261113-hires';
}
