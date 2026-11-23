import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sculptHairFromHead,SCULPT_HAIR_ALL} from '../src/head-derived-hair-sculpt-v9.js';

class Attribute {
 constructor(values,itemSize){this.array=Float32Array.from(values);this.itemSize=itemSize;this.count=this.array.length/itemSize;}
 getX(i){return this.array[i*this.itemSize];}
 getY(i){return this.array[i*this.itemSize+1];}
 getZ(i){return this.array[i*this.itemSize+2];}
 setXYZ(i,x,y,z){const p=i*this.itemSize;this.array[p]=x;this.array[p+1]=y;this.array[p+2]=z;}
 clone(){return new Attribute(this.array,this.itemSize);}
}
class Index {
 constructor(values){this.array=Uint32Array.from(values);this.count=values.length;}
 getX(i){return this.array[i];}
}
class Geometry {
 constructor(){this.attrs={};this.idx=null;this.groups=[];this.disposed=false;}
 setAttribute(name,v){this.attrs[name]=v;return this;}
 getAttribute(name){return this.attrs[name];}
 setIndex(values){this.idx=values===null?null:new Index(Array.from(values));return this;}
 getIndex(){return this.idx;}
 clearGroups(){this.groups=[];}
 addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex});}
 applyMatrix4(){return this;}
 clone(){const g=new Geometry();g.attrs=Object.fromEntries(Object.entries(this.attrs).map(([k,v])=>[k,v.clone()]));g.idx=this.idx?new Index(this.idx.array):null;return g;}
 computeVertexNormals(){if(!this.attrs.normal){const a=this.attrs.position;this.setAttribute('normal',new Attribute(new Array(a.count*3).fill(0),3));}}
 computeBoundingBox(){const p=this.getAttribute('position');let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];for(let j=0;j<3;j++){min[j]=Math.min(min[j],v[j]);max[j]=Math.max(max[j],v[j]);}}this.boundingBox={min:{x:min[0],y:min[1],z:min[2]},max:{x:max[0],y:max[1],z:max[2]}};}
 computeBoundingSphere(){}
 dispose(){this.disposed=true;}
}
class Matrix4 {clone(){return new Matrix4();}invert(){return this;}multiply(){return this;}}
class Vector3 {
 constructor(){this.x=0;this.y=0;this.z=0;}
 set(x,y,z){this.x=x;this.y=y;this.z=z;}
 toArray(){return [this.x,this.y,this.z];}
}
class Group {
 constructor(){this.children=[];this.position=new Vector3();this.scale=new Vector3();this.userData={};this.matrixWorld=new Matrix4();}
 add(child){this.children.push(child);child.parent=this;}
 updateWorldMatrix(){}
 removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}}
}
class Mesh extends Group {constructor(geometry,material){super();this.isMesh=true;this.geometry=geometry;this.material=material;}}
class Color {constructor(value){this.value=value;}set(value){this.value=value;}}
class MeshStandardMaterial {constructor(options){Object.assign(this,options);this.color=new Color(options.color);}dispose(){}}
const THREE={Group,Mesh,BufferGeometry:Geometry,Float32BufferAttribute:Attribute,MeshStandardMaterial,DoubleSide:2};

function makeHead(){
 const g=new Geometry(),vertices=[],normals=[],triangles=[];
 // Closed sphere-like scalp and face neck proxy, triangulated so cap selection
 // uses actual indexed skin triangles, not a synthetic pre-made hair dome.
 const rows=56,cols=96;
 for(let i=0;i<=rows;i++){
  const phi=(i+.0001)/(rows+.0002)*Math.PI;
  for(let j=0;j<=cols;j++){
   const theta=j/cols*Math.PI*2;
   const x=.105*Math.sin(phi)*Math.cos(theta);
   const y=.115*Math.cos(phi);
   const z=.106*Math.sin(phi)*Math.sin(theta);
   vertices.push(x,y,z);
   normals.push(x/.105,y/.115,z/.106);
  }
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
  const a=i*(cols+1)+j,b=a+cols+1;
  triangles.push(a,b,a+1,b,b+1,a+1);
 }
 g.setAttribute('position',new Attribute(vertices,3));
 g.setAttribute('normal',new Attribute(normals,3));
 g.setIndex(triangles);
 const skin=new Mesh(g,new MeshStandardMaterial({color:'#f1d2b8'}));
 return {skin,head:new Group()};
}



test('all 26 heads generate ONLY exterior locks; absolutely no visible base and no skirt',()=>{
 const {skin,head}=makeHead();
 const faceAtStart=new Float32Array(skin.geometry.getAttribute('position').array);
 const ids=new Set();
 for(const style of SCULPT_HAIR_ALL){
  const model=sculptHairFromHead(THREE,skin,{
   referenceRoot:head,headSize:{width:.205,height:.235,depth:.205},
   styleId:style.id,color:'#c8ac73'
  });
  const d=model.diagnostics();
  assert.equal(d.underlayerNotRendered,true,style.id);
  assert.equal(d.sourceSkinNeverRendered,true,style.id);
  assert.equal(d.renderedScalpTriangles,0,style.id);
  assert.equal(d.renderedSkirtTriangles,0,style.id);
  assert.equal(d.exteriorLocks,112,style.id);
  ids.add(model.root.name);
  const g=model.root.children[0].geometry;
  assert.equal(g.groups.length,5);
  assert.equal(g.groups[0].count,0,'crown base material group must not contain visible triangles');
  const p=g.getAttribute('position').array;
  const idx=g.getIndex().array;
  assert.ok(p.every(Number.isFinite),style.id);
  assert.ok(idx.every(i=>i>=0&&i<p.length/3),style.id);
  assert.ok(idx.length>30000,style.id);
  // Closed *individual* groomed solids with no open polygon edge.
  const edges=new Map();
  for(let k=0;k<idx.length;k+=3){
   for(const [a,b] of [[idx[k],idx[k+1]],[idx[k+1],idx[k+2]],[idx[k+2],idx[k]]]){
    const edge=Math.min(a,b)+':'+Math.max(a,b);
    edges.set(edge,(edges.get(edge)||0)+1);
   }
  }
  const openings=[...edges.values()].filter(v=>v===1).length;
  assert.equal(openings,0,'open haircard triangle at '+style.id);
  model.setSectionColors(true);model.setSectionColors(false);
  model.setSectionVisible('crown',false);model.setSectionVisible('crown',true);
  model.setColor('#b39872');
  model.updateMotion(1/30,{motion:'walk',time:.4,wind:1});
  model.dispose();
  assert.equal(g.disposed,true);
 }
 assert.equal(ids.size,26);
 assert.deepEqual(skin.geometry.getAttribute('position').array,faceAtStart,'face and brow data must never change');
});
test('the studio renders v9 only and never draws the former scalp hemisphere or rim curtain',()=>{
 const html=readFileSync(new URL('../hair-asset-studio.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../src/head-derived-hair-sculpt-v9.js',import.meta.url),'utf8');
 assert.match(html,/head-derived-hair-modular-v11\.js\?v=11/);
 assert.match(html,/sculptHairFromHead\(THREE,scalpSource\.skinMesh/);
 assert.doesNotMatch(html,/loader\.loadAsync\(item\.path\)/);
 assert.match(code,/renderedScalpTriangles:0/);
 assert.match(code,/renderedSkirtTriangles:0/);
 assert.match(code,/const geometry=new THREE\.BufferGeometry\(\)/);
 assert.doesNotMatch(code,/sectionTris\[0\]\.push\(a,b,c/);
 assert.doesNotMatch(code,/function buildOutsideLocks\(/);
 assert.doesNotMatch(code,/function generateSculpt\(/);
 assert.doesNotMatch(code,/function emitRim\(/);
});
