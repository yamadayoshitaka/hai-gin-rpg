import assert from 'node:assert/strict';
import {STARTER_TOWN,resolveTownBuilding} from '../src/starter-town.js';
import {exteriorLayout} from '../src/exterior-layouts.js';
import {createFacadePanelData,FACADE_PARTS} from '../src/exterior-panel-data.js';
import {PART_CATALOG,OBJECT_BOMS,resolveBom,validateBomCatalog} from '../src/bom-catalog.js';
assert.deepEqual(validateBomCatalog(),[]);
for(const b of STARTER_TOWN.buildings){
 const def=resolveTownBuilding(b),layout=exteriorLayout(def);
 const body=layout.objects.find(o=>o.id==='body');
 assert.ok(body);
 const panels=createFacadePanelData({id:b.id,width:body.size[0],height:body.size[1],depth:body.size[2],material:body.material});
 assert.ok(panels.length>0,b.id);
 assert.equal(new Set(panels.map(x=>x.id)).size,panels.length,b.id);
 for(const panel of panels){
  assert.deepEqual(panel.size,FACADE_PARTS[panel.partId].size);
  assert.ok(panel.position.every(Number.isFinite));
  assert.equal(panel.materialId,body.material);
 }
 for(const entry of layout.objects)if(['window','door','sign'].includes(entry.type))assert.ok(Array.isArray(entry.position));
}
for(const bom of Object.values(OBJECT_BOMS))if(bom.parts)for(const p of bom.parts)assert.ok(PART_CATALOG[p.partId]);
for(const name of ['table_low','bed_single_A','counter','throne','window-ornament','door-ornament','shop-ornament'])assert.ok(resolveBom(name).parts.length);
console.log('Exterior and furniture BOM catalog and native-size placements verified');
