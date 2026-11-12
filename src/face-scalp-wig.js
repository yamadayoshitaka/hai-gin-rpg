import * as THREE from 'three';
import {createFastFaceSurfaceSampler} from './face-feature-meshes.js';
import {getWigStyle,DEFAULT_WIG_STYLE_ID} from './face-wig-styles.js';

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
 // Top/crown roots + real back-of-head roots: sum exactly 1.
 ['crown',.20],['fringeLeft',.04],['fringeRight',.04],
 ['templeLeft',.105],['templeRight',.105],
 ['backLeft',.20],['backRight',.20],
 ['napeLeft',.055],['napeRight',.055]
]);
function actualScalpCandidates(geo,box){
 const pos=geo.getAttribute('position'),normals=geo.getAttribute('normal');
 const d=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const pools=Object.fromEntries(WIG_ZONE_WEIGHTS.map(([name])=>[name,[]]));
 const all=[];
 for(let i=0;i<pos.count;i++){
  const p=f3(pos.getX(i),pos.getY(i),pos.getZ(i));
  const yn=(p.y-box.min.y)/d.y;
  if(yn<.54||yn>.998)continue;
  const nx=(p.x-center.x)/d.x,nz=(p.z-center.z)/d.z;
  const side=nx<0?'Left':'Right';
  const n=normals?f3(normals.getX(i),normals.getY(i),normals.getZ(i)).normalize():
   p.clone().sub(center).normalize();
  const sample={p,n,index:i};
  all.push(sample);
  // Extend crown follicle range across the upper back of the head.
  if(yn>.805&&nz<.26)pools.crown.push(sample);
  if(yn>.76&&nz>.10)pools['fringe'+side].push(sample);
  if(Math.abs(nx)>.18&&yn<.87&&nz>-.12)pools['temple'+side].push(sample);
  // Rear/nape roots must originate in the posterior hemisphere.
  // Never fill a sparse rear zone with front scalp vertices.
  if(nz<-.055&&yn>.61)pools['back'+side].push(sample);
  if(nz<-.055&&yn>=.54&&yn<.77)pools['nape'+side].push(sample);
 }
 if(all.length<12)throw Error('Scalp has too few real head vertices');
 // A donor mesh with sparse topology still receives every hair zone.
 for(const [zone,pool] of Object.entries(pools)){
  if(pool.length>3)continue;
  const onSide=q=>zone.endsWith('Left')?q.p.x<center.x:q.p.x>=center.x;
  const rear=zone.startsWith('back')||zone.startsWith('nape');
  const candidates=all.filter(q=>onSide(q)&&
   (!rear||q.p.z<center.z-d.z*.04));
  if(candidates.length) pools[zone]=candidates;
  else{
   // Keep explicit QA failure instead of silently growing "rear" locks
   // out of the forehead on unusual incoming face topologies.
   if(rear)throw Error('Missing posterior scalp: '+zone);
   const sameSide=all.filter(onSide);
   pools[zone]=sameSide.length?sameSide:all;
  }
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
 // The middle of the 3D head (excluding the protruding nose) is used as
 // a radial field origin. Front of face should NEVER inflate back hair.
 center.z=box.min.z+(box.max.z-box.min.z)*.43;
 const d=box.getSize(new THREE.Vector3()),axial=40,angular=80;
 const bins=Array.from({length:axial*angular},()=>[]);
 const index=(y,a)=>y*angular+((a%angular)+angular)%angular;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  if(y<box.min.y+d.y*.53)continue;
  const yi=clamp(Math.round((y-box.min.y)/d.y*(axial-1)),0,axial-1);
  const ai=Math.round((Math.atan2(x-center.x,z-center.z)+Math.PI)/
   (2*Math.PI)*angular)%angular;
  bins[index(yi,ai)].push(Math.hypot(x-center.x,z-center.z));
 }
 const data=new Float32Array(axial*angular);
 const valid=new Uint8Array(axial*angular);
 for(let k=0;k<bins.length;k++)if(bins[k].length){
  bins[k].sort((a,b)=>a-b);
  data[k]=bins[k][Math.floor((bins[k].length-1)*.72)];
  valid[k]=1;
 }
 // Sample a WEIGHTED ensemble of neighbors rather than the old nearest
 // single maximum-radius vertex (which caused a puffy spiked helmet).
 const completed=data.slice();
 for(let y=0;y<axial;y++)for(let a=0;a<angular;a++){
  const k=index(y,a);
  if(valid[k])continue;
  let sum=0,weight=0;
  for(let yy=Math.max(0,y-6);yy<=Math.min(axial-1,y+6);yy++)
   for(let da=-12;da<=12;da++){
    const other=index(yy,a+da);if(!valid[other])continue;
    const dist=Math.hypot((yy-y)*1.5,da);
    const w=1/(.75+dist*dist);
    sum+=data[other]*w;weight+=w;
   }
  completed[k]=weight?sum/weight:d.x*.30;
 }
 // Filter vertical/azimuth discontinuities while preserving the original
 // head silhouette. The resulting field is smooth under adjacent locks.
 let smooth=completed;
 for(let pass=0;pass<3;pass++){
  const next=smooth.slice();
  for(let y=0;y<axial;y++)for(let a=0;a<angular;a++){
   const k=index(y,a),mean=(
    smooth[index(y,a-1)]+smooth[index(y,a+1)]+
    smooth[index(Math.max(0,y-1),a)]+
    smooth[index(Math.min(axial-1,y+1),a)])/4;
   next[k]=smooth[k]*.54+mean*.46;
  }
  smooth=next;
 }
 const radius=(height,direction)=>{
  // Below the nape there is no scalp geometry. Preserve the hair's
  // radius at the last valid rear-head band; using empty low bands would
  // collapse long strands inward into a narrow vertical spike.
  const neckSafeHeight=Math.max(height,box.min.y+d.y*.625);
  const yy=clamp((neckSafeHeight-box.min.y)/d.y*(axial-1),0,axial-1);
  const az=(Math.atan2(direction.x,direction.z)+Math.PI)/(2*Math.PI)*angular;
  const y0=Math.floor(yy),y1=Math.min(axial-1,y0+1);
  const a0=Math.floor(az)%angular,a1=(a0+1)%angular;
  const fy=yy-y0,fa=az-Math.floor(az);
  const r0=THREE.MathUtils.lerp(smooth[index(y0,a0)],smooth[index(y0,a1)],fa);
  const r1=THREE.MathUtils.lerp(smooth[index(y1,a0)],smooth[index(y1,a1)],fa);
  return THREE.MathUtils.lerp(r0,r1,fy);
 };
 return {radius,radialCenter:center,angularCells:angular,axialCells:axial};
}
function hairCutY(zone,box,lengthScale,seed,normalizedX=0){
 const d=box.getSize(new THREE.Vector3()),scale=clamp(lengthScale,.55,1.5);
 // A salon U-shaped long layer: center-back hangs longest, sides end a
 // little higher; subtle point-cut variation instead of rigid saw teeth.
 const level=zone.startsWith('fringe')?.77:
  zone.startsWith('nape')?.075:
  zone.startsWith('temple')?.16:
  zone.startsWith('back')?.085:.16;
 const rear=zone.startsWith('back')||zone.startsWith('nape');
 const uCut=rear?.050*Math.pow(clamp(normalizedX,0,1),1.4):0;
 const scatter=.006*fract(seed*.75487766)+
  .007*Math.sin(seed*2.39996323);
 return box.min.y+d.y*(level+uCut+scatter)/scale;
}
function scalpShell(geo,box,color){
 const src=geo.getAttribute('position'),idx=geo.index;
 const n=idx?idx.count:src.count,d=box.getSize(new THREE.Vector3());
 const normals=geo.getAttribute('normal'),verts=[],smoothNormals=[];
 const center=box.getCenter(new THREE.Vector3());
 const sample=i=>f3(src.getX(i),src.getY(i),src.getZ(i));
 for(let i=0;i+2<n;i+=3){
  const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
  const p=ids.map(sample);
  const mid=p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1/3);
  const zNorm=(mid.z-center.z)/d.z;
  // Expose forehead and eyes. The back and temples need much lower
  // real triangles to hide bald skull regions and sparse hair roots.
  // Hair-colored cap covers actual skull triangles right down to
  // the rear nape; no floating rectangle across the rear neck.
  const yCut=box.min.y+d.y*(zNorm>.10?.795:
   zNorm<-.035?.535:
   Math.abs((mid.x-center.x)/d.x)>.19?.565:.605);
  if(p.some(vertex=>vertex.y<yCut))continue;
  // The scalp shell uses the donor topology, with a tiny offset only.
  for(let j=0;j<3;j++){
   const v=p[j].clone(),ii=ids[j];
   const normal=normals?f3(normals.getX(ii),normals.getY(ii),normals.getZ(ii)):
    v.clone().sub(mid).normalize();
   v.addScaledVector(normal,d.x*.0015);
   verts.push(v.x,v.y,v.z);
   // Preserve smooth source-head normals; nonindexed compute would make a flat helmet.
   smoothNormals.push(normal.x,normal.y,normal.z);
  }
 }
 // 52 independent tapered underlocks: rooted on actual posterior head
 // vertices, rather than a rectangular curtain hanging across the neck.
 const rearCandidates=[];
 for(let i=0;i<src.count;i++){
  const x=src.getX(i),y=src.getY(i),z=src.getZ(i);
  if(Math.abs(x-center.x)<d.x*.325 &&
     y>box.min.y+d.y*.65&&y<box.min.y+d.y*.94&&
     z<center.z-d.z*.035)rearCandidates.push(f3(x,y,z));
 }
 // Overlap fine rear underlocks, rather than 52 coarse strips.
 const undercoatStrips=rearCandidates.length?88:0;
 const stripSegments=12,stripWidths=[],tipHeights=[];
 for(let k=0;k<undercoatStrips;k++){
  const u=(k+.5)/undercoatStrips,side=u<.5?-1:1;
  const idealX=center.x+(2*u-1)*d.x*.267;
  const preferredY=box.min.y+d.y*(.805+.025*Math.sin(k*2.39996323));
  let scalpRoot=null,best=Infinity;
  for(const v of rearCandidates){
   const score=Math.abs(v.x-idealX)/d.x+
    Math.abs(v.y-preferredY)/d.y*.72;
   if(score<best){best=score;scalpRoot=v;}
  }
  const tipY=box.min.y+d.y*(.095+
   .064*Math.pow(Math.abs(2*u-1),1.3)+
   .012*Math.sin(k*2.39996323)+
   .009*fract(k*.61803398875));
  const width=d.x*(.0083+.0012*fract(k*.75487766));
  const targetX=idealX+side*d.x*.008;
  const targetZ=Math.min(scalpRoot.z-d.z*.018,
   center.z-d.z*(.14+.035*(1-Math.abs(2*u-1))));
  stripWidths.push(width*2);tipHeights.push(tipY);
  const vtx=(t,edge)=>{
   const eased=t*t*(3-2*t);
   const x=THREE.MathUtils.lerp(scalpRoot.x,targetX,eased)+
    Math.sin(k*.85+t*3)*d.x*.00026*t;
   const y=THREE.MathUtils.lerp(scalpRoot.y,tipY,t);
   const z=THREE.MathUtils.lerp(scalpRoot.z-d.z*.003,targetZ,eased)+
    d.z*.0017*Math.sin(Math.PI*t);
   const taper=1-.72*Math.pow(t,8);
   return f3(x+edge*width*taper,y,z+
    Math.abs(edge)*d.z*.0012);
  };
  for(let j=0;j<stripSegments;j++){
   const t0=j/stripSegments,t1=(j+1)/stripSegments;
   const p0=vtx(t0,-1),p1=vtx(t0,1);
   const q0=vtx(t1,-1),q1=vtx(t1,1);
   for(const p of [p0,q0,p1,p1,q0,q1]){
    verts.push(p.x,p.y,p.z);
    smoothNormals.push(0,0,-1);
   }
  }
 }
 const material=new THREE.MeshStandardMaterial({
  color,roughness:.84,metalness:0,side:THREE.DoubleSide
 });
 const buffer=new THREE.BufferGeometry();
 buffer.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 if(smoothNormals.length)buffer.setAttribute('normal',
  new THREE.Float32BufferAttribute(smoothNormals,3));
 const mesh=new THREE.Mesh(buffer,material);
 mesh.name='REAL_SCALP_TRIANGLE_HAIR_CAP';
 mesh.userData.scalpSource='sculpted-real-head-triangles';
 mesh.userData.rearUndercoatAnchoredToRealScalp=rearCandidates.length>0;
 mesh.userData.rearUndercoatTriangleCount=undercoatStrips*stripSegments*2;
 mesh.userData.rearUndercoatStripCount=undercoatStrips;
 mesh.userData.rearUndercoatMaxStripWidth=stripWidths.length?Math.max(...stripWidths):0;
 mesh.userData.rearUndercoatTipHeightRange=tipHeights.length?
  Math.max(...tipHeights)-Math.min(...tipHeights):0;
 mesh.userData.rearUndercoatStyle='overlapping-real-scalp-rooted-tapered-ribbons';
 return mesh;
}
/**
 * @param {THREE.Mesh} head  owned sculpted female head
 * @param {{count?:number,color?:number,externalColliders?:Array}} options
 */
export function createScalpAnchoredWig(head,{count=196,color=0xc8a36a,externalColliders=[],bodyCollisionResolver=null,lengthScale=1,styleId=DEFAULT_WIG_STYLE_ID}={}){
 const style=getWigStyle(styleId);
 if(!head?.isMesh||!head.geometry?.getAttribute('position'))
  throw Error('Real sculpted 3D head required for scalp-rooted wig');
 head.geometry.computeBoundingBox();head.geometry.computeVertexNormals();
 const box=head.geometry.boundingBox.clone(),d=box.getSize(new THREE.Vector3());
 const center=box.getCenter(new THREE.Vector3());
 const {pools,all:scalpCandidates}=actualScalpCandidates(head.geometry,box);
 const surfaceSampler=createFastFaceSurfaceSampler(head.geometry);
 // Crown whorl uses an ACTUAL real-head scalp vertex, not a free cap.
 const whorlTarget=f3(center.x+style.whorl.x*d.x,
  box.min.y+style.whorl.y*d.y,center.z+style.whorl.z*d.z);
 const whorlCandidate=scalpCandidates.filter(p=>p.p.y>box.min.y+d.y*.84)
  .sort((a,b)=>a.p.distanceToSquared(whorlTarget)-b.p.distanceToSquared(whorlTarget))[0];
 const whorl=whorlCandidate?.p.clone()||whorlTarget;
 let radialScalp=envelopeCache.get(head.geometry);
 if(!radialScalp){
  radialScalp=createHeadEnvelope(head.geometry,box);
  envelopeCache.set(head.geometry,radialScalp);
 }
 const root=new THREE.Group();root.name='FEMALE_SCALP_ANCHORED_LONG_WIG';
 root.userData.hairOnRealHead=true;
 root.userData.assetType='independent-wig';
 root.userData.hairStyleId=style.id;
 root.userData.hairStyleName=style.label;
 root.userData.part=style.part;
 root.userData.whorlPosition=whorl.toArray();
 const cap=scalpShell(head.geometry,box,color);root.add(cap);
 const lockCount=clamp(Math.round(count),48,2400),segments=11;
 const zoneCounts=Object.fromEntries(WIG_ZONE_WEIGHTS.map(([zone])=>[zone,0]));
 const zoneCap=[],zoneNames=[];
 let total=0;
 for(const [name,weight] of WIG_ZONE_WEIGHTS){
  total+=weight;
  zoneCap.push(Math.round(total*lockCount));zoneNames.push(name);
 }
 // Central posterior locks bridge the two halves at the nape: the
 // previous uniform root selection left a conspicuous exposed vertical
 // strip of neck, despite having plenty of hair on both outer sides.
 const backCenterPools=Object.fromEntries(WIG_ZONE_WEIGHTS
  .filter(([name])=>name.startsWith('back')||name.startsWith('nape'))
  .map(([name])=>{
   const near=pools[name].slice().sort((a,b)=>
    Math.abs(a.p.x-center.x)-Math.abs(b.p.x-center.x));
   return [name,near.slice(0,Math.max(4,Math.ceil(near.length*.28)))];
  }));
 const sampleRoot=(zone,index)=>{
  const rear=zone.startsWith('back')||zone.startsWith('nape');
  const pool=rear&&index%3===0?backCenterPools[zone]:pools[zone];
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
 const tips=rootColor.clone().multiplyScalar(1.055);
 for(let i=0;i<lockCount;i++){
  const zoneIndex=zoneCap.findIndex(cap=>i<cap);
  const zone=zoneNames[Math.max(0,zoneIndex)];
  const seed=sampleRoot(zone,zoneCounts[zone]++);
  const wigRoot=seed.p.clone().addScaledVector(seed.n,rootLift);
  const side=zone.endsWith('Left')?-1:zone.endsWith('Right')?1:
   Math.sign(wigRoot.x-center.x)||1;
  const partSide=Math.sign(wigRoot.x-whorl.x)||side;
  const partInfluence=(style.part==='center'&&
   (zone==='crown'||zone.startsWith('fringe')))?
   Math.max(0,1-Math.abs(wigRoot.x-whorl.x)/(d.x*.27)):0;
  const fringe=zone.startsWith('fringe');
  const back=zone.startsWith('back')||zone.startsWith('nape');
  const frontRoot=(wigRoot.z-center.z)/d.z>.07;
  const midFace=Math.abs(wigRoot.x-center.x)/d.x<.225;
  // Even non-fringe CROWN roots must be cut above the eyebrows if they
  // face forward. Otherwise they form a long curtain across both eyes.
  const overFace=!back&&frontRoot&&midFace;
  if(overFace)faceTrimmedStrands++;
  const longFactor=zone.startsWith('nape')?.68:
   zone.startsWith('temple')?.72:back?.80:.76;
  // Fringe must terminate above the eyebrows, never obscure the eyes,
  // nose or mouth, even at the maximum hair-length slider value.
  // Salon-cut contour: varying length, split-fringe silhouette and shorter
  // face frame with no harsh line across the forehead.
  const cutPhase=fract(i*.61803398875);
  const wave=Math.sin(i*2.39996323);
  // Side-swept diagonal bangs with irregular feathered ends, instead
  // of a flat horizontal 'home haircut' line above both eyebrows.
  const partSlope=(wigRoot.x-center.x)/d.x;
  const browLimit=box.min.y+d.y*
   (.747+.060*partSlope+.025*cutPhase+.012*wave);
  const bangLength=d.y*(.09+.034*cutPhase)*clamp(lengthScale,.55,1.5);
  const length=(fringe||overFace)?
   Math.max(d.y*.008,Math.min(bangLength,wigRoot.y-browLimit)):
   d.y*(longFactor+fract(i*.381966)*.13)*clamp(lengthScale,.55,1.5);
  const rest=[],points=[],vel=[];
  const lateral=2*Math.abs(wigRoot.x-center.x)/d.x;
  const trimY=Math.min(wigRoot.y-d.y*.012,
   (fringe||overFace)?browLimit:
    hairCutY(zone,box,lengthScale,i,lateral));
  // Salon-guided locks: the real scalp root stays fixed. After a brief
  // head-conforming section, each lock DROPS DOWN, not out in a radial
  // fan. This removes the puffy helmet and spiked cheek-side fan.
  const scalpCenter=radialScalp.radialCenter;
  const closeToFace=fringe||overFace;
  // Posterior layers drift gently toward the center of the back,
  // closing the exposed rear part without piling into a single spike.
  const targetX=(back?
   center.x+(wigRoot.x-center.x)*.68:
   wigRoot.x+side*d.x*(closeToFace?style.fringeSweep:.015))+
   partSide*d.x*style.partWidth*partInfluence;
  const targetZ=closeToFace?wigRoot.z+d.z*style.scalpClearance:
   // Go BEHIND the neck rather than being occluded by the rear bust skin.
   back?Math.min(wigRoot.z-d.z*.070,center.z-d.z*.19):
   zone.startsWith('temple')?wigRoot.z-d.z*.035:
   Math.min(wigRoot.z-d.z*.075,center.z-d.z*.035);
  // No high-frequency radial scattering that makes fine hair frizzy.
  const strandWave=(fract(i*.75487766)-.5)*d.x*.00032;
  // Gravity rest shape: initial down-velocity + gravitational acceleration.
  const g=style.gravityMps2*(d.y/2)*style.gravityScale;
  const fallTime=Math.sqrt(Math.max(1e-8,length/g));
  for(let j=0;j<=segments;j++){
   const t=j/segments,fall=t*t*(3-2*t);
   const drop=.5*length*t+.5*g*(t*fallTime)**2;
   const y=Math.max(trimY,wigRoot.y-drop);
   const curl=Math.sin(t*2.5+i*2.39996323)*d.x*.00024*t*t;
   const p=j===0?wigRoot.clone():f3(
    THREE.MathUtils.lerp(wigRoot.x,targetX,fall)+strandWave*t+curl,
    y,THREE.MathUtils.lerp(wigRoot.z,targetZ,fall)+curl*.35);
   if(j>0&&t<.65&&y>box.min.y+d.y*.60){
    const direction=f3(p.x-scalpCenter.x,0,p.z-scalpCenter.z);
    const radius=direction.length();
    if(radius>d.x*.008){
     const surfaceRadius=radialScalp.radius(y,direction);
     const gap=surfaceRadius+d.x*.0015-radius;
     if(gap>0)p.addScaledVector(direction.multiplyScalar(1/radius),
      Math.min(gap,d.x*.015));
    }
   }
   rest.push(p);points.push(p.clone());vel.push(new THREE.Vector3());
  }
  // Natural grooming relaxes tangents, preserving the real root and cut tip.
  for(let pass=0;pass<3;pass++){
   const filtered=rest.map(p=>p.clone());
   for(let j=1;j<segments;j++){
    filtered[j].copy(rest[j]).multiplyScalar(.60)
     .addScaledVector(rest[j-1],.20).addScaledVector(rest[j+1],.20);
    filtered[j].y=Math.max(trimY,filtered[j].y);
   }
   for(let j=1;j<segments;j++)rest[j].copy(filtered[j]);
  }
  for(let j=1;j<segments;j++)points[j].copy(rest[j]);
  strands.push({root:wigRoot,rest,points,vel,fringe,side,
   zone,seedIndex:seed.index,trimY,overFace,partSide,
   gravityRestShape:true,growthLogic:'grow-relax-collide-trim'});
  const base=i*(segments+1)*4;
  for(let j=0;j<=segments;j++){
   const t=j/segments,shaded=rootColor.clone().lerp(tips,.3+.48*t)
    .multiplyScalar(.96+.075*fract(i*.3719));
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
 const half=d.x*.0085;
 // The visible mesh retains all 1440+ locks, but only ~320 master locks
 // require full constraint and capsule solving on Android.
 const guideStride=Math.max(1,Math.ceil(lockCount/320));
 const guideCount=Math.ceil(lockCount/guideStride);
 let collisions=0,faceContacts=0,bodyContacts=0,realBodyContacts=0,accumulator=0,elapsed=0;
 let meshUpdates=0;
 // Real head-surface collision. The original giant ellipsoid forced
 // every strand out to an artificial spherical helmet around the ears.
 // Only points INSIDE the actual head silhouette are nudged outward.
 function resolveCollision(p){
  // Explicit contact with the ACTUAL front facial triangles. For hair
  // falling over the central eye/cheek region, first part it outwards.
  const yNorm=(p.y-box.min.y)/d.y;
  if(p.z>center.z+d.z*.025&&yNorm>.40&&yNorm<.85){
   const contactSide=Math.sign(p.x-whorl.x)||1;
   if(yNorm<.78&&Math.abs(p.x-center.x)<d.x*.15){
    p.x=center.x+contactSide*d.x*.15;
    faceContacts++;collisions++;
   }
   const faceSurface=surfaceSampler.query(p.x,p.y);
   if(faceSurface!==null&&p.z<faceSurface+d.x*style.faceClearance){
    p.z=faceSurface+d.x*style.faceClearance;
    faceContacts++;collisions++;
   }
  }
  if(p.y>box.min.y+d.y*.38){
   const origin=radialScalp.radialCenter;
   const direction=f3(p.x-origin.x,0,p.z-origin.z);
   const len=direction.length();
   if(len>d.x*.0001){
    const surfaceRadius=radialScalp.radius(p.y,direction);
    const gap=surfaceRadius+d.x*.001-len;
    if(gap>d.x*.002){
     p.addScaledVector(direction.multiplyScalar(1/len),
      Math.min(gap,d.x*.035));
     collisions++;faceContacts++;
    }
   }else{
    p.z+=d.x*.035;collisions++;faceContacts++;
   }
  }
  // In the complete heroine model, use the real imported body's
  // front/rear TRIANGLE depth before the fallback preview capsules.
  // The head-only studio intentionally keeps its old proxy behaviour.
  if(bodyCollisionResolver?.resolve?.(p)){
   collisions++;bodyContacts++;realBodyContacts++;
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
     Math.sin(elapsed*.8+i*.37+j*.15)*d.x*.00010*t*t:0;
    // Full thick clumps near scalp and mid-length; point-cut taper only
   // in the last 15% instead of uniformly thinning into wire-like ends.
   const tip=1-.90*Math.pow(t,8);
   const width=half*tip*(.90+.15*fract(i*.35))*
    (strand.zone==='crown'||strand.zone.startsWith('back')?1.14:1);
    // Groom BOTH ribbon planes along the actual hair-guide tangent.
    // The old world-X/world-Z crosses stuck through crown triangles like
    // needles; a tangent-plane ribbon lays on the rounded scalp instead.
    const previous=strand.points[Math.max(0,j-1)];
    const following=strand.points[Math.min(segments,j+1)];
    let tx=following.x-previous.x,ty=following.y-previous.y,
     tz=following.z-previous.z;
    const tangentLength=Math.hypot(tx,ty,tz)||1;
    tx/=tangentLength;ty/=tangentLength;tz/=tangentLength;
    const normalLen=Math.hypot(p.x-center.x,p.z-center.z)||1;
    const nx=(p.x-center.x)/normalLen,nz=(p.z-center.z)/normalLen;
    // hair-axis cross head-normal = local azimuthal width direction
    let wx=ty*nz,wy=tz*nx-tx*nz,wz=-ty*nx;
    const wideLength=Math.hypot(wx,wy,wz);
    if(wideLength<1e-6){wx=1;wy=0;wz=0;}
    else{wx/=wideLength;wy/=wideLength;wz/=wideLength;}
    // Second, narrower ribbon bends 35 degrees outward, never straight
    // through the skull and no orthogonal world-space 'wire' strands.
    let sx=wx*.82+nx*.40,sy=wy*.82,sz=wz*.82+nz*.40;
    const thinLength=Math.hypot(sx,sy,sz)||1;
    sx/=thinLength;sy/=thinLength;sz/=thinLength;
    for(let k=0;k<4;k++){
     const at=(i*(segments+1)*4+j*4+k)*3;
     const sign=k%2===0?-1:1,secondary=k>=2;
     const scale=sign*width*(secondary?.68:1);
     vertices[at]=p.x+sway+scale*(secondary?sx:wx);
     vertices[at+1]=p.y+scale*(secondary?sy:wy);
     vertices[at+2]=p.z+scale*(secondary?sz:wz);
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
    const wind=Math.sin(elapsed*.9+i*.37+j*.16)*d.x*.00016*(j/segments);
    v.multiplyScalar(.82).addScaledVector(goal.clone().sub(p),step*13);
    v.y-=step*d.y*.55*style.gravityScale;
    p.addScaledVector(v,step);
    p.x+=wind;
    resolveCollision(p);
    const prev=s.points[j-1],target=s.rest[j].distanceTo(s.rest[j-1]);
    const gap=p.clone().sub(prev),length=gap.length();
    if(length>target*1.055&&length>0)
     p.copy(prev).addScaledVector(gap,target*1.055/length);
    resolveCollision(p);
    if(p.y<s.trimY){p.y=s.trimY;v.y=Math.max(0,v.y);}
   }
  }
  writeGeometry();
 }
 // All strands, including the 320 dynamic guides, must begin outside
 // the real cheek, forehead and shoulder surfaces. Use resolved contacts
 // as the spring rest shape, rather than pulling hair through the face.
 for(const s of strands)for(let j=1;j<=segments;j++){
  resolveCollision(s.points[j]);
  s.points[j].y=Math.max(s.points[j].y,s.trimY);
  s.rest[j].copy(s.points[j]);
 }
 writeGeometry();
 root.userData.wigReport={
  style:'real-scalp-shell-growing-then-trimmed',rooted:true,rootCount:lockCount,
  hairstyleId:style.id,styleLabel:style.label,
  wigAssetType:'independent-wig',centerPart:style.part==='center',
  crownWhorl:whorl.toArray(),gravityMps2:style.gravityMps2,
  gravityRestShape:true,exactFaceSurfaceCollision:true,
  faceClearance:style.faceClearance,
  growthStages:['grow','relax','collide','trim'],
  faceTrimmedStrands,faceCurtainPrevention:true,
  smoothScalpNormals:true,verticalForeheadDrape:true,
  hairShape:'head-hugging-salon-layered-pointcut',
  scalpCrownCoverage:'extended-to-rear-top',
  rearScalpCoverage:'nape-and-occipital-head-triangles',
  groomingSmoothingPasses:3,frizzAmplitudeFactor:.10,
  strandRibbonOrientation:'guide-tangent-on-scalp',
  crownRootRatio:.20,posteriorRootRatio:.51,
  undercoatLockCount:cap.userData.rearUndercoatStripCount,
  hairStrandWidthFraction:.0085,
  downwardGuidedLocks:true,realScalpEnvelopeCollision:true,
  longSalonLayers:true,centerBackCoverage:true,uShapedRearCut:true,
  centralRearNeckOcclusionAvoided:true,diagonalFeatheredFringe:true,
  rearRootPolicy:'actual-posterior-scalp-only',
  scalpRadialProfile:'smoothed-72pct-multi-vertex-envelope',
  belowNapeDrape:'preserve-last-valid-scalp-radius',
  pointCutEnds:true,
  scalpCoverage:'continuous-colored-triangle-cap-plus-locks',
  realScalpPosteriorUndercoat:true,
  noRectangularRearHairSheet:true,
  pointCount:lockCount*(segments+1),realScalpCandidateCount:scalpCandidates.length,
  rootDistribution:{...zoneCounts},
  zoneCandidateCounts:Object.fromEntries(Object.entries(pools).map(([key,list])=>[key,list.length])),
  collisionTypes:['head','face','neck','shoulder','chest',...externalColliders.map(c=>c.name||'body')],
  usesRealBodyTriangleContacts:!!bodyCollisionResolver,
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
   faceContactEvents:faceContacts,bodyContactEvents:bodyContacts,
   realBodyContactEvents:realBodyContacts};
 },resolvePoint(point){
  const p=point.clone();resolveCollision(p);return p;
 },getCutSamples(){
  return WIG_ZONE_WEIGHTS.map(([zone])=>strands.find(s=>s.zone===zone))
   .filter(Boolean).map(s=>({zone:s.zone,trimY:s.trimY,
    minY:Math.min(...s.rest.map(p=>p.y))}));
 },getPartSamples(){
  return strands.filter(s=>s.zone==='crown'||s.zone.startsWith('fringe'))
   .slice(0,36).map(s=>({zone:s.zone,side:s.partSide,
    root:s.root.toArray(),tip:s.rest.at(-1).toArray(),
    gravityRestShape:s.gravityRestShape}));
 },getStyleSamples(){
  return WIG_ZONE_WEIGHTS.map(([zone])=>strands.filter(s=>s.zone===zone)
   .slice(0,12).map(s=>({zone,root:s.root.toArray(),
    firstStep:s.rest[1].toArray(),tip:s.rest.at(-1).toArray(),
    trimY:s.trimY,overFace:s.overFace}))).flat();
 },getCoverageSamples(){
  // Sample real crown/rear roots and root-to-tip curvature in QA.
  return WIG_ZONE_WEIGHTS.flatMap(([zone])=>strands
   .filter(s=>s.zone===zone).slice(0,32)
   .map(s=>({zone,root:s.root.toArray(),vertexIndex:s.seedIndex,
    guideDeviation:s.rest.slice(1,-1).reduce((max,p,j)=>{
     const mid=s.rest[j].clone().add(s.rest[j+2]).multiplyScalar(.5);
     return Math.max(max,mid.distanceTo(p));
    },0)})));
 },getRootSamples(){
  // Return a representative root from every scalp region for QA,
  // including the nape/back/temples that were previously completely bald.
  return WIG_ZONE_WEIGHTS.map(([zone])=>strands.find(s=>s.zone===zone))
   .filter(Boolean).map(s=>({zone:s.zone,vertexIndex:s.seedIndex,
    point:s.root.toArray()}));
 }};
}
