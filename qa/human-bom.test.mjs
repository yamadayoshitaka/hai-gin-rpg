import fs from 'node:fs';
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
for(const detail of ['nose','ear','brow','mouth'])assert.ok(HUMAN_PARTS[detail],detail+' must be a catalogued facial component');
assert.throws(()=>expandHumanBom('missing'),/Unknown humanoid BOM/);
const runtime=fs.readFileSync('src/game-runtime.js','utf8');
assert.ok(runtime.includes("source:player.userData.visualAssy?'skinned-glb-assy':'fallback-human-bom'"),'Visual skin assembly must fall back to human BOM');
assert.ok(runtime.includes("cloneRig(src.scene)"),'Skinned 3D models must be cloned safely');
assert.ok(runtime.includes("entry.host.userData.chibi.root.visible=false"),'Hide primitive doll after successful skin load');
assert.ok(!runtime.includes("const factor=(definition?.model?.scaleHeight??2.35)"),'Old oversized GLB model scaling must be removed');
console.log('All human BOM silhouettes, component IDs, meter heights and material links verified');
