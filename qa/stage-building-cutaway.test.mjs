import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {batchStaticBuildingShells} from '../src/stage-building-instancing.js';

class Matrix4 {
 constructor(x=0,y=0,z=0){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]}
 clone(){const m=new Matrix4();m.elements=[...this.elements];return m}
 invert(){for(let i=12;i<15;i++)this.elements[i]*=-1;return this}
 multiply(m){for(let i=12;i<15;i++)this.elements[i]+=m.elements[i];return this}
 makeScale(x,y,z){this.elements[0]=x;this.elements[5]=y;this.elements[10]=z;return this}
}
class Object3D {
 constructor(){this.name='';this.visible=true;this.userData={};this.children=[];this.parent=null;
  this.position={x:0,y:0,z:0};this.matrixWorld=new Matrix4()}
 add(child){this.children.push(child);child.parent=this}
 remove(child){this.children=this.children.filter(x=>x!==child);child.parent=null}
 getObjectByName(name){if(this.name===name)return this;for(const child of this.children){
   const match=child.getObjectByName(name);if(match)return match}return null}
 traverse(fn){fn(this);for(const child of this.children)child.traverse(fn)}
 updateWorldMatrix(){this.matrixWorld=new Matrix4(this.position.x,this.position.y,this.position.z);
  if(this.parent)this.matrixWorld=this.parent.matrixWorld.clone().multiply(this.matrixWorld);
  for(const child of this.children)child.updateWorldMatrix()}
}
class Material {
 constructor(uuid){this.uuid=uuid;this.transparent=false;this.depthWrite=true;this.opacity=1}
 clone(){return Object.assign(new Material(this.uuid+'-cutaway'),this)}
}
class Mesh extends Object3D {
 constructor(geometry,material){super();this.isMesh=true;this.geometry=geometry;this.material=material;
  this.castShadow=true;this.receiveShadow=true}
}
class InstancedMesh extends Mesh {
 constructor(geometry,material,count){super(geometry,material);this.isInstancedMesh=true;this.count=count;
  this.matrices=Array(count);this.instanceMatrix={setUsage(){},needsUpdate:false}}
 setMatrixAt(index,matrix){this.matrices[index]=matrix.clone()}
 computeBoundingSphere(){this.sphereUpdates=(this.sphereUpdates??0)+1}
}
const THREE={InstancedMesh,Matrix4,DynamicDrawUsage:35048};
const stage=new Object3D(),sharedGeometry={uuid:'shared-house'},sharedMaterial=new Material('pbr-photo');
function makeBuilding(id,x,geometry=sharedGeometry,material=sharedMaterial){
 const model=new Object3D();model.userData.catalogId=id;model.position.x=x;
 const walls=new Object3D();walls.name='walls';model.add(walls);
 const shell=new Mesh(geometry,material);walls.add(shell);stage.add(model);
 return {model,shell,walls,data:{x,z:16}};
}
const a=makeBuilding('house',4),b=makeBuilding('house',14);
const castle=makeBuilding('castle_001',36,{uuid:'royal-castle'},new Material('castle-pbr'));
const stats=batchStaticBuildingShells([a,b,castle],stage,THREE);
assert.equal(stats.batches,1,'Repeated houses must still share one GPU draw');
const batch=stage.children.find(child=>child.isInstancedMesh);
assert.ok(batch&&batch.count===2);
assert.equal(a.walls.children.length,0,'Original facades are batched while distant');
assert.equal(b.walls.children.length,0);
assert.equal(castle.walls.children.length,1,'Unique castle retains its real wall mesh');
assert.equal(stats.setBuildingShellCutaway(a.model,true),true);
assert.equal(batch.matrices[0].elements[0],0,'Only near house is suppressed in GPU batch');
assert.equal(batch.matrices[1].elements[0],1,'Distant house remains opaque');
assert.equal(a.walls.children[0],a.shell,'Near house restores its original mesh as a ghost');
assert.equal(a.shell.material.opacity,.13);
assert.equal(a.shell.material.transparent,true);
assert.equal(a.shell.material.depthWrite,false);
assert.equal(a.shell.castShadow,false);
assert.equal(b.shell.material,sharedMaterial,'Other houses must keep PBR material untouched');
assert.equal(stats.setBuildingShellCutaway(a.model,false),true);
assert.equal(batch.matrices[0].elements[0],1,'Leaving restores original instance transform');
assert.equal(a.walls.children.length,0,'Ghost is removed when batch is restored');
assert.equal(a.shell.material,sharedMaterial);
assert.equal(stats.setBuildingShellCutaway(castle.model,true),true);
assert.equal(castle.shell.material.transparent,true,'Unique castle can reveal royal interiors');
assert.equal(castle.shell.material.opacity,.13);
assert.equal(stats.setBuildingShellCutaway(castle.model,false),true);
assert.equal(castle.shell.material.transparent,false,'Castle exterior is restored when far');
assert.equal(stats.hideBuilding(a.model),true);
assert.equal(stats.setBuildingShellCutaway(a.model,true),false,'Destroyed buildings cannot return');
assert.equal(batch.matrices[0].elements[0],0);
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/updateTownInteriorVisibility\(\)/);
assert.match(game,/buildingBatchStats\.setBuildingShellCutaway\(b\.model,cutaway\)/);
assert.match(game,/if\(b\.roof\)b\.roof\.visible=showRoof/);
assert.match(game,/buildingBatchStats\.setBuildingRoofVisible\(b\.model,showRoof\)/,
 'The visible roof state must also reach GPU instances and remain solid for rooftop soldiers');
assert.match(game,/groundFurnishings\.visible=cutaway/,
 'The castle first-floor rooms and pillars must appear when its walls become translucent');
assert.match(game,/interiorVisibilityTimer>=\.24/,'Only check nearby houses four times per second');
console.log('House and castle translucent cutaways restore originals, preserve shared draw batches and collapsed buildings');
