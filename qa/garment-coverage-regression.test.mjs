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
// The ACTUAL Quaternius face has COLOR_0 = normalized Uint8 and COLOR_1 =
// normalized Uint16. The old compactor used getComponent(), then placed the
// normalized 0..1 result into Uint8/Uint16 and turned every color nearly 0.
const n=geometry.getAttribute('position').count;
const skinByteColor=new Uint8Array(n*4),skinShortColor=new Uint16Array(n*4);
for(let i=0;i<n;i++){
 skinByteColor.set([186,139,103,255],i*4);
 skinShortColor.set([49000,32000,18000,65535],i*4);
}
geometry.setAttribute('color',new THREE.Uint8BufferAttribute(skinByteColor,4,true));
geometry.setAttribute('colorSecondary',new THREE.Uint16BufferAttribute(skinShortColor,4,true));
const fullMask=clipBodyToGarment(root,full);
const c8=mesh.geometry.getAttribute('color'),c16=mesh.geometry.getAttribute('colorSecondary');
assert.ok(c8?.normalized&&c16?.normalized,'Both PBR skin vertex color attributes must stay normalized');
for(let i=0;i<c8.count;i++){
 assert.deepEqual(Array.from(c8.array.slice(i*4,i*4+4)),[186,139,103,255],
   'Skin RGB COLOR_0 raw bytes were normalized twice, causing black face');
 assert.deepEqual(Array.from(c16.array.slice(i*4,i*4+4)),[49000,32000,18000,65535],
   'Skin RGB COLOR_1 raw 16-bit values were normalized twice');
}
assert.ok(c8.count<n,'Test must exercise the compaction path, not just copy source');
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


// A front-only garment MUST NOT cut a model's exposed back. Verify the
// spatially sampled mesh surface instead of relying on the label "Body".
const spatialBody=createBody();
const bodyPositions=spatialBody.geometry.getAttribute('position');
const spineIndex=bones.indexOf('spine_03');
for(let tri=0;tri<N;tri++)for(let k=0;k<3;k++){
 const i=(spineIndex*N+tri)*3+k;
 bodyPositions.setZ(i,tri<N/2?.042:-.37);
}
bodyPositions.needsUpdate=true;
const frontPanel=new THREE.Mesh(new THREE.PlaneGeometry(.72,.32,12,8),
 new THREE.MeshBasicMaterial());
frontPanel.position.set(.23,.01,.058);
const frontCoverage={
 regions:['torso'],signature:'torso-front-only',
 surfaceMeshes:[{mesh:frontPanel,regions:['torso']}]
};
const spatial=clipBodyToGarment(spatialBody.root,frontCoverage,{surfaceCheck:true});
let rearTriangles=0,frontTriangles=0;
const retained=spatialBody.mesh.geometry,keptPos=retained.getAttribute('position');
for(let i=0;i<retained.index.count;i+=3){
 const v=retained.index.getX(i),idx=retained.getAttribute('skinIndex').getX(v);
 if(idx!==spineIndex)continue;
 if(keptPos.getZ(v)<-.20)rearTriangles++;else frontTriangles++;
}
assert.ok(spatial.diagnostics.garmentSurfaceSamples>50,
 'Actual garment vertices must be sampled rather than inferred from mesh names');
assert.ok(spatial.diagnostics.removedTriangles>60,
 'Skin immediately behind a front panel must be removed');
assert.ok(rearTriangles>N*.45,
 'Back skin must remain visible where the garment has no rear surface');
assert.ok(frontTriangles<N*.3,
 'Actual cloth panels should hide underlying front skin');
spatial.restore();


// Complete plate limb shells MUST hide the underlying body's entire leg skin,
// even if the armor surface is farther than the spatial sampler tolerance.
// Sparse or one-sided armor must not opt into that unconditional clipping.
const platePieces=[],fittedPieces=[];
for(const side of ['l','r']){
 for(const [slot,boneName] of [['thigh','thigh_'+side],['shin','calf_'+side],['boot-foot','foot_'+side]]){
  const joint=new THREE.Bone();joint.name=boneName;
  const piece=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial());
  piece.userData.equipmentSlot=slot;joint.add(piece);platePieces.push(piece);
 }
 for(const slot of ['trouser-thigh','trouser-calf']){
  const piece=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial());
  piece.userData={equipmentSlot:slot,side};fittedPieces.push(piece);
 }
}
const fullPlate=deriveGarmentCoverage({
 dressed:dressed(false),cloth:{objects:fittedPieces},armor:{objects:platePieces}
});
assert.deepEqual(fullPlate.enclosedRegions,['thigh','calf','foot'],
 'Only complete paired plate pieces can hide a whole leg beneath the outfit');
const incompletePlate=deriveGarmentCoverage({
 dressed:dressed(false),cloth:{objects:fittedPieces},
 armor:{objects:platePieces.filter(piece=>!(
  piece.userData.equipmentSlot==='boot-foot'&&piece.parent.name==='foot_r'))}
});
assert.ok(!incompletePlate.enclosedRegions.includes('foot'),
 'Missing a right boot must preserve exposed right-foot skin');
const coveredBody=createBody(),coveredMesh=coveredBody.mesh;
const fullPlateMask=clipBodyToGarment(coveredBody.root,fullPlate,{surfaceCheck:true});
const exposedSkinBones=new Set();
for(let i=0;i<coveredMesh.geometry.index.count;i+=3){
 const vertex=coveredMesh.geometry.index.getX(i);
 exposedSkinBones.add(bones[coveredMesh.geometry.getAttribute('skinIndex').getX(vertex)]);
}
for(const hiddenBone of ['thigh_l','calf_l','foot_l','ball_l']){
 assert.ok(!exposedSkinBones.has(hiddenBone),
  'Complete plate armor leaked an extra skin leg at '+hiddenBone);
}
for(const required of ['head','neck_01','hand_l']){
 assert.ok(exposedSkinBones.has(required),'The plate must never erase '+required);
}
assert.ok(fullPlateMask.diagnostics.removedTriangles>0);
fullPlateMask.restore();
assert.equal(coveredMesh.geometry,coveredBody.geometry);
console.log('PASS complete plated legs occlude duplicate nude legs without hiding face or hands');
