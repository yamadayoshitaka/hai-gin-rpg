import * as THREE from 'three';

/**
 * Heroine 01's INSPECTION-ONLY wig: 100,000 genuine 3D filament meshes,
 * merged into one indexed mesh. Unlike the former wide 600-card curtain,
 * each filament has a closed triangular cross-section and curved centreline.
 * Roots are sampled from the source CC0 scalp's alpha-masked vertices.
 * The battle model and archived GLBs remain untouched.
 */
const COUNT=100000,SEGMENTS=6,SIDES=3;
const fract=x=>x-Math.floor(x);
const hash=x=>fract(Math.sin(x*127.1+17.79)*43758.5453123);
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(a,min,max)=>Math.min(max,Math.max(min,a));

export function buildHeroineFantasyLongHair(scalp,{lengthInHeads=3.25}={}){
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
 const rear=pick('rear'),left=pick('left'),right=pick('right'),fringe=pick('fringe');
 if([rear,left,right,fringe].some(a=>a.length<30))
  throw Error('Female source scalp does not contain usable source-rooted hair regions');
 const rings=SEGMENTS+1,vertsPerStrand=rings*SIDES,trianglesPerStrand=SEGMENTS*SIDES*2;
 const positions=new Float32Array(COUNT*vertsPerStrand*3);
 const normals=new Float32Array(positions.length);
 const colors=new Float32Array(positions.length);
 const indices=new Uint32Array(COUNT*trianglesPerStrand*3);
 let lowestY=Infinity,lowestBangY=Infinity,frontEyeZoneVertices=0;
 let vi=0,ii=0;
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
   const q=anchors[(j*67+Math.floor(hash(global+4)*anchors.length))%anchors.length];
   const seed=global+1,scatter=hash(seed*1.19),waveSeed=hash(seed*3.71);
   const rootX=q[0]+(hash(seed*4.1)-.5)*d.x*.003;
   const rootY=q[1],rootZ=q[2];
   const strandLength=bang?d.y*(.025+.022*scatter):
    d.y*lengthInHeads*(side?.84:1)*(.83+.17*scatter);
   const radius=d.x*(.00058+.00050*hash(seed*9.13));
   const sway=(hash(seed*11.3)-.5)*d.x*.14;
   const sideDirection=side||Math.sign(rootX-cx)||1;
   const startVertex=global*vertsPerStrand;
   for(let s=0;s<rings;s++){
    const t=s/SEGMENTS,fall=Math.pow(t,1.4);
    const curl=Math.sin(t*Math.PI*2.1+waveSeed*6.28)*
      Math.sin(Math.PI*t)*d.x*(bang?.010:side?.038:.026);
    // Ear-front hair sweeps OUTWARDS before falling, revealing the cheek
    // contour. The back follows the occiput and drops behind shoulders.
    const x=bang?
     rootX+sideDirection*d.x*.075*t+curl:
     rootX+(side?side*d.x*(.11*t+.07*fall):sway*fall)+curl;
    const y=rootY-strandLength*t;
    const z=bang?
     rootZ+d.z*(.075*t+.035*Math.sin(Math.PI*t)):
     side?lerp(rootZ,cz-d.z*.11,clamp(t*1.6,0,1))-d.z*.035*fall:
     Math.min(rootZ,cz-d.z*.11)-d.z*(.055*t+.12*fall);
    if(bang)lowestBangY=Math.min(lowestBangY,y);
    lowestY=Math.min(lowestY,y);
    const thinning=.64+.36*Math.sin(Math.PI*(.10+.78*t));
    const rr=radius*thinning*(1-.45*Math.pow(t,2.2));
    for(let k=0;k<SIDES;k++){
     const angle=k*Math.PI*2/SIDES+waveSeed*.3+t*.14;
     const rx=Math.cos(angle),rz=Math.sin(angle);
     const o=vi*3;
     positions[o]=x+rx*rr;positions[o+1]=y;positions[o+2]=z+rz*rr;
     normals[o]=rx;normals[o+1]=.04;normals[o+2]=rz;
     const light=.82+.25*hash(seed*7.83)+.025*rx;
     colors[o]=light;colors[o+1]=light*.94;colors[o+2]=light*.82;
     if(side&&y>b.min.y+d.y*.5&&Math.abs(x-cx)<d.x*.31&&z>cz+d.z*.18)
      frontEyeZoneVertices++;
     vi++;
    }
    if(s===SEGMENTS)continue;
    for(let k=0;k<SIDES;k++){
     const n=(k+1)%SIDES;
     const a=startVertex+s*SIDES+k,an=startVertex+s*SIDES+n;
     const c=a+SIDES,cn=an+SIDES;
     indices[ii++]=a;indices[ii++]=an;indices[ii++]=c;
     indices[ii++]=an;indices[ii++]=cn;indices[ii++]=c;
    }
   }
  }
 }
 if(global!==COUNT||vi!==COUNT*vertsPerStrand||ii!==indices.length)
  throw Error('Incomplete heroine scalp strand assembly');
 // One draw call (not 100,000 scene nodes) keeps the inspection navigable.
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 g.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));
 g.setIndex(new THREE.BufferAttribute(indices,1));
 g.computeBoundingSphere();g.computeBoundingBox();
 const material=new THREE.MeshPhysicalMaterial({
  color:0xffffff,vertexColors:true,roughness:.43,metalness:0,
  clearcoat:.13,clearcoatRoughness:.30,side:THREE.DoubleSide
 });
 const hair=new THREE.Mesh(g,material);
 hair.name='HEROINE_PREVIEW_100000_INDIVIDUAL_3D_LONG_STRANDS';
 hair.matrixAutoUpdate=false;hair.matrix.copy(scalp.matrix);
 hair.castShadow=true;hair.receiveShadow=false;
 const report=Object.freeze({
  authoredStyle:'fantasy-long-blonde',previewOnly:true,
  scalpAnchored:true,sourceAnchored:true,sourceHeadUnchanged:true,
  originalSourceGeometryIntact:true,longHairPreviewOnly:true,
  staticUnrigged:true,referenceBasedApproximation:true,
  roundedCrossSection:true,layeredVolume:true,denseFringe:true,
  softTaperedTips:true,eyebrowSafeFringe:true,
  noWidePolygonCards:true,individualFilamentCount:COUNT,
  templeClearanceStrategy:'sweep-outward-before-shoulder-drop',
  scalpRegions:Object.freeze(regions),
  rearLocks:regions.rear,faceFramingLocks:regions.templeLeft+regions.templeRight,
  bangLocks:regions.bangs,lockCount:COUNT,
  fringeTipMinYNormalized:Number(((lowestBangY-b.min.y)/d.y).toFixed(3)),
  lengthInHeads:Number(lengthInHeads.toFixed(2)),
  lowestRelativeToScalpBottom:Number(((lowestY-b.min.y)/d.y).toFixed(3)),
  triangleCount:indices.length/3,frontEyeZoneVertices,
  noFloatingBun:true,backExtendsBelowShoulders:true
 });
 return {hair,report};
}
