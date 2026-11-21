import {dragonCraniumProfile} from './dragon-cranium-profile.js';

export const M018_HYDRA_REVISION='m018-armored-four-cell-hydra-v24-20261121';

const NECKS=[
 {suffix:'L',side:-1,scale:.89,neckHeight:1.54,spread:.99,rootX:-.24,rootZ:.24},
 {suffix:'C',side:0,scale:1.04,neckHeight:2.17,spread:0,rootX:0,rootZ:.45},
 {suffix:'R',side:1,scale:.89,neckHeight:1.54,spread:.99,rootX:.24,rootZ:.24},
];

function dragonCranium(g,neck,definition,end,{detail='high'}={}){
 const low=detail==='low',suffix=definition.suffix;
 const side=definition.side;
 const skull=g.group('hydraSkull'+suffix,end,neck);
 skull.rotation.y=side*.48;
 skull.userData.restYaw=skull.rotation.y;
 skull.scale.setScalar(definition.scale);
 skull.userData.m018DragonFace=true;
 skull.userData.m018TrueNeckEnd=true;
 const stations=dragonCraniumProfile(.59,1.22,.84,.035,.067)
  .reverse().map(([z,y,rx,ry])=>({z,y,rx,ry}));
 // The donor nape opens into the hydra's larger cervical socket.
 stations.at(-1).rx=.104;
 stations.at(-1).ry=.102;
 const cranium=g.axialLoft(skull,'skin',stations,{
  name:'m018-dragon-cranium-'+suffix,rough:.71,ribbing:.029,capEnds:true,
 });
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
   [s*.210,.078,.238],[.025,.025,.053],
   {name:'m018-dragon-eye-'+suffix+(s<0?'-L':'-R'),rough:.26,glow:true});
  eye.userData.m018InsetToxicIris=true;
  g.sphere(skull,'shadow',
   [s*.232,.078,.248],[.0045,.022,.012],
   {name:'m018-dragon-pupil-'+suffix+(s<0?'-L':'-R')});
  const brow=g.curvedHorn(skull,'skin',
   [s*.154,.107,.337],[s*.211,.129,.245],
   [s*.229,.147,.055],.034,
   {name:'m018-armored-brow-'+suffix+(s<0?'-L':'-R'),rough:.82});
  brow.userData.m018DragonBrow=true;
  // Genuine swept-back keratin horns rooted behind both temples.
  const horn=g.curvedHorn(skull,'accent',
   [s*.165,.145,-.093],[s*.268,.363,-.26],
   [s*.378,.401,-.58],.076,
   {name:'m018-dragon-horn-'+suffix+(s<0?'-L':'-R'),rough:.72});
  horn.userData.m018RootedDragonHorn=true;
  g.curvedHorn(skull,'light',
   [s*.160,.013,.044],[s*.253,.035,-.102],
   [s*.340,.082,-.285],.052,{name:'m018-dragon-cheek-spur-'+suffix});
  if(!low){
   g.curvedHorn(skull,'skin',[s*.143,.010,.361],
    [s*.217,.031,.206],[s*.238,.087,.021],.046,
    {name:'m018-cheek-scale-ridge'});
   g.curvedHorn(skull,'#57316d',[s*.106,.142,.117],
    [s*.141,.225,.027],[s*.174,.278,-.17],.033,
    {name:'m018-orbital-crest'});
  }
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
   if(!low||tooth===0)g.curvedHorn(jaw,'bone',
    [s*(.095+tooth*.023),-.034,z],[s*(.100+tooth*.023),.010,z-.012],
    [s*(.098+tooth*.023),.041,z-.027],.015,
    {name:'m018-lower-fang-'+suffix});
  }
 }
 // Poison crystals follow the skull's rearward sweep.
 for(let i=0;i<(low?2:4);i++){
  const z=.03-i*.115,rootY=.258-i*.015;
  const thorn=g.curvedHorn(skull,i%2===0?'accent':'#57316d',
   [0,rootY-.059,z],[.009,rootY+.048,z-.065],
   [i%2?.018:-.018,rootY+.207-i*.020,z-.13],
   .031,{name:'m018-toxic-cranial-thorn-'+suffix+'-'+i});
  thorn.userData.m018HeadCrystal=true;
 }
 return {skull,jaw};
}

function sculptThroatScutes(g,neck,path,curve,radius,suffix,low){
 // Use a single mesh with overlaps at the edges of the ventral plates.
 const plateMesh=g.tube(neck,'light',path,radius,{
  name:'m018-throat-scute-'+suffix,tubularSegments:4,radialSegments:4,
 });
 const geometry=plateMesh.geometry;
 const Position=geometry.getAttribute('position').constructor;
 const positions=[],uv=[],indices=[];
 const count=low?9:15,bands=low?5:9;
 for(let plate=0;plate<count;plate++){
  const start=.105+.790*plate/count;
  const end=start+.790/count*1.15;
  const first=positions.length/3;
  for(let row=0;row<3;row++){
   const depth=row/2;
   for(let col=0;col<=bands;col++){
    const across=col/bands*2-1;
    const t=start+(end-start)*depth+(.021-.010*depth)*(1-across*across);
    const center=curve.getPointAt(t),tangent=curve.getTangentAt(t);
    const forward=tangent.clone().set(0,0,1);
    forward.addScaledVector(tangent,-tangent.z).normalize();
    const outward=forward.clone().cross(tangent);
    const angle=across*(.93-.10*depth);
    const shell=radius*(1-.35*t*t*(3-2*t));
    // The low-LOD tube is faceted, so allow clearance for the outer corners
    // of each plate as it spans the curve between neighboring tube rings.
    const rise=shell*(1.035+.042*Math.sin(depth*Math.PI));
    center.addScaledVector(forward,rise*Math.cos(angle));
    center.addScaledVector(outward,rise*Math.sin(angle));
    positions.push(...center.toArray());
    uv.push(col/bands,t);
    if(row>0&&col>0){
     const i=first+row*(bands+1)+col;
     indices.push(i-bands-2,i-1,i-bands-1,i-bands-1,i-1,i);
    }
   }
  }
 }
 geometry.setAttribute('position',new Position(positions,3));
 geometry.setAttribute('uv',new Position(uv,2));
 geometry.deleteAttribute('normal');
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
}

export function sculptM018Hydra(g,torso,centralHead,{detail='high'}={}){
 const low=detail==='low';
 if(!torso||!centralHead)throw Error('m018 requires original torso and head pivots');
 for(const def of NECKS){
  const neck=def.suffix==='C'?centralHead:g.group(
   'hydraHead'+def.suffix,
   [def.rootX,1.245,def.rootZ],torso);
  const {side,spread,neckHeight}=def;
  neck.userData.m018IndependentNeck=true;
  neck.userData.m018NeckLength=neckHeight;
  neck.userData.m018DragonHeads=3;
  const path=[
   [0,-.12,-.09],
   [side*.11,.26,.13],
   [side*.32,neckHeight*.47,.32],
   [side*.63,neckHeight*.83,.20],
   [side*(spread-.01),neckHeight+.12,.28],
   [side*spread,neckHeight,.55],
  ];
  const tube=g.tube(neck,'skin',path,side===0?.269:.229,{
   name:'m018-long-neck-'+def.suffix,
   taper:.65,capEnds:true,
   tubularSegments:low?16:32,radialSegments:low?10:16
  });
  tube.userData.m018ContinuousNeck=true;
  tube.userData.m018NeckSource='m018-existing-torso';
  tube.userData.m018NeckLength=def.neckHeight;
  const curve=tube.geometry.parameters.path;
  const radius=side===0?.269:.229;
  sculptThroatScutes(g,neck,path,curve,radius,def.suffix,low);
  const rows=low?5:11;
  for(let i=0;i<rows;i++){
   const t=.15+.70*i/(rows-1);
   const center=curve.getPointAt(t),tangent=curve.getTangentAt(t);
   const forward=tangent.clone().set(0,0,1);
   forward.addScaledVector(tangent,-tangent.z).normalize();
   const surface=radius*(1-.35*t*t*(3-2*t));
   if(low&&i%2!==0)continue;
   const anchor=center.clone().addScaledVector(forward,-surface*.87);
   const bend=anchor.clone().addScaledVector(forward,-.094)
    .addScaledVector(tangent,-.033);
   const tip=anchor.clone().addScaledVector(forward,-.19)
    .addScaledVector(tangent,-.134);
   g.curvedHorn(neck,'accent',anchor.toArray(),bend.toArray(),tip.toArray(),
    surface*.23,{name:'m018-neck-venom-spine-'+def.suffix,rough:.39});
  }
  dragonCranium(g,neck,def,path.at(-1),{detail});
 }
 g.root.userData.m018HydraRevision=M018_HYDRA_REVISION;
 g.root.userData.m018DragonHeadCount=3;
 g.root.userData.m018AllHeadsAnimate=true;
 g.root.userData.m018LongestNeck=NECKS[1].neckHeight;
 g.root.userData.m018ExistingTorsoLegsTailPreserved=true;
 g.root.userData.m018PhysicalDragonHeads=true;
}

export function sculptM018Leg(g,leg,name,side,fore){
 // Bury the proximal joint into the same rib cage. Bend the upper limb
 // outwards into a broad, lower, claw-bearing reptilian stance.
 leg.position.y=1.19;
 const joint=[side*.29,-.54,fore?-.10:.16];
 const lower=g.group('lower'+name,joint,leg);
 const palm=[side*.06,-.57,fore?.23:.19];
 const thighWidth=fore?.207:.251;
 g.limbLoft(leg,'skin',[
  {x:side*-.06,y:.22,z:fore?.028:-.105,rx:.126,rz:.145},
  {x:side*.025,y:.105,z:fore?.035:-.106,rx:thighWidth,rz:thighWidth*1.08},
  {x:side*.105,y:-.090,z:fore?-.008:-.031,rx:thighWidth*.98,rz:thighWidth*1.02},
  {x:side*.225,y:-.365,z:joint[2]*.81,rx:.164,rz:.169},
  {x:joint[0],y:joint[1]-.081,z:joint[2],rx:.127,rz:.132},
 ],{name:'m018-continuous-upper-'+name});
 g.limbLoft(lower,'skin',[
  {x:0,y:.134,z:0,rx:.123,rz:.129},
  {x:side*.013,y:-.045,z:.012,rx:.146,rz:.149},
  {x:side*.036,y:-.172,z:.033,rx:.125,rz:.123},
  {x:palm[0],y:-.390,z:palm[2]*.60,rx:.090,rz:.102},
  {x:palm[0],y:palm[1]+.011,z:palm[2],rx:.103,rz:.109},
 ],{name:'m018-continuous-lower-'+name});
 const toe=g.group('toe'+name,palm,lower);
 g.sphere(toe,'skin',[0,-.010,.037],[.150,.070,.169],{name:'m018-palm-'+name});
 const digits=g.root.userData.detail==='low'?3:4;
 for(let digit=0;digit<digits;digit++){
  const x=(digit-(digits-1)/2)*.069,z=.139-.028*Math.abs(x)/.1035;
  const flesh=g.bridge(toe,'skin',[x*.59,.004,.053],[x,-.018,z+.044],.041,.031);
  flesh.name='m018-digit-'+name;
  g.curvedHorn(toe,'bone',[x,-.009,z+.012],[x*1.12,-.016,z+.088],
   [x*1.22,-.061,z+.131],.027,{name:'m018-rooted-talon-'+name});
 }
}

export function sculptM018Tail(g,tail){
 const low=g.root.userData.detail==='low';
 const sections=[
  {path:[[0,-.015,.19],[0,.022,-.32],[.04,.045,-.82],[.07,.045,-1.00]],radius:.232,taper:.60},
  {path:[[0,0,.17],[.08,.04,-.31],[.22,.11,-.73],[.27,.16,-.86]],radius:.158,taper:.40},
  {path:[[0,-.02,.17],[.10,.11,-.22],[.19,.31,-.50],[.20,.41,-.58]],radius:.081,taper:.12},
 ];
 const mid=g.group('tailMid',[.04,.045,-.82],tail);
 const tip=g.group('tailTip',[.22,.11,-.73],mid);
 for(const [index,pivot] of [tail,mid,tip].entries()){
  const {path,radius,taper}=sections[index];
  const skin=g.tube(pivot,'skin',path,radius,{
   name:'m018-closed-caudal-skin-'+index,taper,capEnds:true,
   tubularSegments:low?10:22,radialSegments:low?9:15,
  });
  const curve=skin.geometry.parameters.path;
  const count=low?3:5;
  for(let i=0;i<count;i++){
   const t=.18+.67*i/(count-1),p=curve.getPointAt(t);
   const shell=radius*(1+(taper-1)*t*t*(3-2*t));
   const height=.24-index*.065;
   const x=p.x,y=p.y+shell*.79,z=p.z;
   const spine=g.curvedHorn(pivot,'accent',[x,y,z],
    [x+.018,y+height*.62,z-.051],[x+.041,y+height,z-.13],
    Math.min(.054,shell*.42),{name:'m018-caudal-venom-spike-'+index});
   spine.userData.m018TailFollow=true;
  }
 }
}

export function sculptM018HydraThorns(g,torso,{detail='high'}={}){
 const low=detail==='low';
 const count=low?6:12;
 for(let i=0;i<count;i++){
  const t=i/(count-1),z=.60-t*1.20;
  const y=1.62-.048*t,side=i%2?-1:1;
  const height=(low?.22:.34)*(.55+.45*Math.sin(Math.PI*t));
  const spine=g.curvedHorn(torso,i%3===0?'#57316d':'accent',
   [side*.073,y-.050,z],[side*.089,y+height*.57,z-.035],
   [side*.110,y+height,z-.13],low?.038:.052,
   {name:'m018-rooted-toxic-thorn-'+i,rough:.58});
  spine.userData.m018BuriedCrystalRoot=true;
  if(!low&&i%2===0)for(const rowSide of [-1,1]){
   const x=rowSide*(.172-.049*t);
   g.curvedHorn(torso,'#57316d',[x,y-.090,z-.039],
    [x+rowSide*.095,y+.035,z-.097],[x+rowSide*.125,y+.090,z-.198],
    .038,{name:'m018-secondary-dorsal-thorn'});
  }
 }
}
