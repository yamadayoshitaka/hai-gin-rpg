import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {
 DEPLOYMENT_CAPACITY,slotLane,slotRank,resolvedSquadDeployment,
 moveSquadDeployment,deploymentForSquad
} from '../src/inn-deployment.js';
import {TACTICAL_ORDERS,TACTICAL_STRATEGIES,orderEffect,strategyEffect} from '../src/tactical-command-descriptions.js';
import {createNewGame} from '../src/game-core-flow.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';

assert.equal(DEPLOYMENT_CAPACITY,12);
assert.deepEqual([slotLane(0),slotLane(1),slotLane(2)],['north','center','south']);
assert.deepEqual([slotRank(0),slotRank(4),slotRank(11)],[0,1,3]);
const squads=[
 {id:1,job:'騎士',rarity:'N',count:30,equipment:{weapon:'iron_sword'}},
 {id:2,job:'僧侶',rarity:'R',count:10},
 {id:3,job:'忍者',rarity:'UR',count:5}
];
let positions=resolvedSquadDeployment(squads);
assert.deepEqual([...positions.values()],[0,1,2]);
assert.ok(moveSquadDeployment(squads,1,11));
positions=resolvedSquadDeployment(squads);
assert.equal(positions.get('1'),11);
assert.equal(positions.get('2'),1);
assert.ok(moveSquadDeployment(squads,2,11));
positions=resolvedSquadDeployment(squads);
assert.equal(positions.get('1'),1,'occupied cells swap; no unit is discarded');
assert.equal(positions.get('2'),11);
assert.equal(squads[0].count,30,'moving does not edit unit count');
assert.equal(squads[0].equipment.weapon,'iron_sword','gear persists');
assert.equal(moveSquadDeployment(squads,2,50),false);
assert.equal(moveSquadDeployment(squads,404,2),false);
assert.equal(moveSquadDeployment(squads,1,1),false);
assert.equal(deploymentForSquad(squads[1],1,squads),11);

const game=createNewGame('配置テスト');
game.location='map';
game.campaign.squads[0].deploymentSlot=8; // south, rear-middle
game.campaign.squads[1].deploymentSlot=9; // north, command position
const request=makeCoreBattleRequest(game,'c01-s02','deployment-test-20261112');
const knight=request.units.filter(u=>u.sourceSquadId===1),priest=request.units.filter(u=>u.sourceSquadId===2);
assert.equal(knight.length,30);assert.equal(priest.length,10);
assert.ok(knight.every(u=>u.spawnLane==='south'&&u.spawnRank===2));
assert.ok(priest.every(u=>u.spawnLane==='south'&&u.spawnRank===2));
assert.deepEqual(new Set(request.units.map(u=>u.deploymentSlot)),new Set([8]));
assert.equal(new Set(request.units.map(u=>u.squadId)).size,1,'one strategist controls mixed-job subgroups');

assert.match(strategyEffect('recovery'),/僧侶/);
assert.match(strategyEffect('environment_prepare'),/消火/);
assert.match(strategyEffect('objective'),/勝利目標/);
assert.match(orderEffect('charge'),/25%/);
assert.match(orderEffect('charge'),/30%/);
assert.match(orderEffect('defend'),/9〜24%/);
assert.match(orderEffect('hold'),/追加の数値強化なし/);
assert.equal(Object.keys(TACTICAL_ORDERS).length>=5,true);
assert.equal(Object.keys(TACTICAL_STRATEGIES).length,4);

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const inn=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/battle-ui-refinement.css',import.meta.url),'utf8');
assert.match(battle,/const cameraOverviewOffset=new THREE.Vector3\(310,Math.sqrt\(2\)\*310,310\)/);
assert.match(battle,/const commandFocus=squadCommandFocus\(id\)/);
assert.match(battle,/function returnToWholeBattlefield\(\)/);
assert.match(battle,/closeSquadTactics\(true\)/);
assert.match(battle,/closeSquadTactics\(Boolean\(accepted\)\)/);
assert.match(battle,/const stageRank=Math.max\(0,Math.min\(3,/);
assert.match(battle,/effectLabel.textContent=orderEffect\(orderSelect.value\)/);
assert.match(inn,/placeCommander\(game.campaign,innDeploymentSelected,slot\)/);
assert.match(inn,/renderInnDeploymentBoard\(\)/);
assert.match(inn,/renderInnStrategies\(\)/);
assert.match(style,/\.innDeploymentBoard/);
assert.match(style,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
for(const [name,content] of [['battle',battle],['inn',inn]]){
 const modules=[...content.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.ok(modules.length,name+' lacks inline module');
 new SourceTextModule(modules.at(-1)[1],{identifier:name});
}
console.log('Tactical v2.3: commander camera, 45deg overview, formation save/spawn, effects PASS');
