import {dragonCraniumProfile} from './dragon-cranium-profile.js';

export const M018_HYDRA_REVISION='m018-continuous-tail-venom-blades-v25-20261121';

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
  const rows=low?5:9;
  for(let i=0;i<rows;i++){
   const t=.16+.71*i/(rows-1);
   const center=curve.getPointAt(t),tangent=curve.getTangentAt(t);
   const rear=tangent.clone().set(0,0,-1);
   rear.addScaledVector(tangent,tangent.z).normalize();
   const surface=radius*(1-.35*t*t*(3-2*t));
   const height=.19+.09*Math.sin(t*Math.PI);
   sculptVenomBlade(g,neck,center,tangent,rear,surface,height,
    .049,'m018-neck-venom-spine-'+def.suffix,{socket:!low});
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

function sculptVenomBlade(g,parent,center,tangent,out,radius,height,width,name,{
 shade='accent',socket=false
}={}){
 const root=center.clone().addScaledVector(out,radius*.67);
 const shoulder=center.clone().addScaledVector(out,radius*.94);
 const bend=shoulder.clone().addScaledVector(out,height*.70)
  .addScaledVector(tangent,height*.40);
 const tip=shoulder.clone().addScaledVector(out,height*.84)
  .addScaledVector(tangent,height*.98);
 if(socket){
  g.curvedHorn(parent,'#47334e',root.clone().addScaledVector(tangent,-width*.31).toArray(),
   shoulder.clone().addScaledVector(out,height*.24).toArray(),
   shoulder.clone().addScaledVector(tangent,width*1.4).toArray(),width*1.32,
   {name:name+'-socket',rough:.76});
 }
 const blade=g.curvedHorn(parent,shade,root.toArray(),bend.toArray(),tip.toArray(),
  width,{name,rough:.47});
 // Flatten across the ridge and retain the sweep along the animal's back.
 const sideways=out.clone().cross(tangent).normalize();
 const positions=blade.geometry.getAttribute('position');
 const p=root.clone();
 for(let i=0;i<positions.count;i++){
  p.fromBufferAttribute(positions,i).sub(root);
  p.addScaledVector(sideways,-.48*p.dot(sideways)).add(root);
  positions.setXYZ(i,p.x,p.y,p.z);
 }
 positions.needsUpdate=true;
 blade.geometry.computeVertexNormals();
 blade.geometry.computeBoundingSphere();
 blade.userData.m018BuriedCrystalRoot=true;
 return blade;
}

export function sculptM018Tail(g,tail){
 const low=g.root.userData.detail==='low';
 // Broad tail base flows into a low sweeping curve and a rising, pointed tip.
 const path=[[0,-.023,.31],[0,.003,-.15],[.03,-.037,-.52],
  [.10,-.13,-.94],[.28,-.12,-1.39],[.51,.01,-1.77],
  [.67,.24,-2.04],[.68,.45,-2.20]];
 const radius=t=>.012+.275*(1-t)**.96;
 const tube=g.tube(tail,'tailScale',path,radius(0),{
  name:'m018-continuous-caudal-skin',capEnds:true,radiusProfile:radius,
  tubularSegments:low?20:40,radialSegments:low?10:18,rough:.72,
 });
 const geometry=tube.geometry,curve=geometry.parameters.path;
 const {tubularSegments,radialSegments}=geometry.parameters;
 const pos=geometry.getAttribute('position');
 const colors=[];
 const sideCount=(tubularSegments+1)*(radialSegments+1);
 for(let i=0;i<pos.count;i++){
  const t=i<sideCount?Math.floor(i/(radialSegments+1))/tubularSegments:
   i===sideCount?0:1;
  const blend=Math.min(1,t/.26);
  const value=.26+.74*blend*blend*(3-2*blend);
  colors.push(value,value,value);
 }
 geometry.setAttribute('color',new pos.constructor(colors,3));
 const midAt=.39,tipAt=.72,blend=.092;
 const midLocal=curve.getPointAt(midAt),tipLocal=curve.getPointAt(tipAt);
 const mid=g.group('tailMid',midLocal.toArray(),tail);
 const tip=g.group('tailTip',tipLocal.clone().sub(midLocal).toArray(),mid);
 const skin=g.skinAxialTube(tube,[{pivot:tail,at:0},
  {pivot:mid,at:midAt,blend},{pivot:tip,at:tipAt,blend}]);
 skin.userData.m018ContinuousTail=true;
 const pivots=[tail,mid,tip],offsets=[tail.position.clone().set(0,0,0),midLocal,tipLocal];
 const count=low?7:12;
 for(let i=0;i<count;i++){
  const t=.10+.85*i/(count-1);
  const region=t<midAt?0:t<tipAt?1:2;
  const point=curve.getPointAt(t).sub(offsets[region]),tangent=curve.getTangentAt(t);
  const normal=tangent.clone().set(0,1,0);
  normal.addScaledVector(tangent,-tangent.y).normalize();
  const shell=radius(t),height=.235*(1-t)+.045;
  const spine=sculptVenomBlade(g,pivots[region],point,tangent,normal,shell,height,
   Math.min(.065,shell*.51),'m018-caudal-venom-spike-'+region,
   {socket:!low,shade:i%3===0?'#6e3f8a':'accent'});
  spine.userData.m018TailFollow=true;
 }

}

export function sculptM018HydraThorns(g,torso,stations,{detail='high'}={}){
 const low=detail==='low',prototype=torso.position;
 const ridge=prototype.clone().set(0,0,-1),up=prototype.clone().set(0,1,0);
 const count=low?6:12;
 for(let i=0;i<count;i++){
  const t=i/(count-1),z=.51-t*1.12;
  const index=stations.findIndex(station=>station.z<=z);
  const [front,back]=[stations[index-1],stations[index]];
  const blend=(front.z-z)/(front.z-back.z);
  const y=front.y+(back.y-front.y)*blend;
  const shell=front.ry+(back.ry-front.ry)*blend;
  const side=i%2?-1:1;
  const center=prototype.clone().set(side*.062,y,z);
  const height=.24+.17*Math.sin(Math.PI*t);
  sculptVenomBlade(g,torso,center,ridge,up,shell,height,.067-.013*t,
   'm018-rooted-toxic-thorn-'+i,{socket:!low,shade:i%3===0?'#6e3f8a':'accent'});
  if(!low&&i%2===0)for(const rowSide of [-1,1]){
   const normal=prototype.clone().set(rowSide*.60,.80,0);
   sculptVenomBlade(g,torso,center,ridge,normal,shell*.88,height*.53,.055,
    'm018-secondary-dorsal-thorn',{shade:'#6e3f8a'});
  }
 }
}
