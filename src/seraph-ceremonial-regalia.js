/**
 * Articulated ceremonial regalia for the female Seraph.
 *
 * Target: ivory satin + pearl brocade + narrow gold embroidery, layered
 * split gown, tall fitted dark leather boots, small antique-gold hardware.
 * Dedicated to seraph_female: do not alter dragon, forest, monster outfits,
 * wing pairs, imported human skeleton, skin, or combat motion.
 *
 * Every moving part is attached to the existing chest/hip/arm/calf/foot bone.
 */
import * as THREE from 'three';
import {createRegalBodiceGeometry,createRegalCollarGeometry,
 createRegalShoulderYokeGeometry,createRegalLimbGeometry,
 createRegalSkirtGeometry} from './monster-regal-garments.js';

export const SERAPH_REGALIA_REVISION='seraph-ivory-brocade-articulated-v3-20261122';

const vertexCount=detail=>detail==='low'?10:24;
function makeSurface(rows,columns,sample,kind){
 const pos=[],uv=[],idx=[];
 for(let i=0;i<=rows;i++){
  const v=i/rows;
  for(let j=0;j<=columns;j++){
   const u=j/columns,p=sample(u,v);
   pos.push(...p);uv.push(u,v);
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
 g.userData={kind,articulated:true};
 return g;
}
/** Smooth structured boots instead of giant chocolate-ball toe ellipsoids. */
export function createSeraphFittedFoot({detail='high',sole=false}={}){
 const rings=sole?[
  [ .15,.057,.018,-.18],[ .09,.106,.019,-.18],
  [-.05,.132,.022,-.184],[-.21,.131,.022,-.19],
  [-.36,.102,.020,-.190],[-.397,.027,.015,-.19]
 ]:[
  [ .15,.054,.056,-.090],[ .07,.106,.094,-.088],
  [-.045,.133,.108,-.093],[-.19,.136,.088,-.106],
  [-.34,.113,.055,-.125],[-.397,.034,.026,-.13]
 ];
 const edges=detail==='low'?9:20;
 const g=makeSurface(rings.length-1,edges,(u,v)=>{
  const t=v*(rings.length-1),i=Math.min(rings.length-2,Math.floor(t));
  const mix=t-i,prev=rings[i],next=rings[i+1];
  const lerp=k=>prev[k]*(1-mix)+next[k]*mix;
  const angle=u*Math.PI*2;
  const rx=lerp(1),ry=lerp(2),cy=lerp(3);
  return [Math.cos(angle)*rx,cy+Math.sin(angle)*ry,lerp(0)];
 },sole?'seraph-stitched-foot-sole':'seraph-fitted-boot-toebox');
 g.userData.footBoneAnchored=true;
 return g;
}
export function createSeraphShinInset({detail='high'}={}){
 return makeSurface(detail==='low'?4:11,detail==='low'?4:9,(u,v)=>{
  const y=.005-.447*v,half=.086-.017*v;
  const x=(u*2-1)*half;
  const front=-(.136-.025*v);
  return [x,y,front-.009*(1-Math.abs(u*2-1))];
 },'seraph-formfitted-shin-leather-panel');
}
function skirtPoint(u,v,{start,sweep,length,flare,offset=0}){
 const theta=start+sweep*u;
 const wave=Math.sin(Math.PI*v)*.013+Math.sin(theta*8+v*3.1)*.007*v;
 const radial=(.222+flare*v*v+wave);
 return [
  Math.cos(theta)*radial,
  .13-v*length+.016*Math.sin(2*theta)*v*v,
  Math.sin(theta)*(.173+flare*.69*v*v+wave)+offset
 ];
}
export function createSeraphDrapedPanel({
 detail='high',start=-2.4,sweep=1.7,length=.91,flare=.39,
 offset=0
}={}){
 const o={start,sweep,length,flare,offset};
 const g=makeSurface(detail==='low'?5:14,vertexCount(detail),
  (u,v)=>skirtPoint(u,v,o),'seraph-draped-multi-layer-robe');
 g.userData.panel=o;return g;
}
/** Central tapered embroidered front tabard with a subtle folded center. */
const tabardPoint=(u,v)=>{
 const width=.102+.073*v*v;
 const x=(u*2-1)*width;
 const hem=.014*Math.sin(Math.PI*u)*v*v;
 return [x,.12-.90*v+hem,
  -(.23+.27*v*v)-.013*(1-Math.abs(u*2-1))];
};
export function createSeraphFrontTabard({detail='high'}={}){
 return makeSurface(detail==='low'?5:14,detail==='low'?4:12,
  tabardPoint,'seraph-brocade-embroidered-front-tabard');
}
/** Bone-anchored floating sleeve drape, not a full-length immovable coat. */
function createSeraphSleeveDrape({detail='high',side=1}={}){
 return makeSurface(detail==='low'?5:10,detail==='low'?3:8,(u,v)=>{
  const x=side*(.01+.135*u+.056*v);
  const y=-.05-.45*v+.03*Math.sin(u*Math.PI)*v;
  const z=-.052-.050*u-.036*v+.018*Math.sin(v*5+u*3);
  return [x,y,z];
 },'seraph-hanging-ivory-silk-sleeve');
}
const medallion=(detail,rad)=>new THREE.TorusGeometry(rad,.006,
 detail==='low'?6:9,detail==='low'?14:28);

export function addSeraphCeremonialRegalia({
 profile,frames,detail='high',attach,tube
}={}){
 if(profile?.costume!=='seraph_female')return false;
 if(!frames?.chest||!frames?.pelvis||frames?.calves?.length!==2||
    frames?.arms?.length!==2||frames?.forearms?.length!==2||
    frames?.legs?.length!==2)return false;
 const add=(frame,g,role,name,p=[0,0,0],r=[0,0,0])=>
  attach(frame,g,role,'seraph-regalia-'+name,p,r);
 const line=(frame,role,name,points,r=.004)=>
  tube(frame,role,'seraph-regalia-'+name,points,r);

 // All original ragged linen/bandage skirts are BYPASSED here. This is
 // actual layered mesh geometry with neutral fine-knit satin PBR.
 add(frames.chest,createRegalBodiceGeometry({detail}),
  'seraphBrocade','tailored-high-bodice');
 add(frames.chest,createRegalShoulderYokeGeometry({detail}),
  'seraphSatin','ivory-shoulder-yoke');
 add(frames.chest,createRegalCollarGeometry({detail}),
  'seraphGoldTrim','engraved-high-collar');

 add(frames.pelvis,createRegalSkirtGeometry({
  detail,length:.89,flare:.28,style:'celestial'
 }),'seraphSatin','ivory-inner-pleated-gown');
 // Outer panels tuck under the central hanging heraldic tabard.
 for(const p of [
  {start:-2.72,sweep:1.07,length:.87,flare:.34},
  {start:-.45,sweep:1.08,length:.87,flare:.34},
  {start:.34,sweep:2.46,length:.93,flare:.41}
 ]){
  const g=createSeraphDrapedPanel({detail,...p});
  add(frames.pelvis,g,'seraphSatin','silk-drape-'+p.start);
  for(const edge of [0,1]){
   const points=Array.from({length:11},(_,j)=>skirtPoint(edge,j/10,p));
   line(frames.pelvis,'seraphGoldTrim',
    'fine-hem-embroidery-'+p.start+'-'+edge,points,.0032);
  }
 }
 add(frames.pelvis,createSeraphFrontTabard({detail}),
  'seraphBrocade','center-hanging-heraldic-panel');
 for(const u of [0,1]){
  const points=Array.from({length:15},(_,j)=>tabardPoint(u,j/14));
  line(frames.pelvis,'seraphGoldTrim','tabard-stitched-edge-'+u,
   points,.0038);
 }
 // Upper part of a stylised celestial star / medallion. Geometry, not a
 // flat printed emblem or a shiny gold photo on the entire white gown.
 add(frames.chest,medallion(detail,.060),
  'seraphGoldTrim','celestial-chest-medallion',[0,.115,-.185]);
 const gem=new THREE.OctahedronGeometry(.025,detail==='low'?0:1);
 add(frames.chest,gem,'seraphGoldTrim',
  'celestial-central-star',[0,.115,-.195]);
 for(const side of [-1,1]){
  line(frames.chest,'seraphGoldTrim','breast-tailoring-'+side,[
   [side*.17,.235,-.123],[side*.15,.075,-.173],
   [side*.12,-.175,-.155],[side*.03,-.30,-.159]],.0043);
  const i=side<0?0:1;
  add(frames.arms[i],createRegalLimbGeometry({
   detail,kind:'sleeve',length:.29,top:.133,bottom:.112
  }),'seraphSatin','ivory-upper-sleeve-'+i);
  add(frames.forearms[i],createSeraphSleeveDrape({detail,side}),
   'seraphSatin','flowing-cuff-drape-'+i);
  add(frames.forearms[i],createRegalLimbGeometry({
   detail,kind:'sleeve',length:.17,top:.096,bottom:.083
  }),'seraphGoldTrim','engraved-wrist-bracer-'+i);

  // Smooth pale legging lies under the opened outer gown; the actual
  // dark boots use a different PBR role, welded to the native foot bones.
  add(frames.legs[i],createRegalLimbGeometry({
   detail,kind:'trouser',length:.49,top:.165,bottom:.123
  }),'seraphSatin','ivory-legging-'+i);
  add(frames.calves[i],createRegalLimbGeometry({
   detail,kind:'boot',length:.472,top:.139,bottom:.100
  }),'summonBootLeather','tapered-leather-shaft-'+i);
  add(frames.calves[i],createSeraphShinInset({detail}),
   'seraphLeatherInset','fitted-shin-vamp-'+i);
  const foot=frames.feet?.[i]||frames.calves[i];
  const pos=frames.feet?.[i]?[0,0,0]:[0,-.47,0];
  add(foot,createSeraphFittedFoot({detail}),
   'summonBootLeather','fitted-foot-boot-'+i,pos);
  add(foot,createSeraphFittedFoot({detail,sole:true}),
   'summonBootSole','tailored-leather-outsole-'+i,pos);
  for(const y of [-.08,-.38]){
   // Narrow dark-lacquer edging and discrete antique-gold buckles.
   const r=.128+(y+.08)*.042;
   const band=new THREE.TorusGeometry(r,.006,
    detail==='low'?5:7,detail==='low'?13:24);
   band.rotateX(Math.PI*.5);
   add(frames.calves[i],band,'seraphGoldTrim',
    'boot-ankle-buckle-band-'+i+'-'+y,[0,y,0]);
  }
  add(frames.calves[i],
   new THREE.BoxGeometry(.036,.032,.018),
   'seraphGoldTrim','boot-shin-buckle-'+i,[side*.074,-.086,-.129]);
  line(frames.calves[i],'seraphGoldTrim','boot-shin-seam-'+i,[
   [side*.074,-.036,-.128],[side*.086,-.21,-.120],
   [side*.055,-.411,-.104]],detail==='low'?.003:.0025);
  // Two small seams on the real toe shape, not oversized floating toe caps.
  line(foot,'seraphLeatherInset','boot-foot-stitch-'+i,[
   [-.097,pos[1]-.04,-.10],[-.108,pos[1]-.058,-.22],
   [-.076,pos[1]-.10,-.323]],.0029);
 }
 return true;
}
