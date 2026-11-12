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
  pre:Object.freeze([1,2,3,4,5,11,12,13,14,15]),
  // Town aftermath is not a second enemy invasion or a forced battle.
  post:Object.freeze([6,7,8,9,10])
 }),
 'c02-s05':Object.freeze({
  // Compact base story: eight pre/seven post beats, with one additional
  // authored choice scene when the player selects a branch.
  pre:Object.freeze([1,2,3,4,5,11,13,15]),
  post:Object.freeze([6,7,8,9,16,19,10])
 }),
 'c03-s05':Object.freeze({
  // The alternate decision adds one panel. Keep the entire edition on ONE
  // 2x5 sheet: nine essential beats + one branch-specific beat.
  pre:Object.freeze([1,2,3,4,5,11,13,15]),
  post:Object.freeze([6,7,8,9,16,19,10])
 }),
 'c04-s05':Object.freeze({
  // The alternate decision adds one panel. Keep the entire edition on ONE
  // 2x5 sheet: nine essential beats + one branch-specific beat.
  pre:Object.freeze([1,2,3,4,5,11,13,15]),
  post:Object.freeze([6,7,8,9,16,19,10])
 }),
 'c05-s05':Object.freeze({
  // The alternate decision adds one panel. Keep the entire edition on ONE
  // 2x5 sheet: nine essential beats + one branch-specific beat.
  pre:Object.freeze([1,2,3,4,5,11,13,15]),
  post:Object.freeze([6,7,8,9,16,19,10])
 })
});

// Chapter 1's story can be illustrated in 150 original panels:
// first town = 10 introduction + 5 town aftermath;
// each of the following nine stages = 8 pre + 7 verified outcome.
// This ONLY changes comic pacing. Victory, defeat and commander death
// still have distinct post-event editions and must NOT reuse one another's art.
const FIVE_CHAPTER_150_SCENE_SELECTION=Object.freeze(
 Object.fromEntries(Array.from({length:50},(_,i)=>{
  const chapter=Math.floor(i/10)+1,slot=i%10+1;
  const id='c'+String(chapter).padStart(2,'0')+'-s'+String(slot).padStart(2,'0');
  return [id,Object.freeze(slot===1?{
   pre:Object.freeze([1,2,3,4,5,11,12,13,14,15]),
   post:Object.freeze([6,7,8,9,10])
  }:{
   pre:Object.freeze([1,2,3,4,5,11,13,15]),
   post:Object.freeze([6,7,8,9,16,19,10])
  })];
 }))
);

export function selectComicBasePanels(story,phase){
 if(phase!=='pre'&&phase!=='post')throw Error('Invalid comic phase');
 const candidates=story.panels.filter(p=>p.phase===phase);
 const ids=(STORY_COMIC_SCENE_SELECTION[story.id]||FIVE_CHAPTER_150_SCENE_SELECTION[story.id])?.[phase];
 if(ids===undefined)return candidates;
 if(!Array.isArray(ids)||ids.length<1||new Set(ids).size!==ids.length)
  throw Error('Invalid authored manga scene selection for '+story.id+' '+phase);
 const lookup=new Map(candidates.map(p=>[Number(p.id.match(/-m(\d+)$/)?.[1]),p]));
 const selected=ids.map(n=>lookup.get(n));
 if(selected.some(x=>!x))throw Error('Missing referenced scene in '+story.id+' '+phase);
 return selected;
}
