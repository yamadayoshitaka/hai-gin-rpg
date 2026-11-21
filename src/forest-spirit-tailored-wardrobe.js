/**
 * The Forest Spirit's actual bone-following ranger couture.
 *
 * Replaces the generic cone-shaped grass/leaf uniform, not its underlying
 * licensed human GLB. The outer leaf canopy is owned by
 * female-summon-costumes.js and remains a separate anatomical layer.
 * Curved tailoring, leather footwear and differentiated fabric are shared
 * across high/low mobile LOD.
 */
import * as THREE from 'three';
import {
 createRegalBodiceGeometry,createRegalShoulderYokeGeometry,
 createRegalCollarGeometry,createRegalSkirtGeometry,createRegalLimbGeometry
} from './monster-regal-garments.js';
import {createSeraphShoeGeometry} from './seraph-celestial-wardrobe.js';

export const FOREST_SPIRIT_TAILORED_REVISION=
 'forest-bone-fitted-fern-silk-and-leather-v2-20261122';

function panel({detail='high',side=0,layer=0}={}){
 const rows=detail==='low'?5:17,columns=detail==='low'?4:12;
 const pos=[],uv=[],idx=[];
 for(let i=0;i<=rows;i++){
  const t=i/rows,length=layer?.73:.85;
  const width=(side?(.105+.060*t):(.146+.072*t))*
   (1+.018*Math.sin(t*12));
  const x0=side* (.22+.13*t*t);
  for(let j=0;j<=columns;j++){
   const u=j/columns*2-1;
   // A scalloped, overlapping fabric apron with a natural gravity drape,
   // not a rectangular front-face decal.
   const x=x0+u*width+.008*Math.sin(t*8+side)*t;
   const y=.06-length*t-.013*t*t*(1-u*u);
   const z=-((side?.15:.228)+(.20+layer*.025)*t*t)-
    .014*Math.sin(Math.PI*j/columns)*(1-t*.35);
   pos.push(x,y,z);
   uv.push(j/columns,t);
   if(i<rows&&j<columns){
    const a=i*(columns+1)+j,b=a+columns+1;
    idx.push(a,b,a+1,a+1,b,b+1);
   }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(idx);g.computeVertexNormals();
 g.userData={kind:'forest-curved-embroidered-apron',detail,side,layer};
 return g;
}
function halfCape({detail='high',side=1}={}){
 const rows=detail==='low'?5:15,cols=detail==='low'?4:10;
 const p=[],uv=[],idx=[];
 for(let i=0;i<=rows;i++){
  const t=i/rows;
  for(let j=0;j<=cols;j++){
   const u=j/cols;
   const x=side*(.15+u*(.125+.13*t)+.015*Math.sin(Math.PI*t));
   const y=.27-.68*t-.018*Math.sin(Math.PI*u)*t;
   const z=.09+.105*t+.045*u+.022*Math.sin(t*7+u*5)*t;
   p.push(x,y,z);uv.push(u,t);
   if(i<rows&&j<cols){
    const a=i*(cols+1)+j,b=a+cols+1;
    idx.push(a,b,a+1,a+1,b,b+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeVertexNormals();
 geo.userData={kind:'forest-soft-woven-back-cape',detail,side};
 return geo;
}
export function addForestSpiritTailoredOutfit({
 profile,frames,detail='high',attach,tube
}={}){
 if(profile?.costume!=='forest_spirit_female')return false;
 if(!frames?.chest||!frames?.pelvis||frames.arms?.length!==2||
  frames.forearms?.length!==2||frames.legs?.length!==2||
  frames.calves?.length!==2||frames.feet?.length!==2)
  throw Error('Forest robe requires 2 native animated arms, legs and feet');
 const hi=detail!=='low';
 const add=(anchor,g,role,name,p=[0,0,0],r=[0,0,0])=>
  attach(anchor,g,role,'regal-forest-'+name,p,r);
 const seam=(anchor,role,name,points,r=.004)=>{
  if(tube)tube(anchor,role,'regal-forest-'+name,points,r);
 };
 // Forest cloth should remain a garment, not flat solid green leaves
 // painted onto an oversized solid green bell/cone.
 add(frames.chest,createRegalBodiceGeometry({detail}),
  'forestSilk','fitted-fern-silk-bodice');
 add(frames.chest,createRegalShoulderYokeGeometry({detail}),
  'forestSilk','shoulder-tailored-layer');
 add(frames.chest,createRegalCollarGeometry({detail}),
  'forestLeatherTrim','forest-collar');
 add(frames.pelvis,createRegalSkirtGeometry({
  detail,length:.80,flare:.255,style:'forest'
 }),'forestSilk','forest-silk-underskirt');
 // Three curved fabric aprons are staggered beneath the separately
 // attached leaves (leaves remain on original pelvis moving bone).
 add(frames.pelvis,panel({detail,side:0}), 'forestBrocade',
  'front-embroidered-mantle');
 for(const side of [-1,1]){
  const i=side<0?0:1;
  add(frames.pelvis,panel({detail,side,layer:1}),
   'forestSilk','split-side-drape-'+side);
  add(frames.chest,halfCape({detail,side}),
   'forestSilk','soft-woodland-back-drape-'+side);
  add(frames.arms[i],createRegalLimbGeometry({
   detail,kind:'sleeve',length:.34,top:.129,bottom:.097
  }),'forestSilk','fitted-ranger-sleeve-'+i);
  add(frames.forearms[i],createRegalLimbGeometry({
   detail,kind:'sleeve',length:.20,top:.090,bottom:.080
  }),'forestLeatherTrim','fitted-wrist-bracer-'+i);
  add(frames.legs[i],createRegalLimbGeometry({
   detail,kind:'trouser',length:.50,top:.170,bottom:.126
  }),'forestSilk','opaque-forest-legging-'+i);
  add(frames.calves[i],createRegalLimbGeometry({
   detail,kind:'boot',length:.476,top:.146,bottom:.107
  }),'summonBootLeather','forest-tapered-boot-shaft-'+i);
  // The same tested human shoe last as the Seraph, using forest leather,
  // gives a real toe-and-heel rather than the old spherical candy shoe.
  const foot=frames.feet[i];
  add(foot,createSeraphShoeGeometry({detail}),'summonBootLeather',
   'forest-anatomical-toe-boot-'+i);
  const outsole=new THREE.BoxGeometry(.220,.028,.460,
   detail==='low'?1:3,1,detail==='low'?1:4);
  outsole.translate(0,-.158,-.117);
  add(foot,outsole,'summonBootSole','forest-flat-sole-'+i);
  // Low-contrast fine stitched seams and flexible leather buckles.
  seam(frames.calves[i],'forestLeatherTrim','stitched-boot-side-'+i,[
   [side*.112,.04,-.095],
   [side*.125,-.15,-.091],
   [side*.102,-.39,-.092]
  ],.003);
  if(hi){
   seam(foot,'forestLeatherTrim','toe-stitch-'+i,[
    [-.092,.008,-.287],[-.041,.030,-.32],
    [0,.033,-.329],[.041,.030,-.32],[.092,.008,-.287]
   ],.003);
   // Brass buckle without a huge shiny circular ankle ring.
   add(frames.calves[i],
    new THREE.BoxGeometry(.036,.033,.015),
    'forestBrass','small-shin-buckle-'+i,
    [side*.112,-.10,-.083]);
  }
  seam(frames.chest,'forestBrass','bodice-embroidered-curve-'+i,[
   [side*.175,.23,-.15],
   [side*.166,.06,-.172],
   [side*.15,-.17,-.155],
   [side*.055,-.33,-.159]
  ],hi?.004:.006);
  seam(frames.pelvis,'forestBrass','mantle-gold-thread-'+i,[
   [side*.126,.02,-.226],[side*.153,-.18,-.267],
   [side*.162,-.43,-.369],[side*.152,-.71,-.447]
  ],hi?.0034:.005);
 }
 const belt=new THREE.TorusGeometry(.220,.010,
  detail==='low'?5:8,detail==='low'?14:28);
 belt.rotateX(Math.PI/2);
 add(frames.pelvis,belt,'forestLeatherTrim',
  'continuous-leather-waist-belt',[0,.085,0]);
 return true;
}
