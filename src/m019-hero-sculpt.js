import * as THREE from 'three';

/**
 * m019 — actual game mesh of the approved 2026-11-19 four-view concept:
 * long narrow lava lizard, tiny widely spaced planted limbs, whip-like
 * curled tail, two swept horns, thin sharp muzzle and amber slit eyes.
 *
 * This is a species-specific resculpt of the existing m001 stations.
 * Do not propagate the new ratios to m001, m016 or m017. No billboards.
 */
export const M019_HERO_REVISION='m019-matched-basalt-anatomy-v14-20261120';
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
 * m019's four legs use a conventional, WebGL-compatible Mesh.
 * Mobile GPUs rendered v9's SkinnedMesh as invisible even while CPU
 * applyBoneTransform() returned correct joint locations. The continuous
 * tube stays in shoulder-local space; its LOWER vertices are bent around
 * the real elbow/knee pivot on every animation update. This keeps a single
 * closed visible surface without GPU skinning, joints cut-outs or black posts.
 */
export function sculptM019Limb(g,leg,distal,name,{fore=true,side=1,detail='high'}={}){
 const sign=side<0?-1:1;
 const z=fore?-.012:.022;
 const kneeX=sign*M019_SPRAWL_KNEE_X;
 const kneeY=M019_SPRAWL_KNEE_Y;
 const footY=kneeY+M019_SPRAWL_FOOT_Y;
 const points=[
  // Place muscle crest ABOVE the dark belly and project the elbow farther
  // outside the ribs. Previous centers were in silhouette shadow or hidden
  // by the near-black abdomen even though they cast long floor shadows.
  [0,.090,z],[sign*.145,.103,z+.012],
  [sign*.330,.136,z+.023],[sign*.555,.079,z+.020],
  [sign*.750,.015,z+.010],[kneeX,kneeY,z],
  [kneeX,kneeY-.135,z],[kneeX,kneeY-.305,z+.008],
  [kneeX,kneeY-.510,z+.032],[kneeX,footY,z+.095]
 ];
 const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const baseRadius=fore?.291:.318;
 // The medium-dark rocky shading makes real legs visible against the black
 // torso without introducing a glowing red or rubbery-looking arm surface.
 const skin=g.tube(leg,'skin',points,baseRadius,{
  name:'m019-seamless-skin-'+name,capEnds:true
 });
 const geometry=skin.geometry;
 const attr=geometry.getAttribute('position');
 const tubularSegments=geometry.parameters.tubularSegments;
 const radialSegments=geometry.parameters.radialSegments;
 const stride=radialSegments+1;
 const ringCount=tubularSegments+1;
 if(attr.count!==ringCount*stride+2)throw Error('m019 continuous muscle needs closed rings');
 const radiusScale=t=>{
  if(t<.16)return 1.08+.05*Math.sin(t/.16*Math.PI);
  if(t<.45)return 1.10-(t-.16)*.72;
  if(t<.63)return .8912-(t-.45)*1.30;
  if(t<.85)return .6572-(t-.63)*.57;
  return .5318-(t-.85)*.48;
 };
 const weight=new Float32Array(attr.count);
 const smooth=t=>{
  const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);
 };
 for(let row=0;row<ringCount;row++){
  const t=row/tubularSegments,center=path.getPointAt(t);
  const radius=radiusScale(t),kneeWeight=smooth((t-.365)/.20);
  for(let j=0;j<stride;j++){
   const i=row*stride+j;
   attr.setXYZ(i,
    center.x+(attr.getX(i)-center.x)*radius,
    center.y+(attr.getY(i)-center.y)*radius,
    center.z+(attr.getZ(i)-center.z)*radius);
   weight[i]=kneeWeight;
  }
 }
 weight[attr.count-1]=1; // closing cap follows ankle, not shoulder
 const rest=new Float32Array(attr.array);
 const inverseBind=new THREE.Matrix4().makeTranslation(-kneeX,-kneeY,-z);
 const transform=new THREE.Matrix4(),deformed=new THREE.Vector3();
 let lastX=NaN,lastY=NaN,lastZ=NaN;
 function refreshVisibleLimb(){
  if(lastX===distal.rotation.x&&lastY===distal.rotation.y&&lastZ===distal.rotation.z)
   return;
  lastX=distal.rotation.x;lastY=distal.rotation.y;lastZ=distal.rotation.z;
  // In shoulder-local coordinates: distal matrix * inverse(bind pose).
  // All trunk/shoulder movement comes from leg's actual world transform.
  distal.updateMatrix();
  transform.copy(distal.matrix).multiply(inverseBind);
  for(let i=0;i<weight.length;i++){
   const off=i*3,x=rest[off],y=rest[off+1],v=rest[off+2];
   const w=weight[i];
   if(w<=0){attr.setXYZ(i,x,y,v);continue;}
   deformed.set(x,y,v).applyMatrix4(transform);
   attr.setXYZ(i,x+(deformed.x-x)*w,
    y+(deformed.y-y)*w,v+(deformed.z-v)*w);
  }
  attr.needsUpdate=true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
 }
 skin.frustumCulled=false; // bounds are dynamic during gait
 skin.userData.m019RefreshVisibleLimb=refreshVisibleLimb;
 skin.userData.m019ContinuousLimb=true;
 skin.userData.m019TrueRoundLimb=true;
 skin.userData.m019CrossSectionsPerpendicularToAxis=true;
 skin.userData.m019WholeLegClosedSurface=true;
 skin.userData.m019GpuSkinningRemoved=true;
 skin.userData.m019VisibleLimbRenderer='cpu-deformed-tube';
 skin.userData.m019AboveFloorMuscleCrest=true;
 skin.userData.m019VisibleLimbRevision='v14-basalt-match';
 skin.userData.m019MuscleRadius=baseRadius;
 skin.userData.m019HorizontalThigh=true;
 skin.userData.m019VerticalShin=true;
 skin.userData.m019SprawledOutward=true;
 g.root.userData.m019VisibleLimbUpdaters??=[];
 g.root.userData.m019VisibleLimbUpdaters.push(refreshVisibleLimb);
 // Combat and inspection call the same update; this fallback also works if
 // another renderer changes joint rotations without calling our animation.
 skin.onBeforeRender=refreshVisibleLimb;
 refreshVisibleLimb();
 // Small partly buried fissures; no detached long luminous rods.
 const veins=detail==='low'?1:2;
 for(let vein=0;vein<veins;vein++){
  const offset=vein*.024;
  const fissure=g.tube(leg,'accent',[
   [sign*.088,.310-offset,z+.017],
   [sign*.177,.343-offset,z+.043],
   [sign*.283,.361-offset,z+.020],
   [sign*.393,.328-offset,z+.035]
  ],detail==='low'?.0045:.0065,{
   name:'m019-limb-molten-crack-'+name+'-'+vein,
   glow:detail!=='low'
  });
  fissure.userData.m019MoltenFissure=true;
  fissure.userData.m019InsetHeatVein=true;
 }

 // Mobile fallback must match the torso: round curved muscles in dark
 // basalt, NOT the v12 straight brown bridging cylinders. Both parts are
 // immutable meshes, while shoulder/knee pivots retain natural articulation.
 const visibleUpper=g.tube(leg,'skin',[
   [0,.085,z],[sign*.160,.121,z+.014],
   [sign*.342,.138,z+.025],[sign*.550,.082,z+.018],
   [sign*.755,.008,z+.009],[kneeX,kneeY,z]
 ],.168,{
   name:'m019-mobile-upper-'+name,capEnds:true,taper:.75,
   tubularSegments:detail==='low'?14:24,
   radialSegments:detail==='low'?10:12
 });
 visibleUpper.userData.m019IndependentVisibleCore=true;
 visibleUpper.userData.m019ArticulatedParent='shoulder';
 visibleUpper.userData.m019CurvedAnatomicalFallback=true;
 const visibleShin=g.tube(distal,'skin',[
   [0,.055,0],[sign*.024,-.075,.009],
   [sign*.039,-.275,.029],[sign*.029,-.500,.062],
   [0,M019_SPRAWL_FOOT_Y,.095]
 ],.128,{
   name:'m019-mobile-shin-'+name,capEnds:true,taper:.66,
   tubularSegments:detail==='low'?14:24,
   radialSegments:detail==='low'?10:12
 });
 visibleShin.userData.m019IndependentVisibleCore=true;
 visibleShin.userData.m019ArticulatedParent='knee';
 visibleShin.userData.m019CurvedAnatomicalFallback=true;
 // The near LOD has embedded scutes matching the torso's basalt surface.
 // Low LOD draws no extra plates; 50x50 and 1000x1000 stay affordable.
 if(detail!=='low'){
   for(const [i,x,y] of [[0,.32,.276],[1,.59,.224]]){
     const plate=g.rock(leg,'shadow',
       [sign*x,y,z+.015],[.061,.015,.057],{
         name:'m019-embedded-arm-scute-'+name+'-'+i,rough:.96
       });
     plate.userData.m019EmbeddedBasaltLimbScute=true;
   }
   for(let i=0;i<2;i++){
     const plate=g.rock(distal,'shadow',
       [sign*.024,-.216-i*.225,.135+i*.012],
       [.052,.067,.014],{
         name:'m019-embedded-shin-scute-'+name+'-'+i,rough:.96
       });
     plate.userData.m019EmbeddedBasaltLimbScute=true;
   }
 }
 return {upper:skin,lower:skin,mobileUpper:visibleUpper,mobileShin:visibleShin};
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
 g.sphere(toe,'skin',[0,-.016,.048],[.109,.041,.127],
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
   [x*.70,-.012,.060],
   [x,-.013,.107],
   [x+spread*.25,-.018,.146],
   [x+spread*.40,-.025,.184]
  ],detail==='low'?.021:.027,{
   name:'m019-digit-'+name+'-'+digit,capEnds:true,taper:.65
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
