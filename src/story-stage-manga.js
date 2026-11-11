/**
 * Continuous character-based manga storyboard for ALL 200 campaign stages.
 * Existing chapter dialogue/character identities remain the canonical source.
 * Panels are immutable, deterministic save-compatible and reference their
 * immediate predecessor/successor. No combat or town model dependencies.
 */
import {STORY_CHAPTERS} from './story-chapters.js';
import {CAMPAIGN_STAGE_BY_ID,CAMPAIGN_STAGES,nextCampaignStage} from './campaign-stage-plan.js';
import {narrativeForStage} from './chapter-story-events.js';
import {STORY_KEY_PEOPLE,STORY_KEY_PERSON_BY_NAME,cinematicScenesForChapter} from './story-cinematic.js';
const byId=Object.freeze(Object.fromEntries(STORY_KEY_PEOPLE.map(character=>[character.id,character])));
const hero=(characterId)=>characterId?byId[characterId]||null:null;
const sceneryByKind=Object.freeze({
 town:'royal-town',explore:'wilds',capture:'frontier',defend:'refuge',
 siege:'fortress',boss:'starbell'
});
const expressions=['resolute','anxious','determined','thoughtful','angry','hopeful','sorrowful'];
export const MANGA_PANELS_PER_STAGE=7;
export const MANGA_STAGE_COUNT=CAMPAIGN_STAGES.length;
export const MANGA_TOTAL_PANELS=MANGA_PANELS_PER_STAGE*MANGA_STAGE_COUNT;
export const mangaCast=STORY_KEY_PEOPLE;
function panel(stage,index,{character=null,second=null,text='',type='dialogue',voice=true,expression=null}={}){
 return Object.freeze({
  id:stage.id+'-m'+(index+1),stageId:stage.id,chapter:stage.chapter,
  slot:stage.slot,index,number:stage.number,
  kind:type,characterId:character?.id||null,secondaryId:second?.id||null,
  speaker:character?.name||'語り手',role:character?.role||'物語',
  faction:character?.faction||'星鐘',text:String(text).trim(),
  expression:expression||expressions[(stage.number+index)%expressions.length],
  scenery:sceneryByKind[stage.kind]||'wilds',mood:
   index===0?'overture':index===3?'mystery':index===4?'conflict':
   index===5?'resolve':index===6?'transition':'dialogue',
  hasVoice:voice,artSeed:stage.number*23+index*19
 });
}
export function mangaForStage(idOrStage='c01-s01'){
 const stage=typeof idOrStage==='string'?CAMPAIGN_STAGE_BY_ID[idOrStage]:idOrStage;
 if(!stage||!CAMPAIGN_STAGE_BY_ID[stage.id])throw Error('Unknown manga stage: '+String(idOrStage));
 const chapter=STORY_CHAPTERS[stage.chapter-1],narrative=narrativeForStage(stage);
 const chapterScenes=cinematicScenesForChapter(stage.chapter).filter(s=>s.characterId);
 const chapterCharacters=chapter.dialogues.map(l=>STORY_KEY_PERSON_BY_NAME.get(l.speaker)).filter(Boolean);
 const confrontation=chapterScenes.filter(s=>s.type==='confrontation');
 const c1=chapterCharacters[(stage.slot-1)%chapterCharacters.length]||STORY_KEY_PEOPLE[0];
 const c2=chapterCharacters[stage.slot%chapterCharacters.length]||STORY_KEY_PEOPLE[1];
 const c3=chapterCharacters[(stage.slot+1)%chapterCharacters.length]||STORY_KEY_PEOPLE[2];
 const specialA=hero(confrontation[0]?.characterId)||c1;
 const specialB=hero(confrontation[1]?.characterId)||c2;
 const prev=CAMPAIGN_STAGES[stage.number-2],next=nextCampaignStage(stage.id);
 const first=stage.slot===1?
  '新しい章が始まる。'+chapter.synopsis:
  '前の戦場「'+(prev?.name||'')+'」を越え、軍師たちは「'+stage.name+'」に辿り着いた。';
 const last=next?
  'この地の決断を胸に、一行は次の舞台「'+next.name+'」へ進む。':
  '星鐘にまつわる二十章の旅の果てに、未来を決める朝が来た。';
 const p=[
  panel(stage,0,{type:'opening',text:'第'+stage.chapter+'章・第'+stage.slot+'ステージ　'+stage.name+'。'+first,second:c1}),
  panel(stage,1,{character:c1,second:c2,text:chapter.dialogues[(stage.slot-1)%3].line,expression:'determined'}),
  panel(stage,2,{character:c2,second:c3,text:chapter.dialogues[stage.slot%3].line,expression:'anxious'}),
  panel(stage,3,{type:'discovery',character:c3,second:specialA,
   text:narrative.scene+' '+chapter.dialogues[(stage.slot+1)%3].line,expression:'thoughtful'}),
  panel(stage,4,{type:'confrontation',character:specialA,second:specialB,
   text:confrontation[0]?.text||narrative.conflict,expression:'angry'}),
  panel(stage,5,{type:'choice',character:specialB,second:c1,
   text:(confrontation[1]?.text||chapter.objective)+' '+narrative.consequence,expression:'resolute'}),
  panel(stage,6,{type:'closing',character:c1,second:c2,
   text:'作戦目標：'+stage.winCondition+'。'+last,expression:'hopeful'})
 ];
 return Object.freeze({
  id:stage.id,chapter:stage.chapter,slot:stage.slot,stageName:stage.name,
  chapterTitle:chapter.title,act:chapter.act,location:chapter.location,
  number:stage.number,previousStageId:prev?.id||null,nextStageId:next?.id||null,
  cast:Object.freeze([...new Set(p.flatMap(x=>[x.characterId,x.secondaryId]).filter(Boolean))].map(x=>byId[x])),
  panels:Object.freeze(p)
 });
}
export const mangaForChapter=chapter=>Object.freeze(CAMPAIGN_STAGES.filter(s=>s.chapter===Number(chapter)).map(s=>mangaForStage(s.id)));
export const mangaStoryChain=()=>Object.freeze(CAMPAIGN_STAGES.map(s=>({
 stageId:s.id,predecessor:CAMPAIGN_STAGES[s.number-2]?.id||null,
 successor:nextCampaignStage(s.id)?.id||null,panelCount:MANGA_PANELS_PER_STAGE
})));
