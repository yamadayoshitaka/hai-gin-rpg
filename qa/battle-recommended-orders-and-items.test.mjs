import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recommendBattleTactics} from '../src/battle-quick-recommendation.js';

const soldier=(id,hp=100,maxHp=100,jobId='fighter',alive=true)=>({
 id,team:0,squadId:'1',hp,maxHp,jobId,alive
});
const ten=Array.from({length:10},(_,id)=>soldier(id));
const available=[{itemId:'war_banner',quantity:1},{itemId:'aegis_seal',quantity:1},
 {itemId:'wind_scroll',quantity:1},{itemId:'healing_potion',quantity:2}];
const full=recommendBattleTactics(ten,available);
assert.equal(full.order,'charge','Healthy frontline squads are advised to advance');
assert.equal(full.itemId,'war_banner','Recommend only actually owned strength items');
assert.match(full.itemReason,/勇猛の軍旗/);

const fragile=ten.map(u=>({...u,hp:25}));
const damaged=recommendBattleTactics(fragile,available);
assert.equal(damaged.order,'defend','Low HP triggers defensive order');
assert.equal(damaged.itemId,'healing_potion','Wounded squad gets available heal item');
assert.equal(recommendBattleTactics(ten,[{itemId:'healing_potion',quantity:0}]).itemId,null,
 'Never recommend out-of-stock items');
const desperate=ten.map((u,i)=>({...u,alive:i<3,hp:i<3?100:0}));
const retreat=recommendBattleTactics(desperate,available);
assert.equal(retreat.order,'retreat','Squad below 35% recommends retreat');
assert.equal(retreat.itemId,'wind_scroll','Retreating squad benefits from available speed item');
assert.equal(recommendBattleTactics(ten,available,{activeBuffIds:['war_banner']}).itemId,
 'wind_scroll','Do not recommend a currently active duplicate effect');
assert.equal(recommendBattleTactics([],available).itemId,null,'No item without survivors');

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/function allyItemStocks\(\)/);
assert.match(battle,/roomItemRegistry\.owned\(\)\.filter\(stack=>stack\.quantity>0/);
assert.match(battle,/function useSquadBattleItem\(itemId,squadId\)/);
assert.match(battle,/function openBattleItemsForSquad\(id\)/);
assert.match(battle,/id='battleItemsChoice'/);
assert.match(battle,/id='battleItemsSquad'/);
assert.match(battle,/id='battleItemsUseSquad'/);
assert.match(battle,/add\('★ 推奨：'/,'Recommended order is on the command page');
assert.match(battle,/add\(kind\?'★ 推奨アイテム：'/,'Recommended item is on the separate items page');
assert.match(battle,/useSquadBattleItem\(advice\.itemId,id\)/);
assert.match(battle,/openBattleItemsForSquad\(id\)/);
assert.doesNotMatch(battle,/各部屋の配置・取得状況/);
console.log('PASS actionable recommended order/items with inventory stock, compact item -> squad -> use UI');
