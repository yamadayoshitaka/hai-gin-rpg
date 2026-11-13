/**
 * High-quality humanoid monster preview assembled from the SAME canonical
 * Superhero_Male/Female skinned GLB and native animation library as the
 * game's real character action viewer. No editing human GLB or shared rigs.
 *
 * The old monster generator remains the immediate visual fallback until the
 * licensed canonical assets have been loaded and verified.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHumanBomRig} from './human-bom-renderer.js';
import {attachTownOutfitNpc} from './cc0-town-npc-visuals.js';
import {createMonsterModel,disposeMonsterSculpture} from './monster-geometry.js?v=4.5.03';
import {startMonsterAction,animateMonsterModel} from './monster-animation.js';
import {humanoidMonsterCostumeFor} from './monster-character-cosplay-manifest.js?v=4.5.03';
import {addGothicMonsterSculpt,hasGothicMonsterSculpt}
 from './monster-gothic-sculpt.js';
import {decorateMonsterPhotoMaterial,detachMonsterPhotoMaterial}
 from './monster-photo-pbr.js';
import {classifyCosplaySurface,applyMonsterMaterialPigment}
 from './monster-cosplay-pigmentation.js';
import {addConstructMonsterCostume,isConstructCostume}
 from './monster-construct-costume.js';
import {addDemonicFaceCosmetics,hasDemonCosmetics}
 from './monster-demon-cosmetics.js?v=4.5.04';
import {addFemaleSummonCostume,isFemaleSummonCostume}
 from './female-summon-costumes.js?v=4.5.04';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const boneName=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const DEFAULT_MOTION=Object.freeze({
 idle:'idle',walk:'walk',run:'run',attack:'attack',special:'attack',
 roar:'attack',dodge:'guard',hit:'hit',leap:'run',defeat:'dead'
});
const TIME_LIMITS=Object.freeze({
 attack:1.1,special:1.6,roar:1.3,dodge:.7,hit:.45,leap:1.25
});

/** Convert a visible canonical human rig bone into an anatomical world-metre
 * attachment frame, inherited by every subsequent skeletal animation pose. */
function createFrame(bone,model){
 const frame=new THREE.Group();frame.name='monster-costume-bone-anchor';
 bone.updateWorldMatrix(true,false);
 model.updateWorldMatrix(true,false);
 const q=bone.getWorldQuaternion(new THREE.Quaternion()).invert()
   .multiply(model.getWorldQuaternion(new THREE.Quaternion()));
 frame.quaternion.copy(q);
 const scale=bone.getWorldScale(new THREE.Vector3());
 frame.scale.set(
  1/Math.max(.0001,Math.abs(scale.x)),
  1/Math.max(.0001,Math.abs(scale.y)),
  1/Math.max(.0001,Math.abs(scale.z)));
 bone.add(frame);
 return frame;
}
function locateBones(model){
 const byName=new Map();
 model.traverse(node=>{if(node.isBone&&!byName.has(boneName(node.name)))
  byName.set(boneName(node.name),node);});
 const find=(...names)=>names.map(x=>byName.get(boneName(x))).find(Boolean)||null;
 return {
  head:find('Head','head_01'),neck:find('neck_01','neck'),
  spine:find('spine_02','spine_01','spine','chest','hips'),
  arms:[find('upperarm_l','leftarm'),find('upperarm_r','rightarm')],
  forearms:[find('lowerarm_l','leftforearm'),find('lowerarm_r','rightforearm')],
  legs:[find('thigh_l','leftupleg'),find('thigh_r','rightupleg')],
  calves:[find('calf_l','leftleg'),find('calf_r','rightleg')],
 };
}
function buildMonsterCostume(THREE,model,profile,detail){
 const joints=locateBones(model);
 if(!joints.head||!joints.spine||joints.arms.some(b=>!b)||joints.legs.some(b=>!b))
  throw Error('Canonical humanoid rig lacks head/chest/limbs for cosplay');
 const frames={
  head:createFrame(joints.head,model),
  neck:createFrame(joints.neck??joints.head,model),
  chest:createFrame(joints.spine,model),
  arms:joints.arms.map(b=>createFrame(b,model)),
  forearms:joints.forearms.map((b,i)=>createFrame(b??joints.arms[i],model)),
  legs:joints.legs.map(b=>createFrame(b,model)),
  calves:joints.calves.map((b,i)=>createFrame(b??joints.legs[i],model)),
 };
 const ownedGeo=[],ownedMats=[];
 const palette={skin:profile.skin,cloth:profile.cloth,metal:profile.metal,
  accent:profile.accent,bone:0xd6cdb4,bandage:0xb6a993,
  ivory:0xc3b9ab,linen:0xb5a58e,
  stain:0x3b322f,black:0x1b141a,iris:0xb94a2e,
  velvet:profile.costume==='vampire'?0x251923:0x2d2733,
  lining:profile.costume==='vampire'?0x662c43:0x402a43,
  edge:profile.costume==='vampire'?0xac8e74:0x8d7774,
  horn:profile.costume==='succubus'?0x393344:0x58484c,
  membrane:profile.costume==='succubus'?0x54334a:0x38323f,
  makeup:profile.makeup??0x201c29,
  lip:profile.lip??0x5e273b,
  rune:profile.accent??0x922c52,
  leaf:profile.leaf??0x67854b,
  feather:profile.feather??0xe3dec9,
  crystal:profile.crystal??0x90d3dd
 };
 const materials=new Map();
 const mat=(role)=>{
  if(!materials.has(role)){
   const isMetal=role==='metal',m=new THREE.MeshStandardMaterial({
    color:palette[role]??0x999999,
    roughness:isMetal?.42:role==='bone'?.86:
      role==='velvet'?.96:role==='linen'?.96:
      role==='ivory'?.83:role==='iris'?.27:role==='membrane'?.81:.90,
    metalness:isMetal?.64:role==='edge'?.38:0,
    emissive:role==='iris'?0x260907:
      role==='rune'?new THREE.Color(palette.rune).multiplyScalar(.08):0x000000,
    emissiveIntensity:role==='iris'?.20:role==='rune'?.14:0,
    side:THREE.DoubleSide,
   });
   // Reuse the exact bundled photographic texture cache that already serves
   // the nonhumanoid bestiary. No new API, CDN request or per-monster textures.
   const surfaceRole={
    velvet:'fabric',lining:'fabric',linen:'bandage',
    metal:'metal',edge:'metal',membrane:'leather'
   }[role];
   if(surfaceRole)decorateMonsterPhotoMaterial(m,{
     family:'undead',speciesId:profile.id,role:surfaceRole,detail
   });
   materials.set(role,m);ownedMats.push(m);
  }
  return materials.get(role);
 };
 const attach=(frame,geometry,role,name,position=[0,0,0],rotation=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,mat(role));
  mesh.name='monster-costume-'+name;
  mesh.position.set(...position);mesh.rotation.set(...rotation);
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.monsterCosplay=true;
  frame.add(mesh);ownedGeo.push(geometry);return mesh;
 };
 const tube=(frame,role,name,points,radius=.012)=>{
  const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),detail==='low'?6:14,
   radius,detail==='low'?5:8,false);
  return attach(frame,g,role,name);
 };
 const torus=(frame,role,name,x,y,z,rx,rz,edge=.012)=>{
  const g=new THREE.TorusGeometry(1,edge,detail==='low'?5:7,
    detail==='low'?12:22);
  g.scale(rx,rz,1); // ellipsoid lip; a folded costume trim, not a floating sphere
  g.rotateX(Math.PI*.5);
  return attach(frame,g,role,name,[x,y,z]);
 };
 const horn=(frame,name,side,x,y,z,len=.16,radius=.043,color='metal')=>{
  const g=new THREE.ConeGeometry(radius,len,detail==='low'?7:12,3);
  const m=attach(frame,g,color,name,[side*x,y+len*.42,z]);
  m.rotation.z=side*(.18+.16*(profile.costume==='gargoyle'));
  return m;
 };
 const bands=(frame,name,y0,y1,rx,rz,turns=2.6,role='bandage')=>{
  const points=[],steps=detail==='low'?24:70;
  for(let i=0;i<=steps;i++){
   const t=i/steps,a=t*turns*Math.PI*2;
   points.push([Math.cos(a)*rx,y0+(y1-y0)*t,Math.sin(a)*rz]);
  }
  return tube(frame,role,name,points,detail==='low'?.012:.017);
 };
 // Keep the original canonical skinned face and facial bone proportions.
 // Colors are instance-local material CLONES, never mutated on hero assets.
 // Every canonical skinned mesh is given species pigmentation. Earlier,
 // only hero meshes explicitly named "skin|face|body" changed color, leaving
 // some healthy pink limbs/heads visible among undead costume parts.
 // Original source materials remain untouched and maps/normals are retained.
 model.traverse(node=>{
  if(!node.isMesh||!node.material)return;
  const recolor=m=>{
   const role=classifyCosplaySurface(node.name,m.name,{
    isSkinnedMesh:!!node.isSkinnedMesh
   });
   if(role==='preserve')return m;
   const copy=applyMonsterMaterialPigment(m,role,profile);
   ownedMats.push(copy);
   return copy;
  };
  node.material=Array.isArray(node.material)?node.material.map(recolor):recolor(node.material);
 });
 // The canonical actor already has garments. Overlays only cover species
 // identity (e.g. mummy wraps) and fitted folds; no replacement mannequin.
 const costume=profile.costume;
 const gothic=hasGothicMonsterSculpt(costume);
 const construct=isConstructCostume(profile);
 const demonic=hasDemonCosmetics(profile);
 const femaleSummon=isFemaleSummonCostume(profile);
 if(gothic)addGothicMonsterSculpt({
   THREE,profile,detail,frames,attach,tube,torus
 });
 if(construct)addConstructMonsterCostume({
   THREE,profile,detail,frames,attach,tube
 });
 if(demonic)addDemonicFaceCosmetics({
   THREE,profile,detail,frames,attach,tube
 });
 if(femaleSummon)addFemaleSummonCostume({
   THREE,profile,detail,frames,attach,tube
 });
 const ceremonial=['vampire','lich','succubus','death_knight','dark_knight'];
 if(!gothic&&ceremonial.includes(costume)){
  torus(frames.chest,'cloth','fitted-collar',0,.21,-.005,.17,.095,.045);
  torus(frames.chest,'metal','waist-belt',0,-.33,0,.19,.13,.024);
  for(const side of [-1,1])
   tube(frames.chest,'metal','lapel-'+side,[
    [side*.13,.29,-.12],[side*.08,.05,-.16],[side*.19,-.21,-.14]
   ],.014);
 }
 if(!gothic&&['death_knight','dark_knight','demon','gargoyle'].includes(costume)){
  // Armour uses the same upper-arm bone as the game character.
  for(const side of [-1,1]){
   const k=side<0?0:1;
   attach(frames.arms[k],new THREE.SphereGeometry(.16,detail==='low'?8:12,8,
     0,Math.PI*2,0,Math.PI*.62),'metal','shoulder-plate-'+k,
     [0,-.02,-.01],[0,0,side*.15]);
   torus(frames.forearms[k],'metal','gauntlet-rim-'+k,0,-.20,0,.088,.080,.016);
  }
 }
 if(!gothic&&['mummy','skeleton','lich'].includes(costume)){
  for(let side=0;side<2;side++){
   bands(frames.forearms[side],'forearm-wrap-'+side,-.27,.01,.084,.082,2.7);
   bands(frames.calves[side],'shin-wrap-'+side,-.27,.06,.115,.103,2.6);
  }
 }
 if(!gothic&&costume==='mummy'){
  bands(frames.head,'face-wrap',-.09,.16,.125,.14,2.9);
  bands(frames.chest,'torso-wrap',-.32,.31,.25,.19,3.8);
 }
 if(!gothic&&costume==='skeleton'){
  // Existing humanoid facial anatomy stays beneath a bone-colored skull
  // mask, with recessed eye sockets; not the old separate puppet head.
  attach(frames.head,new THREE.SphereGeometry(.124,detail==='low'?14:22,12),
    'bone','skull-mask',[0,.025,-.008]);
  for(const side of [-1,1])attach(frames.head,
   new THREE.SphereGeometry(.028,10,8),'cloth','eye-socket-'+side,
   [side*.050,.04,-.111]);
  for(let i=0;i<5;i++)tube(frames.chest,'bone','exposed-rib-'+i,
   [[-.18,.26-i*.094,-.12],[0,.21-i*.094,-.18],[.18,.26-i*.094,-.12]],.018);
 }
 if(!gothic&&profile.fangs){
  // Small attached canines follow the actual head bone on every action.
  for(const side of [-1,1]){
   horn(frames.head,'gingival-canine-'+side,side,.038,-.075,-.111,.056,.010,'bone');
   attach(frames.head,new THREE.SphereGeometry(.020,8,6),
    'skin','fang-gum-'+side,[side*.040,-.072,-.115]);
  }
 }
 if((!gothic&&!demonic&&profile.horns)||costume==='tengu'){
  for(const side of [-1,1]){
   attach(frames.head,new THREE.SphereGeometry(.052,9,8),
    'skin','horn-bone-bed-'+side,[side*.085,.115,-.024]);
   horn(frames.head,'horn-'+side,side,.085,.11,-.02,
    costume==='demon'?.24:.145,costume==='demon'?.052:.033,'metal');
  }
 }
 if(profile.beak){
  attach(frames.head,new THREE.ConeGeometry(.055,.18,10,4),
    'metal','tengu-beak',[0,-.018,-.157],[Math.PI*.5,0,0]);
 }
 if(!gothic&&(profile.cape||['vampire','lich','dark_knight'].includes(costume))){
  // Back cloth is a concave sheet attached to the spine, not detached
  // shoulder pads placed above a separately animated torso.
  const w=.31,top=.24,bottom=-.78,g=new THREE.BufferGeometry();
  const p=[],uv=[],indices=[],cols=detail==='low'?5:10,rows=detail==='low'?5:13;
  for(let i=0;i<=rows;i++){
   const t=i/rows;
   for(let j=0;j<=cols;j++){
    const u=j/cols,x=(u*2-1)*(w+t*.12);
    p.push(x,top+(bottom-top)*t,.18+.10*t*t+.026*Math.sin(u*Math.PI*2)*t);
    uv.push(u,t);
   }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
   const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();
  attach(frames.chest,g,'cloth','draped-cape');
 }
 if(!gothic&&!demonic&&!femaleSummon&&profile.wings){
  // Wing roots are rigidly anchored to the canonical upper torso;
  // skinned shoulders retain their original motion and proportions.
  for(const side of [-1,1]){
   const pts=[[side*.15,.20,.16],[side*.43,.46,.42],
    [side*.95,.55,.64],[side*1.25,.31,.75]];
   tube(frames.chest,'metal','wing-spar-'+side,pts,.056);
   const g=new THREE.BufferGeometry();
   const vertices=[...pts[0],...pts[1],...pts[2],
    side*.86,-.29,.57,...pts[3]];
   const indices=[0,1,3,1,2,3,2,4,3];
   g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   g.setAttribute('uv',new THREE.Float32BufferAttribute(
    [0,0,.4,.9,.9,1,.6,0,1,0],2));
   g.setIndex(indices);g.computeVertexNormals();
   attach(frames.chest,g,'cloth','scapular-wing-'+side);
  }
 }
 if(profile.mage){
  bands(frames.chest,'rune-hem',-.38,-.21,.23,.17,1.9,'accent');
 }
 model.userData.monsterCostume={
  id:profile.id,kind:costume,heroSource:profile.modelId,
  originalSkeleton:true,overlayMeshes:ownedGeo.length,
  gothicSculptEdition:gothic?'gothic-horror-2026-11':null,
  constructSculptEdition:construct?'human-rigged-construct-2026-11':null,
  skinColor:profile.skin,skinMaterialIsolation:true,
  demonCosmeticsEdition:demonic?'horns-makeup-runes-v1':null,
  femaleSummonCostumeEdition:femaleSummon?'female-summon-v1':null,
  jointAnchored:true,independentHeroMaterials:true,
 };
 return ()=>{
  for(const frame of [...Object.values(frames).filter(x=>x?.isGroup),
   ...frames.arms,...frames.forearms,...frames.legs,...frames.calves])
   frame.parent?.remove(frame);
  for(const geo of ownedGeo)geo.dispose();
  for(const material of ownedMats){
   detachMonsterPhotoMaterial(material);
   material.dispose();
  }
 };
}
export function createCosplayedHumanoidMonster(spec,{
 detail='high',genderVariant=null,profileOverride=null,withoutFallback=false
}={}){
 const profile=profileOverride||humanoidMonsterCostumeFor(spec,{genderVariant});
 if(!profile)throw Error('No humanoid cosplay mapping '+String(spec?.id));
 const root=new THREE.Group();root.name=spec.id+'-'+spec.name+'-cosplay';
 const fallback=withoutFallback?null:createMonsterModel(spec,{detail});
 if(fallback)root.add(fallback);
 const host=new THREE.Group();host.name='character-cosplay-host';root.add(host);
 host.userData.actorId='monster-'+spec.id;
 host.userData.canonicalCharacterTrial=true;
 host.userData.characterBOM={jobId:profile.equipment==='bow'?'archer':
   profile.equipment==='staff'||profile.role==='royal'?'mage':'swordsman'};
 host.userData.previewAction='idle';
 let disposed=false,ready=false,failed=false,rig=null,visual=null;
 let disposeCostume=null,activeAction='idle',lastTime=null,lastAction='idle';
 const state={root,source:'procedural-loading',profile,
  start(action,time=0){
   if(root.userData.action!==action||root.userData.actionAt!==time){
    root.userData.action=action;root.userData.actionAt=time;
   }
   if(!ready&&fallback)startMonsterAction(fallback,action,time);
  },
  update(time){
   if(disposed)return;
   let action=root.userData.action||'idle',elapsed=Math.max(0,time-(root.userData.actionAt??0));
   if(TIME_LIMITS[action]&&elapsed>TIME_LIMITS[action]){
    action='idle';root.userData.action='idle';root.userData.actionAt=time;
   }
   if(!ready){
    if(fallback?.parent){
     if(fallback.userData.action!==action)startMonsterAction(fallback,action,time);
     animateMonsterModel(fallback,time);
    }
    return;
   }
   const motion=host.userData.canonicalMotion;
   if(!motion)return;
   const clip=DEFAULT_MOTION[action]||'idle',chosen=motion.actions[clip]?clip:'idle';
   if(lastAction!==chosen||!motion.active){
    if(motion.active&&motion.active!==motion.actions[chosen])
     motion.active.fadeOut(.16);
    const target=motion.actions[chosen];
    if(target){
     target.reset().fadeIn(.16).play();motion.active=target;
    }
    lastAction=chosen;
   }
   const delta=lastTime===null?0:clamp(time-lastTime,0,.13);
   lastTime=time;motion.mixer.update(delta);
   host.userData.previewAction=action;
   host.userData.syncFacialSkeleton?.();
   // Costume groups are parented directly to the SAME GLB bones and require
   // no per-frame position copies, retargeting or extra skeleton allocation.
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   disposeCostume?.();
   host.userData.canonicalMotion?.mixer?.stopAllAction();
   host.userData.canonicalMotion?.jobController?.dispose?.();
   host.userData.footContactIK?.dispose?.();
   if(visual)host.remove(visual);
   host.parent?.remove(host);
   if(fallback?.parent){root.remove(fallback);disposeMonsterSculpture(fallback);}
   root.parent?.remove(root);
  },
 };
 state.ready=(async()=>{
  await Promise.resolve();
  if(disposed||!root.parent)return {source:'cancelled'};
  const contract={
   modelId:profile.modelId,sex:profile.sex,
   role:profile.role,body:profile.body,bodyType:profile.body,
   face:profile.face,hair:profile.hair,outfit:profile.outfit,
   equipment:profile.equipment,jobId:host.userData.characterBOM.jobId,
   id:profile.id
  };
  try{
   rig=createHumanBomRig(THREE,host,{
    id:'monster-costume-'+spec.id,role:profile.role,
    variant:spec.variant,assembly:contract
   });
   // Exactly as in action-test.html: retain the logical BOM skeleton for
   // rig validation, but remove its replacement mannequin, 10k strand hair
   // and primitive outfit. They would otherwise pollute Box3 inspection
   // bounds and could double-render over the canonical skinned GLB.
   const obsolete=[];
   rig.root.traverse(node=>{
    if(node.isMesh||node.isLineSegments)obsolete.push(node);
   });
   for(const node of obsolete)node.parent?.remove(node);
   rig.root.visible=false;
   const ok=await attachTownOutfitNpc({
    host,rig,preset:contract,loader:new GLTFLoader(),THREE
   });
   if(!ok)throw Error(host.userData.characterVisualError||
      'Canonical skinned character asset not available');
   visual=host.userData.canonicalVisualRoot||
      host.children.find(x=>x.userData?.sourceModelId);
   if(!visual?.userData?.sourceModelId)throw Error('Canonical visual missing');
   if(disposed)return {source:'cancelled'};
   disposeCostume=buildMonsterCostume(THREE,visual,profile,detail);
   if(disposed)return {source:'cancelled'};
   fallback.parent?.remove(fallback);
   disposeMonsterSculpture(fallback);
   root.scale.setScalar((profile.scale??1)*(spec.size??1));
   root.userData.speciesId=spec.id;
   root.userData.surfaceFamily=spec.family;
   root.userData.costumeSource=profile.modelId;
   root.userData.pivots=rig.joints;
   ready=true;state.source='canonical-character-cosplay';
   return {source:state.source,modelId:profile.modelId};
  }catch(error){
   failed=true;
   state.source='procedural-fallback';
   state.reason=String(error?.message||error);
   host.userData.canonicalMotion?.mixer?.stopAllAction();
   disposeCostume?.();
   if(visual)host.remove(visual);
   host.parent?.remove(host);
   if(!disposed)console.warn('Monster character cosplay fallback',spec.id,error);
   return {source:state.source,reason:state.reason};
  }
 })();
 return state;
}
