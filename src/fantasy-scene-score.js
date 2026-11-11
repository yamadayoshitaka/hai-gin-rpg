/**
 * Contextual fantasy score. All files are locally bundled, commercial-use CC0
 * fantasy orchestration (Fairy Adventure, Fairy Battles, Heartfelt Battle,
 * Whispers in the Fog and region themes), documented in
 * assets/audio/battle/STAGE_LICENSES.md and LICENSES.md.
 *
 * Every adjacent manga panel receives a DIFFERENT track. This is deliberate:
 * exposition, confrontation, discovery and resolution have separate cues.
 */
export const FANTASY_SCORE_LIBRARY=Object.freeze([
 Object.freeze({id:'fairy-adventure',name:'妖精の旅路',url:'./assets/audio/battle/coast.ogg',mood:'journey'}),
 Object.freeze({id:'fairy-battles',name:'森の精霊',url:'./assets/audio/battle/forest.ogg',mood:'wonder'}),
 Object.freeze({id:'whispers',name:'星鐘の囁き',url:'./assets/audio/battle/ruins.ogg',mood:'mystery'}),
 Object.freeze({id:'heartfelt',name:'王国の宿命',url:'./assets/audio/battle/siege.ogg',mood:'dramatic'}),
 Object.freeze({id:'snow',name:'雪華の祈り',url:'./assets/audio/battle/snow.mp3',mood:'sorrow'}),
 Object.freeze({id:'desert',name:'砂海の試練',url:'./assets/audio/battle/desert.mp3',mood:'tension'}),
 Object.freeze({id:'battle',name:'決戦の誓い',url:'./assets/audio/battle/battle.ogg',mood:'battle'})
]);
export const FANTASY_SCORE_LOCATIONS=Object.freeze({
 title:'fairy-adventure',opening:'heartfelt',map:'fairy-adventure',
 town:'fairy-battles',inn:'fairy-adventure',shop:'fairy-adventure',
 tavern:'desert',church:'whispers',castle:'heartfelt',
 paper:'whispers',battle:'battle'
});
const lookup=Object.freeze(Object.fromEntries(FANTASY_SCORE_LIBRARY.map(t=>[t.id,t])));
export function fantasyCueForLocation(location='town'){
 return lookup[FANTASY_SCORE_LOCATIONS[location]||'fairy-adventure'];
}
export function fantasyCueForMangaPanel(stage,index=0){
 if(!stage?.id||!Number.isInteger(stage.number)||index<0)throw Error('Unknown manga music cue');
 const n=(stage.number*3+index)%FANTASY_SCORE_LIBRARY.length;
 const score=FANTASY_SCORE_LIBRARY[n];
 return {...score,stageId:stage.id,panel:index,scene:stage.kind};
}
export function fantasyCueForChapterScene(chapter=1,index=0){
 const c=Math.max(1,Math.min(20,Math.floor(Number(chapter)||1)));
 return FANTASY_SCORE_LIBRARY[(c*2+Math.floor(index))%FANTASY_SCORE_LIBRARY.length];
}
export function fantasyTrackUrl(location){return fantasyCueForLocation(location).url;}
