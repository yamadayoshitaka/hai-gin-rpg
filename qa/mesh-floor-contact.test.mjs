import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleMeshFloor,correctMeshFloor} from '../src/mesh-floor-contact.js';
class Vec {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}fromBufferAttribute(a,i){[this.x,this.y,this.z]=a.data[i];return this;}}
const THREE={Vector3:Vec};
function fixture(ys){
 const root={position:{y:0},visible:true,updateMatrixWorld(){},traverse(fn){fn(mesh);}};
 const mesh={visible:true,isMesh:true,isSkinnedMesh:false,parent:root,geometry:{attributes:{position:{count:ys.length,data:ys.map(y=>[0,y,0])}}},localToWorld(v){v.y+=root.position.y;return v;}};
 return root;
}
test('mesh contact finds lowest actual vertex',()=>{
 const root=fixture([.3,-.25,1.2]);
 const c=sampleMeshFloor({THREE,root});
 assert.equal(c.minY,-.25);assert.equal(c.penetration,.25);
});
test('mesh contact corrects root to floor',()=>{
 const root=fixture([.3,-.25,1.2]);
 const c=correctMeshFloor({THREE,root});
 assert.equal(c.correction,.25);assert.equal(root.position.y,.25);
});
test('mesh contact reports empty actor safely',()=>{
 const root={updateMatrixWorld(){},traverse(){}};
 assert.equal(sampleMeshFloor({THREE,root}).samples,0);
});
