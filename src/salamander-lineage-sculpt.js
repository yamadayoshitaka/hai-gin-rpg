/**
 * m016 / m017 / m019: shared anatomical salamander source.
 *
 * m019 is the owner-approved lava salamander. m016 and m017 inherit its
 * real m001-derived skull/ribcage topology, NOT its colours or identity.
 * Hydra (m018) and sea-serpent (m020) keep independent skeletons.
 * Every visible part belongs to an animated head, torso or tail pivot.
 */
import {magmaSkullFromWolfKing,magmaTorsoFromWolfKing,
 sculptMagmaSalamanderEye,sculptMagmaSalamanderHorn,
 sculptMagmaSalamanderBack} from './magma-salamander-sculpt.js?v=m019-matched-charcoal-limbs-v20-20261121';

export const SALAMANDER_LINEAGE_REVISION='m016-m017-salamander-surface-limbs-v21-20261121';
export const SALAMANDER_LINEAGE=Object.freeze({
 m016:Object.freeze({id:'m016',archetype:'swamp-salamander',headWidth:1.09,
  snoutLength:1.12,bodyWidth:.92,bodyDepth:.94,legReach:.76,
  bodyDrop:.18,tailLength:1.23,hornHeight:.48,crestHeight:.54}),
 m017:Object.freeze({id:'m017',archetype:'steel-basilisk',headWidth:.96,
  snoutLength:1.08,bodyWidth:1.10,bodyDepth:1.04,legReach:.70,
  bodyDrop:.20,tailLength:1.31,hornHeight:.83,crestHeight:.90}),
 m019:Object.freeze({id:'m019',archetype:'magma-salamander',headWidth:1,
  snoutLength:1,bodyWidth:1,bodyDepth:1,legReach:.54,
  bodyDrop:.38,tailLength:2.20,hornHeight:1,crestHeight:1})
});
export const salamanderLineageFor=id=>SALAMANDER_LINEAGE[id]||null;

/**
 * m016/m017 inherit m019's FOUR-LEG construction lessons without
 * inheriting m019's lava pigment or the m019-specific body silhouette.
 *
 * The original derivative drew a thigh ball, a second shin ball, a knee
 * sphere, another shoulder sphere and a fixed foot: detached stone sticks.
 * Instead give each animated shoulder and knee exactly one rounded oriented
 * bridge, plus a single attached toe pivot and small true curved claws.
 * No skinning, opacity masks, double-overlays or per-frame CPU updates.
 */
export function sculptSalamanderLineageLimb(g,leg,knee,name,{
 id='m016',side=1,fore=true,detail='high'
}={}){
 if(id!=='m016'&&id!=='m017')throw Error('Only derived four-leg salamanders');
 const variant=SALAMANDER_LINEAGE[id];
 const low=detail==='low',sign=side<0?-1:1;
 const z=fore?-.013:.023;
 const quality={
  longitudinalSegments:low?12:24,
  radialSegments:low?10:16
 };
 const upper=g.bridge(leg,'light',
  [0,.065,z],[sign*.235,-.43,z+.032],
  id==='m016'?.175:.187,id==='m016'?.126:.135,quality);
 upper.name=id+'-organic-upper-'+name;
 upper.frustumCulled=false;
 upper.receiveShadow=false;
 upper.userData.salamanderSingleVisibleLimb=true;
 upper.userData.salamanderAnatomy='shoulder-to-elbow';
 const shinLength=id==='m016'?.83:.93;
 const shin=g.bridge(knee,'light',
  [0,.035,0],[sign*.019,-shinLength,.098],
  id==='m016'?.132:.141,id==='m016'?.085:.090,quality);
 shin.name=id+'-organic-shin-'+name;
 shin.frustumCulled=false;
 shin.receiveShadow=false;
 shin.userData.salamanderSingleVisibleLimb=true;
 shin.userData.salamanderAnatomy='knee-to-ankle';
 const toe=g.group('toe'+name,[sign*.019,-shinLength,.098],knee);
 toe.userData.salamanderGroundedPaw=true;
 toe.userData.salamanderToeCount=low?3:4;
 toe.userData.salamanderSharedSurface=id;
 const pad=g.sphere(toe,'light',[0,-.022,.050],
  [id==='m016'?.143:.151,.043,.133],{
   name:id+'-organic-metatarsal-'+name,rough:id==='m016'?.82:.77
  });
 pad.userData.salamanderAnatomicalFootpad=true;
 const count=toe.userData.salamanderToeCount;
 for(let digit=0;digit<count;digit++){
  const x=(digit-(count-1)/2)*(low?.061:.053);
  const spread=x*.23;
  const finger=g.tube(toe,'light',[
   [x*.68,-.022,.050],[x,-.026,.101],
   [x+spread*.3,-.029,.149],[x+spread,-.040,.183]
  ],low?.023:.027,{
   name:id+'-organic-digit-'+name+'-'+digit,
   capEnds:true,taper:.74
  });
  finger.userData.salamanderContinuousDigit=true;
  const root=[x+spread*.3,-.009,.153];
  const mid=[x+spread*.7,.005,.206];
  const tip=[x+spread*1.2,-.049,.252];
  const claw=g.curvedHorn(toe,'bone',root,mid,tip,
   low?.017:.019,{
    name:id+'-rooted-claw-'+name+'-'+digit,
    rough:id==='m016'?.83:.66
   });
  claw.userData.salamanderRootedClaw=true;
 }
 leg.userData.salamanderDerivedPhysicalLimbs=true;
 leg.userData.salamanderDerivative=id;
 g.root.userData.salamanderVisibleLimbSegments=
   (g.root.userData.salamanderVisibleLimbSegments||0)+2;
 g.root.userData.salamanderWearingSpeciesSkin=id;
 return {upper,shin,toe};
}


/** Morph all eleven canonical cranium sections; do not mutate the donor. */
export function salamanderSkullFromMagma(m001Rings,id){
 const variant=salamanderLineageFor(id);
 if(!variant)throw Error('Unsupported salamander source: '+id);
 return magmaSkullFromWolfKing(m001Rings).map(p=>({
  ...p,z:p.z*variant.snoutLength,
  rx:p.rx*variant.headWidth,
  ry:p.ry*(id==='m016'?1.04:id==='m017'?.96:1)
 }));
}

/** Retain the source-derived shoulder -> ribs -> pelvis contour. */
export function salamanderTorsoFromMagma(stations,id){
 const variant=salamanderLineageFor(id);
 if(!variant)throw Error('Unsupported salamander torso: '+id);
 return magmaTorsoFromWolfKing(stations).map(p=>({
  ...p,rx:p.rx*variant.bodyWidth,ry:p.ry*variant.bodyDepth
 }));
}

export function sculptSalamanderLineageEye(g,head,side,{
 id='m019',detail='high'
}={}){
 if(id==='m019')return sculptMagmaSalamanderEye(g,head,side,{detail});
 if(!salamanderLineageFor(id))throw Error('Unsupported salamander eye '+id);
 const suffix=side<0?'L':'R';
 const x=id==='m016'?.315:.307;
 // The socket, iris, vertical pupil, brow and blinking membrane all share
 // the animated head parent; do not position them in world coordinates.
 g.sphere(head,'shadow',[side*x,.088,.330],[.078,.050,.089],
  {name:id+'-inset-orbit-'+suffix,rough:.87});
 g.sphere(head,'eye',[side*(x+.024),.090,.349],[.040,.042,.047],
  {name:id+'-iris-'+suffix,rough:.29});
 g.sphere(head,'shadow',[side*(x+.063),.090,.365],[.006,.032,.014],
  {name:id+'-vertical-pupil-'+suffix,rough:.25});
 g.sphere(head,'skin',[side*(x-.010),.152,.319],[.103,.033,.110],
  {name:id+'-upper-eyelid-'+suffix,rough:.77});
 g.sphere(head,'skin',[side*(x-.006),.026,.326],[.088,.024,.095],
  {name:id+'-lower-eyelid-'+suffix,rough:.79});
 const lid=g.group('eyelid'+suffix,[side*(x+.020),.177,.338],head);
 lid.userData.restY=lid.position.y;
 lid.userData.blinkTravel=.070;
 g.sphere(lid,'skin',[0,0,0],[.066,.018,.061],
  {name:id+'-nictitating-lid-'+suffix,rough:.78});
}

export function sculptSalamanderLineageHorn(g,head,side,{
 id='m019',detail='high'
}={}){
 if(id==='m019')return sculptMagmaSalamanderHorn(g,head,side,{detail});
 const spec=salamanderLineageFor(id);
 if(!spec)throw Error('Unsupported salamander horn '+id);
 const suffix=side<0?'L':'R',height=spec.hornHeight;
 const base=[side*.232,.220,-.177];
 // No separate non-embedded spear cones or floating horn rings.
 g.sphere(head,'skin',[side*.238,.210,-.170],
  [.144,.133,.173],{name:id+'-horn-root-'+suffix});
 const horn=g.curvedHorn(head,id==='m016'?'skin':'bone',
  base,[side*(.29+.040*height),.24+.335*height,-.231],
  [side*(.32+.138*height),.22+.765*height,-.33*height],
  id==='m016'?.077:.117,{name:id+'-grand-horn-'+suffix});
 horn.userData.salamanderLineageRootedHorn=true;
 if(detail==='low')return;
 g.curvedHorn(head,id==='m016'?'skin':'bone',
  [side*.312,-.091,.121],[side*.419,-.031,.156],
  [side*.484,.006,.111],id==='m016'?.037:.053,
  {name:id+'-cheek-tusk-'+suffix});
}

export function sculptSalamanderLineageBack(g,torso,{
 id='m019',detail='high'
}={}){
 if(id==='m019')return sculptMagmaSalamanderBack(g,torso,{detail});
 const spec=salamanderLineageFor(id);
 if(!spec)throw Error('Unsupported salamander ridge '+id);
 const low=detail==='low',count=low?4:detail==='source'?12:8;
 for(let i=0;i<count;i++){
  const t=(i+.45)/count,z=.56-1.12*t;
  const height=spec.crestHeight*(.16+.19*Math.sin(Math.PI*t));
  const base=[0,1.56-.08*t,z];
  const horn=g.curvedHorn(torso,id==='m016'?'skin':'bone',
   base,[0,base[1]+height*.48,z-.040],
   [.017*(i%2?1:-1),base[1]+height,z-.133],
   .055+(id==='m017'?.016:.004),
   {name:id+'-rooted-dorsal-crest-'+i});
  horn.userData.salamanderRootedDorsalCrest=true;
 }
 if(low)return;
 // The m017 stone armour is grown from the torso, not a floating vest.
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const z=.33-i*.25;
  g.sphere(torso,id==='m017'?'shadow':'skin',
   [side*(id==='m017'?.522:.455),1.30,z],
   [.068,.112,.144],{name:id+'-flank-scute-'+(side<0?'L':'R')+'-'+i,
    rough:id==='m017'?.65:.88});
 }
}

/** Reconstruct sculpted scales, nasal openings and throat folds on source LODs. */
export function sculptSalamanderSurface(g,torso,head,{
 id='m019',detail='high'
}={}){
 if(detail==='low')return;
 // m019 has its own continuous muzzle, deep-set sockets and fine basalt
 // plates. Never layer generic cheek marbles and black circular freckles
 // over the owner-approved low and long salamander silhouette.
 if(id==='m019'){
  const throat=g.bridge(head,'skin',
   [0,-.137,-.205],[0,-.238,-.475],.116,.103);
  throat.name='m019-head-anchored-throat';
  throat.userData.salamanderHeadFollowingNeck=true;
  for(const side of [-1,1]){
   const suffix=side<0?'L':'R';
   g.tube(head,'shadow',[
    [side*.152,-.187,.494],
    [side*.176,-.192,.295],
    [side*.192,-.153,.107]
   ],.007,{name:'m019-fitted-labial-seam-'+suffix});
   // Sparse, shallow anatomical scale plates, not the old scattered
   // spherical bumps. Retain the existing species QA coverage labels.
   for(let i=0;i<3;i++){
    const z=.60-i*.47;
    const plate=g.rock(torso,'shadow',
      [side*.265,1.287,z],[.034,.014,.096],
      {name:'m019-embedded-scale-'+suffix+'-'+i,rough:.93});
    plate.userData.m019FittedScale=true;
   }
  }
  return;
 }
 const spec=salamanderLineageFor(id);
 if(!spec)throw Error('Unsupported salamander skin '+id);
 const count=detail==='source'?10:6;
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  // Visible nostrils with a dark interior (no canine rhinarium).
  g.sphere(head,'shadow',[side*.110,-.151,.805],
   [.022,.011,.021],{rough:.92,name:id+'-nostril-'+suffix});
  g.sphere(head,'skin',[side*.138,-.032,.061],
   [.108,.083,.130],{rough:.90,name:id+'-zygomatic-'+suffix});
  // All plates are shallow, embedded and parented to the ribcage.
  for(let i=0;i<count;i++){
   const z=.47-i*(.93/(count-1));
   const x=(id==='m017'?.505:id==='m016'?.433:.468)*
    (1-.075*Math.abs(z));
   const y=1.29+(i%2)*.105;
   g.sphere(torso,id==='m019'?'shadow':id==='m017'?'light':'skin',
    [side*x,y,z],[.040,.054,.067],
    {rough:id==='m016'?.90:.72,
     name:id+'-embedded-scale-'+suffix+'-'+i});
   if(id==='m019'&&i%2===0)
    g.tube(torso,'accent',[
     [side*(x+.022),y+.031,z-.026],
     [side*(x+.038),y-.008,z+.019]],.008,
     {name:id+'-glowing-fissure-'+suffix+'-'+i});
  }
 }
 // A folded throat connects head to neck, not a free-standing chin ball.
 const throat=g.bridge(head,'skin',
  [0,-.155,-.120],[0,-.270,-.380],.185,.156);
 throat.name=id+'-head-anchored-throat';
 throat.userData.salamanderHeadFollowingNeck=true;
}

export function markSalamanderLineage(root,id){
 const spec=salamanderLineageFor(id);
 if(!spec)return false;
 root.userData.salamanderLineageRevision=SALAMANDER_LINEAGE_REVISION;
 root.userData.salamanderSourceSpecies='m019';
 root.userData.salamanderAnatomy=spec.archetype;
 root.userData.salamanderDonorMethod='m019-morph-of-m001-cranium-and-ribcage';
 root.userData.salamanderConnectedLimbs=4;
 root.userData.salamanderLegReach=spec.legReach;
 root.userData.salamanderTailLength=spec.tailLength;
 root.userData.salamanderDorsalPlatesFollowTorso=true;
 root.userData.salamanderSourceAuthoring='procedural-physical-3d-not-external-glb';
 return true;
}
