/**
 * Authored manga-beat selection. Scene IDs remain stable for narration/voice,
 * but there is NO minimum number of scenes per phase or per stage.
 *
 * Empty/missing overrides use all canonical beats until a chapter is curated.
 * An editor can select, remove or reorder beats by their stable IDs without
 * changing legacy saves, recorded lines or the combat pipeline.
 */
export const STORY_COMIC_SCENE_SELECTION=Object.freeze({
 'c01-s01':Object.freeze({
  // The royal-capital introduction needs character meetings, the missing
  // memorial ledger, the suspect seal, and the start of the town inquiry.
  pre:Object.freeze([1,2,3,4,5,11,12,14,15]),
  // Town aftermath is not a second enemy invasion or a forced battle.
  post:Object.freeze([6,7,8,9,16,19,10])
 })
});
export function selectComicBasePanels(story,phase){
 if(phase!=='pre'&&phase!=='post')throw Error('Invalid comic phase');
 const candidates=story.panels.filter(p=>p.phase===phase);
 const ids=STORY_COMIC_SCENE_SELECTION[story.id]?.[phase];
 if(ids===undefined)return candidates;
 if(!Array.isArray(ids)||ids.length<1||new Set(ids).size!==ids.length)
  throw Error('Invalid authored manga scene selection for '+story.id+' '+phase);
 const lookup=new Map(candidates.map(p=>[Number(p.id.match(/-m(\d+)$/)?.[1]),p]));
 const selected=ids.map(n=>lookup.get(n));
 if(selected.some(x=>!x))throw Error('Missing referenced scene in '+story.id+' '+phase);
 return selected;
}
