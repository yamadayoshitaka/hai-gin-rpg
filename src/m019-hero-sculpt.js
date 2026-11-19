/**
 * m019's approved two-dimensional concept is the shape authority.
 * Keep m001 as a source of anatomical stations, NOT a visible wolf mask.
 * Every helper is exclusive to m019: the m016/m017 sibling lineage and
 * the m001 donor are intentionally untouched.
 */
export const M019_HERO_REVISION='m019-long-low-molten-salamander-v3-20261119';
export const M019_BODY_DROP=.315;
export const M019_TAIL_LENGTH=1.66;

/**
 * A broad, flat reptilian wedge: narrow rounded nostril end, pronounced
 * cheek ridges behind the eye, flattened frontal vault and long occiput.
 * This is a resculpt of ALL m001 skull source stations, not a second ball.
 */
export function m019HeroSkullRings(m001Rings){
 if(!Array.isArray(m001Rings)||m001Rings.length<10)
  throw Error('m019 requires unmodified m001 anatomical donor stations');
 return m001Rings.map((r,i)=>{
  const t=i/(m001Rings.length-1);
  const brow=Math.exp(-Math.pow((t-.45)/.26,2));
  return {
   z:r.z*(r.z>=0?1.60:1.28)+.055,
   y:r.y*.73-.041-.018*brow,
   rx:r.rx*(1.30+.18*brow)+.011*Math.sin(Math.PI*t),
   ry:r.ry*(.74+.08*brow)
  };
 });
}

export function m019HeroTorsoRings(referenceStations){
 if(!Array.isArray(referenceStations)||referenceStations.length<6)
  throw Error('m019 torso requires m001 physical donor stations');
 return referenceStations.map((p,i)=>{
  const t=i/(referenceStations.length-1);
  const chest=Math.exp(-Math.pow((t-.29)/.30,2));
  return {
   ...p,
   z:p.z*1.23,
   y:p.y-.015+.024*chest,
   rx:p.rx*(.98+.095*chest),
   ry:p.ry*(.82+.07*chest)
  };
 });
}

/** One uninterrupted wedge muzzle, without bulbous dog-like nose ball. */
export function sculptM019Muzzle(g,head){
 const snout=g.axialLoft(head,'skin',[
  {z:.825,y:-.165,rx:.034,ry:.036},
  {z:.795,y:-.155,rx:.099,ry:.072},
  {z:.720,y:-.141,rx:.154,ry:.085},
  {z:.600,y:-.116,rx:.188,ry:.103},
  {z:.460,y:-.091,rx:.214,ry:.123},
  {z:.275,y:-.044,rx:.246,ry:.139},
  {z:.110,y:-.016,rx:.260,ry:.143}
 ],{name:'m019-unbroken-salamander-muzzle',rough:.84,
    ribbing:.006,capEnds:true});
 snout.userData.m019ContinuousMuzzle=true;
 for(const side of [-1,1]){
  const s=side<0?'L':'R';
  // Delicately raised wedge cheek plate embedded in cranium.
  const cheek=g.bridge(head,'skin',
   [side*.205,-.038,.189],[side*.270,-.135,.424],.090,.035);
  cheek.name='m019-continuous-cheek-'+s;
  cheek.userData.m019CheekRooted=true;
  // Root of each nostril sits in the same muzzle. No dark dog nose.
  g.sphere(head,'shadow',[side*.095,-.132,.793],[.022,.013,.026],
    {name:'m019-nostril-vent-'+s,rough:.91});
 }
 return snout;
}

/** Tapered hinged mandible; no black oval or visible tongue ball. */
export function sculptM019Jaw(g,jaw){
 const mandible=g.axialLoft(jaw,'skin',[
  {z:.515,y:-.076,rx:.037,ry:.023},
  {z:.470,y:-.067,rx:.128,ry:.041},
  {z:.335,y:-.056,rx:.190,ry:.054},
  {z:.190,y:-.042,rx:.208,ry:.064},
  {z:.025,y:-.030,rx:.183,ry:.071},
  {z:-.120,y:-.008,rx:.087,ry:.055}
 ],{name:'m019-articulated-wide-mandible',rough:.85,
    ribbing:.003,capEnds:true});
 mandible.userData.m019MandibleRooted=true;
 for(const side of [-1,1]){
  const s=side<0?'L':'R';
  const gum=g.rootedSpike(jaw,'bone','skin',
    [side*.145,-.032,.397],
    [side*.143,.019,.453],.021,{name:'m019-lower-tusk-'+s});
  gum.tooth.userData.m019MovesWithJaw=true;
 }
 return mandible;
}

/** Compact muscular limb stations follow both original upper/lower pivots. */
export function sculptM019Limb(g,leg,distal,name,{fore=true,detail='high'}={}){
 const front=fore===true;
 const upper=g.limbLoft(leg,'skin',[
  {x:0,y:.52,z:front?.005:-.062,rx:.151,rz:.171},
  {x:0,y:.34,z:front?-.009:-.046,rx:.203,rz:.214},
  {x:0,y:.16,z:front?-.034:.048,rx:.186,rz:.181},
  {x:0,y:-.08,z:front?-.057:.092,rx:.146,rz:.146},
  {x:0,y:-.24,z:front?-.025:.066,rx:.111,rz:.117}
 ],{name:'m019-scaled-upper-limb-'+name});
 upper.userData.m019ContinuousLimb=true;
 const lower=g.limbLoft(distal,'skin',[
  {x:0,y:.15,z:front?-.039:.090,rx:.133,rz:.137},
  {x:0,y:.030,z:front?-.027:.082,rx:.150,rz:.142},
  {x:0,y:-.14,z:front?.014:.023,rx:.135,rz:.127},
  {x:0,y:-.30,z:front?.050:.035,rx:.117,rz:.115},
  {x:0,y:-.47,z:.060,rx:.122,rz:.122}
 ],{name:'m019-scaled-lower-limb-'+name});
 lower.userData.m019ContinuousLimb=true;
 if(detail!=='low'){
  // Overlap exactly around the actual elbow/knee hinge, not a free sphere.
  const sleeve=g.bridge(distal,'skin',[0,.137,.012],[0,-.045,.017],
    .149,.143);
  sleeve.name='m019-elbow-fascia-'+name;
 }
}

/** Four rooted toes, with short ivory talons rather than round hoof pads. */
export function sculptM019Paw(g,distal,name,{detail='high'}={}){
 const toe=g.group('toe'+name,[0,-.515,.107],distal);
 toe.userData.m019PlantedToeJoint=true;
 g.sphere(toe,'skin',[0,-.028,.061],[.162,.068,.180],
  {name:'m019-metatarsal-'+name,rough:.85});
 for(let digit=0;digit<4;digit++){
  const x=(digit-1.5)*.085;
  const from=[x,-.045,.176],tip=[x*1.13,-.091,.266];
  if(detail!=='low')
   g.sphere(toe,'skin',[x,-.033,.127],[.045,.043,.083],
    {name:'m019-digit-'+name+'-'+digit,rough:.80});
  g.rootedSpike(toe,'bone','skin',from,tip,.018,
    {name:'m019-rooted-claw-'+name+'-'+digit});
 }
 return toe;
}

export function sculptM019TailTip(g,tailTip){
 const tip=g.axialLoft(tailTip,'skin',[
  {z:.150,y:.004,rx:.058,ry:.057},
  {z:.070,y:.000,rx:.056,ry:.055},
  {z:-.130,y:-.015,rx:.044,ry:.043},
  {z:-.390,y:-.030,rx:.021,ry:.024},
  {z:-.570,y:-.034,rx:.006,ry:.008}
 ],{name:'m019-continuous-tail-tip',rough:.84,
    ribbing:.006,capEnds:true});
 tip.userData.m019ClosedTaperedTail=true;
 return tip;
}
