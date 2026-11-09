import {exteriorLayout} from '../src/exterior-layouts.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {STARTER_TOWN,composeBuildingLayouts} from '../src/starter-town.js';
import {getBuildingLayouts} from '../src/interior-scenes.js';
import {createAreaBlueprint,validateBlueprint} from '../src/world-blueprints.js';
import {areaAsTree,createRecordFactory} from '../src/component-factory.js';
import {resolveEntityRoles} from '../src/entity-roles.js';
import {EntityDataSystem} from '../src/data-systems.js';

const buildings=STARTER_TOWN.buildings.map((source,index)=>{
 const building=composeBuildingLayouts({...source,layouts:getBuildingLayouts(source)});
 assert.equal(building.type,'building');
 assert.ok(building.layouts.length>0);
 assert.ok(building.layouts.every(layout=>Array.isArray(layout.objects)));
 return {id:source.id,kind:source.kind,position:[index*80,0,0],layouts:building.layouts};
});
const area=createAreaBlueprint({id:STARTER_TOWN.id,buildings});
assert.deepEqual(validateBlueprint(area),[]);
const instances=new Map();
const root=createRecordFactory().instantiate(areaAsTree(area),{instances});
assert.equal(root.type,'area');
assert.ok([...instances.values()].some(node=>node.type==='layout'));
assert.ok([...instances.values()].some(node=>node.type==='chest'));
const door=resolveEntityRoles({id:'entrance',type:'door',roles:['openable'],state:{open:false}});
const result=new EntityDataSystem().execute({definitions:{entrance:door},commands:[{entityId:'entrance',action:'toggle'}]});
assert.equal(result.state.entrance.open,true);
assert.equal(door.state.open,false);
console.log('Data-driven architecture contract passed');

const runtimeSource=fs.readFileSync('src/game-runtime.js','utf8');
const compositionStart=runtimeSource.indexOf('const activeAreaBlueprint=');
const npcInitialization=runtimeSource.indexOf('const npcs=[]');
assert.ok(compositionStart>=0&&npcInitialization>compositionStart);
assert.ok(!runtimeSource.slice(compositionStart,runtimeSource.indexOf('const componentFactory=',compositionStart)).includes('npcs.map('),'Initial area composition must not access runtime NPCs before initialization');

const authoredRenderer=runtimeSource.indexOf('createDataInterior(room,design)');
const authoredSwitch=runtimeSource.indexOf('if(design.layouts?.length)return this.createDataInterior(room,design)');
assert.ok(authoredRenderer>=0&&authoredSwitch>authoredRenderer,'Authored building layouts must use the data interior renderer');
assert.ok(runtimeSource.includes("room.userData.interiorLayoutSource='building-data'"));

for(const building of STARTER_TOWN.buildings){
 const layout=exteriorLayout(building);
 assert.ok(layout.objects.some(o=>o.type==='door'));
 assert.equal(layout.objects.filter(o=>o.type==='roof-slope').length,2);
 assert.ok(layout.objects.every(o=>o.id&&o.type&&o.material));
}
assert.ok(exteriorLayout(STARTER_TOWN.buildings[11]).objects.some(o=>o.type==='tower'));
assert.ok(runtimeSource.includes('renderExterior({THREE,scene,building:definition,layout,obstacle})'));
assert.ok(!runtimeSource.includes('house(...structures[i]'),'Old outdoor house renderer must not instantiate city buildings');

// The live entry point is the chapter/story front end, while combat remains
// explicitly versioned. Do not revert the newer title to satisfy legacy QA.
const entrySource=fs.readFileSync('index.html','utf8');
const gameSource=fs.readFileSync('game.html','utf8');
const tacticalSource=fs.readFileSync('tactics-wireframe.html','utf8');
const runtimeVersion=tacticalSource.match(/version:'(\d+\.\d+(?:\.\d+)?)'/)?.[1];
assert.match(entrySource,/game\.html/,'The root must navigate to the current game front end');
assert.match(gameSource,/灰銀戦記/,'The current story title is retained');
assert.ok(runtimeVersion,'The tactical battle must expose its version');
assert.match(tacticalSource,/リアルタイム軍団戦 v\d+\.\d+\.\d+/,'Battle title advertises the runtime version');
