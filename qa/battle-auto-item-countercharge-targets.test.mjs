import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseEnemyOrder} from '../src/battle-tactical-policy.js';
import {chooseAutoSquadItem} from '../src/battle-auto-item-policy.js';
import {recommendBattleTactics} from '../src/battle-quick-recommendation.js';

const soldier=(id,hp=100,x=0,z=0,team=1)=>({
 id,team,squadId:'1',jobId:'fighter',hp,maxHp:100,x,z,alive:hp>0
});
const squad=Array.from({length:5},(_,i)=>soldier(i,44,i,0));
const foe=Array.from({length:5},(_,i)=>soldier(10+i,40,13+i,0,0));
assert.equal(chooseEnemyOrder(squad,foe,'charge').mode,'defend',
 'An injured squad may enter defense to recover');
assert.equal(chooseEnemyOrder(squad,foe,'defend').mode,'charge',
 'A previously defending squad can countercharge at weakened enemies');
assert.equal(chooseEnemyOrder(squad.map(u=>({...u,hp:15})),foe,'defend').mode,'retreat',
 'Severely depleted squads should not be forced to charge');
assert.equal(chooseEnemyOrder(squad,[], 'defend').mode,'hold',
 'No target means no aimless charge');
const distant=foe.map(u=>({...u,x:u.x+100,hp:100}));
assert.equal(chooseEnemyOrder(squad,distant,'defend').mode,'defend',
 'A tired squad should not countercharge a distant healthy enemy');

const types={
 healing_potion:{kind:'heal',squadHealHp:200},
 war_banner:{kind:'squad_buff',attack:.2},
 aegis_seal:{kind:'squad_buff',defense:.2}
};
const stock=[{itemId:'healing_potion',quantity:1},{itemId:'war_banner',quantity:1}];
const full=squad.map(u=>({...u,hp:100}));
assert.equal(chooseAutoSquadItem(full,stock,types), 'war_banner');
assert.equal(chooseAutoSquadItem(squad,stock,types),'healing_potion',
 'Healing is prioritized when a squad is badly wounded');
assert.equal(chooseAutoSquadItem(full,stock,types,['war_banner']),null,
 'Do not waste stock to duplicate an active buff');
assert.equal(chooseAutoSquadItem(full,[{itemId:'war_banner',quantity:0}],types),null,
 'Only actual stock can be used automatically');
assert.equal(chooseAutoSquadItem([],stock,types),null,'Defeated squads cannot spend stock');
const healthyRanged=full.map(u=>({...u,team:0,jobId:'archer'}));
assert.equal(recommendBattleTactics(healthyRanged).order,'charge',
 'Healthy ranged squads should not always receive defensive recommendations');

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const code of [
 'const squadItemPolicies=new Map',
 "['manual','手動アイテム'],['auto','オートアイテム']",
 "itemMode.onchange=()=>{if(!battleReady)squadItemPolicies.set(id,itemMode.value);}",
 "if(squadItemPolicies.get(id)!=='auto')continue",
 "chooseAutoSquadItem(members,stocks,ROOM_ITEM_TYPES,activeIds)",
 "if(itemId&&performSquadBattleItem(itemId,id,{automatic:true}))",
 "document.body.dataset.circleTarget=kind==='attack'?'enemy':'ally'",
 "delete document.body.dataset.circleTarget",
 'targetSquadPulse'
])assert.ok(html.includes(code),'Missing battle wiring: '+code);
assert.match(html,/body\[data-circle-target\] \.squadScreenLabel\.eligible-target/);
assert.doesNotMatch(html,/body\[data-circle-target="ally"\] \.squadScreenLabel\.ally/,
 'Unselectable friendly squads must not blink');
assert.match(html,/lastAllyItemDecisionAt<10/,'Auto item decisions are globally rate-limited');
// The public two-argument manual call remains supported; an optional third
// issuer squad was added for cross-squad targeting and cooldown ownership.
// Check both backward compatibility and forwarding rather than freezing the
// implementation's parameter count.
assert.match(html,/function useSquadBattleItem\(itemId,squadId(?:,issuerSquadId=null)?\)/,
 'Legacy two-argument manual item calls must remain supported');
assert.match(html,/return performSquadBattleItem\(itemId,squadId,\{issuerSquadId\}\)/,
 'Manual item use must forward the optional issuing squad');
assert.match(html,/function performSquadBattleItem\(itemId,squadId,\{automatic=false,issuerSquadId=null\}=\{\}\)/,
 'Automatic item use must retain its own explicit options');
assert.match(html,/const id=String\(squadId\),commandSquad=String\(issuerSquadId\?\?squadId\)/,
 'Two-argument manual calls must default issuer to target squad');
console.log('PASS target-pulse, defensive countercharge, auto/manual finite items and combat UI wiring');
