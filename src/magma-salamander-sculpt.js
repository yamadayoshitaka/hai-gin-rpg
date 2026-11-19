/**
 * m019 Lava Salamander — owner-approved 2D design, 2026-11-18.
 * The physical head cross-sections and body stations derive from m001.
 * This is NOT a wolf with red fur: keratin horns, inset slit eyes, lava
 * armour, short planted reptile limbs and the native reptile animation
 * retain an independently recognizable salamander silhouette.
 *
 * All pieces attach to existing movable parents. No floating decoration,
 * no replacement of another species, no expensive effect sprites at LOD low.
 */
export const MAGMA_SALAMANDER_REVISION='m019-lateral-lizard-elbow90-narrowhead-v6-20261120';
export const MAGMA_SALAMANDER_LEG_REACH=.54;
export const MAGMA_SALAMANDER_BODY_DROP=.38;

export function magmaSkullFromWolfKing(m001Rings){
 if(!Array.isArray(m001Rings)||m001Rings.length<8)
  throw Error('m019 must use the m001 physical cranial donor rings');
 return m001Rings.map(r=>({
  z:r.z*(r.z>=0?1.38:1.06)+.028,
  y:r.y*.94-.035,
  rx:r.rx*(r.z>=0?1.20:1.47),
  ry:r.ry*(r.z>=0?1.07:1.21)
 }));
}

export function magmaTorsoFromWolfKing(referenceStations){
 if(!Array.isArray(referenceStations)||referenceStations.length<6)
  throw Error('m019 requires full m001 anatomical torso stations');
 // Broad rib cage and heavy haunches, not stretched cylinders.
 return referenceStations.map((p,i)=>({
  ...p,rx:p.rx*(i<3?1.06:1.12),ry:p.ry*(i<5?1.20:1.13)
 }));
}

export function sculptMagmaSalamanderEye(g,head,side,{detail='high'}={}){
 const suffix=side<0?'L':'R';
 // Reference front/side: small eye tucked into a narrow angular socket,
 // not a big glowing marble hovering outside the thin skull.
 const orbit=g.sphere(head,'shadow',[side*.210,.047,.271],
   [.044,.034,.082],{name:'m019-inset-orbit-'+suffix,rough:.91});
 orbit.userData.m019EyeRecessed=true;
 const iris=g.sphere(head,'eye',[side*.230,.053,.290],
   [.011,.027,.042],{name:'m019-amber-iris-'+suffix,rough:.22});
 iris.userData.m019PredatorSlit=true;
 g.sphere(head,'accent',[side*.238,.055,.295],
   [.004,.019,.020],{name:'m019-glowing-iris-'+suffix,
    glow:detail==='source'});
 g.sphere(head,'shadow',[side*.244,.051,.299],
   [.0035,.021,.012],{name:'m019-vertical-pupil-'+suffix});
 g.sphere(head,'bone',[side*.246,.069,.299],
   [.002,.004,.004],{name:'m019-eye-glint-'+suffix});
 const brow=g.tube(head,'skin',[
   [side*.165,.115,.394],[side*.215,.122,.317],
   [side*.235,.095,.239],[side*.213,.082,.159]
 ],.016,{name:'m019-predator-brow-'+suffix});
 brow.userData.m019BoneBrow=true;
 g.tube(head,'shadow',[
   [side*.192,.011,.360],[side*.226,.017,.299],
   [side*.229,.028,.233]
 ],.0075,{name:'m019-lower-lid-'+suffix});
 const lid=g.group('eyelid'+suffix,[side*.226,.123,.288],head);
 lid.userData.restY=lid.position.y;
 lid.userData.blinkTravel=.058;
 g.sphere(lid,'skin',[0,0,0],[.029,.010,.039],
   {name:'m019-nictitating-lid-'+suffix,rough:.85});
}

export function sculptMagmaSalamanderHorn(g,head,side,{detail='high'}={}){
 const suffix=side<0?'L':'R';
 // Two long slender swept-back crescents from the approved turnaround.
 // The tip points over the neck, not vertically up like buffalo horns.
 const socket=g.bridge(head,'skin',
   [side*.118,.090,-.167],[side*.168,.192,-.297],.070,.044);
 socket.name='m019-horn-cartilage-'+suffix;
 const horn=g.curvedHorn(head,'bone',
   [side*.155,.176,-.233],
   [side*.221,.365,-.610],
   [side*.313,.586,-1.260],.071,
   {name:'m019-grand-horn-'+suffix});
 horn.userData.m019PrimaryHorn=true;
 horn.userData.m019SweptBackward=true;
 horn.userData.m019ApprovedTurnaroundReference=true;
 if(detail==='low')return;
 g.curvedHorn(head,'accent',
   [side*.163,.184,-.255],[side*.210,.332,-.615],
   [side*.307,.565,-1.225],.018,
   {name:'m019-horn-magma-seam-'+suffix});
}

export function sculptMagmaSalamanderBack(g,torso,{detail='high'}={}){
 const count=detail==='low'?6:detail==='source'?17:11;
 // Thin shallow spikes across the elongated spine; never a thick
 // dinosaur's armored hump. Roots stay within the dorsal loft.
 for(let i=0;i<count;i++){
  const t=(i+.4)/count,z=1.25-2.55*t;
  const rootY=1.485-.040*t;
  const height=.080+.085*Math.pow(Math.sin(Math.PI*t),1.5);
  const horn=g.curvedHorn(torso,'shadow',
   [0,rootY,z],[.006,rootY+height*.55,z-.048],
   [.015,rootY+height,z-.145],.024,
   {name:'m019-lava-ridge-'+i});
  horn.userData.m019RootedDorsalCrest=true;
 }
 if(detail==='low')return;
 for(const side of [-1,1])for(let i=0;i<7;i++){
  const s=side<0?'L':'R',z=1.08-i*.346;
  const plate=g.rock(torso,'shadow',
   [side*.254,1.290,z],[.039,.021,.107],
   {name:'m019-basalt-scute-'+s+'-'+i,rough:.91});
  plate.userData.m019EmbeddedScale=true;
  if(i%2===0)g.tube(torso,'accent',[
    [side*.278,1.317,z-.077],
    [side*.280,1.281,z-.004],
    [side*.270,1.257,z+.075]
  ],.0065,{name:'m019-lava-fissure-'+s+'-'+i});
 }
}

export function markMagmaSalamander(root){
 root.userData.m019SculptRevision=MAGMA_SALAMANDER_REVISION;
 root.userData.clonedFromSpecies='m001';
 root.userData.cloneMethod='physical-m001-cranium-and-ribcage-to-salamander-morph';
 root.userData.m019Reference2D='approved-four-view-slender-lizard-2026-11-19';
 root.userData.m019DistinctiveFeatures=[
  'elongated-narrow-wedge-head','paired-long-swept-horns',
  'amber-slit-eyes','four-short-thin-lizard-legs','whip-tail','thin-basalt-spines'
 ];
 root.userData.m019ShortLegReach=MAGMA_SALAMANDER_LEG_REACH;
 root.userData.m019DorsalPlatesFollowTorso=true;
}
