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
 '三国':'さんごく','女王':'じょおう','宰相':'さいしょう','砦':'とりで',
 // First-five-chapter story-specific readings: names, difficult kanji and
 // battle/location terms. Do not rewrite the on-screen dialogue.
 '黎明':'れいめい','松影':'まつかげ','密約':'みつやく',
 '烽火':'のろし','鐘守の影':'かねもりのかげ','罪を量る橋':'つみをはかるはし',
 '紅の烽火':'くれないののろし','王都レヴナ':'おうとれぶな',
 '中央平原':'ちゅうおうへいげん','松影の森':'まつかげのもり',
 '記憶の重量':'きおくのじゅうりょう','古井戸':'ふるいど',
 '死者名簿':'ししゃめいぼ','戦死者数':'せんししゃすう',
 '老騎士':'ろうきし','治癒師':'ちゆし','少女':'しょうじょ',
 '穀物庫':'こくもつこ','帳簿':'ちょうぼ','墓標':'ぼひょう',
 '紋章':'もんしょう','城門':'じょうもん','避難路':'ひなんろ',
 '封鎖':'ふうさ','先遣隊':'せんけんたい','街道':'かいどう',
 '補給路':'ほきゅうろ','守備線':'しゅびせん','水路':'すいろ',
 '伐採':'ばっさい','迂回':'うかい','船頭':'せんどう',
 '積荷':'つみに','密輸船':'みつゆせん','軍議':'ぐんぎ',
 '生還':'せいかん','帰還':'きかん','戦況':'せんきょう',
 '軍団':'ぐんだん','反乱':'はんらん','城壁':'じょうへき',
 '王城':'おうじょう','礼装':'れいそう','捕虜':'ほりょ',
 '負傷者':'ふしょうしゃ','同盟':'どうめい','証人':'しょうにん',
 '退避':'たいひ','連絡路':'れんらくろ','民間人':'みんかんじん'
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
// Spoken lines belong to the current image/event: the three original
// chapter-defining quotes are shown ONCE at the chapter opening, never cycled
// mechanically through all ten stages. Tactical talk refers to this particular
// map position; verified outcomes are never spoken before a battle result.
const fieldTalk=Object.freeze({
 town:[
  stage=>'まずは「'+stage.name+'」の人たちから事情を聞いてみよう。地図にない話もあるはずだ。',
  stage=>'兵の準備と住民の相談を混ぜないで進めよう。'+stage.name+'での用件を一つずつ確かめたい。'
 ],
 explore:[
  stage=>'「'+stage.name+'」の手前で足を止めよう。魔物の動きと人の通る道を見分ける必要がある。',
  stage=>'勝ち急ぐと調査の手掛かりまで傷つける。'+stage.name+'の周囲をよく見て進もう。'
 ],
 capture:[
  stage=>'「'+stage.name+'」を押さえるなら、補給に使う道を先に調べよう。',
  stage=>'旗を立てた後が肝心だ。'+stage.name+'を通る住民の道も塞がないでおこう。'
 ],
 defend:[
  stage=>'「'+stage.name+'」の後ろには逃げ遅れた人もいる。守る場所を先に決めよう。',
  stage=>'誰かが退路を失う前に、'+stage.name+'の防衛線を整えておきたい。'
 ],
 siege:[
  stage=>'「'+stage.name+'」の城壁だけを見てはだめだ。人が出られる道も探そう。',
  stage=>'突入を急いでも、'+stage.name+'の中にいる民を傷つけたら意味がない。'
 ],
 boss:[
  stage=>'「'+stage.name+'」で得るものは勝ち名乗りだけじゃない。真相に近づく準備をしよう。',
  stage=>'ここまで追ってきた記録が、'+stage.name+'につながっている。最後まで見届けよう。'
 ]
});
const outcomeTalk=Object.freeze({
 town:stage=>'聞き取った話をまとめよう。'+stage.name+'での準備を次の任務につなげたい。',
 victory:stage=>'「'+stage.name+'」で確保した道を守りながら、残された手掛かりを整理しよう。',
 defeat:stage=>'「'+stage.name+'」の目標は届かなかった。今は仲間を集め直そう。',
 gameover:stage=>'「'+stage.name+'」の軍師は戻らない。指揮の終わりを記録しよう。'
});
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
 if(stage.slot===1){
  // Each chapter's three canonical speeches are spoken once, at its opening.
  for(const original of speeches){
   const displayLine=!context.artManifestCompatible&&
    stage.chapter===1&&original.speaker==='老騎士ガラン'
    ?'王城の外にはまだ帰れない兵がいる。命令を待たせるより、あの者たちの道を先に守ってやれ。'
    :original.line;
   addPre(original.speaker,displayLine,{kind:'canonical-dialogue'});
  }
 }else{
  const talk=fieldTalk[stage.kind]||fieldTalk.explore;
  addPre(speaker.speaker,talk[0](stage),{kind:'stage-character-dialogue'});
  addPre(response.speaker,talk[1](stage),{kind:'stage-character-dialogue'});
 }
 addPre('語り手',stage.kind==='town'
  ?'「'+stage.name+'」で仲間の編成と相談を済ませ、次の出発に備える。'
  :'「'+stage.name+'」の勝利条件は「'+stage.winCondition+'」。'+chapter.objective,
  {kind:'stage-objective',winCondition:stage.winCondition});
 if(stage.slot===5&&decision)addPre('語り手',chosen
  ?'今回の方針は「'+chosen[1]+'」。成果は戦闘結果を確認して判断する。'
  :'軍師はこの地での方針を選ぶ。結果を先取りしてはならない。',
  {kind:'decision',decision:choiceId,choices:decision.choices});
 if(route)addPre('語り手','協力方針は「'+route.name+'」。灰銀の軍師として協力者と行動する。',
  {kind:'route',route:route.id});
 if(stage.slot===10)addPre('語り手','章の目標は「'+chapter.objective+'」。決戦の結果を確かめる。',{kind:'chapter-objective'});
 if(status==='town'){
  addPost('語り手',context.artManifestCompatible?
   '町での調査と準備を終えた。'+beat[1]:
   '「'+stage.name+'」での調査を終えた。'+beat[1],{kind:'town-consequence'});
  if(stage.slot>1)addPost(final.speaker,outcomeTalk.town(stage),{kind:'stage-epilogue-dialogue'});
 }else if(status==='victory'){
  addPost('語り手',context.artManifestCompatible?
   '勝利が確認された。'+beat[1]:
   '「'+stage.name+'」での勝利が確認された。'+beat[1],{kind:'victory-consequence'});
  addPost(final.speaker,outcomeTalk.victory(stage),{kind:'stage-epilogue-dialogue'});
  addPost('語り手','軍は「'+stage.name+'」の記録を保全し、次の行動へ備える。',{kind:'verified-aftermath'});
 }else if(status==='defeat'){
  addPost('語り手',context.artManifestCompatible?
   '「'+stage.winCondition+'」は未達となった。部隊は撤退し、態勢を立て直す。':
   '「'+stage.name+'」の目標「'+stage.winCondition+'」は未達。部隊は撤退する。',{kind:'defeat'});
  addPost(final.speaker,outcomeTalk.defeat(stage),{kind:'stage-epilogue-dialogue'});
  addPost('語り手','「'+stage.name+'」は未攻略。次のステージを解放せず、再挑戦の準備を始める。',{kind:'retry'});
 }else if(status==='gameover'){
  addPost('語り手',context.artManifestCompatible?
   '主人公の軍師が戦死した。指揮を失い、物語はゲームオーバーとなる。':
   '「'+stage.name+'」で主人公の軍師が戦死した。指揮を失い、物語はゲームオーバーとなる。',{kind:'player-death'});
  addPost(final.speaker,outcomeTalk.gameover(stage),{kind:'stage-epilogue-dialogue'});
  addPost('語り手',context.artManifestCompatible?
   'この時間線では次へ進まない。生還や帰還を偽って描かない。':
   'この時間線で「'+stage.name+'」から先へは進まない。生還を偽って描かない。',{kind:'gameover-end'});
 }else{
  addPost('語り手','「'+stage.name+'」の戦闘結果は未確認。勝敗が判明する前の仮表示。',{kind:'preview-only'});
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
  if(next)addPost('語り手','「'+stage.name+'」で確認した事実を記録し、次は「'+next.name+'」へ進む。',
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
