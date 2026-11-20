import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {
 japaneseBattleObjectName,eligibleEnemyBattleTargets,battleAttackNeedsEnemy
} from '../src/battle-target-japanese-flow.js';
import {battleJobSpecialActions} from '../src/battle-job-special-actions.js';

const commands=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');

test('object names use Japanese labels instead of internal English identifiers',()=>{
 for(const [input,expected] of Object.entries({
  bridge:'橋',building:'建物',manor_noble:'領主の館',horse:'馬',door:'扉',
  wood_bridge:'木橋',castle:'城',house:'民家'
 }))assert.equal(japaneseBattleObjectName(input),expected);
 assert.equal(japaneseBattleObjectName('商店'),'商店');
 assert.equal(japaneseBattleObjectName('unknown_engine_thing'),'設備');
 assert.match(battle,/japaneseBattleObjectName\(obj\.name\|\|obj\.label/);
 assert.match(battle,/japaneseBattleObjectName\(b\.data\.name\|\|b\.data\.kind/);
 assert.match(battle,/japaneseBattleObjectName\(raw/);
});

test('attacks never list allies, dead enemies, distant raw objects or invalid coordinates',()=>{
 const enemies=eligibleEnemyBattleTargets([
  {id:'enemy1',team:1,squadId:'1',x:80,z:70},
  {id:'ally',team:0,squadId:'1',x:80,z:70},
  {id:'dead',team:1,squadId:'2',x:75,z:60,alive:false},
  {id:'structure',team:1,x:80,z:70},
  {id:'invalid',team:1,squadId:'4',x:NaN,z:70}
 ]);
 assert.deepEqual(enemies.map(e=>e.id),['enemy1']);
 assert.equal(battleAttackNeedsEnemy('near'),true);
 assert.equal(battleAttackNeedsEnemy('far'),true);
 assert.equal(battleAttackNeedsEnemy('intercept'),true);
 assert.equal(battleAttackNeedsEnemy('delay'),false);
 assert.match(battle,/kind==='enemies'&&unit\.team!==1/);
});

test('mobile UI reveals enemy choices only after skill, and confirmation rejects stale targets',()=>{
 assert.match(commands,/id="realtimeStrategyTargets" hidden/);
 assert.match(commands,/getMoveTargets\('enemies',String\(selectedId\)\)/);
 assert.match(commands,/eligibleEnemyBattleTargets\(/);
 assert.match(commands,/battleAttackNeedsEnemy\(pendingStrategy\?\.attackKind\)/);
 assert.match(commands,/current\.some\(t=>String\(t\.id\)===String\(destination\.id\)\)/);
 assert.match(commands,/\(mustPickEnemy&&!selectedMovementTarget\(\)\)/);
 assert.match(commands,/realtimeConfirmStrategy'\)\.onclick=confirmDockStrategy/);
 assert.doesNotMatch(commands,/<option value="people">/);
 assert.doesNotMatch(commands,/<option value="objects">/);
});

test('job-specific skills show only their own legal targets after selecting the skill',()=>{
 const archer=battleJobSpecialActions('弓使い');
 const shield=battleJobSpecialActions('盾騎士');
 assert.equal(archer[0].target,'height');
 assert.equal(shield[0].target,'ally');
 assert.match(commands,/getSpecialTargets\(String\(selectedId\),action\.id\)/);
 assert.match(commands,/pendingStrategy=\{special:action\.id,targetId:String\(target\.id\)\}/);
 assert.match(commands,/const valid=\(getSpecialTargets\(id,entry\.special\)\|\|\[\]\)\.some/);
 assert.match(commands,/let chosen=null,confirmButton=null/);
 assert.doesNotMatch(commands,/choose\(shown\[0\]\)/);
});
