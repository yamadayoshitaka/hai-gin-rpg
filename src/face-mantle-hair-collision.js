import * as THREE from 'three';

// A cape is a deforming, skinned CLOTH PANEL, not the naked bust. Collision
// samples must be in the fitted head's local coordinates, not garment bind pose.
export function createMantleHairCollision({getHead,getMantle,clearanceRatio=.035}={}){
 if(typeof getHead!=='function'||typeof getMantle!=='function')
  throw Error('Current head and skinned mantle accessors are required');
 const vertex=new THREE.Vector3();
 let raster=null,meshName=null,updates=0,contacts=0;
 const cols=36,rows=64;
 function refresh(){
  const head=getHead(),mantle=getMantle();
  if(!head?.isMesh||!mantle?.isMesh||!mantle.visible||
     !mantle.geometry?.getAttribute('position')){
   raster=null;meshName=null;return false;
  }
  head.updateWorldMatrix(true,false);
  mantle.updateWorldMatrix(true,false);
  if(mantle.isSkinnedMesh)mantle.skeleton?.update();
  const intoHead=head.matrixWorld.clone().invert().multiply(mantle.matrixWorld);
  const geo=mantle.geometry,attr=geo.getAttribute('position'),idx=geo.getIndex();
  const coords=new Float32Array(attr.count*3);
  for(let i=0;i<attr.count;i++){
   vertex.fromBufferAttribute(attr,i);
   if(mantle.isSkinnedMesh)mantle.applyBoneTransform(i,vertex);
   vertex.applyMatrix4(intoHead);
   coords.set([vertex.x,vertex.y,vertex.z],i*3);
  }
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<coords.length;i+=3){
   minX=Math.min(minX,coords[i]);maxX=Math.max(maxX,coords[i]);
   minY=Math.min(minY,coords[i+1]);maxY=Math.max(maxY,coords[i+1]);
  }
  if(!(maxX-minX>1e-5&&maxY-minY>1e-5)){
   raster=null;return false;
  }
  const triangles=[],bins=Array.from({length:cols*rows},()=>[]);
  const sx=Math.max(1e-6,maxX-minX),sy=Math.max(1e-6,maxY-minY);
  const cellX=x=>Math.min(cols-1,Math.max(0,Math.floor((x-minX)/sx*cols)));
  const cellY=y=>Math.min(rows-1,Math.max(0,Math.floor((y-minY)/sy*rows)));
  const count=idx?idx.count:attr.count;
  for(let t=0;t+2<count;t+=3){
   const indices=[0,1,2].map(k=>idx?idx.getX(t+k):t+k);
   const a=indices.map(j=>[coords[j*3],coords[j*3+1],coords[j*3+2]]);
   const det=(a[1][1]-a[2][1])*(a[0][0]-a[2][0])+
    (a[2][0]-a[1][0])*(a[0][1]-a[2][1]);
   if(Math.abs(det)<1e-10)continue;
   const id=triangles.length;triangles.push({a,det});
   const xs=a.map(v=>v[0]),ys=a.map(v=>v[1]);
   for(let y=cellY(Math.min(...ys));y<=cellY(Math.max(...ys));y++)
    for(let x=cellX(Math.min(...xs));x<=cellX(Math.max(...xs));x++)
     bins[x+cols*y].push(id);
  }
  const width=head.geometry.boundingBox?.getSize(new THREE.Vector3()).x||
   sx*.32;
  raster={minX,maxX,minY,maxY,sx,sy,bins,triangles,
   clearance:Math.max(width*clearanceRatio,1e-5)};
  meshName=mantle.name;updates++;return true;
 }
 function rearAt(x,y){
  if(!raster||x<raster.minX||x>raster.maxX||
     y<raster.minY||y>raster.maxY)return null;
  const gx=Math.min(cols-1,Math.floor((x-raster.minX)/raster.sx*cols));
  const gy=Math.min(rows-1,Math.floor((y-raster.minY)/raster.sy*rows));
  let rear=Infinity;
  for(const id of raster.bins[gx+cols*gy]){
   const {a,det}=raster.triangles[id];
   const u=((a[1][1]-a[2][1])*(x-a[2][0])+
    (a[2][0]-a[1][0])*(y-a[2][1]))/det;
   const v=((a[2][1]-a[0][1])*(x-a[2][0])+
    (a[0][0]-a[2][0])*(y-a[2][1]))/det;
   const w=1-u-v;
   if(u<-.00001||v<-.00001||w<-.00001)continue;
   rear=Math.min(rear,u*a[0][2]+v*a[1][2]+w*a[2][2]);
  }
  return Number.isFinite(rear)?rear:null;
 }
 function resolve(point,{side='rear',surfaceOffset=0}={}){
  if(side!=='rear')return false;
  const rear=rearAt(point.x,point.y);
  if(rear===null)return false;
  const safe=rear-raster.clearance-Math.max(0,surfaceOffset);
  if(point.z<=safe)return false;
  point.z=safe;contacts++;return true;
 }
 return {refresh,rearAt,resolve,
  query:(x,y)=>{const rear=rearAt(x,y);return rear===null?null:{rear};},
  getReport:()=>({source:'actual-deformed-skinned-mantle-v60',
   active:!!raster,meshName,updates,contacts,
   triangleCount:raster?.triangles.length||0})};
}
