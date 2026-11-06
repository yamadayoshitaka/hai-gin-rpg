import assert from 'node:assert/strict';
import {batchStaticStageDecorations} from '../src/stage-static-instancing.js';

// Dependency-free miniature scene for grouping and transform transfer.
// Three.js itself is loaded through the browser import map.
class Matrix {
  constructor(x=0,y=0,z=0){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]}
  clone(){const copy=new Matrix(...this.elements.slice(12,15));copy.elements=this.elements.slice();return copy}
  makeScale(x,y,z){this.elements[0]=x;this.elements[5]=y;this.elements[10]=z;return this}
  invert(){for(let i=12;i<=14;i++)this.elements[i]*=-1;return this}
  multiply(other){for(let i=12;i<=14;i++)this.elements[i]+=other.elements[i];return this}
}
class Object3D {
  constructor(){this.children=[];this.parent=null;this.position={x:0,y:0,z:0};
    this.matrixWorld=new Matrix();this.userData={};this.visible=true}
  add(child){this.children.push(child);child.parent=this}
  remove(child){this.children=this.children.filter(x=>x!==child);child.parent=null}
  traverse(fn){fn(this);for(const c of this.children)c.traverse(fn)}
  updateWorldMatrix(){
    this.matrixWorld=new Matrix(this.position.x,this.position.y,this.position.z);
    if(this.parent)this.matrixWorld=this.parent.matrixWorld.clone().multiply(this.matrixWorld);
    for(const c of this.children)c.updateWorldMatrix();
  }
}
class Mesh extends Object3D {
  constructor(geometry,material){super();this.isMesh=true;this.geometry=geometry;this.material=material;this.castShadow=false;this.receiveShadow=false}
}
class InstancedMesh extends Mesh {
  constructor(geometry,material,count){super(geometry,material);this.isInstancedMesh=true;this.count=count;
    this.matrices=Array(count);this.instanceMatrix={setUsage(){},needsUpdate:false}}
  setMatrixAt(i,matrix){this.matrices[i]=matrix.clone()}
  getMatrixAt(i,matrix){matrix.elements=this.matrices[i].elements.slice()}
  computeBoundingSphere(){this.boundingSphereReady=true}
}
const THREE={InstancedMesh,Matrix4:Matrix,StaticDrawUsage:35044};
const stage=new Object3D(),geometry={uuid:'shared-real-tree-geometry'},material={
  uuid:'shared-photo-material',opacity:1,alphaTest:0,transparent:false,depthWrite:true,
  clone(){return {...this,uuid:this.uuid+'-ghost'}}
};
const leafGeometry={uuid:'real-leaf-canopy'},leafMaterial={
 uuid:'alpha-leaf-material',opacity:1,alphaTest:.4,transparent:true,depthWrite:true,
 clone(){return {...this,uuid:this.uuid+'-ghost'}}
};
const original=[];
for(let i=0;i<12;i++){
  const object=new Object3D();object.userData.assetId='tree_deciduous_001';
  object.position.x=(i-5.5)*2.2;object.position.y=Math.sin(i)*.4;object.position.z=(2-5.5)*2.2;
  const branch=new Object3D();branch.position.y=.8;object.add(branch);
  const trunk=new Mesh(geometry,material);trunk.position.y=.9;trunk.castShadow=true;branch.add(trunk);
  const leaves=new Mesh(leafGeometry,leafMaterial);leaves.castShadow=true;branch.add(leaves);
  stage.add(object);stage.updateWorldMatrix();original.push(trunk.matrixWorld.elements.slice());
}
const unaffected=new Mesh({uuid:'other'},material);stage.add(unaffected);
const result=batchStaticStageDecorations(stage,THREE,{sectorCells:32,cellSize:2.2});
assert.equal(result.objects,12);assert.equal(result.sourceMeshes,24);assert.equal(result.batches,2);
assert.ok(stage.children.includes(unaffected),'unregistered objects remain unchanged');
const instanced=stage.children.find(x=>x.isInstancedMesh);
assert.ok(instanced&&instanced.count===12);
const leafInstances=stage.children.find(x=>x.isInstancedMesh&&x.geometry===leafGeometry);
assert.equal(instanced.geometry,geometry,'original geometry is retained');
assert.equal(instanced.material,material,'original photo materials are retained');
assert.equal(instanced.castShadow,true,'physical shadows remain');
assert.equal(instanced.frustumCulled,true,'sector batches can be culled');
for(let i=0;i<12;i++)assert.deepEqual(instanced.matrices[i].elements,original[i],
  'each originally positioned tree retains its world transform');
assert.equal(result.hasDecorationAt('tree_deciduous_001',0,2),true);
assert.equal(result.occlusionCandidates.length,12,'Tree camera bounds are cached at startup');
assert.equal(result.setDecorationOccludedAt('tree_deciduous_001',0,2,true),true);
assert.equal(leafInstances.matrices[0].elements[0],0,'Only the leafy canopy leaves its shared batch');
assert.equal(instanced.matrices[0].elements[0],1,'Trunk and small branches keep their single draw batch');
assert.equal(instanced.matrices[1].elements[0],1,'Other trees keep their single draw batch');
assert.equal(stage.children.find(o=>o.userData.assetId==='tree_deciduous_001')?.children[0]?.children[1]?.material.opacity,.18,
  'Only the blocking tree has its own translucent material');
assert.equal(stage.children.find(o=>o.userData.assetId==='tree_deciduous_001')?.children[0]?.children[0]?.visible,false,
  'Trunk does not get a second, duplicate draw call');
assert.equal(material.opacity,1,'Shared photo material is never made translucent');
assert.equal(result.setDecorationOccludedAt('tree_deciduous_001',0,2,false),true);
assert.equal(instanced.matrices[0].elements[0],1,'Unblocked tree is restored to the GPU batch');
assert.equal(leafInstances.matrices[0].elements[0],1,'Foliage is rebatched after the view clears');
assert.equal(stage.children.some(o=>o.userData.assetId==='tree_deciduous_001'),false,
  'Restored tree is no longer rendered a second time');
assert.equal(result.setDecorationOccludedAt('tree_deciduous_001',0,2,true,{hide:true}),true);
assert.equal(instanced.matrices[0].elements[0],0,'Close-up cutaway removes the blocking trunk and branches');
assert.equal(leafInstances.matrices[0].elements[0],0,'Close-up cutaway also removes the canopy');
assert.equal(instanced.matrices[1].elements[0],1,'Neighbouring trees remain visible');
assert.equal(stage.children.some(o=>o.userData.assetId==='tree_deciduous_001'),false,
  'Full-size source tree is removed during the camera cutaway');
assert.equal(result.setDecorationOccludedAt('tree_deciduous_001',0,2,true),true);
assert.equal(instanced.matrices[0].elements[0],1,'Switching modes restores the trunk');
assert.equal(leafInstances.matrices[0].elements[0],0,'Switching modes retains translucent canopy');
assert.equal(result.setDecorationOccludedAt('tree_deciduous_001',0,2,false),true);
assert.equal(instanced.matrices[0].elements[0],1,'Leaving tree restores trunk');
assert.equal(leafInstances.matrices[0].elements[0],1,'Leaving tree restores canopy');
assert.equal(result.setDecorationOccludedAt('tree_deciduous_001',0,2,true),true);
assert.equal(result.hideDecorationAt('tree_deciduous_001',0,2),true);
assert.equal(stage.children.some(o=>o.userData.assetId==='tree_deciduous_001'),false,
  'Burned tree cannot survive as a camera-transparent duplicate');
assert.equal(result.setDecorationOccludedAt('tree_deciduous_001',0,2,false),false,
  'Destroyed trees are not resurrected by camera movement');
assert.equal(result.hasDecorationAt('tree_deciduous_001',0,2),false);
assert.equal(instanced.matrices[0].elements[0],0,'燃えた木だけGPU一括描画から除去する');
assert.equal(instanced.matrices[1].elements[0],1,'他の木は残す');
console.log('GPU instancing: 12 original shaded trees → 1 spatial batch, exact geometry/transforms PASS');
