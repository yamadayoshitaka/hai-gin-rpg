/**
 * v99: source-topology cheek fairing and downward-facing nostril silhouette.
 * Applied exactly once to a cloned, already-neutral-sculpted head AFTER v93/v95
 * and BEFORE native eye/oral construction. No decals or extra mesh surfaces.
 *
 * The v98 gaussian malar spike is intentionally NOT layered with this pass.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const bell=(v,c,r)=>Math.exp(-.5*((v-c)/r)**2);
const zero=()=>({dx:0,dy:0,dz:0,cheek:0,alar:0,ridge:0});

/** Signed X/half-width, Y normalized bottom-to-top, Z from back-to-front.
 * dx/dy/dz returned in matching normalized dimension units.
 * The cheek is a wide plateau with ridge *removal*, not a narrow Z bump.
 */
export function v99FacialSurfaceDelta({xn=0,yn=0,zn=0,ageWrinkles=0,cheekContourMode='v101'}={}){
 const youth=1-smooth(.15,.68,ageWrinkles);
 const ax=Math.abs(xn);
 if(youth<.001||yn<.40||yn>.715||zn<.50||ax>.845)return zero();
 const front=smooth(.53,.78,zn);
 // Cheek pad runs UNDER the malar peak, continuing to the mouth-side and
 // upper jaw. Broad smoothstep ramps avoid pulling individual vertex columns.
 const cheekX=smooth(.295,.395,ax)*(1-smooth(.67,.83,ax));
 const cheekY=smooth(.414,.496,yn)*(1-smooth(.625,.690,yn));
 const cheek=cheekX*cheekY*front;
 const below=smooth(.426,.483,yn)*(1-smooth(.515,.590,yn))*cheekX*front;
 // Undo the high, pointed malar hill left by stacked v93-v98 passes.
 // This is a negative relief cap, NOT another local cheek protrusion.
 const ridge=cheek*bell(ax,.48,.17)*bell(yn,.570,.066);
 // v101: soften the corrective peak now that the v93 base has stopped
 // creating a strong local upper-cheek protrusion; support the lower pad.
 // The v100 field remains available only for controlled A/B tests.
 const cheekDz=cheekContourMode==='v100'?
  youth*(.0060*cheek+.0135*below-.0260*ridge):
  youth*(.0040*cheek+.0185*below-.0145*ridge);
 const cheekDx=xn*.0034*cheek*youth;
 // Nose field is disjoint from cheek field. Front-facing tip and the
 // two alar lower edges travel DOWN together, hiding nostril sky-view.
 // Only donor-native vertices move, so the slit remains the same topology.
 // v100 oral boundary protection: real donor vermilion/lip vertices extend
 // up to y=.537. Lower the TIP and ALAR cartilages ABOVE that ring rather
 // than dragging the upper lip or philtrum downward with the nose.
 const nasal=smooth(.535,.551,yn)*(1-smooth(.676,.714,yn))*
  (1-smooth(.255,.320,ax))*front*youth;
 const tip=bell(ax,.055,.090)*bell(yn,.567,.046)*nasal;
 const alar=bell(ax,.160,.052)*bell(yn,.545,.035)*nasal;
 const columella=bell(ax,.062,.055)*bell(yn,.535,.029)*nasal;
 const nasalBridge=bell(ax,.120,.062)*bell(yn,.630,.061)*nasal;
 const dx=cheekDx-xn*(.025*alar+.005*nasalBridge);
 // Lowering the front rim rather than vertically moving the entire nose
 // closes its appearance from front and still leaves side profile natural.
 const dy=-(.014*tip+.020*alar+.008*columella);
 // Do not recess the tip excessively: it must shade the nostril opening.
 const dz=cheekDz-.004*tip-.004*alar+.0045*columella;
 return {dx,dy,dz,cheek,alar,ridge};
}
const normal=(a,i,j,k)=>{
 const I=i*3,J=j*3,K=k*3;
 const ux=a[J]-a[I],uy=a[J+1]-a[I+1],uz=a[J+2]-a[I+2];
 const vx=a[K]-a[I],vy=a[K+1]-a[I+1],vz=a[K+2]-a[I+2];
 return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
};

/** Curvature-aware real-mesh fairing. Use actual indexed one-ring adjacency
 * and spatially short edges: no interpolation across mouth/eye voids.
 * Local topological smoothing removes concentrated spikes in cheek normals.
 * A triangle-safety line search rejects foldovers, retaining source indices.
 */
export function refineV99FemaleProfile(geometry,{
 gender='female',ageWrinkles=0,cheekContourMode='v101'
}={}){
 const fail=reason=>({applied:false,reason});
 if(gender!=='female')return fail('male-head-unchanged');
 if(clamp(ageWrinkles)>=.68)return fail('mature-face-unchanged');
 const p=geometry?.getAttribute?.('position'),index=geometry?.getIndex?.();
 if(!p||!index||p.count<100||index.count<200)return fail('missing-indexed-head');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox;
 const width=box.max.x-box.min.x,height=box.max.y-box.min.y,
  depth=box.max.z-box.min.z;
 if(Math.min(width,height,depth)<1e-6)return fail('zero-face-dimension');
 const cx=(box.min.x+box.max.x)*.5,source=p.array.slice(),n=p.count;
 const initial=source.slice(),cheekMask=new Float32Array(n);
 const adjacency=Array.from({length:n},()=>new Map());
 let moved=0,cheekVertices=0,alarVertices=0,maxNoseDown=0;
 for(let i=0;i<n;i++){
  const at=i*3,x=source[at],y=source[at+1],z=source[at+2];
  const field=v99FacialSurfaceDelta({
   xn:(x-cx)/(width*.5),yn:(y-box.min.y)/height,
   zn:(z-box.min.z)/depth,ageWrinkles,cheekContourMode
  });
  const dx=field.dx*width*.5,dy=field.dy*height,dz=field.dz*depth;
  initial[at]+=dx;initial[at+1]+=dy;initial[at+2]+=dz;
  cheekMask[i]=field.cheek;
  if(Math.abs(dx)+Math.abs(dy)+Math.abs(dz)>1e-9)moved++;
  if(field.cheek>.075)cheekVertices++;
  if(field.alar>.07)alarVertices++;
  if(dy<0&&field.alar>.07)maxNoseDown=Math.max(maxNoseDown,-dy);
 }
 if(moved<15||cheekVertices<6||alarVertices<2)
  return fail('unresolved-native-cheek-or-nostril-vertices');
 const edgeLimit=width*.105;
 // Build links from ORIGINAL triangles; never connect merely overlapping UVs.
 for(let t=0;t<index.count;t+=3){
  const a=index.getX(t),b=index.getX(t+1),c=index.getX(t+2);
  if(a>=n||b>=n||c>=n)return fail('invalid-face-index');
  for(const [i,j] of [[a,b],[b,c],[c,a]]){
   if(i===j)continue;
   const I=i*3,J=j*3;
   const len=Math.hypot(source[I]-source[J],source[I+1]-source[J+1],
    source[I+2]-source[J+2]);
   if(len>0&&len<edgeLimit){
    adjacency[i].set(j,len);
    adjacency[j].set(i,len);
   }
  }
 }
 // Bilateral fairing of cheek Z only. Do not smear the nasal rim or
 // moving oral loop. A wide cheek mask with small Laplacian steps reduces
 // isolated sharp folds while keeping the cheek's overall intended volume.
 let current=initial.slice();
 for(let pass=0;pass<4;pass++){
  const next=current.slice();
  for(let i=0;i<n;i++){
   const w=cheekMask[i];
   if(w<.035||adjacency[i].size<3)continue;
   const I=i*3,zi=current[I+2];
   let total=0,sum=0;
   for(const [j,len] of adjacency[i]){
    if(cheekMask[j]<.015)continue;
    const zj=current[j*3+2],difference=zi-zj;
    const bilateral=Math.exp(-.5*(difference/(depth*.12))**2);
    const weight=bilateral/(len+width*.006);
    sum+=zj*weight;total+=weight;
   }
   if(total>0)next[I+2]=zi+.38*w*(sum/total-zi);
  }
  current=next;
 }
 // v100: on the genuine GLB, an existing near-degenerate / steep
 // triangle could reject ALL 8 global blend factors in v99. Instead of
 // aborting every cheek and nose vertex, attenuate only displacement in
 // the triangle's local one-ring. Preserve the valid regions at full power.
 // These tests compare the source and candidate normals of ORIGINAL indexed
 // triangles; original donor coordinates and triangle connectivity never move.
 const displacement=new Float32Array(source.length);
 for(let i=0;i<source.length;i++)displacement[i]=current[i]-source[i];
 const localBlend=new Float32Array(n).fill(1);
 const triangles=[];
 for(let t=0;t<index.count;t+=3){
  const a=index.getX(t),b=index.getX(t+1),c=index.getX(t+2);
  const faceNormal=normal(source,a,b,c),area=Math.hypot(...faceNormal);
  if(area>1e-10)triangles.push({a,b,c,area,faceNormal});
 }
 let accepted=null,guardPasses=0,guardedVertices=new Set(),unsafeCandidates=0;
 for(let attempt=0;attempt<24;attempt++){
  const candidate=source.slice();
  for(let i=0;i<n;i++)for(let axis=0;axis<3;axis++){
   const at=i*3+axis;
   candidate[at]=source[at]+displacement[at]*localBlend[i];
  }
  const unsafe=new Set();
  for(const tri of triangles){
   const {a,b,c,area,faceNormal}=tri;
   const m=normal(candidate,a,b,c),area1=Math.hypot(...m);
   const dot=faceNormal[0]*m[0]+faceNormal[1]*m[1]+faceNormal[2]*m[2];
   const cos=area1>1e-14?dot/(area*area1):0;
   if(area1<area*.24||cos<.38){
    // Only the moved vertices may be attenuated; unchanged ear/oral
    // vertices must stay precisely in their donor positions.
    for(const v of [a,b,c])if(localBlend[v]>0&&
     (Math.abs(displacement[v*3])+Math.abs(displacement[v*3+1])+
      Math.abs(displacement[v*3+2])>1e-10))unsafe.add(v);
   }
  }
  if(unsafe.size===0){accepted=candidate;guardPasses=attempt;break;}
  unsafeCandidates+=unsafe.size;
  for(const v of unsafe){
   guardedVertices.add(v);
   // Converge locally. After enough halvings snap to the exact donor
   // surface to eliminate tiny-face float precision failures.
   localBlend[v]=attempt>=18?0:localBlend[v]*.5;
  }
 }
 if(!accepted)return fail('local-triangle-guard-exhausted');
 let kept=0,guarded=0;
 for(let i=0;i<n;i++){
  const delta=Math.abs(accepted[i*3]-source[i*3])+
   Math.abs(accepted[i*3+1]-source[i*3+1])+
   Math.abs(accepted[i*3+2]-source[i*3+2]);
  if(delta>1e-8)kept++;
  if(localBlend[i]<.999)guarded++;
 }
 if(kept<15)return fail('all-corrections-muted-by-topology');
 const blend=1;
 for(let i=0;i<n;i++)p.setXYZ(i,
  accepted[i*3],accepted[i*3+1],accepted[i*3+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 const report={applied:true,version:101,cheekContourMode,
  verticesAffected:moved,
  cheekVertices,alarVertices,blend,
  maxNoseDown:maxNoseDown*blend,
  fairingIterations:4,unsafeCandidates,guardPasses,guardedVertices:guarded,
  effectiveVertices:kept,sourceDonorPreserved:true,
  sourceTriangleCount:index.count/3,joinedOralRimUntouched:true,
  frontNostrilRimLowered:true,malarsSmoothed:true};
 geometry.userData.v99SurfaceReport=report;
 return report;
}
