import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sculptHairFromHead,SCULPT_HAIR_ALL,SCULPT_HAIR_STYLES,findSculptHairStyle} from '../src/head-derived-hair-reference-v10.js';

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




test('reference female01 contains full fringe, densely closed crown, left/right and long back as FIVE independent 3D parts',()=>{
 const {skin,head}=makeHead();
 const source=new Float32Array(skin.geometry.getAttribute('position').array);
 const model=sculptHairFromHead(THREE,skin,{referenceRoot:head,
  headSize:{width:.205,height:.235,depth:.205},
  styleId:'female-hair-01',color:'#d5b67b'});
 const d=model.diagnostics();
 assert.equal(d.hairParts,5);
 assert.deepEqual(d.partNames,['crown','fringe','left','right','back']);
 assert.equal(d.crownStrands,124);
 assert.equal(d.frontalStrands,34);
 assert.equal(d.sideStrands,24);
 assert.equal(d.backStrands,62);
 assert.ok(d.scalpBackingTriangles>600,'crown has a skin-matched hidden rootcoat');
 assert.ok(d.scalpBackingOffset<=.0005);
 assert.equal(d.reusedFormerHairGeometry,false);
 assert.equal(d.texture,'directional-fiber-albedo-and-micro-bump');
 assert.equal(model.root.children.length,6,'rootcoat + 5 visibly independent part groups');
 assert.equal(model.root.children[0].name,'inner-roots-only');
 const partNames=model.root.children.slice(1).map(x=>x.name);
 assert.deepEqual(partNames,['hair-part-crown','hair-part-fringe','hair-part-left','hair-part-right','hair-part-back']);
 for(const group of model.root.children.slice(1)){
  const mesh=group.children[0],a=mesh.geometry.getAttribute('position');
  const idx=mesh.geometry.getIndex();
  assert.ok(idx.count>500,mesh.name);
  assert.ok(a.array.every(Number.isFinite),mesh.name);
  assert.ok([...idx.array].every(i=>i>=0&&i<a.count),mesh.name);
 }
 model.setSectionVisible('fringe',false);
 assert.equal(model.root.children[2].visible,false);
 model.setSectionVisible('fringe',true);
 model.setSectionColors(true);model.setSectionColors(false);
 model.setExploded(true);model.setExploded(false);
 model.updateMotion(1/30,{motion:'walk',wind:1,time:.7});
 model.setColor('#8b6a43');
 model.fitToHead({width:.18,height:.235,depth:.205});
 assert.ok(model.root.scale.x<1);
 assert.deepEqual(skin.geometry.getAttribute('position').array,source,'original facial geometry must be unchanged');
 const crown=model.root.children[1].children[0].geometry;
 model.dispose();assert.equal(crown.disposed,true);
});
test('all 26 styles generate without source GLBs, broken geometry or visible scalp holes',()=>{
 assert.equal(SCULPT_HAIR_STYLES.female.length,12);
 assert.equal(SCULPT_HAIR_STYLES.male.length,14);
 assert.equal(new Set(SCULPT_HAIR_ALL.map(s=>s.id)).size,26);
 assert.match(findSculptHairStyle('female-hair-01').label,/ぱっつん/);
 const {skin,head}=makeHead();
 const source=new Float32Array(skin.geometry.getAttribute('position').array);
 for(const style of SCULPT_HAIR_ALL){
  const model=sculptHairFromHead(THREE,skin,{referenceRoot:head,
   headSize:{width:.205,height:.235,depth:.205},styleId:style.id,color:'#d2b777'});
  const d=model.diagnostics();
  assert.ok(d.crownStrands>=120,style.id);
  assert.ok(d.frontalStrands>=16,style.id);
  assert.ok(d.backStrands>=44,style.id);
  assert.equal(d.hairParts,5,style.id);
  assert.ok(d.scalpBackingTriangles>600,style.id);
  assert.ok(d.totalTriangles>10000,style.id);
  for(const group of model.root.children.slice(1)){
   const p=group.children[0].geometry.getAttribute('position').array;
   assert.ok(p.every(Number.isFinite),style.id+' '+group.name);
  }
  model.updateMotion(1/30,{motion:'run',wind:3,time:2});
  model.dispose();
 }
 assert.deepEqual(skin.geometry.getAttribute('position').array,source);
});
test('studio uses the five-part v10 renderer and fine-strand texture workflow, never old hair GLB',()=>{
 const html=readFileSync(new URL('../hair-asset-studio.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../src/head-derived-hair-reference-v10.js',import.meta.url),'utf8');
 assert.match(html,/head-derived-hair-modular-v11\.js\?v=11/);
 assert.match(html,/sculptHairFromHead\(THREE,scalpSource\.skinMesh/);
 assert.match(html,/頭型から製作する分割組立ヘア v11/);
 assert.doesNotMatch(html,/loader\.loadAsync\(item\.path\)/);
 assert.match(code,/makeFiberTextures\(THREE\)/);
 assert.match(code,/bumpMap:fibers\.bump/);
 assert.match(code,/scalpBackingOffset:under\.offset/);
 assert.match(code,/concealed-follicle-rootcoat/);
 assert.match(code,/fringeCount=\(style\.bang==='up'\?16:34\)/);
 assert.doesNotMatch(code,/new GLTFLoader|female_hair_01_lod0|import .*sculpt-v9/);
});
