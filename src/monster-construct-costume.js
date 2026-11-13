/**
 * Character-rigged construct / golem costumes (m036–m040).
 *
 * They are human-shaped actors, NOT human-skinned dolls. Their armour is
 * attached to canonical animated head, shoulder, forearm, thigh and torso
 * bones and preserves the source skeleton/clips. Mobile low LOD is cheaper.
 */
import * as THREE from 'three';

const faceted=(v,n)=>Math.round(v*n)/n;
export const CONSTRUCT_COSTUME_KINDS=Object.freeze([
 'stone_construct','bronze_construct','crystal_construct',
 'lava_construct','silver_construct',
]);
export const isConstructCostume=profile=>!!profile?.construct&&
 CONSTRUCT_COSTUME_KINDS.includes(profile?.costume);

export function createConstructCarapaceGeometry({
 width=.32,height=.62,depth=.21,detail='high',material='stone',
}={}){
 if(![width,height,depth].every(v=>Number.isFinite(v)&&v>0))
  throw Error('Invalid construct carapace dimensions');
 const cols=detail==='low'?6:16,rows=detail==='low'?5:13;
 const positions=[],uv=[],indices=[];
 for(let j=0;j<=rows;j++){
  const t=j/rows,y=.32-t*height;
  const taper=.98-.30*Math.pow(t,1.6);
  for(let i=0;i<=cols;i++){
   const u=i/cols,x=(u*2-1)*width*taper;
   const centre=1-Math.pow(Math.abs(u*2-1),1.8);
   const rib=material==='crystal'?.025*Math.sin(t*19+u*14):
      material==='lava'?.014*Math.sin(t*31+u*21):
      material==='bronze'?.008*Math.sin(t*18):
      .011*Math.cos(t*17+u*25);
   const z=-depth-.07*centre+rib;
   positions.push(x,y,z);uv.push(u*1.6,t*1.8);
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const a=j*(cols+1)+i,b=a+cols+1;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();
 g.userData={kind:'rigged-golem-torso-carapace',material,detail};
 return g;
}
export function createConstructHeadPlateGeometry({
 width=.16,height=.28,detail='high',material='stone'
}={}){
 const cols=detail==='low'?6:14,rows=detail==='low'?5:13;
 const vertices=[],uv=[],triangles=[];
 for(let j=0;j<=rows;j++){
  const t=j/rows,y=.15-t*height;
  for(let i=0;i<=cols;i++){
   const u=i/cols,v=u*2-1;
   const taper=.80+.20*Math.sin(Math.PI*t);
   const nose=.055*Math.exp(-18*v*v)*Math.exp(-11*(t-.54)**2);
   const forehead=.023*(1-t)*Math.cos(v*Math.PI*.5);
   const cheek=.02*Math.sin(Math.PI*t)*Math.abs(v);
   const facet=material==='crystal'?
     .012*faceted(Math.sin(i*8+j*6),5):.006*Math.sin(i*7+j*6);
   vertices.push(v*width*taper,y,-.131-nose-forehead-cheek-facet);
   uv.push(u,t);
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const a=j*(cols+1)+i,b=a+cols+1;
  triangles.push(a,b,a+1,a+1,b,b+1);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(triangles);g.computeVertexNormals();
 g.userData={kind:'rigged-golem-face-plate',detail,material};
 return g;
}
export function addConstructMonsterCostume({THREE:Engine=THREE,frames,
 profile,detail='high',attach,tube}={}){
 if(!isConstructCostume(profile))return false;
 const type=profile.costume.split('_')[0];
 const hi=detail!=='low',stone=type==='stone',lava=type==='lava',
  crystal=type==='crystal',metal=!stone&&!lava;
 const face=type==='crystal'?'metal':'skin';
 const seams=type==='lava'?'accent':crystal?'accent':metal?'metal':'cloth';
 const place=(part,g,role,name,pos=[0,0,0])=>
  attach(part,g,role,name,pos);
 const small=(part,role,name,pos,r)=>{
  const g=new Engine.IcosahedronGeometry(1,hi?1:0);
  g.scale(...r);
  return place(part,g,role,name,pos);
 };
 const contour=(part,role,name,points,radius=.014)=>
  tube(part,role,name,points,radius);
 place(frames.chest,createConstructCarapaceGeometry({
  material:type,detail
 }),face,type+'-torso-shell');
 place(frames.head,createConstructHeadPlateGeometry({
  material:type,detail
 }),face,type+'-facial-mask');
 // The eyes are carved into the mask and hold the colored magical core,
 // instead of gluing round button eyes on an ordinary human face.
 for(const side of [-1,1]){
  const x=side*.061;
  small(frames.head,'black',type+'-recessed-eye-'+side,
   [x,.044,-.176],[.038,.026,.019]);
  small(frames.head,'accent',type+'-arcane-iris-'+side,
   [x,.044,-.192],[.013,.017,.007]);
  const index=side<0?0:1;
  small(frames.arms[index],face,type+'-shoulder-masonry-'+index,
   [side*.015,-.022,-.005],[.17,.17,.17]);
  // Arm and leg shell are independently anchored to animated skeleton
  // joints, so they don't float off during melee or fast walking.
  small(frames.forearms[index],face,type+'-forearm-bracer-'+index,
   [0,-.175,-.046],[.106,.225,.108]);
  small(frames.legs[index],face,type+'-thigh-shell-'+index,
   [0,-.17,-.015],[.19,.225,.177]);
  small(frames.calves[index],face,type+'-shin-shell-'+index,
   [0,-.20,-.026],[.13,.24,.13]);
  contour(frames.chest,seams,type+'-chest-joint-'+side,[
   [side*.18,.18,-.20],[side*.21,-.08,-.23],
   [side*.14,-.30,-.20]],.012);
 }
 if(lava||crystal||type==='silver'){
  for(let i=0;i<5;i++){
   const side=i%2===0?1:-1;
   contour(frames.chest,'accent',type+'-runic-fracture-'+i,[
    [side*(.03+.023*i),.24-i*.087,-.285],
    [side*(.11+.012*i),.17-i*.084,-.287],
    [side*(.09+.020*i),.10-i*.081,-.264]
   ],hi?.010:.013);
  }
 }
 if(stone||crystal||lava){
  for(const side of [-1,1]){
   const p=new Engine.ConeGeometry(.070,.20,hi?9:6,hi?3:1);
   p.rotateZ(side*.25);
   place(frames.head,p,face,type+'-temporal-crag-'+side,
    [side*.17,.17,.03]);
  }
 }
 return true;
}
