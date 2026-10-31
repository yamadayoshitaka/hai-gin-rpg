/**
 * Sample deformed triangle-mesh vertices against the horizontal floor.
 * Works with Three.js SkinnedMesh.applyBoneTransform (current skeleton pose).
 * Visual mesh is authoritative; no guessed body sphere/anchor coordinates.
 */
export function sampleMeshFloor({THREE,root,groundY=0,maxSamplesPerMesh=96,maxMeshes=24}){
 if(!root||!THREE)throw new TypeError('THREE and root required');
 root.updateMatrixWorld(true);
 const hasSkinned=(()=>{let found=false;root.traverse(n=>{if(n.isSkinnedMesh&&n.visible)found=true;});return found;})();
 const vertex=new THREE.Vector3();
 let minY=Infinity,samples=0,meshes=0;
 root.traverse(node=>{
  if(meshes>=maxMeshes||!node.visible||!node.isMesh||!node.geometry?.attributes?.position)return;
  for(let p=node.parent;p&&p!==root.parent;p=p.parent)if(!p.visible)return;
  if(hasSkinned&&!node.isSkinnedMesh)return;
  // Skinned body and visible rigid parts use the same world-space ground plane.
  const attr=node.geometry.attributes.position;
  if(!attr.count)return;
  meshes++;
  const stride=Math.max(1,Math.floor(attr.count/maxSamplesPerMesh));
  for(let i=0;i<attr.count;i+=stride){
   vertex.fromBufferAttribute(attr,i);
   if(node.isSkinnedMesh&&typeof node.applyBoneTransform==='function')node.applyBoneTransform(i,vertex);
   node.localToWorld(vertex);
   if(Number.isFinite(vertex.y)){minY=Math.min(minY,vertex.y);samples++;}
  }
 });
 return {minY,penetration:Number.isFinite(minY)?Math.max(0,groundY-minY):0,samples,meshes};
}
export function correctMeshFloor({THREE,root,groundY=0,maxCorrection=2,...options}){
 const contact=sampleMeshFloor({THREE,root,groundY,...options});
 if(!contact.samples)return {...contact,correction:0};
 const correction=Math.max(-maxCorrection,Math.min(maxCorrection,groundY-contact.minY));
 root.position.y+=correction;
 root.updateMatrixWorld(true);
 return {...contact,correction};
}

/**
 * Per-bone floor manifold from skinned triangle vertices. Groups contacts by
 * dominant skinning bone, preserving the visible skeleton as contact authority.
 */
export function sampleBoneFloorContacts({THREE,root,groundY=0,maxSamplesPerMesh=320,maxMeshes=24}){
 root.updateMatrixWorld(true);
 const contacts=new Map();
 const v=new THREE.Vector3();
 let meshes=0;
 root.traverse(node=>{
  if(meshes>=maxMeshes||!node.visible||!node.isSkinnedMesh||!node.geometry?.attributes?.position)return;
  for(let p=node.parent;p&&p!==root.parent;p=p.parent)if(!p.visible)return;
  const pos=node.geometry.attributes.position,indices=node.geometry.attributes.skinIndex,weights=node.geometry.attributes.skinWeight;
  if(!indices||!weights)return;
  meshes++;
  const stride=Math.max(1,Math.floor(pos.count/maxSamplesPerMesh));
  for(let i=0;i<pos.count;i+=stride){
   v.fromBufferAttribute(pos,i);
   node.applyBoneTransform(i,v);
   node.localToWorld(v);
   if(!Number.isFinite(v.y)||v.y>groundY+.12)continue;
   let slot=0,best=-1;
   for(let k=0;k<4;k++){const w=weights.getComponent(i,k);if(w>best){best=w;slot=k;}}
   const bone=node.skeleton.bones[indices.getComponent(i,slot)];
   if(!bone)continue;
   const previous=contacts.get(bone);
   if(!previous||v.y<previous.minY)contacts.set(bone,{bone,minY:v.y,penetration:Math.max(0,groundY-v.y),worldPoint:v.clone(),weight:best});
  }
 });
 return [...contacts.values()];
}
