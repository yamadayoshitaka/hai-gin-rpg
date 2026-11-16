/**
 * 20-chapter / 200-stage compact cinematic event adapter.
 * Original m1...m20 shots, voice IDs, registered WebPs, saves and manga review
 * remain intact as an archive. Only runtime display sequence is compacted.
 *
 * 4 opening CGs ONCE per chapter; 2 pre-CGs per stage; 2 result-CGs per
 * stage; defeat uses the same two dialogue beats across all stages.
 * Each CG carries one or more dialogue turns so speaker faces and VOICEVOX
 * can change without generating redundant event background images.
 */
import {CAMPAIGN_STAGES,CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';
import {comicForStage} from './story-chapter-comic.js';
import {screenplayVoiceText,screenplayRubyTokens} from './story-screenplay-v2.js';
export const COMPACT_STORY_CONFIG=Object.freeze({
 schemaVersion:1, chapters:20, stagesPerChapter:10, chapterOpening:4,
 stagePre:2,stagePost:2,sharedDefeat:2,sharedGameover:2,
 useTextInArtwork:false,playback:'CG_AND_MULTI_TURN_PORTRAIT_DIALOGUE'
});
export const COMPACT_DEFEAT_LINES=Object.freeze([
 '作戦目標は達成できなかった。部隊は戦線を離れ、負傷者の救護と撤退を優先する。',
 '無理に進軍せず、仲間の無事を確かめて態勢を立て直す。次の出撃に備えよう。'
]);
export const COMPACT_GAMEOVER_LINES=Object.freeze([
 '軍師の戦死が確認された。指揮を失った部隊は戦いを終えた。',
 'この時間線の物語はここで終わる。軍師が帰還したと偽ってはならない。'
]);
const freeze=a=>Object.freeze(a);
function turn(p,forcedText=null){
 const text=forcedText??p?.text??'';
 return freeze({id:p?.id??'shared',speaker:forcedText===null?(p?.speaker||'語り手'):'語り手',
  characterId:forcedText===null?(p?.characterId||null):null,
  role:forcedText===null?(p?.role||'物語'):'物語',
  faction:forcedText===null?(p?.faction||''):'',
  text,subtitleText:text,voiceText:forcedText===null?(p?.voiceText||screenplayVoiceText(text)):screenplayVoiceText(text),
  rubyTokens:screenplayRubyTokens(text),hasVoice:true});
}
function scene(base,turns,{opening=false,sharedKind=null}={}){
 if(!base||!turns.length)throw Error('Compact scene missing art identity or dialogue');
 const first=turns[0];
 return freeze({...base,compactStory:true,isChapterOpening:opening,
  sharedSceneKind:sharedKind,
  // Do not force an unverified global defeat image over the stage/gender art.
  // Shared assets require a separate byte/SHA and actor-free visual QA gate.
  // Until that evidence is registered, preserve the exact original art identity.
  sharedArtAsset:null,
  protagonistAssetPolicy:'exact-gender-or-proven-neutral-only',
  originalSceneId:base.id,originalComicCell:base.comicCell,
  originalSheetCount:base.sourceSheetCount??null,
  dialogueTurns:freeze(turns),
  speaker:first.speaker,characterId:first.characterId,text:first.text,
  subtitleText:first.text,voiceText:first.voiceText,rubyTokens:first.rubyTokens});
}
function selectBySuffix(list,token){
 return list.find(p=>p.id.endsWith('-'+token))||null;
}
function distribute(lines,num){
 const n=Math.ceil(lines.length/num);
 return Array.from({length:num},(_,i)=>{
  const a=lines.slice(i*n,(i+1)*n);
  return a.length?a:lines.slice(-1);
 });
}
function chapterSeen(context,chapter){
 // Chapter-scoped persisted flags are authoritative. A global boolean would
 // suppress the opening of every subsequent chapter after chapter one.
 return context?.storyFlags?.chapterOpenings?.[chapter]===true||
  context?.storyFlags?.chapterOpenings?.[String(chapter)]===true;
}
export function compactComicForStage(stageId,phase,context={}){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];
 if(!stage)throw Error('Unknown compact comic stage '+String(stageId));
 if(!['pre','post'].includes(phase))throw Error('Invalid compact phase');
 const original=comicForStage(stageId,phase,context);
 const src=original.panels;
 const opening=phase==='pre'&&stage.slot===1&&!chapterSeen(context,stage.chapter);
 const openIds=['m1','m2','m3','m4'];
 const openingArt=opening?openIds.map(id=>selectBySuffix(src,id)):[];
 if(opening&&openingArt.some(x=>!x))throw Error('Missing chapter opening canonical frame '+stageId);
 const omitOpening=phase==='pre'&&stage.slot===1?new Set(openIds.map(n=>stageId+'-'+n)):new Set();
 const lines=src.filter(x=>!omitOpening.has(x.id));
 const baseIds=phase==='pre'?(stage.slot===1?['m5','m15']:['m1','m15']):['m6','m10'];
 const base=baseIds.map(x=>selectBySuffix(src,x));
 if(phase==='post'&&original.edition.startsWith('post-gameover')){
  const deaths=src.filter(p=>/-death-[12]$/.test(p.id));
  if(deaths.length===2)base.splice(0,2,...deaths);
 }
 if(base.some(x=>!x))throw Error('Missing compact source art identity '+stageId+' '+original.edition);
 const withCount=p=>({...p,sourceSheetCount:original.pages.find(q=>q.number===p.comicPage)?.cellCount||1});
 const scenes=openingArt.map(p=>scene(withCount(p),[turn(p)],{opening:true}));
 let batches=distribute(lines,2).map(group=>group.map(p=>turn(p)));
 let sharedKind=null;
 if(phase==='post'&&original.edition.startsWith('post-defeat')){
   sharedKind='defeat';
   batches=COMPACT_DEFEAT_LINES.map((str,i)=>[turn(base[i],str)]);
 }
 if(phase==='post'&&original.edition.startsWith('post-gameover')){
   sharedKind='gameover';
   batches=COMPACT_GAMEOVER_LINES.map((str,i)=>[turn(base[i],str)]);
 }
 for(let i=0;i<2;i++)scenes.push(scene(withCount(base[i]),batches[i],{sharedKind}));
 if(scenes.length!==(opening?6:2))throw Error('Compact frame quota violated');
 const compactScenes=freeze(scenes.map((p,i)=>freeze({...p,compactSceneIndex:i,compactSceneCount:scenes.length})));
 return freeze({...original,compact:true,panels:compactScenes,scenes:compactScenes,
  imageCount:scenes.length,originalSceneCount:src.length,chapterOpeningCount:opening?4:0,
  stageSceneCount:2,dialogueCount:compactScenes.reduce((s,p)=>s+p.dialogueTurns.length,0)});
}
export function compactChapterPlan(chapter){
 const n=Number(chapter);
 if(!Number.isInteger(n)||n<1||n>20)throw Error('Chapter 1..20 only');
 const stageIds=CAMPAIGN_STAGES.filter(s=>s.chapter===n).map(s=>s.id);
 if(stageIds.length!==10)throw Error('Chapter must have 10 stages');
 return freeze({chapter:n,stageIds:freeze(stageIds),
  opening:4,prePerStage:2,postPerStage:2,
  requiredPrimaryImageSlots:44,sharedDefeatSlots:2,sharedGameoverSlots:2,
  dialoguePortraits:true,genderSpecificOnlyWhereCharacterVisible:true});
}
export const COMPACT_TWENTY_CHAPTER_PLAN=freeze(Array.from({length:20},(_,i)=>compactChapterPlan(i+1)));
