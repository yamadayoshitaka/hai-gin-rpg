/**
 * m024 Purple Venom Scarab — sculpt based on the owner's 2D concept.
 * Independent of the generic insect and arachnid silhouettes.
 * All moving details follow their anatomical leg/wing/head pivots.
 */
export const M024_SCARAB_REVISION='m024-purple-venom-armored-scarab-v1-20261121';

const leftRight=[-1,1];
const suffix=side=>side<0?'L':'R';

function sculptArmoredBody(g,torso,low){
 // A tapered, solid thorax/abdomen hull, not a spherical placeholder.
 g.axialLoft(torso,'skin',[
  {z:.61,y:1.28,rx:.15,ry:.14},
  {z:.39,y:1.30,rx:.44,ry:.35},
  {z:.10,y:1.32,rx:.64,ry:.46},
  {z:-.34,y:1.32,rx:.76,ry:.55},
  {z:-.78,y:1.33,rx:.66,ry:.51},
  {z:-1.16,y:1.32,rx:.47,ry:.38},
  {z:-1.48,y:1.30,rx:.14,ry:.16},
 ],{name:'m024-segmented-armored-thorax',rough:.55,ribbing:.025});
 g.sphere(torso,'#25152f',[0,1.08,-.31],[.56,.33,.84],
  {name:'m024-banded-underbelly',metal:.13,rough:.68});
 for(let i=0;i<(low?4:8);i++){
  const z=.32-i*.20;
  g.tube(torso,i%2?'#4e285a':'#713982',[
   [-.32,1.05,z],[0,1.01,z-.025],[.32,1.05,z]
  ],low?.014:.019,{name:'m024-ventral-segment-'+i});
 }
 // Elytra are individual overlapping cuticle plates: two true wing covers.
 for(const side of leftRight){
  const sideName=suffix(side);
  const cover=g.group('elytron'+sideName,[side*.26,1.64,-.35],torso);
  g.axialLoft(cover,'#3e214f',[
   {z:.50,y:.02,rx:.15,ry:.055},
   {z:.22,y:.08,rx:.32,ry:.14},
   {z:-.15,y:.13,rx:.37,ry:.17},
   {z:-.52,y:.11,rx:.31,ry:.14},
   {z:-.89,y:.02,rx:.15,ry:.055}
  ],{name:'m024-elytra-shell-'+sideName,rough:.34,ribbing:.016});
  const count=low?3:6;
  for(let i=0;i<count;i++){
   const z=.34-i*.218;
   const plate=g.sphere(cover,i%2?'#58306a':'#683679',
    [side*.13,.185,z],[.26,.07,.18],
    {name:'m024-overlapping-carapace-'+sideName+'-'+i,
     metal:.30,rough:.37});
   plate.rotation.z=side*.16;
   plate.rotation.x=-.15;
   g.curvedHorn(cover,'#ad73b1',
    [side*.32,.157,z+.14],
    [side*.38,.193,z+.005],
    [side*.27,.178,z-.15],.016,{
     name:'m024-carapace-ridge-'+sideName+'-'+i,capRoot:true,
    });
  }
 }
}

function sculptHeadAndVenom(g,torso,low){
 const head=g.group('head',[0,1.45,.57],torso);
 g.axialLoft(head,'#321b40',[
  {z:.49,y:-.065,rx:.12,ry:.09},
  {z:.36,y:.005,rx:.31,ry:.205},
  {z:.10,y:.055,rx:.40,ry:.29},
  {z:-.23,y:.03,rx:.32,ry:.26},
  {z:-.43,y:-.04,rx:.13,ry:.14},
 ],{name:'m024-engraved-beetle-head',rough:.41,faceSculpt:true});
 g.sphere(head,'#4e2862',[0,.16,-.01],[.36,.16,.29],
  {name:'m024-frontal-armor-cap',metal:.23,rough:.37});
 const jaw=g.group('jaw',[0,-.16,.28],head);
 g.sphere(jaw,'#120e1a',[0,-.055,.145],[.22,.075,.20],
  {name:'m024-recessed-mouth'});
 g.sphere(jaw,'#b4d76c',[0,-.045,.23],[.10,.025,.09],
  {name:'m024-toxic-saliva',glow:!low});
 for(const side of leftRight){
  const n=suffix(side),p=(x,y,z)=>[side*x,y,z];
  // Recessed predatory compound eye beneath a continuous hard brow.
  g.sphere(head,'#150f1d',p(.314,.101,.243),[.079,.068,.046],
   {name:'m024-eye-socket-'+n,rough:.60});
  g.sphere(head,'#21121e',p(.339,.107,.271),[.045,.038,.022],
   {name:'m024-eye-'+n,rough:.22});
  g.sphere(head,'#bd94d5',p(.352,.12,.288),[.009,.010,.009],
   {name:'m024-eye-glint-'+n});
  g.curvedHorn(head,'#713c83',p(.251,.164,.37),
   p(.345,.208,.255),p(.304,.185,.075),.071,{
    name:'m024-armored-eye-brow-'+n,capRoot:true,
   });
  // Two long ivory venom mandibles; rooted in the real animated jaw.
  g.curvedHorn(jaw,'bone',p(.152,-.009,.16),
   p(.242,-.102,.47),p(.315,-.335,.73),.128,{
    name:'m024-long-venom-fang-'+n,capRoot:true,
   });
  g.sphere(jaw,'#c3ec75',p(.319,-.342,.731),[.022,.042,.022],
   {name:'m024-fang-venom-drop-'+n,glow:!low});
  // Paired sickle antennae rise from the head, not disconnected spikes.
  g.curvedHorn(head,'#a9d679',p(.235,.220,-.075),
   p(.335,.535,.07),p(.47,.69,.28),.061,{
    name:'m024-curved-antenna-'+n,capRoot:true,
   });
  if(!low)g.curvedHorn(head,'#ab82c3',p(.155,.29,.09),
   p(.25,.37,-.035),p(.37,.32,-.17),.037,{
    name:'m024-temple-crest-'+n,capRoot:true,
   });
 }
 return head;
}

function sculptToxicCrown(g,torso,low){
 // Crystalline toxic dorsal crest grows through the opened elytra.
 const crown=[[-.07,.17,.88],[.13,-.06,1.17],[-.15,-.27,.81],
  [.17,-.48,1.02],[-.09,-.70,.67],[.12,-.89,.62]];
 for(let i=0;i<(low?4:crown.length);i++){
  const [x,z,height]=crown[i],n='m024-venom-crystal-'+i;
  g.curvedHorn(torso,i%2?'#d3f6a0':'#aee779',
   [x,1.70,z],[x*.9,1.95+height*.25,z-.08],
   [x*.72,1.80+height,z-.18],i===1?.155:.112,{
    name:n,capRoot:true,
   });
  if(!low)g.curvedHorn(torso,'#709c4e',
   [x+.047,1.73,z+.02],[x+.06,1.87+height*.14,z-.03],
   [x+.032,1.80+height*.73,z-.18],.027,{
    name:n+'-facet',capRoot:true,
   });
 }
 for(const side of leftRight){
  const n=suffix(side);
  for(let i=0;i<(low?2:5);i++){
   const z=-.16-i*.255;
   g.curvedHorn(torso,i%2?'#b0d66f':'#a7d980',
    [side*.53,1.73,z],
    [side*.62,1.91,z-.08],
    [side*.67,2.03-i*.045,z-.19],.057,{
     name:'m024-side-toxic-spine-'+n+'-'+i,capRoot:true,
    });
  }
 }
}

function sculptSixInsectLegs(g,torso,low){
 // Exactly three pairs. Hip -> femur -> patella -> tibia -> tarsus, with
 // cuticle plates attached to the same joint that moves during walking.
 for(const side of leftRight)for(let i=0;i<3;i++){
  const n='leg'+suffix(side)+i;
  const z=[.38,-.27,-.92][i];
  const leg=g.group(n,[side*.51,1.27,z],torso);
  const bend=[side*(.55+(i===0?.09:0)),.11,i===0?.14:i===2?-.22:-.06];
  const distal=[side*(.32+i*.035),-1.20,i===0?.20:i===2?-.16:0];
  const femur=g.group(n+'Femur',[0,0,0],leg);
  g.bone(femur,'#361a48',[0,0,0],bend,.153,{tipRadius:.114,metal:.22,rough:.50});
  const legArmor=g.sphere(femur,'#643674',
   [bend[0]*.60,.095,bend[2]*.63],[.20,.13,.13],
   {name:'m024-femur-cuticle-'+suffix(side)+'-'+i,metal:.3,rough:.43});
  legArmor.rotation.z=side*.33;
  const patella=g.group(n+'Patella',bend,femur);
  g.sphere(patella,'#9cba66',[0,0,0],[.128,.114,.128],
   {name:'m024-knee-chitin-'+suffix(side)+'-'+i,metal:.16,rough:.52});
  const tibia=g.group(n+'Tibia',[0,0,0],patella);
  g.bone(tibia,'#291537',[0,0,0],distal,.118,{tipRadius:.062,metal:.21,rough:.51});
  for(let j=0;j<(low?1:3);j++){
   const u=(j+1)/(low?2:4),a=[distal[0]*u,distal[1]*u,distal[2]*u];
   const plate=g.sphere(tibia,j%2?'#633372':'#4a285f',
    a,[.126,.15,.096],{name:'m024-tibia-plate-'+suffix(side)+'-'+i+'-'+j,
      metal:.19,rough:.45});
   plate.rotation.z=side*.18;
  }
  const tarsus=g.group(n+'Tarsus',distal,tibia);
  g.sphere(tarsus,'#28152e',[0,0,0],[.11,.077,.124],
   {name:'m024-foot-joint-'+suffix(side)+'-'+i});
  for(const clawSide of [-1,1]){
   g.curvedHorn(tarsus,'bone',[clawSide*.046,0,.02],
    [clawSide*.11,-.074,.115],
    [clawSide*.145,-.14,.20],.048,{
     name:'m024-claw-'+suffix(side)+'-'+i+'-'+(clawSide<0?'a':'b'),
     capRoot:true,
    });
  }
  if(!low)g.curvedHorn(patella,'#995ab0',[0,.094,-.03],
   [side*.065,.136,-.11],[side*.12,.045,-.205],.041,{
    name:'m024-knee-guard-'+suffix(side)+'-'+i,capRoot:true,
   });
 }
}

function sculptVeinedWings(g,torso,low){
 // Each wing pivot owns TWO true 3D membranes (4 wings total) and ribs.
 // No flat "ear" cards fixed to the torso while the rig flaps.
 for(const side of leftRight){
  const n=suffix(side),p=(x,y,z)=>[side*x,y,z];
  const wing=g.group('wing'+n,p(.43,1.76,-.28),torso);
  g.sphere(wing,'#563168',[0,0,0],[.18,.13,.22],
   {name:'m024-wing-socket-'+n});
  const upper=g.fin(wing,'#b994e6',[0,0,0],p(1.63,.73,-.28),
   .47,{translucent:true,name:'m024-upper-translucent-wing-'+n});
  const lower=g.fin(wing,'#9370c8',[0,0,-.10],p(1.34,.28,-.90),
   .35,{translucent:true,name:'m024-lower-translucent-wing-'+n});
  upper.userData.venomScarabMembrane=true;
  lower.userData.venomScarabMembrane=true;
  const veinCount=low?3:7;
  for(let i=0;i<veinCount;i++){
   const t=(i+.6)/(veinCount+.5);
   const a=p(.16+t*.99,.12+t*.42,-.04-t*.13);
   const b=p(.37+t*1.23,.18+t*.48,-.10-t*.25);
   g.tube(wing,i%2?'#e4c8ee':'#c8a6e6',[
    [0,0,0],p(.34+t*.46,.07+t*.25,-.04-t*.15),a,b
   ],low?.008:.010,{name:'m024-upper-wing-vein-'+n+'-'+i});
  }
  for(let i=0;i<(low?2:4);i++){
   const t=(i+1)/(low?3:5);
   g.tube(wing,'#bd9bd4',[
    [0,0,-.10],p(.24+t*.50,.08,-.19-t*.20),
    p(.32+t*.97,.12+t*.22,-.35-t*.44)
   ],low?.007:.009,{name:'m024-lower-wing-vein-'+n+'-'+i});
  }
 }
}

export function sculptM024PoisonScarab(g,spec){
 const low=g.root.userData.detail==='low';
 const torso=g.group('torso');
 sculptArmoredBody(g,torso,low);
 sculptHeadAndVenom(g,torso,low);
 sculptToxicCrown(g,torso,low);
 sculptSixInsectLegs(g,torso,low);
 sculptVeinedWings(g,torso,low);
 g.root.scale.setScalar(spec.size*.91);
 g.root.userData.m024ConceptBasedSculpt=true;
 g.root.userData.m024Anatomy={legPairs:3,wings:4,crystalCrown:true,venomMandibles:2};
 g.root.userData.gameModelRevision=M024_SCARAB_REVISION;
}
