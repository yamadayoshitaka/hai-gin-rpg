import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHair01FromScratch,female01FringeEndY,female01HairlineY} from '../src/female-hair-01-resculpt-v2.js';

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
test('female 01 is built from real head triangles, full crown and independently groomed locks, no old GLB',()=>{
 const {skin,head}=makeHead();
 const originalPositions=new Float32Array(skin.geometry.getAttribute('position').array);
 const hair=buildHair01FromScratch(THREE,skin,{
  referenceRoot:head,headSize:{width:.205,height:.235,depth:.205},
  color:'#d4b26c'
 });
 const diag=hair.diagnostics();
 assert.equal(diag.rebuilt,true);
 assert.equal(diag.legacySourceUsed,false);
 assert.ok(diag.crownTriangles>1500,JSON.stringify(diag));
 assert.ok(diag.triangles>25000,JSON.stringify(diag));
 assert.equal(hair.root.children.length,6,'one skin-derived crown plus five modeled sections');
 assert.ok(hair.sectionCounts.fringe>2000);
 assert.ok(hair.sectionCounts.left>4000);
 assert.ok(hair.sectionCounts.right>4000);
 assert.ok(hair.sectionCounts.back>4000);
 assert.deepEqual(skin.geometry.getAttribute('position').array,originalPositions,'v121 face must remain untouched');
 hair.fitToHead({width:.18,height:.21,depth:.18});
 assert.ok(Math.abs(hair.root.scale.x-.18/.205)<.0001);
 hair.deformTips(.05,.03);
 hair.setSectionColors(true);
 hair.setSectionColors(false);
 hair.setExploded(true);
 hair.setExploded(false);
 hair.setSectionVisible('fringe',false);
 hair.setSectionVisible('fringe',true);
 hair.setColor('#a27641');
 hair.dispose();
 assert.equal(hair.root.children[0].geometry.disposed,true);
});
test('viewer uses the fully rebuilt hair 01 before attempting to load a legacy GLB',()=>{
 const studio=readFileSync(new URL('../hair-asset-studio.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../src/female-hair-01-resculpt-v2.js',import.meta.url),'utf8');
 assert.match(studio,/findSculptHairStyle\(item\.id\)/);
 assert.doesNotMatch(studio,/loader\.loadAsync\(item\.path\)/);
 assert.match(studio,/sculptHairFromHead\(THREE,scalpSource\.skinMesh/);
 assert.match(studio,/\$\('capToggle'\)\.disabled=true/);
 assert.match(code,/skin\.geometry\.clone\(\)/);
 assert.match(code,/geometry\.setIndex\(kept\)/);
 assert.doesNotMatch(code,/SphereGeometry|new GLTFLoader|female_hair_01_lod0/);
});

test('female 01 eye and eyebrow clearance uses safe forehead cut and short tips',()=>{
 const h={width:.205,height:.235,depth:.205};
 for(let i=0;i<38;i++){
  const y=female01FringeEndY(h,i);
  assert.ok(y>.067 && y<.074,'fringe crosses v121 eyes: '+y);
 }
 const front=female01HairlineY(h,0,h.depth*.50);
 assert.ok(front>.068,'opaque crown covers the eye area '+front);
 assert.ok(front<.085,'hairline recedes unnaturally '+front);
 const rear=female01HairlineY(h,0,-h.depth*.50);
 assert.ok(rear<front,'rear scalp coverage must extend lower than forehead');
 const studio=readFileSync(new URL('../hair-asset-studio.html',import.meta.url),'utf8');
 assert.match(studio,/id="hairVersion"/);
 assert.match(studio,/配信コミット/);
 assert.match(studio,/sculptHairFromHead/);
 assert.match(studio,/head-derived-hair-sculpt-v8\.js\?v=8/);
 assert.doesNotMatch(studio,/通常表示は元GLBの連続した髪/);
});
