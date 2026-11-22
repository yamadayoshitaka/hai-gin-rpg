import * as THREE from 'three';

/**
 * v95 topology-aware facial animation. An expression must travel across
 * adjacent skin edges (orbicularis oris and zygomatic attachment), not through
 * coincident-looking but disconnected UV seams or arbitrary screen-space discs.
 *
 * Inputs are the ORIGINAL indexed donor triangles, before neutral sealing
 * caps. The donor GLB stays immutable. All fallbacks fail closed.
 */
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));
const smooth=(a,b,x)=>{
 const t=clamp01((x-a)/(b-a));
 return t*t*(3-2*t);
};
const edgeKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;

export function auditFacialTopology(geometry,{sourceTriangleCount=null}={}){
 const p=geometry?.getAttribute?.('position'),index=geometry?.getIndex?.();
 if(!p||!index)return {valid:false,reason:'no-indexed-face'};
 const triCount=sourceTriangleCount===null?Math.floor(index.count/3):
  Math.min(Math.floor(index.count/3),Math.floor(sourceTriangleCount));
 const edges=new Map(),neighbor=Array.from({length:p.count},()=>new Map());
 let degenerate=0,nonFinite=0,invalid=0;
 const minArea2=Math.pow(Math.max(1e-8,p.count>10?
  Math.max(...[0,1,2].map(k=>Math.abs(p.getComponent(0,k)))):1)*1e-10,2);
 for(let t=0;t<triCount;t++){
  const ids=[index.getX(t*3),index.getX(t*3+1),index.getX(t*3+2)];
  if(ids.some(i=>i<0||i>=p.count||!Number.isInteger(i))){
   invalid++;continue;
  }
  const [a,b,c]=ids.map(i=>new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));
  if([...a,...b,...c].some(v=>!Number.isFinite(v))){
   nonFinite++;continue;
  }
  if(new THREE.Vector3().subVectors(b,a).cross(
   new THREE.Vector3().subVectors(c,a)).lengthSq()<=minArea2)degenerate++;
  for(let k=0;k<3;k++){
   const u=ids[k],v=ids[(k+1)%3],key=edgeKey(u,v);
   const e=edges.get(key)||{a:Math.min(u,v),b:Math.max(u,v),count:0};
   e.count++;edges.set(key,e);
   if(u!==v){
    const d=new THREE.Vector3().subVectors(
     new THREE.Vector3(p.getX(u),p.getY(u),p.getZ(u)),
     new THREE.Vector3(p.getX(v),p.getY(v),p.getZ(v))).length();
    if(d>0&&Number.isFinite(d)){
     neighbor[u].set(v,Math.min(d,neighbor[u].get(v)??Infinity));
     neighbor[v].set(u,Math.min(d,neighbor[v].get(u)??Infinity));
    }
   }
  }
 }
 const boundaryEdges=[...edges.values()].filter(e=>e.count===1);
 const nonManifoldEdges=[...edges.values()].filter(e=>e.count>2);
 return {valid:invalid===0&&nonFinite===0,
  vertexCount:p.count,triangleCount:triCount,edges:edges.size,
  degenerateTriangles:degenerate,invalidTriangles:invalid,
  nonFiniteTriangles:nonFinite,boundaryEdges:boundaryEdges.length,
  nonManifoldEdges:nonManifoldEdges.length,
  adjacency:neighbor,boundaryEdgeSet:new Set(boundaryEdges.map(e=>edgeKey(e.a,e.b)))};
}

class MinHeap{
 constructor(){this.nodes=[];}
 push(v,d){
  const q=this.nodes;let i=q.length;q.push({v,d});
  while(i>0){const parent=(i-1)>>1;if(q[parent].d<=d)break;
   q[i]=q[parent];i=parent;
  }q[i]={v,d};
 }
 pop(){
  const q=this.nodes,first=q[0],last=q.pop();
  if(q.length){
   let i=0;for(;;){
    const l=i*2+1,r=l+1;if(l>=q.length)break;
    const child=r<q.length&&q[r].d<q[l].d?r:l;
    if(q[child].d>=last.d)break;
    q[i]=q[child];i=child;
   }q[i]=last;
  }return first;
 }
 get length(){return this.nodes.length;}
}

export function createTopologyOralMuscleField(geometry,lipRing,{
 sourceTriangleCount=null,centerY=null
}={}){
 const audit=auditFacialTopology(geometry,{sourceTriangleCount});
 const fail=reason=>({valid:false,reason,topology:audit,weights:null});
 if(!audit.valid||!audit.adjacency)return fail('invalid-source-connectivity');
 if(!Array.isArray(lipRing)||lipRing.length<24||lipRing.length>100||
    new Set(lipRing).size!==lipRing.length||
    lipRing.some(i=>!Number.isInteger(i)||i<0||i>=audit.vertexCount))
  return fail('invalid-oral-ring');
 const p=geometry.getAttribute('position');
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,size=b.getSize(new THREE.Vector3());
 if(Math.min(size.x,size.y,size.z)<1e-7)return fail('zero-volume-face');
 // A verified donor ring follows a real topological edge path. The ring
 // cannot skip vertices or jump across a torn cavity.
 let missingEdges=0;
 for(let i=0;i<lipRing.length;i++){
  if(!audit.adjacency[lipRing[i]].has(lipRing[(i+1)%lipRing.length]))
   missingEdges++;
 }
 if(missingEdges>0)return fail('disconnected-oral-edge-ring');
 const cx=(b.min.x+b.max.x)*.5;
 const cy=Number.isFinite(centerY)?centerY:
  lipRing.reduce((sum,id)=>sum+p.getY(id),0)/lipRing.length;
 const xs=lipRing.map(i=>p.getX(i)),ys=lipRing.map(i=>p.getY(i));
 const halfWidth=(Math.max(...xs)-Math.min(...xs))*.5;
 if(halfWidth<size.x*.020||halfWidth>size.x*.26)
  return fail('implausible-mouth-span');
 const distances=new Float64Array(p.count).fill(Infinity);
 const heap=new MinHeap();
 for(const i of lipRing){distances[i]=0;heap.push(i,0);}
 const radius=Math.min(size.x*.24,Math.max(halfWidth*1.50,size.x*.12));
 const edgeLimit=size.x*.14;
 let visited=0;
 while(heap.length){
  const top=heap.pop(),{v,d}=top;
  if(d>distances[v]+1e-9||d>radius)continue;
  visited++;
  for(const [other,len] of audit.adjacency[v]){
   if(len>edgeLimit)continue; // never jump across disconnected nose/eye
   const nd=d+len;
   if(nd<distances[other]&&nd<=radius){
    distances[other]=nd;heap.push(other,nd);
   }
  }
 }
 const weights=new Float32Array(p.count);
 let influenced=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),distance=distances[i];
  if(!Number.isFinite(distance))continue;
  const xAway=Math.abs(x-cx)/size.x;
  const yAway=Math.abs(y-cy)/size.y;
  const front=(z-b.min.z)/size.z;
  const radial=1-smooth(radius*.35,radius,distance);
  const boundary=distance===0;
  const safeX=1-smooth(.16,.265,xAway);
  const safeY=1-smooth(.055,.13,yAway);
  const safeZ=smooth(.40,.67,front);
  weights[i]=boundary?1:clamp01(radial*safeX*safeY*safeZ);
  if(weights[i]>.0001)influenced++;
 }
 return {valid:true,topology:{
  vertexCount:audit.vertexCount,sourceTriangles:audit.triangleCount,
  boundaryEdges:audit.boundaryEdges,nonManifoldEdges:audit.nonManifoldEdges,
  degenerateTriangles:audit.degenerateTriangles,
  visitedVertices:visited,missingRingEdges:missingEdges
 },weights,centerX:cx,centerY:cy,halfWidth,radius,
 influencedVertices:influenced,topologyConnected:true,donorUnchanged:true};
}

/** Two quad strips (outer→mid→inner), anatomical normals and deterministic
 * winding. Unlike a loose cavity sphere, all surface rings start exactly on
 * the donor lip boundary and are updated from the SAME FACS deformed points. */
export function createThreeRingVestibuleIndices(count){
 if(!Number.isInteger(count)||count<24||count>100)
  throw Error('Invalid anatomical mouth boundary count');
 const indices=[];
 for(let band=0;band<2;band++){
  for(let i=0;i<count;i++){
   const j=(i+1)%count;
   const a=band*count+i,b=band*count+j;
   const c=(band+1)*count+i,d=(band+1)*count+j;
   indices.push(a,b,d,a,d,c);
  }
 }
 return indices;
}


/** A smooth sagittal reference based on cheek-side vertices at each height.
 * The nose cannot grow independently of the cheeks in the side view. */
const interpolateProfile=(nodes,y)=>{
 if(y<=nodes[0][0])return nodes[0][1];
 for(let i=0;i<nodes.length-1;i++){
  const [a,va]=nodes[i],[b,vb]=nodes[i+1];
  if(y<=b)return va+(vb-va)*smooth(a,b,y);
 }
 return nodes[nodes.length-1][1];
};
function percentile(values,t=.75){
 if(!values.length)return null;
 const sorted=values.slice().sort((a,b)=>a-b);
 const at=(sorted.length-1)*t,lo=Math.floor(at),hi=Math.ceil(at);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo);
}

/**
 * Anatomical side-profile control through TRUE skin-edge connectivity:
 * 1. Use the triangle-edge graph and start on the native nasal dorsum.
 * 2. Measure cheek support in 3D at matched horizontal slices.
 * 3. Bound the dorsum and tip relative to cheek depth (not global nose Z).
 * 4. Blend displacement over connected vertex paths with C1 ramps.
 * 5. Reject any triangle inversion or large normal/area loss.
 *
 * This is a non-destructive topology-guided re-sculpt on the donor clone,
 * not a counterfeit nose placed in front of the existing face. The original
 * indexed connectivity, UVs, vertex count and mouth/eye apertures remain.
 */
export function fitTopologyNasalSideProfile(geometry,{
 gender='female',ageWrinkles=0,strength=1
}={}){
 const p=geometry?.getAttribute?.('position'),index=geometry?.getIndex?.();
 const fail=reason=>({applied:false,reason,topologyDriven:false});
 if(gender!=='female')return fail('male-profile-preserved');
 if(!p||!index)return fail('no-indexed-face');
 const audit=auditFacialTopology(geometry);
 if(!audit.valid)return fail('invalid-topology');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox.clone(),d=box.getSize(new THREE.Vector3());
 if(Math.min(d.x,d.y,d.z)<1e-7)return fail('zero-volume-bounds');
 const cx=(box.min.x+box.max.x)*.5;
 const src=p.array.slice(),n=p.count;
 const nx=i=>Math.abs((src[i*3]-cx)/(d.x*.5));
 const ny=i=>(src[i*3+1]-box.min.y)/d.y;
 const nz=i=>(src[i*3+2]-box.min.z)/d.z;
 const positionsAt=(i)=>new THREE.Vector3(
  src[i*3],src[i*3+1],src[i*3+2]);
 // Seed on the actual original dorsal midline. Do not guess a 2D nose
 // pixel or let rear skull/ears seed the sculpt island.
 const seeds=[];
 for(let i=0;i<n;i++){
  if(nx(i)<.12&&ny(i)>.550&&ny(i)<.610&&nz(i)>.72)seeds.push(i);
 }
 if(!seeds.length)return fail('no-connected-dorsum-seeds');
 seeds.sort((a,b)=>src[b*3+2]-src[a*3+2]);
 const distance=new Float64Array(n).fill(Infinity),heap=new MinHeap();
 for(const i of seeds.slice(0,Math.min(6,seeds.length))){
  distance[i]=0;heap.push(i,0);
 }
 const radius=d.x*.39,maxEdge=d.x*.15;
 let visited=0;
 while(heap.length){
  const top=heap.pop();
  if(top.d>distance[top.v]+1e-9||top.d>radius)continue;
  visited++;
  for(const [j,len] of audit.adjacency[top.v]){
   if(len>maxEdge)continue;
   const next=top.d+len;
   if(next<distance[j]&&next<=radius){
    distance[j]=next;heap.push(j,next);
   }
  }
 }
 const cheekRows=[];
 for(let k=0;k<=24;k++){
  const y=.495+k*.010;
  const samples=[];
  for(let i=0;i<n;i++){
   if(Math.abs(ny(i)-y)>.029)continue;
   if(nx(i)<.35||nx(i)>.62||nz(i)<.47)continue;
   samples.push(src[i*3+2]);
  }
  cheekRows.push([y,percentile(samples,.72)]);
 }
 const validRows=cheekRows.filter(row=>row[1]!==null);
 if(validRows.length<8)return fail('unmeasurable-cheek-side-profile');
 for(const row of cheekRows){
  if(row[1]!==null)continue;
  const near=validRows.slice().sort((a,b)=>Math.abs(a[0]-row[0])-
   Math.abs(b[0]-row[0]))[0];
  row[1]=near[1];
 }
 // A smooth nasal root→bridge→tip→alar→philtrum cap in units of head Z.
 // The tip can lead the cheeks, but must not form a separate beak/spike.
 const maxProjection=[[.495,.055],[.535,.087],[.570,.131],
  [.605,.117],[.645,.091],[.690,.061],[.735,.040]];
 const profileAt=y=>interpolateProfile(cheekRows,y)+
  d.z*interpolateProfile(maxProjection,y);
 const originalProfiles=[];
 const proposal=new Float32Array(n),weights=new Float32Array(n);
 const youth=.70+.30*(1-clamp01((Number(ageWrinkles)||0)*1.25));
 const scalar=clamp01(strength)*youth;
 let affected=0,largestReduction=0;
 for(let i=0;i<n;i++){
  if(!Number.isFinite(distance[i])||distance[i]>radius)continue;
  const x=nx(i),y=ny(i),z=src[i*3+2];
  if(y<.49||y>.745||nz(i)<.55)continue;
  const width=1-smooth(.115,.305,x);
  const height=smooth(.505,.552,y)*(1-smooth(.685,.735,y));
  const geodesic=1-smooth(radius*.38,radius,distance[i]);
  const weight=width*height*geodesic*scalar;
  if(weight<.0001)continue;
  const cap=profileAt(y);
  const excess=Math.max(0,z-cap);
  const dz=Math.min(d.z*.17,excess*.97)*weight;
  if(dz<=d.z*.00004)continue;
  proposal[i]=-dz;weights[i]=weight;affected++;
  largestReduction=Math.max(largestReduction,dz);
 }
 if(affected<3)return fail('already-within-reference-profile');
 // Relax along one-ring neighbors; the native mesh graph prevents skips
 // across the eye, nostril slit, oral gap or disconnected UV islands.
 const relaxed=proposal.slice();
 for(let pass=0;pass<2;pass++){
  for(let i=0;i<n;i++){
   if(weights[i]<.015)continue;
   let sum=0,denom=0;
   for(const [j,len] of audit.adjacency[i]){
    if(len>maxEdge||weights[j]<.015)continue;
    const w=1/(len+d.x*.003);
    sum+=proposal[j]*w;denom+=w;
   }
   relaxed[i]=denom?proposal[i]*.82+(sum/denom)*.18:proposal[i];
  }
  proposal.set(relaxed);
 }
 const normal=(arr,a,b,c)=>{
  const ax=arr[a*3],ay=arr[a*3+1],az=arr[a*3+2];
  const ux=arr[b*3]-ax,uy=arr[b*3+1]-ay,uz=arr[b*3+2]-az;
  const vx=arr[c*3]-ax,vy=arr[c*3+1]-ay,vz=arr[c*3+2]-az;
  return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
 };
 const triangles=Array.from(index.array);
 let scale=1,rejected=0;
 let final=null;
 for(let attempt=0;attempt<5;attempt++){
  const next=src.slice();
  for(let i=0;i<n;i++)next[i*3+2]=src[i*3+2]+proposal[i]*scale;
  let fold=0,sharp=0;
  for(let t=0;t<triangles.length;t+=3){
   const a=triangles[t],b=triangles[t+1],c=triangles[t+2];
   if(!proposal[a]&&!proposal[b]&&!proposal[c])continue;
   const old=normal(src,a,b,c),now=normal(next,a,b,c);
   const oldArea=Math.hypot(...old),newArea=Math.hypot(...now);
   if(oldArea<1e-10||newArea<1e-10)continue;
   const cos=old.reduce((sum,v,k)=>sum+v*now[k],0)/(oldArea*newArea);
   if(cos<.35)fold++;
   if(newArea<oldArea*.28)sharp++;
  }
  if(!fold&&!sharp){final=next;break;}
  rejected=fold+sharp;scale*=.5;
 }
 if(!final)return fail('topological-triangle-inversion-protection');
 for(let i=0;i<n;i++)if(proposal[i])p.setZ(i,final[i*3+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const report={applied:true,topologyDriven:true,
  originalVertexCount:n,originalTriangleCount:triangles.length/3,
  verticesAffected:affected,connectedVisited:visited,
  connectedNoseSeeds:Math.min(6,seeds.length),
  cheekReferenceRows:validRows.length,blend:scale,
  maxReduction:largestReduction*scale,normalInversionRejected:rejected,
  sourceIndexPreserved:true,onlyDepthAdjusted:true,
  originalDonorUnchanged:true,profileExcessBounded:true};
 geometry.userData.v95NasalProfileTopology=report;
 return report;
}
