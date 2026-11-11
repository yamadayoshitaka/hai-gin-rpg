import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 RARITY_WEIGHTS,squadPower,rarityWeight,tacticalCooldownSeconds,
 evaluateTacticalOrder,rankTacticalOrders,healthSituation,normalizeBattleJob
} from '../src/tactical-command-evaluation.js';

assert.deepEqual(RARITY_WEIGHTS,{N:1,R:1.5,UR:3});
assert.equal(squadPower([{count:40,rarity:'N'},{count:60,rarity:'R'}]),130);
assert.equal(squadPower([{count:5,rarity:'UR'},{count:2,rarity:'R'}]),18);
assert.equal(rarityWeight('unknown'),1);
assert.equal(normalizeBattleJob('剣士'),'knight');
assert.equal(normalizeBattleJob('盗賊'),'thief');
assert.equal(tacticalCooldownSeconds(1),120);
assert.equal(tacticalCooldownSeconds(50),80);
assert.equal(tacticalCooldownSeconds(99),40);
assert.equal(tacticalCooldownSeconds(900),40);
assert.equal(tacticalCooldownSeconds(-1),120);

const soldiers=[
 ...Array.from({length:60},()=>({rarity:'R',hp:100,job:'騎士'})),
 ...Array.from({length:40},()=>({rarity:'N',hp:100,job:'盾騎士'}))
];
const base=evaluateTacticalOrder({units:soldiers,mode:'charge',difficulty:50,localResistance:90});
assert.equal(base.power,130);
assert.equal(base.executionPower,142.5);
assert.equal(base.effect,74);
assert.equal(base.success,50);
const buff=evaluateTacticalOrder({units:soldiers,mode:'charge',difficulty:50,
 localResistance:90,commander:{specialty:'assault',specialtyBonusPt:10}});
assert.equal(buff.success,60);
const hard=evaluateTacticalOrder({units:[...soldiers,{rarity:'UR',hp:0,job:'忍者'}],mode:'charge',difficulty:50,localResistance:90});
assert.equal(hard.power,130);
assert.equal(evaluateTacticalOrder({units:[],mode:'charge'}).success,0);
assert.ok(evaluateTacticalOrder({units:soldiers,mode:'charge',localResistance:0}).success>base.success);
assert.ok(evaluateTacticalOrder({units:soldiers,mode:'charge',localResistance:200}).success<base.success);
assert.equal(rankTacticalOrders(null,{units:soldiers}).length,4);
assert.equal(healthSituation({n:90,total:100},{n:70,total:100}).title,'部隊の損耗が進行');
assert.equal(healthSituation({n:70,total:100},{n:49,total:100}).severity,'warning');
assert.equal(healthSituation({n:40,total:100},{n:24,total:100}).severity,'critical');
assert.equal(healthSituation({n:50,total:100},{n:55,total:100}),null);
assert.equal(healthSituation(null,{n:50,total:100}),null);

for(const file of ['town-hub.html','story-mode.html','tactics-wireframe.html']){
 const markup=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 assert.ok(markup.includes('tactical-command-ui.css'),file+' missing common styling');
 assert.ok(markup.includes('tactical-command-evaluation.js')||
  markup.includes('tactical-command-battle-ui.js'),file+' missing tactical evaluation');
}
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/battleTacticalUi\.onSquadSums\(sums\)/);
assert.match(battle,/battleTacticalUi\.renderFor\(id\)/);
assert.match(battle,/commanderOrderInterval\(id\)-elapsed/);
assert.match(battle,/openingTacticalSummary\.refresh\(\)/);
const inn=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
assert.match(inn,/innSpecialtySelect/);
assert.match(inn,/autoFormArmy\(game\.campaign,innCommanderId,armyPriority\)/);
console.log('tactical-command-ui v2.1: calculations and 3 screen contracts OK');
