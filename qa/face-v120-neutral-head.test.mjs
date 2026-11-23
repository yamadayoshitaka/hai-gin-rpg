import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNeutralFaceV120,NEUTRAL_FACE_V120} from '../src/neutral-face-v120.js';

test('neutral v120 has new deterministic indexed face, no old donor and no expressions',()=>{
 const a=createNeutralFaceV120(),b=createNeutralFaceV120();
 const geometry=a.skin.geometry,pos=geometry.getAttribute('position'),idx=geometry.getIndex();
 assert.equal(NEUTRAL_FACE_V120.version,120);
 assert.equal(pos.count,144*(112+1)+2);
 assert.ok(pos.count>16000);
 assert.ok(idx.count/3>32000);
 assert.deepEqual(Array.from(pos.array),Array.from(b.skin.geometry.attributes.position.array));
 assert.deepEqual(Array.from(idx.array),Array.from(b.skin.geometry.index.array));
 assert.ok(a.parts.children.length>=7);
 assert.equal(a.root.children.length,2);
 assert.equal(a.metrics.hairIncluded,false);
 assert.equal(a.metrics.hasMorphTargets,false);
 assert.equal(a.metrics.sourceGeometryUsed,false);
 assert.equal(geometry.morphAttributes.position,undefined);
});
test('face landmarks and preserved per-vertex rig zones are symmetric',()=>{
 const {root,skin}=createNeutralFaceV120();
 const g=skin.geometry,p=g.getAttribute('position'),N=144;
 const l=root.userData.restLandmarks.leftEye,r=root.userData.restLandmarks.rightEye;
 assert.ok(Math.abs(l[0]+r[0])<1e-9&&Math.abs(l[1]-r[1])<1e-9);
 assert.ok(root.userData.restLandmarks.noseTip[2]>l[2]+.018);
 assert.ok(root.userData.restLandmarks.chin[1]<root.userData.restLandmarks.lowerLip[1]);
 const z=g.userData.regionVertexIds;
 assert.ok(z.mouth.length>100&&z.leftEye.length>100);
 assert.equal(z.leftEye.length,z.rightEye.length);
 assert.equal(g.getAttribute('uv').count,p.count);
 assert.equal(g.getAttribute('normal').count,p.count);
 assert.ok(Array.from(p.array).every(Number.isFinite));
 assert.ok(Array.from(g.getAttribute('normal').array).every(Number.isFinite));
 const front=Math.round(.52*112)*N+N/2;
 assert.ok(p.getZ(front)>.075);
 assert.ok(g.getAttribute('normal').getZ(front)>.3,'normal front points outwards');
});
test('new head neutral skin is a closed manifold with no holes',()=>{
 const g=createNeutralFaceV120().skin.geometry,ids=g.getIndex().array,edges=new Map();
 const add=(a,b)=>{
  const key=(a<b?a+':'+b:b+':'+a);
  edges.set(key,(edges.get(key)||0)+1);
 };
 for(let i=0;i<ids.length;i+=3){
  const a=ids[i],b=ids[i+1],c=ids[i+2];
  assert.ok(a!==b&&b!==c&&c!==a);
  add(a,b);add(b,c);add(c,a);
 }
 assert.ok([...edges.values()].every(x=>x===2),'every edge has exactly 2 adjacent triangles');
});
test('new face preview exports real GLB and future rig-map without changing v119',()=>{
 const html=readFileSync(new URL('../face-neutral-v120.html',import.meta.url),'utf8');
 const legacy=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 assert.match(html,/createNeutralFaceV120/);
 assert.match(html,/GLTFExporter/);
 assert.match(html,/hai-gin-neutral-face-v120\.glb/);
 assert.match(html,/hai-gin-neutral-face-v120-rig-map\.json/);
 assert.match(html,/data-camera="side"/);
 assert.match(legacy,/href="\.\/face-neutral-v120\.html\?v=120"/);
 assert.match(legacy,/dataset\.faceMeshReady='v119'/);
});
