import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBarrelStaveGeometry,addRealisticWoodBarrel,addWellConstructionDetails}
 from '../src/world-craft-props.js';
class BufferGeometry {
 constructor(){this.attributes={};this.userData={}}
 setAttribute(name,value){this.attributes[name]=value;return this}
 computeVertexNormals(){this.normalsComputed=true}
}
class Float32BufferAttribute {
 constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize}
}
class Vector2 {constructor(x,y){this.x=x;this.y=y}}
class Geometry {constructor(...args){this.args=args}}
class Mesh {
 constructor(geometry,material){
  this.geometry=geometry;this.material=material;this.rotation={x:0,y:0,z:0};
  this.position={set:(...xyz)=>{this.position.xyz=xyz}};
 }
}
const THREE={
 BufferGeometry,Float32BufferAttribute,Vector2,Mesh,BackSide:'BACK',
 LatheGeometry:Geometry,CylinderGeometry:Geometry,CircleGeometry:Geometry,
 RingGeometry:Geometry,TorusGeometry:Geometry
};
const wood={id:'wood'},dark={id:'dark'},iron={id:'iron'};
const stone={id:'stone',clone(){return {...this}}};
const createRoot=()=>({children:[],userData:{},add(node){this.children.push(node)}});
for(const c of [1,2.2]){
 const g=createBarrelStaveGeometry(THREE,{cellSize:c,staves:18,segments:8});
 const p=g.attributes.position.array,u=g.attributes.uv.array;
 assert.equal(p.length,18*(8*4*6+2*6)*3,'closed stave faces: exterior, interior, joints and caps');
 assert.equal(u.length,p.length/3*2);
 assert(p.every(Number.isFinite),'no NaN/Inf in finished stave volume');
 assert(u.every(Number.isFinite),'wood UVs are valid');
 assert(g.normalsComputed);
 assert(g.userData.closedThicknessMetres>0);
 const ys=p.filter((_,i)=>i%3===1);
 assert(Math.min(...ys)>=0&&Math.max(...ys)<=1.151*c,'staves land on ground and keep authored height');
 const xs=p.filter((_,i)=>i%3===0);
 assert(Math.max(...xs)>c*.52,'actual barrel belly is wider than both wooden ends');
 const root=createRoot();
 addRealisticWoodBarrel(THREE,root,{cellSize:c,wood,dark,metal:iron});
 assert(root.children.find(x=>x.name==='barrel_18_closed_wood_staves')?.geometry instanceof BufferGeometry);
 assert.equal(root.children.filter(x=>x.name?.startsWith('barrel_iron_hoop_')).length,3);
 assert(root.children.find(x=>x.name==='barrel_solid_recessed_head'));
 assert(root.children.find(x=>x.name==='barrel_head_bung'));
 assert(root.children.every(x=>x.castShadow===true&&x.receiveShadow===true));
 assert.equal(root.userData.physicalConstruction.staves,18);
}
const well=createRoot();
addWellConstructionDetails(THREE,well,{cellSize:2.2,stone,wood,iron});
for(const part of ['well_inner_masonry_wall','well_structural_thick_coping',
 'well_windlass_axle','well_windlass_rope_drum','well_windlass_crank',
 'well_tapered_wood_bucket','well_bucket_solid_base',
 'well_bucket_swing_handle','well_taut_windlass_rope']){
 assert(well.children.some(child=>child.name===part),'well missing physically meaningful part '+part);
}
assert.equal(well.children.filter(x=>x.name==='well_drum_iron_flange').length,2);
assert.equal(well.children.filter(x=>x.name==='well_masonry_course_joint').length,3);
assert.equal(well.userData.physicalConstruction.hollowWall,true);
assert.equal(well.userData.physicalConstruction.winch,true);
assert(well.children.every(x=>x.castShadow&&x.receiveShadow));
assert.throws(()=>createBarrelStaveGeometry(THREE,{cellSize:0}),/cellSize/);
assert.throws(()=>createBarrelStaveGeometry(THREE,{staves:2}),/stave/);
const catalog=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
assert(catalog.includes("import {addRealisticWoodBarrel,addWellConstructionDetails} from './world-craft-props.js'"));
assert(catalog.includes("if(id==='cottage_barrel_001')addRealisticWoodBarrel("));
assert(catalog.includes("addWellConstructionDetails(THREE,root,{cellSize:c,stone,wood,iron})"));
console.log('PASS: actual catalog barrel staves are closed/curved with metal hoops; well has 3D masonry, windlass, bucket and rope');
