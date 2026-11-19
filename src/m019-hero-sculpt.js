/**
 * m019 — actual game mesh of the approved 2026-11-19 four-view concept:
 * long narrow lava lizard, tiny widely spaced planted limbs, whip-like
 * curled tail, two swept horns, thin sharp muzzle and amber slit eyes.
 *
 * This is a species-specific resculpt of the existing m001 stations.
 * Do not propagate the new ratios to m001, m016 or m017. No billboards.
 */
export const M019_HERO_REVISION='m019-approved-four-view-slender-lizard-v4-20261119';
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
   rx:r.rx*(.94+.13*brow)+.005*Math.sin(Math.PI*t),
   ry:r.ry*(.61+.045*brow)
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
  {z:1.000,y:-.176,rx:.025,ry:.027},
  {z:.969,y:-.171,rx:.073,ry:.048},
  {z:.890,y:-.162,rx:.108,ry:.060},
  {z:.766,y:-.139,rx:.139,ry:.077},
  {z:.610,y:-.111,rx:.176,ry:.089},
  {z:.432,y:-.065,rx:.200,ry:.115},
  {z:.195,y:-.013,rx:.219,ry:.127}
 ],{name:'m019-unbroken-salamander-muzzle',rough:.82,
   ribbing:.004,capEnds:true});
 snout.userData.m019ContinuousMuzzle=true;
 snout.userData.m019ApprovedLongLizardSnout=true;
 for(const side of [-1,1]){
  const s=side<0?'L':'R';
  const cheek=g.bridge(head,'skin',
    [side*.177,-.052,.202],[side*.216,-.126,.518],.070,.028);
  cheek.name='m019-continuous-cheek-'+s;
  cheek.userData.m019CheekRooted=true;
  g.sphere(head,'shadow',[side*.081,-.154,.967],
    [.017,.009,.022],{name:'m019-nostril-'+s,rough:.93});
 }
 return snout;
}

/** Slender mandible follows the jaw pivot and stays tucked in at rest. */
export function sculptM019Jaw(g,jaw){
 const mandible=g.axialLoft(jaw,'skin',[
  {z:.660,y:-.079,rx:.025,ry:.017},
  {z:.615,y:-.073,rx:.093,ry:.027},
  {z:.465,y:-.061,rx:.135,ry:.037},
  {z:.280,y:-.041,rx:.158,ry:.045},
  {z:.075,y:-.027,rx:.142,ry:.053},
  {z:-.125,y:-.003,rx:.075,ry:.041}
 ],{name:'m019-articulated-wide-mandible',rough:.84,
   ribbing:.002,capEnds:true});
 mandible.userData.m019MandibleRooted=true;
 for(const side of [-1,1]){
  const s=side<0?'L':'R';
  const fang=g.rootedSpike(jaw,'bone','skin',
    [side*.102,-.038,.505],[side*.103,.013,.560],.014,
    {name:'m019-lower-tusk-'+s});
  fang.tooth.userData.m019MovesWithJaw=true;
 }
 return mandible;
}

/** 4 insect-slim lizard limbs: complete but narrow upper/lower joint shells. */
export function sculptM019Limb(g,leg,distal,name,{fore=true,detail='high'}={}){
 const front=fore===true;
 const upper=g.limbLoft(leg,'skin',[
  {x:0,y:.49,z:front?-.011:-.053,rx:.086,rz:.102},
  {x:0,y:.32,z:front?-.003:-.050,rx:.112,rz:.121},
  {x:0,y:.13,z:front?-.036:.050,rx:.089,rz:.092},
  {x:0,y:-.08,z:front?-.052:.092,rx:.063,rz:.073},
  {x:0,y:-.25,z:front?-.012:.068,rx:.048,rz:.058}
 ],{name:'m019-scaled-upper-limb-'+name});
 upper.userData.m019ContinuousLimb=true;
 const lower=g.limbLoft(distal,'skin',[
  {x:0,y:.17,z:front?-.032:.071,rx:.065,rz:.075},
  {x:0,y:.035,z:front?-.016:.070,rx:.073,rz:.073},
  {x:0,y:-.12,z:front?.011:.024,rx:.065,rz:.061},
  {x:0,y:-.31,z:front?.048:.026,rx:.050,rz:.055},
  {x:0,y:-.50,z:.070,rx:.048,rz:.052}
 ],{name:'m019-scaled-lower-limb-'+name});
 lower.userData.m019ContinuousLimb=true;
 if(detail!=='low'){
  const sleeve=g.bridge(distal,'skin',
    [0,.107,.017],[0,-.071,.017],.065,.062);
  sleeve.name='m019-elbow-fascia-'+name;
 }
}

/** Four miniature outward-splayed lizard toes per planted paw. */
export function sculptM019Paw(g,distal,name,{detail='high'}={}){
 const toe=g.group('toe'+name,[0,-.515,.113],distal);
 toe.userData.m019PlantedToeJoint=true;
 g.sphere(toe,'skin',[0,-.027,.051],[.092,.034,.122],
   {name:'m019-metatarsal-'+name,rough:.88});
 for(let digit=0;digit<4;digit++){
  const x=(digit-1.5)*.050;
  const spread=(digit-1.5)*.017;
  if(detail!=='low')g.sphere(toe,'skin',[x,-.026,.125],
    [.025,.025,.069],
    {name:'m019-digit-'+name+'-'+digit,rough:.84});
  g.rootedSpike(toe,'bone','skin',
    [x,-.031,.159],[x+spread,-.061,.234],.012,
    {name:'m019-rooted-claw-'+name+'-'+digit});
 }
 return toe;
}

/** The long whip tip curls UP in side view, as in the approved sheet. */
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
