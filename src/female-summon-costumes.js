/**
 * Species-specific sculpted add-ons for canonical FEMALE summoned character.
 * Anchors are the source character's actual bones; the original summon
 * animal/dragon instancing remains untouched. Fitted to m-scale GLB body.
 */
import * as THREE from 'three';
import {buildCombatObjectGeometry}
 from './combat-creature-geometry.js?v=4.5.00';
import {createGothicHorn,createGothicBatWing,createGothicMantle}
 from './monster-gothic-sculpt.js';

/**
 * Reuse the HIGH-QUALITY 3-layer, 82-feather-per-side wing ALREADY authored
 * for the original Guardian summon. Never replace it with the 9 flat leaves
 * that created a serrated white fan in the user's mobile screenshot.
 * Dispose unrelated original-summon geometry after extracting the pair.
 */
export function createOriginalGuardianWingPair({detail='high'}={}){
 if(detail!=='high'&&detail!=='low')throw Error('Unknown original wing LOD');
 const parts=buildCombatObjectGeometry('seraph_guardian',{detail});
 const left=parts.wingL,right=parts.wingR;
 if(!left?.isBufferGeometry||!right?.isBufferGeometry){
  for(const g of Object.values(parts))g?.dispose?.();
  throw Error('Original Guardian left and right wing geometry missing');
 }
 for(const [name,g] of Object.entries(parts)){
  if(name!=='wingL'&&name!=='wingR')g.dispose();
 }
 for(const [side,g] of [[-1,left],[1,right]]){
  g.userData={...g.userData,kind:'original-guardian-overlapping-feather-wing',
   originalSource:true,side,detail};
 }
 return {left,right};
}
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

/**
 * Dragon Lord's bald hairstyle is a living, scale-plated skull—not an
 * exposed smooth human scalp or a black opaque helmet. The geometry is
 * measured in the same model-upright, Head-attached coordinate frame as
 * the original skin. No source GLB, facial rig or hair is replaced.
 */
export function createDragonkinCranialShellGeometry({
 detail='high',center=[0,.095,0],radius=[.115,.160,.125]
}={}){
 const rows=detail==='low'?8:20,columns=detail==='low'?20:48;
 const [cx,cy,cz]=center,[rx,ry,rz]=radius;
 if(![...center,...radius].every(Number.isFinite)||Math.min(...radius)<=0)
  throw Error('Dragonkin crown must fit a valid measured skull');
 const verts=[],uv=[],indices=[];
 for(let i=0;i<=rows;i++){
  const t=i/rows;
  for(let j=0;j<=columns;j++){
   const phi=j/columns*Math.PI*2;
   // Source actor front is +Z. Raise the front hairline to reveal the
   // intact face; cover rear and temples down to just above the ears.
   const front=Math.max(0,Math.sin(phi));
   const theta=t*(1.73-.39*front);
   const st=Math.sin(theta),ct=Math.cos(theta);
   // Subtle raised keratin scutes, with dense plate roots at the crown.
   const relief=(.0025*Math.sin(phi*12+theta*5)+
    .0017*Math.cos(phi*7-theta*13))*Math.sin(Math.PI*t);
   verts.push(
    cx+(rx+.009+relief)*st*Math.cos(phi),
    cy+(ry+.008+relief*.5)*ct,
    cz+(rz+.010+relief)*st*Math.sin(phi)
   );
   uv.push(j/columns,t);
   if(i<rows&&j<columns){
    const a=i*(columns+1)+j,c=a+columns+1;
    indices.push(a,a+1,c,a+1,c+1,c);
   }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();
 g.userData={kind:'dragonkin-scaled-cranial-shell',detail,
  headAligned:true,sourceHairless:true};
 return g;
}
/**
 * Small almond-shaped gold eyes are recessed into the imported eyelids,
 * unlike the earlier black goggles and floating lemon-colored spheres.
 * The reference identity remains golden and explicitly pupil-free.
 */
export function createDragonkinAlmondEyeGeometry({side=1,detail='high'}={}){
 if(side!==-1&&side!==1)throw Error('Invalid dragonkin eye side');
 const segments=detail==='low'?18:40;
 const x0=side*.052,y0=.033,z0=-.148;
 const verts=[x0,y0,z0-.004],uv=[.5,.5],indices=[];
 for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2;
  const c=Math.cos(a),sn=Math.sin(a);
  const x=x0+side*.032*c;
  const y=y0+.0115*sn*(1-.11*c);
  const z=z0+.0045*c*c;
  verts.push(x,y,z);
  uv.push(.5+.5*c,.5+.5*sn);
  if(i<segments)indices.push(0,i+1,i+2);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();
 g.userData={kind:'dragonkin-inset-almond-golden-eye',detail,
  pupilFree:true,sourceLidPreserved:true,side};
 return g;
}
export function addFemaleSummonCostume({profile,frames,detail='high',attach,tube,
 attachGroom=null,skullFit=null,nativeScalp=null}={}){
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
  if(type!=='dragonkin_female'){
   // Dragon Lord has its own close-fitting eye sockets. These common
   // heavy face lines would stack into the black goggle-like band.
   line(frames.head,liner,'canthal-liner-'+side,[
    [side*.016,.058,-.132],[side*.061,.074,-.143],
    [side*.121,.089,-.108]],.006);
   line(frames.head,'rune','temple-mark-'+side,[
    [side*.094,.021,-.105],[side*.113,-.028,-.090],
    [side*.099,-.064,-.102]],.005);
  }
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
   // Branching woodland antlers carry foliage and blossom buds, never
   // the Guardian's feathers or halo. All details follow the Head bone.
   for(let i=0;i<3;i++){
    const y=.25+i*.056,x=.16+i*.031;
    line(frames.head,'leaf','wood-antler-branch-'+side+'-'+i,[
     [side*(x-.025),y-.04,.065],[side*(x+.045),y+.035,.063],
     [side*(x+.081),y+.072,.052]],.011);
    add(frames.head,createFemaleSummonLeaf({detail,size:.16+i*.025}),
     'leaf','antler-leaf-'+side+'-'+i,
     [side*x,y,.05],[side*.2,0,side*(.9+i*.35)]);
    orb(frames.head,'ivoryCloth','forest-flower-bud-'+side+'-'+i,
     [side*(x+.073),y+.067,.052],[.019,.012,.019]);
   }
   add(frames.head,createFemaleSummonLeaf({detail,size:.12}),
    'leaf','pointed-elf-ear-'+side,
    [side*.14,.024,-.013],[0,0,side*(Math.PI*.43)]);
   for(let i=0;i<6;i++)
    add(frames.chest,createFemaleSummonLeaf({detail,size:.21+i*.023}),
     'leaf','growing-mantle-leaf-'+side+'-'+i,
     [side*(.12+i*.037),.22-i*.10,.04],
     [.05,0,side*.55]);
  }
  // A green organic leaf mantle instead of the angel's ceremonial cloth.
  add(frames.chest,createGothicMantle({detail,width:.30,drop:.87,back:.26}),
   'leaf','forest-woven-cape');
 }
 if(type==='seraph_female'){
  // Retain the ORIGINAL Guardian's sculpted 3-row wing geometry, including
  // primary feathers, coverts and roots. Two pivots flap independently
  // while they stay attached to the real animated chest bone.
  const pair=createOriginalGuardianWingPair({detail:hi?'high':'low'});
  for(const side of [-1,1]){
   const pivot=new THREE.Group();
   pivot.name='female-seraph-original-wing-pivot-'+side;
   pivot.position.set(side*.15,.18,-.15);
   pivot.userData.seraphFlightWingSide=side;
   frames.chest.add(pivot);
   const geo=side<0?pair.left:pair.right;
   const mesh=attachGroom?
    attachGroom(pivot,geo,'seraphWing',
     'female-seraph-original-layered-wing-'+side):
    add(pivot,geo,'seraphWing','seraph-original-layered-wing-'+side);
   mesh.scale.setScalar(.61);
   mesh.userData.seraphOriginalSculpt=true;
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
  // One continuous SCALP-FITTED armour crown, attached to the actual Head
  // via its model-upright groom anchor. A fixed cap previously left a large
  // bald orange disc visible over the forehead in the mobile gallery.
  const crownFrame=frames.headGroom??frames.head;
  // Prefer original skinned female scalp triangles. A synthetic sphere cap
  // proved to be an oversized purple onion in the real user screenshot.
  // Keep the existing fallback only for missing/unsupported donor skins.
  const crownGeometry=nativeScalp??createDragonkinCranialShellGeometry({
   detail,...(skullFit?{center:skullFit.center,radius:skullFit.radius}:{})
  });
  if(profile.hair==='bald'){
   // Legacy hairless variant only. The approved dragon-queen design uses
   // continuous plum hair, so never put a scale helmet over that groom.
   if(attachGroom&&frames.headGroom){
    attachGroom(crownFrame,crownGeometry,'dragonScale',
     'female-dragonkin-scaled-hairless-crown');
   }else add(crownFrame,crownGeometry,'dragonScale',
    'dragonkin-scaled-hairless-crown');
  }else if(!nativeScalp){
   // No synthetic dome or redundant opaque forehead on the hair variant.
   crownGeometry.dispose();
  }
  for(const side of [-1,1]){
   // Eyes are now shallow, almond-shaped surfaces under their own slim
   // upper lids. Keep gold color without toy-like glowing black goggles.
   if(profile.hair==='bald')add(frames.head,
    createDragonkinAlmondEyeGeometry({side,detail}),
    'dragonEye','dragonkin-solid-golden-eye-'+side);
   // The approved coiffed variant retains original skinned eyeballs,
   // iris and eyelids. No duplicate gold circles over the real eyes.
   line(frames.head,'dragonRim','dragonkin-delicate-upper-lid-'+side,[
    [side*.017,.042,-.129],[side*.050,.052,-.151],
    [side*.086,.041,-.135]],hi?.0045:.0058);
   line(frames.head,'dragonRim','dragonkin-cheekbone-contour-'+side,[
    [side*.092,.006,-.125],[side*.114,-.040,-.116],
    [side*.082,-.090,-.133]],hi?.0055:.007);
   // The source's female nose and mouth remain visible: these lines are
   // tiny bony accents, NOT a second opaque facial mask.
   line(frames.head,'dragonScale','dragonkin-temple-scute-'+side,[
    [side*.113,.113,-.081],[side*.131,.052,-.090],
    [side*.126,-.022,-.083]],hi?.007:.009);
  }
  if(profile.hair==='bald')line(frames.head,'dragonScale',
   'dragonkin-fine-nasal-bridge',[
    [0,.074,-.119],[0,.007,-.145],[0,-.039,-.147]],.0055);
  // The original nose stays exposed in the coiffed design: a vertical
  // nasal tube caused the user's dangling moustache screenshot.
  line(frames.head,'lip','dragonkin-natural-lower-lip',[
   [-.051,-.105,-.130],[-.021,-.123,-.143],[0,-.128,-.148],
   [.021,-.123,-.143],[.051,-.105,-.130]],.0035);
  for(const side of [-1,1]){
   const rx=skullFit?.radius?.[0]??.119;
   const hornX=Math.max(.091,Math.min(.143,rx*.87));
   const hornY=Math.max(.12,Math.min(.19,
    (skullFit?.center?.[1]??.095)+(skullFit?.radius?.[1]??.16)*.37));
   orb(frames.head,'horn','dragon-horn-root-'+side,
    [side*hornX,hornY,.013],[.052,.028,.052]);
   add(frames.head,createGothicHorn({
    side,len:.30,radius:.055,curve:.25,detail
   }),'horn','dragon-swept-horn-'+side,[side*hornX,hornY,.006]);
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
