import assert from 'node:assert/strict';
import * as THREE from 'three';
import {deriveGarmentCoverage,clipBodyToGarment,originalSkinGeometry} from '../src/character-system/garment-coverage-runtime.js';

// Distinct garment pieces, not hard-coded globally hidden feet, determine what
// disappears. Synthetic triangles use the real 65-bone style skin attributes.
const N=490;
const bones=['head','neck_01','spine_03','pelvis','upperarm_l','lowerarm_l',
 'hand_l','thigh_l','calf_l','foot_l','ball_l','thumb_01_l','unknown_custom_joint'];
function createBody(geometry=null){
 const root=new THREE.Group();
 const skeletonBones=bones.map(name=>{const b=new THREE.Bone();b.name=name;return b});
 const g=geometry||new THREE.BufferGeometry();
 if(!geometry){
  const pos=[],weights=[],skin=[],indices=[];
  for(let bone=0;bone<bones.length;bone++)for(let tri=0;tri<N;tri++){
   for(let k=0;k<3;k++){
    pos.push(bone*.1+tri*.00001,k*.01,0);
    skin.push(bone,0,0,0);
    weights.push(1,0,0,0);
    indices.push(indices.length);
   }
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skin,4));
  g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  g.setIndex(indices);
 }
 const mesh=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial());
 mesh.name='Sphere.005_Retopology.004';
 root.add(mesh);
 mesh.bind(new THREE.Skeleton(skeletonBones));
 return {root,mesh,geometry:g};
}
function garmentMesh(name,material='MI_Peasant'){
 const mesh=new THREE.SkinnedMesh(new THREE.BoxGeometry(.1,.1,.1),
   new THREE.MeshBasicMaterial({name:material}));
 mesh.name=name;return mesh;
}
function dressed(hasFeet){
 const root=new THREE.Group();
 for(const part of ['Body','Arms','Legs',...(hasFeet?['Feet']:[])])
  root.add(garmentMesh('Male_Peasant_'+part));
 root.add(garmentMesh('Male_Peasant_Arms_skin','MI_Regular_Male'));
 return root;
}
const full=deriveGarmentCoverage({dressed:dressed(true)});
assert.ok(full.footCovered);
assert.deepEqual(full.regions,['calf','foot','lowerarm','thigh','torso','upperarm']);
const short=deriveGarmentCoverage({dressed:dressed(true),style:{sleeve:'short'}});
assert.ok(!short.regions.includes('lowerarm'),'Short sleeves must preserve exposed forearms');
const bare=deriveGarmentCoverage({dressed:dressed(false)});
assert.ok(!bare.footCovered,'Barefoot jobs must retain real feet');
const {root,mesh,geometry}=createBody(),start=geometry.index.count;
const fullMask=clipBodyToGarment(root,full);
assert.ok(fullMask.diagnostics.removedTriangles>0,'Real covered triangles must be removed');
assert.ok(fullMask.diagnostics.keptTriangles<start/3);
assert.ok(fullMask.diagnostics.keptVertices<fullMask.diagnostics.sourceVertices,
 'All covered skin vertices must be compacted out of the GPU buffer');
assert.ok(mesh.geometry.getAttribute('skinIndex')&&mesh.geometry.getAttribute('skinWeight'),
 'Compaction must preserve joint indices and weights');
assert.ok(fullMask.diagnostics.skinnedMeshes===1);
const zones=new Set();
for(let i=0;i<mesh.geometry.index.count;i+=3){
 const v=mesh.geometry.index.getX(i);
 zones.add(bones[mesh.geometry.getAttribute('skinIndex').getX(v)]);
}
for(const keep of ['head','neck_01','hand_l','thumb_01_l','unknown_custom_joint'])
 assert.ok(zones.has(keep),'Exposed anatomy was lost: '+keep);
for(const hide of ['spine_03','upperarm_l','thigh_l','calf_l','foot_l','ball_l'])
 assert.ok(!zones.has(hide),'Covered skin leaked through clothes: '+hide);
const second=createBody(geometry);
const secondMask=clipBodyToGarment(second.root,full);
assert.equal(second.mesh.geometry,mesh.geometry,
 'Identical skinned assets must share the cached cut geometry');
const secondOnSameMesh=clipBodyToGarment(root,bare);
assert.equal(originalSkinGeometry(mesh),geometry,
 'Fit measurements must always access the uncut body under overlapping outfits');
fullMask.restore();fullMask.restore();
assert.equal(mesh.geometry.getAttribute('position').count,
 secondOnSameMesh.diagnostics.keptVertices,
 'Disposing an earlier outfit must not unmask a newer outfit');
secondOnSameMesh.restore();
assert.equal(mesh.geometry,geometry,'Removing costume must restore the original body');
assert.ok(second.mesh.geometry!==geometry,'Releasing one soldier cannot unmask another');
secondMask.restore();assert.equal(second.mesh.geometry,geometry);
assert.equal(geometry.index.count,start,'Shared source geometry must never be modified');
const barefoot=clipBodyToGarment(root,bare);
let visibleFoot=false;
for(let i=0;i<mesh.geometry.index.count;i+=3){
 const vertex=mesh.geometry.index.getX(i);
 const bone=bones[mesh.geometry.getAttribute('skinIndex').getX(vertex)];
 if(bone==='foot_l'){visibleFoot=true;break}
}
assert.ok(visibleFoot,'Bare feet were clipped without any covering boots');
barefoot.restore();
const shortMask=clipBodyToGarment(root,short);
let shortArmVisible=false;
for(let i=0;i<mesh.geometry.index.count;i+=3){
 const v=mesh.geometry.index.getX(i);
 if(bones[mesh.geometry.getAttribute('skinIndex').getX(v)]==='lowerarm_l')shortArmVisible=true;
}
assert.ok(shortArmVisible,'Short-sleeve forearm must remain visible');
shortMask.restore();
console.log('PASS garment-first skin clipping, exposed boundaries, boots, cache and restore');
