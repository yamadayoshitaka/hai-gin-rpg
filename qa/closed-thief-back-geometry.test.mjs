import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clipBodyToGarment} from '../src/character-system/garment-coverage-runtime.js';
import {createRidingPoseController,ridingStyleForCreature} from '../src/character-system/riding-pose.js';

// An imported vest may not have a recognisable material slot, but our actual
// skinned closed-back panel proves that the anatomical torso is covered.
// Reproduce a complete 4002-vertex body with both exposed head and torso.
const verts=4002,positions=new Float32Array(verts*3),indices=[];
const joints=new Uint16Array(verts*4),weights=new Float32Array(verts*4);
const bones=['head','neck_01','pelvis','hand_l'].map(name=>{
 const b=new THREE.Bone();b.name=name;return b;
});
for(let i=0;i<verts;i++){
 positions[i*3]=(i%11)*.004;
 positions[i*3+1]=i<18?1.63:.86;
 positions[i*3+2]=(i%17)*.003;
 joints[i*4]=i<18?0:2;
 weights[i*4]=1;
}
for(let i=0;i+2<verts;i+=3)indices.push(i,i+1,i+2);
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
geometry.setAttribute('skinIndex',new THREE.BufferAttribute(joints,4));
geometry.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
geometry.setIndex(indices);
const material=new THREE.MeshStandardMaterial();
const body=new THREE.SkinnedMesh(geometry,material);
body.name='FullAnimatedBody';
body.bind(new THREE.Skeleton(bones));
const model=new THREE.Group();model.add(body);
const coverage={regions:[],enclosedRegions:[],surfaceMeshes:[],signature:'empty',footCovered:false};
let result=clipBodyToGarment(model,coverage,{surfaceCheck:false});
assert.equal(result.diagnostics.removedTriangles,0,'no robe evidence leaves anatomy untouched');
result.restore();
result=clipBodyToGarment(model,coverage,{surfaceCheck:false,forceCoveredRegions:['torso']});
assert.ok(result.diagnostics.removedTriangles>1000,'actual closed thief back must hide unclothed torso even without source material metadata');
assert.ok(result.diagnostics.keptTriangles>=6,'face/neck triangles must never disappear');
assert.ok(result.diagnostics.regions.includes('torso'));
result.restore();
assert.equal(body.geometry,geometry,'dismount/wardrobe dispose restores authentic source mesh');

const nodes=['pelvis','spine_01','spine_02','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'].map(name=>{
 const b=new THREE.Bone();b.name=name;return b;
});
const seated=createRidingPoseController({traverse(cb){for(const node of nodes)cb(node)}});
assert.equal(seated.jointCount,6);
assert.equal(seated.torsoJointCount,3);
for(const type of ['wolf','horse','dragon','elder_dragon']){
 const style=ridingStyleForCreature(type);
 seated.apply(style);
 assert.equal(seated.applied,true,style);
 assert.ok(nodes[0].quaternion.angleTo(new THREE.Quaternion())>.06,
   type+' must bend the pelvic seat instead of standing');
 seated.restore();
 for(const node of nodes)assert.ok(node.quaternion.angleTo(new THREE.Quaternion())<1e-6,
   type+' dismount must restore clean standing pelvis and all six limbs');
}
console.log('PASS: actual skinned torso triangles hide behind closed thief back; 3 species-specific sitting postures restore');
