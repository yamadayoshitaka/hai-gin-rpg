import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {constructGradedEntryDoor} from '../src/world-graded-entry-doors.js';
class Geometry {constructor(...args){this.args=args}}
class BoxGeometry extends Geometry{}
class CylinderGeometry extends Geometry{}
class SphereGeometry extends Geometry{}
class TorusGeometry extends Geometry{}
class MeshStandardMaterial {constructor(p){Object.assign(this,p)}}
class Mesh {
 constructor(geometry,material){
  this.geometry=geometry;this.material=material;
  this.rotation={x:0,y:0,z:0};
  this.position={x:0,y:0,z:0,set:(x,y,z)=>{this.position.x=x;this.position.y=y;this.position.z=z}};
  this.scale={set:(x,y,z)=>{this.scale.x=x;this.scale.y=y;this.scale.z=z}};
 }
}
const THREE={Mesh,BoxGeometry,CylinderGeometry,SphereGeometry,TorusGeometry,MeshStandardMaterial};
const materials={wood:new MeshStandardMaterial({name:'wood'}),iron:new MeshStandardMaterial({name:'iron'}),
 ornament:new MeshStandardMaterial({name:'ornament'})};
const namesByLevel=[];
for(let level=1;level<=5;level++){
 const root={children:[],userData:{},add(item){this.children.push(item)}};
 assert.equal(constructGradedEntryDoor(THREE,root,{level,cellSize:2.2,...materials}),root);
 const count=name=>root.children.filter(x=>x.name?.startsWith(name)).length;
 const plankCount=level>=4?10:8,bandCount=level>=4?3:2;
 assert.equal(count('door_vertical_timber_stave_'),plankCount);
 assert.equal(count('door_loadbearing_jamb'),2);
 assert.equal(count('door_loadbearing_lintel'),1);
 assert.equal(count('door_horizontal_reinforcement_'),bandCount);
 assert.equal(count('door_hinge_knuckle_'),bandCount);
 assert.equal(count('door_strap_rivet_'),bandCount*4);
 assert.equal(count('door_rear_diagonal_brace'),level>=3?2:0);
 assert.equal(count('door_upper_corner_boss'),level>=3?2:0);
 assert.equal(count('door_castle_edge_fillet'),level===5?2:0);
 assert.equal(count('door_lock_plate'),1);
 assert.equal(count('door_keyhole_oval'),1);
 assert.equal(count('door_functional_ring_handle'),1);
 assert(root.children.every(m=>m.castShadow&&m.receiveShadow));
 assert(root.children.every(m=>[m.position.x,m.position.y,m.position.z].every(Number.isFinite)));
 assert(root.children.every(m=>m.geometry.args.every(v=>typeof v!=='number'||v>0)));
 assert(root.children.every(m=>m.material===materials.wood||m.material===materials.iron||
  m.material===materials.ornament||m.material instanceof MeshStandardMaterial));
 assert.equal(root.userData.doorPhysicalConstruction.level,level);
 assert.equal(root.userData.doorPhysicalConstruction.realThickness,true);
 assert.equal(root.userData.doorPhysicalConstruction.hinges,bandCount);
 namesByLevel.push(root.children.map(x=>x.name));
}
assert.notDeepEqual(namesByLevel[1],namesByLevel[4],'level-five castle door has more actual metal geometry');
assert.throws(()=>constructGradedEntryDoor(THREE,{add(){}},{level:6,...materials}),/level/);
assert.throws(()=>constructGradedEntryDoor(THREE,{add(){}},{level:2,cellSize:0,...materials}),/cellSize/);
const catalog=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
assert.match(catalog,/import \{constructGradedEntryDoor\} from '\.\/world-graded-entry-doors\.js'/);
assert.match(catalog,/constructGradedEntryDoor\(THREE,root,\{level,cellSize:c,wood,iron,ornament\}\)/);
assert.match(catalog,/entryDoor=\{lockLevel:level,side:'south',entranceOnly:true\}/);
for(let level=1;level<=5;level++)assert(catalog.includes(`entry_door_lv${level}_001`));
console.log('PASS: all five catalog lock levels use real timber staves, load-bearing jambs, level-specific hinges/locks/metal fasteners');
