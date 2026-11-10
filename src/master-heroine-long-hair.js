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
 * The wig cap is a dense undercoat, NOT the visible hairstyle. Build actual
 * front-swept 3D fringe ribbons and small crown hairs from sampled, masked
 * female-head source topology. Both pieces follow the existing scalp local
 * coordinate system; no replacement sphere, forehead texture or old donor.
 * Keep every fringe tip above the eye band to protect blink/eyelash rigs.
 */
export function buildHeroineVisibleCrownAndFringe(scalp){
 const src=scalp?.geometry,p=src?.getAttribute('position');
 const mask=src?.getAttribute('color'),normals=src?.getAttribute('normal');
 if(!p||!mask||mask.itemSize!==4)throw Error('Real masked scalp geometry required');
 src.computeBoundingBox();
 const b=src.boundingBox,d=b.getSize(new THREE.Vector3());
 const cx=(b.min.x+b.max.x)*.5,cz=(b.min.z+b.max.z)*.5;
 const frontal=[],crownSegments=[],crownColors=[];
 let upperSourceSamples=0;
 const n=new THREE.Vector3(),root=new THREE.Vector3();
 const frontPositions=[];
 for(let i=0;i<p.count;i++){
  const y=(p.getY(i)-b.min.y)/d.y;
  const x=(p.getX(i)-cx)/d.x;
  const z=(p.getZ(i)-b.min.z)/d.z;
  const alpha=mask.getW(i);
  if(alpha>.75&&y>.76&&Math.abs(x)<.48&&z>.42)
   frontal.push({i,x:p.getX(i),y:p.getY(i),z:p.getZ(i),height:y,depth:z});
  if(y>.84&&alpha>.75)upperSourceSamples++;
  // Draw combed highlight texture ON the head topology, not a smooth
  // pink bald skull. All strands use the source vertex normals.
  if(i%5!==0||alpha<.88||y<.66)continue;
  root.fromBufferAttribute(p,i);
  if(normals)n.fromBufferAttribute(normals,i).normalize();
  else n.set(x,y-.42,z-.5).normalize();
  const length=d.y*(.045+.038*hash(i*1.51));
  const sweep=1+hash(i*4.71)*.7;
  const start=root.clone().addScaledVector(n,.0040);
  const finish=start.clone().add(new THREE.Vector3(
   -d.x*(.022+.014*hash(i*3.13))*sweep,
   -length*.75,
   -d.z*.018
  )).addScaledVector(n,.0013);
  // Avoid turning source-rooted scalp streaks into long spikes.
  const q=hash(i*2.17),lum=.74+.25*q;
  crownSegments.push(start.x,start.y,start.z,finish.x,finish.y,finish.z);
  crownColors.push(lum,lum*.92,lum*.91,lum*.92,lum*.86,lum*.91);
 }
 if(upperSourceSamples<35||crownSegments.length<120)
  throw Error('Not enough genuine source crown follicles for visible wig');
 const streakGeo=new THREE.BufferGeometry();
 streakGeo.setAttribute('position',new THREE.Float32BufferAttribute(crownSegments,3));
 streakGeo.setAttribute('color',new THREE.Float32BufferAttribute(crownColors,3));
 streakGeo.computeBoundingSphere();
 const crownStreaks=new THREE.LineSegments(streakGeo,
  new THREE.LineBasicMaterial({color:0xd6a5ba,vertexColors:true,depthWrite:true}));
 crownStreaks.name='HEROINE_VISIBLE_COMBED_CROWN_HAIR';
 crownStreaks.renderOrder=1;
 // Fallback still uses actual upper source vertices if the segmented donor
 // has no complete high frontal tessellation.
 const fallback=frontal.length>=35?frontal:[];
 if(fallback.length<35){
  for(let i=0;i<p.count;i++){
   const y=(p.getY(i)-b.min.y)/d.y,z=(p.getZ(i)-b.min.z)/d.z;
   if(mask.getW(i)>.8&&y>.82&&z>.30)
    fallback.push({i,x:p.getX(i),y:p.getY(i),z:p.getZ(i),height:y,depth:z});
  }
 }
 if(fallback.length<35)throw Error('No source-rooted forehead follicles for full 3D bangs');
 // A forehead limit is based on SOURCE FACE samples rather than the nose
 // or a guessed world-Z plane; bangs stay close to the real skin surface.
 let foreheadDepth=-Infinity,foreheadCount=0;
 for(let i=0;i<p.count;i++){
  const y=(p.getY(i)-b.min.y)/d.y,x=(p.getX(i)-cx)/d.x;
  if(y>.66&&y<.82&&Math.abs(x)<.35){
   foreheadDepth=Math.max(foreheadDepth,p.getZ(i));foreheadCount++;
  }
 }
 if(!foreheadCount)foreheadDepth=cz+d.z*.28;
 const columns=36,seedRoots=[];
 for(let c=0;c<columns;c++){
  const targetX=cx+d.x*((c+.5)/columns-.5)*.82;
  let chosen=null,best=Infinity;
  for(const q of fallback){
   const dx=Math.abs(q.x-targetX)/d.x;
   // Favor the upper FRONT hairline, never a rear-crown-only tuft.
   const score=dx*3+Math.abs(q.height-.88)*.62-q.depth*.40;
   if(score<best){best=score;chosen=q;}
  }
  seedRoots.push(chosen);
 }
 const verts=[],cols=[],indices=[];
 let fringeTipY=Infinity,frontalRoots=0,rootErrorMax=0;
 const locks=288,sections=7;
 for(let i=0;i<locks;i++){
  const column=Math.min(columns-1,Math.floor(i/locks*columns));
  const q=seedRoots[column];
  const t0=hash(i*11.9),row=(i%3);
  // Original scalp geometry anchor, with a sub-millimeter comb spread.
  const rootX=q.x+(t0-.5)*d.x*.005;
  const rootY=q.y;
  const rootZ=q.z;
  rootErrorMax=Math.max(rootErrorMax,Math.hypot(rootX-q.x,rootY-q.y,rootZ-q.z));
  frontalRoots++;
  const xNorm=(rootX-cx)/d.x;
  const tipN=.685+.015*hash(i*3.71)+.023*Math.abs(xNorm);
  const endY=Math.min(rootY-d.y*.045,b.min.y+d.y*tipN);
  // Most locks drift diagonally toward the viewer's left; a smaller
  // secondary sweep gives the pink fringe an identifiable parting.
  const sideways=row===2?-.08:-.19;
  const sway=d.x*(sideways+.015*(hash(i*6.3)-.5));
  const frontLimit=Math.max(rootZ,foreheadDepth+d.z*.025);
  const width=d.x*(.0065+.003*hash(i*7.17));
  const base=verts.length/3;
  for(let j=0;j<=sections;j++){
   const t=j/sections,ease=t*t*(3-2*t);
   const x=rootX+sway*ease+d.x*.009*Math.sin(Math.PI*t)*Math.sin(i*.18);
   const y=lerp(rootY,endY,t);
   const z=lerp(rootZ,frontLimit,ease)+d.z*(.014*Math.sin(Math.PI*t)+.010);
   const half=width*(.87-.72*t);
   fringeTipY=Math.min(fringeTipY,y);
   for(const side of [-1,1]){
    verts.push(x+side*half,y,z);
    const lum=.74+.23*hash(i*5.61)+.025*Math.sin(t*13+i*.23);
    cols.push(lum,lum*.91,lum*.87);
   }
   if(j<sections){
    const a=base+j*2;
    indices.push(a,a+1,a+2,a+1,a+3,a+2);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const fringe=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
  color:0xd6a5ba,vertexColors:true,side:THREE.DoubleSide,
  metalness:0,roughness:.76,depthWrite:true
 }));
 fringe.name='HEROINE_288_REAL_SCALP_SWEEP_BANG_RIBBONS';
 fringe.castShadow=true;fringe.renderOrder=2;
 fringe.userData.noEyeOcclusion=true;
 return {fringe,crownStreaks,report:Object.freeze({
  sourceHeadTopologicalAnchors:true,
  frontalAnchorSamples:fallback.length,
  upperSourceSamples,foreheadSourceSamples:foreheadCount,
  fringeRibbonCount:locks,fringeTriangles:indices.length/3,
  crownCombLines:crownSegments.length/6,
  fringeTipMinYNormalized:Number(((fringeTipY-b.min.y)/d.y).toFixed(3)),
  maxFringeRootOffsetMeters:Number(rootErrorMax.toFixed(5)),
  crownOnlyCapNoLongerSmooth:true,
  fullForeheadFringe:true,sourceFaceUnchanged:true
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
  const l=.94+.06*Math.sin(x*79+z*47+y*29);
  color[o]=l;color[o+1]=l*.98;color[o+2]=l;color[o+3]=a;
  if(yn>.87){crownSamples++;if(a>.98)coveredCrown++;}
 }
 if(crownSamples<35||coveredCrown/crownSamples<.95)
  throw Error('Wig crown leaves a bald scalp: '+coveredCrown+'/'+crownSamples);
 cap.setAttribute('color',new THREE.BufferAttribute(color,4));
 const material=new THREE.MeshStandardMaterial({
  color:0xd6a5ba,vertexColors:true,side:THREE.DoubleSide,
  roughness:.82,metalness:0,transparent:true,alphaTest:.02,depthWrite:true,
  polygonOffset:true,polygonOffsetFactor:.8,polygonOffsetUnits:1.0
 });
 const mesh=new THREE.Mesh(cap,material);
 mesh.name='HEROINE_WIG_ROOT_CROWN_NOT_DONOR_HAIR';
 mesh.matrixAutoUpdate=false;mesh.matrix.copy(scalp.matrix);
 mesh.castShadow=true;mesh.renderOrder=0;
 mesh.userData.wigCapFromSourceTopology=true;
 mesh.userData.donorHairMustBeHidden=true;
 const visible=buildHeroineVisibleCrownAndFringe(scalp);
 // Children share cap's scalp-local transform; no duplicated head-space
 // transform and no licensed hair meshes rendered beneath the authored wig.
 mesh.add(visible.crownStreaks,visible.fringe);
 mesh.userData.visibleHairDetail=visible.report;
 return {cap:mesh,report:Object.freeze({
  ...visible.report,
  sourceHeadConforming:true,sourceScalpHidden:true,wigRootFoundationOnly:true,
  crownSamples,coveredCrown,coverageRatio:coveredCrown/crownSamples,
  sourceAnatomyUntouched:true
 })};
}

export function buildHeroineFantasyLongHair(scalp,{lengthInHeads=3.25,bodyEnvelope=null}={}){
 const source=scalp?.geometry;
 const p=source?.getAttribute('position'),alpha=source?.getAttribute('color');
 const normals=source?.getAttribute('normal');
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
  // Follicle origin is raised slightly above the tinted undercoat so
  // the 100,000 line segments remain visible, not depth-hidden by the cap.
  const nx=normals?.getX(i)||0,ny=normals?.getY(i)||0,nz=normals?.getZ(i)||0;
  all.push([x,y,z,nx,ny,nz]);
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
   const rootX=q[0]+(hash(seed*4.1)-.5)*d.x*.003+q[3]*.0045;
   const rootY=q[1]+q[4]*.0045,rootZ=q[2]+q[5]*.0045;
   // Three distinct rear layers with overlapping ends, not two long sheets.
   const backLayer=region==='rear'?Math.min(2,Math.floor(j*3/count)):0;
   const strandLength=bang?
    Math.min(d.y*(.24+.10*scatter),Math.max(.001,rootY-(b.min.y+d.y*.68))):
    side?d.y*(1.02+.54*scatter):
    d.y*lengthInHeads*([.40,.54,.66][backLayer]+.06*scatter);
   const sway=(hash(seed*11.3)-.5)*d.x*.055;
   const sideDirection=bang?-1:(side||Math.sign(rootX-cx)||1);
   // Nearby follicles follow a shared wave phase, not unrelated spikes.
   const flowPhase=(rootX-cx)/d.x*6.1+(rootZ-cz)/d.z*2.8;
   const light=.82+.17*hash(seed*7.83);
   let previous=null,cut=false;
   for(let section=0;section<=SEGMENTS;section++){
    const t=section/SEGMENTS,fall=Math.pow(t,1.4);
    const curl=Math.sin(t*4.2+flowPhase)*Math.sin(Math.PI*t)*
      d.x*(bang?.006:side?.012:.018);
    // Side locks fold behind the shoulders instead of pointing outwards.
    let x=bang?rootX+sideDirection*d.x*(.13*t+.055*fall)+curl:
     side?rootX+(cx-rootX)*(.075*t+.10*fall)+curl:
     rootX+sway*fall+curl;
    let y=rootY-strandLength*t;
    const ease=t*t*(3-2*t);
    const sweep=clamp(t*1.18,0,1),sideEase=sweep*sweep*(3-2*sweep);
    let z=bang?rootZ+d.z*(.12*t+.018*Math.sin(Math.PI*t)):
     side?lerp(rootZ,Math.min(rootZ,cz-d.z*.28),sideEase)-d.z*(.06*t+.06*fall):
     lerp(rootZ,Math.min(rootZ,cz-d.z*.18),ease)-
      d.z*(.05*t+.08*fall+.035*backLayer*ease);
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
   color:0xd6a5ba,vertexColors:true,depthTest:true,depthWrite:true
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
   rearFlow:'overlapping-layers-not-forced-neck-v',
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
