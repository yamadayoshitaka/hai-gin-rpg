// Garment-first skin occlusion. The real equipped meshes decide which body
// regions are covered; the naked character is NOT allowed to render through
// trousers, boots or armor. Preserve exposed face, neck and finger skin.
// This module never performs a CSG cut per frame or mutates shared source GLBs.
import * as THREE from 'three';
import {buildGarmentSurfaceCoverage} from './garment-surface-coverage.js?v=4.4.93';
const maskCache=new WeakMap();
// Each live skinned body can be referenced by more than one asynchronous
// costume build. A disposed old outfit must NOT unmask a newer outfit.
const activeMasks=new WeakMap();
export function originalSkinGeometry(mesh){
 return activeMasks.get(mesh)?.source||mesh.geometry;
}
const protectedBones=/^(?:head|neck(?:_\d+)?|hand_[lr]|(?:thumb|index|middle|ring|pinky)_(?:\d+|leaf).*_[lr])$/;
const garmentMaterial=/mi_(?:ranger|peasant)|(?:cloth|linen|damask|metal|leather)/i;
const garmentName=/(?:ranger|peasant)_(?:body|arms|legs|feet)/i;
const orderedRegions=['torso','upperarm','lowerarm','thigh','calf','foot'];
function category(boneName){
 const name=String(boneName||'').toLowerCase();
 if(protectedBones.test(name)||/^(?:eye|jaw|ear|finger)/.test(name))return 'exposed';
 if(/^foot_[lr]$|^ball_[lr]$|^toe/.test(name))return 'foot';
 if(/^calf_[lr]$/.test(name))return 'calf';
 if(/^thigh_[lr]$/.test(name))return 'thigh';
 if(/^upperarm_[lr]$|^clavicle_[lr]$/.test(name))return 'upperarm';
 if(/^lowerarm_[lr]$/.test(name))return 'lowerarm';
 if(/^pelvis$|^root$|^spine(?:_\d+)?$/.test(name))return 'torso';
 return 'unknown'; // unrecognised anatomy must NEVER be cut blindly
}
const hiddenZoneMap={
 body:['torso'],
 arms:['upperarm','lowerarm'],
 legs:['thigh','calf'],
 feet:['foot']
};
const clothZoneMap={
 'upper-sleeve':['upperarm'],
 'forearm-sleeve':['lowerarm'],
 'trouser-thigh':['thigh'],
 'trouser-calf':['calf']
};
const armorZoneMap={
 chest:['torso'],hip:['torso'],shoulder:['upperarm'],
 gauntlet:['lowerarm'],thigh:['thigh'],knee:['calf'],shin:['calf'],
 'boot-upper':['calf'],'boot-foot':['foot']
};
export function deriveGarmentCoverage({dressed,cloth=null,armor=null,style=null}={}){
 const covered=new Set(),sources=new Set(),surfaceMap=new Map();
 const addSurface=(mesh,regions)=>{
  if(!mesh?.geometry?.getAttribute?.('position')||!regions?.length)return;
  let zones=surfaceMap.get(mesh);
  if(!zones){zones=new Set();surfaceMap.set(mesh,zones)}
  for(const zone of regions)zones.add(zone);
 };
 const add=(regions,origin)=>{if(!regions?.length)return;
  for(const region of regions)covered.add(region);
  sources.add(origin);
 };
 dressed?.traverse?.(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible||!garmentName.test(mesh.name))return;
  // Some Ranger arm meshes are exposed human skin, not sleeves. Only a
  // material/mesh representing real garment fabric establishes coverage.
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!mats.some(mat=>garmentMaterial.test(mat?.name||'')&&!/(?:skin|flesh|nude)/i.test(mat?.name||'')))return;
  if(/(?:skin|flesh|nude)/i.test(mesh.name))return;
  const match=/(?:ranger|peasant)_(body|arms|legs|feet)/i.exec(mesh.name);
  if(match){
   const slot=match[1].toLowerCase();
   // A short-sleeve tunic does not cover the forearm. Source arm meshes
   // frequently include BOTH fabric and exposed skin on the same rig.
   const regions=slot==='arms'&&style?.sleeve==='short'?['upperarm']:hiddenZoneMap[slot];
   add(regions,'garment:'+slot);
   addSurface(mesh,regions);
  }
 });
 for(const piece of cloth?.objects||[]){
  if(piece.visible===false)continue;
  const slot=piece.userData?.equipmentSlot;
  add(clothZoneMap[slot], 'cloth:'+slot);
  addSurface(piece,clothZoneMap[slot]);
 }
 for(const piece of armor?.objects||[]){
  if(piece.visible===false)continue;
  const slot=piece.userData?.equipmentSlot;
  add(armorZoneMap[slot], 'armor:'+slot);
  addSurface(piece,armorZoneMap[slot]);
 }
 // No guessed shoes: if no actual footwear mesh is equipped, keep skin feet.
 return Object.freeze({
  regions:Object.freeze([...covered].sort()),
  sources:Object.freeze([...sources].sort()),
  surfaceMeshes:Object.freeze([...surfaceMap].map(([mesh,regions])=>Object.freeze({mesh,regions:Object.freeze([...regions])}))),
  signature:orderedRegions.filter(name=>covered.has(name)).join('|')||'uncovered',
  footCovered:covered.has('foot'),
  seamPolicy:'preserve-exposed-rim',
  cutoff:'bone-weighted-triangle-mask'
 });
}
// Remove dead vertices and their GPU attributes after the index cut. A pure
// index-mask left the entire nude body vertex buffer on the GPU even though
// most of its triangles could never be drawn.
function compactMaskedGeometry(original,kept){
 const noMorph=Object.values(original.morphAttributes||{}).every(items=>!items?.length);
 const eligible=noMorph&&(original.groups?.length||0)<=1;
 const geometry=original.clone();
 if(!eligible){geometry.setIndex(kept);return {geometry,vertices:original.getAttribute('position').count}}
 const positions=original.getAttribute('position'),remap=new Int32Array(positions.count).fill(-1);
 const used=[],indices=new Array(kept.length);
 for(let i=0;i<kept.length;i++){
  const old=kept[i];
  if(remap[old]<0){remap[old]=used.length;used.push(old)}
  indices[i]=remap[old];
 }
 for(const [name,attribute] of Object.entries(original.attributes)){
  const itemSize=attribute.itemSize;
  const array=new attribute.array.constructor(used.length*itemSize);
  for(let i=0;i<used.length;i++)for(let j=0;j<itemSize;j++){
   // BufferAttribute.getComponent() DENORMALIZES integer attributes when
   // normalized=true: COLOR_0 is Uint8(0..255) and COLOR_1 is Uint16.
   // Writing its returned 0..1 float into a typed integer array destroys
   // the original RGB byte range and renders the exposed face pitch black.
   // Copy the underlying raw storage to preserve *all* PBR vertex channels.
   array[i*itemSize+j]=attribute.isInterleavedBufferAttribute
     ?attribute.data.array[used[i]*attribute.data.stride+attribute.offset+j]
     :attribute.array[used[i]*itemSize+j];
  }
  geometry.setAttribute(name,new THREE.BufferAttribute(array,itemSize,attribute.normalized));
 }
 geometry.setIndex(indices);
 return {geometry,vertices:used.length};
}
export function clipBodyToGarment(characterModel,coverage,{surfaceCheck=false}={}){
 const hidden=new Set(coverage?.regions||[]);
 const sampler=surfaceCheck?buildGarmentSurfaceCoverage(coverage?.surfaceMeshes):null;
 const entries=[],measure={sourceTriangles:0,keptTriangles:0,removedTriangles:0,
  surfaceChecked:surfaceCheck,garmentSurfaceSamples:sampler?.samples||0,
  skinnedMeshes:0,regions:[...hidden],footCovered:hidden.has('foot'),sourceVertices:0,keptVertices:0};
 if(!hidden.size)return {restore(){},diagnostics:measure};
 characterModel.traverse(mesh=>{
  // Face, eyes, lashes and hair are separate, small skinned meshes and must
  // remain untouched. The Superhero body skin has >4000 vertices.
  if(!mesh.isSkinnedMesh||!mesh.geometry?.index)return;
  const original=originalSkinGeometry(mesh),positions=original.getAttribute('position');
  if(!positions||positions.count<4000)return;
  const joints=original.getAttribute('skinIndex'),weights=original.getAttribute('skinWeight');
  if(!joints||!weights||!mesh.skeleton)return;
  const zones=mesh.skeleton.bones.map(b=>category(b.name));
  if(!zones.includes('exposed'))return; // cannot verify facial continuity
  let variants=maskCache.get(original);
  if(!variants){variants=new Map();maskCache.set(original,variants)}
  // The actual garment surface is instance-specific: avoid reusing a
  // front-only plate mask for another outfit with the same slot names.
  const cacheKey=surfaceCheck?coverage:coverage.signature;
  let record=variants.get(cacheKey);
  if(!record){
   const cut=new Uint8Array(positions.count);
   const worldPoint=new THREE.Vector3();
   const displayed=mesh.geometry;
   if(surfaceCheck){
    characterModel.updateMatrixWorld(true);
    if(displayed!==original)mesh.geometry=original;
   }
   for(let i=0;i<positions.count;i++){
    let exposedWeight=0,hiddenWeight=0,principalZone=null,principalWeight=0;
    for(let j=0;j<4;j++){
     const index=joints.getComponent(i,j),weight=weights.getComponent(i,j);
     const zone=zones[index]||'unknown';
     if(zone==='exposed'||zone==='unknown'||!hidden.has(zone))exposedWeight+=weight;
     else {hiddenWeight+=weight;
      if(weight>principalWeight){principalWeight=weight;principalZone=zone;}
     }
    }
    // Protect every finger/face/neck transition. A covered region needs a
    // decisive skinning majority before its geometry may be removed.
    const isCovered=hiddenWeight>=.56&&exposedWeight<.44;
    cut[i]=isCovered&&(!surfaceCheck||(principalZone&&
      sampler.covers(principalZone,mesh.getVertexPosition(i,worldPoint).applyMatrix4(mesh.matrixWorld))))?1:0;
   }
   if(surfaceCheck&&displayed!==original)mesh.geometry=displayed;
   const sourceIndices=original.index,kept=[];
   for(let i=0;i<sourceIndices.count;i+=3){
    const a=sourceIndices.getX(i),b=sourceIndices.getX(i+1),c=sourceIndices.getX(i+2);
    // Keep a boundary triangle if at least two of its vertices belong to
    // exposed skin. This preserves an underlap at sleeve/neck/boot openings.
    // Preserve any triangle touching an exposed vertex, especially on backs.
    if(surfaceCheck?cut[a]+cut[b]+cut[c]<3:cut[a]+cut[b]+cut[c]<2)kept.push(a,b,c);
   }
   // A failed / incompatible mesh must not disappear completely.
   const sourceCount=sourceIndices.count/3,keptCount=kept.length/3;
   if(keptCount<150||keptCount>=sourceCount*.97) return;
   const compact=compactMaskedGeometry(original,kept);
   const masked=compact.geometry;
   // A shared conservative sphere avoids animated culling regressions.
   if(original.boundingSphere)masked.boundingSphere=original.boundingSphere.clone();
   record={geometry:masked,sourceCount,keptCount,
     sourceVertices:positions.count,keptVertices:compact.vertices,refs:0};
   variants.set(cacheKey,record);
  }
  record.refs++;
  let state=activeMasks.get(mesh);
  if(!state){state={source:original,leases:[]};activeMasks.set(mesh,state)}
  const lease={record,signature:cacheKey};
  state.leases.push(lease);
  mesh.geometry=record.geometry;
  entries.push({mesh,original,record,variants,lease});
  measure.skinnedMeshes++;
  measure.sourceTriangles+=record.sourceCount;
  measure.keptTriangles+=record.keptCount;
  measure.sourceVertices+=record.sourceVertices;
  measure.keptVertices+=record.keptVertices;
 });
 measure.removedTriangles=measure.sourceTriangles-measure.keptTriangles;
 let released=false;
 return {restore(){
   if(released)return;
   released=true;
   for(const entry of entries){
    const state=activeMasks.get(entry.mesh);
    if(state){
      const i=state.leases.indexOf(entry.lease);
      if(i!==-1)state.leases.splice(i,1);
      entry.mesh.geometry=state.leases.length?
        state.leases[state.leases.length-1].record.geometry:state.source;
      if(state.leases.length===0)activeMasks.delete(entry.mesh);
    }
    if(--entry.record.refs===0){
      entry.record.geometry.dispose();
      entry.variants.delete(entry.lease.signature);
      if(entry.variants.size===0)maskCache.delete(entry.original);
    }
   }
  },diagnostics:measure};
}
