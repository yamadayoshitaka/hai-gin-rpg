import * as THREE from 'three';

/**
 * V119: actual linked-surface portrait contour repair, designed from the
 * user's v117 front screenshot and frontal/profile portrait art direction.
 * This is NOT a measurement of the unavailable Alina Ip third-party GLB.
 *
 * Operates on a fresh independent CC0 head clone, with the immutable source
 * vertices used as its volume baseline. Shared method, different masculine
 * and feminine coefficients. Keep eyes, lips, ears, scalp, back, UV and index.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
const bell=(v,c,w)=>Math.exp(-.5*((v-c)/w)**2);
const cross=(a,i,j,k)=>{
 const I=i*3,J=j*3,K=k*3,
  ax=a[J]-a[I],ay=a[J+1]-a[I+1],az=a[J+2]-a[I+2],
  bx=a[K]-a[I],by=a[K+1]-a[I+1],bz=a[K+2]-a[I+2];
 return [ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];
};
export function v119PortraitContourWeights({xn=0,yn=0,zn=0}={}){
 if(![xn,yn,zn].every(Number.isFinite))
  return {cheek:0,lower:0,nose:0,jaw:0,chin:0,front:0};
 const ax=Math.abs(xn),front=smooth(.44,.79,zn);
 const contour=1-smooth(.69,.82,ax);
 const lipGuard=1-.88*bell(ax,.13,.092)*bell(yn,.508,.047);
 const ocularGuard=1-.94*bell(ax,.34,.19)*bell(yn,.694,.055);
 const cheek=smooth(.195,.29,ax)*contour*
  bell(ax,.405,.205)*bell(yn,.505,.105)*
  (1-smooth(.59,.65,yn))*front*lipGuard*ocularGuard;
 const lower=smooth(.23,.32,ax)*contour*
  bell(ax,.455,.20)*bell(yn,.405,.072)*
  smooth(.27,.33,yn)*(1-smooth(.485,.55,yn))*front;
 const nose=bell(ax,.095,.10)*bell(yn,.570,.047)*
  smooth(.525,.553,yn)*(1-smooth(.69,.74,yn))*front;
 const jaw=bell(ax,.39,.21)*bell(yn,.335,.075)*
  smooth(.26,.315,yn)*(1-smooth(.445,.51,yn))*front*contour;
 const chin=bell(ax,.14,.16)*bell(yn,.305,.055)*
  (1-smooth(.39,.45,yn))*front;
 return {cheek,lower,nose,jaw,chin,front};
}
export function sculptV119PortraitContours(geometry,{
 gender,ageBand='twenties',donorPositions,donorBox=null
}={}){
 const fail=reason=>({applied:false,version:119,reason});
 if(!['female','male'].includes(gender))return fail('invalid-gender');
 if(ageBand!=='twenties')return fail('protect-non-reference-age');
 const p=geometry?.getAttribute?.('position'),idx=geometry?.getIndex?.();
 if(!p||!idx||!donorPositions||donorPositions.length!==p.count*3)
  return fail('original-real-indexed-glb-required');
 const box=donorBox||new THREE.Box3().setFromBufferAttribute(
  new THREE.Float32BufferAttribute(donorPositions,3));
 const d=box.getSize(new THREE.Vector3());
 if(Math.min(d.x,d.y,d.z)<.01)return fail('invalid-head-bounds');
 const cx=(box.min.x+box.max.x)/2;
 const baseline=p.array.slice(),candidate=baseline.slice();
 const female=gender==='female';
 let cheekCount=0,lowerCount=0,jawCount=0,noseCount=0;
 let maxCheekLift=0,maxDisplacement=0;
 for(let i=0;i<p.count;i++){
  const k=i*3,x=donorPositions[k],y=donorPositions[k+1],z=donorPositions[k+2];
  const xn=(x-cx)/(d.x*.5),yn=(y-box.min.y)/d.y,
   zn=(z-box.min.z)/d.z;
  if(yn<.26||yn>.785||Math.abs(xn)>.82||zn<.44)continue;
  // Preserve the entire native oral opening ring. Re-triangulating its
  // original seam after an unrelated contour pass produced instability.
  if(yn>.458&&yn<.544&&Math.abs(xn)<.325)continue;
  const w=v119PortraitContourWeights({xn,yn,zn});
  const cheekBlend=clamp(w.cheek*.88+w.lower*.73);
  let nx=baseline[k],ny=baseline[k+1],nz=baseline[k+2];
  if(cheekBlend>.005){
   // Reanchor to continuous donor surface rather than add to pre-existing
   // face passes; prevents the v117 malar shelf/gaunt hollow stacking.
   const referenceZ=z+d.z*((female?.096:.057)*w.cheek+
                              (female?.078:.045)*w.lower);
   const influence=clamp(cheekBlend*(female?.88:.70));
   nz+=(referenceZ-nz)*influence;
   nx+=(x-cx)*(female?.025:.012)*w.cheek;
   if(w.cheek>.08){cheekCount++;
    maxCheekLift=Math.max(maxCheekLift,nz-baseline[k+2]);}
   if(w.lower>.08)lowerCount++;
  }
  if(w.nose>.005){
   // Compact projection while respecting source nose/nostril topology.
   // Never touch orbital sockets, actual mouth seal or upper nasal root.
   const targetZ=z+d.z*(female?.005:.008);
   nz+=(targetZ-nz)*w.nose*(female?.54:.30);
   nx-=(x-cx)*(female?.040:.017)*w.nose;
   noseCount++;
  }
  if(w.jaw>.005||w.chin>.005){
   // Rounded cheek-to-jaw flow; male retains wider jaw and chin.
   nx+=(x-cx)*(female?.028:.011)*w.jaw;
   ny+=d.y*(female?.006:.0025)*w.chin;
   nz+=d.z*(female?.007:.003)*w.jaw;
   jawCount++;
  }
  // Bounded real mesh displacement, no new triangles or detached cards.
  nx=clamp(nx,baseline[k]-d.x*.019,baseline[k]+d.x*.019);
  ny=clamp(ny,baseline[k+1]-d.y*.009,baseline[k+1]+d.y*.009);
  nz=clamp(nz,baseline[k+2]-d.z*.065,baseline[k+2]+d.z*.065);
  candidate[k]=nx;candidate[k+1]=ny;candidate[k+2]=nz;
  maxDisplacement=Math.max(maxDisplacement,
   Math.hypot(nx-baseline[k],ny-baseline[k+1],nz-baseline[k+2]));
 }
 if(cheekCount<12||noseCount<3)return fail('insufficient-donor-face-regions');
 // Screened triangular safety: reject shrinking/inverted source faces.
 // Test every healthy indexed triangle against its own pre-sculpt normal.
 const triangles=[];
 for(let i=0;i<idx.count;i+=3){
  const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
  const n=cross(baseline,a,b,c),area=Math.hypot(...n);
  if(area>(d.x*1e-5)**2)triangles.push({a,b,c,n,area});
 }
 let accepted=null,acceptScale=0;
 for(const scale of [1,.75,.50,.25,.125,.0625]){
  const tryPoints=new Float32Array(baseline.length);
  for(let i=0;i<baseline.length;i++)
   tryPoints[i]=baseline[i]+(candidate[i]-baseline[i])*scale;
  let valid=true;
  for(const tri of triangles){
   const n=cross(tryPoints,tri.a,tri.b,tri.c),
    area=Math.hypot(...n);
   const dot=tri.n[0]*n[0]+tri.n[1]*n[1]+tri.n[2]*n[2];
   if(!Number.isFinite(area)||area<tri.area*.31||
    dot<tri.area*area*.28){valid=false;break;}
  }
  if(valid){accepted=tryPoints;acceptScale=scale;break;}
 }
 if(!accepted)return fail('triangle-foldover-guard-rejected');
 let changed=0;
 for(let i=0;i<p.count;i++){
  const k=i*3,dx=accepted[k]-baseline[k],
   dy=accepted[k+1]-baseline[k+1],dz=accepted[k+2]-baseline[k+2];
  if(Math.hypot(dx,dy,dz)>1e-7)changed++;
  p.setXYZ(i,accepted[k],accepted[k+1],accepted[k+2]);
 }
 if(changed<12)return fail('no-meaningful-surface-change');
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const report={applied:true,version:119,gender,ageBand,
  reference:'user-supplied-v117-screenshot-and-portrait-art-direction',
  externalAlinaGLBAnalyzed:false,donorGeometryPreserved:true,
  sourceVertices:p.count,newVertices:0,triangles:idx.count/3,
  uvAndIndicesPreserved:true,cheekCount,lowerCount,noseCount,jawCount,
  maxCheekLift,maxDisplacement,changedVertices:changed,acceptScale,
  foldedTriangles:0};
 geometry.userData.v119PortraitContour=report;
 return report;
}
