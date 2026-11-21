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
  // Nose projection and chin sliders can expand Z/Y bounds considerably.
  // Use the tiny, shallow contour's OWN span/depth rather than comparing
  // its absolute position against a global max Z that belongs to the nose.
  if(Math.abs((minY+maxY)/2-mouthNominal)>size.y*.12||
   spanX<size.x*.10||spanX>size.x*.30||
   spanY>size.y*.043||spanY<size.y*.001||
   spanZ>size.z*.13)continue;
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
 const ring=item.ring;
 // The lip contour is a narrow ribbon (upper and lower arcs with
 // extensive near-collinear samples). Generic earcut discards large
 // sections as degenerate, leaving the hole unsealed. Stitch the two
 // monotonically increasing X arcs using a zipper. This keeps ALL the
 // original lip boundary vertices and never inserts floating polygons.
 let left=0,right=0;
 for(let i=1;i<ring.length;i++){
  if(pos.getX(ring[i])<pos.getX(ring[left]))left=i;
  if(pos.getX(ring[i])>pos.getX(ring[right]))right=i;
 }
 const buildArc=step=>{
  let current=left;
  const arc=[ring[current]];
  while(current!==right&&arc.length<=ring.length){
   current=(current+step+ring.length)%ring.length;
   arc.push(ring[current]);
  }
  return arc;
 };
 const upper=buildArc(1),lower=buildArc(-1);
 if(upper.length+lower.length!==ring.length+2 ||
  [upper,lower].some(arc=>arc.slice(1).some((id,k)=>
   pos.getX(id)+size.x*.0002<pos.getX(arc[k])))){
  return {sealed:false,reason:'nonmonotone-original-lip-rim',
   ringVertexCount:ring.length};
 }
 let ia=0,ib=0,positive=0,areaSum=0;
 const patch=[];
 while(ia<upper.length-1||ib<lower.length-1){
  const moveUpper=ib===lower.length-1||
   (ia<upper.length-1&&pos.getX(upper[ia+1])<=pos.getX(lower[ib+1]));
  const a=upper[ia],b=lower[ib];
  const c=moveUpper?upper[++ia]:lower[++ib];
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
 // The original GLB has THREE nested oral boundary rings: a shallow
 // 38-vertex inner lip slit and two bigger 40/46-vertex exterior rims.
 // Sealing only the small slit left an obvious black oval in the real
 // Chromium screenshot. Cap the foremost projection of the wider 40-edge
 // ring too; each triangle remains part of the SAME original face geometry.
 const outerCandidates=[];
 for(const candidate of loops){
  if(candidate===ring||candidate.length<39||candidate.length>55)continue;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  let minZ=Infinity,maxZ=-Infinity;
  for(const id of candidate){
   const x=pos.getX(id),y=pos.getY(id),z=pos.getZ(id);
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);
   minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  }
  if(Math.abs((minY+maxY)/2-mouthNominal)>size.y*.11||
   maxX-minX<size.x*.20||maxX-minX>size.x*.31||
   maxY-minY>size.y*.075||maxY-minY<size.y*.02||
   maxZ-minZ<size.z*.24||maxZ-minZ>size.z*.62)continue;
  const contour=candidate.map(id=>new THREE.Vector2(pos.getX(id),pos.getY(id)));
  let signedArea=0;
  for(let k=0;k<contour.length;k++){
   const q=contour[k],n=contour[(k+1)%contour.length];
   signedArea+=q.x*n.y-n.x*q.y;
  }
  outerCandidates.push({candidate,contour,area:Math.abs(signedArea)*.5});
 }
 outerCandidates.sort((a,b)=>b.area-a.area);
 let outerPatchCount=0,outerRingSize=0,outerPatchReason=null;
 let outerTriangulated=0,outerAreaRatio=0,outerSelectedSize=0;
 if(outerCandidates.length>=1){
  const selected=outerCandidates[0];
  outerSelectedSize=selected.candidate.length;
  // Earcut handles this wider, non-X-monotone lip rim, unlike the very
  // narrow 38-edge slit that needs the zipper strip above.
  const ears=THREE.ShapeUtils.triangulateShape(selected.contour,[]);
  const fill=[];
  let covered=0;
  for(const triple of ears){
   const [a,b,c]=triple.map(i=>selected.candidate[i]);
   const cross=(pos.getX(b)-pos.getX(a))*(pos.getY(c)-pos.getY(a))-
    (pos.getY(b)-pos.getY(a))*(pos.getX(c)-pos.getX(a));
   if(Math.abs(cross)<size.x*size.y*1e-9)continue;
   if(cross<0)fill.push(a,c,b);
   else fill.push(a,b,c);
   covered+=Math.abs(cross)*.5;
  }
  outerTriangulated=fill.length/3;
  outerAreaRatio=selected.area>0?covered/selected.area:0;
  if(fill.length>=selected.candidate.length*1.75&&
   Math.abs(covered-selected.area)<=selected.area*.20){
   patch.push(...fill);
   outerPatchCount=fill.length/3;
   outerRingSize=selected.candidate.length;
  }else outerPatchReason='wider-lip-earcut-area-validation-failed';
 }else outerPatchReason='no-wider-oral-ring-candidate';
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
  outerRingVertexCount:outerRingSize,
  outerPatchTriangles:outerPatchCount,
  outerPatchReason,
  outerCandidateCount:outerCandidates.length,
  outerSelectedSize,
  outerTriangulated,
  outerAreaRatio:Number(outerAreaRatio.toFixed(4)),
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
