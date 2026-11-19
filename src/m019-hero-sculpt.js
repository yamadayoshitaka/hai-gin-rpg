import * as THREE from 'three';

/**
 * m019 — actual game mesh of the approved 2026-11-19 four-view concept:
 * long narrow lava lizard, tiny widely spaced planted limbs, whip-like
 * curled tail, two swept horns, thin sharp muzzle and amber slit eyes.
 *
 * This is a species-specific resculpt of the existing m001 stations.
 * Do not propagate the new ratios to m001, m016 or m017. No billboards.
 */
export const M019_HERO_REVISION='m019-seamless-two-bone-limb-v9-20261120';
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
export const M019_SPRAWL_KNEE_X=.68;
export const M019_SPRAWL_KNEE_Y=-.085;
export const M019_SPRAWL_FOOT_X=.007;
export const M019_SPRAWL_FOOT_Y=-.650;
export const M019_SHOULDER_LOCAL_Y=1.26;
/**
 * One real continuous skin covers shoulder -> elbow -> shin -> ankle.
 * Two bones (one bound to shoulder and one to knee) deform the SAME mesh,
 * so no disconnected black shin-post can exist at any gait frame.
 * Unlike v8, the glowing fissure is inset at the shoulder and cannot extend
 * past the solid muscle as a detached thin orange arm.
 */
export function sculptM019Limb(g,leg,distal,name,{fore=true,side=1,detail='high'}={}){
 const sign=side<0?-1:1;
 const z=fore?-.012:.022;
 const kneeX=sign*M019_SPRAWL_KNEE_X;
 const kneeY=M019_SPRAWL_KNEE_Y;
 const footY=kneeY+M019_SPRAWL_FOOT_Y;
 const points=[
  [0,.035,z], [sign*.090,.038,z+.012],
  [sign*.215,.028,z+.023], [sign*.370,-.004,z+.020],
  [sign*.535,-.050,z+.010], [kneeX,kneeY,z],
  [kneeX,kneeY-.120,z], [kneeX,kneeY-.270,z+.008],
  [kneeX,kneeY-.440,z+.032], [kneeX,footY,z+.095]
 ];
 const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const baseRadius=fore?.194:.210;
 const raw=g.tube(leg,'skin',points,baseRadius,{
  name:'m019-seamless-skin-'+name,capEnds:true
 });
 const geometry=raw.geometry;
 const attr=geometry.getAttribute('position');
 const tubularSegments=geometry.parameters.tubularSegments;
 const radialSegments=geometry.parameters.radialSegments;
 const stride=radialSegments+1;
 const ringCount=tubularSegments+1;
 const regularVertices=ringCount*stride;
 if(attr.count!==regularVertices+2)throw Error('m019 limb requires closed tube rings');
 // Gradual anatomical radius changes, never a cylinder or disconnected post.
 const radiusScale=t=>{
  if(t<.16)return 1.08+.05*Math.sin(t/.16*Math.PI);
  if(t<.45)return 1.08-(t-.16)*1.15;
  if(t<.63)return .7465-(t-.45)*1.14;
  if(t<.85)return .5413-(t-.63)*.33;
  return .4687-(t-.85)*.16;
 };
 const skinIndices=[],skinWeights=[];
 const smooth=t=>{
  const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);
 };
 for(let row=0;row<ringCount;row++){
  const t=row/tubularSegments,center=path.getPointAt(t);
  const radius=radiusScale(t);
  // Smooth skin weights cross the elbow. Both bones influence its rings,
  // rather than rigidly splitting upper muscle from the lower shin.
  const kneeWeight=smooth((t-.365)/.20);
  for(let j=0;j<stride;j++){
   const i=row*stride+j;
   attr.setXYZ(i,
    center.x+(attr.getX(i)-center.x)*radius,
    center.y+(attr.getY(i)-center.y)*radius,
    center.z+(attr.getZ(i)-center.z)*radius);
   skinIndices.push(0,1,0,0);
   skinWeights.push(1-kneeWeight,kneeWeight,0,0);
  }
 }
 // Cap centres are part of the very same mesh and follow the right bones.
 for(const w of [0,1]){
  skinIndices.push(0,1,0,0);
  skinWeights.push(1-w,w,0,0);
 }
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));
 attr.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const shoulderBone=new THREE.Bone();
 shoulderBone.name='m019-skin-shoulder-'+name;
 const elbowBone=new THREE.Bone();
 elbowBone.name='m019-skin-knee-'+name;
 leg.add(shoulderBone);
 distal.add(elbowBone);
 leg.remove(raw);
 const skin=new THREE.SkinnedMesh(geometry,raw.material);
 skin.name='m019-seamless-skin-'+name;
 skin.castShadow=true;skin.receiveShadow=true;skin.frustumCulled=false;
 skin.userData={...raw.userData,
  m019ContinuousLimb:true,m019TrueRoundLimb:true,
  m019CrossSectionsPerpendicularToAxis:true,
  m019WholeLegClosedSurface:true,m019SkinningBones:2,
  m019MuscleRadius:baseRadius,m019HorizontalThigh:true,
  m019VerticalShin:true,m019SprawledOutward:true};
 leg.add(skin);
 g.root.updateMatrixWorld(true);
 skin.bind(new THREE.Skeleton([shoulderBone,elbowBone]));
 // Heat stays on the proximal muscle, not a naked glowing stick from the
 // torso to a disconnected shin. Low LOD keeps one very short fissure.
 const veins=detail==='low'?1:2;
 for(let vein=0;vein<veins;vein++){
  const offset=vein*.024;
  const fissure=g.tube(leg,'accent',[
   [sign*.045,.235-offset,z+.017],
   [sign*.107,.232-offset,z+.043],
   [sign*.169,.217-offset,z+.020],
   [sign*.225,.189-offset,z+.035]
  ],detail==='low'?.0045:.0065,{
   name:'m019-limb-molten-crack-'+name+'-'+vein,
   glow:detail!=='low'
  });
  fissure.userData.m019MoltenFissure=true;
  fissure.userData.m019InsetHeatVein=true;
 }
 return {upper:skin,lower:skin};
}

/** Four narrow toes at the END of the vertical shin, not a free ankle. */
export function sculptM019Paw(g,distal,name,{side=1,detail='high'}={}){
 const sign=side<0?-1:1;
 const toe=g.group('toe'+name,
  [sign*M019_SPRAWL_FOOT_X,M019_SPRAWL_FOOT_Y,.105],distal);
 toe.userData.m019PlantedToeJoint=true;
 toe.userData.m019SprawledOutward=true;
 toe.userData.m019RightAngleGrounding=true;
 g.sphere(toe,'skin',[0,-.022,.038],[.095,.035,.115],
   {name:'m019-metatarsal-'+name,rough:.88});
 for(let digit=0;digit<4;digit++){
  const x=(digit-1.5)*.048;
  const spread=(digit-1.5)*.018+sign*.008;
  if(detail!=='low')g.sphere(toe,'skin',
    [x,-.022,.111],[.025,.027,.069],
    {name:'m019-digit-'+name+'-'+digit,rough:.84});
  g.rootedSpike(toe,'bone','skin',
    [x,-.027,.151],[x+spread,-.057,.223],.012,
    {name:'m019-rooted-claw-'+name+'-'+digit});
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
