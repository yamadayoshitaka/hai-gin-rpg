import * as THREE from 'three';
import {v107NeutralCheekDepth} from './face-v107-natural-smile.js?v=20261122-v111-soft-malar-rest-shape';

/**
 * V106: local visible-skin retopology without replacing the CC0 donor.
 * Run AFTER v86 has found/sealed the actual lip rings, BEFORE the native oral
 * rig caches adjacency/poses. The original vertices keep their indices; only
 * actual indexed triangles and their vertex attributes gain resolution.
 * Every boundary edge is split consistently in neighboring triangles, so
 * there are no T-junctions, floating cheek shells or detached lipstick.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number(x)||0));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const key=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);

export function v106FaceZone({xn=0,yn=0,zn=0,ageStrength=0}={}){
 const x=Math.abs(xn);
 if(zn<.52||yn<.415||yn>.670||x>.79)return {cheek:0,oral:0};
 const front=smooth(.52,.72,zn);
 // The cheek needs broad curved support from the malar pad toward the jaw.
 const cheek=smooth(.27,.35,x)*(1-smooth(.70,.79,x))*
  smooth(.415,.460,yn)*(1-smooth(.620,.670,yn))*front;
 // Oral support uses extra vertices around the commissures, without
 // cutting the verified native lip ring or making an overlaid lip card.
 const oral=smooth(.075,.145,x)*(1-smooth(.355,.46,x))*
  smooth(.445,.479,yn)*(1-smooth(.565,.603,yn))*front;
 return {cheek,oral};
}

/**
 * V107: restore actual forward cheek thickness before the v106 one-ring
 * fairing, on the SINGLE owned head geometry and WITHOUT modifying ring
 * vertex IDs, UV coordinates, eye sockets or silhouette X/Y.
 */
function restoreV107NeutralCheeks(geometry,protectedSet,ageStrength=0){
 const pos=geometry.getAttribute('position');
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,dx=b.max.x-b.min.x,
  dy=b.max.y-b.min.y,dz=b.max.z-b.min.z,cx=(b.min.x+b.max.x)/2;
 let vertices=0,maxDelta=0,addedDepth=0;
 for(let i=0;i<pos.count;i++){
  if(protectedSet.has(i))continue;
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  const delta=v107NeutralCheekDepth({xn:(x-cx)/(dx*.5),
   yn:(y-b.min.y)/dy,zn:(z-b.min.z)/dz,depth:dz,ageStrength});
  if(delta>dz*.00001){
   pos.setZ(i,z+delta);
   vertices++;
   maxDelta=Math.max(maxDelta,delta);
   addedDepth+=delta;
  }
 }
 pos.needsUpdate=true;
 geometry.computeBoundingBox();
 return {vertices,maxDelta,addedDepth,geometryOnly:true};
}

/**
 * V111: remove actual high-frequency Z ridges on the ORIGINAL connected
 * cheek surface (after v93/v99/v105 and gentle v107 volume support).
 * The mask excludes nasal/ocular skin, lip commissures, chin and silhouette.
 * This is geometry fairing, not a shader, texture, extra subdivision or
 * detached overlay. Only the cheek's donor-derived Z coordinates are moved.
 */
export function fairV111CheekResiduals(geometry,protectedSet=new Set(),ageStrength=0){
 const pos=geometry?.getAttribute?.('position'),index=geometry?.getIndex?.();
 if(!pos||!index)return {changed:0,maxDisplacement:0,reason:'indexed-head-required'};
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,dx=box.max.x-box.min.x,
  dy=box.max.y-box.min.y,dz=box.max.z-box.min.z,cx=(box.min.x+box.max.x)*.5;
 if(Math.min(dx,dy,dz)<1e-8)return {changed:0,maxDisplacement:0,reason:'invalid-bounds'};
 const original=pos.array.slice(),n=pos.count;
 const adjacency=Array.from({length:n},()=>new Map());
 const triangles=[];
 const normal=(a,i,j,k)=>{
  const I=i*3,J=j*3,K=k*3,
   ux=a[J]-a[I],uy=a[J+1]-a[I+1],uz=a[J+2]-a[I+2],
   vx=a[K]-a[I],vy=a[K+1]-a[I+1],vz=a[K+2]-a[I+2];
  return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
 };
 for(let t=0;t<index.count;t+=3){
  const a=index.getX(t),b=index.getX(t+1),c=index.getX(t+2);
  if(a>=n||b>=n||c>=n||a===b||b===c||c===a)continue;
  const q=normal(original,a,b,c),area=Math.hypot(...q);
  if(area>1e-12)triangles.push({a,b,c,q,area});
  for(const [i,j] of [[a,b],[b,c],[c,a]]){
   const I=i*3,J=j*3;
   const length=Math.hypot(original[I]-original[J],
    original[I+1]-original[J+1],original[I+2]-original[J+2]);
   // No topologically unrelated smoothing across nasal/oral folds.
   if(length>1e-8&&length<dx*.115){
    adjacency[i].set(j,length);adjacency[j].set(i,length);
   }
  }
 }
 const mask=new Float32Array(n);
 const youth=1-.58*clamp(ageStrength);
 for(let i=0;i<n;i++){
  if(protectedSet.has(i))continue;
  const I=i*3,x=Math.abs((original[I]-cx)/(dx*.5)),
   y=(original[I+1]-box.min.y)/dy,z=(original[I+2]-box.min.z)/dz;
  // Smoothstep feathering at the border avoids an artificial contour shelf.
  const side=smooth(.315,.405,x)*(1-smooth(.660,.765,x));
  const vertical=smooth(.425,.485,y)*(1-smooth(.605,.650,y));
  const front=smooth(.55,.77,z);
  const center=bell(x,.49,.23)*bell(y,.525,.13);
  mask[i]=youth*side*vertical*front*center;
 }
 // Jacobi (double-buffered) bilateral one-ring fairing on SOURCE topology.
 // No running edits in place; no material-dependent normals. Reject edges
 // whose 3D depth suggests a mouth fold or an occluded back-face.
 let current=new Float32Array(n);
 for(let i=0;i<n;i++)current[i]=original[i*3+2];
 for(let pass=0;pass<8;pass++){
  const next=current.slice();
  for(let i=0;i<n;i++){
   if(mask[i]<.025||adjacency[i].size<3)continue;
   const z=current[i];let sum=0,total=0;
   for(const [j,length] of adjacency[i]){
    if(mask[j]<.015||protectedSet.has(j))continue;
    const depthGap=Math.abs(current[j]-z);
    if(depthGap>dz*.085)continue;
    const bilateral=Math.exp(-.5*(depthGap/(dz*.090))**2);
    const weight=bilateral/(length+dx*.003);
    sum+=current[j]*weight;total+=weight;
   }
   if(total){
    const target=z+.47*mask[i]*(sum/total-z);
    // Move source vertices rather than refining a corrugated surface.
    // A small asymmetric range maintains the malar pad's positive volume.
    next[i]=clamp(target,original[i*3+2]-dz*.010,
     original[i*3+2]+dz*.014);
   }
  }
  current=next;
 }
 // Check ORIGINAL triangle winding/area after the proposed sculpt.
 // Attenuate unsafe vertices locally rather than rolling back all cheeks.
 const displacement=new Float32Array(n),blend=new Float32Array(n).fill(1);
 for(let i=0;i<n;i++)displacement[i]=current[i]-original[i*3+2];
 let accepted=null,guarded=0;
 for(let attempt=0;attempt<18;attempt++){
  const candidate=original.slice();
  for(let i=0;i<n;i++)candidate[i*3+2]+=displacement[i]*blend[i];
  const unsafe=new Set();
  for(const tri of triangles){
   const {a,b,c,q,area}=tri;
   if(!displacement[a]&&!displacement[b]&&!displacement[c])continue;
   const q1=normal(candidate,a,b,c),area1=Math.hypot(...q1);
   const cosine=area1>1e-12?
    (q[0]*q1[0]+q[1]*q1[1]+q[2]*q1[2])/(area*area1):0;
   if(area1<area*.28||cosine<.42)
    for(const id of [a,b,c])if(displacement[id]&&blend[id])unsafe.add(id);
  }
  if(!unsafe.size){accepted=candidate;break;}
  guarded+=unsafe.size;
  for(const id of unsafe)blend[id]=attempt>=14?0:blend[id]*.5;
 }
 if(!accepted)return {changed:0,maxDisplacement:0,reason:'triangle-safety-rollback',guarded};
 let changed=0,maxDisplacement=0,netDelta=0;
 for(let i=0;i<n;i++){
  const before=original[i*3+2],after=accepted[i*3+2],delta=after-before;
  if(Math.abs(delta)>1e-9){
   pos.setZ(i,after);changed++;
   maxDisplacement=Math.max(maxDisplacement,Math.abs(delta));
   netDelta+=delta;
  }
 }
 pos.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 return {changed,maxDisplacement,netDelta,guarded,
  iterations:8,cheekOnly:true,sourceVertexPositionsChanged:true,
  lipsEyesNoseJawSilhouetteProtected:true,windingChecked:true};
}

// All 0/1/2/3-edge templates preserve source winding for arbitrary
// nonuniform facial triangle subdivisions.
function splitTriangle(a,b,c,mAB,mBC,mCA,out){
 const emit=(u,v,w)=>out.push(u,v,w);
 const edges=[mAB!==undefined,mBC!==undefined,mCA!==undefined];
 const n=edges.filter(Boolean).length;
 if(!n){emit(a,b,c);return;}
 if(n===3){
  emit(a,mAB,mCA);emit(mAB,b,mBC);
  emit(mCA,mBC,c);emit(mAB,mBC,mCA);return;
 }
 const v=[a,b,c],m=[mAB,mBC,mCA];
 if(n===1){
  const k=edges.indexOf(true),A=v[k],B=v[(k+1)%3],C=v[(k+2)%3];
  const M=m[k];emit(A,M,C);emit(M,B,C);return;
 }
 // Rotate until the unsplit edge is CA; then split AB and BC.
 const missing=edges.indexOf(false),k=(missing+1)%3;
 const A=v[k],B=v[(k+1)%3],C=v[(k+2)%3],
  M=m[k],N=m[(k+1)%3];
 emit(A,M,C);emit(M,B,N);emit(M,N,C);
}

function subdivideOnce(geometry,protectedSet,{mouthOnly=false}={}){
 const position=geometry.getAttribute('position'),index=geometry.getIndex();
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,dx=b.max.x-b.min.x,
  dy=b.max.y-b.min.y,dz=b.max.z-b.min.z,cx=(b.min.x+b.max.x)/2;
 const attributes=Object.entries(geometry.attributes);
 const morphs=Object.entries(geometry.morphAttributes||{});
 const rawIndices=Array.from(index.array);
 const sealCount=geometry.userData?.v106OriginalTriCount??rawIndices.length/3;
 const sourceIndices=rawIndices.slice(0,sealCount*3),
  capIndices=rawIndices.slice(sealCount*3);
 const lookup=new Map(),midpoints=[];
 const edgeOwners=new Map();
 for(let t=0;t<sourceIndices.length;t+=3){
  const [a,b,c]=sourceIndices.slice(t,t+3);
  for(const [u,v] of [[a,b],[b,c],[c,a]]){
   const edge=key(u,v);
   if(!edgeOwners.has(edge))edgeOwners.set(edge,[u,v]);
  }
 }
 for(const [edge,[a,b0]] of edgeOwners){
  if(protectedSet.has(a)||protectedSet.has(b0))continue;
  const midpoint=[
   (position.getX(a)+position.getX(b0))*.5,
   (position.getY(a)+position.getY(b0))*.5,
   (position.getZ(a)+position.getZ(b0))*.5];
  const x=(midpoint[0]-cx)/(dx*.5),
   y=(midpoint[1]-b.min.y)/dy,z=(midpoint[2]-b.min.z)/dz;
  const zone=v106FaceZone({xn:x,yn:y,zn:z});
  // v110 balanced topology: the original donor already has enough
  // cheek triangles. Prior refinement split broad cheek edges twice
  // by adjacency, producing >5000 extra vertices and visible faceting
  // in ultra-thin first-frame portraits. Preserve fine detail primarily
  // at the oral/commissure zone, with sparse malar support.
  const strength=mouthOnly?zone.oral:Math.max(zone.cheek*.65,zone.oral);
  if(strength<(mouthOnly?.45:.40))continue;
  // The original lip outline must keep exactly the same connected edges.
  // A protected endpoint is already blocked above; the ring itself cannot
  // acquire a non-donor midpoint.
  const id=position.count+midpoints.length;
  lookup.set(edge,id);midpoints.push([a,b0]);
 }
 if(!midpoints.length)return {addedVertices:0,addedTriangles:0,protectedEdges:true};
 const rebuilt=[];
 for(let t=0;t<sourceIndices.length;t+=3){
  const a=sourceIndices[t],b0=sourceIndices[t+1],c=sourceIndices[t+2];
  splitTriangle(a,b0,c,lookup.get(key(a,b0)),
   lookup.get(key(b0,c)),lookup.get(key(c,a)),rebuilt);
 }
 // All geometry attributes stay aligned (position, UV, colors, normals).
 // No source vertex index or source UV is renumbered.
 for(const [name,attr] of attributes){
  if(!attr.isBufferAttribute||attr.isInterleavedBufferAttribute)
   throw Error('v106-unsupported-buffer-attribute:'+name);
  const out=new attr.array.constructor((attr.count+midpoints.length)*attr.itemSize);
  out.set(attr.array);
  for(let i=0;i<midpoints.length;i++){
   const [a,b0]=midpoints[i],base=(attr.count+i)*attr.itemSize;
   for(let k=0;k<attr.itemSize;k++)
    out[base+k]=(attr.getComponent(a,k)+attr.getComponent(b0,k))*.5;
  }
  geometry.setAttribute(name,new THREE.BufferAttribute(out,attr.itemSize,attr.normalized));
 }
 // Morph targets also require matching vertex counts after tessellation.
 // Interpolate each original donor morph value on the same stable edges.
 for(const [name,targets] of morphs){
  geometry.morphAttributes[name]=targets.map(attr=>{
   if(!attr.isBufferAttribute||attr.count!==position.count)
    throw Error('v106-unsupported-morph-attribute:'+name);
   const out=new attr.array.constructor((attr.count+midpoints.length)*attr.itemSize);
   out.set(attr.array);
   for(let i=0;i<midpoints.length;i++){
    const [a,b0]=midpoints[i],base=(attr.count+i)*attr.itemSize;
    for(let k=0;k<attr.itemSize;k++)
     out[base+k]=(attr.getComponent(a,k)+attr.getComponent(b0,k))*.5;
   }
   return new THREE.BufferAttribute(out,attr.itemSize,attr.normalized);
  });
 }
 geometry.setIndex(rebuilt.concat(capIndices));
 geometry.userData.v106OriginalTriCount=rebuilt.length/3;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 return {
  addedVertices:midpoints.length,
  addedTriangles:(rebuilt.length-sourceIndices.length)/3,
  sourceTriangles:rebuilt.length/3,
  totalTriangles:geometry.index.count/3,
  protectedEdges:true
 };
}

/**
 * Retopologize the visible indexed head after sealing native lips.
 * Retained seal triangles remain at the END of the index buffer; the
 * native rig sees the updated original source triangle count.
 */
export function refineV106CheekMouthTopology(face,{gender='female',ageStrength=0}={}){
 const geometry=face?.geometry,seal=face?.userData?.v86OralSeal;
 const p=geometry?.getAttribute?.('position'),idx=geometry?.getIndex?.();
 const fail=reason=>({applied:false,reason});
 if(gender!=='female')return fail('male-reference-preserved');
 if(!seal?.sealed||!idx||!p||p.count<1000)return fail('native-oral-seal-required');
 if(geometry.userData.v106LocalRetopo?.applied)return fail('already-densified');
 // Base donor morph attributes are interpolated with each split edge.
 // Native outer lip boundary and inner fissure stay EXACT donor topology.
 const rings=[...(seal.lipRing||[]),...(seal.outerSelectedRing||[])];
 const protectedSet=new Set(rings);
 // Preserve the two ray-verified original interior folds: the native
 // mouth rig deliberately hides these exact triangles during jaw opening.
 if(p.count===3490)for(const id of [1882,2240,2242,1879,2244,3242])
  protectedSet.add(id);
 const beforePositions=p.array.slice(),beforeCount=p.count,
  beforeTriangles=idx.count/3,beforeIndices=Array.from(idx.array);
 const geometryBackup=geometry.clone();
 try{
  const restCheek=restoreV107NeutralCheeks(geometry,protectedSet,ageStrength);
  const fairing=fairV111CheekResiduals(geometry,protectedSet,ageStrength);
  geometry.userData.v106OriginalTriCount=seal.initialTriangleCount;
  const broad=subdivideOnce(geometry,protectedSet);
  const oral=subdivideOnce(geometry,protectedSet,{mouthOnly:true});
  const totalAdded=broad.addedVertices+oral.addedVertices;
  if(totalAdded<20)throw Error('insufficient-visible-face-coverage');
  // Ring indices and their XYZ remain unchanged; no split source ring edge.
  const after=geometry.getAttribute('position');
  for(const i of protectedSet){
   if(after.getX(i)!==beforePositions[i*3]||
    after.getY(i)!==beforePositions[i*3+1]||
    after.getZ(i)!==beforePositions[i*3+2])
    throw Error('native-lip-boundary-moved');
  }
  seal.initialTriangleCount=geometry.userData.v106OriginalTriCount;
  const report={applied:true,version:106,
   originalVertices:beforeCount,visibleVertices:after.count,
   originalTriangles:beforeTriangles,
   visibleTriangles:geometry.getIndex().count/3,
   addedVertices:totalAdded,addedTriangles:broad.addedTriangles+oral.addedTriangles,
   cheekRelaxedVertices:fairing.changed,
   v111CheekSurface:fairing,
   v111GeometryRevision:'original-indexed-cheek-residual-fairing',
   maxCheekRelaxation:fairing.maxDisplacement,
   v107RestCheekVertices:restCheek.vertices,
   v107MaxForwardCheekDepth:restCheek.maxDelta,
   v107TotalForwardCheekDepth:restCheek.addedDepth,
   v110DensityProfile:'balanced-cheek-sparse-oral-detailed',
   v110BroadVertices:broad.addedVertices,
   v110OralVertices:oral.addedVertices,
   protectedLipVertexCount:protectedSet.size,
   lipRingIndicesPreserved:true,donorPreserved:true,
   oralInteriorCapPreserved:true,noFloatingLipMesh:true};
  geometry.userData.v106LocalRetopo=report;
  face.userData.v106LocalRetopo=report;
  geometryBackup.dispose();
  return report;
 }catch(error){
  // Caller has already cloned the GLB. Preserve topology if an unsupported
  // attribute or degenerate edge prevents a safe local refinement.
  geometry.copy(geometryBackup);
  geometryBackup.dispose();
  seal.initialTriangleCount=beforeIndices.length/3-(seal.addedTriangles||0);
  return fail('safe-rollback:'+String(error?.message||error));
 }
}
