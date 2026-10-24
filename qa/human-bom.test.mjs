import assert from 'node:assert/strict';
import {HUMAN_PARTS,HUMAN_BOMS,expandHumanBom} from '../src/human-bom.js';
import {MATERIAL_CATALOG} from '../src/material-catalog.js';
for(const [name,recipe] of Object.entries(HUMAN_BOMS)){
 const bom=expandHumanBom(name);
 assert.ok(bom.height>=1.5&&bom.height<=1.9,name+' plausible physical height');
 assert.ok(bom.parts.length>=15,name+' component coverage');
 assert.equal(new Set(bom.parts.map(x=>x.id)).size,bom.parts.length);
 for(const component of bom.parts){
  const part=HUMAN_PARTS[component.partId];
  assert.ok(part&&part.size.every(n=>n>0));
  assert.ok(MATERIAL_CATALOG[component.materialId??part.material],component.partId+' material');
  assert.ok(['body','legLeft','legRight','armLeft','armRight'].includes(component.attach));
 }
 assert.equal(bom.parts.filter(x=>x.partId==='head').length,1);
 assert.equal(bom.parts.filter(x=>x.partId==='boot').length,2);
}
assert.throws(()=>expandHumanBom('missing'),/Unknown humanoid BOM/);
console.log('All human BOM silhouettes, component IDs, meter heights and material links verified');
