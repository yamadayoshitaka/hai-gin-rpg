import * as THREE from 'three';

/**
 * V117 reference-portrait base mesh redesign for the actual indexed CC0 GLB.
 *
 * Previous v93/v99/v105 Gaussian passes accumulated upper-malar ridges,
 * gaunt lower cheeks, a beak-like nose and a sharply hollow lower face.
 * The correct repair is to re-anchor the YOUNG female frontal anatomy to
 * the immutable donor vertex positions, not tessellate the damaged shape.
 *
 * Reference: paired front / right-profile image supplied by the owner:
 * natural oval, soft midface, compact nasal tip, moderate lips, softer chin.
 *
 * All computations are in ORIGINAL donor-local normalized coordinates.
 * The donor GLB, UVs, index topology, face morph animations, closed oral
 * boundary, scalp and male reference remain untouched. Anatomical face
 * parts are built AFTER this mesh is sculpted so lids, lips, lashes, skin
 * pigment and FACS share the newly sculpted connected head surface.
 */
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{
 const t=clamp((n-a)/(b-a));return t*t*(3-2*t);
};
const bell=(n,c,w)=>Math.exp(-.5*((n-c)/w)**2);
const normal=(p,a,b,c)=>{
 const A=a*3,B=b*3,C=c*3;
 const ux=p[B]-p[A],uy=p[B+1]-p[A+1],uz=p[B+2]-p[A+2];
 const vx=p[C]-p[A],vy=p[C+1]-p[A+1],vz=p[C+2]-p[A+2];
 return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
};
/**
 * A single smooth anatomical field. Scalar masks alone NEVER allocate
 * vertices or introduce a layer of face stickers.
 */
export function v117ReferencePortraitField({xn=0,yn=0,zn=0}={}){
 if(![xn,yn,zn].every(Number.isFinite))
  return {cheek:0,lower:0,chin:0,jaw:0,alar:0,tip:0,bridge:0,
   mouth:0,front:0};
 const ax=Math.abs(xn);
 const front=smooth(.48,.77,zn);
 const outer=1-smooth(.74,.88,ax);
 const upperY=smooth(.36,.41,yn)*(1-smooth(.625,.685,yn));
 const cheek=smooth(.21,.32,ax)*outer*
  bell(ax,.45,.215)*bell(yn,.525,.118)*upperY*front;
 const lower=smooth(.20,.31,ax)*outer*
  bell(ax,.47,.24)*bell(yn,.433,.11)*
  (1-smooth(.55,.635,yn))*front;
 const jaw=smooth(.20,.295,yn)*(1-smooth(.48,.55,yn))*
  bell(ax,.43,.24)*front*outer;
 const chin=smooth(.20,.275,yn)*(1-smooth(.39,.46,yn))*
  bell(ax,.22,.23)*front;
 const nasalBand=smooth(.505,.548,yn)*(1-smooth(.70,.74,yn))*front;
 const tip=bell(ax,.05,.095)*bell(yn,.572,.041)*nasalBand;
 const alar=bell(ax,.159,.067)*bell(yn,.543,.035)*nasalBand;
 const bridge=bell(ax,.058,.094)*bell(yn,.651,.077)*
  smooth(.565,.610,yn)*(1-smooth(.735,.78,yn))*front;
 const mouth=bell(ax,.178,.145)*bell(yn,.509,.034)*
  (1-smooth(.38,.48,ax))*front;
 return {cheek,lower,jaw,chin,tip,alar,bridge,mouth,front};
}
function maxDelta(a,b){
 let maximum=0,n=0;
 for(let i=0;i<a.length;i++)if(a[i]!==b[i]){
  maximum=Math.max(maximum,Math.abs(a[i]-b[i]));n++;
 }
 return {maximum,components:n};
}

/**
 * Controlled sculpt of the EXISTING mesh. No subdivision, decals or color
 * tricks. A donor-relative cheek surface replaces previous stacked Z
 * fields with one broad convex midface; nose/jaw corrections are anatomically
 * continuous and bounded. A bilateral residual fairing removes tiny triangle
 * ridges while preserving the donor's real underlying curvature.
 *
 * A triangle-area / facing line search avoids inverted normals and folds.
 */
export function sculptV117ReferencePortrait(geometry,{
 gender='female',ageBand='twenties',bodyType='normal',
 donorPositions=null,donorBox=null,controls={}
}={}){
 const fail=reason=>({applied:false,reason,version:117});
 if(gender!=='female')return fail('male-source-preserved');
 if(ageBand!=='twenties')return fail('non-reference-age-preserved');
 if(!['normal','thin','ultraThin'].includes(bodyType))
  return fail('other-body-preserved');
 const attr=geometry?.getAttribute?.('position'),idx=geometry?.getIndex?.();
 if(!attr||!idx||!donorPositions||donorPositions.length!==attr.count*3)
  return fail('real-indexed-donor-required');
 const donor=donorPositions,box=donorBox||
  (geometry.computeBoundingBox(),geometry.boundingBox);
 const d=box.getSize(new THREE.Vector3());
 if(Math.min(d.x,d.y,d.z)<=.00001)return fail('invalid-head-bounds');
 const cx=(box.min.x+box.max.x)*.5;
 const before=attr.array.slice(),candidate=before.slice(),n=attr.count;
 const mask=new Float32Array(n),restResidual=new Float32Array(n);
 const frontLimit=.56;
 const build=bodyType==='normal'?1:bodyType==='thin'?.72:.42;
 const authored=Math.max(.48,1-
  Math.min(.4,Math.abs(Number(controls.faceMorph)||0)*.38)-
  Math.min(.15,Math.abs(Number(controls.nosePositionZ)||0)*.08)-
  Math.min(.13,Math.abs(Number(controls.mouthPositionZ)||0)*.06));
 const strength=build*authored;
 let cheekCandidates=0,noseCandidates=0,mouthCandidates=0,jawCandidates=0;
 let maxCandidateMove=0,maxCheekLift=0;
 // Rebuild source-anchored anatomical regions in one coherent layer.
 for(let i=0;i<n;i++){
  const I=i*3,x=donor[I],y=donor[I+1],z=donor[I+2];
  const xn=(x-cx)/(d.x*.5),yn=(y-box.min.y)/d.y,
   zn=(z-box.min.z)/d.z;
  const f=v117ReferencePortraitField({xn,yn,zn}),ax=Math.abs(xn);
  if(f.front<.001||zn<frontLimit||yn<.19||yn>.81||ax>.86)
   continue; // scalp, ears, silhouette, rear skull, neck
  const cheekMask=clamp(f.cheek*.86+f.lower*.64);
  const lipLock=1-bell(ax,.13,.085)*bell(yn,.505,.028)*.75;
  const eyeLock=1-bell(ax,.34,.16)*bell(yn,.69,.055);
  const safeCheek=clamp(cheekMask*lipLock*eyeLock);
  mask[i]=safeCheek;
  let nx=before[I],ny=before[I+1],nz=before[I+2];
  if(safeCheek>.005){
   // Previous pass has a sharp upper-malar Z shelf. Reconstruct the
   // convex cheek thickness from the ORIGINAL donor, then interpolate
   // only across the softly supported region.
   const referenceZ=z+d.z*(.051*f.cheek+.042*f.lower);
   const w=clamp(safeCheek*.82*strength);
   nz+=(referenceZ-nz)*w;
   // Full, oval cheeks, not a narrow skull or protruding cheekbone.
   nx+=(x-cx)*(.041*f.cheek+.028*f.lower)*strength;
   cheekCandidates++;
   maxCheekLift=Math.max(maxCheekLift,nz-before[I+2]);
  }
  const nose=Math.max(f.tip,f.alar,f.bridge);
  if(nose>.003){
   // Shorter, more elegant nasal projection; compress the lateral alar
   // wings, then blend the ridge into the forehead and philtrum.
   const noseWeight=clamp((.65*f.tip+.56*f.alar+.24*f.bridge)*strength);
   const targetZ=z+d.z*(.008*f.tip+.008*f.bridge+.004*f.alar);
   nz+=(targetZ-nz)*noseWeight;
   nx-=(x-cx)*(.085*f.alar+.033*f.tip)*strength;
   ny-=d.y*(.0034*f.tip+.0018*f.alar)*strength;
   noseCandidates++;
  }
  if(f.jaw>.002||f.chin>.002){
   // Restore the soft lower cheek/jaw/chin sweep without pinching the
   // anterior jaw into a skeletal V; shorten only the lower face slightly.
   nx+=(x-cx)*(.035*f.jaw+.027*f.chin)*strength;
   ny+=d.y*(.0075*f.chin+.0035*f.jaw)*strength;
   nz+=d.z*(.005*f.chin+.004*f.jaw)*strength;
   jawCandidates++;
  }
  if(f.mouth>.004){
   // Enlarge the ACTUAL native mouth region gently rather than painting
   // lips onto a narrow gap. The native lip ring is still the real skin.
   const lipBlend=1-smooth(.52,.575,yn);
   const w=f.mouth*lipBlend*strength;
   nx+=(x-cx)*.048*w;
   nz+=d.z*.006*w;
   mouthCandidates++;
  }
  // Keep per-vertex motion bounded relative to the original head size.
  nx=clamp(nx,before[I]-d.x*.038,before[I]+d.x*.038);
  ny=clamp(ny,before[I+1]-d.y*.014,before[I+1]+d.y*.014);
  nz=clamp(nz,before[I+2]-d.z*.055,before[I+2]+d.z*.055);
  candidate[I]=nx;candidate[I+1]=ny;candidate[I+2]=nz;
  maxCandidateMove=Math.max(maxCandidateMove,
   Math.hypot(nx-before[I],ny-before[I+1],nz-before[I+2]));
  restResidual[i]=nz-z;
 }
 if(cheekCandidates<5||noseCandidates<3)
  return fail('source-anatomy-mask-too-sparse');

 // One conservative, edge-length-aware smoothing of the ADDITIVE
 // cheek correction only (never smooth the underlying donor shape).
 const neighbors=Array.from({length:n},()=>new Map());
 const triangles=[];
 const maxEdge=d.x*.13;
 for(let t=0;t<idx.count;t+=3){
  const a=idx.getX(t),b=idx.getX(t+1),c=idx.getX(t+2);
  const originalNormal=normal(before,a,b,c),area=Math.hypot(...originalNormal);
  if(area>1e-12)triangles.push({a,b,c,normal:originalNormal,area});
  for(const [u,v] of [[a,b],[b,c],[c,a]]){
   const U=u*3,V=v*3,len=Math.hypot(
    donor[U]-donor[V],donor[U+1]-donor[V+1],donor[U+2]-donor[V+2]);
   if(len>1e-7&&len<maxEdge){
    neighbors[u].set(v,len);neighbors[v].set(u,len);
   }
  }
 }
 const prior=candidate.slice();
 let smoothed=0;
 for(let i=0;i<n;i++){
  if(mask[i]<.13||neighbors[i].size<3)continue;
  const I=i*3,base=prior[I+2]-donor[I+2];
  let weight=0,mean=0;
  for(const [j,len] of neighbors[i]){
   if(mask[j]<.09)continue;
   const J=j*3,other=prior[J+2]-donor[J+2];
   const distance=Math.abs(other-base);
   const bilateral=Math.exp(-.5*(distance/(d.z*.052))**2);
   const w=bilateral/(len+d.x*.006)*Math.min(1,mask[j]/mask[i]);
   mean+=other*w;weight+=w;
  }
  if(weight<=0)continue;
  const shift=clamp((mean/weight-base)*.24*mask[i]*strength,
   -d.z*.006,d.z*.006);
  if(Math.abs(shift)>1e-7){
   candidate[I+2]=prior[I+2]+shift;smoothed++;
  }
 }

 // Reject triangle fold-overs and thin-face inversions. The source has
 // existing tiny triangles: only compare initially healthy triangles.
 const scales=new Float32Array(n).fill(1);
 let blocked=0,guardIterations=0;
 const checked=triangles.filter(t=>t.area>Math.pow(d.x*2e-5,2));
 const displacement=candidate.map((x,i)=>x-before[i]);
 let accepted=null;
 for(let iteration=0;iteration<9;iteration++){
  const working=before.slice();
  for(let i=0;i<n;i++){
   const I=i*3;
   for(let axis=0;axis<3;axis++)
    working[I+axis]=before[I+axis]+displacement[I+axis]*scales[i];
  }
  const unsafe=new Set();
  for(const tri of checked){
   const q=normal(working,tri.a,tri.b,tri.c);
   const area=Math.hypot(...q);
   const facing=q[0]*tri.normal[0]+q[1]*tri.normal[1]+
    q[2]*tri.normal[2];
   if(!Number.isFinite(area)||area<tri.area*.38||
      facing<tri.area*area*.34){
    unsafe.add(tri.a);unsafe.add(tri.b);unsafe.add(tri.c);
   }
  }
  accepted=working;
  guardIterations=iteration;
  if(!unsafe.size)break;
  for(const i of unsafe){scales[i]*=.5;blocked++;}
 }
 if(!accepted||!accepted.every(Number.isFinite))
  return fail('non-finite-sculpt-rejected');
 // Safety fallback if an original source triangle is unusually fragile.
 // Do not publish any fold, even if it requires rejecting all sculpt.
 for(const tri of checked){
  const q=normal(accepted,tri.a,tri.b,tri.c),area=Math.hypot(...q);
  const dot=q[0]*tri.normal[0]+q[1]*tri.normal[1]+
   q[2]*tri.normal[2];
  if(area<tri.area*.32||dot<tri.area*area*.29)
   return fail('triangle-foldover-rejected');
 }
 let changed=0,maxDisplacement=0;
 for(let i=0;i<n;i++){
  const I=i*3,dx=accepted[I]-before[I],
   dy=accepted[I+1]-before[I+1],dz=accepted[I+2]-before[I+2];
  const motion=Math.hypot(dx,dy,dz);
  if(motion>1e-7){changed++;maxDisplacement=Math.max(maxDisplacement,motion);}
  attr.setXYZ(i,accepted[I],accepted[I+1],accepted[I+2]);
 }
 attr.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const report={
  applied:true,version:117,reference:'owner-front-profile-2026-11-23',
  realGLBSourceAnchored:true,originalSourceUntouched:true,
  sourceVertexCount:n,triangleCount:idx.count/3,
  newVertices:0,originalIndicesPreserved:true,
  originalFaceUvPreserved:true,normalRecomputed:true,
  nativeOralAndEyesUseNewHead:true,
  cheekCandidates,noseCandidates,mouthCandidates,jawCandidates,
  smoothedCheekVertices:smoothed,changedVertices:changed,
  maxCandidateMove,maxDisplacement,maxCheekLift,guardIterations,blocked,
  bodyType,ageBand,strength,triangleFoldovers:0
 };
 geometry.userData.v117ReferencePortrait=report;
 return report;
}
