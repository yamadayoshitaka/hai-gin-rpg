import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHeadDerivedHair01,headDerivedHairline,headDerivedLength} from '../src/female-hair-01-solid-v5.js';

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

test('head mesh itself creates one thick closed crown and attached hair lengths',()=>{
 const {skin,head}=makeHead();
 const original=new Float32Array(skin.geometry.getAttribute('position').array);
 const model=buildHeadDerivedHair01(THREE,skin,{referenceRoot:head,
  headSize:{width:.205,height:.235,depth:.205},color:'#e4bc82'});
 const diagnostics=model.diagnostics();
 assert.equal(diagnostics.sourceHeadOnly,true);
 assert.equal(diagnostics.reusedFormerHairGeometry,false);
 assert.equal(diagnostics.singleContiguousThickWig,true);
 assert.ok(diagnostics.crownTriangles>650);
 assert.ok(diagnostics.borderEdges>35);
 assert.ok(diagnostics.generatedVertices>diagnostics.scalpVertices*2);
 assert.equal(diagnostics.motion,'damped-root-fixed-vertex-sway');
 assert.deepEqual(skin.geometry.getAttribute('position').array,original,
  'the original v121 face mesh must be byte-identical after constructing hair');
 assert.equal(model.root.children.length,1,'one solid mesh instead of multiple disconnected cards');
 const geometry=model.root.children[0].geometry;
 assert.equal(geometry.groups.length,5,'crown, fringe, left, right, back are materials on ONE geometry');
 const indices=geometry.getIndex().array;
 assert.ok(indices.length>3000);
 const edges=new Map();
 for(let k=0;k<indices.length;k+=3)for(const [a,b] of [
  [indices[k],indices[k+1]],[indices[k+1],indices[k+2]],[indices[k+2],indices[k]]]){
  const key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);
 }
 const open=[...edges.values()].filter(n=>n===1).length;
 assert.equal(open,0,'a thick scalp-derived hair surface must not leave bald/open edges');
 model.fitToHead({width:.175,height:.21,depth:.19});
 assert.ok(model.root.scale.x<1);
 model.setSectionVisible('fringe',false);
 assert.equal(model.root.children[0].material[1].visible,false);
 model.setSectionVisible('fringe',true);
 model.setSectionColors(true);model.setSectionColors(false);model.setColor('#bf9260');
 model.setExploded(true);model.setExploded(false);
 const originalMeshPos=new Float32Array(geometry.getAttribute('position').array);
 model.updateMotion(1/30,{motion:'run',time:.15,wind:3});
 let changed=false;
 for(let i=0;i<20;i++)model.updateMotion(1/30,{motion:'run',time:(i+2)/30,wind:3});
 for(let i=0;i<originalMeshPos.length;i++)
  if(Math.abs(originalMeshPos[i]-geometry.getAttribute('position').array[i])>0.00001){changed=true;break;}
 assert.equal(changed,true,'hair tips should swing on motion and wind');
 const tip=model.diagnostics();
 assert.equal(tip.sourceHeadOnly,true);
 model.dispose();
 assert.equal(geometry.disposed,true);
});
test('actual head hairline and grooming lengths expose the forehead and reach shoulders',()=>{
 const h={cx:0,cz:0,rx:.08,rz:.09,brow:.10,top:.18};
 const front=headDerivedHairline(0,.09,h);
 const back=headDerivedHairline(0,-.09,h);
 assert.ok(front>.125&&front<.145,front);
 assert.ok(back<front-.02);
 assert.ok(headDerivedLength(0,.09,h)<.04);
 assert.ok(headDerivedLength(.09,0,h)>.1);
 assert.ok(headDerivedLength(0,-.09,h)>.18);
});
test('the viewer uses only v121 native head input for v5 and has independent sway',()=>{
 const s=readFileSync(new URL('../hair-asset-studio.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../src/female-hair-01-solid-v5.js',import.meta.url),'utf8');
 assert.match(s,/head-derived-hair-modular-v11\.js\?v=11/);
 assert.doesNotMatch(s,/loader\.loadAsync\(item\.path\)/);
 assert.match(s,/sculptHairFromHead\(THREE,scalpSource\.skinMesh/);
 assert.match(s,/current\.updateMotion\(swayTime,\{motion,wind:w,time:timer\}\)/);
 assert.match(code,/skin\.geometry\.clone\(\)/);
 assert.match(code,/insideStart=size/);
 assert.match(code,/return \{verts,faces,boundary\}/);
 assert.doesNotMatch(code,/import .*female-hair|import .*independent-hair|loadAsync\(|SphereGeometry/);
});
