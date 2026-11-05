import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {batchStaticBuildingShells} from '../src/stage-building-instancing.js';
import {createBattleActorVisibility} from '../src/battle-render-visibility.js';

const battleHtml=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battleHtml,/id="battleLoading"/,'loading overlay is present before the game module');
assert.match(battleHtml,/BATTLE_RESOLUTION_SCALE=\.85/,
 'render scale is restored to 85 percent for readable costumes');
assert.match(battleHtml,/setPixelRatio\(Math\.min\(devicePixelRatio,MASS_SIZE\?1\.1:1\.5\)\*BATTLE_RESOLUTION_SCALE\)/);
assert.match(battleHtml,/new ShaderPass\(FXAAShader\)/,'large battles use GPU FXAA instead of 4x MSAA');
assert.match(battleHtml,/fxaaComposer\.render\(\)/,'the GPU anti-aliasing pass renders the final frame');
const armySource=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(armySource,/if\(!bodyLayers\.length\)throw Error/,'every crowd profession must draw a body');
assert.match(armySource,/instance\.userData\.fullHumanBody=true/,'the complete-body layer is explicitly identified');
assert.match(armySource,/material\.opacity=1;material\.transparent=false/,'baked humans must not inherit transparent hidden-skin materials');
assert.match(battleHtml,/await installBattleModels\(\);[\s\S]*await prepareMassRenderer\(\);/,
 'models and GPU crowd batches are fully prepared before battle');
assert.match(battleHtml,/battleReady=true;[\s\S]*loading\.hidden=true;[\s\S]*updateUI\(\);animate\(\);/,
 'battle cannot tick until loading completes');

class Matrix {
 constructor(x=0,y=0,z=0){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]}
 clone(){return new Matrix(...this.elements.slice(12,15))}
 invert(){for(let i=12;i<15;i++)this.elements[i]*=-1;return this}
 multiply(other){for(let i=12;i<15;i++)this.elements[i]+=other.elements[i];return this}
 multiplyMatrices(a,b){this.elements=a.elements.slice();return this.multiply(b)}
}
class Object3D {
 constructor(name=''){this.name=name;this.children=[];this.parent=null;this.visible=true;this.position={x:0,y:0,z:0};this.userData={};this.matrixWorld=new Matrix()}
 add(child){this.children.push(child);child.parent=this}
 remove(child){this.children=this.children.filter(c=>c!==child);child.parent=null}
 traverse(fn){fn(this);for(const c of this.children)c.traverse(fn)}
 updateWorldMatrix(){this.matrixWorld=new Matrix(this.position.x,this.position.y,this.position.z);if(this.parent)this.matrixWorld=this.parent.matrixWorld.clone().multiply(this.matrixWorld);for(const c of this.children)c.updateWorldMatrix()}
 getObjectByName(name){let found=null;this.traverse(n=>{if(!found&&n.name===name)found=n});return found}
}
class Mesh extends Object3D{
 constructor(geometry,material){super();this.isMesh=true;this.geometry=geometry;this.material=material;this.castShadow=true;this.receiveShadow=true}
}
class InstancedMesh extends Mesh{
 constructor(geometry,material,count){super(geometry,material);this.count=count;this.isInstancedMesh=true;this.matrices=[];this.instanceMatrix={setUsage(){},needsUpdate:false}}
 setMatrixAt(i,matrix){this.matrices[i]=matrix.clone()}
 computeBoundingSphere(){this.hasBounds=true}
}
const mockThree={InstancedMesh,StaticDrawUsage:35044};
const stage=new Object3D('stage');
const geo={uuid:'shared-masonry'},mat={uuid:'shared-stone',transparent:false};
const models=[];
for(const x of [10,18,26]){
 const building=new Object3D('town_house');building.userData.catalogId='town_house_001';building.position.x=x;
 const shell=new Object3D('walls');shell.add(new Mesh(geo,mat));building.add(shell);
 const roof=new Object3D('removable_roof');roof.add(new Mesh({uuid:'roof'},mat));building.add(roof);
 const loot=new Object3D('upper_floor_loot');loot.add(new Mesh({uuid:'chest'},mat));building.add(loot);
 stage.add(building);models.push({model:building,data:{x,z:12},roof});
}
const result=batchStaticBuildingShells(models,stage,mockThree,{sectorCells:64});
assert.deepEqual(result,{sourceMeshes:3,batches:1,instances:3});
const instance=stage.children.find(c=>c.isInstancedMesh);
assert.ok(instance?.hasBounds&&instance.frustumCulled);
assert.deepEqual(instance.matrices.map(m=>m.elements[12]),[10,18,26]);
for(const {model,roof} of models){
 assert.equal(model.getObjectByName('walls').children.length,0,'batched shells removed from separate draw lists');
 assert.equal(model.getObjectByName('removable_roof'),roof,'each roof is independent');
 assert.equal(model.getObjectByName('upper_floor_loot').children.length,1,'loot stays per building');
}
models[0].roof.visible=false;
assert.equal(models[1].roof.visible,true,'opening one roof never opens another');

class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 set(x,y,z){this.x=x;this.y=y;this.z=z}
 distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}
}
class Sphere{constructor(center){this.center=center}}
class Frustum{setFromProjectionMatrix(){}intersectsSphere(bounds){return bounds.center.x>=0}}
const camera={position:new Vector3(),projectionMatrix:new Matrix(),matrixWorldInverse:new Matrix(),updateMatrixWorld(){}};
const visibility=createBattleActorVisibility({Frustum,Matrix4:Matrix,Sphere,Vector3},camera);
const actors=[-3,5,40,100].map(x=>{
 const part=new Mesh(geo,mat);const root=new Object3D();root.position.x=x;
 return {root,model:{traverse(fn){fn(part)}},part};
});
visibility.beginFrame(0);
assert.equal(visibility.sample(actors[0]).visible,false,'offscreen body not rendered');
assert.equal(actors[0].root.visible,false);
assert.equal(visibility.sample(actors[1]).update,true,'near rig updates every frame');
assert.equal(visibility.sample(actors[2]).update,false,'mid rig may skip animation samples');
assert.equal(actors[2].part.castShadow,false,'distant rig avoids dynamic shadow draw');
assert.equal(visibility.sample(actors[3]).update,false,'far rig is even coarser');
visibility.beginFrame(.11);
assert.equal(visibility.sample(actors[2]).update,true,'mid rig eventually animates');
assert.equal(visibility.sample(actors[3]).update,true,'far rig eventually animates');
assert.ok(visibility.stats.visible>=2);
console.log('Startup building GPU batches, independent roofs/loot, view culling and distance LOD PASS');
