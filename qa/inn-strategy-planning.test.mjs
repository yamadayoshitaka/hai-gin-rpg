import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame,saveAtTown,loadGame,leaveTown} from '../src/game-core-flow.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {TACTICAL_STRATEGIES} from '../src/tactical-command-descriptions.js';
import {
 INN_TEMPLATE_LIMIT,innStrategyTemplates,activeInnStrategyTemplate,registerInnStrategyTemplate,
 selectInnStrategyTemplate,deleteInnStrategyTemplate,setInnCommanderInitialOrder,innSquadInitialOrder
} from '../src/inn-strategy-templates.js';

const game=createNewGame('宿屋UIテスト');
assert.equal(INN_TEMPLATE_LIMIT,20);
assert.deepEqual(innStrategyTemplates(game),[]);
const fields={
 name:'中央橋の防衛',strategy:'recovery',victoryCondition:'防衛時間の終了まで拠点を守る',
 route:'中央の橋',situation:'騎兵が突破',allyResponse:'盾騎士で塞ぐ',
 allyJob:'盾騎士',enemyCounter:'魔法で橋を攻撃',allyReResponse:'忍者が詠唱を妨害'
};
const plan=registerInnStrategyTemplate(game,fields);
assert.equal(activeInnStrategyTemplate(game).id,plan.id);
assert.equal(plan.victoryCondition,fields.victoryCondition);
assert.equal(plan.enemyCounter,fields.enemyCounter);
assert.equal(plan.allyReResponse,fields.allyReResponse);
assert.throws(()=>registerInnStrategyTemplate(game,{name:'',strategy:'recovery',victoryCondition:'防衛',route:'橋'}),/作戦名/);
assert.throws(()=>registerInnStrategyTemplate(game,{name:'不正',strategy:'missing',victoryCondition:'防衛',route:'橋'}),/種類/);
const second=registerInnStrategyTemplate(game,{...fields,name:'別ルート',strategy:'objective'});
assert.equal(selectInnStrategyTemplate(game,plan.id).id,plan.id);
assert.equal(deleteInnStrategyTemplate(game,second.id),true);
assert.equal(deleteInnStrategyTemplate(game,second.id),false);
assert.equal(activeInnStrategyTemplate(game).id,plan.id);
assert.equal(innSquadInitialOrder(game,'player'),'charge');
assert.equal(setInnCommanderInitialOrder(game,'player','defend'),'defend');
assert.equal(innSquadInitialOrder(game,'player'),'defend');
assert.throws(()=>setInnCommanderInitialOrder(game,'missing','charge'),/軍師/);
assert.throws(()=>setInnCommanderInitialOrder(game,'player','explore'),/初期号令/);

const storage=()=>{const values=new Map();return {
 getItem:key=>values.has(key)?values.get(key):null,
 setItem:(key,val)=>values.set(key,String(val)),
 removeItem:key=>values.delete(key)
};};
const saves=storage(),session=storage();
saveAtTown(game,saves,session);
const restored=loadGame(saves,storage());
assert.equal(restored.innActiveStrategyTemplateId,plan.id);
assert.equal(restored.innCommanderInitialOrders.player,'defend');
leaveTown(restored);
const request=makeCoreBattleRequest(restored,'c01-s02','inn-template-qa');
assert.equal(request.tacticalTemplate.strategy,'recovery');
assert.equal(request.tacticalTemplate.name,'中央橋の防衛');
assert.ok(Object.values(request.initialSquadOrders).includes('defend'));
assert.ok(request.units.every(unit=>request.initialSquadOrders[String(unit.squadId)]==='defend'));
const inn=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(inn,/innPage='strategies'/);
assert.match(inn,/\[\['strategies','作戦'\],\['deployment','配置'\],\['overview','号令'\]/);
assert.match(inn,/pages\.deployment\.append\(commander,auto\)/);
assert.match(inn,/data-inn-template-save/);
assert.match(inn,/registerInnStrategyTemplate\(game/);
assert.match(inn,/setInnCommanderInitialOrder\(game/);
assert.match(battle,/const innStoryStrategy=storyRequest\?\.tacticalTemplate\?\.strategy/);
assert.match(battle,/storyRequest\?\.initialSquadOrders\?\.\[String\(id\)\]/);
assert.equal(Object.keys(TACTICAL_STRATEGIES).length,4);
for(const [name,markup] of [['inn',inn],['battle',battle]]){
 const modules=[...markup.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.ok(modules.length,name+' module was missing');
 new SourceTextModule(modules.at(-1)[1],{identifier:name});
}
console.log('Inn strategy templates, commander deployment, initial orders and sortie bridge PASS');
