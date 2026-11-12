/**
 * Authoritative production screenplay draft for all 200 stages.
 * Uses canonical chapter characters/plot and current stage victory rules.
 * New manga pages and recorded voices must be approved separately.
 */
import {STORY_CHAPTERS,STORY_ENDINGS} from './story-chapters.js';
import {CAMPAIGN_STAGE_BY_ID,CAMPAIGN_STAGES,nextCampaignStage} from './campaign-stage-plan.js';
import {STORY_KEY_PERSON_BY_NAME} from './story-cinematic.js';
import {storyDecisionForStage,ROUTES} from './story-narrative-flow.js';
import {STORY_READINGS} from './story-pronunciations.js';
import {STORY_STAGE_BEATS} from './story-stage-beats-v2.js';
export const STORY_SCREENPLAY_VERSION=2;
export const STORY_SCREENPLAY_STAGE_COUNT=200;
const furigana=Object.freeze({
 '灰の勅命':'はいのちょくめい','沈黙の星鐘':'ちんもくのせいしょう',
 '第零の記録者':'だいぜろのきろくしゃ',
 '勅命':'ちょくめい','摂政':'せっしょう','残響':'ざんきょう',
 '封蝋':'ふうろう','改竄':'かいざん','記憶石':'きおくせき',
 '礼拝堂':'れいはいどう','名簿':'めいぼ','遺構':'いこう',
 '密輸':'みつゆ','関所':'せきしょ','証言':'しょうげん','証拠':'しょうこ',
 '陣地':'じんち','制圧':'せいあつ','討伐':'とうばつ',
 '退却':'たいきゃく','撤退':'てったい','敗北':'はいぼく',
 '決戦':'けっせん','戦死':'せんし','召喚獣':'しょうかんじゅう',
 '精霊':'せいれい','契約':'けいやく','誓約':'せいやく',
 '避難民':'ひなんみん','避難':'ひなん','治癒師':'ちゆし',
 '樹海':'じゅかい','湖底':'こてい','石板':'せきばん',
 '水源':'すいげん','桟橋':'さんばし','穀物':'こくもつ',
 '魔力':'まりょく','記録者':'きろくしゃ','継承':'けいしょう',
 '封印':'ふういん','解放':'かいほう','忘却':'ぼうきゃく',
 '同意':'どうい','最深部':'さいしんぶ','始祖':'しそ',
 '三国':'さんごく','女王':'じょおう','宰相':'さいしょう','砦':'とりで'
});
export const STORY_SCREENPLAY_READINGS=Object.freeze({...STORY_READINGS,...furigana});
const dictionary=STORY_SCREENPLAY_READINGS;
const regex=new RegExp(Object.keys(dictionary).sort((a,b)=>b.length-a.length).join('|'),'g');
export function screenplayRubyTokens(text){
 const str=String(text),tokens=[];let cursor=0;
 for(const m of str.matchAll(new RegExp(regex.source,'g'))){
  if(m.index>cursor)tokens.push(Object.freeze({text:str.slice(cursor,m.index),ruby:null}));
  tokens.push(Object.freeze({text:m[0],ruby:dictionary[m[0]]}));
  cursor=m.index+m[0].length;
 }
 if(cursor<str.length)tokens.push(Object.freeze({text:str.slice(cursor),ruby:null}));
 return Object.freeze(tokens);
}
export function screenplayVoiceText(text){
 return String(text).replace(regex,word=>dictionary[word])
  .replace(/([。！？])/g,'$1 ').trim();
}
const knownGender=g=>g==='male'||g==='female';
const makeLine=(stage,phase,branch,gender,speaker,text,index,details={})=>{
 const value=String(text).trim();
 if(!value)throw Error('Empty screenplay line');
 const voiceText=screenplayVoiceText(value);
 return Object.freeze({
  id:stage.id+'-script-'+phase+'-'+branch+'-'+String(index+1).padStart(2,'0'),
  speaker,characterId:STORY_KEY_PERSON_BY_NAME.get(speaker)?.id||null,
  text:value,subtitleText:value,voiceText,
  rubyTokens:screenplayRubyTokens(value),
  pronunciationNeedsReview:/[\u3400-\u9fff々]/.test(voiceText),
  protagonistGender:gender,phase,...details
 });
};
const pages=panels=>Object.freeze(Array.from({length:Math.ceil(panels.length/10)},(_,i)=>{
 const batch=panels.slice(i*10,(i+1)*10);
 return Object.freeze({page:i+1,cellCount:batch.length,panelIds:batch.map(x=>x.id)});
}));
const resultStatus=(stage,context)=>{
 if(stage.kind==='town')return 'town';
 if(context?.battleOutcome?.playerCommanderDead===true)return 'gameover';
 if(context?.battleOutcome?.victory===true)return 'victory';
 if(context?.battleOutcome?.victory===false)return 'defeat';
 return 'preview';
};
export function screenplayForStage(stageId,context={}){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId],gender=context.protagonistGender||'male';
 if(!stage)throw Error('Unknown stage: '+String(stageId));
 if(!knownGender(gender))throw Error('Gender must be male or female');
 const chapter=STORY_CHAPTERS[stage.chapter-1],beat=STORY_STAGE_BEATS[stage.chapter-1][stage.slot-1];
 const decision=storyDecisionForStage(stage.id),choiceId=context.decision||null;
 const chosen=choiceId?decision?.choices.find(c=>c[0]===choiceId):null;
 if(choiceId&&!chosen)throw Error('Invalid decision '+choiceId);
 const routeId=stage.chapter>=13?(context.route||'silver'):null;
 const route=routeId?ROUTES.find(r=>r.id===routeId):null;
 if(routeId&&!route)throw Error('Invalid cooperation route '+routeId);
 const status=resultStatus(stage,context),pre=[],post=[];
 const addPre=(speaker,text,details)=>pre.push(makeLine(stage,'pre','main',gender,speaker,text,pre.length,details));
 const addPost=(speaker,text,details)=>post.push(makeLine(stage,'post',status,gender,speaker,text,post.length,details));
 const speeches=chapter.dialogues;
 const speaker=speeches[(stage.slot-1)%speeches.length],response=speeches[stage.slot%speeches.length];
 const final=speeches[(stage.slot+1)%speeches.length];
 if(stage.slot===1)addPre('語り手','第'+chapter.id+'章「'+chapter.title+'」。'+chapter.narration,{kind:'chapter-opening'});
 addPre('語り手',beat[0],{kind:'stage-setup'});
 addPre(speaker.speaker,speaker.line,{kind:'canonical-dialogue'});
 addPre(response.speaker,response.line,{kind:'canonical-dialogue'});
 addPre('語り手',stage.kind==='town'
  ?'拠点で訪問・会話・買い物・編成を行い、次に備える。'
  :'勝利条件は「'+stage.winCondition+'」。'+chapter.objective,
  {kind:'stage-objective',winCondition:stage.winCondition});
 if(stage.slot===5&&decision)addPre('語り手',chosen
  ?'今回の方針は「'+chosen[1]+'」。成果は戦闘結果を確認して判断する。'
  :'軍師はこの地での方針を選ぶ。結果を先取りしてはならない。',
  {kind:'decision',decision:choiceId,choices:decision.choices});
 if(route)addPre('語り手','協力方針は「'+route.name+'」。灰銀の軍師として協力者と行動する。',
  {kind:'route',route:route.id});
 if(stage.slot===10)addPre('語り手','章の目標は「'+chapter.objective+'」。決戦の結果を確かめる。',{kind:'chapter-objective'});
 if(status==='town'){
  addPost('語り手','町での調査と準備を終えた。'+beat[1],{kind:'town-consequence'});
  addPost(final.speaker,final.line,{kind:'canonical-dialogue'});
 }else if(status==='victory'){
  addPost('語り手','勝利が確認された。'+beat[1],{kind:'victory-consequence'});
  addPost(final.speaker,final.line,{kind:'canonical-dialogue'});
  addPost('語り手','戦場に残る命と記録を確認し、次の行動へ備える。',{kind:'verified-aftermath'});
 }else if(status==='defeat'){
  addPost('語り手','「'+stage.winCondition+'」は未達となった。部隊は撤退し、態勢を立て直す。',{kind:'defeat'});
  addPost(final.speaker,final.line,{kind:'canonical-dialogue'});
  addPost('語り手','次のステージは解放されない。再挑戦の準備を始める。',{kind:'retry'});
 }else if(status==='gameover'){
  addPost('語り手','主人公の軍師が戦死した。指揮を失い、物語はゲームオーバーとなる。',{kind:'player-death'});
  addPost(final.speaker,final.line,{kind:'canonical-dialogue'});
  addPost('語り手','この時間線では次へ進まない。生還や帰還を偽って描かない。',{kind:'gameover-end'});
 }else{
  addPost('語り手','戦闘結果は未確認。勝利も敗北もまだ描かれない。',{kind:'preview-only'});
 }
 if(chosen&&status!=='gameover'&&status!=='preview')addPost('語り手',
  '軍師が選んだ方針は「'+chosen[1]+'」。実際の成果は記録された戦果に限る。',
  {kind:'decision-result',decision:choiceId});
 if(route&&status!=='gameover'&&status!=='preview')addPost('語り手',
  '「'+route.name+'」の協力者へ戦況を伝える。',{kind:'route-consequence',route:route.id});
 if(stage.id==='c20-s10'&&status==='victory'){
  const endingId=context.storyEnding;
  if(endingId){
   const ending=STORY_ENDINGS[endingId];
   if(!ending)throw Error('Invalid ending '+endingId);
   addPost('語り手','結末「'+ending.title+'」。'+ending.narration,{kind:'ending',ending:endingId});
  }else addPost('語り手','最終決戦は終わった。結末の選択はまだ確定していない。',{kind:'ending-pending'});
 }else if(status==='town'||status==='victory'){
  const next=nextCampaignStage(stage.id);
  if(next)addPost('語り手','次は「'+next.name+'」。確かめたことを記録し、一行は進む。',
   {kind:'next-stage',nextStageId:next.id});
 }
 const edition=stage.id+'-'+gender+'-'+status+
  (choiceId?'-choice-'+choiceId:'')+(route?'-route-'+route.id:'')+
  (stage.id==='c20-s10'&&context.storyEnding?'-ending-'+context.storyEnding:'');
 return Object.freeze({
  schemaVersion:STORY_SCREENPLAY_VERSION,stageId:stage.id,chapter:stage.chapter,
  chapterTitle:chapter.title,chapterObjective:chapter.objective,stageName:stage.name,
  stageKind:stage.kind,winCondition:stage.winCondition,gender,
  outcome:status,decision:choiceId,route:route?.id||null,edition,
  status:'screenplay-draft-not-art-or-audio',pre:Object.freeze(pre),
  post:Object.freeze(post),pages:Object.freeze({pre:pages(pre),post:pages(post)})
 });
}
export function screenplayForChapter(chapter,context={}){
 const n=Number(chapter);
 if(!Number.isInteger(n)||n<1||n>20)throw Error('Chapter must be 1..20');
 return Object.freeze(CAMPAIGN_STAGES.filter(s=>s.chapter===n)
  .map(s=>screenplayForStage(s.id,context)));
}
export function screenplayIndex(){
 return Object.freeze(CAMPAIGN_STAGES.map(s=>Object.freeze({
  id:s.id,chapter:s.chapter,slot:s.slot,name:s.name,kind:s.kind,
  winCondition:s.winCondition,opening:STORY_STAGE_BEATS[s.chapter-1][s.slot-1][0],
  victoryBeat:STORY_STAGE_BEATS[s.chapter-1][s.slot-1][1]
 })));
}
