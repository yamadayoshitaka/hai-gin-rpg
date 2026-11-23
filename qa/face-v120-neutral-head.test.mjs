import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const path='assets/generated/neutral-face-v120.glb';
function glb(){
 const bytes=readFileSync(path);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const len=bytes.readUInt32LE(12);
 return {bytes,gltf:JSON.parse(bytes.toString('utf8',20,20+len))};
}
test('baked neutral v120 has 13,455 indexed skin vertices and no facial animation',()=>{
 const {gltf,bytes}=glb();
 assert.ok(bytes.length>400000);
 const skin=gltf.meshes[0],extra=skin.extras,p=skin.primitives[0];
 assert.equal(extra.neutralOnly,true);
 assert.equal(extra.futureExpressionsImplemented,false);
 assert.equal(extra.hairIncluded,false);
 assert.equal(extra.topology.vertices,13455);
 assert.equal(extra.topology.triangles,25920);
 assert.equal(gltf.accessors[p.attributes.POSITION].count,13455);
 assert.equal(gltf.accessors[p.attributes.NORMAL].count,13455);
 assert.equal(gltf.accessors[p.attributes.TEXCOORD_0].count,13455);
 assert.equal(gltf.accessors[p.indices].count,25920*3);
 assert.equal(p.targets,undefined);
 assert.equal(gltf.animations,undefined);
 assert.ok(Object.keys(extra.futureRigZones).length>=6);
 assert.ok(extra.futureRigZones.mouth.length>10);
 assert.ok(extra.futureRigZones.leftEye.length>10);
 assert.ok(extra.futureRigZones.rightEye.length>10);
});
test('v120 remains separate from the existing 3490-vertex v119 game editor',()=>{
 const html=readFileSync('face-neutral-v120.html','utf8');
 const legacy=readFileSync('face-mesh-studio.html','utf8');
 const pages=readFileSync('scripts/prepare-pages-site.py','utf8');
 assert.match(html,/GLTFLoader/);
 assert.match(html,/assets\/generated\/neutral-face-v120\.glb/);
 assert.match(html,/hai-gin-neutral-face-v120-rig-map\.json/);
 assert.match(html,/dataset\.neutralFaceReady='v120'/);
 assert.match(legacy,/href="\.\/face-neutral-v120\.html\?v=120"/);
 assert.match(legacy,/dataset\.faceMeshReady='v119'/);
 assert.match(pages,/assets\/generated\/neutral-face-v120\.glb/);
});
