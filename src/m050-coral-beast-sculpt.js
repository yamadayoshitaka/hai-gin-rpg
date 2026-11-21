import {dragonCraniumProfile} from './dragon-cranium-profile.js';
import {sculptArticulatedReptileTail,sculptHydraLeg,sculptThroatScutes}
 from './m018-hydra-sculpt.js?v=m050-hydra-derived-coral-beast-v2-20261121';

export const M050_CORAL_REVISION='m050-hydra-derived-coral-beast-v1-20261121';

const coral=(g,parent,name,root,bend,tip,radius,shade='accent')=>
 g.curvedHorn(parent,shade,root,bend,tip,radius,{name,capRoot:true,rough:.69});

function sculptFace(g,head,low){
 const rings=dragonCraniumProfile(.68,1.15,.78,.01,.14).reverse()
  .map(([z,y,rx,ry])=>({z,y,rx,ry}));
 Object.assign(rings.at(-1),{rx:.103,ry:.107});
 g.axialLoft(head,'skin',rings,{name:'m050-dragon-skull',capEnds:true,ribbing:.02});
 g.axialLoft(head,'skin',[
  {z:.795,y:-.072,rx:.044,ry:.026},{z:.688,y:-.075,rx:.137,ry:.060},
  {z:.562,y:-.067,rx:.158,ry:.091},{z:.390,y:-.032,rx:.179,ry:.113},
  {z:.22,y:-.010,rx:.139,ry:.081},
 ],{name:'m050-sea-dragon-muzzle',capEnds:true});
 const jaw=g.group('jaw',[0,-.135,.11],head);
 g.axialLoft(jaw,'light',[
  {z:.649,y:-.031,rx:.041,ry:.026},{z:.545,y:-.048,rx:.119,ry:.048},
  {z:.381,y:-.052,rx:.158,ry:.068},{z:.197,y:-.029,rx:.175,ry:.077},
  {z:.011,y:-.004,rx:.131,ry:.063},
 ],{name:'m050-sea-dragon-jaw',capEnds:true});

 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  const point=(x,y,z)=>[side*x,y,z];
  g.sphere(head,'shadow',point(.267,.072,.253),[.031,.036,.062],{
   name:'m050-orbital-socket-'+suffix,
  });
  g.sphere(head,'eye',point(.295,.074,.253),[.016,.022,.038],{
   name:'m050-luminous-eye-'+suffix,glow:true,rough:.32,
  });
  g.sphere(head,'shadow',point(.309,.074,.259),[.004,.019,.011],{
   name:'m050-eye-pupil-'+suffix,
  });
  g.curvedHorn(head,'skin',point(.199,.122,.325),point(.301,.135,.253),
   point(.239,.137,.175),.032,{name:'m050-brow-ridge-'+suffix,capRoot:true});
  g.sphere(head,'shadow',point(.102,-.028,.706),[.021,.012,.023],{
   name:'m050-nostril-'+suffix,
  });

  // Fused branch roots overlap the primary coral horn at its thickest points.
  g.curvedHorn(head,'skin',point(.087,.104,.087),
   point(.148,.170,.054),point(.189,.219,-.022),.104,{
    name:'m050-coral-horn-socket-'+suffix,capRoot:true,rough:.76,
   });
  coral(g,head,'m050-coral-horn-'+suffix,point(.112,.096,.09),
   point(.265,.361,-.12),point(.383,.625,-.37),.090);
  coral(g,head,'m050-coral-fork-inner-'+suffix,point(.206,.302,-.079),
   point(.169,.437,-.150),point(.152,.528,-.223),.050,'#f2bd9f');
  coral(g,head,'m050-coral-fork-outer-'+suffix,point(.248,.385,-.145),
   point(.403,.427,-.246),point(.486,.532,-.312),.048,'#d9816a');
  if(!low)coral(g,head,'m050-coral-fork-tip-'+suffix,point(.310,.489,-.247),
   point(.345,.576,-.177),point(.366,.644,-.151),.029,'#f6c7ab');

  g.fin(head,'light',point(.162,.011,.027),point(.476,.105,-.394),.096,{
   name:'m050-cheek-fin-'+suffix,rough:.64,
  });
  for(let i=0;i<(low?1:3);i++){
   const z=.09-i*.086;
   g.curvedHorn(head,'light',point(.209,.034,z),point(.252,.058,z-.021),
    point(.274,.042,z-.086),.044,{
     name:'m050-overlapping-cheek-scale-'+suffix,capRoot:true,rough:.64,
    });
  }
  for(let i=0;i<(low?1:3);i++){
   const z=.62-i*.091,x=.116+i*.011;
   g.curvedHorn(head,'bone',point(x,-.107,z),point(x,-.151,z+.009),
    point(x*.98,-.210+i*.011,z-.009),.023,{
     name:'m050-rooted-upper-tooth-'+suffix,capRoot:true,
    });
  }
 }
}

export function sculptM050CoralBeast(g,spec){
 const low=g.root.userData.detail==='low';
 const torso=g.group('torso');
 g.axialLoft(torso,'skin',[
  {z:.825,y:1.335,rx:.145,ry:.163},{z:.650,y:1.33,rx:.380,ry:.323},
  {z:.285,y:1.31,rx:.493,ry:.404},{z:-.160,y:1.293,rx:.489,ry:.373},
  {z:-.530,y:1.284,rx:.372,ry:.285},{z:-.835,y:1.292,rx:.19,ry:.183},
 ],{name:'species-shoulder-rib-pelvis-m050',rough:.68,ribbing:.031,capEnds:true});

 const neck=g.group('m050Neck',[0,1.28,.40],torso);
 const path=[[0,-.073,-.083],[0,.216,.27],[0,.62,.36],
  [0,.99,.352],[0,1.19,.55],[0,1.20,.73]];
 const skin=g.tube(neck,'skin',path,.284,{
  name:'m050-long-neck',taper:.64,capEnds:true,
  tubularSegments:low?15:29,radialSegments:low?10:16,
 });
 sculptThroatScutes(g,neck,skin,{name:'m050-throat-scute',low});
 sculptFace(g,g.group('head',path.at(-1),neck),low);

 for(const side of [-1,1])for(const fore of [true,false]){
  const name=(fore?'front':'rear')+(side<0?'L':'R');
  const leg=g.group('leg'+name,[side*.301,1.19,fore?.49:-.49]);
  sculptHydraLeg(g,leg,name,side,fore,{speciesId:'m050'});
 }

 for(let i=0;i<(low?4:7);i++){
  const z=.41-i*(low?.245:.123),height=.242-.014*i;
  const x=i%2?.058:-.058;
  coral(g,torso,'m050-dorsal-coral',[x,1.54,z],[x*1.6,1.73,z-.047],
   [x*2.9,1.72+height,z-.134],.057-.003*i);
  if(!low)coral(g,torso,'m050-dorsal-coral-branch',[x*1.53,1.705,z-.05],
   [x*3.2,1.80,z-.075],[x*3.85,1.84,z-.119],.029);
 }

 for(const side of [-1,1])for(let i=0;i<3;i++){
  const z=.40-.265*i;
  g.fin(torso,'light',[side*.357,1.43,z],
   [side*(.66-.055*i),1.56-.052*i,z-.205],.126-.009*i,{
    name:'m050-flank-fin-'+(side<0?'L':'R'),rough:.62,
   });
 }
 const tail=g.group('tail',[0,1.295,-.635],torso);
 const {tip,curve:tailCurve,tipLocal}=sculptArticulatedReptileTail(g,tail,{
  name:'m050-continuous-caudal-skin',shade:'skin',radius:t=>.017+.234*(1-t)**.81,
  path:[[0,0,.27],[.024,-.035,-.135],[.067,-.082,-.49],
   [.213,-.10,-.91],[.331,-.03,-1.37],[.36,.08,-1.72],[.25,.179,-1.96]],
 });
 const finRoot=tailCurve.getPointAt(.91).sub(tipLocal);
 for(const side of [-1,1]){
  const reach=finRoot.clone().add(finRoot.clone().set(side*.325,.109,-.37));
  g.fin(tip,'light',finRoot.toArray(),reach.toArray(),.139,{
   name:'m050-forked-tail-fin-'+(side<0?'L':'R'),rough:.57,
  });
  if(!low){
   const rib=finRoot.clone().lerp(reach,.54);
   g.tube(tip,'accent',[finRoot.toArray(),rib.toArray(),reach.toArray()],.021,{
    name:'m050-caudal-fin-ray',taper:.17,capEnds:true,
    radialSegments:6,tubularSegments:9,
   });
  }
 }
 g.root.userData.m050HydraDerived=true;
 g.root.scale.setScalar(spec.size*.86);
}
