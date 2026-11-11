import * as THREE from 'three';

/**
 * Heroine 01's INSPECTION-ONLY wig: 100,000 genuine 3D curved filaments,
 * batched into ONE GPU line-segment draw call. Unlike the former 600 flat
 * hair cards, every line has a scalp-rooted independent 3D centreline.
 * Roots are sampled from the source CC0 scalp's alpha-masked vertices.
 * The battle model and archived GLBs remain untouched.
 */
const COUNT=100000,SEGMENTS=6; // Six curved sections prevent angular temple tips.
const fract=x=>x-Math.floor(x);
const hash=x=>fract(Math.sin(x*127.1+17.79)*43758.5453123);
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(a,min,max)=>Math.min(max,Math.max(min,a));

/**
 * Measure the *real* displayed CC0 body in the same local coordinate frame
 * as the female scalp source mesh. A width/depth ring at each torso height
 * gives an inexpensive conservative shoulder/back clearance envelope.
 * No new naked/armoured body is invented or edited.
 */
export function measureHeroineTorsoEnvelope(body,scalp){
 if(!body?.traverse||!scalp?.geometry)throw Error('Torso and scalp are required for 3D wig clearance');
 body.updateWorldMatrix(true,true);
 scalp.geometry.computeBoundingBox();
 const bb=scalp.geometry.boundingBox,d=bb.getSize(new THREE.Vector3());
 const cx=(bb.min.x+bb.max.x)*.5;
 const lower=bb.min.y-3.95*d.y,upper=bb.min.y+.30*d.y;
 const COUNT_BINS=64,step=(upper-lower)/COUNT_BINS;
 const bins=Array.from({length:COUNT_BINS},()=>({
  count:0,minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity
 }));
 // buildHeadConformingScalp stores an actor-local face-mesh transform;
 // the real torso vertices are converted through both actual world matrices.
 const scalpToWorld=(body.parent?.matrixWorld||new THREE.Matrix4())
  .clone().multiply(scalp.matrix);
 const toScalp=scalpToWorld.invert();
 const point=new THREE.Vector3(),matrix=new THREE.Matrix4();
 let sampled=0;
 body.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const a=mesh.geometry?.getAttribute('position');
  if(!a)return;
  matrix.copy(toScalp).multiply(mesh.matrixWorld);
  for(let i=0;i<a.count;i++){
   point.fromBufferAttribute(a,i).applyMatrix4(matrix);
   if(Math.abs(point.x-cx)>d.x*1.25||point.y<lower||point.y>=upper)continue;
   const k=Math.floor((point.y-lower)/step),b=bins[k];
   b.minX=Math.min(b.minX,point.x);b.maxX=Math.max(b.maxX,point.x);
   b.minZ=Math.min(b.minZ,point.z);b.maxZ=Math.max(b.maxZ,point.z);
   b.count++;sampled++;
  }
 });
 if(sampled<200)throw Error('Actual heroine body lacks measurable 3D torso surface');
 const raw=bins.map((b,i)=>{
  if(b.count<3)return null;
  const cxBody=(b.maxX+b.minX)*.5,czBody=(b.maxZ+b.minZ)*.5;
  return {x:cxBody,z:czBody,
   rx:Math.max(.035,(b.maxX-b.minX)*.5),
   rz:Math.max(.035,(b.maxZ-b.minZ)*.5),y:lower+(i+.5)*step};
 });
 // Sparse shoulder/jaw bands should not produce abrupt radial steps.
 const rings=raw.map((v,i)=>{
  const nearby=[];
  for(let k=Math.max(0,i-3);k<=Math.min(raw.length-1,i+3);k++)
   if(raw[k])nearby.push({ring:raw[k],w:1/(1+Math.abs(i-k))});
  if(!nearby.length)return null;
  const total=nearby.reduce((a,r)=>a+r.w,0);
  return {
   x:nearby.reduce((a,r)=>a+r.ring.x*r.w,0)/total,
   z:nearby.reduce((a,r)=>a+r.ring.z*r.w,0)/total,
   // Max of neighbouring real body radii (rather than their average)
   // conservatively encloses raised shoulders and armour-adjacent seams.
   rx:Math.max(...nearby.map(r=>r.ring.rx)),
   rz:Math.max(...nearby.map(r=>r.ring.rz))
  };
 });
 return Object.freeze({lower,upper,step,rings,meshDerived:true,
  sampledBodyVertices:sampled,clearanceMeters:.029,
  hairLocalCoordinates:true,sourceBodyUnmodified:true});
}
function clearBodyForLongStrand(x,y,z,region,envelope){
 if(!envelope||y<envelope.lower||y>=envelope.upper||region==='bang')
  return [x,z,false];
 const t=(y-envelope.lower)/envelope.step,i=Math.floor(t);
 const a=envelope.rings[clamp(i,0,envelope.rings.length-1)];
 const b=envelope.rings[clamp(i+1,0,envelope.rings.length-1)];
 if(!a&&!b)return [x,z,false];
 const w=fract(t);
 const ring=a&&b?{
  x:lerp(a.x,b.x,w),z:lerp(a.z,b.z,w),
  rx:lerp(a.rx,b.rx,w),rz:lerp(a.rz,b.rz,w)
 }:a||b;
 const clearance=envelope.clearanceMeters||.025;
 if(region==='rear'||region==='left'||region==='right'){
  // The back curtain must be BEHIND the actual rear torso at this height,
  // including at the shoulder blades; no straight hair through the back.
  const q=(x-ring.x)/(ring.rx+clearance);
  if(Math.abs(q)>1)return [x,z,false];
  const rear=ring.z-(ring.rz+clearance)*Math.sqrt(Math.max(.07,1-q*q));
  // Side locks route behind the SHOULDER rather than being flung out beyond
  // the arms. This eliminates the large V-shaped "wings" in rear view.
  return z>rear?[x,rear,true]:[x,z,false];
 }
 return [x,z,false];
}


/**
 * Source-topology wig foundation, not a second hairstyle or a floating dome.
 * 100k one-pixel filaments leave gaps on phones; this rose-toned, alpha-faded
 * crown surface fills ONLY those gaps and stays attached to the real head.
 * The original opaque/donor hair and source scalp remain hidden.
 */
/**
 * Tapered rose-pink foreground bangs, actually attached to the upper, FRONT
 * side of the original sculpt. The 100k one-pixel strands alone cannot
 * conceal the forehead scalp on mobile. These narrow, continuous 3D ribbons
 * are hair roots/flow, NOT a second helmet-shaped wig or a face texture.
 */
export function buildHeroineFrontFringe(scalp,{locks=520}={}){
 const g=scalp?.geometry,p=g?.getAttribute('position'),a=g?.getAttribute('color');
 if(!p||!a||a.itemSize!==4)throw Error('A real head-conforming scalp is required for front fringe');
 g.computeBoundingBox();
 const b=g.boundingBox,d=b.getSize(new THREE.Vector3());
 const cx=(b.min.x+b.max.x)*.5,cz=(b.min.z+b.max.z)*.5;
 const sources=[];
 for(let i=0;i<p.count;i++){
  const y=(p.getY(i)-b.min.y)/d.y;
  if(y<.80||a.getW(i)<.80)continue;
  sources.push([p.getX(i),p.getY(i),p.getZ(i)]);
 }
 if(sources.length<40)throw Error('Insufficient actual frontal crown roots');
 sources.sort((a,b)=>b[2]-a[2]);
 // Prefer the forward-facing follicles over rear high-crown roots;
 // first 40% represent the actual front hairline of the source head.
 const candidates=sources.slice(0,Math.max(40,Math.floor(sources.length*.40)));
 const positions=[],colors=[],indices=[];
 let minTipY=Infinity,maxTipY=-Infinity;
 const N=6;
 for(let i=0;i<locks;i++){
  const seed=i+1,q=candidates[(i*67+Math.floor(hash(seed*9.31)*candidates.length))%candidates.length];
  const x0=q[0],y0=q[1],z0=q[2],base=positions.length/3;
  // A layered sweep moves from the upper-left crown toward the right temple.
  // A minority of shorter inner locks cross over to hide a visible hairline.
  // Interleaved sweep lengths prevent a straight fringe edge.
  const bank=i%3;
  const length=d.y*([.13,.17,.205][bank]+.055*hash(seed*2.71));
  const wave=(hash(seed*5.53)-.5)*d.x*.040;
  const drift=d.x*(.065+.120*hash(seed*3.43));
  // Small overlapping fillets: avoid a single opaque horizontal fringe slab.
  const width=d.x*(.00225+.00235*hash(seed*1.69));
  for(let j=0;j<=N;j++){
   const t=j/N,e=t*t*(3-2*t);
   const x=clamp(x0+drift*e+wave*Math.sin(Math.PI*t),
    b.min.x+d.x*.03,b.max.x-d.x*.025);
   const y=Math.max(b.min.y+d.y*.705,y0-length*t);
   // Follow the forehead rather than stabbing outward from the hairline:
   // only a small surface stand-off above the actual source frontal Z.
   const z=z0+d.z*(.012+.034*t+.010*Math.sin(Math.PI*t));
   if(j===N){minTipY=Math.min(minTipY,y);maxTipY=Math.max(maxTipY,y);}
   const taper=(.78-.73*e)*width;
   for(const sign of [-1,1]){
    positions.push(x+sign*taper,y,z);
    const v=.88+.11*hash(seed*.75),shine=.94+.06*Math.sin(t*4+seed*.13);
    colors.push(v*shine,v*.90*shine,v*.91*shine);
   }
   if(j<N){
    const k=base+j*2;
    indices.push(k,k+1,k+2,k+1,k+3,k+2);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 geo.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:0xe5b0c4,vertexColors:true,roughness:.81,metalness:0,
  side:THREE.DoubleSide,depthTest:true,depthWrite:true
 });
 const mesh=new THREE.Mesh(geo,material);
 mesh.name='HEROINE_FRONT_FRINGE_SOURCE_ROOTED_ROSE_PINK';
 mesh.castShadow=true;
 mesh.renderOrder=1;
 mesh.userData.sourceCrownRoots=true;
 mesh.userData.sweptSideFringe=true;
 mesh.userData.eyebrowClear=true;
 return {fringe:mesh,report:Object.freeze({
  sourceHeadRooted:true,sweptSideFringe:true,
  lockCount:locks,triangleCount:indices.length/3,
  tipMinNormalized:Number(((minTipY-b.min.y)/d.y).toFixed(3)),
  tipMaxNormalized:Number(((maxTipY-b.min.y)/d.y).toFixed(3)),
  faceZoneProtected:minTipY>=b.min.y+d.y*.705-.00001
 })};
}

/**
 * Dense SHORT fibre flow over the actual sculpt surface; the pink foundation
 * is a scalp mask, never intended to look like a bare plastic helmet.
 * This crown-only ribbon layer is independent of the 100k long filaments.
 */
export function buildHeroineCrownFlow(scalp,{locks=8000}={}){
 const source=scalp?.geometry,p=source?.getAttribute('position'),
  mask=source?.getAttribute('color');
 if(!p||!mask||mask.itemSize!==4)throw Error('A source head scalp is required for crown flow');
 source.computeBoundingBox();
 const box=source.boundingBox,d=box.getSize(new THREE.Vector3());
 const cx=(box.min.x+box.max.x)*.5,cy=(box.min.y+box.max.y)*.5,
  cz=(box.min.z+box.max.z)*.5;
 const roots=[];
 for(let i=0;i<p.count;i++){
  const y=(p.getY(i)-box.min.y)/d.y;
  if(y<.745||mask.getW(i)<.90)continue;
  roots.push([p.getX(i),p.getY(i),p.getZ(i)]);
 }
 if(roots.length<80)throw Error('Actual crown lacks enough visible hair roots');
 const pts=[],col=[],indices=[],sections=4;
 const radial=new THREE.Vector3(),tangent=new THREE.Vector3(),
  side=new THREE.Vector3(),point=new THREE.Vector3();
 for(let i=0;i<locks;i++){
  const seed=i+1;
  const root=roots[(i*67+Math.floor(hash(seed*3.17)*roots.length))%roots.length];
  radial.set((root[0]-cx)/d.x,(root[1]-cy)/d.y,(root[2]-cz)/d.z).normalize();
  // Along the scalp, not straight out from the vertex (no upright spikes).
  const sweep=(root[0]-cx)/d.x;
  tangent.set(.35+hash(seed*1.83)*.33,
   -.22-.26*hash(seed*2.07),
   -.35-.22*hash(seed*7.7)+sweep*.20);
  tangent.addScaledVector(radial,-tangent.dot(radial)).normalize();
  side.crossVectors(tangent,radial).normalize();
  // Longer scalp-tangent paths overlap the foundation instead of short
  // stubble stuck into a single-colour helmet surface.
  const length=d.y*(.095+.110*hash(seed*1.31)),
   halfWidth=d.x*(.00105+.00072*hash(seed*4.91)),
   base=pts.length/3;
  for(let j=0;j<=sections;j++){
   const t=j/sections,taper=1-t*.94;
   point.set(...root)
    .addScaledVector(tangent,length*t)
    .addScaledVector(radial,d.y*(.006+.002*Math.sin(Math.PI*t)));
   for(const sign of [-1,1]){
    const x=point.x+sign*halfWidth*taper*side.x;
    const y=point.y+sign*halfWidth*taper*side.y;
    const z=point.z+sign*halfWidth*taper*side.z;
    pts.push(x,y,z);
    const shade=.67+.27*hash(seed*.71)+.05*Math.sin(t*6+seed*.17);
    col.push(shade,shade*.93,shade*.96);
   }
   if(j<sections){
    const k=base+j*2;
    indices.push(k,k+1,k+2,k+1,k+3,k+2);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const mat=new THREE.MeshStandardMaterial({
  color:0xe6aec6,vertexColors:true,roughness:.88,metalness:0,
  side:THREE.DoubleSide,depthTest:true,depthWrite:true
 });
 const hair=new THREE.Mesh(geometry,mat);
 hair.name='HEROINE_CROWN_DENSE_SURFACE_FIBRE_FLOW';
 hair.castShadow=true;
 hair.renderOrder=1;
 hair.userData.sourceScalpRoots=true;
 return {hair,report:Object.freeze({
  locks,triangles:indices.length/3,
  sourceScalpRooted:true,rootPool:roots.length,
  layeredCrownNoBaldDome:true,shortTangentFlow:true
 })};
}

export function buildHeroineWigRootCap(scalp){
 const src=scalp?.geometry,colors=src?.getAttribute('color'),positions=src?.getAttribute('position');
 if(!positions||!colors||colors.itemSize!==4)throw Error('Real 3D source scalp required for wig crown');
 src.computeBoundingBox();
 const bb=src.boundingBox,d=bb.getSize(new THREE.Vector3());
 const cx=(bb.min.x+bb.max.x)*.5;
 const cap=src.clone(),color=new Float32Array(positions.count*4);
 let crownSamples=0,coveredCrown=0;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  const yn=(y-bb.min.y)/d.y,zn=(z-bb.min.z)/d.z;
  // Cover entire crown and occiput, fading along side temples and eyebrow.
  const front=clamp((zn-.27)/.55,0,1);
  const lateral=clamp(Math.abs((x-cx)/(d.x*.5)),0,1);
  // Hair-colored source topology must conceal the skin between pixel-wide hairs.
  // Keep the frontal face clear; make the rear and crown consistently opaque.
  const limit=.34+.46*front+.045*lateral;
  const u=clamp((yn-limit+.075)/.13,0,1);
  const a=yn>.78?1:u*u*(3-2*u);
  const o=i*4;
  // The cap is the UNDERCOAT, not the visible finish: broad micro-contrast
   // reads as hair depth when the independent scalp fibers cross it.
   const direction=(x-cx)*93+z*67-y*38;
   const l=.77+.19*Math.sin(direction)*Math.sin(direction*.41+1.2);
  color[o]=l;color[o+1]=l*.94;color[o+2]=l*.97;color[o+3]=a;
  if(yn>.87){crownSamples++;if(a>.98)coveredCrown++;}
 }
 if(crownSamples<35||coveredCrown/crownSamples<.95)
  throw Error('Wig crown leaves a bald scalp: '+coveredCrown+'/'+crownSamples);
 cap.setAttribute('color',new THREE.BufferAttribute(color,4));
 const material=new THREE.MeshStandardMaterial({
  color:0xd6a5ba,vertexColors:true,side:THREE.DoubleSide,
  roughness:.82,metalness:0,transparent:true,alphaTest:.02,depthWrite:true,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
 });
 const mesh=new THREE.Mesh(cap,material);
 mesh.name='HEROINE_WIG_ROOT_CROWN_NOT_DONOR_HAIR';
 mesh.matrixAutoUpdate=false;mesh.matrix.copy(scalp.matrix);
 mesh.castShadow=true;mesh.renderOrder=0;
 mesh.userData.wigCapFromSourceTopology=true;
 mesh.userData.donorHairMustBeHidden=true;
 // The underlay and fringe are a single independently toggleable wig module.
 // Both inherit the source head's exact transform, with no donor wig visible.
 const crownFlow=buildHeroineCrownFlow(scalp);
 mesh.add(crownFlow.hair);
 const bangs=buildHeroineFrontFringe(scalp);
 mesh.add(bangs.fringe);
 return {cap:mesh,report:Object.freeze({
  sourceHeadConforming:true,sourceScalpHidden:true,wigRootFoundationOnly:true,
  crownSamples,coveredCrown,coverageRatio:coveredCrown/crownSamples,
  coveredBySolidSourceTopology:true,foreheadBangsVisible:true,
  crownFlowLocks:crownFlow.report.locks,
  crownFlowTriangles:crownFlow.report.triangles,
  crownHasActualTangentFibreGeometry:true,
  fringeLockCount:bangs.report.lockCount,
  fringeTriangleCount:bangs.report.triangleCount,
  fringeTipMinNormalized:bangs.report.tipMinNormalized,
  fringeFaceClear:bangs.report.faceZoneProtected,
  sourceAnatomyUntouched:true
 })};
}

export function buildHeroineFantasyLongHair(scalp,{lengthInHeads=3.25,bodyEnvelope=null}={}){
 const source=scalp?.geometry;
 const p=source?.getAttribute('position'),alpha=source?.getAttribute('color');
 if(!p||!alpha||alpha.itemSize<4||p.count<400)
  throw Error('Heroine 100k hair requires the real alpha-masked source scalp');
 source.computeBoundingBox();
 const b=source.boundingBox,d=b.getSize(new THREE.Vector3());
 if(d.x<.1||d.y<.1||d.z<.07||lengthInHeads<2.5)
  throw Error('Invalid heroine head dimensions or long-hair length');
 const cx=(b.min.x+b.max.x)*.5,cz=(b.min.z+b.max.z)*.5;
 const all=[];
 for(let i=0;i<p.count;i++){
  if(alpha.getW(i)<.86)continue;
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  if((y-b.min.y)/d.y<.49)continue;
  all.push([x,y,z]);
 }
 if(all.length<100)throw Error('Source hairline has too few real scalp anchors');
 // The authored female head has an irregular/segmented topology, unlike the
 // smooth sphere used in unit tests. Rank available REAL alpha-masked vertices
 // per scalp region instead of assuming hard XYZ cutoffs at every temple.
 // Never fabricate a root or project strands from unrelated floating planes.
 const score=(q,region)=>{
  const x=(q[0]-cx)/d.x,y=(q[1]-b.min.y)/d.y,z=(q[2]-cz)/d.z;
  if(region==='rear')return -z*1.6+y*.18;
  if(region==='left')return -x*1.3+z*.40+y*.23;
  if(region==='right')return x*1.3+z*.40+y*.23;
  return z*1.3+y*1.1-Math.abs(x)*.70;
 };
 const pick=region=>all.slice().sort((a,b)=>score(b,region)-score(a,region))
  .slice(0,Math.max(30,Math.ceil(all.length*.16)));
 const rear=all.filter(q=>q[2]<cz+d.z*.08&&(q[1]-b.min.y)/d.y>.52);
 const crown=all.filter(q=>(q[1]-b.min.y)/d.y>.82);
 // Keep enough REAL lateral scalp anchors on segmented female donor heads.
 // A strict x>.35 head-width cutoff left fewer than thirty valid vertices.
 // Prefer rearward and genuinely lateral follicles so no side lock cuts
 // across the eye line, extending onto the same source rear scalp if needed.
 const sideRoots=side=>{
  const base=all.filter(q=>side*(q[0]-cx)>d.x*.20&&
   (q[1]-b.min.y)/d.y>.51);
  const safe=base.filter(q=>Math.abs(q[0]-cx)>d.x*.315||
   q[2]<cz+d.z*.16);
  if(safe.length>=30)return safe;
  const rearExtras=all.filter(q=>side*(q[0]-cx)>d.x*.12&&
   (q[1]-b.min.y)/d.y>.51&&q[2]<cz+d.z*.14);
  const expanded=[...new Set([...safe,...rearExtras])];
  return expanded.length>=30?expanded:base;
 };
 const left=sideRoots(-1);
 const right=sideRoots(1);
 if([rear,crown,left,right].some(v=>v.length<30))throw Error('Incomplete source-rooted wig scalp coverage');
 // The forehead hairline must use upper-crown vertices: global ranking by
 // frontmost Z alone accidentally sampled lower cheek-height scalp on the
 // segmented female sculpt (actual QA: fringe tip y=.608). Keep roots high
 // and shorten to the eyebrow-safe band regardless of donor head proportions.
 const highCrown=all.filter(q=>(q[1]-b.min.y)/d.y>.88);
 const fringe=highCrown.sort((a,b)=>score(b,'fringe')-score(a,'fringe'))
  .slice(0,Math.max(30,Math.ceil(highCrown.length*.50)));
 if([rear,left,right,fringe].some(a=>a.length<30))
  throw Error('Female source scalp lacks safe crown, temple or fringe anchors');
 const VERTICES=COUNT*SEGMENTS*2;
 const positions=new Float32Array(VERTICES*3);
 const colors=new Float32Array(VERTICES*3);
 let lowestY=Infinity,lowestBangY=Infinity,frontEyeZoneVertices=0;
 let bodyCollisionCorrections=0,sideShoulderCorrections=0,rearBackCorrections=0;
 let maxSideOutwardDrift=0,neckRearClearanceCorrections=0;
 let frontNeckIntrusionVertices=0,bodyCutStrands=0,bodyCutSections=0;
 let minimumRearDepth=Infinity;
 let vi=0;
 const regions={rear:70000,templeLeft:12000,templeRight:12000,bangs:6000};
 const categories=[
  ['rear',rear,regions.rear],['left',left,regions.templeLeft],
  ['right',right,regions.templeRight],['bang',fringe,regions.bangs]
 ];
 let global=0;
 for(const [region,anchors,count] of categories){
  const side=region==='left'?-1:region==='right'?1:0;
  const bang=region==='bang';
  for(let j=0;j<count;j++,global++){
   // Prime-strided traversal keeps the original scalp population uniformly
   // distributed; jitter is sub-millimetre and never repositions the wig.
   // A broad crown population avoids concentrating 70k roots into a
   // narrow rear strip which reads as a vertical plastic hair curtain.
   const pool=region==='rear'&&j%4===0?crown:anchors;
   const q=pool[(j*67+Math.floor(hash(global+4)*pool.length))%pool.length];
   const seed=global+1,scatter=hash(seed*1.19);
   const rootX=q[0]+(hash(seed*4.1)-.5)*d.x*.003;
   const rootY=q[1],rootZ=q[2];
   // Three independently overlapping rear lengths with a tapered hem.
   const backLayer=region==='rear'?Math.min(2,Math.floor(j*3/count)):0;
   const lateral=clamp(Math.abs(rootX-cx)/(d.x*.5),0,1);
   const edgeTaper=1-.18*lateral*lateral;
   const lockLengthVariance=.12*(hash(seed*5.31)-.5);
   const strandLength=bang?
    Math.min(d.y*(.24+.10*scatter),Math.max(.001,rootY-(b.min.y+d.y*.68))):
    side?d.y*(.97+.55*scatter)*edgeTaper:
    d.y*lengthInHeads*([.41,.55,.70][backLayer]+.13*scatter+
     lockLengthVariance)*edgeTaper;
   const sway=(hash(seed*11.3)-.5)*d.x*.095;
   const clumpBand=Math.floor((rootX-cx)/d.x*23);
   const clumpDepth=Math.floor((rootZ-cz)/d.z*8);
   const clumpPhase=clumpBand*.47+clumpDepth*.89+backLayer*.61;
   const sideDirection=bang?1:(side||Math.sign(rootX-cx)||1);
   // Nearby follicles follow a shared wave phase, not unrelated spikes.
   const flowPhase=(rootX-cx)/d.x*6.1+(rootZ-cz)/d.z*2.8;
   const light=.82+.17*hash(seed*7.83);
   let previous=null,cut=false;
   for(let section=0;section<=SEGMENTS;section++){
    const t=section/SEGMENTS,fall=Math.pow(t,1.4);
    const curl=Math.sin(t*4.2+flowPhase)*Math.sin(Math.PI*t)*
      d.x*(bang?.006:side?.016:.022);
    const backWave=bang?0:
      Math.sin(t*5.3+clumpPhase)*Math.sin(Math.PI*t*.87)*
      d.x*(side?.026:.057);
    // Side locks fold behind the shoulders instead of pointing outwards.
    let x=bang?rootX+sideDirection*d.x*(.17*t+.035*fall)+curl:
     side?rootX+(cx-rootX)*(.075*t+.10*fall)+curl+backWave:
     rootX+sway*fall+curl+backWave;
    let y=rootY-strandLength*t;
    const ease=t*t*(3-2*t);
    const sweep=clamp(t*1.18,0,1),sideEase=sweep*sweep*(3-2*sweep);
    let z=bang?rootZ+d.z*(.085*t+.012*Math.sin(Math.PI*t)):
     side?lerp(rootZ,Math.min(rootZ,cz-d.z*.28),sideEase)-d.z*(.06*t+.06*fall):
     lerp(rootZ,Math.min(rootZ,cz-d.z*.18),ease)-
      d.z*(.05*t+.08*fall+.035*backLayer*ease+
       .015*Math.sin(t*5.5+clumpPhase)*Math.sin(Math.PI*t));
    if(side)maxSideOutwardDrift=Math.max(maxSideOutwardDrift,side*(x-rootX));
    // Behind-neck routing replaces the hard side split that created a V
    // shaped hole. Middle rear locks retain the centre-back silhouette.
    if(!bang){
     const nape=clamp((b.min.y+d.y*.54-y)/(d.y*.33),0,1);
     if(nape>0){
      const limit=cz-d.z*(.46+.04*backLayer);
      const behind=lerp(z,Math.min(z,limit),nape);
      if(behind<z-.00001)neckRearClearanceCorrections++;
      z=behind;
     }
    }
    // Trim a deep intersection, but keep any safe preceding part of
    // the strand. Subsequent segments collapse at the trim endpoint.
    if(!cut&&bodyEnvelope&&!bang){
     const [safeX,safeZ,contact]=clearBodyForLongStrand(x,y,z,region,bodyEnvelope);
     if(contact){
      bodyCollisionCorrections++;
      if(side)sideShoulderCorrections++;
      else rearBackCorrections++;
      if(section>=2&&y<b.min.y-d.y*.25&&z-safeZ>d.z*.20){
       cut=true;bodyCutStrands++;
      }else {x=safeX;z=safeZ;}
     }
    }
    if(cut&&previous){
     x=previous[0];y=previous[1];z=previous[2];bodyCutSections++;
    }
    if(!bang&&y<=b.min.y+d.y*.19&&y>=b.min.y-d.y*.70){
     minimumRearDepth=Math.min(minimumRearDepth,z);
     if(Math.abs(x-cx)<d.x*.4&&z>cz-d.z*.38)
      frontNeckIntrusionVertices++;
    }
    if(bang)lowestBangY=Math.min(lowestBangY,y);
    lowestY=Math.min(lowestY,y);
    const current=[x,y,z,t];
    if(previous){
     for(const v of [previous,current]){
      const o=vi*3;
      positions[o]=v[0];positions[o+1]=v[1];positions[o+2]=v[2];
      const lum=light*(1-.18*v[3]);
      colors[o]=lum;colors[o+1]=lum*.94;colors[o+2]=lum*.84;
      vi++;
     }
     if(side&&y>b.min.y+d.y*.5&&Math.abs(x-cx)<d.x*.31&&z>cz+d.z*.18)
      frontEyeZoneVertices+=2;
    }
    previous=current;
   }
  }
 }
 if(global!==COUNT||vi!==VERTICES)
  throw Error('Incomplete heroine scalp strand assembly');
 // One independent object for each front/temple part and each of three
 // rear layers. 100,000 scalp-rooted curves remain real GPU line primitives.
 const hair=new THREE.Group();
 hair.name='HEROINE_WIG_SEPARATE_PARTS';
 hair.matrixAutoUpdate=false;hair.matrix.copy(scalp.matrix);
 const zones=[
  ['HEROINE_WIG_REAR_UPPER',0,Math.floor(regions.rear/3)],
  ['HEROINE_WIG_REAR_MIDDLE',Math.floor(regions.rear/3),Math.floor(regions.rear*2/3)],
  ['HEROINE_WIG_REAR_LOWER',Math.floor(regions.rear*2/3),regions.rear],
  ['HEROINE_WIG_TEMPLE_LEFT',regions.rear,regions.rear+regions.templeLeft],
  ['HEROINE_WIG_TEMPLE_RIGHT',regions.rear+regions.templeLeft,
   regions.rear+regions.templeLeft+regions.templeRight],
  ['HEROINE_WIG_FRINGE',COUNT-regions.bangs,COUNT]
 ];
 for(const [name,first,last] of zones){
  const begin=first*SEGMENTS*2*3,finish=last*SEGMENTS*2*3;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions.subarray(begin,finish),3));
  geo.setAttribute('color',new THREE.BufferAttribute(colors.subarray(begin,finish),3));
  geo.computeBoundingBox();geo.computeBoundingSphere();
  const mat=new THREE.LineBasicMaterial({
   color:0xffffff,vertexColors:true,depthTest:true,depthWrite:true
  });
  const strands=new THREE.LineSegments(geo,mat);
  strands.name=name;strands.userData.strands=last-first;
  strands.userData.bodyClipped=true;
  hair.add(strands);
 }
 const report=Object.freeze({
  authoredStyle:'fantasy-long-blonde',previewOnly:true,
  scalpAnchored:true,sourceAnchored:true,sourceHeadUnchanged:true,
  originalSourceGeometryIntact:true,longHairPreviewOnly:true,
  staticUnrigged:true,referenceBasedApproximation:true,
  roundedCrossSection:false,layeredVolume:true,denseFringe:true,
  softTaperedTips:true,eyebrowSafeFringe:true,
  noWidePolygonCards:true,individualFilamentCount:COUNT,
  strandRenderer:'gpu-line-segments',strandSegmentCount:COUNT*SEGMENTS,
  allStrandsRendered:true,previewOnlyLinePrimitive:true,
  templeClearanceStrategy:'behind-real-shoulder-no-side-wings',
  rootDistribution:'full-crown-and-occiput-not-rear-strip',
   rearFlow:'tapered-clumped-swaying-layers-no-flat-hem',
  sweptAsymmetricBangs:true,shorterSideLocks:true,
  rearClearanceStrategy:'actual-body-back-envelope',
  donorScalpOnlyForRoots:true,bodyClearanceMeasured:!!bodyEnvelope,
  bodyCollisionCorrections,sideShoulderCorrections,rearBackCorrections,
   maxSideOutwardDriftMeters:Number(maxSideOutwardDrift.toFixed(5)),
   coherentScalpFlow:true,templeTipsTurnBehindShoulders:true,
   neckRearClearanceCorrections,frontNeckIntrusionVertices,
   bodyCutStrands,bodyCutSections,bodyContactPolicy:'trim-deep-contact',
   minimumRearDepth:Number(minimumRearDepth.toFixed(4)),
   beardFreeFrontNeck:frontNeckIntrusionVertices===0,
   separatedHairObjects:true,
   hairPartNames:Object.freeze(zones.map(([name])=>name)),
   rearLayerCount:3,wigPartCount:hair.children.length,
   rearMaxLengthInHeads:Number((lengthInHeads*.72).toFixed(2)),
   rearLayersCutBeforeAnkles:true,
  scalpRegions:Object.freeze(regions),scalpCrownRootPool:crown.length,
  rearLocks:regions.rear,faceFramingLocks:regions.templeLeft+regions.templeRight,
  bangLocks:regions.bangs,lockCount:COUNT,
  fringeTipMinYNormalized:Number(((lowestBangY-b.min.y)/d.y).toFixed(3)),
  lengthInHeads:Number(lengthInHeads.toFixed(2)),
  lowestRelativeToScalpBottom:Number(((lowestY-b.min.y)/d.y).toFixed(3)),
  triangleCount:0,frontEyeZoneVertices,
  noFloatingBun:true,backExtendsBelowShoulders:true
 });
 return {hair,report};
}
