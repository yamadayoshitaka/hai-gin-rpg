import * as THREE from 'three';

/**
 * Fitted youth knight clothing - source-body surface reconstruction.
 * Unlike the removed cylinder/cone outfit, the torso, shoulders and upper
 * sleeves are re-projected from actual human anatomy source triangles.
 * No destructively trimmed Viking sleeve is rendered for hero profiles.
 *
 * Static display only. GLB source originals, UVs, bone weights and other
 * existing garment modes remain untouched.
 */
const finite=v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
function buildFromTriangles(records,material,name){
 const pos=[],norm=[],uv=[],idx=[];
 for(const rec of records){
  const start=pos.length/3;
  for(let j=0;j<3;j++){
   const p=rec.points[j],n=rec.normals[j];
   pos.push(p.x,p.y,p.z);norm.push(n.x,n.y,n.z);
   uv.push(p.x*1.7,p.y*1.7);
  }
  idx.push(start,start+1,start+2);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,material);
 mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
 return mesh;
}
function bodySkinTriangles(body){
 body.updateWorldMatrix(true,true);
 const result=[];
 let maxCount=0,sourceMeshes=0;
 body.traverse(mesh=>{
  if(!mesh.isMesh||/iris|sclera|eyelid|pupil|eye[LR]/i.test(mesh.name))return;
  const g=mesh.geometry,pos=g?.getAttribute('position');
  if(!pos||pos.count<300)return;
  sourceMeshes++;maxCount=Math.max(maxCount,pos.count);
  const normals=g.getAttribute('normal');
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const idx=g.getIndex(),count=idx?.count||pos.count;
  if(count%3!==0)throw Error('Real anatomical source is not triangles');
  const world=[],worldNormal=[];
  const get=i=>idx?idx.getX(i):i;
  for(let i=0;i<count;i+=3){
   const xyz=[],nrm=[];
   for(let k=0;k<3;k++){
    const index=get(i+k);
    const p=new THREE.Vector3();
    if(mesh.isSkinnedMesh&&typeof mesh.getVertexPosition==='function')
     mesh.getVertexPosition(index,p);
    else p.fromBufferAttribute(pos,index);
    p.applyMatrix4(mesh.matrixWorld);
    if(!finite(p))throw Error('Nonfinite source anatomy');
    const normal=new THREE.Vector3(0,0,1);
    if(normals)normal.fromBufferAttribute(normals,index)
     .applyMatrix3(normalMatrix).normalize();
    xyz.push(p);
    nrm.push(normal);
   }
   result.push({points:xyz,normals:nrm});
  }
 });
 if(maxCount<2000||sourceMeshes<1)throw Error('High resolution real-body anatomical source required');
 return result;
}
function sourceContour(src,bb,{female=false}={}){
 const boundsSize=bb.getSize(new THREE.Vector3()),height=boundsSize.y;
 const center=bb.getCenter(new THREE.Vector3());
 const shoulder=bb.max.y-height*.255;
 const neck=shoulder+height*.092;
 const hem=shoulder-height*.46;
 const sleeveHem=shoulder-height*.18;
 const torsoHalf=height*(female?.127:.140);
 const innerSleeve=height*(female?.10:.115);
 const outerSleeve=height*(female?.295:.302);
 const torso=[],breastplate=[],armSegments={left:0,right:0};
 const validSourceTriangle=t=>{
  const centroid=t.points.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/3);
  const x=Math.abs(centroid.x-center.x),y=centroid.y;
  const isNeck=y>shoulder-.005&&
    x<height*.068&&
    Math.abs(centroid.z-center.z)<height*.053;
  const torsoZone=y>=hem&&y<=neck&&x<=torsoHalf;
  const sleeveZone=y>=sleeveHem&&y<=neck&&x>=innerSleeve&&x<outerSleeve;
  const selected=(torsoZone||sleeveZone)&&!isNeck;
  if(selected&&sleeveZone&&x>torsoHalf){
   if(centroid.x<center.x)armSegments.left++;
   else armSegments.right++;
  }
  return {selected,centroid,sleeveZone};
 };
 for(const tri of src){
  const p=validSourceTriangle(tri);
  if(!p.selected)continue;
  const clothPoints=tri.points.map((point,i)=>point.clone().addScaledVector(tri.normals[i],.008));
  const shifted={points:clothPoints,normals:tri.normals};
  torso.push(shifted);
  // A thin armored inset, traced on the real anatomy. This is a chest
  // surface; it does not grow a separate cylindrical barrel around the body.
  const forward=p.centroid.z-center.z;
  if(forward>.035&&p.centroid.y<shoulder-.055&&p.centroid.y>hem+height*.11&&
     Math.abs(p.centroid.x-center.x)<height*.091){
   const n=tri.normals.reduce((a,v)=>a.add(v),new THREE.Vector3()).normalize();
   if(n.z>.26){
    breastplate.push({points:tri.points.map((vertex,i)=>
      vertex.clone().addScaledVector(tri.normals[i],.015)),
      normals:tri.normals});
   }
  }
 }
 if(torso.length<180||breastplate.length<25||
    armSegments.left<35||armSegments.right<35)
  throw Error('Source skin contour cannot produce full torso, breastplate and both sleeves '+
    JSON.stringify({torso:torso.length,plate:breastplate.length,arms:armSegments}));
 return {torso,breastplate,armSegments,sourceHeight:height,shoulderY:shoulder,
  necklineY:neck,hemY:hem,armHemY:sleeveHem};
}
export function createFittedFantasyHeroGarment(body,{female=false}={}){
 if(!body)throw Error('Actual human body missing');
 const bb=new THREE.Box3().setFromObject(body);
 const height=bb.getSize(new THREE.Vector3()).y;
 if(height<1.2||height>2.2)throw Error('Real source human dimensions invalid');
 const source=bodySkinTriangles(body);
 const data=sourceContour(source,bb,{female});
 const group=new THREE.Group();group.name='ANATOMY_FITTED_FANTASY_KNIGHT_GARMENT';
 const fabric=new THREE.MeshStandardMaterial({
  color:female?0x26384b:0x283b4a,metalness:0,roughness:.87,side:THREE.DoubleSide});
 const plating=new THREE.MeshPhysicalMaterial({
  color:female?0x5a6b7b:0x536576,
  metalness:.59,roughness:.44,clearcoat:.12,side:THREE.DoubleSide});
 const shirt=buildFromTriangles(data.torso,fabric,'KNIGHT_SOURCE_SURFACE_SHIRT_AND_JOINED_SLEEVES');
 const breastplate=buildFromTriangles(data.breastplate,plating,'KNIGHT_ANATOMICAL_BREASTPLATE');
 group.add(shirt,breastplate);
 // The base body source skin is already a continuous human torso+arm mesh.
 // Keep a small dark sewn hem with natural silhouette; do not add large
 // floating metal cylinders or the previous artificial shoulder bells.
 const report=Object.freeze({
  bodyFitted:true,anatomicalSourceSurface:true,
  sourceTrianglesOnly:true,originalCC0ClothUntouched:true,
  staticOnly:true,noVikingTposeSleeves:true,
  anatomicallyConnectedUpperSleeves:true,
  torsoTriangles:data.torso.length,
  breastplateTriangles:data.breastplate.length,
  upperArmTriangles:{...data.armSegments},
  sourceBodyTriangles:source.length,
  realSourceBodyHeightMeters:Number(data.sourceHeight.toFixed(4)),
  hemHeight:Number(data.hemY.toFixed(4)),
  neckHeight:Number(data.necklineY.toFixed(4)),
  upperArmHemHeight:Number(data.armHemY.toFixed(4)),
  newClothingShading:female?'fantasy-female': 'fantasy-male',
  noProceduralCylinderSleeves:true,combatRigCertified:false,artGradeCertified:false
 });
 return {object:group,report,
  changeAppearance(profile){
   fabric.color.set(profile.gender==='female'?0x26384b:0x283b4a);
   plating.color.set(profile.gender==='female'?0x5a6b7b:0x536576);
  },
  dispose(){
   for(const mesh of [shirt,breastplate])mesh.geometry.dispose();
   fabric.dispose();plating.dispose();
  }
 };
}
