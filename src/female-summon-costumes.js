/**
 * Species-specific sculpted add-ons for canonical FEMALE summoned character.
 * Anchors are the source character's actual bones; the original summon
 * animal/dragon instancing remains untouched. Fitted to m-scale GLB body.
 */
import * as THREE from 'three';
import {createGothicHorn,createGothicBatWing,createGothicMantle}
 from './monster-gothic-sculpt.js';

export const FEMALE_SUMMON_COSTUMES=Object.freeze([
 'forest_spirit_female','seraph_female','dragonkin_female'
]);
export const isFemaleSummonCostume=profile=>
 FEMALE_SUMMON_COSTUMES.includes(profile?.costume);

/** Curved, tapered feather vane for close-up viewing, including a thin
 * central rachis. No disconnected triangle wings or flat billboards. */
export function createFemaleSummonFeather({
 detail='high',length=.83,width=.13,side=1
}={}){
 const rows=detail==='low'?7:18,cols=detail==='low'?4:8;
 const p=[],uv=[],idx=[];
 for(let i=0;i<=rows;i++){
  const t=i/rows,w=width*Math.pow(Math.sin(Math.PI*t),.80);
  for(let j=0;j<=cols;j++){
   const u=j/cols*2-1;
   p.push(side*(length*t+.035*t*t),-.18*t*t+w*u,
    -.13*Math.sin(Math.PI*t)+.035*(u*u));
   uv.push(j/cols,t);
  }
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
  const a=i*(cols+1)+j,b=a+cols+1;idx.push(a,b,a+1,a+1,b,b+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeVertexNormals();
 geo.userData={kind:'female-summon-feather-vane',detail};
 return geo;
}
export function createFemaleSummonLeaf({
 detail='high',size=.22
}={}){
 const steps=detail==='low'?6:14,p=[],uv=[],idx=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps,w=.45*size*Math.sin(Math.PI*t);
  for(const side of [-1,0,1]){
   p.push(side*w,size*t,.014*(1-side*side)+.026*Math.sin(Math.PI*t));
   uv.push((side+1)/2,t);
  }
 }
 for(let i=0;i<steps;i++)for(let j=0;j<2;j++){
  const a=i*3+j,b=a+3;idx.push(a,b,a+1,a+1,b,b+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeVertexNormals();
 geo.userData={kind:'forest-spirit-leaf',detail};
 return geo;
}
export function addFemaleSummonCostume({profile,frames,detail='high',attach,tube}={}){
 if(!isFemaleSummonCostume(profile))return false;
 const hi=detail!=='low';
 const add=(parent,g,role,name,p=[0,0,0],r=[0,0,0])=>
  attach(parent,g,role,'female-'+name,p,r);
 const line=(parent,role,name,points,radius=.011)=>
  tube(parent,role,'female-'+name,points,radius);
 const orb=(parent,role,name,p,scale)=>{
  const g=new THREE.IcosahedronGeometry(1,hi?1:0);g.scale(...scale);
  return add(parent,g,role,name,p);
 };
 const type=profile.costume;
 for(const side of [-1,1]){
  const i=side<0?0:1;
  const liner=type==='forest_spirit_female'?'makeup':'lip';
  line(frames.head,liner,'canthal-liner-'+side,[
   [side*.016,.058,-.132],[side*.061,.074,-.143],
   [side*.121,.089,-.108]],.006);
  line(frames.head,'rune','temple-mark-'+side,[
   [side*.094,.021,-.105],[side*.113,-.028,-.090],
   [side*.099,-.064,-.102]],.005);
  line(frames.forearms[i],type==='forest_spirit_female'?'leaf':'metal',
   'arm-guard-'+side,[[0,-.12,-.08],[side*.08,-.20,-.066],
   [0,-.30,-.05]],.016);
 }
 if(type==='forest_spirit_female'){
  // Skin still belongs to a real female character; organic foliage
  // sprouts from the same animated head and torso, never a fake mask.
  for(const side of [-1,1]){
   line(frames.head,'leaf','wood-antler-trunk-'+side,[
    [side*.10,.12,.01],[side*.17,.26,.06],
    [side*.24,.37,.10]],.034);
   for(let i=0;i<3;i++)
    add(frames.head,createFemaleSummonLeaf({detail,size:.16+i*.025}),
     'leaf','antler-leaf-'+side+'-'+i,
     [side*(.16+i*.032),.24+i*.058,.05],
     [side*.2,0,side*(.9+i*.35)]);
   add(frames.head,createFemaleSummonLeaf({detail,size:.12}),
    'leaf','pointed-elf-ear-'+side,
    [side*.14,.024,-.013],[0,0,side*(Math.PI*.43)]);
   for(let i=0;i<4;i++)
    add(frames.chest,createFemaleSummonLeaf({detail,size:.21+i*.018}),
     'leaf','growing-mantle-leaf-'+side+'-'+i,
     [side*(.13+i*.05),.19-i*.13,.04],
     [.05,0,side*.55]);
  }
  add(frames.chest,createGothicMantle({detail,width:.30,drop:.87,back:.26}),
   'velvet','forest-woven-cape');
 }
 if(type==='seraph_female'){
  // Both wings are feathered and rooted in upper-back musculature.
  for(const side of [-1,1]){
   line(frames.chest,'metal','wing-scapula-'+side,[
    [side*.13,.20,.17],[side*.34,.39,.34],
    [side*.95,.63,.51]],.042);
   for(let i=0;i<(hi?9:5);i++){
    const t=i/(hi?9:5);
    add(frames.chest,createFemaleSummonFeather({
      detail,length:.70+i*.075,width:.10+i*.006,side
    }),'feather','seraph-primary-'+side+'-'+i,
     [side*(.25+i*.052),.31-i*.092,.34+i*.012],
     [0,side*.04,side*(.10+i*.027)]);
   }
  }
  // The old flattened icosahedron was a horizontal WHITE BAR from the
  // frontal camera. Use a true open halo facing the viewer (+Z).
  const halo=new THREE.TorusGeometry(.160,.014,
    hi?9:6,hi?45:18);
  add(frames.head,halo,'metal','seraph-open-circular-halo',
    [0,.365,-.018],[-.15,0,0]);
  add(frames.chest,createGothicMantle({detail,width:.34,drop:.92,back:.25}),
   'velvet','seraph-cloth-back');
 }
 if(type==='dragonkin_female'){
  for(const side of [-1,1]){
   orb(frames.head,'horn','dragon-horn-root-'+side,
    [side*.09,.12,.03],[.067,.034,.061]);
   add(frames.head,createGothicHorn({
    side,len:.35,radius:.067,curve:.35,detail
   }),'horn','dragon-swept-horn-'+side,[side*.09,.13,.02]);
   add(frames.chest,createGothicBatWing({
    side,detail,width:1.04,height:.76
   }),'membrane','dragon-wing-'+side,[0,.09,.05]);
   line(frames.chest,'horn','dragon-wing-rib-'+side,[
    [side*.15,.24,.18],[side*.45,.45,.35],
    [side*.92,.29,.55]],.032);
   for(let i=0;i<4;i++){
    orb(frames.chest,'metal','dragon-chest-scale-'+side+'-'+i,
     [side*(.09+i*.026),.20-i*.125,-.215],
     [.08,.066,.022]);
   }
  }
  if(!frames.pelvis)throw Error('Dragonkin tail requires real pelvis');
  line(frames.pelvis,'horn','dragonkin-tail',[
   [0,.025,.17],[.16,-.17,.34],[.29,-.40,.55],
   [.11,-.64,.73]],.043);
  add(frames.pelvis,createGothicHorn({
   detail,len:.18,radius:.058,curve:.16
  }),'horn','dragon-tail-blade',[.11,-.67,.75],[0,0,Math.PI*.85]);
 }
 return true;
}
