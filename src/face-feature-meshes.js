import * as THREE from 'three';

/**
 * Actual face-only polygon meshes. No 2D decals, portrait planes or hair.
 * The underlying face surface (nose, cheek and philtrum) is sculpted by
 * independent-face-masters. These supplemental anatomical meshes are
 * projected into that same local coordinate system and parented to it:
 * two eyeballs, two sclera-facing iris/pupil pairs, four eyelid surfaces,
 * and two shallow, surface-conforming vermilion lip volumes.
 *
 * This is a 3D CLAY DRAFT, not a photogrammetry or animation-ready rig.
 */
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smoothstep=t=>{const q=clamp(t,0,1);return q*q*(3-2*q)};
function buildGrid(name,columns,rows,point,material){
 const vertices=[],uv=[],indices=[];
 for(let j=0;j<=rows;j++){
  for(let i=0;i<=columns;i++){
   const u=i/columns,v=j/rows,p=point(u,v);
   vertices.push(p.x,p.y,p.z);uv.push(u,v);
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const k=j*(columns+1)+i;
  indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,material);
 mesh.name=name;mesh.renderOrder=2;
 return mesh;
}
export function createAnatomicalFaceParts(face,{gender='female'}={}){
 if(!face?.isMesh||!['male','female'].includes(gender))
  throw Error('Sculpted face mesh and gender required for 3D facial parts');
 const geometry=face.geometry;
 geometry.computeBoundingBox();
 const box=geometry.boundingBox.clone(),d=box.getSize(new THREE.Vector3());
 if(d.x<.02||d.y<.02||d.z<.02)throw Error('No usable 3D face bounds');
 const cx=(box.min.x+box.max.x)*.5;
 const mat=color=>new THREE.MeshStandardMaterial({
  color,roughness:.89,metalness:0,side:THREE.DoubleSide
 });
 const lidMat=mat(0xbcbfc5),lipMat=mat(0xbfc3cb);
 const eyeMat=new THREE.MeshStandardMaterial({
  color:0xd5d8dd,roughness:.48,metalness:0
 });
 const irisMat=new THREE.MeshStandardMaterial({
  color:0x747a83,roughness:.55,metalness:0
 });
 const pupilMat=new THREE.MeshStandardMaterial({
  color:0x30353b,roughness:.43,metalness:0
 });
 const root=new THREE.Group();
 root.name=gender.toUpperCase()+'_ANATOMICAL_CLAY_FACE_PARTS';
 root.userData.headOnly=true;
 const surface=new THREE.Mesh(geometry,
  new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 surface.updateMatrixWorld(true);
 const ray=new THREE.Raycaster();
 const down=new THREE.Vector3(0,0,-1);
 const localVertices=geometry.getAttribute('position');
 let projected=0,projectionFallbacks=0;
 const surfaceAt=(x,y)=>{
  ray.set(new THREE.Vector3(x,y,box.max.z+d.z),down);
  ray.near=0;ray.far=d.z*4;
  const hits=ray.intersectObject(surface,false);
  if(hits.length){projected++;return hits[0].point.z;}
  // The surface is sparse around an open eye or mouth: only interpolate
  // inside the local face, never insert an arbitrary billboard plane.
  projectionFallbacks++;
  let best=Infinity,z=box.min.z;
  for(let i=0;i<localVertices.count;i++){
   const dx=localVertices.getX(i)-x,dy=localVertices.getY(i)-y;
   const dd=dx*dx+dy*dy;
   if(dd<best){best=dd;z=localVertices.getZ(i);}
  }
  return z;
 };
 const female=gender==='female';
 const eyeRadius=d.x*(female?.052:.051);
 const eyeHeight=box.min.y+d.y*(female?.684:.687);
 const eyeSpacing=d.x*(female?.112:.115);
 // Sclera centre is recessed. Upper and lower eyelids cover the spherical
 // edge, rather than drawing detached floating white eye disks.
 for(const side of [-1,1]){
  const x=cx+side*eyeSpacing,y=eyeHeight;
  const faceZ=surfaceAt(x,y);
  const z=faceZ-eyeRadius*.56;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(eyeRadius,36,24),eyeMat);
  globe.name=(side===-1?'LEFT':'RIGHT')+'_ORBITAL_EYEBALL';
  globe.scale.set(1.18,.77,.89);
  globe.position.set(x,y,z);
  globe.userData.sourceProjected=true;
  root.add(globe);
  // Real spherical caps on the globe, not flat disks that disappear
  // at 45° angles. Default SphereGeometry points +Y; rotate to +Z.
  const iris=new THREE.Mesh(
   new THREE.SphereGeometry(eyeRadius*.901,32,12,0,Math.PI*2,0,.47),
   irisMat);
  iris.name=(side===-1?'LEFT':'RIGHT')+'_CURVED_IRIS';
  iris.rotation.x=Math.PI/2;
  iris.position.set(x,y,z);
  root.add(iris);
  const pupil=new THREE.Mesh(
   new THREE.SphereGeometry(eyeRadius*.908,24,10,0,Math.PI*2,0,.19),
   pupilMat);
  pupil.name=(side===-1?'LEFT':'RIGHT')+'_CURVED_PUPIL';
  pupil.rotation.x=Math.PI/2;
  pupil.position.set(x,y,z);
  root.add(pupil);
  const width=eyeRadius*1.12;
  for(const upper of [true,false]){
   const label=(side===-1?'LEFT':'RIGHT')+(upper?'_UPPER':'_LOWER');
   const height=eyeRadius*(female?.33:.30);
   const mesh=buildGrid(label+'_ANATOMICAL_EYELID',28,4,(u,v)=>{
    const t=u*2-1,arch=Math.pow(Math.max(0,1-t*t),.73);
    const cornerTilt=(t+1)*eyeRadius*.045;
    const nearY=y+(upper?1:-1)*height*arch+cornerTilt;
    const farY=nearY+(upper?1:-1)*eyeRadius*(upper?.28:.19)*v;
    const globeZ=z+eyeRadius*(.71*Math.sqrt(Math.max(0,1-t*t))+.14);
    const skinZ=surfaceAt(x+t*width,farY)+d.z*.005;
    const zz=globeZ*(1-smoothstep(v))+skinZ*smoothstep(v);
    return new THREE.Vector3(x+t*width,farY,zz);
   },lidMat);
   mesh.userData.attachedToFace=true;
   root.add(mesh);
  }
 }
 // Original face remains the structural muzzle/philtrum/chin. Two shallow
 // lip strips follow that actual surface and use real triangle thickness.
 // Avoid a single flat 'mouth plate' or pigment printed on the chin.
 const lipCenter=box.min.y+d.y*(female?.509:.506);
 const halfWidth=d.x*(female?.105:.119);
 for(const upper of [true,false]){
  const material=lipMat;
  const mesh=buildGrid((upper?'UPPER':'LOWER')+'_3D_VERMILION_LIP',
   32,8,(u,v)=>{
    const t=u*2-1;
    const taper=Math.pow(Math.max(0,1-t*t),.70);
    const cupid=upper?
      d.y*.0018*(bell(Math.abs(t),.37,.22)-.42*bell(t,0,.23)):0;
    const cy=lipCenter+(upper?d.y*.009:-d.y*.009)+cupid;
    const vertical=(v-.5)*d.y*(upper?.012:.015)*taper;
    const x=cx+t*halfWidth,y=cy+vertical;
    const fullness=(1-t*t)*Math.sin(Math.PI*v);
    const z=surfaceAt(x,y)+d.z*(.0015+.005*fullness*taper);
    return new THREE.Vector3(x,y,z);
   },material);
  mesh.userData.faceSurfaceConforming=true;
  root.add(mesh);
 }
 // The face mesh itself carries the integrated nose, so DO NOT glue a
 // separate nose sphere in front of its nasal bridge.
 surface.geometry=null;surface.material.dispose();
 const meshList=[];
 root.traverse(o=>{if(o.isMesh)meshList.push(o);});
 const partTriangles=meshList.reduce((n,m)=>n+
  (m.geometry.index?m.geometry.index.count/3:
   m.geometry.getAttribute('position').count/3),0);
 const report=Object.freeze({
  gender,partMeshCount:meshList.length,realSurfaceProjectionCount:projected,
  projectionFallbacks,eyeMeshCount:2,irisMeshCount:2,pupilMeshCount:2,
  eyelidMeshCount:4,lipMeshCount:2,noseSourceIntegrated:true,
  partTriangles,faceOnly:true,bodyIncluded:false,partGeometryReal:true,
  reference:'soft-cheek-small-nose-relaxed-almond-eyes-gentle-lips'
 });
 root.userData.report=report;
 return {root,report};
}
