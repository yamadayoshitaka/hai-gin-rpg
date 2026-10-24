import {createCarpetTileData,CARPET_TILE_PART} from '../src/carpet-module-data.js';
import {MATERIAL_CATALOG,validateMaterialReferences} from '../src/material-catalog.js';
import assert from 'node:assert/strict';
import {PART_CATALOG,OBJECT_BOMS,resolveBom,validateBomCatalog} from '../src/bom-catalog.js';
import {STARTER_TOWN} from '../src/starter-town.js';
import {getBuildingLayouts} from '../src/interior-scenes.js';
import {createInteriorAreaGraph,AreaPortalSystem} from '../src/interior-areas.js';
assert.deepEqual(validateBomCatalog(),[]);
assert.deepEqual(validateMaterialReferences(PART_CATALOG),[]);
for(const [id,material] of Object.entries(MATERIAL_CATALOG))assert.ok(material.color>=0&&material.roughness>=0&&material.roughness<=1,id);
for(const [id,item] of Object.entries(PART_CATALOG))assert.ok(item.size.every(n=>n>0),id);
const graph=createInteriorAreaGraph(STARTER_TOWN.buildings,getBuildingLayouts);
const portals=new AreaPortalSystem();
for(const building of STARTER_TOWN.buildings){
 for(const floor of [1,2]){
  const area=graph.areas[building.id+':floor:'+floor];
  assert.ok(area);
  const stairs=area.portals.filter(p=>p.role==='stairs');
  assert.equal(stairs.length,1);
  assert.equal(stairs[0].direction,floor===1?'up':'down');
  const result=portals.execute({graph,currentAreaId:area.id,portalId:stairs[0].id});
  assert.equal(graph.areas[result.to].portals.find(p=>p.id===result.targetObjectId).targetObjectId,stairs[0].id);
  for(const l of area.layouts)for(const object of l.objects){
   if(OBJECT_BOMS[object.model])assert.ok(resolveBom(object.model).parts.length>0);
  }
 }
}
for(const building of STARTER_TOWN.buildings){
 for(const layout of getBuildingLayouts(building)){
  for(const object of layout.objects){
   assert.ok(object.model==='carpet'||OBJECT_BOMS[object.model],building.id+':'+object.id+' missing object BOM');
  }
 }
}
const rug=createCarpetTileData({id:'rug-test',width:6,depth:4.9});
assert.equal(rug.length,24);
assert.ok(rug.every(t=>t.partId===CARPET_TILE_PART.id&&t.collision===false));
console.log('BOM catalog, complete interior coverage and bidirectional area portals verified');
