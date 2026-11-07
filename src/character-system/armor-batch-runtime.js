/**
 * Lossless per-bone/per-material armor consolidation for the battle renderer.
 * Only geometries with identical vertex layouts, attachment bone and visibility
 * slot are merged. Positions, normals, UVs, colours and photographed PBR
 * materials are retained. No simplified proxy is ever substituted.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function layout(mesh){
 const geometry=mesh.geometry;
 const attributes=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b))
  .map(([key,value])=>[key,value.itemSize,value.normalized,value.array.constructor.name].join(':'))
  .join('|');
 return (geometry.index?'indexed:':'flat:')+attributes+
  (Object.keys(geometry.morphAttributes).length?':morph':'');
}
export function consolidateBattleArmor(armor){
 if(!armor?.objects?.length)return {sourcePieces:0,drawPieces:0,mergedPieces:0};
 const source=[...armor.objects],groups=new Map();
 for(const mesh of source){
  const valid=mesh.isMesh&&!mesh.isSkinnedMesh&&mesh.parent?.isBone&&
   !Array.isArray(mesh.material)&&mesh.geometry&&!Object.keys(mesh.geometry.morphAttributes).length;
  const key=valid?[
   mesh.parent.uuid,mesh.material.uuid,mesh.userData?.equipmentSlot||'',
   layout(mesh)
  ].join('/'):'single/'+mesh.uuid;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(mesh);
 }
 const result=[];let mergedPieces=0;
 for(const pieces of groups.values()){
  if(pieces.length<2){result.push(...pieces);continue;}
  const geometries=pieces.map(piece=>piece.geometry.clone().applyMatrix4(piece.matrix));
  let joined=null;
  try{joined=mergeGeometries(geometries,false)}catch{}
  for(const g of geometries)g.dispose();
  if(!joined){result.push(...pieces);continue;}
  const first=pieces[0],combined=new THREE.Mesh(joined,first.material);
  combined.name='armor-batch-'+(first.userData.equipmentSlot||'')+'-'+first.parent.name;
  combined.castShadow=first.castShadow;combined.receiveShadow=first.receiveShadow;
  combined.frustumCulled=false;
  combined.userData={...first.userData,
   consolidatedParts:pieces.map(p=>p.name),
   consolidatedCount:pieces.length};
  first.parent.add(combined);
  for(const piece of pieces){
   piece.parent?.remove(piece);
   // Segmented-armor-runtime clones GLB positions only when adding UVs;
   // originals are shared cached GLB geometry and must not be disposed.
   if(piece.userData?.ownsGeometry)piece.geometry.dispose();
  }
  result.push(combined);mergedPieces+=pieces.length-1;
 }
 armor.objects.splice(0,armor.objects.length,...result);
 armor.diagnostics.originalArmorPieces=source.length;
 armor.diagnostics.armorPieces=result.length;
 armor.diagnostics.consolidatedArmorPieces=mergedPieces;
 return {sourcePieces:source.length,drawPieces:result.length,mergedPieces};
}
