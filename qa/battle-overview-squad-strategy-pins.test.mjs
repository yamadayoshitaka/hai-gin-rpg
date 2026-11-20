import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overviewPinLabel,placeOverviewSquadPins,recommendOverviewGroupPlans} from '../src/battle-overview-squad-pins.js';
import {BATTLE_PLAN_PRESETS} from '../src/battle-plan-recommendations.js';
import {STRATEGY_METHODS} from '../src/three-step-strategy-catalog.js';

assert.equal(overviewPinLabel({team:0,group:3,division:2,squadIndex:7}),'3-2');
assert.equal(overviewPinLabel({team:1,group:0,division:0,squadIndex:4}),'敵5');

const bounds={left:14,top:180,right:670,bottom:1110};
const points=Array.from({length:10},(_,i)=>({
 key:'0:'+i,team:0,squadIndex:i,x:310+(i%2)*4,y:580+(i%3)*5
})).concat(Array.from({length:10},(_,i)=>({
 key:'1:'+i,team:1,squadIndex:i,x:460+(i%2)*3,y:750+(i%3)*5
})));
const placed=placeOverviewSquadPins(points,bounds);
assert.equal(placed.size,20,'Every live 50v50 squad must have a marker');
for(const [key,p] of placed){
 assert.ok(p.x>=bounds.left+21&&p.x<=bounds.right-21,key+' within X safe region');
 assert.ok(p.y>=bounds.top+20&&p.y<=bounds.bottom-20,key+' within Y safe region');
 assert.ok(p.displaced||Math.hypot(p.x-p.anchorX,p.y-p.anchorY)<=8,
  'Every shifted badge must have a leader back to real troop coordinates');
}
assert.deepEqual([...placed],[...placeOverviewSquadPins(points,bounds)],
 'Stable pin coordinates prevent Android moving-target taps');
const empty=placeOverviewSquadPins([],{left:0,right:0,top:100,bottom:100});
assert.equal(empty.size,0);

const assault=recommendOverviewGroupPlans(BATTLE_PLAN_PRESETS,STRATEGY_METHODS,{
 jobs:['sword','sword','fighter'],stageKind:'explore',terrain:'plains'
});
assert.equal(assault[0].id,'assault','Melee squad should prefer concentrated assault');
assert.ok(assault[0].score>50,'Free battle recommendations cannot all be placeholder 50s');
const rescue=recommendOverviewGroupPlans(BATTLE_PLAN_PRESETS,STRATEGY_METHODS,{
 jobs:['priest','priest','summoner'],stageKind:'defend',terrain:'urban',woundedRatio:.7
});
assert.equal(rescue[0].id,'support','Wounded healers prioritize a restorative template');
assert.ok(rescue[0].score>assault.find(p=>p.id==='support').score);
assert.ok(!rescue.some(p=>p.score<0||p.score>100));

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const strategy=readFileSync(new URL('../src/targeted-strategy-runtime.js',import.meta.url),'utf8');
assert.match(battle,/id="overviewSquadHud" hidden/);
assert.match(battle,/overviewSquadActive\(\)/);
assert.match(battle,/overviewProjection\.copy\(marker\.position\)\.project\(camera\)/);
assert.match(battle,/placeOverviewSquadPins\(points,bounds/);
assert.match(battle,/updateOverviewSquadPins\(dt\)/);
assert.match(battle,/renderOverviewSquadInspector\(true\)/);
assert.match(battle,/node\.pin\.title=.*tap|tap-to-inspect|タップして作戦情報/s);
assert.match(battle,/#dockSquadSelect,#dockSquadOpen,#squadDockIdle\{display:none!important\}/);
assert.match(battle,/body\.compact-command-dock #allySquadRibbon,body\.compact-command-dock #enemySquadRibbon/);
assert.match(battle,/id="overviewDivisionSelect".*個別号令なし/);
assert.match(battle,/selectOverviewSquad\(0,event\.target\.value\)/);
assert.match(battle,/targetedStrategyUi\.open\(group,\{\s*startAtRecommendations:true,groupOnly:true/);
assert.match(battle,/recommendOverviewGroupPlans\(BATTLE_PLAN_PRESETS,STRATEGY_METHODS/);
assert.match(strategy,/function open\(id=null,\{squadId=null,groupOnly=false,startAtRecommendations=false\}=\{\}\)/);
assert.match(strategy,/step=startAtRecommendations\?'family':'scope'/);
assert.match(strategy,/overviewGroupOnly=true/);
assert.match(strategy,/scope='group';preferredSquad=null/);
assert.match(strategy,/if\(overviewGroupOnly&&step==='family'\)\{close\(\);return;\}/);
console.log('PASS: 20 visible world-centroid squad pins, tap-to-inspect, recommendation-first group orders, divisions selection only');
