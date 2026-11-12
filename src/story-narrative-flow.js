/**
 * Story flow / diplomacy reference. Data-only: no 3D models, random decisions,
 * network requests or direct mutation of combat state.
 * Existing stage IDs and story chapters remain canonical.
 */
import {STORY_CHAPTERS,STORY_ENDINGS,STORY_ACTS} from './story-chapters.js';
import {STORY_KEY_PEOPLE} from './story-cinematic.js';
import {CAMPAIGN_STAGES,CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';

export const FACTION_GUIDE=Object.freeze([
 {id:'silver',name:'灰銀王国',color:'#a6bfd5',ruler:'リュシア',purpose:'国境防衛と先王の王印の調査'},
 {id:'crimson',name:'紅炎帝国',color:'#d78579',ruler:'ヴァルド',purpose:'国と民の生活、失われた皇子の記憶'},
 {id:'verdant',name:'翠嵐王国',color:'#9bc99f',ruler:'アルテア',purpose:'森と水源を守り、星鐘の代価に向き合う'},
 {id:'archive',name:'記録院',color:'#b6a5d5',ruler:'ヴェス',purpose:'記憶を管理し、星鐘を再起動しようとする'},
 {id:'warden',name:'鐘守',color:'#d9d2eb',ruler:'エルネの残響',purpose:'本人の同意と記憶の自由を取り戻す'},
 {id:'neutral',name:'中立の民・森守',color:'#d4b98b',ruler:'ノエル',purpose:'三国の旗に依らず土地と人を守る'}
]);
const names={
 silver:['lucia','garan','iris','shion','kai','leon','fio','edo','mina'],
 crimson:['raizen','vald','selika','zahar','grad'],
 verdant:['altea','orphe','meve'],
 neutral:['noel'],warden:['elne'],archive:['vess']
};
export const CHARACTER_FACTION_BY_ID=Object.freeze(Object.fromEntries(
 Object.entries(names).flatMap(([faction,people])=>people.map(id=>[id,faction]))
));
export const STORY_CHARACTERS=Object.freeze(STORY_KEY_PEOPLE.map(p=>Object.freeze({
 ...p,storyFaction:CHARACTER_FACTION_BY_ID[p.id]||'neutral',
 storyFactionName:FACTION_GUIDE.find(x=>x.id===(CHARACTER_FACTION_BY_ID[p.id]||'neutral'))?.name||'中立',
 modelStatus:'別工程（人物ID・外見方針のみ固定）'
})));
export const ROUTES=Object.freeze([
 {id:'silver',name:'灰銀継続',description:'リュシアと王国内部を改革。出身・正規所属は灰銀。'},
 {id:'crimson',name:'紅炎協力',description:'ライゼンと停戦・住民救出を優先。灰銀からの亡命ではない。'},
 {id:'verdant',name:'翠嵐協力',description:'アルテアと森・記憶の問題を協議。灰銀からの亡命ではない。'},
 {id:'independent',name:'独立調停',description:'三国を仲介する独立した共同作戦。国籍の変更ではない。'}
]);
export const ENDING_GUIDE=Object.freeze([
 {id:'release',name:STORY_ENDINGS.release.title,summary:'星鐘を解放し、死者の記憶を還す'},
 {id:'seal',name:STORY_ENDINGS.seal.title,summary:'星鐘を封じ、生きる人々の生活を守る'},
 {id:'inherit',name:STORY_ENDINGS.inherit.title,summary:'軍師自身の記憶を捧げ、仕組みを変える'}
]);

// Player sets a sortie policy; a battle result is required before it is
// counted as a completed story decision. These are narrative stances, not
// claims that civilians were rescued by a combat engine without such a metric.
export const STORY_DECISIONS=Object.freeze({
 2:{title:'消えた鐘守',choices:[['rescue','避難民の保護を優先'],['evidence','鐘守の帳簿を優先']]},
 3:{title:'松影の密約',choices:[['preserve','森と墓標を守り迂回'],['shortcut','森を切り開き進軍']]},
 4:{title:'罪を量る橋',choices:[['publish','不正取引を告発'],['hold','証拠を保管']]},
 5:{title:'紅の烽火',choices:[['protect','避難民の安全を優先'],['assault','強行突破を優先']]},
 6:{title:'泣かない騎士',choices:[['rescue','負傷者の救援を優先'],['front','防衛線の維持を優先']]},
 7:{title:'湖底の名簿',choices:[['respect','召喚獣の意思を尊重'],['deploy','軍の戦力確保を優先']]},
 8:{title:'翠嵐の祈り',choices:[['preserve','森と住民を守る'],['break','魔力施設を制圧']]},
 9:{title:'屋根を渡る影',choices:[['stealth','潜入して証拠を集める'],['siege','正面から制圧する']]},
 10:{title:'刻まれぬ戦死者',choices:[['publish','先王の真相を公表'],['verify','資料を持ち帰り検証']]},
 11:{title:'血で買われた春',choices:[['rescue','集落の生存者を保護'],['capture','魔力施設の制圧を優先']]},
 12:{title:'王都の密室',choices:[['share','発見した記録を共有'],['archive','灰銀で保管する']]},
 14:{title:'千年前の証人',choices:[['publish','エルネの証言を公開'],['protect','証言を保全する']]},
 15:{title:'第零の記録者',choices:[['investigate','記憶継承の可能性を調査'],['alternative','犠牲のない方法を探す']]},
 16:{title:'黒星の夜',choices:[['coalition','三国共同指揮を優先'],['limited','限定協力を維持']]},
 17:{title:'百隊の祈り',choices:[['rescue','避難路防衛を優先'],['offense','記録院への進撃を優先']]},
 18:{title:'星鐘の心臓',choices:[['control','星鐘の制御・調査を優先'],['destroy','装置の破壊を優先']]},
 19:{title:'救済の代価',choices:[['release','解放の準備'],['seal','封印の準備'],['inherit','記憶継承の準備']]}
});
const flags=game=>game?.storyFlags||{};
export const STORY_DECISION_SLOT=5;
export const storyDecisionForStage=id=>{
 const stage=CAMPAIGN_STAGE_BY_ID[id];
 return stage?.slot===STORY_DECISION_SLOT?STORY_DECISIONS[stage.chapter]||null:null;
};
export function setStoryDecision(game,stageId,choiceId){
 const decision=storyDecisionForStage(stageId);
 if(!decision||!decision.choices.some(([id])=>id===choiceId))throw Error('このステージの方針ではありません。');
 if(!game||game.completedStages?.includes(stageId))throw Error('完了済みステージの方針は変更できません。');
 game.storyFlags??={};game.storyFlags.storyDecisions??={};
 game.storyFlags.storyDecisions[stageId]=choiceId;
 return choiceId;
}
const decisionComplete=(game,chapter,expected)=>game?.completedStages?.includes('c'+String(chapter).padStart(2,'0')+'-s05')
 &&expected.includes(flags(game).storyDecisions?.['c'+String(chapter).padStart(2,'0')+'-s05']);
export function storyAllianceScores(game){
 // These are qualitative diplomatic relationship marks, not rescued-person counts.
 const red=[decisionComplete(game,5,['protect']),decisionComplete(game,10,['publish','verify'])].filter(Boolean).length;
 const green=[decisionComplete(game,3,['preserve']),decisionComplete(game,8,['preserve']),decisionComplete(game,12,['share'])].filter(Boolean).length;
 const testimony=[decisionComplete(game,4,['publish','hold']),decisionComplete(game,9,['stealth']),decisionComplete(game,12,['share'])].filter(Boolean).length;
 return {crimson:red,verdant:green,evidence:testimony};
}
export function availableStoryRoutes(game){
 const trust=storyAllianceScores(game),allowed=Boolean(game?.completedStages?.includes('c13-s01'));
 return ROUTES.map(route=>({
  ...route,
  unlocked:allowed&&(route.id==='silver'||route.id==='crimson'&&trust.crimson>=1
   ||route.id==='verdant'&&trust.verdant>=1
   ||route.id==='independent'&&trust.crimson>=1&&trust.verdant>=1&&trust.evidence>=1)
 }));
}
export function currentStoryRoute(game){
 return ROUTES.find(r=>r.id===flags(game).route?.activeCooperation)||null;
}
export function selectStoryRoute(game,routeId){
 const available=availableStoryRoutes(game).find(r=>r.id===routeId);
 if(!available?.unlocked)throw Error('この協力ルートはまだ解放されていません。');
 game.storyFlags??={};game.storyFlags.route??={originalAffiliation:'silver'};
 if(game.storyFlags.route.activeCooperation&&game.storyFlags.route.activeCooperation!==routeId)
  throw Error('一度決めた政治的協力先は変更できません。');
 game.storyFlags.route.activeCooperation=routeId;
 return available;
}
export function storyStageContext(game,id){
 const stage=CAMPAIGN_STAGE_BY_ID[id];
 if(!stage)return null;
 const route=currentStoryRoute(game);
 return {
  stageId:id,chapter:stage.chapter,kind:stage.kind,
  protagonistGender:game?.campaign?.commander?.gender==='female'?'female':'male',
  origin:'silver',route:route?.id||'silver',routeName:route?.name||'灰銀軍師',
  coalition:stage.chapter>=16,
  decision:flags(game).storyDecisions?.[id]||null,
  // Only a saved, explicitly selected ending can choose an ending illustration.
  storyEnding:stage.id==='c20-s10'?(game?.narrativeEnding||flags(game).storyEnding||null):null,
  enemy:stage.chapter>=16?'記録院・星鐘の防衛勢力':
    stage.chapter>=13?'記録院の妨害部隊':stage.enemyFaction==='verdant'?'翠嵐軍':'紅炎軍'
 };
}

export function availableStoryEndings(game){
 const done=Boolean(game?.completedStages?.includes('c20-s10'));
 const d=flags(game).storyDecisions||{};
 const score=storyAllianceScores(game);
 return ENDING_GUIDE.map(e=>({
  ...e,unlocked:done&&(e.id==='seal'||
   e.id==='release'&&(score.evidence>=1||d['c18-s05']==='control')||
   e.id==='inherit'&&d['c15-s05']==='investigate'&&d['c19-s05']==='inherit'),
  reason:!done?'第20章の決戦が未完了':
   e.id==='release'?'記録の調査または星鐘の制御が必要':
   e.id==='inherit'?'第15章の記憶継承調査と第19章の準備が必要':''
 }));
}
export function chooseStoryEnding(game,id){
 const entry=availableStoryEndings(game).find(e=>e.id===id);
 if(!entry?.unlocked)throw Error('この結末を選ぶための条件が整っていません。');
 if(game.narrativeEnding&&game.narrativeEnding!==id)throw Error('決定した結末は変更できません。');
 game.narrativeEnding=id;
 game.storyFlags??={};game.storyFlags.storyEnding=id;
 game.history??=[];game.history.unshift('星鐘の結末「'+entry.name+'」を選んだ。');
 game.history=game.history.slice(0,50);
 return entry;
}

export const STORY_FLOW=Object.freeze(STORY_CHAPTERS.map(ch=>{
 const participants=ch.dialogues.map(v=>v.speaker);
 return Object.freeze({
  chapter:ch.id,title:ch.title,act:STORY_ACTS[ch.act-1],
  location:ch.location,objective:ch.objective,synopsis:ch.synopsis,
  firstStage:CAMPAIGN_STAGES[(ch.id-1)*10].id,lastStage:CAMPAIGN_STAGES[ch.id*10-1].id,
  participants,branchType:ch.id===13?'four-route':
   ch.id===20?'three-ending':STORY_DECISIONS[ch.id]?'policy':'linear',
  cooperator:ch.id<=12?'灰銀軍':ch.id<=15?'第13章で選んだ勢力':
   ch.id<=19?'三国共同戦線':'主人公自身の意思'
 });
}));
