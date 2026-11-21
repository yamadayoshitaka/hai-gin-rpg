/**
 * m023 Jade Sickle Mantis: source-led 3D insect anatomy.
 *
 * The old general-purpose insect used a beetle-sized thorax, a round skull,
 * three walking-leg pairs AND an extra arm pair, so it read as an eight-legged
 * beetle rather than a praying mantis. A mantis has six limbs in total:
 * the anterior pair becomes two jointed raptorial forelegs.
 *
 * This sculpt keeps the same animation pivot API ('leg[L/R]0..2',
 * 'raptorial[L/R]', 'raptorialElbow[L/R]', 'head', 'jaw', wings). Every
 * attached mesh inherits its actual owning pivot. The source/high LOD gets
 * carved facets, serrations and wing veins; crowd low LOD stays inexpensive.
 */
export const M023_MANTIS_SCULPT_REVISION='m023-six-limb-raised-praying-mantis-v2-20261121';
export const M023_WALKING_PAIR_COUNT=2;
export const M023_RAPTORIAL_PAIR_COUNT=1;

export function sculptM023Mantis(g,spec){
 if(spec?.id!=='m023')return false;
 const detail=g.root.userData.detail;
 const near=detail!=='low';
 const source=detail==='source';
 const torso=g.group('torso');

 // Narrow thoracic keel and long tapered segmented abdomen. Each is a
 // closed, continuous 3D section loft with actual UVs and vertex normals.
 const abdomen=g.axialLoft(torso,'skin',[
  {z:.29,y:1.26,rx:.11,ry:.13},
  {z:.07,y:1.27,rx:.235,ry:.195},
  {z:-.22,y:1.29,rx:.32,ry:.24},
  {z:-.51,y:1.30,rx:.345,ry:.26},
  {z:-.82,y:1.24,rx:.255,ry:.20},
  {z:-1.13,y:1.16,rx:.065,ry:.075}
 ],{name:'m023-elongated-articulated-abdomen',rough:.66,
  ribbing:near?.021:0,capEnds:true});
 abdomen.userData.mantisSegmentedAbdomen=true;
 g.bridge(torso,'skin',[0,1.30,.18],[0,1.67,.55],
  .185,.11,{longitudinalSegments:near?25:12,radialSegments:near?16:9});
 // The prothorax must taper into the triangle head, not form a bulbous
 // central beetle chest; sclerites overlap in surface continuity.
 g.sphere(torso,'light',[0,1.46,.35],[.137,.20,.16],
  {name:'m023-prothorax-sclerite',rough:.62});
 if(near)for(let i=0;i<5;i++){
  const z=-.08-i*.20;
  const y=1.30+(.01*i)-.025*i;
  const radius=.235+.10*Math.sin(Math.PI*i/5);
  for(const side of [-1,1]){
   g.tube(torso,'shadow',[
    [side*radius*.30,y+.180,z+.041],
    [side*radius*.64,y+.137,z],
    [side*radius*.92,y+.052,z-.038]
   ],.009,{name:'m023-abdomen-segment-suture',rough:.94});
  }
 }

 // Wider at the orbits, narrow at the pointed clypeus. The original
 // near-spherical generic insect face could not make this silhouette.
 const head=g.group('head',[0,1.81,.75]);
 const skull=g.axialLoft(head,'skin',[
  {z:.34,y:-.11,rx:.035,ry:.050},
  {z:.24,y:-.058,rx:.12,ry:.09},
  {z:.105,y:.025,rx:.29,ry:.20},
  {z:-.07,y:.055,rx:.36,ry:.20},
  {z:-.25,y:.050,rx:.18,ry:.13},
  {z:-.36,y:.040,rx:.045,ry:.05}
 ],{name:'m023-triangular-sculpted-cranium',
  rough:.49,ribbing:near?.012:0,faceSculpt:false,capEnds:true});
 skull.userData.mantisTriangularHead=true;
 g.sphere(head,'shadow',[0,-.12,.244],[.115,.064,.137],
  {name:'m023-recessed-clypeus',rough:.71});
 for(const side of [-1,1]){
  // Compound eyes bulge from the sides of the same skull, not oversized
  // glowing spheres projected in front of the face.
  const eye=g.sphere(head,'eye',[side*.309,.062,.068],
   [.133,.143,.127],{name:'m023-side-compound-eye',rough:.24});
  eye.userData.compoundEye=true;
  g.sphere(head,'shadow',[side*.31,.067,.13],
   [.056,.083,.029],{name:'m023-faceted-eye-shadow',rough:.45});
  // Segment-paired sensory antennae with flexible-looking arch.
  g.tube(head,'bone',[
   [side*.084,.158,.232],
   [side*.12,.34,.43],
   [side*.22,.46,.59],
   [side*.33,.40,.69]
  ],near?.014:.020,{name:'m023-thin-arched-antenna',
    taper:.28,capEnds:true,rough:.75});
 }
 const jaw=g.group('jaw',[0,1.69,1.01],torso);
 for(const side of [-1,1])g.curvedHorn(jaw,'bone',
  [side*.080,.015,-.015],
  [side*.14,-.055,.074],
  [side*.055,-.15,.145],.035,
  {name:'m023-rooted-inward-mandible',rough:.64});

 // Only four walking legs: rear and mid pairs, plus the two arms below.
 for(const side of [-1,1])for(let i=1;i<=2;i++){
  const suffix=side<0?'L':'R';
  const z=i===1?-.03:-.63;
  const leg=g.group('leg'+suffix+i,[side*.245,1.19,z],torso);
  const femur=g.group('leg'+suffix+i+'Femur',[0,0,0],leg);
  g.sphere(femur,'skin',[0,.005,0],[.105,.105,.135],
   {name:'m023-walking-coxa',rough:.66});
  const knee=[side*(i===1?.51:.57),.135,i===1?.02:-.10];
  g.bone(femur,'skin',[0,0,0],knee,.084,
   {tipRadius:.049,rough:.67});
  const joint=g.group('leg'+suffix+i+'Patella',knee,femur);
  g.sphere(joint,'light',[0,0,0],[.091,.085,.092],
   {name:'m023-walking-knee-socket',rough:.55});
  const tibia=g.group('leg'+suffix+i+'Tibia',[0,0,0],joint);
  const distal=[side*.12,-1.325,i===1?.39:-.46];
  g.bone(tibia,'skin',[0,0,0],distal,.055,
   {tipRadius:.021,rough:.60});
  const tarsus=g.group('leg'+suffix+i+'Tarsus',distal,tibia);
  g.sphere(tarsus,'shadow',[0,.0,0],[.044,.046,.055],
   {name:'m023-plantigrade-arthropod-tarsus',rough:.79});
  g.curvedHorn(tarsus,'bone',
   [0,.02,.012],[side*.025,-.020,.100],
   [side*.09,-.065,.22],.025,
   {name:'m023-anchored-tarsal-hook',rough:.67});
 }
 // The third (anterior) pair of legs ARE the grasping forelegs.
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  const leg=g.group('leg'+suffix+'0',[side*.165,1.63,.43],torso);
  const arm=g.group('raptorial'+suffix,[0,0,0],leg);
  g.sphere(arm,'skin',[0,0,0],[.113,.107,.139],
   {name:'m023-forecoxal-shoulder',rough:.69});
  const elbowPoint=[side*.285,-.19,.38];
  // Widened femoral section carries the folded scythe and all serrations.
  g.bone(arm,'skin',[0,0,0],elbowPoint,.112,
   {tipRadius:.070,rough:.58});
  g.sphere(arm,'light',[side*.17,-.095,.22],
   [.102,.108,.205],{name:'m023-raptorial-femur-muscle',rough:.58});
  const elbow=g.group('raptorialElbow'+suffix,elbowPoint,arm);
  g.sphere(elbow,'light',[0,0,0],[.080,.082,.087],
   {name:'m023-raptorial-fold-hinge',rough:.53});
  // One inward-curling tapered blade with a buried keratin root.
  const blade=g.curvedHorn(elbow,'light',
   [0,0,0],[side*.08,-.17,.23],
   [-side*.065,-.345,.53],.093,
   {name:'m023-continuous-sickle-blade',heroKeratin:true,rough:.45});
  blade.userData.mantisSickle=true;
  if(near){
   for(let j=0;j<(source?9:7);j++){
    const t=(j+.65)/(source?9:7);
    g.curvedHorn(elbow,'bone',
     [side*(.015+.032*t),-.075-.20*t,.105+.30*t],
     [side*(.007-.010*t),-.105-.20*t,.125+.30*t],
     [-side*.035,-.160-.20*t,.147+.30*t],
     .017*(1-.45*t),
     {name:'m023-rooted-sickle-serration-'+j,rough:.55});
   }
   g.tube(arm,'light',[
    [side*.034,.018,.043],
    [side*.095,-.045,.13],
    [side*.206,-.13,.28],
    [side*.265,-.175,.34]
   ],.013,{name:'m023-forelimb-cuticle-ridge',rough:.59});
  }
 }
 // Thin folded tegmina: two hinged veined wings lie above the abdomen.
 // They fold and lift with the pre-existing wingL / wingR animation.
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  const wing=g.group('wing'+suffix,[side*.17,1.49,.16],torso);
  const tip=[side*.55,.075,-1.05];
  g.fin(wing,'light',[0,0,0],tip,.155,
   {name:'m023-overlapping-veined-tegmen',rough:.64});
  if(near)for(let j=0;j<4;j++){
   const start=.16+j*.08;
   g.tube(wing,j%2===0?'skin':'shadow',[
    [side*.008,.030,-.04],
    [side*(.13+start*.45),.063,-.42],
    [side*(.29+start*.55),.072,-.73],
    [side*(.40+start*.48),.075,-.99]
   ],.006,{name:'m023-fitted-tegmen-vein',rough:.75});
  }
 }
 g.root.scale.setScalar(spec.size*.84);
 g.root.userData.m023MantisSculpt=M023_MANTIS_SCULPT_REVISION;
 g.root.userData.m023MantisSilhouette='slender-prothorax-triangular-cranium';
 g.root.userData.m023WalkingLegPairs=M023_WALKING_PAIR_COUNT;
 g.root.userData.m023RaptorialLegPairs=M023_RAPTORIAL_PAIR_COUNT;
 g.root.userData.m023NoBeetleBody=true;
 return true;
}
