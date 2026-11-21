/** Optional tavern jobs: exactly two new one-time activities for every cleared battle stage. */
import {CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';
const SIDE_KINDS=Object.freeze([
 Object.freeze({id:'escort',title:'旅商人の護衛',description:'街道の脅威を警戒し、物資を目的地まで届ける。',choices:['隊列を固めて護衛','先行して道を確保']}),
 Object.freeze({id:'recon',title:'遺跡と魔物の調査',description:'周辺の異変を調べ、町へ情報を持ち帰る。',choices:['慎重に痕跡を調査','遊撃隊で広域を探索']})
]);
export function tavernQuestStages(game){
 const done=Array.isArray(game?.completedStages)?game.completedStages:[];
 return done.map(id=>CAMPAIGN_STAGE_BY_ID[id]).filter(stage=>stage&&stage.kind!=='town')
  .map(stage=>({stage,quests:SIDE_KINDS.map(kind=>({
   id:stage.id+'-'+kind.id,stageId:stage.id,title:kind.title,description:kind.description,choices:kind.choices,
   completed:Boolean(game.tavernSideQuestDone?.[stage.id+'-'+kind.id])
  }))}));
}
export function runTavernSideQuest(game,id,choice){
 if(game?.location!=='town')throw Error('酒場にいるときに依頼を遂行してください。');
 const group=tavernQuestStages(game);
 const quest=group.flatMap(x=>x.quests).find(q=>q.id===id);
 if(!quest)throw Error('この依頼は対象ステージをクリアすると解放されます。');
 if(quest.completed)throw Error('この依頼の報酬は受取済みです。');
 if(![0,1].includes(choice))throw Error('依頼の進め方を選択してください。');
 const troops=game.campaign?.squads?.reduce((n,s)=>n+Math.max(0,Number(s.count)||0),0)||0;
 if(!troops)throw Error('依頼に出す隊員がいません。宿屋で仲間を編成してください。');
 const stage=CAMPAIGN_STAGE_BY_ID[quest.stageId];
 const base=35+stage.chapter*15+stage.slot*7;
 const bonus=choice===1?Math.min(35,Math.floor(troops/10)):0;
 const gold=base+bonus;
 game.wallet=(Number(game.wallet)||0)+gold;
 game.tavernSideQuestDone??={};
 game.tavernSideQuestDone[quest.id]={completedAt:new Date().toISOString(),choice,gold};
 game.history??=[];
 game.history.unshift('酒場の任意依頼「'+quest.title+'」を達成。'+gold+'Gを獲得。');
 game.history=game.history.slice(0,50);
 return {quest,gold,message:choice===0?'安全に依頼を終え、町から感謝された。':'迅速に行動し、追加の謝礼を受け取った。'};
}
