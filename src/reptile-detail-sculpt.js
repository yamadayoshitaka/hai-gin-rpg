import {dragonCraniumProfile} from './dragon-cranium-profile.js';
import {sculptArticulatedReptileTail} from './m018-hydra-sculpt.js';

export const REPTILE_DETAIL_REVISION='reptile-sculpture-v2-20261121';
export const hasReptileDetail=id=>['m016','m017','m019'].includes(id);
export const SEA_DRAGON_REVISION='sea-dragon-colossal-length-v4-20261121';
export const isSeaDragon=id=>id==='m020'||id==='m048';


function surfaceSpines(g,tail,rig,radius,{id,count,shade,height}){
 const {curve,mid,tip,midAt,tipAt,midLocal,tipLocal}=rig;
 const segments=[tail,mid,tip];
 const offsets=[tail.position.clone().set(0,0,0),midLocal,tipLocal];
 for(let i=0;i<count;i++){
  const t=.17+.71*i/(count-1),index=t<midAt?0:t<tipAt?1:2;
  const shell=radius(t);
  const center=curve.getPointAt(t).sub(offsets[index]);
  const tangent=curve.getTangentAt(t);
  const up=tangent.clone().set(0,1,0).addScaledVector(tangent,-tangent.y).normalize();
  const rise=height*(1-.67*t);
  const root=center.clone().addScaledVector(up,shell*.57);
  const bend=center.clone().addScaledVector(up,shell+rise*.62).addScaledVector(tangent,rise*.26);
  const point=center.clone().addScaledVector(up,shell+rise).addScaledVector(tangent,rise*.74);
  g.curvedHorn(segments[index],shade,root.toArray(),bend.toArray(),point.toArray(),
   Math.min(.063,shell*.44),{name:id+'-caudal-scute-'+i,capRoot:true});
 }
}

export function sculptSalamanderDetailTail(g,tail,id){
 const low=g.root.userData.detail==='low',lava=id==='m019',steel=id==='m017';
 const path=lava?
  [[0,-.01,.26],[0,.03,-.10],[.023,.051,-.46],[.049,-.01,-.83],
   [.089,-.038,-1.17],[.123,.031,-1.43],[.151,.276,-1.62],[.168,.526,-1.78]]:
  [[0,-.055,.24],[0,.008,-.124],[.035,.050,-.46],[.118,-.014,-.78],
   [.198,-.075,-1.05],[.182,-.072,-1.32],[.103,.052,-1.55]];
 const radius=t=>.013+(steel?.203:lava?.217:.181)*(1-t)**.93;
 const rig=sculptArticulatedReptileTail(g,tail,{
  name:id+'-continuous-caudal-skin',path,radius,shade:'skin',
 });
 surfaceSpines(g,tail,rig,radius,{id,count:low?4:steel?9:7,
  shade:steel?'bone':lava?'shadow':'skin',height:steel?.205:lava?.17:.09});
 if(lava){
  const {curve,tip,tipLocal}=rig;
  const seamPoints=[.80,.85,.89,.935,.979].map(t=>{
   const tangent=curve.getTangentAt(t);
   const up=tangent.clone().set(0,1,0).addScaledVector(tangent,-tangent.y).normalize();
   return curve.getPointAt(t).sub(tipLocal).addScaledVector(up,radius(t)*.98).toArray();
  });
  g.tube(tip,'accent',seamPoints,low?.005:.009,{
   name:'m019-molten-tail-tip',glow:!low,
  }).userData.m019SurfaceHeatChannel=true;
 }
}

export function sculptBasiliskFacePlates(g,head){
 for(const side of [-1,1]){
  const x=side*.264;
  for(let i=0;i<3;i++){
   const z=.205-.117*i;
   g.curvedHorn(head,'metal',[x*.85,.206-i*.013,z],
    [x,.254-i*.016,z-.034],[x*1.10,.225-i*.012,z-.106],.051,{
     name:'m017-steel-temple-scute',capRoot:true,rough:.59,
    });
  }
 }
}

function sculptMarineFace(g,head,id){
 const ice=id==='m048',low=g.root.userData.detail==='low';
 const width=ice?.62:.74,length=ice?.82:.95;
 const rings=dragonCraniumProfile(width,ice?1.18:1.30,length,.04,.17)
  .reverse().map(([z,y,rx,ry])=>({z,y,rx,ry}));
 Object.assign(rings.at(-1),{rx:.12,ry:.118});
 g.axialLoft(head,'skin',rings,{name:'serpent-cranium-'+id,capEnds:true,ribbing:.026,faceSculpt:true});
 g.axialLoft(head,'skin',[
  {z:.96,y:-.073,rx:.050,ry:.032},{z:.84,y:-.086,rx:.141,ry:.068},
  {z:.66,y:-.065,rx:.169,ry:.092},{z:.451,y:-.036,rx:.194,ry:.113},
  {z:.224,y:-.007,rx:.163,ry:.092},
 ],{name:id+'-marine-dragon-muzzle',capEnds:true});
 const jaw=g.group('jaw',[0,-.155,.15],head);
 g.axialLoft(jaw,'light',[
  {z:.786,y:-.023,rx:.046,ry:.023},{z:.68,y:-.039,rx:.120,ry:.043},
  {z:.47,y:-.047,rx:.17,ry:.065},{z:.23,y:-.035,rx:.19,ry:.077},
  {z:.021,y:-.012,rx:.141,ry:.065},
 ],{name:id+'-marine-dragon-jaw',capEnds:true});
 g.sphere(jaw,'shadow',[0,-.014,.44],[.147,.026,.272],{name:'quadruped-oral-cavity'});
 g.sphere(jaw,'light',[0,.002,.464],[.091,.015,.144],{name:'quadruped-tongue'});
 for(const side of [-1,1]){
  const sign=side<0?'L':'R',x=width*.42,s=(a,b,c)=>[a*side,b,c];
  g.sphere(head,'shadow',s(x-.014,.094,.28),[.047,.043,.071],{name:id+'-eye-socket-'+sign});
  g.sphere(head,'eye',s(x+.025,.094,.286),[.021,.028,.041],{name:id+'-serpent-eye-'+sign,glow:true});
  g.sphere(head,'shadow',s(x+.045,.094,.292),[.005,.022,.012],{name:id+'-serpent-pupil-'+sign});
  g.sphere(head,'shadow',s(.119,-.036,.847),[.021,.012,.023],{name:id+'-nostril-'+sign});
  g.curvedHorn(head,ice?'bone':'light',s(.123,.125,.042),
   s(ice?.274:.332,ice?.382:.54,-.184),s(ice?.38:.68,ice?.51:.64,ice?-.54:-.78),
   ice?.086:.115,{name:id+'-rooted-horn-'+sign,capRoot:true});
  const root=s(.154,.012,.031);
  const rays=[
   s(ice?.47:.72,ice?.17:.42,ice?-.31:-.44),
   s(ice?.64:.99,ice?.064:.24,ice?-.46:-.69),
   s(ice?.58:.91,ice?-.109:-.16,ice?-.51:-.77),
   s(ice?.34:.63,ice?-.206:-.32,ice?-.43:-.71),
  ];
  g.fanFin(head,'accent',root,rays,{name:id+'-cheek-fin-'+sign,camber:.096});
  for(const [i,end] of rays.entries()){
   if(low&&i%2)continue;
   const bend=root.map((v,axis)=>v*.43+end[axis]*.57+(axis===1?.034:0));
   g.curvedHorn(head,i===0?'bone':'light',root,bend,end,.034-i*.004,{
    capRoot:true,name:id+'-gill-ray-'+sign+'-'+i,
   });
  }
  g.curvedHorn(head,'shadow',s(.146,.135,.435),s(x+.046,.172,.28),
   s(x*.84,.221,.121),.044,{capRoot:true,name:id+'-armored-brow-'+sign});
  g.curvedHorn(head,'light',s(.079,.192,.268),s(.146,.283,.16),
   s(.218,.406,-.045),.052,{capRoot:true,name:id+'-cranial-crest-'+sign});
  for(let i=0;i<(low?1:3);i++){
   const z=.79-i*.125,x=.123+i*.014;
   g.curvedHorn(head,'bone',s(x,-.122,z),s(x,-.166,z+.003),
    s(x*.97,-.276+i*.023,z-.031),i===0?.030:.023,{name:id+'-rooted-fang',capRoot:true});
  }
 }
}

const SEA_SPINE=[
 [-.31,3.30,1.31],[-.49,3.12,.87],[-.74,2.57,.61],[-.78,1.82,.42],
 [-.53,1.16,.13],[.25,.82,-.58],[1.14,.82,-1.58],[1.39,.98,-2.73],
 [1.07,1.19,-3.85],[.23,1.29,-4.82],[-.63,1.46,-5.60],[-1.15,1.83,-6.45],
];
const SHELL_RADII=[[0,.182],[.13,.270],[.31,.366],[.43,.402],
 [.59,.340],[.73,.238],[.87,.153],[1,.026]];

function radiusAlong(t,ice){
 for(let i=1;i<SHELL_RADII.length;i++){
  const [end,radius]=SHELL_RADII[i];
  if(t>end)continue;
  const [start,previous]=SHELL_RADII[i-1];
  const u=(t-start)/(end-start);
  return (previous+(radius-previous)*u*u*(3-2*u))*(ice?.83:1);
 }
 return .026;
}

function sculptSeaScales(tube,curve,ice){
 const {geometry}=tube,{tubularSegments,radialSegments}=geometry.parameters;
 const pos=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 const stride=radialSegments+1;
 const color=tube.material.color.clone();
 const back=color.clone().set(ice?'#26385e':'#132e56');
 const flank=color.clone().set(ice?'#4182b0':'#228799');
 const belly=color.clone().set(ice?'#a0c5d4':'#9accc3');
 const ramp=(x,a,b)=>Math.max(0,Math.min(1,(x-a)/(b-a)));
 const colors=[];
 const direction=curve.getPointAt(0);
 for(let row=0;row<=tubularSegments;row++){
  const t=row/tubularSegments;
  const center=curve.getPointAt(t),tangent=curve.getTangentAt(t);
  const ventral=tangent.clone().set(0,-1,.65);
  ventral.addScaledVector(tangent,-ventral.dot(tangent)).normalize();
  for(let col=0;col<=radialSegments;col++){
   const i=row*stride+col;
   direction.fromBufferAttribute(pos,i).sub(center);
   const radius=direction.length();
   direction.normalize();
   const side=direction.dot(ventral);
   const stripe=.5+.5*Math.cos(t*(ice?23:18)*Math.PI*2+side*2.3);
   const rim=ramp(side,.14,.37),scale=ramp(side,.46,.76);
   color.copy(back).lerp(flank,rim).lerp(belly,scale);
   const band=ice?.29:.22;
   color.multiplyScalar(1-band*Math.pow(stripe,7)*scale+.035*Math.sin(t*72+col*2.5)*(1-scale));
   colors.push(...color.toArray());
   direction.multiplyScalar(radius+(.014-.025*Math.pow(stripe,7))*scale)
    .add(center);
   pos.setXYZ(i,direction.x,direction.y,direction.z);
   // Stock tube UVs are longitudinal in X. Keep scale size roughly uniform.
   uv.setX(i,t*2.1);
  }
 }
 colors.push(...flank.toArray(),...back.toArray());
 geometry.setAttribute('color',new pos.constructor(colors,3));
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
}

function sculptSeaBodyFins(g,curve,joints,radius,id,low){
 const ice=id==='m048';
 // Detail roots follow the nearest joint and sit well below the convex skin.
 const locations=low?[.16,.29,.48,.64,.80]:[.10,.16,.23,.30,.38,.46,.54,.63,.72,.81,.89];
 const center=new Map(joints.map(({at,pivot})=>[pivot,curve.getPointAt(at)]));
 const torso=joints.find(({pivot})=>pivot.name==='torso').pivot;
 center.get(torso).set(0,0,0);
 for(const [i,t] of locations.entries()){
  const {pivot}=joints.reduce((best,joint)=>
   Math.abs(joint.at-t)<Math.abs(best.at-t)?joint:best);
  // The head has its own plate and fin silhouette. Do not attach a body ridge to its yaw.
  const owner=pivot.name==='head'?joints[1].pivot:pivot;
  const point=curve.getPointAt(t).sub(center.get(owner));
  const tangent=curve.getTangentAt(t);
  const rear=tangent.clone().set(0,1,-.65);
  rear.addScaledVector(tangent,-rear.dot(tangent)).normalize();
  const r=radius(t),height=(ice?.199:.343)*(1-t*.67);
  const root=point.clone().addScaledVector(rear,r*.60);
  const end=point.clone().addScaledVector(rear,r+height)
   .addScaledVector(tangent,height*.63);
  const bend=root.clone().lerp(end,.58).addScaledVector(rear,height*.24);
  g.curvedHorn(owner,ice?'bone':'light',root.toArray(),bend.toArray(),end.toArray(),
   Math.min(.087,r*.44),{capRoot:true,name:id+'-dorsal-keel-'+i});
 }
 const breast=curve.getPointAt(.348);
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  const reach=ice?.74:1.16;
  const root=[breast.x+side*.12,breast.y+.035,breast.z];
  const rays=[[side*reach,ice?.33:.64,-.50],[side*(reach+.15),.25,-.94],
   [side*(reach-.04),-.19,-1.03],[side*.35,-.24,-.76]]
   .map(([x,y,z])=>[breast.x+x,breast.y+y,breast.z+z]);
  g.fanFin(torso,'accent',root,rays,{name:id+'-pectoral-sail-'+suffix,camber:.105});
  for(const [i,end] of rays.entries()){
   if(low&&i%2)continue;
   const mid=root.map((v,axis)=>v*.50+end[axis]*.50+(axis===1?.094:0));
   g.curvedHorn(torso,'light',root,mid,end,.052-i*.006,{
    capRoot:true,name:id+'-pectoral-fin-ray-'+suffix,
   });
  }
 }
}

export function sculptSeaDragon(g,spec){
 const id=spec.id,ice=id==='m048',low=g.root.userData.detail==='low';
 const torso=g.group('torso');
 const path=ice?SEA_SPINE.map(([x,y,z])=>[x*.71,y*.81,z*.91]):SEA_SPINE;
 const radius=t=>radiusAlong(t,ice);
 const tube=g.tube(torso,'seaDragonSkin',path,radius(0),{
  name:id+'-marine-serpent-skin',capEnds:true,radiusProfile:radius,
  tubularSegments:low?42:80,radialSegments:low?11:20,rough:.66,
 });
 const curve=tube.geometry.parameters.path;
 sculptSeaScales(tube,curve,ice);
 const at=(name,t,parent,offset)=>g.group(name,curve.getPointAt(t).sub(offset).toArray(),parent);
 const origin=torso.position;
 const neck=at('marineNeck',.166,torso,origin);
 const head=at('head',0,neck,neck.position);
 const spine=at('spineRear',.49,torso,origin);
 const tail=at('tail',.636,spine,spine.position);
 const mid=at('tailMid',.777,tail,curve.getPointAt(.636));
 const tip=at('tailTip',.892,mid,curve.getPointAt(.777));
 const joints=[
  {pivot:head,at:0},{pivot:neck,at:.166,blend:.066},
  {pivot:torso,at:.323,blend:.078},{pivot:spine,at:.49,blend:.064},
  {pivot:tail,at:.636,blend:.052},{pivot:mid,at:.777,blend:.052},
  {pivot:tip,at:.892,blend:.049},
 ];
 g.skinAxialTube(tube,joints);
 sculptMarineFace(g,head,id);
 sculptSeaBodyFins(g,curve,joints,radius,id,low);
 const root=curve.getPointAt(.95).sub(curve.getPointAt(.892));
 const spread=ice?.38:.58;
 for(const side of [-1,1]){
  const w=ice?.122:.181;
  const end=root.clone().add(root.clone().set(side*spread,side<0?-.36:.56,-.44));
  g.fin(tip,'accent',root.toArray(),end.toArray(),w,{
   name:id+'-caudal-fin-'+(side<0?'L':'R'),rough:.58,
  });
 }
 g.root.userData.seaDragonSilhouette=true;
 g.root.scale.setScalar(spec.size*.87);
}
