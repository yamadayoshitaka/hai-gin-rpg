import {dragonCraniumProfile} from './dragon-cranium-profile.js';
import {sculptArticulatedReptileTail} from './m018-hydra-sculpt.js';

export const REPTILE_DETAIL_REVISION='reptile-sculpture-v2-20261121';
export const hasReptileDetail=id=>['m016','m017','m019','m020','m048'].includes(id);

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

export function sculptMarineFace(g,head,id){
 const ice=id==='m048',low=g.root.userData.detail==='low';
 const width=ice?.62:.74,length=ice?.82:.95;
 const rings=dragonCraniumProfile(width,ice?1.18:1.30,length,.04,.17)
  .reverse().map(([z,y,rx,ry])=>({z,y,rx,ry}));
 Object.assign(rings.at(-1),{rx:.12,ry:.118});
 g.axialLoft(head,'skin',rings,{name:'serpent-cranium-'+id,capEnds:true,ribbing:.026});
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
 for(const side of [-1,1]){
  const sign=side<0?'L':'R',x=width*.42,s=(a,b,c)=>[a*side,b,c];
  g.sphere(head,'shadow',s(x-.014,.094,.28),[.047,.043,.071],{name:id+'-eye-socket-'+sign});
  g.sphere(head,'eye',s(x+.025,.094,.286),[.021,.028,.041],{name:id+'-serpent-eye-'+sign,glow:true});
  g.sphere(head,'shadow',s(x+.045,.094,.292),[.005,.022,.012],{name:id+'-serpent-pupil-'+sign});
  g.sphere(head,'shadow',s(.119,-.036,.847),[.021,.012,.023],{name:id+'-nostril-'+sign});
  g.curvedHorn(head,ice?'bone':'light',s(.123,.125,.042),
   s(ice?.255:.275,ice?.286:.412,-.168),s(ice?.325:.502,ice?.345:.485,ice?-.355:-.54),
   ice?.078:.092,{name:id+'-rooted-horn-'+sign,capRoot:true});
  g.fin(head,'accent',s(.185,.085,-.01),
   s(ice?.442:.631,ice?.144:.315,ice?-.306:-.498),ice?.076:.139,{
    name:id+'-cheek-fin-'+sign,rough:.58,
   });
  for(let i=0;i<(low?1:3);i++){
   const z=.79-i*.125,x=.123+i*.014;
   g.curvedHorn(head,'bone',s(x,-.122,z),s(x,-.166,z+.003),
    s(x*.97,-.237+i*.014,z-.023),.021,{name:id+'-rooted-fang',capRoot:true});
  }
 }
}

export function sculptMarineTail(g,tail,id){
 const ice=id==='m048',low=g.root.userData.detail==='low';
 const radius=t=>.017+(ice?.184:.220)*(1-t)**.87;
 const rig=sculptArticulatedReptileTail(g,tail,{
  name:id+'-continuous-caudal-skin',radius,shade:'skin',
  path:[[0,0,.22],[0,.017,-.13],[.026,.030,-.44],[.099,-.037,-.80],
   [.169,-.079,-1.17],[.200,-.110,-1.47],[.197,.046,ice?-1.64:-1.83]],
 });
 surfaceSpines(g,tail,rig,radius,{id,count:low?4:7,
  shade:ice?'bone':'light',height:ice?.144:.175});
 const {tip,curve,tipLocal}=rig;
 const root=curve.getPointAt(.91).sub(tipLocal).toArray();
 for(const side of [-1,1]){
  const end=[root[0]+side*(ice?.226:.365),root[1]+(side<0?-.205:.278),root[2]-(ice?.30:.43)];
  g.fin(tip,'accent',root,end,ice?.106:.151,{
   name:id+'-caudal-fin-'+(side<0?'L':'R'),rough:.54,
  });
 }
}
