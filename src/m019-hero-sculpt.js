/**
 * m019 — actual game mesh of the approved 2026-11-19 four-view concept:
 * long narrow lava lizard, tiny widely spaced planted limbs, whip-like
 * curled tail, two swept horns, thin sharp muzzle and amber slit eyes.
 *
 * This is a species-specific resculpt of the existing m001 stations.
 * Do not propagate the new ratios to m001, m016 or m017. No billboards.
 */
export const M019_HERO_REVISION='m019-lateral-lizard-elbow90-narrowhead-v6-20261120';
export const M019_BODY_DROP=.38;
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
   rx:r.rx*(.70+.105*brow)+.003*Math.sin(Math.PI*t),
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
  {z:1.000,y:-.176,rx:.019,ry:.024},
  {z:.969,y:-.171,rx:.053,ry:.043},
  {z:.890,y:-.162,rx:.081,ry:.056},
  {z:.766,y:-.139,rx:.104,ry:.072},
  {z:.610,y:-.111,rx:.132,ry:.083},
  {z:.432,y:-.065,rx:.153,ry:.111},
  {z:.195,y:-.013,rx:.169,ry:.122}
 ],{name:'m019-unbroken-salamander-muzzle',rough:.82,
   ribbing:.004,capEnds:true});
 snout.userData.m019ContinuousMuzzle=true;
 snout.userData.m019ApprovedLongLizardSnout=true;
 for(const side of [-1,1]){
  const s=side<0?'L':'R';
  const cheek=g.bridge(head,'skin',
    [side*.138,-.052,.202],[side*.166,-.126,.518],.055,.023);
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
  {z:.465,y:-.061,rx:.105,ry:.036},
  {z:.280,y:-.041,rx:.122,ry:.043},
  {z:.075,y:-.027,rx:.110,ry:.051},
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
 * leg scale remains (0.66, 0.54, 0.66); nothing is repositioned per frame.
 */
export const M019_SPRAWL_KNEE_X=.68;
export const M019_SPRAWL_KNEE_Y=-.085;
export const M019_SPRAWL_FOOT_X=.007;
export const M019_SPRAWL_FOOT_Y=-1.515;
export const M019_SHOULDER_LOCAL_Y=1.26;
export function sculptM019Limb(g,leg,distal,name,{fore=true,side=1,detail='high'}={}){
 const sign=side<0?-1:1;
 const z=fore?-.012:.022;
 // The root is at the limb pivot, buried in the torso sidewall.
 // The round socket stays covered even during leg swing.
 const upper=g.limbLoft(leg,'skin',[
  {x:0,y:.043,z,rx:.118,rz:.131},
  {x:sign*.105,y:.016,z,rx:.110,rz:.116},
  {x:sign*.310,y:-.011,z,rx:.086,rz:.093},
  {x:sign*.520,y:-.046,z,rx:.065,rz:.073},
  {x:sign*M019_SPRAWL_KNEE_X,y:M019_SPRAWL_KNEE_Y,z,
   rx:.075,rz:.078}
 ],{name:'m019-scaled-upper-limb-'+name});
 upper.userData.m019ContinuousLimb=true;
 upper.userData.m019HorizontalThigh=true;
 upper.userData.m019SprawledOutward=true;
 // Knee joint is exactly the upper tip; overlapping first and last rings
 // make the seam tolerant of a small walk / run rotation.
 const lower=g.limbLoft(distal,'skin',[
  {x:0,y:.058,z,rx:.074,rz:.078},
  {x:0,y:-.070,z,rx:.076,rz:.081},
  {x:sign*.006,y:-.30,z,rx:.067,rz:.070},
  {x:sign*.010,y:-.80,z,rx:.056,rz:.062},
  {x:sign*M019_SPRAWL_FOOT_X,y:M019_SPRAWL_FOOT_Y,z,
   rx:.046,rz:.052}
 ],{name:'m019-scaled-lower-limb-'+name});
 lower.userData.m019ContinuousLimb=true;
 lower.userData.m019VerticalShin=true;
 lower.userData.m019SprawledOutward=true;
 // A physical skin overlap at the hinge rotates with the distal bone.
 if(detail!=='low'){
  const fascia=g.bridge(distal,'skin',
   [0,.065,z],[0,-.105,z],.081,.075);
  fascia.name='m019-elbow-fascia-'+name;
 }
 return {upper,lower};
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

export function sculptM019TailTip(g,tailTip){
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
 return tip;
}
