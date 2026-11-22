import * as THREE from 'three';

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
const invariant=geometry=>geometry.getAttribute('position')?.count;

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

/** Slight Z fairing of original low-poly cheek, NEVER a new cheek mound.
 * Preserve the nose, lip rings and every X/Y silhouette coordinate.
 */
function regularizeCheeks(geometry,protectedSet){
 const pos=geometry.getAttribute('position'),index=geometry.getIndex();
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,dx=box.max.x-box.min.x,
  dy=box.max.y-box.min.y,dz=box.max.z-box.min.z,cx=(box.min.x+box.max.x)/2;
 const neighbors=Array.from({length:pos.count},()=>new Set());
 for(let t=0;t<index.count;t+=3){
  const a=index.getX(t),b=index.getX(t+1),c=index.getX(t+2);
  for(const [u,v] of [[a,b],[b,c],[c,a]]){
   if(u===v)continue;neighbors[u].add(v);neighbors[v].add(u);
  }
 }
 const original=pos.array.slice(),z=new Float32Array(pos.count),
  mask=new Float32Array(pos.count);
 for(let i=0;i<pos.count;i++){
  const I=i*3,x=original[I],y=original[I+1],depth=original[I+2];
  const nx=Math.abs((x-cx)/(dx*.5)),ny=(y-box.min.y)/dy,
   nz=(depth-box.min.z)/dz;
  const center=bell(nx,.49,.22)*bell(ny,.525,.115);
  const safe=smooth(.31,.385,nx)*(1-smooth(.655,.77,nx))*
   smooth(.425,.475,ny)*(1-smooth(.605,.655,ny))*smooth(.55,.80,nz);
  mask[i]=protectedSet.has(i)?0:center*safe;
  z[i]=depth;
 }
 let changed=0,maxDisplacement=0;
 // Edge-weighted 1-ring fairing; small per-iteration movement avoids
 // overshooting the malar crest or hollowing the lower cheeks.
 for(let pass=0;pass<3;pass++){
  const next=z.slice();
  for(let i=0;i<pos.count;i++){
   if(mask[i]<.02||neighbors[i].size<3)continue;
   const I=i*3,base=z[i];let sum=0,weight=0;
   for(const j of neighbors[i]){
    if(!mask[j]||protectedSet.has(j))continue;
    const J=j*3,dist=Math.hypot(original[I]-original[J],
     original[I+1]-original[J+1],original[I+2]-original[J+2]);
    if(dist<1e-8||dist>dx*.115)continue;
    const w=1/(dist+dx*.003);
    sum+=z[j]*w;weight+=w;
   }
   if(weight){
    const target=base+.28*mask[i]*(sum/weight-base);
    const lower=original[I+2]-dz*.006,upper=original[I+2]+dz*.006;
    next[i]=clamp(target,lower,upper);
   }
  }
  z.set(next);
 }
 for(let i=0;i<pos.count;i++){
  const delta=z[i]-original[i*3+2];
  if(Math.abs(delta)>1e-9){pos.setZ(i,z[i]);changed++;
   maxDisplacement=Math.max(maxDisplacement,Math.abs(delta));}
 }
 pos.needsUpdate=true;
 return {changed,maxDisplacement};
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
  const strength=mouthOnly?zone.oral:Math.max(zone.cheek,zone.oral);
  if(strength<.32)continue;
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
export function refineV106CheekMouthTopology(face,{gender='female'}={}){
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
  const fairing=regularizeCheeks(geometry,protectedSet);
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
   maxCheekRelaxation:fairing.maxDisplacement,
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
