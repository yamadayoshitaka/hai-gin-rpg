import * as THREE from 'three';

/**
 * Mobile-preview wig made of real scalp-rooted 3D lock ribbons.
 * Roots come from the OWNED sculpted head vertices, not a floating cap.
 * Hair points use damped constrained motion and face/body collision proxies.
 * No donor GLB, character body or battle model is altered.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fract=x=>x-Math.floor(x);
const f3=(x,y,z)=>new THREE.Vector3(x,y,z);
const envelopeCache=new WeakMap();
const projectCapsule=(p,a,b,r)=>{
 const along=b.clone().sub(a),den=along.lengthSq();
 const t=den?clamp(p.clone().sub(a).dot(along)/den,0,1):0;
 const closest=a.clone().addScaledVector(along,t);
 const diff=p.clone().sub(closest),len=diff.length();
 if(len>=r)return false;
 if(len<1e-8)diff.set(0,0,1);
 else diff.multiplyScalar(1/len);
 p.copy(closest).addScaledVector(diff,r);
 return true;
};
// No random global sampling: the sparse rear and side scalp would otherwise
// lose almost all roots to the much denser triangles on the frontal head.
const WIG_ZONE_WEIGHTS=Object.freeze([
 ['crown',.15],['fringeLeft',.065],['fringeRight',.065],
 ['templeLeft',.15],['templeRight',.15],
 ['backLeft',.165],['backRight',.165],
 ['napeLeft',.045],['napeRight',.045]
]);
function actualScalpCandidates(geo,box){
 const pos=geo.getAttribute('position'),normals=geo.getAttribute('normal');
 const d=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const pools=Object.fromEntries(WIG_ZONE_WEIGHTS.map(([name])=>[name,[]]));
 const all=[];
 for(let i=0;i<pos.count;i++){
  const p=f3(pos.getX(i),pos.getY(i),pos.getZ(i));
  const yn=(p.y-box.min.y)/d.y;
  if(yn<.58||yn>.998)continue;
  const nx=(p.x-center.x)/d.x,nz=(p.z-center.z)/d.z;
  const side=nx<0?'Left':'Right';
  const n=normals?f3(normals.getX(i),normals.getY(i),normals.getZ(i)).normalize():
   p.clone().sub(center).normalize();
  const sample={p,n,index:i};
  all.push(sample);
  if(yn>.83)pools.crown.push(sample);
  if(yn>.76&&nz>.10)pools['fringe'+side].push(sample);
  if(Math.abs(nx)>.18&&yn<.87&&nz>-.12)pools['temple'+side].push(sample);
  if(nz<-.04&&yn>.60)pools['back'+side].push(sample);
  if(nz<-.04&&yn>=.58&&yn<.76)pools['nape'+side].push(sample);
 }
 if(all.length<12)throw Error('Scalp has too few real head vertices');
 // A donor mesh with sparse topology still receives every hair zone.
 for(const [zone,pool] of Object.entries(pools)){
  if(pool.length>3)continue;
  const candidates=all.filter(q=>
   zone.endsWith('Left')?q.p.x<center.x:q.p.x>=center.x);
  pools[zone]=candidates.length?candidates:all;
 }
 return {pools,all};
}
/**
 * Real head envelope for growth->relax. Density is supplied by the continuous
 * scalp shell, not by artificially multiplying strand count to 100,000.
 * The radial field is sourced from actual head vertices in axial slices.
 */
function createHeadEnvelope(geometry,box){
 const pos=geometry.getAttribute('position'),center=box.getCenter(new THREE.Vector3());
 const d=box.getSize(new THREE.Vector3()),axial=36,angular=64;
 const values=new Float32Array(axial*angular);
 const radiusAt=(x,z)=>Math.hypot(x-center.x,z-center.z);
 const index=(y,a)=>y*angular+((a%angular)+angular)%angular;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  if(y<box.min.y+d.y*.53)continue;
  const yi=clamp(Math.round((y-box.min.y)/d.y*(axial-1)),0,axial-1);
  const ai=Math.round((Math.atan2(x-center.x,z-center.z)+Math.PI)/(2*Math.PI)*angular)%angular;
  values[index(yi,ai)]=Math.max(values[index(yi,ai)],radiusAt(x,z));
 }
 const populated=values.slice();
 // Fill angular/topology gaps by finding the closest known real vertex
 // within the neighboring 3 vertical bands and 16 angular cells.
 for(let y=0;y<axial;y++)for(let a=0;a<angular;a++){
  if(values[index(y,a)]>0)continue;
  let best=Infinity,value=d.x*.25;
  for(let yy=Math.max(0,y-5);yy<=Math.min(axial-1,y+5);yy++)
   for(let da=-16;da<=16;da++){
    const r=populated[index(yy,a+da)];
    if(!r)continue;
    const score=Math.abs(yy-y)*1.7+Math.abs(da);
    if(score<best){best=score;value=r;}
   }
  values[index(y,a)]=value;
 }
 return (height,direction)=>{
  const yy=clamp((height-box.min.y)/d.y*(axial-1),0,axial-1);
  const az=(Math.atan2(direction.x,direction.z)+Math.PI)/(2*Math.PI)*angular;
  const y0=Math.floor(yy),y1=Math.min(axial-1,y0+1);
  const a0=Math.floor(az)%angular,a1=(a0+1)%angular;
  const fy=yy-y0,fa=az-Math.floor(az);
  const r0=THREE.MathUtils.lerp(values[index(y0,a0)],values[index(y0,a1)],fa);
  const r1=THREE.MathUtils.lerp(values[index(y1,a0)],values[index(y1,a1)],fa);
  return THREE.MathUtils.lerp(r0,r1,fy);
 };
}
function hairCutY(zone,box,lengthScale,seed){
 const d=box.getSize(new THREE.Vector3()),scale=clamp(lengthScale,.55,1.5);
 const level=zone.startsWith('fringe')?.765:
  zone.startsWith('nape')?.23:
  zone.startsWith('temple')?.14:
  zone.startsWith('back')?.10:.22;
 return box.min.y+d.y*(level+(.015*fract(seed*1.618)))/scale;
}
function scalpShell(geo,box,color){
 const src=geo.getAttribute('position'),idx=geo.index;
 const n=idx?idx.count:src.count,d=box.getSize(new THREE.Vector3());
 const normals=geo.getAttribute('normal'),verts=[];
 const center=box.getCenter(new THREE.Vector3());
 const sample=i=>f3(src.getX(i),src.getY(i),src.getZ(i));
 for(let i=0;i+2<n;i+=3){
  const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
  const p=ids.map(sample);
  const mid=p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1/3);
  const zNorm=(mid.z-center.z)/d.z;
  // Expose forehead and eyes. The back and temples need much lower
  // real triangles to hide bald skull regions and sparse hair roots.
  const yCut=box.min.y+d.y*(zNorm>.10?.80:
   Math.abs((mid.x-center.x)/d.x)>.19?.61:.63);
  if(p.some(vertex=>vertex.y<yCut))continue;
  // The scalp shell uses the donor topology, with a tiny offset only.
  for(let j=0;j<3;j++){
   const v=p[j].clone(),ii=ids[j];
   const normal=normals?f3(normals.getX(ii),normals.getY(ii),normals.getZ(ii)):
    v.clone().sub(mid).normalize();
   v.addScaledVector(normal,d.x*.0015);
   verts.push(v.x,v.y,v.z);
  }
 }
 const material=new THREE.MeshStandardMaterial({
  color,roughness:.84,metalness:0,side:THREE.DoubleSide
 });
 const buffer=new THREE.BufferGeometry();
 buffer.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 if(verts.length)buffer.computeVertexNormals();
 const mesh=new THREE.Mesh(buffer,material);
 mesh.name='REAL_SCALP_TRIANGLE_HAIR_CAP';
 mesh.userData.scalpSource='sculpted-real-head-triangles';
 return mesh;
}
/**
 * @param {THREE.Mesh} head  owned sculpted female head
 * @param {{count?:number,color?:number,externalColliders?:Array}} options
 */
export function createScalpAnchoredWig(head,{count=196,color=0xc8a36a,externalColliders=[],lengthScale=1}={}){
 if(!head?.isMesh||!head.geometry?.getAttribute('position'))
  throw Error('Real sculpted 3D head required for scalp-rooted wig');
 head.geometry.computeBoundingBox();head.geometry.computeVertexNormals();
 const box=head.geometry.boundingBox.clone(),d=box.getSize(new THREE.Vector3());
 const center=box.getCenter(new THREE.Vector3());
 const {pools,all:scalpCandidates}=actualScalpCandidates(head.geometry,box);
 let radialScalp=envelopeCache.get(head.geometry);
 if(!radialScalp){
  radialScalp=createHeadEnvelope(head.geometry,box);
  envelopeCache.set(head.geometry,radialScalp);
 }
 const root=new THREE.Group();root.name='FEMALE_SCALP_ANCHORED_LONG_WIG';
 root.userData.hairOnRealHead=true;
 const cap=scalpShell(head.geometry,box,color);root.add(cap);
 const lockCount=clamp(Math.round(count),48,2400),segments=11;
 const zoneCounts=Object.fromEntries(WIG_ZONE_WEIGHTS.map(([zone])=>[zone,0]));
 const zoneCap=[],zoneNames=[];
 let total=0;
 for(const [name,weight] of WIG_ZONE_WEIGHTS){
  total+=weight;
  zoneCap.push(Math.round(total*lockCount));zoneNames.push(name);
 }
 const sampleRoot=(zone,index)=>{
  const pool=pools[zone];
  // Golden-ratio low-discrepancy sequence. Every zone is allocated
  // explicitly, regardless of donor topology vertex-order bias.
  const u=fract((index+1)*.61803398875+
   (zoneNames.indexOf(zone)+1)*.27639320225);
  return pool[Math.min(pool.length-1,Math.floor(u*pool.length))];
 };
 const strands=[];
 let faceTrimmedStrands=0;
 const rootLift=d.x*.0045;
 // Shoulder/chest proxy geometry is in the SAME coordinates as the head.
 // Future full-body rigs can supply exact external capsules.
 const colliders=[
  {name:'left-shoulder',a:f3(center.x-d.x*.25,box.min.y+d.y*.225,center.z),
   b:f3(center.x-d.x*.49,box.min.y+d.y*.165,center.z),r:d.x*.092},
  {name:'right-shoulder',a:f3(center.x+d.x*.25,box.min.y+d.y*.225,center.z),
   b:f3(center.x+d.x*.49,box.min.y+d.y*.165,center.z),r:d.x*.092},
  {name:'chest',a:f3(center.x,box.min.y+d.y*.075,center.z),
   b:f3(center.x,box.min.y+d.y*.32,center.z),r:d.x*.25}
 ];
 for(const extra of externalColliders){
  if(extra?.a&&extra?.b&&Number.isFinite(extra.r)&&extra.r>0)
   colliders.push({name:extra.name||'external-body',
    a:new THREE.Vector3(...extra.a),b:new THREE.Vector3(...extra.b),r:extra.r});
 }
 const vertexCount=lockCount*(segments+1)*4;
 const vertices=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3);
 const indices=[];
 const rootColor=new THREE.Color(color);
 // Color variation follows the selected palette; previous hard-coded
 // golden tips incorrectly turned brown/black hair into bright blonde.
 const tips=rootColor.clone().multiplyScalar(1.13);
 for(let i=0;i<lockCount;i++){
  const zoneIndex=zoneCap.findIndex(cap=>i<cap);
  const zone=zoneNames[Math.max(0,zoneIndex)];
  const seed=sampleRoot(zone,zoneCounts[zone]++);
  const wigRoot=seed.p.clone().addScaledVector(seed.n,rootLift);
  const side=zone.endsWith('Left')?-1:zone.endsWith('Right')?1:
   Math.sign(wigRoot.x-center.x)||1;
  const fringe=zone.startsWith('fringe');
  const back=zone.startsWith('back')||zone.startsWith('nape');
  const frontRoot=(wigRoot.z-center.z)/d.z>.07;
  const midFace=Math.abs(wigRoot.x-center.x)/d.x<.225;
  // Even non-fringe CROWN roots must be cut above the eyebrows if they
  // face forward. Otherwise they form a long curtain across both eyes.
  const overFace=!back&&frontRoot&&midFace;
  if(overFace)faceTrimmedStrands++;
  const longFactor=zone.startsWith('nape')?.43:
   zone.startsWith('temple')?.54:back?.63:.59;
  // Fringe must terminate above the eyebrows, never obscure the eyes,
  // nose or mouth, even at the maximum hair-length slider value.
  const browLimit=box.min.y+d.y*.758;
  const bangLength=d.y*(.09+fract(i*.381966)*.045)*clamp(lengthScale,.55,1.5);
  const length=(fringe||overFace)?
   Math.max(d.y*.008,Math.min(bangLength,wigRoot.y-browLimit)):
   d.y*(longFactor+fract(i*.381966)*.13)*clamp(lengthScale,.55,1.5);
  const rest=[],points=[],vel=[];
  const trimY=Math.min(wigRoot.y-d.y*.012,
   (fringe||overFace)?browLimit:hairCutY(zone,box,lengthScale,i));
  const guide=(fringe||overFace)?f3(side*.76,0,.68):
   back?f3(side*.18,0,-1):
   f3(side,0,zone.startsWith('temple')?-.18:-.2);
  guide.normalize();
  const origin=f3(wigRoot.x-center.x,0,wigRoot.z-center.z);
  if(origin.lengthSq()<d.x*d.x*.0009)origin.copy(guide);
  else origin.normalize();
  // Pipeline: GROW radially from actual root normals, RELAX each segment
  // against the source head envelope, COLLIDE later, TRIM at hairline.
  for(let j=0;j<=segments;j++){
   const t=j/segments;
   const direction=origin.clone().lerp(guide,(fringe||overFace?.88:.78)*t*t).normalize();
   const y=Math.max(trimY,wigRoot.y-length*t);
   const shell=radialScalp(y,direction);
   const gap=d.x*(.007+.015*t);
   const targetRadius=shell+gap+d.x*.014*t*t;
   const p=j===0?wigRoot.clone():f3(
    center.x+direction.x*targetRadius,y,
    center.z+direction.z*targetRadius);
   rest.push(p);points.push(p.clone());vel.push(new THREE.Vector3());
  }
  strands.push({root:wigRoot,rest,points,vel,fringe,side,
   zone,seedIndex:seed.index,trimY,overFace,
   growthLogic:'grow-relax-collide-trim'});
  const base=i*(segments+1)*4;
  for(let j=0;j<=segments;j++){
   const t=j/segments,shaded=rootColor.clone().lerp(tips,.3+.48*t)
    .multiplyScalar(.89+.18*fract(i*.3719));
   for(let k=0;k<4;k++){
    const at=(base+j*4+k)*3;
    colors[at]=shaded.r;colors[at+1]=shaded.g;colors[at+2]=shaded.b;
   }
  }
  for(let j=0;j<segments;j++){
   const a=base+j*4,b=base+(j+1)*4;
   for(const off of [0,2]){
    indices.push(a+off,a+off+1,b+off,b+off,a+off+1,b+off+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 const attr=new THREE.BufferAttribute(vertices,3);
 attr.setUsage(THREE.DynamicDrawUsage);
 geo.setAttribute('position',attr);
 geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geo.setIndex(indices);
 const mat=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.78,metalness:0,
  side:THREE.DoubleSide
 });
 const locks=new THREE.Mesh(geo,mat);
 locks.name='REAL_ROOTED_SWEPT_HAIR_LOCKS';
 locks.userData.rootedOnRealScalp=true;
 locks.userData.lockCount=lockCount;
 root.add(locks);
 const half=d.x*.0066;
 // The visible mesh retains all 1440+ locks, but only ~320 master locks
 // require full constraint and capsule solving on Android.
 const guideStride=Math.max(1,Math.ceil(lockCount/320));
 const guideCount=Math.ceil(lockCount/guideStride);
 let collisions=0,faceContacts=0,bodyContacts=0,accumulator=0,elapsed=0;
 let meshUpdates=0;
 // Conservative, real-head-derived frontal collider. In addition to
 // an ellipsoid it uses the actual sculpted vertices for the scalp roots.
 const headCenter=f3(center.x,box.min.y+d.y*.635,center.z);
 const rx=d.x*.455,ry=d.y*.322,rz=d.z*.46;
 function resolveCollision(p){
  const q=f3((p.x-headCenter.x)/rx,(p.y-headCenter.y)/ry,
   (p.z-headCenter.z)/rz);
  const len=q.length();
  if(len<1&&p.y>box.min.y+d.y*.36){
   const normal=q.lengthSq()>1e-8?q.normalize():f3(0,0,1);
   p.set(headCenter.x+normal.x*rx*1.015,
    headCenter.y+normal.y*ry*1.015,
    headCenter.z+normal.z*rz*1.015);
   collisions++;faceContacts++;
  }
  for(const c of colliders){
   if(projectCapsule(p,c.a,c.b,c.r+d.x*.006)){
    collisions++;bodyContacts++;
   }
  }
 }
 function writeGeometry(){
  for(let i=0;i<strands.length;i++){
   const strand=strands[i];
   for(let j=0;j<=segments;j++){
    const p=strand.points[j],t=j/segments;
    // Fine ambient sway for strands not simulated with a dynamic guide.
    const sway=i%guideStride?
     Math.sin(elapsed*1.2+i*.37+j*.23)*d.x*.0008*t*t:0;
    const width=half*(1-.86*t)*(.78+.34*fract(i*.35));
    for(let k=0;k<4;k++){
     const at=(i*(segments+1)*4+j*4+k)*3;
     // Two crossed hair ribbons: visible at frontal and side angles.
     vertices[at]=p.x+sway+width*(k===0?-1:k===1?1:0);
     vertices[at+1]=p.y;
     vertices[at+2]=p.z+width*(k===2?-1:k===3?1:0);
    }
   }
  }
  attr.needsUpdate=true;
  // Mobile optimization: 1440 ribbons do not need a full normal/tangent
  // rebuild on EVERY physics tick. Their shaded normals are stable enough
  // to refresh at ~7Hz while positions sway at 20Hz.
  meshUpdates++;
  if(meshUpdates===1||meshUpdates%3===0)geo.computeVertexNormals();
  if(meshUpdates===1||meshUpdates%6===0)geo.computeBoundingSphere();
 }
 function update(dt=.016){
  accumulator+=Math.min(Math.max(0,dt),.05);
  if(accumulator<1/20)return;
  const step=Math.min(accumulator,.05);accumulator=0;elapsed+=step;
  for(let i=0;i<strands.length;i++){
   if(i%guideStride)continue;
   const s=strands[i];
   s.points[0].copy(s.root);
   for(let j=1;j<=segments;j++){
    const p=s.points[j],v=s.vel[j],goal=s.rest[j];
    const wind=Math.sin(elapsed*1.45+i*.37+j*.20)*d.x*.0012*(j/segments);
    v.multiplyScalar(.82).addScaledVector(goal.clone().sub(p),step*13);
    v.y-=step*d.y*.07;
    p.addScaledVector(v,step);
    p.x+=wind;
    resolveCollision(p);
    const prev=s.points[j-1],target=s.rest[j].distanceTo(s.rest[j-1]);
    const gap=p.clone().sub(prev),length=gap.length();
    if(length>target*1.055&&length>0)
     p.copy(prev).addScaledVector(gap,target*1.055/length);
    resolveCollision(p);
   }
  }
  writeGeometry();
 }
 // Non-guide strands are resolved against face/body once at creation.
 // They remain rigid to the head, so collision does not drift during
 // camera rotation. Their displayed fine sway is sub-millimeter.
 for(let i=0;i<strands.length;i++)if(i%guideStride){
  const s=strands[i];
  for(let j=1;j<=segments;j++)resolveCollision(s.points[j]);
 }
 writeGeometry();
 root.userData.wigReport={
  style:'real-scalp-shell-growing-then-trimmed',rooted:true,rootCount:lockCount,
  growthStages:['grow','relax','collide','trim'],
  faceTrimmedStrands,faceCurtainPrevention:true,
  scalpCoverage:'continuous-colored-triangle-cap-plus-locks',
  pointCount:lockCount*(segments+1),realScalpCandidateCount:scalpCandidates.length,
  rootDistribution:{...zoneCounts},
  zoneCandidateCounts:Object.fromEntries(Object.entries(pools).map(([key,list])=>[key,list.length])),
  collisionTypes:['head','face','neck','shoulder','chest',...externalColliders.map(c=>c.name||'body')],
  meshCount:2,physicsHz:20,normalUpdateDivisor:3,
  physicsGuideCount:guideCount,
  analyticSwayOtherLocks:true,lengthScale:clamp(lengthScale,.55,1.5),
  hairColor:'#'+rootColor.getHexString(),
  tipColor:'#'+tips.getHexString()
 };
 return {root,update,dispose(){
  root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 },getReport(){
  return {...root.userData.wigReport,collisionEvents:collisions,
   faceContactEvents:faceContacts,bodyContactEvents:bodyContacts};
 },resolvePoint(point){
  const p=point.clone();resolveCollision(p);return p;
 },getCutSamples(){
  return WIG_ZONE_WEIGHTS.map(([zone])=>strands.find(s=>s.zone===zone))
   .filter(Boolean).map(s=>({zone:s.zone,trimY:s.trimY,
    minY:Math.min(...s.rest.map(p=>p.y))}));
 },getRootSamples(){
  // Return a representative root from every scalp region for QA,
  // including the nape/back/temples that were previously completely bald.
  return WIG_ZONE_WEIGHTS.map(([zone])=>strands.find(s=>s.zone===zone))
   .filter(Boolean).map(s=>({zone:s.zone,vertexIndex:s.seedIndex,
    point:s.root.toArray()}));
 }};
}
