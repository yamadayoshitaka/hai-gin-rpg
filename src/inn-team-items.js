/** Shared town stock is only reserved in inn loadouts, not consumed on assignment. */
import {TOWN_SHOP} from './game-core-flow.js';
import {ensureSortiePlan} from './three-team-sortie.js';
export const INN_CONSUMABLES=TOWN_SHOP.filter(item=>item.category==='道具');
export function teamItemStock(game,teamId,itemId){
 const plan=ensureSortiePlan(game),id=String(itemId);
 const owned=Math.max(0,Math.trunc(Number(game.inventory?.[id])||0));
 const assigned=plan.teams.filter(team=>team.id!==Number(teamId))
  .reduce((sum,team)=>sum+Math.max(0,Math.trunc(Number(team.items?.[id])||0)),0);
 const team=plan.teams.find(team=>team.id===Number(teamId));
 const current=Math.max(0,Math.trunc(Number(team?.items?.[id])||0));
 return {owned,assigned,current,available:Math.max(0,owned-assigned-current)};
}
export function setInnTeamItem(game,teamId,itemId,delta){
 if(game.location!=='town')throw Error('持参アイテムは宿屋で設定してください。');
 const item=INN_CONSUMABLES.find(entry=>entry.id===String(itemId));
 if(!item)throw Error('道具屋で扱うアイテムを選択してください。');
 const stock=teamItemStock(game,teamId,itemId);
 const team=game.sortiePlan.teams.find(entry=>entry.id===Number(teamId));
 if(!team)throw Error('第1〜3隊から選んでください。');
 const n=Number(delta);
 if(!Number.isInteger(n)||Math.abs(n)!==1)throw Error('個数を1個ずつ増減してください。');
 const next=stock.current+n;
 if(next<0||n>0&&stock.available<=0)throw Error('共有在庫が足りません。他隊の持参数も確認してください。');
 if(!team.items||typeof team.items!=='object')team.items={};
 if(next)team.items[item.id]=next;else delete team.items[item.id];
 return next;
}
export function innTeamItemsSummary(game,teamId){
 const team=ensureSortiePlan(game).teams.find(x=>x.id===Number(teamId));
 return INN_CONSUMABLES.filter(item=>Number(team?.items?.[item.id])>0)
  .map(item=>({id:item.id,name:item.name,quantity:team.items[item.id]}));
}
