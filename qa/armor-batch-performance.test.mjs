import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const THREE=await import('three').catch(()=>null);
const code=readFileSync(new URL('../src/character-system/armor-batch-runtime.js',import.meta.url),'utf8');
assert.ok(code.includes('mergeGeometries(geometries,false)'),
 'Preserve native geometry rather than generate low-resolution armor proxies');
assert.ok(code.includes('mesh.parent.uuid,mesh.material.uuid'),
 'Only meshes with the same joint and photographic material may be merged');
if(!THREE){
 console.log('PASS armor batching geometry/material contract (standalone Node without WebGL dependencies)');
}else{
 const {consolidateBattleArmor}=await import('../src/character-system/armor-batch-runtime.js');

// An actual six-joint-style outfit keeps every steel facet. Only draw calls
// are consolidated; texture, normals, colors and limb coordinates are stable.
const leftThigh=new THREE.Bone(),rightThigh=new THREE.Bone();
leftThigh.name='thigh_l';rightThigh.name='thigh_r';
const silver=new THREE.MeshStandardMaterial({color:0xb8ccdf,roughness:.38});
const source=[];
for(const [bone,side] of [[leftThigh,'l'],[rightThigh,'r']]){
 for(let i=0;i<4;i++){
  const geometry=new THREE.SphereGeometry(.16,16,8);
  const mesh=new THREE.Mesh(geometry,silver);
  mesh.position.set((side==='l'?-1:1)*.03,i*.16,i*.012);
  mesh.updateMatrix();bone.add(mesh);
  mesh.name='thigh-plate-'+side+'-'+i;
  mesh.userData={equipmentSlot:'thigh',equipmentClass:'armor',ownsGeometry:true};
  source.push(mesh);
 }
}
const beforeTriangles=source.reduce((n,m)=>n+m.geometry.index.count/3,0);
const boundsBefore=[leftThigh,rightThigh].map(b=>new THREE.Box3().setFromObject(b));
const armor={objects:source,diagnostics:{}};
const result=consolidateBattleArmor(armor);
assert.equal(result.sourcePieces,8);
assert.equal(result.drawPieces,2);
assert.equal(result.mergedPieces,6);
assert.equal(armor.diagnostics.originalArmorPieces,8);
assert.equal(armor.diagnostics.armorPieces,2);
assert.equal(armor.diagnostics.consolidatedArmorPieces,6);
assert.ok(armor.objects.every(m=>m.parent?.isBone),
 'Consolidated armor stays attached to the original animated joint');
assert.ok(armor.objects.every(m=>m.material===silver),
 'The exact photographic material is preserved; no proxy material');
assert.equal(armor.objects.reduce((n,m)=>n+m.geometry.index.count/3,0),beforeTriangles,
 'No original armor triangles may be deleted or approximated');
for(const [i,bone] of [leftThigh,rightThigh].entries()){
 const boundsAfter=new THREE.Box3().setFromObject(bone);
 assert.ok(boundsAfter.min.distanceTo(boundsBefore[i].min)<.00001);
 assert.ok(boundsAfter.max.distanceTo(boundsBefore[i].max)<.00001);
}
// Equipment independently follows each leg: no accidental cross-leg merge.
assert.notEqual(armor.objects[0].parent,armor.objects[1].parent);
console.log('PASS identical PBR geometry, joint anchors and bounds after 8-to-2 armor draw consolidation');

}
