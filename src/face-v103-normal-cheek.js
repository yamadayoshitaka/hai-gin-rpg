/**
 * v103 real 3D correction, calibrated to the supplied front/45-degree and
 * side references. v102 has already lowered the high cheek crest, but the
 * normal-build young woman still has a dark concave band beneath it.
 *
 * On the ACTUAL cloned indexed GLB, fill ONLY this broad lower midface band
 * and smooth Z along the donor's own connected triangles. Do not touch the
 * already-approved v100 nasal tip/alar rim, lips, eyes, gender or thin builds.
 * No extra 2D planes, mesh shells, makeup overlays or detached primitives.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const bell=(v,c,w)=>Math.exp(-.5*((v-c)/w)**2);
const triangleNormal=(a,i,j,k)=>{
 const I=i*3,J=j*3,K=k*3;
 const ux=a[J]-a[I],uy=a[J+1]-a[I+1],uz=a[J+2]-a[I+2];
 const vx=a[K]-a[I],vy=a[K+1]-a[I+1],vz=a[K+2]-a[I+2];
 return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
};

/** Relative z-lift in head-depth units. Flat continuity, never a new bump. */
export function v103NormalCheekField({xn=0,yn=0,zn=0,ageWrinkles=0,bodyType='normal'}={}){
 const ax=Math.abs(xn),youth=1-smooth(.13,.47,ageWrinkles);
 if(bodyType!=='normal'||youth<=0||ax<=.305||ax>=.83||
    yn<=.400||yn>=.661||zn<=.48)
  return {dz:0,mask:0,trough:0,crest:0};
 const front=smooth(.48,.78,zn),side=smooth(.305,.410,ax)*
  (1-smooth(.695,.83,ax));
 const vertical=smooth(.40,.463,yn)*(1-smooth(.585,.661,yn));
 const mask=front*side*vertical*youth;
 // A broad shallow pad, not a spherical cheekbone. Restore the actual
 // surface ABOVE the mouth but BELOW the zygomatic crest.
 const trough=bell(ax,.483,.239)*bell(yn,.491,.091)*mask;
 const crest=bell(ax,.49,.205)*bell(yn,.576,.050)*mask;
 const dz=.032*trough-.008*crest;
 return {dz,mask,trough,crest};
}
export function repairV103NormalCheek(geometry,{
 gender='female',ageWrinkles=0,bodyType='normal',
 donorPositions=null,donorCenterX=null,donorHalfWidth=null
}={}){
 const fail=reason=>({applied:false,reason});
 if(gender!=='female')return fail('male-unmodified');
 if(bodyType!=='normal')return fail('other-build-unmodified');
 if(ageWrinkles>=.47)return fail('mature-face-unmodified');
 const p=geometry?.getAttribute?.('position'),idx=geometry?.getIndex?.();
 if(!p||!idx||p.count<150||idx.count<240)return fail('indexed-face-required');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,dx=box.max.x-box.min.x,
  dy=box.max.y-box.min.y,dz=box.max.z-box.min.z;
 if(Math.min(dx,dy,dz)<1e-8)return fail('invalid-face-bounds');
 const cx=(box.max.x+box.min.x)*.5,original=p.array.slice(),n=p.count;
 const initial=original.slice(),mask=new Float32Array(n),
  linked=Array.from({length:n},()=>new Map());
 let troughVertices=0,crestVertices=0,lockedNoseVertices=0;
 for(let i=0;i<n;i++){
  const I=i*3,x=original[I],y=original[I+1],z=original[I+2];
  // The donor-coordinate lock is critical: an old morph can move a native
  // nose vertex into the apparent cheek zone; it must NEVER be sculpted.
  const donorX=donorPositions?.[I]??x;
  const donorAx=Math.abs((donorX-(donorCenterX??cx))/
   (donorHalfWidth??dx*.5));
  const locked=donorAx<=.305;
  const field=locked?{dz:0,mask:0,trough:0,crest:0}:
   v103NormalCheekField({
    xn:(x-cx)/(dx*.5),yn:(y-box.min.y)/dy,
    zn:(z-box.min.z)/dz,ageWrinkles,bodyType
   });
  initial[I+2]+=field.dz*dz;
  mask[i]=field.mask;
  if(field.trough>.12)troughVertices++;
  if(field.crest>.08)crestVertices++;
  if(locked)lockedNoseVertices++;
 }
 if(troughVertices<6||crestVertices<3)return fail('native-midface-not-found');
 const triangles=[],edgeCap=dx*.105;
 for(let t=0;t<idx.count;t+=3){
  const a=idx.getX(t),b=idx.getX(t+1),c=idx.getX(t+2);
  if(Math.max(a,b,c)>=n)return fail('triangle-index-out-of-bounds');
  const oldN=triangleNormal(original,a,b,c),area=Math.hypot(...oldN);
  if(area>1e-10)triangles.push({a,b,c,oldN,area});
  for(const [u,v] of [[a,b],[b,c],[c,a]]){
   if(u===v)continue;
   const U=u*3,V=v*3;
   const dist=Math.hypot(original[U]-original[V],
    original[U+1]-original[V+1],original[U+2]-original[V+2]);
   if(dist>1e-8&&dist<edgeCap){
    linked[u].set(v,dist);linked[v].set(u,dist);
   }
  }
 }
 // Five small bilateral Z-only passes remove the 'dark shelf' curvature,
 // retaining cheek width and low-frequency anatomy. Never blur across
 // boundary regions or unmatched triangles such as the mouth aperture.
 let current=initial;
 for(let pass=0;pass<5;pass++){
  const next=current.slice();
  for(let i=0;i<n;i++){
   if(mask[i]<.015||linked[i].size<3)continue;
   const z=current[i*3+2];let sum=0,weightSum=0;
   for(const [j,dist] of linked[i]){
    if(mask[j]<.008)continue;
    const other=current[j*3+2];
    const bilateral=Math.exp(-.5*((other-z)/(dz*.095))**2);
    const weight=bilateral/(dist+dx*.005);
    sum+=other*weight;weightSum+=weight;
   }
   if(weightSum>0)next[i*3+2]=z+.33*mask[i]*(sum/weightSum-z);
  }
  current=next;
 }
 const move=new Float32Array(n);
 for(let i=0;i<n;i++)move[i]=current[i*3+2]-original[i*3+2];
 const scale=new Float32Array(n).fill(1);
 let out=null,guardPasses=0,guarded=new Set();
 // Localized safety line search: protect native donor triangle winding and
 // area without cancelling every valid cheek vertex as older v99 did.
 for(let pass=0;pass<25;pass++){
  const candidate=original.slice();
  for(let i=0;i<n;i++)if(move[i])
   candidate[i*3+2]=original[i*3+2]+move[i]*scale[i];
  const unsafe=new Set();
  for(const {a,b,c,oldN,area} of triangles){
   if(!move[a]&&!move[b]&&!move[c])continue;
   const N=triangleNormal(candidate,a,b,c),A=Math.hypot(...N);
   const cosine=A>1e-12?
    (oldN[0]*N[0]+oldN[1]*N[1]+oldN[2]*N[2])/(area*A):0;
   if(A<area*.23||cosine<.37){
    for(const j of [a,b,c])if(move[j]&&scale[j]>0)unsafe.add(j);
   }
  }
  if(!unsafe.size){out=candidate;guardPasses=pass;break;}
  for(const i of unsafe){
   guarded.add(i);scale[i]=pass>=19?0:scale[i]*.5;
  }
 }
 if(!out)return fail('unsafe-real-midface-triangles');
 let changed=0,filled=0,recessed=0,nasalMax=0,maxLift=0;
 for(let i=0;i<n;i++){
  const displacement=out[i*3+2]-original[i*3+2];
  if(Math.abs(displacement)>1e-9)changed++;
  if(displacement>0&&mask[i]>.15){filled++;maxLift=Math.max(maxLift,displacement);}
  if(displacement<0&&mask[i]>.15)recessed++;
  const donorX=donorPositions?.[i*3]??original[i*3];
  if(Math.abs((donorX-(donorCenterX??cx))/
   (donorHalfWidth??dx*.5))<=.305)
   nasalMax=Math.max(nasalMax,Math.abs(displacement));
 }
 if(changed<12||filled<6||!recessed)return fail('insufficient-cheek-continuity');
 if(nasalMax>0)return fail('nose-boundary-moved');
 for(let i=0;i<n;i++)if(out[i*3+2]!==original[i*3+2])
  p.setZ(i,out[i*3+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals();geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 const report={applied:true,version:103,normalBuildOnly:true,
  filledVertices:filled,crestRetreatedVertices:recessed,
  changedVertices:changed,troughVertices,crestVertices,maxLift,
  nasalMax,nasalLockedVertices:lockedNoseVertices,
  guardedVertices:guarded.size,guardPasses,
  keepsEyeMouthJawNose:true,ownsOriginalHeadTriangles:true};
 geometry.userData.v103NormalCheekRepair=report;
 return report;
}
