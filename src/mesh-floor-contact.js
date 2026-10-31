/**
 * Sample deformed triangle-mesh vertices against the horizontal floor.
 * Works with Three.js SkinnedMesh.applyBoneTransform (current skeleton pose).
 * Visual mesh is authoritative; no guessed body sphere/anchor coordinates.
 */
export function sampleMeshFloor({THREE,root,groundY=0,maxSamplesPerMesh=96,maxMeshes=24}){
 if(!root||!THREE)throw new TypeError('THREE and root required');
 root.updateMatrixWorld(true);
 const vertex=new THREE.Vector3();
 let minY=Infinity,samples=0,meshes=0;
 root.traverse(node=>{
  if(meshes>=maxMeshes||!node.visible||!node.isMesh||!node.geometry?.attributes?.position)return;
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
