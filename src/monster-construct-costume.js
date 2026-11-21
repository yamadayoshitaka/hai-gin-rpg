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
/**
 * Full-body animated mineral shell. The source human is a MOTION donor only.
 * No exposed face, chest, palms or legs; no black donor clothing survives.
 * Each rigid plate belongs to an existing GLB bone, NOT to a second rig.
 * The source character mesh is concealed by buildMonsterCostume only for
 * construct profiles after the canonical skeleton was successfully loaded.
 */
export const CONSTRUCT_FULL_SHELL_REVISION='golem-whole-body-no-flesh-v2-20261121';
export const CONSTRUCT_SHELL_SPECIES=Object.freeze({
 stone_construct:Object.freeze({base:0x737d76,facet:0x9ba59a,trim:0x46564a,
  core:0xa8c982,dark:0x29382f,theme:'jointed-moss-stone'}),
 bronze_construct:Object.freeze({base:0x487e76,facet:0x86aba0,trim:0xbea16d,
  core:0x70d4af,dark:0x274c49,theme:'engraved-patinated-bronze'}),
 crystal_construct:Object.freeze({base:0x7854bc,facet:0xb49aff,trim:0x4d3677,
  core:0xdfb8ff,dark:0x342351,theme:'purple-faceted-crystal'}),
 lava_construct:Object.freeze({base:0x52494a,facet:0x817275,trim:0x2c2c32,
  core:0xff8738,dark:0x302c31,theme:'charcoal-with-magma-fissures'}),
 silver_construct:Object.freeze({base:0xb3c2d0,facet:0xe0ecf5,trim:0xc39d59,
  core:0xffe3ad,dark:0x667f91,theme:'engraved-sanctified-silver'})
});
export function addConstructMonsterCostume({
 THREE:Engine=THREE,frames,profile,detail='high',attach,tube
}={}){
 if(!isConstructCostume(profile))return false;
 const design=CONSTRUCT_SHELL_SPECIES[profile.costume];
 if(!design)throw Error('Golem mineral material missing: '+profile.id);
 const low=detail==='low',near=detail==='source'||detail==='high';
 const section=low?6:detail==='medium'?8:10;
 let count=0;
 const add=(part,geometry,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  if(!part)return null;
  const mesh=attach(part,geometry,role,'golem-'+profile.id+'-'+name,pos,rot);
  mesh.userData.golemFullShell=true;
  mesh.userData.golemSpecies=profile.id;
  mesh.userData.golemPart=name;
  mesh.userData.boneAnchored=true;
  count++;
  return mesh;
 };
 const poly=(part,role,name,pos,scale,detailBoost=0,rot=[0,0,0])=>{
  if(!part)return null;
  const g=new Engine.IcosahedronGeometry(1,
   Math.max(0,Math.min(2,(low?0:near?1:0)+detailBoost)));
  g.scale(...scale);
  return add(part,g,role,name,pos,rot);
 };
 const beam=(part,role,name,pos,height,top,bottom,rot=[0,0,0])=>{
  if(!part)return null;
  return add(part,new Engine.CylinderGeometry(top,bottom,height,section,
   low?1:3),role,name,pos,rot);
 };
 const seam=(part,role,name,pts,radius=.009)=>{
  if(!part)return;
  const m=tube(part,role,'golem-'+profile.id+'-'+name,pts,radius);
  if(m){m.userData.golemFullShell=true;
   m.userData.golemSpecies=profile.id;m.userData.boneAnchored=true;count++;}
 };
 const head=frames.head,chest=frames.chest;
 const pelvis=frames.pelvis??chest,neck=frames.neck??head;
 // The native donor is invisible. Build complete mineral anatomy including
 // skull, ears, jaw, eyes, throat, chest, waist, all limbs, wrists and soles.
 poly(head,'constructBase','complete-geometric-skull',
  [0,.007,0],[.183,.214,.166]);
 poly(head,'constructFacet','integrated-chin-jaw',
  [0,-.120,-.049],[.132,.095,.119]);
 poly(head,'constructTrim','forehead-brow',
  [0,.139,-.115],[.151,.047,.061]);
 beam(neck,'constructBase','solid-neck-joint',[0,.005,0],.246,.115,.142);
 poly(chest,'constructBase','full-rib-cage',
  [0,-.036,0],[.345,.425,.270]);
 poly(chest,'constructFacet','breastplate-shoulder-mass',
  [0,.154,-.018],[.365,.218,.273]);
 poly(pelvis,'constructBase','complete-pelvis',
  [0,-.055,.005],[.275,.231,.205]);
 poly(pelvis,'constructTrim','waist-overlap-seal',
  [0,.146,0],[.243,.086,.170]);
 // No human-style round button eyes. Buried sockets and luminous slit pupils.
 for(const side of [-1,1]){
  poly(head,'constructDark','carved-eye-socket-'+side,
   [side*.069,.039,-.165],[.055,.036,.028]);
  poly(head,'constructCore','mineral-inset-iris-'+side,
   [side*.069,.042,-.190],[.022,.014,.013]);
  poly(head,'constructFacet','temple-continuation-'+side,
   [side*.15,.055,-.010],[.059,.114,.128]);
  poly(chest,'constructTrim','collar-seam-'+side,
   [side*.244,.287,0],[.105,.092,.162]);
 }
 // Each pair follows its existing upper-arm/forearm/thigh/shin/foot bones.
 // Joint caps overlap consecutive plates; no detached toy cylinders.
 for(let i=0;i<2;i++){
  const side=i===0?-1:1;
  const upper=frames.arms?.[i],lower=frames.forearms?.[i];
  const thigh=frames.legs?.[i],shin=frames.calves?.[i];
  const foot=frames.feet?.[i]??shin;
  poly(upper,'constructFacet','sculpted-shoulder-'+i,
   [side*.012,-.012,0],[.195,.204,.188]);
  beam(upper,'constructBase','upper-arm-shell-'+i,
   [0,-.205,0],.420,.173,.141,[0,0,side*.045]);
  poly(upper,'constructTrim','upper-elbow-overlap-'+i,
   [0,-.409,0],[.157,.107,.147]);
  beam(lower,'constructFacet','forearm-shell-'+i,
   [0,-.205,0],.438,.152,.178);
  poly(lower,'constructBase','full-mineral-hand-'+i,
   [0,-.454,.018],[.149,.140,.143]);
  for(let j=0;j<3;j++){
   const x=(j-1)*.083;
   poly(lower,'constructFacet','finger-knuckle-'+i+'-'+j,
    [x,-.556,-.068],[.049,.076,.055]);
  }
  poly(thigh,'constructTrim','hip-connector-'+i,
   [0,-.008,0],[.181,.155,.168]);
  beam(thigh,'constructBase','thigh-shell-'+i,
   [0,-.250,0],.520,.207,.168);
  poly(thigh,'constructFacet','knee-guard-'+i,
   [0,-.494,-.044],[.181,.134,.188]);
  beam(shin,'constructBase','shin-shell-'+i,
   [0,-.244,0],.490,.154,.143);
  poly(shin,'constructTrim','ankle-connector-'+i,
   [0,-.481,0],[.145,.105,.138]);
  poly(foot,'constructFacet','complete-arched-foot-'+i,
   [0,-.063,-.097],[.180,.113,.245]);
  // Elemental/geological signature integrated in the armour, not loose
  // glowing marbles hovering over human clothing.
  if(!low){
   poly(upper,'constructFacet','shoulder-mineral-spur-'+i,
    [side*.115,.132,-.025],[.096,.174,.090],0,[0,0,side*.36]);
   seam(thigh,'constructTrim','thigh-crust-seam-'+i,[
    [-.084,-.095,-.149],[0,-.234,-.185],
    [.065,-.389,-.140]],.008);
  }
 }
 // An unmistakable centerpiece on the chest: jeweled body core embedded
 // in the rock/bronze/crystal/lava/silver, and no exposed source garment.
 poly(chest,'constructTrim','core-bezel',
  [0,.043,-.267],[.142,.152,.063]);
 poly(chest,'constructCore','inlaid-energy-stone',
  [0,.044,-.312],[.085,.098,.054]);
 if(near)for(const side of [-1,1])for(let j=0;j<3;j++)
  seam(chest,'constructTrim','ribbed-layer-'+side+'-'+j,[
   [side*.11,.167-j*.128,-.246],
   [side*.25,.085-j*.128,-.221],
   [side*.29,.008-j*.128,-.174]],.010);
 if(profile.costume==='crystal_construct'){
  // Purple crystal should read as a colossal crystalline sculpture.
  for(const side of [-1,1]){
   poly(chest,'constructFacet','large-shoulder-amethyst-'+side,
    [side*.252,.300,.025],[.128,.235,.141],0,[0,0,side*.39]);
   poly(chest,'constructFacet','prismatic-rib-'+side,
    [side*.217,-.066,-.203],[.121,.187,.105]);
   poly(head,'constructFacet','gemstone-crown-'+side,
    [side*.098,.218,.011],[.069,.178,.071]);
  }
 }else if(profile.costume==='stone_construct'){
  for(const side of [-1,1])poly(chest,'constructTrim',
   'ancient-rock-fault-'+side,[side*.211,-.075,-.209],
   [.094,.132,.063]);
 }else if(profile.costume==='lava_construct'){
  for(const side of [-1,1])seam(chest,'constructCore',
   'molten-fissure-'+side,[
    [side*.13,.188,-.255],[side*.17,.053,-.272],
    [side*.115,-.123,-.275],[side*.20,-.242,-.209]],.015);
 }else if(profile.costume==='bronze_construct'){
  for(const side of [-1,1])seam(chest,'constructTrim',
   'cast-bronze-engraving-'+side,[
    [side*.17,.235,-.23],[side*.26,.051,-.215],
    [side*.18,-.188,-.218]],.012);
 }else if(profile.costume==='silver_construct'){
  poly(head,'constructTrim','crown-solar-disc',
   [0,.265,.045],[.169,.039,.157]);
  for(const side of [-1,1])seam(chest,'constructTrim',
   'sacred-silver-inlay-'+side,[
    [side*.108,.211,-.256],[side*.21,.034,-.231],
    [side*.107,-.225,-.246]],.012);
 }
 frames.chest.userData.golemFullShellRevision=CONSTRUCT_FULL_SHELL_REVISION;
 frames.chest.userData.golemShellParts=count;
 frames.chest.userData.golemBaseTheme=design.theme;
 return true;
}
