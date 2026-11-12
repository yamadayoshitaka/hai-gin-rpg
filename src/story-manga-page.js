/**
 * A canonical manga PAGE is one authored 2x5 sheet, not ten independent
 * splash illustrations. Display no substitute if the approved sheet is absent.
 * One stage has 4 separate pages (pre/post x male/female).
 */
export const STORY_PAGE_LAYOUT=Object.freeze({
 columns:2,rows:5,panels:10,cellWidth:768,cellHeight:432,
 width:1536,height:2160
});
export function storyPageAsset(stageId,phase,gender){
 if(!/^c(?:0[1-9]|1[0-9]|20)-s(?:0[1-9]|10)$/.test(String(stageId||'')))
  throw Error('Invalid manga stage ID: '+stageId);
 if(phase!=='pre'&&phase!=='post')throw Error('Invalid manga phase: '+phase);
 // Unknown protagonist sex is NOT a license to show male art.
 if(gender!=='male'&&gender!=='female')return null;
 return './assets/story/pages/'+stageId+'-'+phase+'-'+gender+'.webp';
}
export function storyPagePanels(story,phase){
 if(phase!=='pre'&&phase!=='post')throw Error('Invalid manga phase: '+phase);
 const frames=story.panels.filter(panel=>panel.phase===phase);
 if(frames.length!==STORY_PAGE_LAYOUT.panels||new Set(frames.map(p=>p.id)).size!==10)
  throw Error('A manga page requires ten distinct scenes: '+story.id+' '+phase);
 return frames;
}
export function storyPagePosition(index){
 if(!Number.isInteger(index)||index<0||index>=10)throw Error('Manga panel outside 2x5 page');
 return {row:Math.floor(index/2)+1,column:index%2+1};
}
