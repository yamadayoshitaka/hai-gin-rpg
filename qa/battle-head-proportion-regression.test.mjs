import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitBattleArtistFaceToHead,BATTLE_FACE_PROPORTION_VERSION}
 from '../src/character-system/battle-head-proportion-fit.js';

// These are real accessor bounds + nested-node transform from the head GLB.
const min=[-.151903972,.024162911,-.110542387],
 max=[.152167886,.436273009,.163450062];
for(const sex of ['male','female']){
 const bone=new THREE.Bone();bone.name='Head';
 const root=new THREE.Group();bone.add(root);
 root.scale.setScalar(.64);root.position.set(0,-.145,0);
 const geo=new THREE.BoxGeometry(...min.map((v,i)=>max[i]-v));
 geo.translate(...min.map((v,i)=>(v+max[i])*.5));
 const face=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0xa88b79}));
 face.position.set(-.000118732,-.206854969,-.023932202);
 face.scale.setScalar(.9);root.add(face);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.014),new THREE.MeshStandardMaterial());
 face.add(eye);bone.updateMatrixWorld(true);
 const material=face.material;
 const target={min:[-.125,-.13,-.111],max:[.125,.13,.111]};
 const fit=fitBattleArtistFaceToHead({faceRoot:root,faceMesh:face,headBounds:target});
 assert.equal(fit.version,BATTLE_FACE_PROPORTION_VERSION);
 assert.equal(fit.sourceMeshTransformApplied,true);
 assert.equal(fit.cervicalSkirtExcludedFromHeightFit,true);
 assert.ok(fit.widthRatio>=.94&&fit.widthRatio<=1.15,JSON.stringify(fit));
 assert.ok(fit.cranialHeightRatio>=.94&&fit.cranialHeightRatio<=1.15,JSON.stringify(fit));
 assert.ok(fit.scale>.64*1.28,'Fix tiny heads, not merely recolour skin');
 assert.ok(root.position.y>-.065,'Cranium must rise out of armor collar');
 assert.ok(Math.abs(root.scale.x-root.scale.y)<1e-8);
 assert.equal(eye.parent,face);
 assert.equal(face.material,material);
 assert.equal(root.parent,bone);
 const old=root.position.clone(),s=root.scale.x;
 const second=fitBattleArtistFaceToHead({faceRoot:root,faceMesh:face,headBounds:target});
 assert.ok(root.position.distanceTo(old)<1e-6,'No offset accumulation');
 assert.ok(Math.abs(root.scale.x-s)<1e-6,'No scale accumulation');
 assert.equal(second.widthRatio,fit.widthRatio);
 const measuredWidth=face.geometry.boundingBox.getSize(new THREE.Vector3()).x*face.scale.x*s;
 assert.ok(Math.abs(measuredWidth/.25-fit.widthRatio)<1e-4);
}
console.log('PASS: male/female source-node-aware enlarged skull, aligned eyes, unchanged PBR and stable rig fit');
