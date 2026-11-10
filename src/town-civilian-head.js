/**
 * Build a true facial mesh from the registered Superhero full-body GLTF and
 * attach it to the matching Head joint of the skeleton-only Peasant outfit.
 * No substitute primitive face, no battle character changes.
 */
const headCache=new WeakMap();
export function townHeadSourceForSex(sex){
 return sex==='female'?
 './assets/characters/quaternius-base/Superhero_Female_FullBody.gltf':
 './assets/characters/quaternius-base/Superhero_Male_FullBody.gltf';
}
export function peasantHeadSourceRequired(gltf){
 const names=new Set((gltf?.nodes||[]).map(node=>node.name));
 const heads=(gltf?.meshes||[]).filter(m=>/head|face|eye|brow/i.test(m.name||''));
 return names.has('Head')&&heads.length===0;
}
function sourceHeadParts(THREE,base){
 const source=base?.scene;
 if(!source)throw Error('Town head: base body is missing');
 if(headCache.has(source))return headCache.get(source);
 source.updateMatrixWorld(true);
 const sourceHead=source.getObjectByName('Head');
 const neck=source.getObjectByName('neck_01');
 if(!sourceHead||!neck)throw Error('Town head: base body lacks Head/neck_01');
 const headWorld=sourceHead.getWorldPosition(new THREE.Vector3());
 const neckWorld=neck.getWorldPosition(new THREE.Vector3());
 const size=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
 const floor=neckWorld.y-Math.max(.028,size.y*.023);
 const radius=Math.max(.18,size.y*.115);
 const headInverse=sourceHead.matrixWorld.clone().invert();
 const parts=[],localBounds=new THREE.Box3();
 const world=new THREE.Vector3(),local=new THREE.Vector3();
 source.traverse(node=>{
  if(!node.isSkinnedMesh||!node.geometry?.getAttribute('position'))return;
  const geometry=node.geometry,position=geometry.getAttribute('position');
  const uv=geometry.getAttribute('uv'),indexes=geometry.getIndex();
  const count=indexes?indexes.count:position.count;
  const verts=[],tex=[];
  const check=[],pts=[];
  // getVertexPosition calculates the physically skinned bind-pose position.
  // The resulting triangle is converted into Head-local coordinates and
  // remains attached to the skull when the peasant walks or turns.
  for(let i=0;i+2<count;i+=3){
   check.length=0;pts.length=0;
   let avgX=0,avgY=0,avgZ=0;
   for(let k=0;k<3;k++){
    const ix=indexes?indexes.getX(i+k):i+k;
    node.getVertexPosition(ix,world);world.applyMatrix4(node.matrixWorld);
    avgX+=world.x;avgY+=world.y;avgZ+=world.z;
    check.push(ix);pts.push(world.clone());
   }
   avgX/=3;avgY/=3;avgZ/=3;
   if(avgY<floor||Math.hypot(avgX-headWorld.x,avgZ-headWorld.z)>radius)continue;
   for(let k=0;k<3;k++){
    local.copy(pts[k]).applyMatrix4(headInverse);
    verts.push(local.x,local.y,local.z);localBounds.expandByPoint(local);
    if(uv)tex.push(uv.getX(check[k]),uv.getY(check[k]));
   }
  }
  if(verts.length<9)return;
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  if(uv)out.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
  out.computeVertexNormals();
  const material=Array.isArray(node.material)?node.material[0]:node.material;
  parts.push({geometry:out,material,source:node.name,triangles:verts.length/9});
 });
 const triangles=parts.reduce((sum,p)=>sum+p.triangles,0);
 if(!parts.length||triangles<30)throw Error('Town head: not enough facial polygons in base body '+triangles);
 const result={parts,bounds:localBounds,triangles};
 headCache.set(source,result);
 return result;
}
export function attachTownCivilianHead(THREE,outfitRoot,base,{sex='male',hair=true}={}){
 const target=outfitRoot?.getObjectByName('Head');
 if(!target?.isBone)throw Error('Town NPC outfit lacks Head joint');
 if(target.userData.townHeadAttached)return target.userData.townHeadAttached;
 const data=sourceHeadParts(THREE,base),root=new THREE.Group();
 root.name='TownCompleteHead_'+sex;
 let count=0;
 for(const part of data.parts){
  const face=new THREE.Mesh(part.geometry,part.material);
  face.name='TownFace_'+part.source;
  face.frustumCulled=false;face.castShadow=false;face.receiveShadow=true;
  face.userData.townHeadGeometry=true;
  root.add(face);count++;
 }
 if(hair){
  // Light scalp volume, with the actual face/eyes/eyebrows kept visible.
  const bb=data.bounds,sz=bb.getSize(new THREE.Vector3()),center=bb.getCenter(new THREE.Vector3());
  const scalp=new THREE.Mesh(
   new THREE.SphereGeometry(1,18,12,0,Math.PI*2,0,Math.PI*.47),
   new THREE.MeshStandardMaterial({color:sex==='female'?0x4a302b:0x292526,roughness:.88}));
  scalp.name='TownScalpHair';
  scalp.position.set(center.x,bb.max.y-sz.y*.28,center.z);
  scalp.scale.set(sz.x*.52,sz.y*.34,sz.z*.53);
  scalp.castShadow=false;scalp.receiveShadow=true;
  root.add(scalp);
 }
 target.add(root);
 const report={headMeshes:count,headTriangles:data.triangles,face:root.name,source:'Superhero_FullBody',hair};
 target.userData.townHeadAttached=report;
 return report;
}
