import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {FACE_HAIR_RUNTIME_BUILD,createScalpAnchoredWig,
 sadakoCrownSurfaceLayerOffset,sadakoCrownSideOverlayOffset}
 from '../src/face-scalp-wig.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('v59 deployable preview uses the dynamic Sadako implementation',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/costume-mask-buzz-restored-v62$/);
 const body=read('face-body-studio.html'),face=read('face-mesh-studio.html');
 for(const html of [body,face])
  assert.match(html,/20261121-costume-mask-buzz-restored-v62/);
 assert.match(body,/wig\?\.update\(dt\)/);
 assert.match(body,/staticGroom:hairSpec.styleId!=='sadako-straight-long'/);
 assert.match(face,/staticGroom:chosen.styleId!=='sadako-straight-long'/);
});

test('v59 crown root overlap is thin, follows the scalp and not a floating plate',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),
  new THREE.Vector3(1,1,1));
 const root=sadakoCrownSurfaceLayerOffset('crown',.84,0,box);
 const outer=sadakoCrownSurfaceLayerOffset('crown',.84,.27,box);
 const side=sadakoCrownSideOverlayOffset('crown',.45,.29,box,true);
 assert.equal(root,0,'follicle stays on the original head');
 assert.ok(outer>0&&outer<.04,'do not lift planar crown cards into the camera');
 assert.ok(side>0&&side<.055,'crown covers side locks without a radial helmet');
});

test('v59 guides, tenfold fibres and scalp layer follow the moving head',()=>{
 const geometry=new THREE.SphereGeometry(.5,28,20);
 geometry.computeVertexNormals();
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(head,{styleId:'sadako-straight-long',
  color:0x78503a,count:100,staticGroom:false,
  normalLayeredSingleMesh:false,visualFiberMultiplier:3});
 head.add(wig.root);
 const locks=wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
 const fine=wig.root.getObjectByName('DETACHABLE_WIG_FINE_FIBRES');
 const cap=wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
 assert.ok(locks?.isMesh&&fine?.isMesh&&cap?.isMesh);
 const fineStart=fine.geometry.attributes.position.array.slice();
 const capStart=cap.geometry.attributes.position.array.slice();
 const report=wig.getReport();
 assert.equal(report.dynamicHairFollowsHead,true);
 assert.equal(report.dynamicHairGuideSway,true);
 assert.equal(report.dynamicFibreGuideBinding,true);
 assert.ok(report.sadakoCrownFibreCount>0);
 wig.update(.06);
 head.position.x=.15;head.rotation.y=.26;head.updateMatrixWorld(true);
 wig.update(.06);wig.update(.06);wig.update(.06);
 const fineEnd=fine.geometry.attributes.position.array;
 assert.ok(Array.from(fineEnd).some((v,i)=>Math.abs(v-fineStart[i])>1e-6),
  'fine hair must deform along its animated guide, not remain static');
 assert.deepEqual(Array.from(cap.geometry.attributes.position.array),
  Array.from(capStart),'real follicle cap must not animate independently');
 for(const x of fineEnd)assert.ok(Number.isFinite(x));
 wig.dispose();geometry.dispose();head.material.dispose();
});

test('buzz cut remains frozen and does not receive Sadako crown fibres',()=>{
 const geometry=new THREE.SphereGeometry(.5,20,12);
 const head=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 const wig=createScalpAnchoredWig(head,{styleId:'buzz-cut',
  staticGroom:true,normalLayeredSingleMesh:false,count:80});
 assert.equal(wig.getReport().dynamicHairFollowsHead,false);
 assert.equal(wig.getReport().sadakoCrownFibreCount,0);
 wig.dispose();geometry.dispose();head.material.dispose();
});
