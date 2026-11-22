/**
 * v104: conservative recovery from the visibly lumpy v103 cheek pass.
 * Runs once AFTER the exact v102 face has been restored.
 * No cheek "filler", no overlapping Gaussian sculpt and no 5-pass
 * iterative smoothing. At most 0.24% of head depth per vertex.
 * The approved v100 nose and all original lip, eye and ear vertices
 * are protected by IMMUTABLE source-donor coordinates.
 */
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function normal(a,i,j,k){
 const I=i*3,J=j*3,K=k*3;
 const ux=a[J]-a[I],uy=a[J+1]-a[I+1],uz=a[J+2]-a[I+2],
  vx=a[K]-a[I],vy=a[K+1]-a[I+1],vz=a[K+2]-a[I+2];
 return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
}
export function v104CheekWeight({xn=0,yn=0,zn=0,bodyType='normal'}={}){
 const ax=Math.abs(xn);
 if(bodyType!=='normal'||ax<=.32||ax>=.78||
    yn<=.435||yn>=.650||zn<=.55)return 0;
 return smooth(.32,.43,ax)*(1-smooth(.67,.78,ax))*
  smooth(.435,.495,yn)*(1-smooth(.585,.650,yn))*
  smooth(.55,.79,zn);
}
export function smoothV104Cheek(geometry,{
 gender='female',bodyType='normal',ageWrinkles=0,
 donorPositions=null,donorCenterX=null,donorHalfWidth=null
}={}){
 const fail=(reason)=>({applied:false,reason,rolledBackTo:'v102'});
 if(gender!=='female'||bodyType!=='normal'||ageWrinkles>=.47)
  return fail('not-young-female-normal-build');
 const p=geometry?.getAttribute?.('position'),ix=geometry?.getIndex?.();
 if(!p||!ix||p.count<100||ix.count<200)return fail('indexed-donor-required');
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,dx=b.max.x-b.min.x,
  dy=b.max.y-b.min.y,dz=b.max.z-b.min.z,cx=(b.max.x+b.min.x)*.5;
 if(Math.min(dx,dy,dz)<=1e-8)return fail('invalid-donor-bounds');
 const source=p.array.slice(),n=p.count,weight=new Float32Array(n);
 const neighbors=Array.from({length:n},()=>new Map());
 const noseLocked=new Uint8Array(n);
 let maskVertices=0;
 for(let i=0;i<n;i++){
  const I=3*i,x=source[I],y=source[I+1],z=source[I+2];
  const origX=donorPositions?.[I]??x;
  // Guarantee all nose and mouth-side GLB vertices are bitwise unchanged.
  const origAx=Math.abs((origX-(donorCenterX??cx))/
   (donorHalfWidth??dx*.5));
  if(origAx<=.345){noseLocked[i]=1;continue;}
  weight[i]=v104CheekWeight({xn:(x-cx)/(dx*.5),
   yn:(y-b.min.y)/dy,zn:(z-b.min.z)/dz,bodyType});
  if(weight[i]>.025)maskVertices++;
 }
 if(maskVertices<10)return fail('no-cheek-surface');
 const triangles=[],edgeCap=dx*.085;
 for(let t=0;t<ix.count;t+=3){
  const a=ix.getX(t),b=ix.getX(t+1),c=ix.getX(t+2);
  if(a>=n||b>=n||c>=n)return fail('bad-index');
  const v=normal(source,a,b,c),area=Math.hypot(...v);
  if(area>1e-11)triangles.push({a,b,c,v,area});
  for(const [u,w] of [[a,b],[b,c],[c,a]]){
   const U=u*3,W=w*3;
   const len=Math.hypot(source[U]-source[W],
    source[U+1]-source[W+1],source[U+2]-source[W+2]);
   if(len>1e-8&&len<edgeCap){
    neighbors[u].set(w,len);neighbors[w].set(u,len);
   }
  }
 }
 // A SINGLE low-amplitude ring smoothing step. No volume inflation.
 const maxPerVertex=dz*.0024;
 const delta=new Float32Array(n);
 for(let i=0;i<n;i++){
  if(noseLocked[i]||weight[i]<.025||neighbors[i].size<3)continue;
  const z=source[i*3+2];let sum=0,total=0;
  for(const [j,dist] of neighbors[i]){
   if(noseLocked[j]||weight[j]<.015)continue;
   const other=source[j*3+2];
   // Respect actual folds, triangles and disconnected edges.
   const bilateral=Math.exp(-.5*((other-z)/(dz*.070))**2);
   const w=bilateral/(dist+dx*.005);
   sum+=other*w;total+=w;
  }
  if(total>0)
   delta[i]=clamp((sum/total-z)*weight[i]*.30,
    -maxPerVertex,maxPerVertex);
 }
 const factor=new Float32Array(n).fill(1);
 let candidate=null,guarded=new Set(),passes=0;
 for(let turn=0;turn<22;turn++){
  const next=source.slice();
  for(let i=0;i<n;i++)if(delta[i])
   next[3*i+2]=source[3*i+2]+delta[i]*factor[i];
  const unsafe=new Set();
  for(const {a,b,c,v,area} of triangles){
   if(!delta[a]&&!delta[b]&&!delta[c])continue;
   const nv=normal(next,a,b,c),na=Math.hypot(...nv);
   const cos=na>1e-14?
    (v[0]*nv[0]+v[1]*nv[1]+v[2]*nv[2])/(area*na):0;
   if(na<area*.55||cos<.78)
    for(const id of [a,b,c])if(delta[id]&&factor[id]>0)unsafe.add(id);
  }
  if(!unsafe.size){candidate=next;passes=turn;break;}
  for(const id of unsafe){
   guarded.add(id);
   factor[id]=turn>=17?0:factor[id]*.5;
  }
 }
 if(!candidate)return fail('triangle-safety-rejected');
 let changed=0,noseError=0,maxChange=0,positive=0,negative=0;
 for(let i=0;i<n;i++){
  const change=candidate[3*i+2]-source[3*i+2];
  if(Math.abs(change)>1e-9)changed++;
  if(change>0)positive++;if(change<0)negative++;
  if(noseLocked[i])noseError=Math.max(noseError,Math.abs(change));
  maxChange=Math.max(maxChange,Math.abs(change));
 }
 if(noseError!==0)return fail('nose-lock-violated');
 if(maxChange>maxPerVertex*1.01)return fail('max-displacement-exceeded');
 if(changed<5)return fail('micro-fairing-not-needed');
 // Atomic commit only after all safety checks; original GLB stays untouched.
 for(let i=0;i<n;i++)if(candidate[3*i+2]!==source[3*i+2])
  p.setZ(i,candidate[3*i+2]);
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const result={applied:true,version:104,base:'v102',
  noFiller:true,changedVertices:changed,maskVertices,
  maxVertexDisplacement:maxChange,maxAllowed:maxPerVertex,
  noseVertexDelta:noseError,positive,negative,
  triangleGuardedVertices:guarded.size,passes,
  originalIndicesPreserved:true};
 geometry.userData.v104CheekFairing=result;
 return result;
}
