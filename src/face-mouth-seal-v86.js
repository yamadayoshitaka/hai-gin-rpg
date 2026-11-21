import * as THREE from 'three';

/**
 * V86: seal the EXISTING small, front-facing oral fissure in the original
 * CC0 donor head. Do not delete a single triangle or add foreground cards.
 *
 * The original file has a 38-vertex narrow lip aperture, separate from its
 * deep, open internal mouth wall. Quarantining the replacement mouth/teeth
 * in v83 exposed the empty aperture as a jet-black jagged polygon.
 *
 * We detect the original connected edge loop topologically and triangulate
 * that loop using its EXISTING vertex indices. The new skin/lip triangles
 * share the original vertices, morph targets, normals, UV and vertex makeup.
 * No source vertex coordinates are modified by this operation.
 */
function boundaryCycles(geometry){
 const index=geometry.getIndex(),position=geometry.getAttribute('position');
 if(!index||!position)return [];
 const edges=new Map();
 for(let t=0;t+2<index.count;t+=3){
  const tri=[index.getX(t),index.getX(t+1),index.getX(t+2)];
  for(let k=0;k<3;k++){
   const a=tri[k],b=tri[(k+1)%3],key=a<b?a+'|'+b:b+'|'+a;
   const old=edges.get(key);
   if(old)old.count++;
   else edges.set(key,{a,b,count:1});
  }
 }
 const adjacency=new Map();
 for(const edge of edges.values()){
  if(edge.count!==1)continue;
  for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]){
   if(!adjacency.has(a))adjacency.set(a,[]);
   adjacency.get(a).push(b);
  }
 }
 const seen=new Set(),loops=[];
 for(const start of adjacency.keys()){
  if(seen.has(start))continue;
  const stack=[start],component=new Set([start]);
  while(stack.length){
   const a=stack.pop();
   for(const b of adjacency.get(a)||[]){
    if(!component.has(b)){component.add(b);stack.push(b);}
   }
  }
  for(const v of component)seen.add(v);
  if(component.size<12||
   [...component].some(i=>(adjacency.get(i)||[]).length!==2))continue;
  const cycle=[],visited=new Set();
  let previous=-1,current=start,closed=false;
  while(cycle.length<=component.size){
   if(visited.has(current)){closed=current===start;break;}
   visited.add(current);cycle.push(current);
   const neighbors=adjacency.get(current);
   const next=neighbors[0]===previous?neighbors[1]:neighbors[0];
   previous=current;current=next;
  }
  if(closed&&cycle.length===component.size)loops.push(cycle);
 }
 return loops;
}

export function sealOriginalOralAperture(face,{strict=false}={}){
 const geometry=face?.geometry,pos=geometry?.getAttribute?.('position');
 if(!face?.isMesh||!pos||!geometry.getIndex())
  return {sealed:false,reason:'missing-indexed-head'};
 if(face.userData.v82IntegratedMouth?.integrated)
  return {sealed:false,reason:'experimental-mouth-active'};
 geometry.computeBoundingBox();
 const bounds=geometry.boundingBox,size=bounds.getSize(new THREE.Vector3());
 const mouthNominal=bounds.min.y+size.y*.509;
 const loops=boundaryCycles(geometry);
 const eligible=[];
 for(const ring of loops){
  if(ring.length<20||ring.length>80)continue;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,
   minZ=Infinity,maxZ=-Infinity;
  for(const i of ring){
   const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);
   minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  }
  const spanX=maxX-minX,spanY=maxY-minY,spanZ=maxZ-minZ;
  // The original lip slit is very shallow in Y, far forward in Z.
  // Deep internal mouth rim, eyelids and scalp holes must never be capped.
  if(Math.abs((minY+maxY)/2-mouthNominal)>size.y*.07||
   spanX<size.x*.10||spanX>size.x*.30||
   spanY>size.y*.043||spanY<size.y*.001||
   spanZ>size.z*.13||
   minZ<bounds.min.z+size.z*.76)continue;
  const contour=ring.map(i=>new THREE.Vector2(pos.getX(i),pos.getY(i)));
  let area=0;
  for(let k=0;k<contour.length;k++){
   const a=contour[k],b=contour[(k+1)%contour.length];
   area+=a.x*b.y-b.x*a.y;
  }
  if(Math.abs(area)<size.x*size.y*.00005)continue;
  eligible.push({ring,contour,area,spanX,spanY,spanZ});
 }
 // Fail closed on unexpected donor geometry: do not punch/cover random
 // parts of cheeks or eyelids. A visual QA failure is better than a scar.
 if(eligible.length!==1){
  return {sealed:false,reason:'ambiguous-front-oral-ring',
   candidateLoops:eligible.length,originalBoundaryLoops:loops.length};
 }
 const item=eligible[0];
 const ring=item.area>0?item.ring:item.ring.slice().reverse();
 const flat=ring.map(i=>new THREE.Vector2(pos.getX(i),pos.getY(i)));
 const triangles=THREE.ShapeUtils.triangulateShape(flat,[]);
 if(triangles.length<ring.length-4){
  return {sealed:false,reason:'triangulation-rejected',
   candidateLoops:1};
 }
 // Protect against degenerate or inverted faces. The 2-D triangulation
 // is a valid front seal only if it spans the entire actual mouth opening.
 let positive=0,areaSum=0;
 const patch=[];
 for(const ids of triangles){
  const [a,b,c]=ids.map(i=>ring[i]);
  const x1=pos.getX(b)-pos.getX(a),y1=pos.getY(b)-pos.getY(a);
  const x2=pos.getX(c)-pos.getX(a),y2=pos.getY(c)-pos.getY(a);
  let zArea=x1*y2-y1*x2;
  if(Math.abs(zArea)<size.x*size.y*1e-8)continue;
  if(zArea<0){patch.push(a,c,b);zArea=-zArea;}
  else patch.push(a,b,c);
  areaSum+=zArea*.5;positive++;
 }
 const projectedArea=Math.abs(item.area)*.5;
 if(positive<ring.length*.72||
   Math.abs(areaSum-projectedArea)>projectedArea*.12){
  return {sealed:false,reason:'invalid-cap-area',
   positive,projectedArea,areaSum};
 }
 const indices=Array.from(geometry.getIndex().array);
 const initialTriangleCount=indices.length/3;
 const initialVertexCount=pos.count;
 geometry.setIndex(indices.concat(patch));
 geometry.clearGroups(); // one real skin material, including the new seal
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const report={
  sealed:true,kind:'v86-donor-vertex-oral-seal',
  originalVertices:initialVertexCount,
  addedVertices:0,addedTriangles:patch.length/3,
  initialTriangleCount,
  ringVertexCount:ring.length,
  area:projectedArea,
  originalBoundaryLoops:loops.length,
  lipRing: ring.slice(),
  preservedMorphTargets:
   (geometry.morphAttributes?.position||[]).length
 };
 face.userData.v86OralSeal=report;
 face.userData.v86SourceMouthHoleClosed=true;
 face.userData.v86NoForegroundOralOverlay=true;
 return report;
}
