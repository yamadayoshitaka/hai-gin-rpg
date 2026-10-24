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
