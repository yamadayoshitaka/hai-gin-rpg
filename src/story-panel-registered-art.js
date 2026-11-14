import {stage2ReviewedPanelAsset} from './story-stage2-reviewed-art.js';
import {chapterReviewedPanelAsset} from './story-chapter-reviewed-art.js';
import {chapter1ProvisionalLivePanel} from './story-chapter1-provisional-live.js';
import {provisionalRegisteredStoryPanel} from './story-provisional-registered-art.js';
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
 const chapterReviewed=chapterReviewedPanelAsset(shot);
 if(chapterReviewed)return chapterReviewed;
 const reviewedStage2=stage2ReviewedPanelAsset(shot);
 if(reviewedStage2)return reviewedStage2;
 // Staged live art takes precedence over old legacy sheets but never over
 // per-image human-reviewed final artwork. Removing entry restores old source.
 const draftLive=chapter1ProvisionalLivePanel(shot);
 if(draftLive)return draftLive.asset;
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

/** Version specific C01-S01 artwork URLs keep mobile browsers from showing older cached image bytes. */
export function storyArtDisplayUrl(url){
 if(typeof url!=='string'||!url)return url;
 if(url.includes('/assets/story/chapter-drafts/c01/mobile-5x5-20261113/'))
  return url+(url.includes('?')?'&':'?')+'artrev=c01s02female20261113';
 if(!/\/assets\/story\/chapters\/c01\/(?:panels\/)?c01-s01-/.test(url))return url;
 return url+(url.includes('?')?'&':'?')+'artrev=c01s01-20261113-hires';
}
