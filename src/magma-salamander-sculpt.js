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
export const MAGMA_SALAMANDER_REVISION='m019-long-low-molten-salamander-v3-20261119';
export const MAGMA_SALAMANDER_LEG_REACH=.72;
export const MAGMA_SALAMANDER_BODY_DROP=.22;

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
 // The amber iris appears through a tapered lateral slit. It is placed
 // ABOVE the true flank of the flattened wolf-donor skull, not on a raised
 // button or buried behind a separate forehead globe.
 const orbit=g.sphere(head,'shadow',[side*.374,.059,.195],
  [.062,.050,.087],{name:'m019-inset-orbit-'+suffix,rough:.89});
 orbit.userData.m019EyeRecessed=true;
 const iris=g.sphere(head,'eye',[side*.402,.060,.214],
  [.021,.042,.051],{name:'m019-amber-iris-'+suffix,rough:.24});
 iris.userData.m019PredatorSlit=true;
 // Tiny bright inner iris; no huge emissive orb.
 g.sphere(head,'accent',[side*.418,.064,.221],
  [.006,.029,.025],{name:'m019-glowing-iris-'+suffix,glow:detail==='source'});
 g.sphere(head,'shadow',[side*.425,.059,.233],
  [.005,.031,.017],{name:'m019-vertical-pupil-'+suffix,rough:.18});
 g.sphere(head,'bone',[side*.427,.077,.238],
  [.002,.005,.006],{name:'m019-eye-glint-'+suffix,rough:.1});
 // Angled bone rim sweeps backwards from the nostril to the horn root.
 const brow=g.tube(head,'skin',[
  [side*.308,.128,.297],[side*.373,.138,.233],
  [side*.399,.116,.173],[side*.383,.099,.107]
 ],.025,{name:'m019-predator-brow-'+suffix});
 brow.userData.m019BoneBrow=true;
 g.tube(head,'shadow',[
  [side*.336,.014,.276],[side*.384,.015,.218],[side*.392,.040,.135]
 ],.012,{name:'m019-lower-lid-'+suffix});
 const lid=g.group('eyelid'+suffix,[side*.397,.155,.207],head);
 lid.userData.restY=lid.position.y;
 lid.userData.blinkTravel=.083;
 g.sphere(lid,'skin',[0,0,0],[.039,.015,.054],
  {name:'m019-nictitating-lid-'+suffix,rough:.84});
}

export function sculptMagmaSalamanderHorn(g,head,side,{detail='high'}={}){
 const suffix=side<0?'L':'R';
 // A single swept-back crescent grows out of the skull. Short, dark roots
 // instead of balloon-shaped white horn mounts; the swept tip gives this
 // heavy salamander a predatory profile rather than a cow silhouette.
 const root=[side*.248,.189,-.210];
 const socket=g.bridge(head,'skin',
  [side*.207,.115,-.124],[side*.285,.275,-.263],.110,.074);
 socket.name='m019-horn-cartilage-'+suffix;
 const horn=g.curvedHorn(head,'bone',root,
  [side*.370,.461,-.421],
  [side*.487,.735,-.739],.108,
  {name:'m019-grand-horn-'+suffix});
 horn.userData.m019PrimaryHorn=true;
 horn.userData.m019SweptBackward=true;
 if(detail==='low')return;
 g.curvedHorn(head,'shadow',
  [side*.298,.249,-.285],
  [side*.357,.369,-.420],
  [side*.398,.417,-.492],.027,
  {name:'m019-horn-dark-keel-'+suffix});
 g.curvedHorn(head,'bone',[side*.290,-.094,.092],
  [side*.397,-.088,.072],[side*.467,-.073,-.038],.045,
  {name:'m019-cheek-horn-'+suffix});
}

export function sculptMagmaSalamanderBack(g,torso,{detail='high'}={}){
 const low=detail==='low',count=low?5:detail==='source'?13:9;
 // Irregular silhouette: short blades at shoulders, dramatic basalt
 // ridges over the spine, then progressively shorter near the haunch.
 for(let i=0;i<count;i++){
  const t=(i+.36)/count,z=.62-1.34*t;
  const hump=Math.pow(Math.sin(Math.PI*t),1.5);
  const root=[(i%2?-.016:.016),1.554-.064*t,z];
  const peak=.19+.28*hump+(i%3===0?.09:0);
  const tip=[(i%2?-.044:.044),root[1]+peak,z-.170];
  const horn=g.curvedHorn(torso,i%5===0?'bone':'shadow',
    root,[root[0],root[1]+peak*.48,z-.059],tip,
    .045+.024*hump,{name:'m019-lava-ridge-'+i});
  horn.userData.m019RootedDorsalCrest=true;
 }
 if(low)return;
 // Broad embedded armour patches instead of circles of hovering black
 // 'buttons'. Small lava channels follow their intersection with the hide.
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const s=side<0?'L':'R',z=.39-i*.245;
  const plate=g.rock(torso,'shadow',
    [side*.435,1.285,z],[.075,.075,.158],
    {name:'m019-basalt-scute-'+s+'-'+i,rough:.91});
  plate.userData.m019EmbeddedScale=true;
  if(i%2===0){
   g.tube(torso,'accent',[
    [side*.477,1.315,z-.095],
    [side*.487,1.278,z-.023],
    [side*.474,1.248,z+.061]
   ],.009,{name:'m019-lava-fissure-'+s+'-'+i});
  }
 }
}

export function markMagmaSalamander(root){
 root.userData.m019SculptRevision=MAGMA_SALAMANDER_REVISION;
 root.userData.clonedFromSpecies='m001';
 root.userData.cloneMethod='physical-m001-cranium-and-ribcage-to-salamander-morph';
 root.userData.m019Reference2D='approved-magma-salamander-2026-11-18';
 root.userData.m019DistinctiveFeatures=[
  'beast-derived-wedge-head','paired-massive-swept-horns',
  'amber-slit-eyes','short-plantigrade-legs','basalt-armour'
 ];
 root.userData.m019ShortLegReach=MAGMA_SALAMANDER_LEG_REACH;
 root.userData.m019DorsalPlatesFollowTorso=true;
}
