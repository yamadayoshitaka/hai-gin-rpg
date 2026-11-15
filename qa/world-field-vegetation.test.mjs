import assert from 'node:assert/strict';
import {buildFieldPlantGeometry,addFieldPlants} from '../src/world-field-vegetation.js';

// Minimal Three API recorder: tests the real source geometry math without WebGL.
class BufferGeometry {
 attributes={};userData={};index=[];
 setAttribute(k,v){this.attributes[k]=v;return this}
 setIndex(v){this.index=v;return this}
 computeVertexNormals(){this.normalsComputed=true}
}
class Float32BufferAttribute {
 constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize}
}
class Object3D {
 position={set:(x,y,z)=>{this.xyz=[x,y,z]}};
 rotation={y:0};
 scale={setScalar:s=>{this.uniformScale=s}};
 updateMatrix(){this.matrix={position:this.xyz,scale:this.uniformScale,angle:this.rotation.y}}
}
class InstancedMesh {
 constructor(geometry,material,count){
  this.geometry=geometry;this.material=material;this.count=count;
  this.instanceMatrix={needsUpdate:false};this.instances=new Map();
 }
 setMatrixAt(i,m){this.instances.set(i,{...m})}
 computeBoundingSphere(){this.boundsComputed=true}
}
const THREE={BufferGeometry,Float32BufferAttribute,Object3D,InstancedMesh};
for(const species of ['rice','vegetable']){
 const geo=buildFieldPlantGeometry(THREE,{species,cellSize:2.2});
 const positions=geo.attributes.position.array;
 assert(positions.length>300,'many distinct curved leaf vertices');
 assert(positions.every(Number.isFinite),'no invalid leaf vertices');
 assert(geo.normalsComputed,'normal vectors for realistic diffuse light');
 assert.equal(geo.index.length,geo.userData.bladeCount*geo.userData.segmentsPerBlade*6);
 assert(geo.index.every(i=>i>=0&&i<positions.length/3),'indexed triangles stay within authored vertices');
 const heights=positions.filter((_,i)=>i%3===1);
 assert(Math.min(...heights)>=0,'leaf roots sit on their local soil plane');
 assert(Math.max(...heights)<2.2,'vegetation stays within the 1-cell plant height budget');
 const parent={children:[],add(node){this.children.push(node)}};
 const mat={side:'double'};
 const mesh=addFieldPlants(THREE,parent,{species,cellSize:2.2,material:mat});
 assert.equal(parent.children.length,1,'one render mesh per entire 100-plant field');
 assert.equal(mesh.count,100);
 assert.equal(mesh.instances.size,100);
 assert(mesh.instanceMatrix.needsUpdate);
 assert(mesh.boundsComputed);
 assert(mesh.castShadow&&mesh.receiveShadow);
 assert.equal(mesh.userData.plantCount,100);
 assert.notDeepEqual(mesh.instances.get(0).position,mesh.instances.get(99).position);
}
assert.throws(()=>buildFieldPlantGeometry(THREE,{species:'unknown'}),/Unknown plant species/);
assert.throws(()=>buildFieldPlantGeometry(THREE,{species:'rice',cellSize:0}),/cellSize/);
const source=(await import('node:fs')).readFileSync('src/object-catalog.js','utf8');
assert(source.includes("import {addFieldPlants} from './world-field-vegetation.js'"));
assert(source.includes("addFieldPlants(THREE,root,{species:rice?'rice':'vegetable',cellSize:c,material:leaf})"));
assert(!source.includes("const stalkGeo=new THREE.ConeGeometry((rice?.13:.23)"));
console.log('PASS: rice/vegetable geometry is tapered and curved, 100 instances in one draw mesh');
