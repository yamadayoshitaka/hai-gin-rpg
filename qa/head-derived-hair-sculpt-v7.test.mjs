import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCULPT_HAIR_STYLES,SCULPT_HAIR_ALL,findSculptHairStyle,
 sculptHairFromHead,sculptHairline,carveHairLength,scalpGroomThickness,sculptedForeheadLength,sculptedOutwardFlow}
 from '../src/head-derived-hair-sculpt-v7.js';

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


test('all 26 genuinely distinct profile IDs and both genders exist',()=>{
 assert.equal(SCULPT_HAIR_STYLES.female.length,12);
 assert.equal(SCULPT_HAIR_STYLES.male.length,14);
 assert.equal(SCULPT_HAIR_ALL.length,26);
 assert.equal(new Set(SCULPT_HAIR_ALL.map(s=>s.id)).size,26);
 for(const profile of SCULPT_HAIR_ALL){
  assert.equal(findSculptHairStyle(profile.id),profile);
  assert.ok(profile.label&&profile.length>0&&profile.volume>.005);
  assert.ok(['curtain','soft','full','side','up'].includes(profile.bang));
 }
 const lengths=new Set(SCULPT_HAIR_ALL.map(s=>Math.round(s.length*1000)));
 assert.ok(lengths.size>12,'must not recycle one identical hair silhouette for every ID');
});
test('all 26 profiles construct from only an unmodified real-mesh proxy and have no open crown',()=>{
 const {skin,head}=makeHead();
 const original=new Float32Array(skin.geometry.getAttribute('position').array);
 const identities=new Set();
 const bounds=new Set();
 for(const profile of SCULPT_HAIR_ALL){
  const hair=sculptHairFromHead(THREE,skin,{
   referenceRoot:head,headSize:{width:.205,height:.235,depth:.205},
   styleId:profile.id,color:'#c9aa78'
  });
  const info=hair.diagnostics();
  assert.equal(info.hairStyle,profile.label);
  assert.equal(info.styleId,profile.id);
  assert.equal(info.oldHairGeometryUsed,false);
  assert.equal(info.oneSolid,true);
  assert.ok(info.crownTriangles>550,profile.id);
  assert.ok(info.boundaryEdges>40,profile.id);
  assert.equal(hair.root.children.length,1);
  const geo=hair.root.children[0].geometry;
  assert.equal(geo.groups.length,5);
  const pos=geo.getAttribute('position').array;
  assert.ok(pos.length>1500,profile.id);
  assert.ok(pos.every(Number.isFinite),'bad vertex at '+profile.id);
  const idx=geo.getIndex().array;
  assert.ok(idx.length>6000,profile.id);
  assert.ok(idx.every(i=>i>=0&&i<pos.length/3),'invalid topology in '+profile.id);
  const edges=new Map();
  for(let k=0;k<idx.length;k+=3){
   for(const [a,b] of [[idx[k],idx[k+1]],[idx[k+1],idx[k+2]],[idx[k+2],idx[k]]]){
    const key=Math.min(a,b)+':'+Math.max(a,b);
    edges.set(key,(edges.get(key)||0)+1);
   }
  }
  const openings=[...edges.values()].filter(count=>count===1).length;
  assert.equal(openings,0,'open boundary / bald scalp at '+profile.id);

  const minY=Math.min(...Array.from(pos).filter((_,i)=>i%3===1));
  bounds.add(Math.round(minY*1000));
  identities.add(hair.root.name);
  hair.setSectionColors(true);hair.setSectionColors(false);
  hair.setSectionVisible('crown',false);hair.setSectionVisible('crown',true);
  hair.setExploded(true);hair.setExploded(false);
  hair.updateMotion(1/30,{motion:'walk',wind:1,time:.4});
  hair.fitToHead({width:.19,height:.235,depth:.195});
  assert.ok(hair.root.scale.x<1);
  hair.dispose();
  assert.equal(geo.disposed,true);
 }
 assert.equal(identities.size,26);
 assert.ok(bounds.size>10,'sculpting must give clearly different overall lengths');
 assert.deepEqual(skin.geometry.getAttribute('position').array,original,
   'the source face must remain byte-identical after all 26 builds');
});
test('hair is physically grown from the real hairline, then carved by smooth length fields',()=>{
 const skull={cx:0,cz:0,rx:.092,rz:.09,top:.185,brow:.112};
 const short=SCULPT_HAIR_STYLES.male[8],long=SCULPT_HAIR_STYLES.female[10];
 const atFront=sculptHairline(0,.09,skull,long);
 const atBack=sculptHairline(0,-.09,skull,long);
 assert.ok(atFront>skull.brow);
 assert.ok(atBack<atFront-.045);
 assert.ok(carveHairLength(0,-.09,skull,long)>carveHairLength(0,-.09,skull,short)*4);
 const a=carveHairLength(.08,0,skull,long);
 const b=carveHairLength(.08001,0,skull,long);
 assert.ok(Math.abs(a-b)<.004,'no abrupt cut or floating strip on adjacent scalp vertices');
});
test('the user-facing catalog never loads source hair GLBs, for female OR male',()=>{
 const studio=readFileSync(new URL('../hair-asset-studio.html',import.meta.url),'utf8');
 const engine=readFileSync(new URL('../src/head-derived-hair-sculpt-v7.js',import.meta.url),'utf8');
 assert.match(studio,/head-derived-hair-sculpt-v7\.js\?v=7/);
 assert.match(studio,/sculptHairFromHead\(THREE,scalpSource\.skinMesh/);
 assert.match(studio,/findSculptHairStyle\(item\.id\)/);
 assert.doesNotMatch(studio,/loader\.loadAsync\(item\.path\)/);
 assert.doesNotMatch(studio,/buildHeadDerivedHair01\(THREE/);
 assert.doesNotMatch(studio,/buildIndependentHairMesh\(THREE/);
 assert.match(studio,/current\.updateMotion\(swayTime/);
 assert.match(engine,/skin\.geometry\.clone\(\)/);
 assert.doesNotMatch(engine,/import .*female-hair|import .*independent-hair|female_hair_01_lod0/);
});

test('v7 removes global helmet bulk and protruding fringe visor for all 26 hairstyles',()=>{
 const h={cx:0,cz:0,rx:.092,rz:.09,top:.185,brow:.112};
 const frontZ=h.cz+h.rz;
 const sideZ=h.cz;
 for(const style of SCULPT_HAIR_ALL){
  for(const x of [-.07,-.03,0,.03,.07]){
   const thickness=scalpGroomThickness(x,.176,.01,h,style);
   assert.ok(Number.isFinite(thickness),style.id);
   assert.ok(thickness<=(style.mohawk?.018:.011),'crown helmet-like bulk for '+style.id+': '+thickness);
   assert.ok(thickness>=.0024,'bald crown from thin negative volume '+style.id);
  }
  const frontalLength=sculptedForeheadLength(0,frontZ,h,style);
  const frontalRoot=sculptHairline(0,frontZ,h,style);
  assert.ok(frontalRoot-frontalLength>h.brow+.005-1e-6,
   style.id+' fringe would cover the eyebrow and eyes');
  const projected=sculptedOutwardFlow(0,1,style);
  assert.ok(projected<.002,'frontal cap-brim protrusion '+style.id+': '+projected);
  assert.ok(sculptedOutwardFlow(Math.PI/2,0,style)===0);
  assert.ok(sculptedOutwardFlow(Math.PI/2,1,style)<.010);
 }
});
test('v7 geometry follows exactly each scalp boundary, never attaching a ring at a guessed point',()=>{
 const code=readFileSync(new URL('../src/head-derived-hair-sculpt-v7.js',import.meta.url),'utf8');
 assert.match(code,/const rootIndex=index\+\(inside\?innerOffset:0\)/);
 assert.match(code,/const rootX=verts\[rootIndex\*3\]/);
 assert.match(code,/scalpGroomThickness\(x,y,z,h,style\)/);
 assert.match(code,/sculptedForeheadLength\(x,z,h,style\)/);
 assert.doesNotMatch(code,/const crownShape=\.0038\+style\.volume\*high/);
 assert.doesNotMatch(code,/style\.part\*\.011\*front/);
});
