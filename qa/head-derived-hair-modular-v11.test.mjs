import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HAIR_STYLES,HAIR_ALL,findHairStyle,sculptHairFromHead,makeHairColliders,pushHairPlateOutside} from '../src/head-derived-hair-modular-v11.js';

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





test('female01 is a fully detachable scalp-derived five-part model with thick closed sculpt plates',()=>{
 const {skin,head}=makeHead(),face=new Float32Array(skin.geometry.getAttribute('position').array);
 const model=sculptHairFromHead(THREE,skin,{
  referenceRoot:head,headSize:{width:.205,height:.235,depth:.205},
  styleId:'female-hair-01',color:'#d1b78b'
 });
 const d=model.diagnostics();
 assert.equal(d.hairParts,5);
 assert.deepEqual(d.partNames,['crown','fringe','left','right','back']);
 assert.equal(d.assembledLikeDetachableKit,true);
 assert.equal(d.sourceHeadUsedOnlyAsTemplate,true);
 assert.equal(d.oldHairMeshUsed,false);
 assert.equal(d.independentSprings,true);
 assert.equal(d.strandCounts.crown,168);
 assert.equal(d.strandCounts.fringe,40);
 assert.equal(d.strandCounts.left,16);
 assert.equal(d.strandCounts.right,16);
 assert.equal(d.strandCounts.back,82);
 assert.equal(d.separateCollisionStrands,322);
 assert.ok(d.rootBackingTriangles>550);
 assert.equal(d.rootBackingOffset,.00045);
 assert.equal(model.root.children[0].name,'anatomical-root-only');
 assert.equal(model.root.children.length,6);
 assert.deepEqual(model.root.children.slice(1).map(x=>x.name),
   ['detachable-crown','detachable-fringe','detachable-left','detachable-right','detachable-back']);
 assert.ok(d.triangleCount>20000);
 for(const group of model.root.children.slice(1)){
  const g=group.children[0].geometry;
  const a=g.getAttribute('position').array,idx=g.getIndex().array;
  assert.ok(a.length>1000);
  assert.ok(a.every(Number.isFinite),group.name);
  assert.ok(idx.every(v=>v>=0&&v<a.length/3),group.name);
  // Finite-thickness plates must have NO open boundary edges.
  const edges=new Map();
  for(let j=0;j<idx.length;j+=3)
   for(const [u,v]of[[idx[j],idx[j+1]],[idx[j+1],idx[j+2]],[idx[j+2],idx[j]]]){
    const k=Math.min(u,v)+':'+Math.max(u,v);
    edges.set(k,(edges.get(k)||0)+1);
   }
  assert.equal([...edges.values()].filter(x=>x===1).length,0,group.name+' open edges');
 }
 model.setSectionVisible('fringe',false);
 assert.equal(model.root.children[2].visible,false);
 model.setSectionVisible('fringe',true);
 model.setSectionColors(true);model.setSectionColors(false);
 model.setExploded(true);model.setExploded(false);
 model.setColor('#b59570');
 model.fitToHead({width:.18,height:.235,depth:.205});
 assert.ok(model.root.scale.x<1);
 model.updateMotion(1/30,{motion:'run',wind:2,time:1.2});
 assert.deepEqual(skin.geometry.getAttribute('position').array,face,'never mutate head, eyes or brows');
 const crown=model.root.children[1].children[0].geometry;
 model.dispose();assert.equal(crown.disposed,true);
});
test('26 new hairstyles instantiate the same kit and possess per-strand collision state',()=>{
 assert.equal(HAIR_STYLES.female.length,12);
 assert.equal(HAIR_STYLES.male.length,14);
 assert.equal(HAIR_ALL.length,26);
 assert.equal(new Set(HAIR_ALL.map(s=>s.id)).size,26);
 for(const s of HAIR_ALL)assert.equal(findHairStyle(s.id),s);
 const {skin,head}=makeHead();
 for(const style of HAIR_ALL){
  const model=sculptHairFromHead(THREE,skin,{referenceRoot:head,
   headSize:{width:.205,height:.235,depth:.205},styleId:style.id,color:'#ceb782'});
  const d=model.diagnostics();
  assert.equal(d.hairParts,5,style.id);
  assert.equal(d.separateCollisionStrands,322-(style.bang==='curtain'?4:0),style.id);
  assert.ok(d.rootBackingTriangles>550,style.id);
  assert.equal(d.oldHairMeshUsed,false);
  assert.ok(d.triangleCount>20000,style.id);
  for(const part of model.root.children.slice(1)){
   const vertices=part.children[0].geometry.getAttribute('position').array;
   assert.ok(vertices.every(Number.isFinite),style.id+' '+part.name);
  }
  model.updateMotion(1/30,{motion:'walk',wind:1,time:.5});
  model.dispose();
 }
});
test('individual thick plate collision projects out of head and shoulder ellipsoids',()=>{
 const h={cx:0,cz:0,rx:.095,rz:.103,brow:.1,top:.19};
 const colliders=makeHairColliders(h);
 assert.ok(colliders.length>=6);
 for(const part of ['fringe','left','right','back']){
  const p=colliders[1].center;
  const out=pushHairPlateOutside(p,colliders,part);
  assert.ok(out.hits>0,part);
  assert.ok(out.point.every(Number.isFinite),part);
  assert.notDeepEqual(out.point,p,part);
 }
 const far=pushHairPlateOutside([0,3,0],colliders,'back');
 assert.equal(far.hits,0);
});
test('preview references v11 only and includes per-strand collision and anatomical root backing',()=>{
 const html=readFileSync(new URL('../hair-asset-studio.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../src/head-derived-hair-modular-v11.js',import.meta.url),'utf8');
 assert.match(html,/head-derived-hair-modular-v11\.js\?v=11/);
 assert.match(html,/sculptHairFromHead\(THREE,scalpSource\.skinMesh/);
 assert.match(html,/独立毛束（衝突判定あり）/);
 assert.doesNotMatch(html,/loader\.loadAsync\(item\.path\)/);
 assert.match(code,/triangleSampler\(geo,h\)/);
 assert.match(code,/rootBacking\(THREE,g,h,color,fibers\)/);
 assert.match(code,/pushHairPlateOutside\(moved,colliders,part\)/);
 assert.match(code,/makeHairColliders\(h\)/);
 assert.match(code,/bumpMap:fiber\.bump/);
 assert.doesNotMatch(code,/import .*head-derived|female_hair_01_lod0|loadAsync\(/);
});
