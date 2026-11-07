/**
 * One-time conservative garment-surface sampling, in WORLD coordinates.
 * Clip a skin triangle only if its vertices lie next to real textile/plate
 * geometry. Bare backs, sleeve openings and missing rear panels retain skin.
 * This is built during outfit loading; animation frames never raycast/scan.
 */
import * as THREE from 'three';
const REGION_NAMES=['torso','upperarm','lowerarm','thigh','calf','foot'];
export function buildGarmentSurfaceCoverage(surfaces=[],{
 cellSize=.105,tolerance=.105,maxSamplesPerMesh=4800
}={}){
 if(!Number.isFinite(cellSize)||cellSize<=0||!Number.isFinite(tolerance)||tolerance<=0)
  throw Error('Invalid garment surface grid');
 const grids=new Map(REGION_NAMES.map(name=>[name,new Map()]));
 const key=(x,y,z)=>x+','+y+','+z;
 const point=new THREE.Vector3();
 let samples=0,meshes=0;
 for(const entry of surfaces){
  const mesh=entry?.mesh,geometry=mesh?.geometry;
  const position=geometry?.getAttribute?.('position');
  if(!mesh?.visible||!position?.count||
    (mesh.isSkinnedMesh&&!mesh.skeleton))continue;
  const regions=(entry.regions||[]).filter(region=>grids.has(region));
  if(!regions.length)continue;
  mesh.updateMatrixWorld(true);
  // GLTF meshes can mix fabric and exposed skin in material groups.
  // Never classify the skin triangles of a mixed mesh as garment coverage.
  let garmentVertices=null;
  if(Array.isArray(mesh.material)){
   const allowed=new Set(mesh.material.map((mat,index)=>
     !/(?:skin|flesh|nude|mi_regular)/i.test(mat?.name||'')?index:null)
     .filter(index=>index!==null));
   if(!geometry.groups?.length||!allowed.size)continue;
   const unique=new Set(),indexBuffer=geometry.getIndex();
   for(const group of geometry.groups){
    if(!allowed.has(group.materialIndex))continue;
    const end=Math.min(group.start+group.count,indexBuffer?.count||position.count);
    for(let i=group.start;i<end;i++)unique.add(indexBuffer?indexBuffer.getX(i):i);
   }
   garmentVertices=[...unique];
  }
  const count=garmentVertices?.length??position.count;
  if(!count)continue;
  const step=Math.max(1,Math.ceil(count/maxSamplesPerMesh));
  meshes++;
  for(let k=0;k<count;k+=step){
   const i=garmentVertices?garmentVertices[k]:k;
   // Three.js applies both the morph targets and skeleton before world fit.
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
   if(!Number.isFinite(point.x+point.y+point.z))continue;
   const cell=key(Math.floor(point.x/cellSize),Math.floor(point.y/cellSize),Math.floor(point.z/cellSize));
   for(const region of regions){
    const grid=grids.get(region);
    let bucket=grid.get(cell);
    if(!bucket){bucket=[];grid.set(cell,bucket);}
    bucket.push(point.x,point.y,point.z);
   }
   samples++;
  }
 }
 const distanceSquared=tolerance*tolerance;
 const reach=Math.ceil(tolerance/cellSize);
 function covers(region,vertex){
  const grid=grids.get(region);
  if(!grid?.size)return false;
  const ix=Math.floor(vertex.x/cellSize),iy=Math.floor(vertex.y/cellSize),iz=Math.floor(vertex.z/cellSize);
  for(let dx=-reach;dx<=reach;dx++)for(let dy=-reach;dy<=reach;dy++)for(let dz=-reach;dz<=reach;dz++){
   const bucket=grid.get(key(ix+dx,iy+dy,iz+dz));
   if(!bucket)continue;
   for(let i=0;i<bucket.length;i+=3){
    const x=bucket[i]-vertex.x,y=bucket[i+1]-vertex.y,z=bucket[i+2]-vertex.z;
    if(x*x+y*y+z*z<=distanceSquared)return true;
   }
  }
  return false;
 }
 return {covers,samples,meshes,policy:'sampled-visible-garment-surface'};
}
