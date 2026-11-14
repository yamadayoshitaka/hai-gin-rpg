import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cutFemaleSummonScalpUnderCover}
 from '../src/female-summon-scalp-cut.js';

// Synthetic skinned female Head with a face, ears and neck in ONE buffer.
// No destructive editing of the shared GLB geometry/material is permitted.
function donor(){
 const original=new THREE.SphereGeometry(1,40,28);
 original.scale(.133,.172,.140);original.translate(0,.084,0);
 const vertexCount=original.getAttribute('position').count,
  ids=new Uint16Array(vertexCount*4),
  weights=new Float32Array(vertexCount*4);
 for(let i=0;i<vertexCount;i++)weights[i*4]=1;
 original.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
 original.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 original.clearGroups();
 const triangleIndices=original.getIndex().count;
 const split=Math.floor(triangleIndices/6)*3;
 original.addGroup(0,split,0);
 original.addGroup(split,triangleIndices-split,1);
 const materials=[new THREE.MeshStandardMaterial(),new THREE.MeshStandardMaterial()];
 const skinned=new THREE.SkinnedMesh(original,materials);
 skinned.name='Superhero_Female_HeadAndFace';
 const head=new THREE.Bone();head.name='Head';skinned.add(head);
 skinned.bind(new THREE.Skeleton([head]));
 const model=new THREE.Group();model.add(skinned);
 const upright=new THREE.Group();head.add(upright);
 model.updateMatrixWorld(true);
 const scalp={center:[0,.084,0],radius:[.136,.174,.144],fitted:true};
 return {original,skinned,head,model,upright,scalp,materials};
}
for(const kind of ['wig','scales']){
 const d=donor(),oldIndex=Array.from(d.original.getIndex().array);
 const oldUV=d.original.getAttribute('uv'),oldMaterial=d.skinned.material;
 const initial=d.skinned.geometry;
 const cut=cutFemaleSummonScalpUnderCover({
  model:d.model,headBone:d.head,groomFrame:d.upright,
  scalp:d.scalp,kind
 });
 assert.ok(cut,kind+' failed to cut under wig/scales');
 assert.equal(cut.meshCount,1);
 assert.ok(cut.removedTriangles>15,'No crown triangles removed');
 assert.ok(cut.preservedTriangles>100,'Crown operation deleted face');
 assert.ok(cut.sourcePreserved);
 assert.notStrictEqual(d.skinned.geometry,initial);
 assert.strictEqual(d.skinned.material,oldMaterial);
 assert.equal(d.skinned.geometry.getAttribute('position').count,
  initial.getAttribute('position').count,
  'Keep the source skinned vertex and morph attribute layout');
 assert.equal(d.skinned.geometry.getAttribute('uv').count,oldUV.count);
 assert.equal(d.skinned.geometry.getAttribute('skinWeight').count,
  initial.getAttribute('skinWeight').count);
 assert.equal(d.skinned.geometry.groups.length,2,
  'Source material groups must be preserved, not recoloured');
 let i0=0;
 for(const group of d.skinned.geometry.groups){
  assert.equal(group.start,i0);
  assert.equal(group.count%3,0);
  i0+=group.count;
 }
 assert.equal(i0,d.skinned.geometry.getIndex().count);
 // Every triangle of the preserved lower face/neck must remain.
 const newTuples=new Set();
 const i=d.skinned.geometry.getIndex();
 for(let t=0;t<i.count;t+=3)
  newTuples.add([i.getX(t),i.getX(t+1),i.getX(t+2)].join(','));
 const originalPos=initial.getAttribute('position');
 const old=initial.getIndex();
 let protectedFace=0;
 for(let t=0;t<old.count;t+=3){
  const a=old.getX(t),b=old.getX(t+1),c=old.getX(t+2);
  if([a,b,c].every(j=>originalPos.getY(j)<d.scalp.center[1])){
   protectedFace++;
   assert.ok(newTuples.has([a,b,c].join(',')),
    'Lower face/ear/neck triangle was accidentally deleted');
  }
 }
 assert.ok(protectedFace>30);
 assert.deepEqual(Array.from(initial.getIndex().array),oldIndex,
  'Original source GLB buffer must not change');
 assert.equal(cutFemaleSummonScalpUnderCover({
  model:d.model,headBone:d.head,groomFrame:d.upright,
  scalp:{...d.scalp,fitted:false},kind
 }),null);
 cut.dispose();cut.dispose();
 assert.strictEqual(d.skinned.geometry,initial,
  'Unloading an instance must restore its original skinned geometry');
 d.original.dispose();for(const m of d.materials)m.dispose();
}
{
 const d=donor();
 const other=new THREE.Group();
 assert.equal(cutFemaleSummonScalpUnderCover({
  model:d.model,headBone:d.head,groomFrame:other,
  scalp:d.scalp,kind:'wig'
 }),null,'Unrelated Head frame must not be modified');
 const original=d.skinned.geometry;
 d.skinned.visible=false;
 assert.equal(cutFemaleSummonScalpUnderCover({
  model:d.model,headBone:d.head,groomFrame:d.upright,
  scalp:d.scalp,kind:'wig'
 }),null,'Hidden donor submeshes are off-limits');
 assert.strictEqual(d.skinned.geometry,original);
 d.original.dispose();for(const m of d.materials)m.dispose();
}
console.log('Female summon wig-base scalp cut PASS: face/ear/neck safe, native buffers unchanged, grouped PBR, reversible, both hair and scales');
