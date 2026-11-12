/**
 * Restrained fantasy-drama music direction for story and town.
 * Avoid using the bright Fairy Adventure / Fairy Battles tracks in
 * the introduction. The source recordings remain bundled CC0 assets.
 * A cue changes at a SCENE change, not on every comic page turn.
 */
export const FANTASY_SCORE_LIBRARY=Object.freeze([
 Object.freeze({id:'fairy-adventure',name:'妖精の旅路',url:'./assets/audio/battle/coast.ogg',mood:'light'}),
 Object.freeze({id:'fairy-battles',name:'森の精霊',url:'./assets/audio/battle/forest.ogg',mood:'light'}),
 Object.freeze({id:'whispers',name:'沈黙の星鐘',url:'./assets/audio/battle/ruins.ogg',mood:'mystery'}),
 Object.freeze({id:'heartfelt',name:'王国の宿命',url:'./assets/audio/battle/siege.ogg',mood:'orchestral'}),
 Object.freeze({id:'snow',name:'雪華の祈り',url:'./assets/audio/battle/snow.mp3',mood:'battle'}),
 Object.freeze({id:'desert',name:'砂海の試練',url:'./assets/audio/battle/desert.mp3',mood:'tension'}),
 Object.freeze({id:'battle',name:'決戦の誓い',url:'./assets/audio/battle/battle.ogg',mood:'battle'})
]);
// The early story is a solemn war drama, not a light arcade adventure.
export const FANTASY_SCORE_LOCATIONS=Object.freeze({
 title:'whispers',opening:'heartfelt',map:'whispers',
 town:'heartfelt',inn:'heartfelt',shop:'heartfelt',
 tavern:'heartfelt',church:'whispers',castle:'heartfelt',
 paper:'whispers',battle:'battle'
});
const lookup=Object.freeze(Object.fromEntries(FANTASY_SCORE_LIBRARY.map(t=>[t.id,t])));
export function fantasyCueForLocation(location='town'){
 return lookup[FANTASY_SCORE_LOCATIONS[location]||'whispers'];
}
export function fantasyCueForMangaPanel(stage,index=0){
 if(!stage?.id||!Number.isInteger(stage.number)||!Number.isInteger(index)||index<0)
  throw Error('Unknown manga music cue');
 // The story is displayed in two ten-panel acts. Change at narrative beats,
 // never on every page. The final event follows verified victory/retreat.
 const boss=stage.kind==='boss';
 const orchestral=(index>=4&&index<=5)||(index>=8&&index<=11)||
   index===15||index>=18;
 const id=orchestral?(boss?'battle':'heartfelt'):'whispers';
 return {...lookup[id],stageId:stage.id,panel:index,scene:stage.kind};
}
export function fantasyCueForChapterScene(chapter=1,index=0){
 const c=Math.max(1,Math.min(20,Math.floor(Number(chapter)||1)));
 const id=index>=4?'heartfelt':'whispers';
 return {...lookup[id],chapter:c,sceneIndex:index};
}
export function fantasyTrackUrl(location){return fantasyCueForLocation(location).url;}
