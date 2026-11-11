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
import {storyVoiceText} from './story-pronunciations.js';
const byId=Object.freeze(Object.fromEntries(STORY_KEY_PEOPLE.map(character=>[character.id,character])));
const hero=(characterId)=>characterId?byId[characterId]||null:null;
const sceneryByKind=Object.freeze({
 town:'royal-town',explore:'wilds',capture:'frontier',defend:'refuge',
 siege:'fortress',boss:'starbell'
});
const expressions=['resolute','anxious','determined','thoughtful','angry','hopeful','sorrowful'];
export const MANGA_PANELS_PER_STAGE=10;
export const MANGA_PRE_BATTLE_PANELS=5;
export const MANGA_POST_BATTLE_PANELS=5;
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
  subtitleText:String(text).trim(),voiceText:storyVoiceText(text),
  phase:index<5?'pre':'post',
  expression:expression||expressions[(stage.number+index)%expressions.length],
  scenery:sceneryByKind[stage.kind]||'wilds',mood:
   index===0?'overture':index===3?'mystery':index===4?'conflict':
   index===5?'resolve':index===6?'transition':'dialogue',
  hasVoice:voice,artSeed:stage.number*23+index*19
 });
}
export function mangaForStage(idOrStage='c01-s01',context={}){
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
  '舞台は「'+chapter.location+'」。この土地で新たな事件が起きている。':
  '前の舞台を越え、軍師たちは「'+stage.name+'」へ辿り着いた。';
 const last=next?
  'この地の決断を胸に、一行は次の舞台「'+next.name+'」へ進む。':
  '星鐘にまつわる二十章の旅の果てに、未来を決める朝が来た。';
 // The very first meeting must feel like a scene, not an encyclopaedia.
 // Introduce the player and characters before the royal seal and the starbell.
 if(stage.id==='c01-s01'){
  const lucia=byId.lucia,garan=byId.garan,iris=byId.iris;
  const intro=[
   panel(stage,0,{type:'opening',second:lucia,text:'灰銀の王都レヴナ。朝の市場を抜け、ひとりの新任軍師が王城へ招かれた。'}),
   panel(stage,1,{character:lucia,second:garan,text:'来てくれたのですね。私はリュシア。この国の政を預かっています。',expression:'hopeful'}),
   panel(stage,2,{character:garan,second:lucia,text:'俺はガラン。老騎士だ。まずは、この町で暮らす者たちを見てほしい。',expression:'thoughtful'}),
   panel(stage,3,{character:iris,second:lucia,text:'イリスです。昨夜、礼拝堂で不思議なことが起きました。亡くなった人の名前が、帳簿から消えたのです。',expression:'anxious'}),
   panel(stage,4,{type:'confrontation',character:lucia,second:iris,text:'先王が遺した命令は「国境を守れ」。でも、この王印は何かがおかしい……。',expression:'sorrowful'}),
   panel(stage,5,{type:'choice',character:garan,second:lucia,text:'急いで答えを出す必要はない。ここにいる者が何を守りたいのか、まず知ってくれ。',expression:'resolute'}),
   panel(stage,6,{type:'closing',character:lucia,second:garan,text:'町を歩いて準備ができたら、次の舞台「'+(next?.name||'王城')+'」へ。あなたの力を貸してください。',expression:'determined'})
  ];
  return Object.freeze({
   id:stage.id,chapter:stage.chapter,slot:stage.slot,stageName:stage.name,
   chapterTitle:chapter.title,act:chapter.act,location:chapter.location,
   number:stage.number,previousStageId:null,nextStageId:next?.id||null,
   cast:Object.freeze([lucia,garan,iris]),panels:Object.freeze(applyPlayerGender([
    ...intro.slice(0,5),...buildPostPanels(stage,chapter,narrative,[lucia,garan,iris],next,context)
   ],context))
  });
 }
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
  panels:Object.freeze(applyPlayerGender([
    ...addRouteContext(p.slice(0,5),stage,context),
    ...buildPostPanels(stage,chapter,narrative,[c1,c2,c3,specialA,specialB],next,context)
   ],context))
 });
}


/**
 * Five epilogue shots after the actual result is received from the existing
 * battle engine. Never fabricate casualties, rescued people or an unlocked
 * stage: those facts must come from a verified outcome receipt.
 *
 * When outcome is absent, post panels are neutral previews for art/voice QA.
 */
function buildPostPanels(stage,chapter,narrative,cast,next,context={}){
 const [first,second,third,fourth,fifth]=cast;
 const outcome=context?.battleOutcome;
 const isTown=stage.kind==='town';
 const victory=outcome?.victory===true;
 const defeated=outcome?.victory===false;
 const status=isTown?'町での調査を終え、仲間たちは次の行動を話し合う。':
  victory?'戦闘が終わった。作戦目標を達成し、部隊は損害を確認している。':
  defeated?'戦闘が終わった。目標を達成できず、部隊は撤退した。':
  '戦闘の結果を確認し、部隊の状況と残された人々の声に向き合う。';
 const after=defeated?
  '失った者の名を記録する。今は無理に進軍せず、町で態勢を整えよう。':
  isTown?'拠点で得た証言と準備を整理し、次の任務に備えよう。':
  '勝利の報告だけでは終われない。戦場に残された人々と記録を調べよう。';
 const dialogue=chapter.dialogues[(stage.slot+1)%chapter.dialogues.length]?.line||chapter.objective;
 const nextLine=defeated?'退却を命じる。町で編成を立て直して、この地へ戻ろう。':
  next?'次の舞台「'+next.name+'」へ進む。ここで見たことを忘れてはならない。':
  '二十章の旅が終わり、星鐘の未来を選ぶ朝が来た。';
 return [
  panel(stage,5,{type:'aftermath',character:first,second:second,text:status,expression:defeated?'sorrowful':'thoughtful'}),
  panel(stage,6,{type:'aftermath',character:second,second:third,text:after,expression:defeated?'anxious':'resolute'}),
  panel(stage,7,{type:'revelation',character:third,second:fourth,text:narrative.consequence+' '+dialogue,expression:'thoughtful'}),
  panel(stage,8,{type:'choice',character:fourth,second:fifth,text:
   (defeated?'今は退くことが必要だ。':'誰のためにこの地で戦ったのかを、忘れてはいけない。')+
   ' '+chapter.objective,expression:'determined'}),
  panel(stage,9,{type:'closing',character:fifth,second:first,text:nextLine,expression:defeated?'sorrowful':'hopeful'})
 ];
}
function applyPlayerGender(panels,context={}){
 const protagonistGender=context?.protagonistGender==='female'?'female':context?.protagonistGender==='male'?'male':'unspecified';
 return panels.map(panel=>Object.freeze({...panel,protagonistGender}));
}
const routeMessages=Object.freeze({
 silver:'灰銀の軍師として、リュシアと王国の内部を立て直す道を選んだ。',
 crimson:'紅炎のライゼンと共同して、帝国内の強硬派と向き合う道を選んだ。',
 verdant:'翠嵐のアルテアと協力し、森と記憶の両方を守る道を選んだ。',
 independent:'三国のどこにも指揮権を預けず、調停のために戦う道を選んだ。'
});
function addRouteContext(p,stage,context={}){
 if(stage.chapter<13||stage.chapter>20||!context?.route)return p;
 const note=routeMessages[context.route]||routeMessages.silver;
 return p.map((shot,index)=>{
  if(index!==0)return shot;
  const chapterPrefix=stage.chapter>=16?'三国が共同戦線を組み、これまでの選択が援軍と作戦に引き継がれる。':note;
  const text=shot.text+' '+chapterPrefix;
  return Object.freeze({...shot,text,subtitleText:text,voiceText:storyVoiceText(text)});
 });
}
export const mangaForChapter=chapter=>Object.freeze(CAMPAIGN_STAGES.filter(s=>s.chapter===Number(chapter)).map(s=>mangaForStage(s.id)));
export const mangaStoryChain=()=>Object.freeze(CAMPAIGN_STAGES.map(s=>({
 stageId:s.id,predecessor:CAMPAIGN_STAGES[s.number-2]?.id||null,
 successor:nextCampaignStage(s.id)?.id||null,panelCount:MANGA_PANELS_PER_STAGE
})));
