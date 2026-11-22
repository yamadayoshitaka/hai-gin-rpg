/**
 * v102: donor-anchored cheek crest repair over the v100 nasal head.
 *
 * This runs AFTER v93 portrait/v95 nose/v100 native nasal correction and
 * BEFORE the oral rig.  Unlike the previous attempt it does not rerun any
 * nose field. All original vertices with |x| <= .285 half-head-width are
 * untouched, as are the eyes, mouth, mandible, ear, scalp and source GLB.
 *
 * A broad cheek field is combined with a soft source-donor height ceiling:
 * stacked neutral cheek sculpt passes must not produce a second sharp ridge.
 * The nose and oral landmarks remain exactly untouched.
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
export function v102CheekContourField({xn=0,yn=0,zn=0,ageWrinkles=0}={}){
 const youth=1-smooth(.18,.68,ageWrinkles);
 const ax=Math.abs(xn);
 if(youth<.001||ax<=.285||ax>=.84||yn<=.405||yn>=.705||zn<=.51)
  return {dz:0,mask:0,crest:0,lower:0};
 const front=smooth(.51,.76,zn);
 const region=smooth(.285,.375,ax)*(1-smooth(.735,.84,ax))*
  smooth(.410,.480,yn)*(1-smooth(.655,.715,yn))*front*youth;
 const crest=bell(ax,.445,.225)*bell(yn,.557,.093)*region;
 const lower=bell(ax,.47,.23)*bell(yn,.455,.095)*region;
 // Pull back the isolated upper crest; fill the trough from below.
 // The broad fields overlap in a single connected cheek surface.
 const dz=-.066*crest+.045*lower;
 return {dz,mask:region,crest,lower};
}
/** Preserve donor triangle connectivity with local safety attenuation. */
export function fairV102CheekContour(geometry,{
 gender='female',ageWrinkles=0,
 donorPositions=null,donorCenterX=null,donorHalfWidth=null
}={}){
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
 let donorCapVertices=0,donorCapMaxTrim=0;
 for(let i=0;i<n;i++){
  const I=i*3,x=src[I],y=src[I+1],z=src[I+2];
  const nx=(x-cx)/(dx*.5),ny=(y-box.min.y)/dy,
   nz=(z-box.min.z)/depth;
  const donorX=donorPositions?.[I]??x;
  const donorAx=Math.abs((donorX-(donorCenterX??cx))/
   (donorHalfWidth??dx*.5));
  // A donor nose vertex can drift laterally during the v100 sculpt.
  // Always classify and guard it by the IMMUTABLE original GLB index.
  const nasalLocked=donorAx<=.285;
  const a=nasalLocked?{dz:0,mask:0,crest:0,lower:0}:
   v102CheekContourField({xn:nx,yn:ny,zn:nz,ageWrinkles});
  // Anchor on the unchanged GLB vertex rather than the already sculpted
  // head: the v93/v99 passes can otherwise add up into a visible shelf.
  // Only upper/mid cheek is capped; the lower cheek keeps soft fullness.
  let corrected=z+depth*a.dz;
  if(!nasalLocked&&donorPositions?.length===src.length&&a.crest>.001){
   const donorZ=donorPositions[I+2];
   const lowerAllowance=bell(ny,.455,.095);
   const donorCeiling=donorZ+depth*(.022+.012*lowerAllowance);
   const excess=Math.max(0,corrected-donorCeiling);
   const capWeight=Math.min(1,a.crest*1.35);
   const trim=excess*capWeight;
   corrected-=trim;
   if(trim>depth*.00002){donorCapVertices++;donorCapMaxTrim=Math.max(donorCapMaxTrim,trim);}
  }
  initial[I+2]=corrected;
  mask[i]=a.mask;
  if(a.crest>.08)crestVertices++;
  if(a.lower>.08)lowerVertices++;
  if(nasalLocked)nasalProtectedVertices++;
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
 for(let pass=0;pass<8;pass++){
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
   if(total)next[I+2]=z+.47*w*(sum/total-z);
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
 if(!output)return fail('v102-topology-foldover-guard');
 let altered=0,maxNoseChange=0,crestBack=0,lowerFill=0;
 for(let i=0;i<n;i++){
  const zDelta=output[i*3+2]-src[i*3+2];
  if(Math.abs(zDelta)>1e-9)altered++;
  if(zDelta<0&&mask[i]>.15)crestBack++;
  if(zDelta>0&&mask[i]>.15)lowerFill++;
  const donorX=donorPositions?.[i*3]??src[i*3];
  const ax=Math.abs((donorX-(donorCenterX??cx))/
   (donorHalfWidth??dx*.5));
  if(ax<=.285)maxNoseChange=Math.max(maxNoseChange,Math.abs(zDelta));
 }
 if(altered<8||!crestBack||!lowerFill)return fail('no-balanced-cheek-remesh');
 if(maxNoseChange!==0)return fail('nose-protection-violated');
 for(let i=0;i<n;i++)if(output[i*3+2]!==src[i*3+2])
  p.setZ(i,output[i*3+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 const report={applied:true,version:102,cheekOnly:true,donorAnchored:true,
  donorCapVertices,donorCapMaxTrim,
  crestVertices,lowerVertices,changedVertices:altered,crestBack,lowerFill,
  guardedVertices:guardedVertices.size,guardPasses,
  nasalProtectedVertices,maxNoseChange,
  originalTopologyPreserved:true,sourceDonorPreserved:true};
 geometry.userData.v102CheekContour=report;
 return report;
}
