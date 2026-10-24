import {buildHumanWireMeshBom} from './human-mesh-bom.js?v=45.1';
/** A renderer only: wire mesh vertex/UV/triangle/skin data comes from the BOM. */
export function attachSmoothHumanSkin(T,root,joints,material){
 const data=buildHumanWireMeshBom();
 const bones=[joints.spine,joints.neck,joints.head,
  joints.hips[0],joints.knees[0],joints.ankles[0],
  joints.hips[1],joints.knees[1],joints.ankles[1],
  joints.shoulders[0],joints.elbows[0],joints.wrists[0],
  joints.shoulders[1],joints.elbows[1],joints.wrists[1]];
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uvs,2));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(data.skinIndices,4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(data.skinWeights,4));
 geometry.setIndex(data.indices);geometry.computeVertexNormals();
 for(const g of data.groups)geometry.addGroup(g.start,g.count,g.materialIndex);
 const mesh=new T.SkinnedMesh(geometry,data.materials.map(material));
 mesh.name='mesh-bom-v45.1-anatomical-human';
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
 mesh.userData.skinDrivenBy='human-mesh-bom';
 mesh.userData.meshBomVersion='45.1';
 mesh.userData.meshBomParts=data.groups.map(x=>({id:x.id,triangles:x.count/3}));
 mesh.userData.vertexCount=data.positions.length/3;
 return mesh;
}
