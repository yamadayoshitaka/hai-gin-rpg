/**
 * m018 Poison Thorn Hydra — v22.
 *
 * Surgical rebuild of the EXISTING in-game m018 quadruped. The established
 * torso, 4 animated legs, tail, stats and battle actions remain untouched.
 * Only its old generic single reptilian face and short throat are replaced
 * with three long independently animated necks and dragon crania.
 *
 * Palette: dark violet chitin / natural bone / small emerald toxic crystals.
 * No imported GLB, image billboard or runtime texture fetching.
 */
export const M018_HYDRA_REVISION='m018-existing-body-three-long-dragon-necks-v22-20261121';

const SIDES=Object.freeze([
 Object.freeze({suffix:'L',side:-1,scale:.90,neckHeight:1.36,rootX:-.24,rootZ:.24}),
 Object.freeze({suffix:'C',side:0,scale:1.04,neckHeight:1.76,rootX:0,rootZ:.45}),
 Object.freeze({suffix:'R',side:1,scale:.90,neckHeight:1.36,rootX:.24,rootZ:.24})
]);

function dragonCranium(g,neck,definition,{detail='high'}={}){
 const low=detail==='low',suffix=definition.suffix;
 const side=definition.side;
 const long=definition.neckHeight;
 const spread=side===0?0:side*.50;
 const skull=g.group('hydraSkull'+suffix,
   [spread,long,side===0?.30:.38],neck);
 skull.scale.setScalar(definition.scale);
 skull.userData.m018DragonFace=true;
 skull.userData.m018TrueNeckEnd=true;
 // Real lofted dragon head: tapered angular nose, wide zygomatic arches,
 // strong brow and a wide hind cranium. No overlapping generic lizard oval.
 const cranium=g.axialLoft(skull,'skin',[
  {z:.70,y:-.092,rx:.035,ry:.044},
  {z:.645,y:-.079,rx:.113,ry:.089},
  {z:.52,y:-.032,rx:.141,ry:.114},
  {z:.37,y:.001,rx:.172,ry:.157},
  {z:.21,y:.063,rx:.239,ry:.194},
  {z:.025,y:.067,rx:.246,ry:.215},
  {z:-.19,y:.013,rx:.202,ry:.185},
  {z:-.37,y:-.056,rx:.105,ry:.100}
 ],{name:'m018-dragon-cranium-'+suffix,
    rough:.82,ribbing:low?.012:.029,capEnds:true});
 cranium.userData.m018DragonWedge=true;
 cranium.userData.m018CraniumFromExistingHydra=true;
 // Dragon nasal bone rises into the armored brow and tapers to narrow jaws.
 const muzzle=g.axialLoft(skull,'light',[
  {z:.775,y:-.117,rx:.032,ry:.022},
  {z:.705,y:-.106,rx:.098,ry:.050},
  {z:.605,y:-.092,rx:.129,ry:.070},
  {z:.450,y:-.063,rx:.162,ry:.086},
  {z:.305,y:-.046,rx:.178,ry:.101},
  {z:.155,y:-.050,rx:.120,ry:.080}
 ],{name:'m018-dragon-nasal-ridge-'+suffix,
    rough:.80,ribbing:low?0:.012,capEnds:true});
 muzzle.userData.m018DragonSnout=true;
 // Actual jaw pivot follows the existing jaw motion for the center head;
 // side heads have independent jaw IDs and share its attack envelope.
 const jaw=g.group(suffix==='C'?'jaw':'hydraJaw'+suffix,
   [0,-.156,.080],skull);
 jaw.userData.m018DragonMandible=true;
 const lower=g.axialLoft(jaw,'skin',[
  {z:.68,y:-.055,rx:.034,ry:.027},
  {z:.585,y:-.061,rx:.106,ry:.045},
  {z:.42,y:-.058,rx:.153,ry:.062},
  {z:.235,y:-.036,rx:.178,ry:.073},
  {z:.04,y:-.001,rx:.152,ry:.079},
  {z:-.125,y:.012,rx:.082,ry:.060}
 ],{name:'m018-dragon-mandible-'+suffix,
    rough:.82,ribbing:low?0:.009,capEnds:true});
 lower.userData.m018ConnectedJaw=true;
 for(const s of [-1,1]){
  const eye=g.sphere(skull,'eye',
   [s*.208,.119,.236],[.038,.045,.044],
   {name:'m018-dragon-eye-'+suffix+(s<0?'-L':'-R'),rough:.22});
  eye.userData.m018InsetToxicIris=true;
  g.sphere(skull,'shadow',
   [s*.239,.119,.245],[.007,.034,.017],
   {name:'m018-dragon-pupil-'+suffix+(s<0?'-L':'-R')});
  const brow=g.curvedHorn(skull,'skin',
   [s*.155,.176,.347],[s*.213,.215,.248],
   [s*.248,.173,.041],.034,
   {name:'m018-armored-brow-'+suffix+(s<0?'-L':'-R'),rough:.82});
  brow.userData.m018DragonBrow=true;
  // Genuine swept-back keratin horns rooted behind both temples.
  const horn=g.curvedHorn(skull,'bone',
   [s*.165,.185,-.093],[s*.256,.459,-.23],
   [s*.354,.428,-.545],.061,
   {name:'m018-dragon-horn-'+suffix+(s<0?'-L':'-R'),rough:.72});
  horn.userData.m018RootedDragonHorn=true;
  const nostril=g.sphere(skull,'shadow',
   [s*.077,-.073,.717],[.022,.010,.013],
   {name:'m018-dragon-nostril-'+suffix+(s<0?'-L':'-R')});
  nostril.userData.m018NasalOpening=true;
  for(let tooth=0;tooth<(low?1:3);tooth++){
   const z=.60-tooth*.12;
   const fang=g.curvedHorn(skull,'bone',
    [s*(.104+tooth*.019),-.150,z],
    [s*(.120+tooth*.021),-.216,z+.03],
    [s*(.126+tooth*.014),-.279,z+.048],
    tooth===0?.023:.016,
    {name:'m018-upper-fang-'+suffix+'-'+(s<0?'L':'R')+'-'+tooth,rough:.69});
   fang.userData.m018PredatorTeeth=true;
  }
 }
 // Small emerald crystal crest integrated into the cranium, not floating
 // fluorescent cones; each side has an unmistakably draconic profile.
 for(let i=0;i<(low?2:4);i++){
  const z=.03-i*.115,rootY=.258-i*.015;
  const thorn=g.curvedHorn(skull,i===0?'accent':'shadow',
   [0,rootY-.059,z],[.009,rootY+.048,z-.065],
   [i%2?.018:-.018,rootY+.207-i*.020,z-.13],
   .031,{name:'m018-toxic-cranial-thorn-'+suffix+'-'+i});
  thorn.userData.m018HeadCrystal=true;
 }
 return {skull,jaw};
}

export function sculptM018Hydra(g,torso,centralHead,{detail='high'}={}){
 const low=detail==='low';
 if(!torso||!centralHead)throw Error('m018 requires original torso and head pivots');
 for(const def of SIDES){
  const neck=def.suffix==='C'?centralHead:g.group(
   'hydraHead'+def.suffix,
   [def.rootX,1.245,def.rootZ],torso);
  const side=def.side,spread=side===0?0:side*.50;
  neck.userData.m018IndependentNeck=true;
  neck.userData.m018NeckLength=def.neckHeight;
  neck.userData.m018DragonHeads=3;
  // Long S-curved organic throat, flexing with its real base pivot.
  // Parent at the SHOULDER instead of stacking a translated head on top
  // of the generic wolf/cat muzzle. At least 1.36 world units per neck.
  const path=[
   [0,-.10,-.11],
   [side*.055,.21,-.045],
   [side*.20,.58,.030],
   [side*.36,def.neckHeight*.72,.095],
   [spread,def.neckHeight,.33]
  ];
  const tube=g.tube(neck,'skin',path,side===0?.218:.184,{
   name:'m018-long-neck-'+def.suffix,
   taper:.76,capEnds:true,
   tubularSegments:low?16:32,radialSegments:low?10:16
  });
  tube.userData.m018ContinuousNeck=true;
  tube.userData.m018NeckSource='m018-existing-torso';
  tube.userData.m018NeckLength=def.neckHeight;
  // A thin throat channel is attached to the SAME rotating neck parent.
  // No transparent overlay skin; use one narrow recess per high LOD neck.
  if(!low){
   const channel=g.tube(neck,'accent',[
    [side*.070,.06,.045],
    [side*.122,.37,.120],
    [side*.232,.72,.145],
    [side*.352,def.neckHeight*.84,.183],
    [spread*.98,def.neckHeight*.97,.234]
   ],.009,{name:'m018-neck-venom-vein-'+def.suffix,
    glow:true,taper:.68});
   channel.userData.m018EmeraldToxinVein=true;
  }
  dragonCranium(g,neck,def,{detail});
 }
 g.root.userData.m018HydraRevision=M018_HYDRA_REVISION;
 g.root.userData.m018DragonHeadCount=3;
 g.root.userData.m018AllHeadsAnimate=true;
 g.root.userData.m018LongestNeck=1.76;
 g.root.userData.m018ExistingTorsoLegsTailPreserved=true;
 g.root.userData.m018PhysicalDragonHeads=true;
}

export function sculptM018HydraThorns(g,torso,tail,tailMid,{
 detail='high'
}={}){
 // Match the reference's emerald toxic spikes and dark violet scales
 // while preserving the original body and existing articulated tail.
 const low=detail==='low';
 const count=low?6:12;
 for(let i=0;i<count;i++){
  const t=i/(count-1),z=.60-t*1.20;
  const y=1.62-.048*t,side=i%2?-1:1;
  const height=(low?.17:.23)*(.55+.45*Math.sin(Math.PI*t));
  const spine=g.curvedHorn(torso,i%3===0?'accent':'shadow',
   [side*.073,y-.050,z],[side*.089,y+height*.57,z-.035],
   [side*.110,y+height,z-.13],low?.038:.052,
   {name:'m018-rooted-toxic-thorn-'+i,rough:.58});
  spine.userData.m018BuriedCrystalRoot=true;
 }
 if(low)return;
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const z=.45-i*.28;
  const scale=g.rock(torso,'shadow',
   [side*.36,1.32,z],[.067,.031,.108],
   {name:'m018-integrated-flank-plate-'+(side<0?'L':'R')+'-'+i});
  scale.userData.m018InsetBodyScale=true;
 }
 // Only a few carefully anchored poison crystals on tail pivots.
 for(const [pivot,stem] of [[tail,'base'],[tailMid,'mid']]){
  if(!pivot)continue;
  for(let i=0;i<3;i++){
   const z=-.10-i*.17;
   const shard=g.curvedHorn(pivot,'accent',
    [0,.090,z],[.028,.140,z-.045],[.037,.213,z-.107],.025,
    {name:'m018-caudal-venom-spike-'+stem+'-'+i});
   shard.userData.m018TailFollow=true;
  }
 }
}
