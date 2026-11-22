/**
 * v101: cheek-only topology fairing over the proven v100 final head.
 *
 * This runs AFTER v93 portrait/v95 nose/v100 native nasal correction and
 * BEFORE the oral rig.  Unlike the previous attempt it does not rerun any
 * nose field. All original vertices with |x| <= .285 half-head-width are
 * untouched, as are the eyes, mouth, mandible, ear, scalp and source GLB.
 *
 * A broad, continuous crest-to-lower-cheek field replaces the visible
 * pointed prominence with a rounded transition on indexed donor triangles.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const smooth=(a,b,x)=>{
 const t=clamp((x-a)/(b-a));
 return t*t*(3-2*t);
};
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const normal=(a,i,j,k)=>{
 const I=i*3,J=j*3,K=k*3;
 const ux=a[J]-a[I],uy=a[J+1]-a[I+1],uz=a[J+2]-a[I+2];
 const vx=a[K]-a[I],vy=a[K+1]-a[I+1],vz=a[K+2]-a[I+2];
 return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
};
export function v101CheekContourField({xn=0,yn=0,zn=0,ageWrinkles=0}={}){
 const youth=1-smooth(.18,.68,ageWrinkles);
 const ax=Math.abs(xn);
 if(youth<.001||ax<=.285||ax>=.84||yn<=.405||yn>=.705||zn<=.51)
  return {dz:0,mask:0,crest:0,lower:0};
 const front=smooth(.51,.76,zn);
 const region=smooth(.285,.405,ax)*(1-smooth(.715,.84,ax))*
  smooth(.405,.487,yn)*(1-smooth(.625,.705,yn))*front*youth;
 const crest=bell(ax,.48,.205)*bell(yn,.568,.077)*region;
 const lower=bell(ax,.47,.22)*bell(yn,.467,.090)*region;
 // Pull back the isolated upper crest; fill the trough from below.
 // The broad fields overlap in a single connected cheek surface.
 const dz=-.038*crest+.022*lower;
 return {dz,mask:region,crest,lower};
}
/** Preserve donor triangle connectivity with local safety attenuation. */
export function fairV101CheekContour(geometry,{gender='female',ageWrinkles=0}={}){
 const fail=reason=>({applied:false,reason});
 if(gender!=='female')return fail('male-preserved');
 if(ageWrinkles>=.68)return fail('age-relief-preserved');
 const p=geometry?.getAttribute?.('position'),idx=geometry?.getIndex?.();
 if(!p||!idx||p.count<100||idx.count<200)return fail('indexed-head-required');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox;
 const dx=box.max.x-box.min.x,dy=box.max.y-box.min.y,
  depth=box.max.z-box.min.z;
 if(Math.min(dx,dy,depth)<1e-6)return fail('head-bounds-invalid');
 const cx=(box.min.x+box.max.x)/2;
 const src=p.array.slice(),n=p.count,initial=src.slice();
 const mask=new Float32Array(n),links=Array.from({length:n},()=>new Map());
 let crestVertices=0,lowerVertices=0,nasalProtectedVertices=0;
 for(let i=0;i<n;i++){
  const I=i*3,x=src[I],y=src[I+1],z=src[I+2];
  const nx=(x-cx)/(dx*.5),ny=(y-box.min.y)/dy,
   nz=(z-box.min.z)/depth;
  const a=v101CheekContourField({xn:nx,yn:ny,zn:nz,ageWrinkles});
  initial[I+2]+=depth*a.dz;
  mask[i]=a.mask;
  if(a.crest>.08)crestVertices++;
  if(a.lower>.08)lowerVertices++;
  if(Math.abs(nx)<=.285)nasalProtectedVertices++;
 }
 if(crestVertices<5||lowerVertices<3)return fail('no-native-cheek-coverage');
 const maxEdge=dx*.115;
 const triangles=[];
 for(let t=0;t<idx.count;t+=3){
  const a=idx.getX(t),b=idx.getX(t+1),c=idx.getX(t+2);
  if(a>=n||b>=n||c>=n)return fail('index-out-of-bounds');
  const norm=normal(src,a,b,c),area=Math.hypot(...norm);
  if(area>1e-10)triangles.push({a,b,c,norm,area});
  for(const [u,v] of [[a,b],[b,c],[c,a]]){
   if(u===v)continue;
   const U=u*3,V=v*3;
   const dist=Math.hypot(src[U]-src[V],src[U+1]-src[V+1],
    src[U+2]-src[V+2]);
   if(dist>1e-8&&dist<maxEdge){
    links[u].set(v,dist);links[v].set(u,dist);
   }
  }
 }
 // True one-ring bilateral fairing of Z. A small per-pass step reduces
 // normal discontinuity without flattening away all anatomical shape.
 let current=initial.slice();
 for(let pass=0;pass<5;pass++){
  const next=current.slice();
  for(let i=0;i<n;i++){
   const w=mask[i];
   if(w<.012||links[i].size<3)continue;
   const I=i*3,z=current[I+2];
   let sum=0,total=0;
   for(const [j,dist] of links[i]){
    if(mask[j]<.004)continue;
    const zz=current[j*3+2];
    const bilateral=Math.exp(-.5*((z-zz)/(depth*.105))**2);
    const weight=bilateral/(dist+dx*.004);
    sum+=zz*weight;total+=weight;
   }
   if(total)next[I+2]=z+.42*w*(sum/total-z);
  }
  current=next;
 }
 const displacement=new Float32Array(n);
 for(let i=0;i<n;i++)displacement[i]=current[i*3+2]-src[i*3+2];
 // For the protected nose all proposed deltas are exactly zero.
 const scales=new Float32Array(n).fill(1);
 let output=null,guardPasses=0,guardedVertices=new Set();
 for(let attempt=0;attempt<25;attempt++){
  const candidate=src.slice();
  for(let i=0;i<n;i++)if(displacement[i])
   candidate[i*3+2]=src[i*3+2]+displacement[i]*scales[i];
  const unsafe=new Set();
  for(const {a,b,c,norm,area} of triangles){
   if(!displacement[a]&&!displacement[b]&&!displacement[c])continue;
   const now=normal(candidate,a,b,c),area1=Math.hypot(...now);
   const dot=norm[0]*now[0]+norm[1]*now[1]+norm[2]*now[2];
   const cosine=area1>1e-14?dot/(area*area1):0;
   if(area1<area*.22||cosine<.34){
    for(const v of [a,b,c])if(displacement[v]&&scales[v]>0)
     unsafe.add(v);
   }
  }
  if(!unsafe.size){output=candidate;guardPasses=attempt;break;}
  for(const v of unsafe){
   guardedVertices.add(v);
   scales[v]=attempt>=19?0:scales[v]*.5;
  }
 }
 if(!output)return fail('v101-topology-foldover-guard');
 let altered=0,maxNoseChange=0,crestBack=0,lowerFill=0;
 for(let i=0;i<n;i++){
  const zDelta=output[i*3+2]-src[i*3+2];
  if(Math.abs(zDelta)>1e-9)altered++;
  if(zDelta<0&&mask[i]>.15)crestBack++;
  if(zDelta>0&&mask[i]>.15)lowerFill++;
  const nx=Math.abs((src[i*3]-cx)/(dx*.5));
  if(nx<=.285)maxNoseChange=Math.max(maxNoseChange,Math.abs(zDelta));
 }
 if(altered<8||!crestBack||!lowerFill)return fail('no-balanced-cheek-remesh');
 if(maxNoseChange!==0)return fail('nose-protection-violated');
 for(let i=0;i<n;i++)if(output[i*3+2]!==src[i*3+2])
  p.setZ(i,output[i*3+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 const report={applied:true,version:101,cheekOnly:true,
  crestVertices,lowerVertices,changedVertices:altered,crestBack,lowerFill,
  guardedVertices:guardedVertices.size,guardPasses,
  nasalProtectedVertices,maxNoseChange,
  originalTopologyPreserved:true,sourceDonorPreserved:true};
 geometry.userData.v101CheekContour=report;
 return report;
}
