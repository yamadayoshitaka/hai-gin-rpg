/**
 * Concept-art-first 3D sculpt v2.
 * Eight existing bestiary entries, not newly invented monster records.
 * Actual 3D triangle surfaces; source/high/medium/low share one anatomy.
 */
import * as THREE from 'three';
import {
 conceptDensity,placeMesh,texturedEllipsoid,sweepVolume,conformalCarapace,
 mergedSuckerRows,slimeMembrane
} from './monster-concept-v2-mesh.js';

export const CONCEPT_TRIO_REVISION='concept-trio-physical-sculpt-v2-20261121';
export const CONCEPT_TRIO_IDS=Object.freeze([
 'm026','m027','m028','m029','m030','m046','m047','m049'
]);
const SPIDERS=new Set(CONCEPT_TRIO_IDS.slice(0,5));
const OCTOPUSES=new Set(['m047','m049']);
const TAU=Math.PI*2;
const arc=(t,side)=>side*Math.sin(t*Math.PI);
const elements=Object.freeze({
 m026:{deep:'#2e2729',skin:'#58444e',plate:'#90776a',accent:'#b59b87'},
 m027:{deep:'#291f35',skin:'#4c3156',plate:'#91659c',accent:'#cb5bd7'},
 m028:{deep:'#2c3e56',skin:'#7397af',plate:'#bfdae7',accent:'#95eeff'},
 m029:{deep:'#301b25',skin:'#75333b',plate:'#cf7051',accent:'#ffb352'},
 m030:{deep:'#211c33',skin:'#3e2954',plate:'#866497',accent:'#d04de0'},
 m047:{deep:'#24243d',skin:'#503b72',plate:'#9262ad',accent:'#4df0e6'},
 m049:{deep:'#1e1e38',skin:'#36264e',plate:'#664b91',accent:'#56cfff'}
});
const spiderStyle=id=>id==='m028'?'frost':id==='m029'?'ember':
  id==='m026'?'cave':'venom';
const addBoss=(g,parent,center,scale,shade='skin',name='fitted-boss')=>{
 g.sphere(parent,shade,center,scale,{name,rough:.43,metal:.23});
};
function animatePlateHighlight(g,par,z,dimensions,c,role){
 // Even the illuminated fissures are embedded along the surface of the shell.
 const [rx,ry,rz]=dimensions;
 const y=(x,dz)=>ry*Math.sqrt(Math.max(.07,1-x*x/(rx*rx)-dz*dz/(rz*rz)));
 for(const side of [-1,1])for(let k=0;k<3;k++){
  const x=side*(.12+k*.125);
  const from=-rz*.70+k*.04,to=rz*.62-k*.08;
  const points=[];
  for(let j=0;j<6;j++){
   const dz=from+(to-from)*j/5;
   const xx=x*(1+.18*Math.sin(j*1.3+k));
   points.push([xx,y(xx,dz)+.045,dz+z]);
  }
  g.tube(par,k===1?'light':'accent',points,.013+(k===1?.003:0),{
   name:'organic-energy-fissure',glow:true,rough:.2,
   tubularSegments:conceptDensity(g,34,23,14,8)
  });
 }
}
function armoredSpider(g,s){
 const id=s.id,p=elements[id],queen=id==='m030',big=queen?1.24:1;
 const style=spiderStyle(id),torso=g.group('torso');
 texturedEllipsoid(g,torso,{
  name:'continuous-cephalothorax',center:[0,1.31,-.05],
  radii:[.44,.36,.68],color:p.deep,light:p.skin,role:'spider-thorax',
  deform:.052,roughness:.43,metalness:.24
 });
 // A continuous low chest eliminates the empty gap between thorax and fangs.
 addBoss(g,torso,[0,1.16,.32],[.34,.28,.32],'shadow','spider-lower-chest');
 const abdomen=g.group('abdomen',[0,1.53,-.79]);
 const sz=[.79*big,.66*big,.90*big],z=-.18;
 texturedEllipsoid(g,abdomen,{
  name:'segmented-bulbous-abdomen',center:[0,0,z],radii:sz,
  color:p.deep,light:p.skin,role:'spider-abdomen',
  deform:.028,roughness:.39,metalness:.20
 });
 const plates=conceptDensity(g,13,10,7,4);
 const len=sz[2]*1.65,start=z-len/2,each=len/plates;
 for(let j=0;j<plates;j++){
  const from=start+j*each,to=from+each*.93;
  conformalCarapace(g,abdomen,{
   center:[0,0,z],radii:sz,start:from-z,end:to-z,
   color:p.skin,light:p.plate,role:'spider-dorsal-plates',
   crest:.13*big,wing:.86,lift:.034
  });
  for(const side of [-1,1]){
   const x=side*sz[0]*.53,zz=(from+to)/2;
   const q=(zz-z)/sz[2];
   const yy=sz[1]*Math.sqrt(Math.max(.06,1-(x/sz[0])**2-q*q));
   g.spike(abdomen,j%3===0?'light':'skin',[x,yy-.05,zz],
    [x+side*.13,yy+.13,zz-.07],.040*big);
  }
 }
 animatePlateHighlight(g,abdomen,z,sz,p,'venom');
 // The eye sockets are embedded in a broad carapace face, not stick-on googly eyes.
 const head=g.group('head',[0,1.38,.53]);
 const jaws=g.group('jaw',[0,1.19,.90]);
 texturedEllipsoid(g,head,{
  name:'armored-spider-face',center:[0,0,.13],
  radii:[.42,.34,.42],color:p.deep,light:p.skin,
  role:'spider-skull',roughness:.39,metalness:.22,deform:.065
 });
 const frontPlate=conformalCarapace(g,head,{
  center:[0,0,.16],radii:[.415,.34,.41],
  start:-.02,end:.25,role:'spider-forehead-armor',
  color:p.skin,light:p.plate,crest:.04,lift:.025,wing:.78
 });
 frontPlate.name='overlapping-crown-plate';
 for(const side of [-1,1]){
  const eyePattern=[
   [.16,.10,.50,.079],[.34,.10,.38,.047],
   [.10,.22,.46,.055],[.23,.255,.39,.041]
  ];
  for(const [x,y,zz,r] of eyePattern){
   g.sphere(head,'shadow',[side*x,y,zz-.018],
    [r*1.38,r*1.17,r*.47],{name:'chitinous-ocular-crest',rough:.60});
   g.sphere(head,'accent',[side*x,y,zz+.009],
    [r*.87,r*.83,r*.40],
    {name:'faceted-glowing-ocellus',glow:true,rough:.15,metal:.18});
   g.sphere(head,'bone',[side*(x-r*.17),y+r*.22,zz+r*.27],
    [r*.12,r*.09,r*.075],{name:'chitin-eye-glint',rough:.10});
  }
  // Rooted multi-segment curved fangs with tips pointing inward.
  texturedEllipsoid(g,jaws,{
   name:'mandible-fang-socket',center:[side*.19,0,.0],
   radii:[.14,.19,.17],role:'spider-fang-socket-'+(side<0?'l':'r'),
   color:p.deep,light:p.skin,deform:.025
  });
  sweepVolume(g,jaws,[
    [side*.18,.06,.03],[side*.25,-.08,.21],
    [side*.23,-.28,.44],[side*.10,-.40,.37]
   ],{
    name:'curved-venom-fang',role:'spider-ivory-fang',radius:.095,
    taper:.035,color:'#b9ad91',light:'#faf1d5',
    ridges:.06,roughness:.23,metalness:.05
   });
  for(let j=0;j<7;j++){
   const t=j/6;
   g.spike(head,j%2===0?'skin':'accent',
    [side*(.26+t*.12),-.13-t*.06,.31-t*.07],
    [side*(.38+t*.17),-.26-t*.09,.42-t*.03],.012);
  }
 }
 // Eight arthropod legs: coxa -> femur -> patella -> tibia -> tarsus.
 // Cohesive geometry overlaps every hinge, and each foot actually meets Y=0.
 const profiles=[
  {baseZ:.43,kneeZ:.74,footZ:1.26,x:1.36,y:.38},
  {baseZ:.17,kneeZ:.31,footZ:.54,x:1.55,y:.48},
  {baseZ:-.15,kneeZ:-.37,footZ:-.57,x:1.61,y:.42},
  {baseZ:-.44,kneeZ:-.81,footZ:-1.28,x:1.43,y:.32}
 ];
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const q=profiles[i],name='leg'+(side<0?'L':'R')+i;
  const base=g.group(name,[side*.36,1.29,q.baseZ]);
  // Coordinates of joints are expressed in parent space.
  const knee=[side*(q.x-.36),q.y,q.kneeZ-q.baseZ];
  const foot=[side*(q.x+.36-.36),-1.24,q.footZ-q.baseZ];
  const femur=g.group(name+'Femur',[0,0,0],base);
  addBoss(g,femur,[side*.06,.00,.01],[.17,.14,.17],'skin','buried-coxa-hip');
  sweepVolume(g,femur,[
   [0,0,0],[side*.26,.15,knee[2]*.40],
   [side*(q.x-.36)*.68,knee[1]*.87,knee[2]*.82],knee
  ],{
   name:'contoured-armored-femur',role:'spider-jointed-femur',
   radius:.137*(queen?1.11:1),taper:.76,color:p.deep,light:p.plate,
   ridges:.26,roughness:.40,metalness:.25
  });
  const patella=g.group(name+'Patella',knee,femur);
  addBoss(g,patella,[0,0,0],[.135,.135,.143],'skin','knee-joint-socket');
  addBoss(g,patella,[side*.035,.062,.00],[.12,.074,.12],
    'light','knee-overlapping-scutum');
  const distal=[foot[0]-knee[0],foot[1]-knee[1],foot[2]-knee[2]];
  const tibia=g.group(name+'Tibia',[0,0,0],patella);
  sweepVolume(g,tibia,[
   [0,0,0],[distal[0]*.24,distal[1]*.28,distal[2]*.24],
   [distal[0]*.67,distal[1]*.67,distal[2]*.67],distal
  ],{
   name:'contoured-barbed-tibia',role:'spider-jointed-tibia',
   radius:.105*(queen?1.12:1),taper:.25,color:p.deep,
   light:p.skin,ridges:.24,roughness:.37,metalness:.21
  });
  const tarsus=g.group(name+'Tarsus',distal,tibia);
  addBoss(g,tarsus,[0,0,0],[.058,.065,.063],'shadow','chitinous-tarsus');
  sweepVolume(g,tarsus,[
    [0,0,0],[side*.032,-.045,.08],
    [side*.05,-.13,.14],[side*.018,-.20,.18]
   ],{name:'ground-contact-hook-claw',
      role:'spider-ivory-tarsus',radius:.049,taper:.02,
      color:'#8a7a70',light:'#e3cfb4',roughness:.33});
  // Spines sit on the dorsal leg surface and move with the assigned joint.
  const thornCount=conceptDensity(g,7,5,3,1);
  for(let j=1;j<=thornCount;j++){
   const t=j/(thornCount+1);
   const center=[distal[0]*t,distal[1]*t,distal[2]*t];
   const lift=.065*(1-t);
   g.spike(tibia,j%3===0?'accent':'light',
    [center[0],center[1]+lift,center[2]],
    [center[0]+side*(.09+.035*(j%2)),
     center[1]+lift+.10,center[2]-.08],.028*(1-t*.3));
  }
 }
 g.root.scale.setScalar(s.size*.89*big);
 g.root.userData.conceptArchetype='curved-armored-arachnid';
 g.root.userData.anatomicalLegCount=8;
 g.root.userData.conceptElementStyle=style;
 g.root.userData.conceptV2ArtworkFeatures=[
  'large dorsally armored abdomen','eight clustered glowing eyes',
  'eight continuous articulated legs','curved organic fangs',
  'luminous abdomen cracks'
 ];
}

function crystalSlime(g,s){
 const torso=g.group('torso');
 slimeMembrane(g,torso,{name:'translucent-main-gel'});
 const head=g.group('head',[0,0,0]);
 // Contrasting frontal dark jaw silhouette matches the open-mouthed concept.
 addBoss(g,head,[0,.78,.711],[.30,.20,.055],
   'shadow','slime-mouth-recess');
 const lipPoints=[
  [-.30,.86,.74],[-.20,.70,.76],[-.09,.72,.775],
  [0,.66,.79],[.09,.72,.775],[.20,.70,.76],[.30,.86,.74]
 ];
 g.tube(head,'light',lipPoints,.037,{
  name:'jagged-fluid-mouth-rim',rough:.10,
  translucent:true,capEnds:true
 });
 for(const side of [-1,1]){
  // Crystal-clear horns emerge from and bend away from the same dome.
  sweepVolume(g,head,[
   [side*.39,1.33,.03],[side*.48,1.52,.03],
   [side*.61,1.78,.04],[side*.83,1.96,.02]
  ],{
    name:'transparent-gel-horn',role:'slime-glass-horn',
    radius:.175,taper:.015,ridges:0,
    color:'#269dc1',light:'#a6fff7',roughness:.075,
    transparent:true,opacity:.59
  });
  const eyeX=side*.23;
  addBoss(g,head,[eyeX,1.10,.615],[.17,.10,.041],
   'shadow','slime-inset-eye-aperture');
  addBoss(g,head,[eyeX,1.105,.652],[.105,.057,.016],
   'accent','slime-luminous-eye');
  // Brow projects a little and tapers to an angry outer corner.
  sweepVolume(g,head,[
   [side*.085,1.19,.629],[side*.20,1.21,.655],
   [side*.34,1.25,.593]],{
    name:'fluid-swept-eyebrow',role:'slime-brow',
    radius:.045,taper:.16,color:'#3782a9',
    light:'#93e9ed',roughness:.13,transparent:true,opacity:.75
   });
 }
 // Luminous central core: three concentric volumes and coiling currents.
 const core=g.group('core',[0,.76,.03],torso);
 g.sphere(core,'accent',[0,0,0],[.27,.27,.25],
  {name:'slime-internal-core',rough:.14,glow:true});
 g.sphere(core,'light',[0,0,.04],[.19,.19,.18],
  {name:'slime-inner-vortex',rough:.07,glow:true});
 const helixCount=conceptDensity(g,3,3,2,1);
 for(let arm=0;arm<helixCount;arm++){
  const points=[];
  for(let j=0;j<14;j++){
   const t=j/13,a=t*Math.PI*3+arm*TAU/helixCount,r=.13+.24*t;
   points.push([Math.sin(a)*r,(t-.5)*.52,Math.cos(a)*r]);
  }
  g.tube(core,'accent',points,.018,{
   name:'slime-spinning-magical-current',glow:true,
   rough:.12,tubularSegments:conceptDensity(g,64,40,24,12)
  });
 }
 const droplets=conceptDensity(g,26,18,11,6);
 for(let i=0;i<droplets;i++){
  const a=i*2.39996,rad=.35+(i%4)*.09;
  g.sphere(torso,i%4===0?'accent':'light',[
    rad*Math.cos(a),.38+(i%5)*.19,rad*Math.sin(a)],
   [.025+(i%3)*.011,.024+(i%4)*.006,.027+(i%2)*.008],
   {name:'suspended-internal-bubble',rough:.11,translucent:true,
   glow:i%4===0});
 }
 for(const side of [-1,1])for(let j=0;j<2;j++){
  // Real faceted crystal mesh, rotated into the flowing skirt.
  const geo=new THREE.OctahedronGeometry(.15+j*.025,1);
  const gem=placeMesh(g,torso,geo,'gel-embedded-crystal',
   'slime-gem',{color:j?'#c3ffff':'#52d5f6',roughness:.11,
     clearcoat:1,clearcoatRoughness:.045,metalness:.03});
  gem.position.set(side*(.66+j*.13),.28+j*.14,.25-j*.34);
  gem.rotation.set(.2+j*.18,side*.24,.12*side);
  gem.scale.set(.80,1.5,.84);
 }
 g.root.scale.setScalar(s.size*.98);
 g.root.userData.conceptArchetype='single-volume-liquid-slime';
 g.root.userData.anatomicalLegCount=0;
 g.root.userData.conceptV2ArtworkFeatures=[
  'continuous lobed transparent shell','two translucent horns',
  'deep face aperture','volumetric glowing spiral core',
  'embedded faceted crystals','interior bubbles'
 ];
}

function abyssalOctopus(g,s){
 const p=elements[s.id],kraken=s.id==='m049';
 const head=g.group('head',[0,1.48,.18]);
 const torso=g.group('torso');
 const mantle=g.group('mantle',[0,.42,-.54],head);
 // Head and mantle use two parts only because their true anatomy differs:
 // mantle is notably oversized and pushed backward, just like reference.
 texturedEllipsoid(g,head,{
  name:'cephalopod-head',center:[0,-.02,.12],
  radii:[.46,.43,.51],role:'octopus-cephalic-face',
  color:p.deep,light:p.skin,roughness:.31,metalness:.10,deform:.063
 });
 texturedEllipsoid(g,mantle,{
  name:'bulbous-octopus-mantle',center:[0,.14,-.34],
  radii:[.67,.69,.88],role:'octopus-bulbous-mantle',
  color:p.deep,light:p.skin,roughness:.29,metalness:.10,deform:.047
 });
 texturedEllipsoid(g,torso,{
  name:'continuous-tentacle-crown',center:[0,1.17,0],
  radii:[.48,.27,.48],role:'octopus-arm-base',
  color:p.deep,light:p.skin,roughness:.33,deform:.025
 });
 // Conformal overlapping armor and pointed crest above the enlarged mantle.
 const n=conceptDensity(g,9,7,5,3),back=-.34;
 for(let i=0;i<n;i++){
  const from=-.79+i*1.37/n,to=from+1.21/n;
  conformalCarapace(g,mantle,{
   center:[0,.14,back],radii:[.67,.69,.88],
   start:from,end:to,wing:.76,
   color:p.skin,light:p.plate,role:'octopus-armored-mantle',
   lift:.029,crest:.11
  }).name='overlapping-dorsal-mantle-armor';
  if(i%2===0)for(const side of [-1,1]){
   const z=back+(from+to)/2, x=side*.27;
   const dz=(z-back)/.88;
   const yy=.14+.69*Math.sqrt(Math.max(.03,1-(x/.67)**2-dz*dz));
   g.spike(mantle,'skin',[x,yy-.06,z],
    [x+side*.13,yy+.14,z-.10],.048);
  }
 }
 for(const side of [-1,1]){
  for(let j=0;j<3;j++){
   const x=side*(.18+j*.13),pts=[];
   for(let k=0;k<6;k++){
    const z=back-.65+k*.245,x2=x*(1+.13*Math.sin(k+j)),
      dz=(z-back)/.88;
    const yy=.14+.69*Math.sqrt(Math.max(.05,
      1-(x2/.67)**2-dz*dz))+.052;
    pts.push([x2,yy,z]);
   }
   g.tube(mantle,'accent',pts,.016,{
    name:'bioluminescent-mantle-line',glow:true,rough:.16,
    tubularSegments:conceptDensity(g,42,28,16,8)
   });
  }
  // Golden predatory almond eyes, black slitted pupil and buried orbit.
  const eyeX=side*.275;
  addBoss(g,head,[eyeX,.15,.504],[.169,.15,.085],
   'shadow','deep-eye-orbit');
  addBoss(g,head,[eyeX,.15,.551],[.115,.103,.061],
   '#eabd5e','predatory-golden-eye');
  addBoss(g,head,[eyeX,.152,.610],[.026,.088,.014],
   'shadow','vertical-cephalopod-pupil');
  sweepVolume(g,head,[
    [side*.13,.31,.48],[side*.28,.34,.54],
    [side*.45,.27,.43]
   ],{
    name:'heavy-octopus-eye-brow',role:'octopus-brow',
    radius:.077,taper:.26,color:p.skin,light:p.plate
   });
 }
 const jaw=g.group('jaw',[0,1.14,.46]);
 sweepVolume(g,jaw,[
   [0,.12,0],[0,-.05,.14],[0,-.18,.25]
  ],{name:'retracted-keratin-beak',role:'octopus-beak',
    radius:.15,taper:.035,color:'#98979c',light:'#e2d3c7',
    roughness:.27,ridges:.03});
 // Eight substantial curled tentacles, with actually concave sucker banks.
 // One merged mesh for each stage / rim / hole prevents 500+ Android draw calls.
 let suckerCount=0;
 const armRoots=[
  {phase:.18,rise:.15},{phase:1.04,rise:.17},
  {phase:1.87,rise:.22},{phase:2.67,rise:.13},
  {phase:3.48,rise:.20},{phase:4.24,rise:.09},
  {phase:5.08,rise:.24},{phase:5.79,rise:.10}
 ];
 for(let i=0;i<8;i++){
  const a=armRoots[i].phase,x=Math.sin(a),z=Math.cos(a);
  const key='tentacle'+i,root=g.group(key,[x*.35,1.17,z*.35]);
  const r=kraken?.195:.172;
  addBoss(g,root,[0,0,0],[r*1.22,r*1.20,r*1.25],
   'skin','continuous-octopus-arm-root');
  const p1=[x*(.71+i%2*.09),-.29,z*(.70+i%3*.04)];
  const mid=g.group(key+'Mid',p1,root);
  const p2=[x*(.79+(i%3)*.08),-.60,z*(.91+(i%2)*.10)];
  const tip=g.group(key+'Tip',p2,mid);
  const height=armRoots[i].rise;
  // Tip makes an upturned curl instead of simply ending in a straight rod.
  const tipPoints=[
   [0,0,0],[x*.24,-.12,z*.28],
   [x*.62,-.09,z*.63],[x*.80,height+.15,z*.75],
   [x*.60,height+.44,z*.50],[x*.32,height+.46,z*.24]
  ];
  const stages=[
   [root,[[0,0,0],[x*.16,-.10,z*.17],
      [x*.46,-.19,z*.49],p1],r,.86],
   [mid,[[0,0,0],[x*.24,-.23,z*.31],
      [x*.53,-.48,z*.61],p2],r*.85,.72],
   [tip,tipPoints,r*.66,.02]
  ];
  for(let j=0;j<stages.length;j++){
   const [parent,pts,width,taper]=stages[j];
   const sweep=sweepVolume(g,parent,pts,{
    name:'tapered-muscular-arm-'+i+'-'+j,
    role:'octopus-tentacle-skin',
    radius:width,taper,color:p.deep,light:p.plate,
    roughness:.29,metalness:.07,ridges:.13
   });
   if(j<2){
    const end=pts.at(-1);
    addBoss(g,parent,end,[width*.96,width*.95,width*.96],
      'skin','seamless-octopus-tentacle-joint');
   }
   suckerCount+=mergedSuckerRows(g,parent,sweep,{
    count:conceptDensity(g,14,11,7,3),rows:2,
    rolePrefix:'octopus-sucker',
    rimColor:'#82d5ce',centerColor:p.deep,scale:.91
   });
   // Bright bioluminescent stripes follow the dorsal surface of each arm.
   if(g.root.userData.detail!=='low'){
    const path=[];
    for(let k=0;k<8;k++){
     const t=k/7,point=sweep.curve.getPoint(t);
     path.push([point.x,point.y+sweep.radiusAt(t)*.84,
       point.z]);
    }
    g.tube(parent,'accent',path,.012+(kraken?.002:0),{
     name:'organic-arm-bioluminescence',glow:true,rough:.25,
     tubularSegments:conceptDensity(g,48,30,20,9)
    });
    const teeth=conceptDensity(g,9,7,4,0);
    for(let k=1;k<teeth;k++){
     const t=k/teeth,base=sweep.curve.getPoint(t),rNow=sweep.radiusAt(t);
     g.spike(parent,'light',
      [base.x,base.y+rNow*.74,base.z],
      [base.x+x*rNow*.35,base.y+rNow*1.30,base.z-z*rNow*.25],
      .028*(1-t*.6));
    }
   }
  }
 }
 g.root.scale.setScalar(s.size*(kraken?.91:.83));
 g.root.userData.conceptArchetype='armored-bioluminescent-cephalopod';
 g.root.userData.anatomicalTentacleCount=8;
 g.root.userData.mergedSuckerCount=suckerCount;
 g.root.userData.conceptV2ArtworkFeatures=[
  'giant rear bulbous mantle','layered spiny carapace',
  'golden slitted eyes','eight tapered muscular curling tentacles',
  'two rows of concave suction cups per tentacle','luminous dorsal grooves'
 ];
}
export function sculptConceptTrio(g,s){
 if(SPIDERS.has(s.id))armoredSpider(g,s);
 else if(s.id==='m046')crystalSlime(g,s);
 else if(OCTOPUSES.has(s.id))abyssalOctopus(g,s);
 else return false;
 g.root.userData.gameModelRevision=CONCEPT_TRIO_REVISION;
 g.root.userData.referenceArtworkDate='2026-11-21';
 g.root.userData.referenceMatch='physical-geometry-v2-pending-visual-approval';
 return true;
}
