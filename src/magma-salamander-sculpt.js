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
export const MAGMA_SALAMANDER_REVISION='m019-wolf-donor-salamander-v1-20261118';
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
 // The orbit opens into the side-facing muzzle and remains coherent when
 // the entire animated head pitches. The amber lens is forward of its socket.
 g.sphere(head,'shadow',[side*.300,.091,.312],[.079,.053,.088],
  {name:'m019-inset-orbit-'+suffix,rough:.81});
 g.sphere(head,'eye',[side*.326,.095,.332],[.037,.042,.054],
  {name:'m019-amber-iris-'+suffix,rough:.30});
 g.sphere(head,'accent',[side*.354,.097,.348],[.013,.033,.029],
  {name:'m019-glowing-iris-'+suffix,rough:.28,glow:detail!=='low'});
 g.sphere(head,'shadow',[side*.366,.097,.362],[.0055,.030,.015],
  {name:'m019-vertical-pupil-'+suffix,rough:.25});
 // Inset orbital fascia is above the iris, not a bar crossing the pupil.
 g.sphere(head,'skin',[side*.291,.159,.303],[.099,.029,.113],
  {name:'m019-predator-brow-'+suffix});
 g.sphere(head,'skin',[side*.295,.034,.311],[.083,.022,.091],
  {name:'m019-lower-lid-'+suffix});
 const lid=g.group('eyelid'+suffix,[side*.319,.180,.325],head);
 lid.userData.restY=lid.position.y;
 lid.userData.blinkTravel=.073;
 g.sphere(lid,'skin',[0,0,0],[.065,.018,.063],
  {name:'m019-nictitating-lid-'+suffix,rough:.77});
}

export function sculptMagmaSalamanderHorn(g,head,side,{detail='high'}={}){
 const suffix=side<0?'L':'R';
 // Massive swept-back paired horns. Radius tapers inside ONE rooted
 // physical horn mesh; the submerged socket follows the skull pivot.
 const base=[side*.232,.222,-.187];
 g.sphere(head,'skin',[side*.237,.213,-.170],[.154,.142,.182],
  {name:'m019-horn-cartilage-'+suffix});
 const horn=g.curvedHorn(head,'bone',base,
  [side*.334,.574,-.255],
  [side*.468,.986,-.388],.125,
  {name:'m019-grand-horn-'+suffix});
 horn.userData.m019PrimaryHorn=true;
 if(detail==='low')return;
 // Smaller tusk is attached to the cheek and swept backward.
 g.curvedHorn(head,'bone',[side*.315,-.095,.130],
  [side*.435,-.044,.188],[side*.529,.023,.104],.058,
  {name:'m019-cheek-horn-'+suffix});
 // Keratin annulus is close to the base, not a hovering metal band.
 g.sphere(head,'shadow',[side*.249,.312,-.187],[.081,.030,.088],
  {name:'m019-horn-growth-ridge-'+suffix});
}

export function sculptMagmaSalamanderBack(g,torso,{detail='high'}={}){
 const low=detail==='low';
 const ridgeCount=low?5:detail==='source'?14:9;
 for(let i=0;i<ridgeCount;i++){
  const t=(i+.45)/ridgeCount,z=.59-1.18*t;
  const hump=Math.sin(Math.PI*t),rootY=1.565-.07*t;
  const root=[0,rootY,z];
  const tip=[.022*(i%2?1:-1),1.84+.19*hump-.06*t,z-.158];
  const horn=g.curvedHorn(torso,i%4===0?'bone':'accent',root,
    [0,1.68+.065*hump,z-.052],tip,.064+.027*hump,
    {name:'m019-lava-ridge-'+i});
  horn.userData.m019RootedDorsalCrest=true;
 }
 if(low)return;
 // Near-LOD armour follows the rib cage; the glowing fissures are shallow
 // overlays on the same torso pivot, never independent floating plates.
 for(const side of [-1,1])for(let i=0;i<5;i++){
  const z=.41-i*.214;
  g.sphere(torso,'shadow',[side*.475,1.312,z],
   [.082,.149,.166],{name:'m019-basalt-scute-'+(side<0?'L':'R')+'-'+i});
  g.tube(torso,'accent',[
   [side*.525,1.388,z-.093],
   [side*.541,1.327,z-.013],
   [side*.522,1.245,z+.083]],.013,
   {name:'m019-lava-fissure-'+(side<0?'L':'R')+'-'+i});
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
