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
 const allowed=REGISTERED[shot.stageId+'|'+shot.comicEdition+'|'+shot.protagonistGender];
 const id=/^c\d{2}-s\d{2}-m(\d{1,2})$/.exec(shot.id);
 if(!allowed||!id||!allowed.includes(Number(id[1])))return null;
 return './assets/story/chapters/'+shot.stageId.slice(0,3)+'/panels/'+shot.id+'-'+shot.protagonistGender+'.webp';
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
