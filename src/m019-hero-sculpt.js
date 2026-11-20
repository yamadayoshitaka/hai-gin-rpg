import * as THREE from 'three';

/**
 * m019 — actual game mesh of the approved 2026-11-19 four-view concept:
 * long narrow lava lizard, tiny widely spaced planted limbs, whip-like
 * curled tail, two swept horns, thin sharp muzzle and amber slit eyes.
 *
 * This is a species-specific resculpt of the existing m001 stations.
 * Do not propagate the new ratios to m001, m016 or m017. No billboards.
 */
export const M019_HERO_REVISION='m019-volcanic-pbr-v19-20261120';
export const M019_BODY_DROP=.86;
export const M019_TAIL_LENGTH=2.20;
export const M019_LIMB_REACH=.54;
export const M019_LIMB_WIDTH=.66;
export const M019_BODY_STRETCH=1.76;
export const M019_APPROVED_SILHOUETTE=Object.freeze({
 concept:'m019-2026-11-19-approved-four-view-turnaround',
 body:'long-flat-salamander-not-a-stocky-dragon',
 head:'narrow-tapered-wedge',
 horns:2,legs:4,toesPerFoot:4,
 stance:'very-low',tail:'very-long-upcurled',
 palette:'obsidian-shell-with-molten-orange-fissures'
});

/** M001 source coordinates are copied, NOT edited in place. */
export function m019HeroSkullRings(m001Rings){
 if(!Array.isArray(m001Rings)||m001Rings.length<10)
  throw Error('m019 requires original m001 skull stations');
 return m001Rings.map((r,i)=>{
  const t=i/(m001Rings.length-1);
  const brow=Math.exp(-Math.pow((t-.48)/.25,2));
  return {
   z:r.z*(r.z>=0?1.87:1.46)+.048,
   y:r.y*.68-.047-.009*brow,
   rx:r.rx*(.62+.090*brow)+.003*Math.sin(Math.PI*t),
   ry:r.ry*(.59+.045*brow)
  };
 });
}

/** Stretch torso in Z, slim it in X and flatten it in Y. */
export function m019HeroTorsoRings(referenceStations){
 if(!Array.isArray(referenceStations)||referenceStations.length<6)
  throw Error('m019 requires complete m001 donor ribcage');
 return referenceStations.map((p,i)=>{
  const t=i/(referenceStations.length-1);
  const chest=Math.exp(-Math.pow((t-.29)/.25,2));
  return {
   ...p,z:p.z*M019_BODY_STRETCH,
   y:p.y-.018+.012*chest,
   rx:p.rx*(.50+.020*chest),
   ry:p.ry*(.59+.027*chest)
  };
 });
}

/** A closed continuous wedge snout, not a wolf nose or a second face ball. */
export function sculptM019Muzzle(g,head){
 const snout=g.axialLoft(head,'skin',[
  {z:1.000,y:-.176,rx:.017,ry:.022},
  {z:.969,y:-.171,rx:.046,ry:.040},
  {z:.890,y:-.162,rx:.069,ry:.051},
  {z:.766,y:-.139,rx:.090,ry:.067},
  {z:.610,y:-.111,rx:.112,ry:.078},
  {z:.432,y:-.065,rx:.133,ry:.101},
  {z:.195,y:-.013,rx:.147,ry:.112}
 ],{name:'m019-unbroken-salamander-muzzle',rough:.82,
   ribbing:.004,capEnds:true});
 snout.userData.m019ContinuousMuzzle=true;
 snout.userData.m019ApprovedLongLizardSnout=true;
 for(const side of [-1,1]){
  const s=side<0?'L':'R';
  const cheek=g.bridge(head,'skin',
    [side*.113,-.052,.202],[side*.146,-.126,.518],.052,.022);
  cheek.name='m019-continuous-cheek-'+s;
  cheek.userData.m019CheekRooted=true;
  g.sphere(head,'shadow',[side*.059,-.154,.967],
    [.017,.009,.022],{name:'m019-nostril-'+s,rough:.93});
 }
 return snout;
}

/** Slender mandible follows the jaw pivot and stays tucked in at rest. */
export function sculptM019Jaw(g,jaw){
 const mandible=g.axialLoft(jaw,'skin',[
  {z:.660,y:-.079,rx:.020,ry:.016},
  {z:.615,y:-.073,rx:.072,ry:.027},
  {z:.465,y:-.061,rx:.092,ry:.036},
  {z:.280,y:-.041,rx:.109,ry:.043},
  {z:.075,y:-.027,rx:.098,ry:.051},
  {z:-.125,y:-.003,rx:.060,ry:.040}
 ],{name:'m019-articulated-wide-mandible',rough:.84,
   ribbing:.002,capEnds:true});
 mandible.userData.m019MandibleRooted=true;
 for(const side of [-1,1]){
  const s=side<0?'L':'R';
  const fang=g.rootedSpike(jaw,'bone','skin',
    [side*.080,-.038,.505],[side*.081,.013,.560],.014,
    {name:'m019-lower-tusk-'+s});
  fang.tooth.userData.m019MovesWithJaw=true;
 }
 return mandible;
}

/**
 * m019 lizard rig, two perpendicular segments, not dog/cat hind legs:
 * torso-mounted SHOULDER / HIP pivots are at the actual skin socket.
 * Upper arm / thigh is nearly horizontal to the lateral elbow / knee,
 * lower arm / shin drops vertically. The top ring overlaps the trunk and
 * the last upper ring overlaps the shin first rings at the joint.
 *
 * Coordinates are LOCAL to leg and distal pivots, respectively.
 * True circular rings now face the limb direction rather than Y, avoiding
 * flat sideways plates. Short planted shins and original joints are retained.
 */
// Sideways elbow remains wide, while the vertical shin is now short.
export const M019_SPRAWL_KNEE_X=.93;
export const M019_SPRAWL_KNEE_Y=-.085;
export const M019_SPRAWL_FOOT_X=.007;
export const M019_SPRAWL_FOOT_Y=-.770;
export const M019_SHOULDER_LOCAL_Y=1.360;
/**
 * Shape the ALREADY RENDERING oriented-bridge topology in place.
 *
 * On Android the four historical bridge meshes render reliably, whereas
 * replacing them with tubes made the limbs disappear. This only reshapes
 * their existing vertex rings: no new Mesh, material, draw call, shrink
 * scale, LOD mask or change to the articulated parent rig.
 *
 * The muscle profile swells across the anatomical shaft and merges into
 * the elbow/knee. Both endpoints keep their original positions so the
 * planted toes and torso fascia do not detach during animations.
 */
function contourM019StableBridge(mesh,from,to,{
 region='upper',side=1,detail='high'
}={}){
 const geometry=mesh?.geometry,position=geometry?.getAttribute('position');
 const uv=geometry?.getAttribute('uv');
 if(!position||!uv)throw Error('m019 requires real oriented bridge rings');
 let stride=0;
 while(stride<uv.count&&Math.abs(uv.getY(stride))<1e-5)stride++;
 if(stride<9||position.count%stride!==0)
  throw Error('m019 bridge ring topology must remain round and regular');
 const rings=position.count/stride;
 if(rings<10)throw Error('m019 needs enough longitudinal muscle stations');
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to);
 const axis=b.clone().sub(a).normalize();
 const u=new THREE.Vector3(1,0,0);
 if(Math.abs(u.dot(axis))>.94)u.set(0,0,1);
 u.addScaledVector(axis,-u.dot(axis)).normalize();
 const v=new THREE.Vector3().crossVectors(axis,u).normalize();
 const center=new THREE.Vector3(),radial=new THREE.Vector3();
 const sign=side<0?-1:1,upper=region==='upper';
 for(let row=0;row<rings;row++){
  const t=row/(rings-1),arc=Math.sin(Math.PI*t);
  center.lerpVectors(a,b,t);
  // Different anatomical profiles rather than uniform cylindrical bars:
  // shoulder/thigh is fleshy at 1/3 and tapers into the elbow; the
  // lower segment swells below the knee and narrows at the planted ankle.
  const muscle=upper?.21*Math.exp(-Math.pow((t-.34)/.24,2)):
    .20*Math.exp(-Math.pow((t-.24)/.27,2));
  const joint=upper?.075*Math.exp(-Math.pow((t-.91)/.10,2)):
    .055*Math.exp(-Math.pow((t-.055)/.13,2));
  const taper=upper?1-.035*t:1-.065*t;
  const shape=taper*(1+muscle+joint);
  // Elliptical, rounded cross sections. The shift bends the real mesh;
  // each endpoint remains fixed at its old successful bind pose.
  const ovalU=upper?1.09:1.10,ovalV=upper?.90:.93;
  const bendY=upper?.029*arc:0;
  const bendX=upper?0:sign*.018*arc;
  const bendZ=(upper?.017:.024)*arc;
  for(let j=0;j<stride;j++){
   const i=row*stride+j;
   radial.set(position.getX(i)-center.x,
    position.getY(i)-center.y,position.getZ(i)-center.z);
   const grain=detail==='low'?1:
    1+.009*Math.sin(t*22+j*2*Math.PI/(stride-1)*5)*arc;
   const ru=radial.dot(u)*shape*ovalU*grain;
   const rv=radial.dot(v)*shape*ovalV*grain;
   position.setXYZ(i,
    center.x+u.x*ru+v.x*rv+bendX,
    center.y+u.y*ru+v.y*rv+bendY,
    center.z+u.z*ru+v.z*rv+bendZ);
  }
 }
 position.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 mesh.userData.m019ContouredVisibleBridge=true;
 mesh.userData.m019MuscleProfile=upper?'shoulder-elbow':'knee-ankle';
 mesh.userData.m019BridgeRingCount=rings;
 mesh.userData.m019NoAdditionalDrawCalls=true;
 mesh.userData.m019EllipticalAnatomicalSections=true;
 return mesh;
}
/**
 * m019's four legs use a conventional, WebGL-compatible Mesh.
 * Mobile GPUs rendered v9's SkinnedMesh as invisible even while CPU
 * applyBoneTransform() returned correct joint locations. The continuous
 * tube stays in shoulder-local space; its LOWER vertices are bent around
 * the real elbow/knee pivot on every animation update. This keeps a single
 * closed visible surface without GPU skinning, joints cut-outs or black posts.
 */
export function sculptM019Limb(g,leg,distal,name,{fore=true,side=1,detail='high'}={}){
 const sign=side<0?-1:1,z=fore?-.012:.022;
 const kneeX=sign*M019_SPRAWL_KNEE_X,kneeY=M019_SPRAWL_KNEE_Y;
 // The V16 oriented bridge was actually visible on mobile. In V17 both
 // that bridge AND a CPU-deformed tube drew over each other, producing
 // four doubled rectangular limbs. Use exactly ONE visible mesh per bone
 // segment and preserve the real shoulder/knee parents and foot coordinates.
 const quality={
  longitudinalSegments:detail==='low'?12:24,
  radialSegments:detail==='low'?10:16
 };
 const upper=g.bridge(leg,'light',
   [0,.090,z],[kneeX,kneeY,z],fore?.167:.177,fore?.129:.136,quality);
 contourM019StableBridge(upper,
   [0,.090,z],[kneeX,kneeY,z],{region:'upper',side,detail});
 upper.name='m019-mobile-upper-'+name;
 upper.userData.m019IndependentVisibleCore=true;
 upper.userData.m019ArticulatedParent='shoulder';
 upper.userData.m019StableVisibleBridge=true;
 upper.userData.m019LastRenderedGeometry='v13-oriented-bridge';
 upper.userData.m019SingleVisibleAnatomicalShell=true;
 upper.frustumCulled=false;
 upper.receiveShadow=false;
 const shin=g.bridge(distal,'light',
   [0,.055,0],[0,M019_SPRAWL_FOOT_Y,.095],
   fore?.131:.139,fore?.091:.096,quality);
 contourM019StableBridge(shin,
   [0,.055,0],[0,M019_SPRAWL_FOOT_Y,.095],
   {region:'shin',side,detail});
 shin.name='m019-mobile-shin-'+name;
 shin.userData.m019IndependentVisibleCore=true;
 shin.userData.m019ArticulatedParent='knee';
 shin.userData.m019StableVisibleBridge=true;
 shin.userData.m019LastRenderedGeometry='v13-oriented-bridge';
 shin.userData.m019SingleVisibleAnatomicalShell=true;
 shin.frustumCulled=false;
 shin.receiveShadow=false;
 // No second deforming muscle tube, shin post, luminous floating rod,
 // disconnected knee sphere or duplicated mobile shell.
 g.root.userData.m019VisibleLimbSegmentCount=
   (g.root.userData.m019VisibleLimbSegmentCount||0)+2;
 return {upper,lower:shin};
}

/**
 * Four low, weight-bearing volcanic toes with genuine curved keratin tips.
 * All parts follow the existing animated ankle pivot; no floating generic
 * cone nails, chalk-white claws or GPU-dependent foot skin. Low LOD keeps
 * real fingers and curved talons, only omitting extra surface fissures.
 */
export function sculptM019Paw(g,distal,name,{side=1,detail='high'}={}){
 const sign=side<0?-1:1;
 const toe=g.group('toe'+name,
  [sign*M019_SPRAWL_FOOT_X,M019_SPRAWL_FOOT_Y,.105],distal);
 toe.userData.m019PlantedToeJoint=true;
 toe.userData.m019SprawledOutward=true;
 toe.userData.m019RightAngleGrounding=true;
 toe.userData.m019ToeCount=4;
 toe.userData.m019PawFinish='basalt-scutes-with-rooted-curved-keratin';
 // Flatten the EXISTING paw skin against the ground and widen the toe
 // socket. No independent foot overlay that could float during animation.
 g.sphere(toe,'skin',[0,-.020,.052],[.115,.035,.131],
   {name:'m019-metatarsal-'+name,rough:.92});
 // The narrow dark scutes intersect the dorsal skin instead of floating
 // above it. Do not add these extra draw calls in low/crowd LOD.
 if(detail!=='low')for(let scute=0;scute<3;scute++){
  const rock=g.rock(toe,'shadow',
    [(scute-1)*.056,.015,.026+(.5-Math.abs(scute-1))*.020],
    [.027,.010,.038],
    {name:'m019-rooted-paw-scute-'+name+'-'+scute,rough:.94});
  rock.userData.m019RootedBasaltScute=true;
 }
 for(let digit=0;digit<4;digit++){
  const x=(digit-1.5)*.050;
  const spread=(digit-1.5)*.020+sign*.006;
  // Round finger skin runs *inside* the central footpad and continues
  // underneath the talon root, so nothing looks like a glued-on stick.
  const finger=g.tube(toe,'skin',[
   [x*.66,-.013,.058],
   [x,-.013,.107],
   [x+spread*.25,-.018,.146],
   [x+spread*.40,-.025,.184]
  ],detail==='low'?.022:.029,{
   name:'m019-digit-'+name+'-'+digit,capEnds:true,taper:.70
  });
  finger.userData.m019ContinuousBasaltDigit=true;
  const root=[x+spread*.22,-.008,.155];
  const elbow=[x+spread*.55,.009,.215];
  const tip=[x+spread,-.052,.255];
  const claw=g.curvedHorn(toe,'bone',root,elbow,tip,
   detail==='low'?.017:.021,{
    name:'m019-rooted-claw-'+name+'-'+digit,rough:.83
   });
  claw.userData.m019CurvedKeratinTalon=true;
  claw.userData.m019EmbeddedInFinger=true;
  claw.userData.m019NaturalPigment='basalt-dark-bone';
  // A very short unlit heat fracture at the nail-bed only. No glowing
  // neon rod, detached socket or full-length orange cartoon outline.
  if(detail!=='low'){
   const seam=g.tube(toe,'accent',[
    [root[0],root[1]+.018,root[2]-.008],
    [root[0]+spread*.13,root[1]+.020,root[2]+.022],
    [root[0]+spread*.26,root[1]+.017,root[2]+.043]
   ],.003,{
    name:'m019-nail-bed-fissure-'+name+'-'+digit,glow:false
   });
   seam.userData.m019InsetHeatVein=true;
  }
 }
 return toe;
}

export function sculptM019TailTip(g,tailTip,{detail='high'}={}){
 const tip=g.axialLoft(tailTip,'skin',[
  {z:.180,y:-.016,rx:.040,ry:.037},
  {z:.080,y:-.012,rx:.039,ry:.036},
  {z:-.105,y:.022,rx:.033,ry:.030},
  {z:-.290,y:.108,rx:.024,ry:.024},
  {z:-.480,y:.302,rx:.015,ry:.016},
  {z:-.625,y:.526,rx:.004,ry:.006}
 ],{name:'m019-continuous-tail-tip',rough:.84,
    ribbing:.004,capEnds:true});
 tip.userData.m019ClosedTaperedTail=true;
 tip.userData.m019UpcurledTip=true;
 // A fine molten seam grows with the curved tail tip; no screen-space VFX.
 const seam=g.tube(tailTip,'accent',[
  [.014,.025,.080],[.010,.061,-.100],
  [.009,.137,-.280],[.007,.329,-.475],[.002,.532,-.610]
 ],detail==='low'?.005:.009,{
  name:'m019-molten-tail-tip',glow:detail!=='low'
 });
 seam.userData.m019SurfaceHeatChannel=true;
 return tip;
}
