import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDetachedHairGeometry} from '../src/hair-island-cleanup-v1.js';
function geometry(){
 const data=[],triangles=[];
 const point=(x,y,z)=>{data.push(x,y,z);return data.length/3-1;};
 const quad=(x,y,w,h,material)=>{
  const a=point(x,y,0),b=point(x+w,y,0),c=point(x+w,y+h,0),
   d=point(x,y+h,0);const start=triangles.length;
  triangles.push(a,b,c,a,c,d);return {start,count:6,materialIndex:material};
 };
 const groups=[];
 groups.push(quad(0,0,.065,.06,0));        // substantial base
 groups.push(quad(.08,-.06,.007,.006,1));  // near hair: keep
 groups.push(quad(.21,.08,.005,.006,1));   // detached tiny floating scrap: remove
 groups.push(quad(-.1,-.17,.005,.14,1));  // genuine long lock: preserve
 const pos={count:data.length/3,
  getX:i=>data[i*3],getY:i=>data[i*3+1],getZ:i=>data[i*3+2]};
 return {
  groups,
  getAttribute(name){return name==='position'?pos:null},
  getIndex(){return {count:triangles.length,getX:i=>triangles[i]}},
  setIndex(data){triangles.length=0;triangles.push(...data)},
  clearGroups(){this.groups=[]},
  addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex})},
  computeBoundingSphere(){this.boundingSphereRecomputed=true},
  computeBoundingBox(){this.boundingBoxRecomputed=true},
  stats:()=>({faces:triangles.length/3,indices:[...triangles]})
 };
}
test('cleanup removes remote floating scrap but retains hair cards',()=>{
 const g=geometry();
 const before=g.stats().faces;
 const r=cleanDetachedHairGeometry(g);
 assert.equal(before,8);
 assert.equal(r.removedTriangles,2);
 assert.equal(r.removedComponents,1);
 assert.equal(r.keptTriangles,6);
 assert.equal(g.stats().faces,6);
 assert.deepEqual(g.groups.map(x=>x.materialIndex),[0,1]);
 assert.ok(g.boundingSphereRecomputed);
});
test('cleanup preserves all disconnected cards when there is no central main group',()=>{
 const g=geometry();
 const r=cleanDetachedHairGeometry(g,{fragmentMaxTriangles:100,fragmentMaxDiagonal:10});
 assert.equal(r.removedTriangles,0);
 assert.equal(g.stats().faces,8);
});
test('cleanup does not mutate the already-filtered source on second pass',()=>{
 const g=geometry();
 const one=cleanDetachedHairGeometry(g);
 const two=cleanDetachedHairGeometry(g);
 assert.ok(one.removedTriangles>0);
 assert.equal(two.removedTriangles,0);
});
