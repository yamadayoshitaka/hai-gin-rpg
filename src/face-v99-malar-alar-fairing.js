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
export function v99FacialSurfaceDelta({xn=0,yn=0,zn=0,ageWrinkles=0}={}){
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
 const cheekDz=youth*(.0060*cheek+.0135*below-.0260*ridge);
 const cheekDx=xn*.0034*cheek*youth;
 // Nose field is disjoint from cheek field. Front-facing tip and the
 // two alar lower edges travel DOWN together, hiding nostril sky-view.
 // Only donor-native vertices move, so the slit remains the same topology.
 const nasal=smooth(.511,.540,yn)*(1-smooth(.676,.714,yn))*
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
 gender='female',ageWrinkles=0
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
   zn:(z-box.min.z)/depth,ageWrinkles
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
 // Do not invert triangles, collapse lip/eye edge triangles, or replace
 // source topology. Halve the WHOLE edit if necessary.
 let accepted=null,blend=1,unsafeCandidates=0;
 for(let attempt=0;attempt<8;attempt++,blend*=.5){
  const candidate=source.slice();
  for(let i=0;i<source.length;i++)
   candidate[i]=source[i]+(current[i]-source[i])*blend;
  let unsafe=false,violations=0;
  for(let t=0;t<index.count;t+=3){
   const a=index.getX(t),b=index.getX(t+1),c=index.getX(t+2);
   const m0=normal(source,a,b,c),m1=normal(candidate,a,b,c);
   const area0=Math.hypot(...m0),area1=Math.hypot(...m1);
   if(area0<1e-10)continue;
   const cos=(m0[0]*m1[0]+m0[1]*m1[1]+m0[2]*m1[2])/
    Math.max(1e-12,area0*area1);
   if(area1<area0*.24||cos<.38){unsafe=true;violations++;if(violations>5)break;}
  }
  unsafeCandidates+=violations;
  if(!unsafe){accepted=candidate;break;}
 }
 if(!accepted)return fail('triangle-foldover-prevented');
 for(let i=0;i<n;i++)p.setXYZ(i,
  accepted[i*3],accepted[i*3+1],accepted[i*3+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 const report={applied:true,version:99,verticesAffected:moved,
  cheekVertices,alarVertices,blend,
  maxNoseDown:maxNoseDown*blend,
  fairingIterations:4,unsafeCandidates,sourceDonorPreserved:true,
  sourceTriangleCount:index.count/3,joinedOralRimUntouched:true,
  frontNostrilRimLowered:true,malarsSmoothed:true};
 geometry.userData.v99SurfaceReport=report;
 return report;
}
