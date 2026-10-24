import assert from 'node:assert/strict';
import {attachSmoothHumanSkin} from '../src/human-skin.js';
class Attribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}}
class Geometry{
 constructor(){this.attributes={};this.groups=[];this.index=[];}
 setAttribute(key,value){this.attributes[key]=value;}
 setIndex(indices){this.index=indices;}
 computeVertexNormals(){}
 addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex});}
}
class SkinnedMesh{
 constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={};}
 bind(skeleton){this.skeleton=skeleton;}
}
const THREE={BufferGeometry:Geometry,Float32BufferAttribute:Attribute,Uint16BufferAttribute:Attribute,
 SkinnedMesh,Skeleton:class{constructor(bones){this.bones=bones;}}};
const bone=()=>({position:{},rotation:{}});
const joints={spine:bone(),neck:bone(),head:bone(),
 hips:[bone(),bone()],knees:[bone(),bone()],ankles:[bone(),bone()],
 shoulders:[bone(),bone()],elbows:[bone(),bone()],wrists:[bone(),bone()]};
const root={children:[],add(mesh){this.children.push(mesh);},updateMatrixWorld(){}};
const mesh=attachSmoothHumanSkin(THREE,root,joints,id=>({id}));
assert.equal(root.children[0],mesh);
assert.equal(mesh.skeleton.bones.length,15);
const a=mesh.geometry.attributes;
assert.ok(a.position.array.length/3>1700,'smooth ring vertices');
assert.equal(a.position.array.length/3,a.skinIndex.array.length/4);
assert.equal(a.position.array.length/3,a.skinWeight.array.length/4);
assert.ok(mesh.geometry.index.length>5000,'skin triangles');
assert.equal(mesh.geometry.groups.length,6,'torso, both arms, legs and head');
for(let i=0;i<a.skinWeight.array.length;i+=4){
 const sum=a.skinWeight.array.slice(i,i+4).reduce((x,y)=>x+y,0);
 assert.ok(Math.abs(sum-1)<1e-5,'normalized bone influences');
 assert.ok(a.skinIndex.array[i]<15&&a.skinIndex.array[i+1]<15,'bone index range');
}
assert.equal(mesh.userData.skinDrivenBy,'human-joint-bom');
console.log('Procedural skinned geometry bone influences and mesh topology verified');
