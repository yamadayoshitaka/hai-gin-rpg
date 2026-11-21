import * as THREE from 'three';

/**
 * V82: the lips and mouth opening ARE the head mesh.
 *
 * A single local topology operation removes frontal triangles at the oral
 * aperture, stitches the surviving original facial boundary to upper/lower
 * vermilion rings and stores their vertex IDs. No front-facing black plate,
 * floating lipstick patch or lip overlay is needed. The inner opening stays
 * a real hole as its two rims open/close through facial animation.
 */
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const mix=(a,b,t)=>a+(b-a)*t;

export function integrateMouthIntoFace(face,{
 centerX,centerY,halfWidth,headHeight,surfaceZ
}={}){
 const geometry=face?.geometry;
 const attr=geometry?.getAttribute('position');
 if(!attr||![centerX,centerY,halfWidth,headHeight,surfaceZ].every(Number.isFinite)||
  halfWidth<=0||headHeight<=0)throw Error('3D mouth needs valid face landmark');

 geometry.computeBoundingBox();
 const box=geometry.boundingBox.clone();
 const size=box.getSize(new THREE.Vector3());
 const depth=Math.max(1e-8,size.z);
 const eyeHeight=headHeight*.066;
 const xRadius=halfWidth*1.21;
 const frontThreshold=box.min.z+depth*.59;
 const sourceIndices=geometry.getIndex()?.array ||
  Array.from({length:attr.count},(_,i)=>i);
 const originalIndices=Array.from(sourceIndices);
 const originalCount=attr.count;
 const tris=[], edgeUse=new Map();
 const quant=v=>Math.round(v/Math.max(1e-8,size.x*.000012));
 const vertexKey=i=>[quant(attr.getX(i)),quant(attr.getY(i)),quant(attr.getZ(i))].join(',');
 const edgeKey=(a,b)=>{
  const aa=vertexKey(a),bb=vertexKey(b);
  return aa<bb?aa+'|'+bb:bb+'|'+aa;
 };
 let removedTriangles=0;
 for(let k=0;k+2<originalIndices.length;k+=3){
  const ids=originalIndices.slice(k,k+3);
  const x=(ids.reduce((s,i)=>s+attr.getX(i),0))/3;
  const y=(ids.reduce((s,i)=>s+attr.getY(i),0))/3;
  const z=(ids.reduce((s,i)=>s+attr.getZ(i),0))/3;
  const elliptical=((x-centerX)/xRadius)**2+((y-centerY)/eyeHeight)**2;
  const remove=elliptical<1&&z>frontThreshold;
  if(remove)removedTriangles++;
  tris.push({ids,remove});
  for(let t=0;t<3;t++){
   const a=ids[t],b=ids[(t+1)%3],key=edgeKey(a,b);
   if(!edgeUse.has(key))edgeUse.set(key,{retained:0,removed:[]});
   const use=edgeUse.get(key);
   if(remove)use.removed.push([a,b]);
   else use.retained++;
  }
 }
 // Preserve geometry untouched when the donor has no useful front-mouth
 // topology, instead of producing a broken hole in a tiny test mesh.
 const boundary=[];
 for(const use of edgeUse.values())
  if(use.removed.length===1&&use.retained>0)
   boundary.push(use.removed[0]);
 if(removedTriangles<3||boundary.length<6){
  return {integrated:false,reason:'donor-mouth-topology-insufficient',
   removedTriangles,boundaryEdges:boundary.length};
 }
 const oldAttributes={...geometry.attributes};
 const attrItems=Object.fromEntries(Object.entries(oldAttributes).map(
  ([name,a])=>[name,{itemSize:a.itemSize,normalized:a.normalized,
   type:a.array.constructor,values:Array.from(a.array),old:a}]));
 const vertices=new Map();
 const lipTintWeights=new Map();
 const pairs=[];
 const addVertex=(baseIndex,position,weight)=>{
  const idx=attrItems.position.values.length/3;
  for(const [name,item] of Object.entries(attrItems)){
   const base=baseIndex*item.itemSize;
   const src=name==='position'?position:
    Array.from({length:item.itemSize},(_,k)=>item.old.array[base+k]);
   item.values.push(...src);
  }
  if(weight>0)lipTintWeights.set(idx,weight);
  return idx;
 };
 const makePair=outer=>{
  if(vertices.has(outer))return vertices.get(outer);
  const x=attr.getX(outer),y=attr.getY(outer),z=attr.getZ(outer);
  const t=clamp((x-centerX)/xRadius,-1,1);
  const sign=y>=centerY?1:-1;
  const arch=Math.sqrt(Math.max(0,1-t*t));
  const rx=centerX+t*halfWidth;
  const ry=centerY+sign*headHeight*.0006*arch;
  const rz=surfaceZ+depth*.0007;
  const blend=.54;
  const mid=addVertex(outer,[
   mix(x,rx,blend),mix(y,ry,blend),mix(z,rz,blend)+depth*.0028*arch
  ],.66);
  const inner=addVertex(outer,[rx,ry,rz],1);
  const result={outer,mid,inner,t,sign,arch,restZ:rz};
  vertices.set(outer,result);
  pairs.push(result);
  return result;
 };
 const patches=[];
 for(const [a,b] of boundary){
  const u=makePair(a),v=makePair(b);
  // The removed face triangle supplied the front-facing winding.
  patches.push(a,b,v.mid,a,v.mid,u.mid);
  patches.push(u.mid,v.mid,v.inner,u.mid,v.inner,u.inner);
 }
 const retained=[];
 for(const tri of tris)if(!tri.remove)retained.push(...tri.ids);
 for(const [name,item] of Object.entries(attrItems)){
  const array=new item.type(item.values);
  const newAttr=new THREE.BufferAttribute(array,item.itemSize,item.normalized);
  newAttr.setUsage(item.old.usage);
  geometry.setAttribute(name,newAttr);
 }
 geometry.setIndex([...retained,...patches]);
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 const data={
  integrated:true,kind:'v82-single-head-topology',
  originalVertexCount:originalCount,originalTriangleCount:tris.length,
  removedTriangles,boundaryEdges:boundary.length,
  stitchedTriangleCount:patches.length/3,createdVertices:pairs.length*2,
  centerX,centerY,halfWidth,headHeight,depth,surfaceZ,
  pairs,lipTintWeights,version:82
 };
 face.userData.v82IntegratedMouth=data;
 face.userData.v82LipAndFaceShareGeometry=true;
 face.userData.v82RealMouthAperture=true;
 return data;
}

export function poseIntegratedMouth(face,{smile=0,open=0,cheek=0}={}){
 const data=face?.userData?.v82IntegratedMouth;
 if(!data?.integrated)return false;
 const attr=face.geometry.getAttribute('position');
 const s=clamp(Number(smile)||0,0,1);
 const o=clamp(Number(open)||0,0,1);
 const c=clamp(Number(cheek)||0,0,1);
 const aperture=data.headHeight*.053*o;
 for(const item of data.pairs){
  const {outer,mid,inner,t,sign,arch,restZ}=item;
  const x=attr.getX(outer),y=attr.getY(outer),z=attr.getZ(outer);
  const smileWidth=1+.155*s+.022*c;
  const rx=data.centerX+t*data.halfWidth*smileWidth;
  const corner=Math.pow(Math.abs(t),1.75);
  const lifted=data.headHeight*(.025*s+.004*c)*corner;
  const separation=arch*(sign>0?.18:.76)*aperture;
  const ry=data.centerY+lifted+sign*(data.headHeight*.0006*arch+separation);
  const rz=restZ-data.depth*.003*o*(1-arch);
  const blend=.54;
  attr.setXYZ(inner,rx,ry,rz);
  attr.setXYZ(mid,mix(x,rx,blend),mix(y,ry,blend),
   mix(z,rz,blend)+data.depth*.0028*arch);
 }
 attr.needsUpdate=true;
 face.geometry.computeVertexNormals();
 face.geometry.computeBoundingSphere();
 return true;
}
