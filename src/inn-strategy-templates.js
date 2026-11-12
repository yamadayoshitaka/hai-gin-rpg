/**
 * Inn battle planning: saved templates are campaign/session data, not combat
 * orders. Applying a template chooses the starting strategy for the next sortie;
 * the battle still locks strategies as soon as combat starts.
 */
import {TACTICAL_STRATEGIES} from './tactical-command-descriptions.js';
export const INN_TEMPLATE_LIMIT=20;
export const INN_START_ORDERS=Object.freeze(['charge','defend','hold','retreat']);
const trim=(value,max=160)=>String(value??'').trim().slice(0,max);
export const innStrategyTemplates=game=>Array.isArray(game?.innStrategyTemplates)?game.innStrategyTemplates:[];
export function activeInnStrategyTemplate(game){
 const id=String(game?.innActiveStrategyTemplateId??'');
 return innStrategyTemplates(game).find(x=>String(x.id)===id)??null;
}
export function registerInnStrategyTemplate(game,fields){
 if(!game||typeof game!=='object')throw Error('ゲームデータが正しくありません。');
 const templates=innStrategyTemplates(game);
 if(templates.length>=INN_TEMPLATE_LIMIT)throw Error('作戦テンプレートは最大20件です。不要なものを削除してください。');
 const name=trim(fields?.name,32),strategy=trim(fields?.strategy,40);
 if(!name)throw Error('作戦名を入力してください。');
 if(!Object.hasOwn(TACTICAL_STRATEGIES,strategy))throw Error('作戦の種類を選択してください。');
 const victoryCondition=trim(fields?.victoryCondition,160);
 const route=trim(fields?.route,100);
 if(!victoryCondition||!route)throw Error('勝利条件と進軍・防衛ルートを入力してください。');
 let next=Number.isInteger(game.innNextTemplateId)&&game.innNextTemplateId>0?game.innNextTemplateId:1;
 while(templates.some(t=>String(t.id)==='inn-plan-'+next))next++;
 const template={
  id:'inn-plan-'+next,name,strategy,victoryCondition,route,
  situation:trim(fields?.situation),allyResponse:trim(fields?.allyResponse),
  allyJob:trim(fields?.allyJob,40),enemyCounter:trim(fields?.enemyCounter),
  allyReResponse:trim(fields?.allyReResponse)
 };
 game.innNextTemplateId=next+1;
 game.innStrategyTemplates=[...templates,template];
 game.innActiveStrategyTemplateId=template.id;
 return template;
}
export function selectInnStrategyTemplate(game,id){
 const template=innStrategyTemplates(game).find(t=>String(t.id)===String(id));
 if(!template)throw Error('登録済みテンプレートを選んでください。');
 game.innActiveStrategyTemplateId=template.id;
 return template;
}
export function deleteInnStrategyTemplate(game,id){
 const current=innStrategyTemplates(game),next=current.filter(t=>String(t.id)!==String(id));
 if(current.length===next.length)return false;
 game.innStrategyTemplates=next;
 if(String(game.innActiveStrategyTemplateId)===String(id))game.innActiveStrategyTemplateId=null;
 return true;
}
export function setInnCommanderInitialOrder(game,commanderId,order){
 if(!INN_START_ORDERS.includes(order))throw Error('初期号令を選択してください。');
 const leaders=['player',...(game?.campaign?.commanders??[]).map(c=>String(c.id))];
 if(!leaders.includes(String(commanderId)))throw Error('軍師を選択してください。');
 game.innCommanderInitialOrders??={};
 game.innCommanderInitialOrders[String(commanderId)]=order;
 return order;
}
export function innSquadInitialOrder(game,commanderId){
 const candidate=game?.innCommanderInitialOrders?.[String(commanderId)];
 return INN_START_ORDERS.includes(candidate)?candidate:'charge';
}
