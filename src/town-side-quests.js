/** Optional tavern sorties: two separate BATTLE missions for every cleared story stage.
 * Town selection never awards currency. Only the authoritative battle settlement does.
 */
import {CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';
import {MONSTER_CATALOG} from './monster-catalog.js';
const SIDE_KINDS=Object.freeze([
 Object.freeze({id:'escort',title:'旅商人の護衛',description:'街道を襲う魔物を全滅させ、物資の輸送を守る。',choices:['守備を重視して出撃','機動力を重視して出撃']}),
 Object.freeze({id:'recon',title:'遺跡と魔物の調査',description:'調査区域に出撃し、出現した魔物をすべて倒す。',choices:['慎重な探索で出撃','迅速な掃討で出撃']})
]);
const validId=id=>typeof id==='string'&&/^c\d{2}-s\d{2}-(escort|recon)$/.test(id);
export function tavernQuestStages(game){
 const completed=Array.isArray(game?.completedStages)?game.completedStages:[];
 return completed.map(id=>CAMPAIGN_STAGE_BY_ID[id]).filter(s=>s&&s.kind!=='town')
  .map(stage=>({stage,quests:SIDE_KINDS.map(kind=>({
   id:stage.id+'-'+kind.id,kind:kind.id,stageId:stage.id,
   title:kind.title,description:kind.description,choices:kind.choices,
   completed:Boolean(game.tavernSideQuestDone?.[stage.id+'-'+kind.id])
  }))}));
}
export function tavernQuestById(game,id){
 if(!validId(id))return null;
 return tavernQuestStages(game).flatMap(s=>s.quests).find(q=>q.id===id)||null;
}
export function runTavernSideQuest(game,id,choice,battleId){
 if(game?.location!=='town')throw Error('依頼は酒場から出撃してください。');
 if(game.campaign?.gameOver)throw Error('ゲームオーバー中は出撃できません。');
 const quest=tavernQuestById(game,id);
 if(!quest)throw Error('この依頼は対象ステージをクリアすると解放されます。');
 if(quest.completed)throw Error('この依頼の報酬は受取済みです。');
 if(![0,1].includes(choice))throw Error('依頼の進め方を選択してください。');
 if(!battleId||typeof battleId!=='string')throw Error('戦闘IDが必要です。');
 if(!game.campaign?.squads?.some(s=>s.count>0&&String(s.commanderId||'')!=='reserve'))
  throw Error('出撃可能な隊がありません。宿屋で軍師へ配属してください。');
 // This holds the sole authorization to convert a battle victory into a reward.
 const pending={id:quest.id,stageId:quest.stageId,choice,battleId};
 game.pendingTavernQuest=pending;
 return {quest,pending};
}
export function tavernQuestBattleSettings(game,pending){
 const quest=tavernQuestById(game,pending?.id);
 if(!quest||quest.completed||game.pendingTavernQuest?.battleId!==pending.battleId)
  throw Error('出撃依頼が正しくありません。');
 const stage=CAMPAIGN_STAGE_BY_ID[quest.stageId];
 const fallback=MONSTER_CATALOG.filter(m=>m&&m.id).map(m=>m.id);
 const offset=(stage.number*3+(quest.kind==='recon'?9:0))%Math.max(1,fallback.length);
 const monsters=stage.monsters?.length?[...stage.monsters]:[fallback[offset],fallback[(offset+3)%fallback.length]].filter(Boolean);
 return {
  sideQuestId:quest.id,sideQuestChoice:pending.choice,
  stageKind:'explore',winCondition:'敵の魔物を全滅させ、任意依頼を達成',
  enemyMode:'monsters',enemyMonsterIds:monsters,
  enemyName:quest.kind==='escort'?'街道の襲撃魔物':'遺跡周辺の魔物',
  enemyCount:Math.min(20,Math.max(6,stage.chapter*2+stage.slot+(quest.kind==='escort'?4:1))),
  territoryName:stage.name+'：'+quest.title
 };
}
export function verifyTavernQuestBattle(game,request){
 const id=request?.sideQuestId;
 if(!id)return null;
 const quest=tavernQuestById(game,id),pending=game.pendingTavernQuest;
 if(!quest||quest.completed||!pending||pending.id!==id||pending.stageId!==request.stageId
  ||pending.battleId!==request.battleId||pending.choice!==request.sideQuestChoice
  ||request.enemyMode!=='monsters'||request.stageKind!=='explore')
  throw Error('任意依頼の戦闘記録を照合できません。');
 return quest;
}
export function tavernQuestBattleReward(request){
 const stage=CAMPAIGN_STAGE_BY_ID[request?.stageId];
 if(!stage||!validId(request?.sideQuestId)||!stage.id.startsWith(request.sideQuestId.slice(0,7)))
  throw Error('任意依頼の報酬情報が正しくありません。');
 const troops=Array.isArray(request.units)?request.units.length:0;
 const gold=35+stage.chapter*15+stage.slot*7+(request.sideQuestChoice===1?Math.min(35,Math.floor(troops/10)):0);
 return {gold,xp:18+stage.chapter*5+stage.slot*2};
}
export function settleTavernQuestBattle(game,request,result){
 const quest=verifyTavernQuestBattle(game,request);
 if(!quest)throw Error('任意依頼の出撃情報がありません。');
 if(result.victory&&result.monstersRemaining!==0)
  throw Error('依頼先の魔物を討伐できていません。');
 delete game.pendingTavernQuest;
 if(!result.victory)return {quest,completed:false,gold:0,xp:0};
 const {gold,xp}=tavernQuestBattleReward(request);
 game.tavernSideQuestDone??={};
 game.tavernSideQuestDone[quest.id]={completedAt:new Date().toISOString(),choice,gold,xp,battleId:request.battleId};
 game.wallet=(Number(game.wallet)||0)+gold;
 game.history??=[];
 game.history.unshift('酒場の戦闘依頼「'+quest.title+'」勝利。'+gold+'G・'+xp+'EXPを獲得。');
 game.history=game.history.slice(0,50);
 return {quest,completed:true,gold,xp};
}
