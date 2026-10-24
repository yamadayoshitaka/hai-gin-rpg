import assert from 'node:assert/strict';
import {PART_CATALOG,OBJECT_BOMS,PHYSICAL_PART_CATALOG,partMassKg,resolvePhysicalBom,validatePhysicalCatalog} from '../src/bom-catalog.js';
import {STARTER_TOWN,resolveTownBuilding,composeBuildingLayouts} from '../src/starter-town.js';
import {getBuildingLayouts} from '../src/interior-scenes.js';
import {HUMAN_JOINT_BOM,validateJointBom} from '../src/human-bom.js';
assert.deepEqual(validatePhysicalCatalog(),[]);
assert.equal(Object.keys(PHYSICAL_PART_CATALOG).length,Object.keys(PART_CATALOG).length);
assert.equal(validateJointBom(),true);
assert.ok(Object.keys(HUMAN_JOINT_BOM).length>=65);
for(const id of Object.keys(OBJECT_BOMS)){
 const assy=resolvePhysicalBom(id);
 assert.ok(Number.isFinite(assy.massKg)&&assy.massKg>0,id);
 assert.ok(assy.parts.every(x=>x.massKg>0),id);
}
for(const building of STARTER_TOWN.buildings){
 const exterior=resolveTownBuilding(building);
 const interior=composeBuildingLayouts({...building,layouts:getBuildingLayouts(building)});
 assert.equal(exterior.id,interior.id,building.id);
 assert.ok(interior.layouts.length>0,building.id);
 for(const layout of interior.layouts){
  for(const obj of layout.objects){
   if(!obj.model||obj.model==='carpet')continue;
   assert.ok(OBJECT_BOMS[obj.model],building.id+':'+obj.model);
  }
 }
}
console.log('Physical assembly mass, human joint references and every town building interior validated');
