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
