import assert from 'node:assert/strict';
import { STARTER_TOWN,composeBuildingLayouts } from '../src/starter-town.js';
import { INTERIOR_SCENES,getBuildingLayouts } from '../src/interior-scenes.js';
import { resolveEntityRoles } from '../src/entity-roles.js';
import { areaAsTree,createRecordFactory } from '../src/component-factory.js';
import { createAreaBlueprint,validateBlueprint } from '../src/world-blueprints.js';
import { EntityDataSystem } from '../src/data-systems.js';
assert.equal(Object.keys(INTERIOR_SCENES).length,STARTER_TOWN.buildings.length);
const buildings=STARTER_TOWN.buildings.map((building,i)=>{
 const layouts=getBuildingLayouts(building);
 const compiled=composeBuildingLayouts({...building,layouts});
 assert.ok(compiled.layouts.length>=2,building.id);
 assert.ok(compiled.layouts.some(l=>l.floor===1));
 assert.ok(compiled.layouts.some(l=>l.floor===2));
 assert.ok(compiled.layouts.every(l=>l.objects.every(o=>o.id&&o.model&&o.roles&&o.actions)));
 const ids=new Set();
 for(const l of compiled.layouts)for(const o of l.objects){
  const key=l.id+':'+o.id;
  assert.ok(!ids.has(key),'duplicate object '+building.id+':'+key);
  ids.add(key);
 }
 return {id:i,kind:building.kind,position:[i*80,0,0],layouts:compiled.layouts};
});
const castle=buildings[11];
assert.ok(castle.layouts.some(l=>l.id==='throne-hall'&&l.objects.some(o=>o.model==='throne')));
const tavern=buildings[8];
assert.ok(tavern.layouts.some(l=>l.objects.some(o=>o.model==='piano')));
const area=createAreaBlueprint({id:'test-town',buildings});
assert.deepEqual(validateBlueprint(area),[]);
const tree=areaAsTree(area);
const root=createRecordFactory().instantiate(tree);
assert.ok(root.children[11].children.some(x=>x.type==='layout'));
assert.ok(root.children[11].children.some(x=>x.children.some(y=>y.type==='furniture')));
const door=resolveEntityRoles({id:'portal',type:'door',roles:['openable','lockable'],state:{open:false}});
const result=new EntityDataSystem().execute({definitions:{portal:door},state:{},commands:[{entityId:'portal',action:'toggle'}]});
assert.equal(result.state.portal.open,true);
assert.equal(result.state.portal.locked,false);
console.log('Building -> layout -> object/role tests passed');
