import {HUMAN_MESH_BOM,meshBomRing,meshBomWeights,validateHumanMeshBom} from './human-mesh-bom.js?v=45';
/** Assemble skinned triangle meshes from BOM topology data; no hardcoded body geometry. */
export function attachSmoothHumanSkin(T,root,joints,material){
 validateHumanMeshBom();
 const bones=[joints.spine,joints.neck,joints.head,
  joints.hips[0],joints.knees[0],joints.ankles[0],
  joints.hips[1],joints.knees[1],joints.ankles[1],
  joints.shoulders[0],joints.elbows[0],joints.wrists[0],
  joints.shoulders[1],joints.elbows[1],joints.wrists[1]];
 const pos=[],uv=[],indices=[],si=[],sw=[],groups=[];
 const materials=['linen','leather','skin','walnut'].map(material);
 const materialIndex=new Map(['linen','leather','skin','walnut'].map((id,i)=>[id,i]));
 for(const part of HUMAN_MESH_BOM){
  const first=pos.length/3,start=indices.length;
  for(let ring=0;ring<part.rings;ring++){
   const v=ring/(part.rings-1),shape=meshBomRing(part,v),w=meshBomWeights(part,shape.y);
   for(let column=0;column<=part.segments;column++){
    const u=column/part.segments,theta=u*Math.PI*2;
    pos.push(shape.x+shape.rx*Math.cos(theta),shape.y,shape.z+shape.rz*Math.sin(theta));
    uv.push(u,v);
    si.push(w[0][0],w[1][0],0,0);sw.push(w[0][1],w[1][1],0,0);
   }
  }
  for(let ring=0;ring<part.rings-1;ring++)for(let col=0;col<part.segments;col++){
   const a=first+ring*(part.segments+1)+col,b=a+part.segments+1;
   indices.push(a,b,a+1,a+1,b,b+1);
  }
  groups.push({id:part.id,start,count:indices.length-start,materialIndex:materialIndex.get(part.material)});
 }
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));
 geo.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
 geo.setIndex(indices);geo.computeVertexNormals();
 for(const g of groups)geo.addGroup(g.start,g.count,g.materialIndex);
 const mesh=new T.SkinnedMesh(geo,materials);mesh.name='mesh-bom-v45-anatomical-human';
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
 mesh.userData.skinDrivenBy='human-mesh-bom';mesh.userData.meshBomVersion=45;
 mesh.userData.meshBomParts=groups.map(x=>({id:x.id,triangles:x.count/3}));
 mesh.userData.vertexCount=pos.length/3;
 return mesh;
}
