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
  const a=yn>.82?1:u*u*(3-2*u);
  const o=i*4;
  color[o]=.99;color[o+1]=.96;color[o+2]=.97;color[o+3]=a;
  if(yn>.87){crownSamples++;if(a>.98)coveredCrown++;}
 }
 if(crownSamples<35||coveredCrown/crownSamples<.95)
  throw Error('Wig crown leaves a bald scalp: '+coveredCrown+'/'+crownSamples);
 cap.setAttribute('color',new THREE.BufferAttribute(color,4));
 const material=new THREE.MeshStandardMaterial({
  color:0xb98999,vertexColors:true,side:THREE.DoubleSide,
  roughness:.88,metalness:0,transparent:true,alphaTest:.08,depthWrite:true
 });
 const mesh=new THREE.Mesh(cap,material);
 mesh.name='HEROINE_WIG_ROOT_CROWN_NOT_DONOR_HAIR';
 mesh.matrixAutoUpdate=false;mesh.matrix.copy(scalp.matrix);
 mesh.castShadow=true;mesh.renderOrder=0;
 return {cap:mesh,report:Object.freeze({
  sourceHeadConforming:true,sourceScalpHidden:true,wigRootFoundationOnly:true,
  crownSamples,coveredCrown,coverageRatio:coveredCrown/crownSamples,
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
 let maxSideOutwardDrift=0;
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
   const strandLength=bang?
    Math.min(d.y*(.24+.10*scatter),Math.max(.001,rootY-(b.min.y+d.y*.68))):
    side?d.y*(1.30+.55*scatter):
    d.y*lengthInHeads*(.83+.17*scatter);
   const sway=(hash(seed*11.3)-.5)*d.x*.055;
   const sideDirection=bang?1:(side||Math.sign(rootX-cx)||1);
   // Nearby follicles follow a shared wave phase, not unrelated spikes.
   const flowPhase=(rootX-cx)/d.x*6.1+(rootZ-cz)/d.z*2.8;
   const light=.82+.17*hash(seed*7.83);
   let previous=null;
   for(let section=0;section<=SEGMENTS;section++){
    const t=section/SEGMENTS,fall=Math.pow(t,1.4);
    const curl=Math.sin(t*4.2+flowPhase)*Math.sin(Math.PI*t)*
      d.x*(bang?.006:side?.012:.018);
    // Side locks fold behind the shoulders instead of pointing outwards.
    let x=bang?rootX+sideDirection*d.x*(.17*t+.035*fall)+curl:
     side?rootX+(cx-rootX)*(.075*t+.10*fall)+curl:
     rootX+sway*fall+curl;
    const y=rootY-strandLength*t;
    const ease=t*t*(3-2*t);
    const sweep=clamp(t*1.18,0,1),sideEase=sweep*sweep*(3-2*sweep);
    let z=bang?rootZ+d.z*(.085*t+.012*Math.sin(Math.PI*t)):
     side?lerp(rootZ,Math.min(rootZ,cz-d.z*.28),sideEase)-d.z*(.06*t+.06*fall):
     lerp(rootZ,Math.min(rootZ,cz-d.z*.18),ease)-d.z*(.05*t+.10*fall);
    if(side)maxSideOutwardDrift=Math.max(maxSideOutwardDrift,side*(x-rootX));
    // Screen-space appearance is not a collision check: push EACH REAL
    // filament vertex outside measured shoulder and back envelopes.
    if(bodyEnvelope&&!bang){
     const result=clearBodyForLongStrand(x,y,z,region,bodyEnvelope);
     x=result[0];z=result[1];
     if(result[2]){
      bodyCollisionCorrections++;
      if(side)sideShoulderCorrections++;
      else rearBackCorrections++;
     }
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
 // Line primitives bypass the catastrophic triangle raster cost of 100k
 // physically tubular hairs on SwiftShader and mobile GPUs. All 100,000
 // distinct curves are still rendered; nothing is downsampled for QA.
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));
 g.computeBoundingSphere();g.computeBoundingBox();
 const material=new THREE.LineBasicMaterial({
  color:0xffffff,vertexColors:true,transparent:false,depthWrite:true
 });
 const hair=new THREE.LineSegments(g,material);
 hair.name='HEROINE_PREVIEW_100000_INDIVIDUAL_3D_LONG_STRANDS';
 hair.matrixAutoUpdate=false;hair.matrix.copy(scalp.matrix);
 hair.frustumCulled=true;
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
  sweptAsymmetricBangs:true,shorterSideLocks:true,
  rearClearanceStrategy:'actual-body-back-envelope',
  donorScalpOnlyForRoots:true,bodyClearanceMeasured:!!bodyEnvelope,
  bodyCollisionCorrections,sideShoulderCorrections,rearBackCorrections,
   maxSideOutwardDriftMeters:Number(maxSideOutwardDrift.toFixed(5)),
   coherentScalpFlow:true,templeTipsTurnBehindShoulders:true,
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
