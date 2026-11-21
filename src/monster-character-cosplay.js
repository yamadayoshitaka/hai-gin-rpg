/**
 * High-quality humanoid monster preview assembled from the SAME canonical
 * Superhero_Male/Female skinned GLB and native animation library as the
 * game's real character action viewer. No editing human GLB or shared rigs.
 *
 * The old monster generator remains the immediate visual fallback until the
 * licensed canonical assets have been loaded and verified.
 */
import * as THREE from 'three';
import {resolveMonsterThemeAction} from './monster-theme-actions.js';
import {enhanceMonsterHumanoidCostumeMaterial} from './monster-reference-finish.js';
import {applyCanonicalMonsterThemeMotion} from './monster-theme-motion.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHumanBomRig} from './human-bom-renderer.js';
import {attachTownOutfitNpc} from './cc0-town-npc-visuals.js';
import {createMonsterModel,disposeMonsterSculpture} from './monster-geometry.js?v=monster-all50-pbr-v1-20261121';
import {startMonsterAction,animateMonsterModel} from './monster-animation.js?v=phoenix-tengu-flight-motion-v14-cere-20261118';
import {AVIAN_REALISM_REVISION} from './avian-guardian-sculpt.js?v=phoenix-adult-raptor-v14-cere-tengu-flight-20261118';
import {createHumanoidMonsterCombatMotion} from './monster-humanoid-combat-poses.js?v=4.5.18';
import {humanoidMonsterCostumeFor} from './monster-character-cosplay-manifest.js?v=4.5.03';
import {addGothicMonsterSculpt,hasGothicMonsterSculpt}
 from './monster-gothic-sculpt.js?v=4.5.11';
import {decorateMonsterPhotoMaterial,detachMonsterPhotoMaterial}
 from './monster-photo-pbr.js?v=monster-all50-pbr-v1-20261121';
import {decorateAll50MonsterSurface}
 from './monster-all50-surface.js?v=all50-species-materials-v1-20261121';
import {classifyCosplaySurface,applyMonsterMaterialPigment}
 from './monster-cosplay-pigmentation.js?v=4.5.21';
import {addConstructMonsterCostume,isConstructCostume,
 CONSTRUCT_SHELL_SPECIES,CONSTRUCT_FULL_SHELL_REVISION,isFullBodyMonsterShell}
 from './monster-construct-costume.js?v=golem-anatomical-facets-v3-20261121';
import {addDemonicFaceCosmetics,hasDemonCosmetics}
 from './monster-demon-cosmetics.js?v=4.5.05';
import {addFemaleSummonCostume,isFemaleSummonCostume,createOriginalGuardianWingPair}
 from './female-summon-costumes.js?v=4.5.21';
import {createDragonkinNativeScalpOverlay}
 from './dragonkin-native-scalp.js?v=4.5.14';
import {cutFemaleSummonScalpUnderCover}
 from './female-summon-scalp-cut.js?v=4.5.15';
import {planHumanoidCosplayBase}
 from './monster-studio-base-intake.js?v=4.5.16';
import {attachCanonicalCharacterGroom,createCanonicalHeadLocalGroomAnchor,
 measureCanonicalScalp}
 from './monster-humanoid-hair.js?v=4.5.20';
import {alignCostumeToCanonicalFacing}
 from './monster-anatomical-frame.js?v=4.5.05';
import {addRegalHumanoidOutfit,wardrobeFor,measureRegalShoulderFit,
 createRegalLimbGeometry,createRegalFootGeometry}
 from './monster-regal-garments.js?v=4.5.19';

import {addGargoyleMonsterAnatomy,createGargoyleStoneTexture,
 createGargoylePbrMaterial,GARGOYLE_SPECIES_REVISION,
 poseGargoyleSwordClearance}
 from './monster-gargoyle-sculpt.js?v=m042-slender-talon-safe-sword-v3-20261121';
import {createMineralLimbArticulator}
 from './monster-mineral-limb-articulator.js?v=bone-to-bone-20261121';
import {applyHumanlikeConceptFinish}
 from './monster-humanoid-concept-finish.js?v=humanoid-concept-sculpt-v1-20261121';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const tenguWingDonors=new Map();
function getTenguWingDonor(detail){
 const key=['source','high'].includes(detail)?'high':'low';
 if(!tenguWingDonors.has(key))tenguWingDonors.set(key,createOriginalGuardianWingPair({detail:key}));
 return tenguWingDonors.get(key);
}
const boneName=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const DEFAULT_MOTION=Object.freeze({
 idle:'idle',walk:'walk',run:'run',attack:'attack',special:'attack',
 roar:'attack',guard:'guard',dodge:'guard',hit:'hit',leap:'run',defeat:'dead'
});
const TIME_LIMITS=Object.freeze({
 attack:1.1,special:1.6,roar:1.3,guard:.9,dodge:.7,hit:.45,leap:1.25
});


/** Actual flying behaviour for the canonical humanoid GLB, not merely
 * the procedural m015 fallback. All movement derives from absolute time,
 * not accumulated drift; the person's approved head mesh stays untouched.
 */
function updateCanonicalTenguFlight(root,host,visual,action,time,elapsed){
 const inAir=action!=='defeat',height=1.42;
 const hover=.056*Math.sin(time*1.7)+.014*Math.sin(time*3.2);
 const p=clamp(elapsed/1.15,0,1),land=1-p*p*(3-2*p);
 const attack=action==='attack'?Math.sin(Math.PI*clamp(elapsed/1.1,0,1)):0;
 const leap=action==='leap'?Math.sin(Math.PI*clamp(elapsed/1.25,0,1)):0;
 const altitude=inAir?Math.max(.44,height+hover+.50*leap-.33*attack):height*land;
 root.position.y=altitude;
 root.userData.avianInAir=inAir&&altitude>.4;
 root.userData.avianCurrentAltitude=altitude;
 root.userData.tenguFlightAction=action;
 root.userData.tenguLegsTucked=inAir;
 root.userData.tenguGuardianFeatherRig=!!visual?.userData?.tenguGuardianFeatherRig;
 host.rotation.x=inAir?-(action==='run'?.12:.03)-.18*attack:0;
 host.rotation.z=inAir?.045*Math.sin(time*.83):0;
 const tempo=action==='run'?5.2:action==='attack'?6.1:3.5;
 for(const pivot of visual?.userData?.tenguWingPivots||[]){
  const side=pivot.userData.tenguFlightWingSide,beat=Math.sin(time*tempo);
  pivot.rotation.z=side*(inAir?.20+.47*beat:.06);
  pivot.rotation.x=inAir?-.10+.17*Math.cos(time*tempo-.35):0;
  pivot.rotation.y=side*(inAir?.07:0);
 }
 // Original canonical mixer writes each leg before the aerodynamic tuck.
 // No shared skeletons, facial expressions or native GLB clips are replaced.
 if(inAir)for(const leg of visual?.userData?.tenguLegBones||[])
  if(leg)leg.rotation.x+=.32;
}

/** m042 flying gargoyle: airborne idle, progress, attacks and defeat landing. */
function updateCanonicalGargoyleFlight(root,host,visual,action,time,elapsed){
 const flying=action!=='defeat',height=1.35;
 const pulse=(duration)=>Math.sin(Math.PI*clamp(elapsed/duration,0,1));
 const attack=action==='attack'?pulse(1.1):0;
 const special=action==='special'?pulse(1.6):0;
 const leap=action==='leap'?pulse(1.25):0;
 const hover=.065*Math.sin(time*1.65)+.018*Math.sin(time*3.1);
 const landing=1-clamp(elapsed/1.15,0,1);
 const altitude=flying?
  Math.max(.44,height+hover+.48*leap-.30*attack-.14*special):
  height*landing*landing;
 root.position.y=altitude;
 root.userData.gargoyleInAir=flying&&altitude>.4;
 root.userData.gargoyleCurrentAltitude=altitude;
 root.userData.gargoyleFlightAction=action;
 root.userData.gargoyleSwordArmed=!!visual?.userData?.monsterCostume?.gargoyleSword;
 host.rotation.x=flying?-.045-(action==='run'?.12:0)-.10*attack:0;
 host.rotation.z=flying?.025*Math.sin(time*.9):0;
 const tempo=action==='run'?5.6:action==='attack'?6.8:3.8;
 const power=action==='run'?.48:action==='attack'?.52:.32;
 for(const pivot of visual?.userData?.gargoyleWingPivots||[]){
  const side=pivot.userData.gargoyleWingSide,beat=Math.sin(time*tempo);
  pivot.rotation.z=side*(flying?.13+power*beat:.035);
  pivot.rotation.x=flying?-.06+.14*Math.cos(time*tempo-.25):0;
  pivot.rotation.y=flying?side*.055:0;
 }
 if(flying)for(const leg of visual?.userData?.gargoyleFlightLegBones||[])
  if(leg)leg.rotation.x+=.35;
 poseGargoyleSwordClearance({
  swordPivot:visual?.userData?.gargoyleSwordPivot,
  chest:visual?.userData?.gargoyleChestFrame,body:visual,
  action,progress:clamp(elapsed/(TIME_LIMITS[action]||1),0,1)
 });
}
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
  pelvis:find('hips','pelvis','root'),
  arms:[find('upperarm_l','leftarm'),find('upperarm_r','rightarm')],
  forearms:[find('lowerarm_l','leftforearm'),find('lowerarm_r','rightforearm')],
  hands:[find('hand_l','lefthand'),find('hand_r','righthand')],
  legs:[find('thigh_l','leftupleg'),find('thigh_r','rightupleg')],
  calves:[find('calf_l','leftleg'),find('calf_r','rightleg')],
  feet:[find('foot_l','leftfoot'),find('foot_r','rightfoot')]
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
  pelvis:createFrame(joints.pelvis??joints.spine,model),
  arms:joints.arms.map(b=>createFrame(b,model)),
  forearms:joints.forearms.map((b,i)=>createFrame(b??joints.arms[i],model)),
  hands:joints.hands.map((b,i)=>b?createFrame(b,model):null),
  legs:joints.legs.map(b=>createFrame(b,model)),
  calves:joints.calves.map((b,i)=>createFrame(b??joints.legs[i],model)),
  feet:joints.feet.map((b,i)=>b?createFrame(b,model):null),
 };
 // Cosmetics use a model-oriented head frame; scalp is measured in the
 // donor head bone's LOCAL coordinates. Never combine the two spaces.
 frames.headGroom=createCanonicalHeadLocalGroomAnchor(joints.head,model);
 // Use measured real shoulder pivots rather than one arbitrary gown
 // diameter for a slim female, heavy guard and broad male actor.
 const outfitFit=measureRegalShoulderFit(joints.arms[0],joints.arms[1]);
 const ownedGeo=[],ownedMats=[],ownedTextures=[];
 const construct=isConstructCostume(profile);
 const fullBody=isFullBodyMonsterShell(profile);
 const mineral=fullBody?CONSTRUCT_SHELL_SPECIES[profile.costume]:null;
 const concealedDonorMeshes=[];
 const palette={
  constructBase:mineral?.base??0x777777,
  constructFacet:mineral?.facet??0xaaaaaa,
  constructTrim:mineral?.trim??0x444444,
  constructCore:mineral?.core??0xffffff,
  constructDark:mineral?.dark??0x222222,skin:profile.skin,cloth:profile.cloth,metal:profile.metal,
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
  forestMint:profile.forestMint??0x92de69,
  forestDeep:profile.forestDeep??0x197540,
  feather:profile.feather??0xe3dec9,
  crystal:profile.crystal??0x90d3dd,
  hair:profile.hairColor??(profile.id==='seraph_guardian'?0xd7bd7c:
   profile.id==='forest_archer'?0xb4a77a:
   profile.id==='dragon_lord'?0x583a49:
   profile.sex==='female'?0x453243:0x302929),
  ivoryCloth:profile.costume==='seraph_female'?0xe8dfd2:0xd1c1ae,
  gold:profile.costume==='seraph_female'?0xd9b96e:
   profile.costume==='forest_spirit_female'?0xb1a26a:0xa88152,
  dragonScale:0x665162,dragonRim:0x503e50,
  seraphWing:0xffffff,
  dragonEye:0xe4b564
 };
 const materials=new Map();
 let gargoyleTexture=null;
 const mat=(role)=>{
  if(!materials.has(role)){
   if(profile.id==='m042'&&role.startsWith('gargoyle')){
    if(!gargoyleTexture){
     gargoyleTexture=createGargoyleStoneTexture({size:detail==='low'?64:128});
     ownedTextures.push(gargoyleTexture);
    }
    const m=createGargoylePbrMaterial(role,gargoyleTexture);
    ownedMats.push(m);materials.set(role,m);return m;
   }
   if(fullBody&&role.startsWith('construct')){
    // Mineral PBR is local, vivid and photograph-free. A donor's dark
    // velvet diffuse atlas must never turn purple crystal into black cloth.
    const isCore=role==='constructCore';
    const isCrystal=profile.costume==='crystal_construct';
    const isMetalShell=['bronze_construct','silver_construct','dark_knight'].includes(profile.costume);
    const m=new THREE.MeshPhysicalMaterial({
     color:palette[role],flatShading:true,side:THREE.DoubleSide,
     roughness:isCrystal?.24:isMetalShell?.36:.79,
     metalness:isCrystal?.18:isMetalShell?.66:.07,
     clearcoat:isCrystal?.68:.12,clearcoatRoughness:isCrystal?.17:.49,
     emissive:isCore?palette[role]:isCrystal?0x160827:0x000000,
     emissiveIntensity:isCore?.50:isCrystal?.14:0,
    });
    m.userData={golemMaterial:true,photographicHumanAlbedo:false,
     species:profile.id,role};
    if(profile.id==='m036'&&['constructBase','constructFacet',
      'constructDark'].includes(role)){
      decorateMonsterPhotoMaterial(m,{speciesId:profile.id,
        family:'golem',role:'skin',detail});
    }
    decorateAll50MonsterSurface(m,{speciesId:profile.id,role,detail});
   enhanceMonsterHumanoidCostumeMaterial(m,{profile,role,detail});
    ownedMats.push(m);materials.set(role,m);return m;
   }
   const isMetal=role==='metal'||role==='gold',m=new THREE.MeshStandardMaterial({
    color:palette[role]??0x999999,
    vertexColors:role==='seraphWing',
    roughness:isMetal?.42:role==='bone'?.86:
      role==='velvet'?.96:role==='linen'?.96:
      role==='ivory'?.83:role==='iris'?.27:role==='membrane'?.81:
      role==='dragonScale'?.78:role==='dragonRim'?.83:
      role==='seraphWing'?.88:
      role==='dragonEye'?.56:.90,
    metalness:isMetal?.64:role==='edge'?.38:
      role==='dragonScale'?.13:0,
    emissive:role==='iris'?0x260907:
      role==='dragonEye'?0x382307:
      role==='rune'?new THREE.Color(palette.rune).multiplyScalar(.08):0x000000,
    emissiveIntensity:role==='iris'?.20:role==='dragonEye'?.07:
      role==='rune'?.14:0,
    side:THREE.DoubleSide,
   });
   // Use the original Guardian's own bundled linen photograph on the
   // borrowed feather geometry, with its existing vertex-colour gradients.
   if(role==='seraphWing'&&typeof document!=='undefined'){
    const wingMap=new THREE.TextureLoader().load(
     new URL('../assets/textures/outfits/linen.jpg',import.meta.url).href);
    wingMap.colorSpace=THREE.SRGBColorSpace;
    wingMap.wrapS=wingMap.wrapT=THREE.RepeatWrapping;
    wingMap.repeat.set(1.8,1.8);
    wingMap.anisotropy=4;
    m.map=wingMap;m.needsUpdate=true;ownedTextures.push(wingMap);
   }
   // Reuse the exact bundled photographic texture cache that already serves
   // the nonhumanoid bestiary. No new API, CDN request or per-monster textures.
   const surfaceRole={
    velvet:'fabric',lining:'fabric',linen:'bandage',
    metal:'metal',gold:'metal',ivoryCloth:'fabric',
    // The user's screenshot showed a BLACK forest robe: the library's
    // 'fabric' category loads dark burgundy/black velvet ALBEDO and
    // multiplies the leaf green tint almost to zero. Forest greens
    // need pale LINEN albedo for physically shaded readable saturation.
    leaf:'bandage',forestMint:'bandage',forestDeep:'bandage',
    cloth:profile.forestGreen?'bandage':'fabric',
    edge:'metal',membrane:'leather'
   }[role];
   if(surfaceRole)decorateMonsterPhotoMaterial(m,{
     family:'undead',speciesId:profile.id,role:surfaceRole,detail
   });
   if(profile.forestGreen&&
      ['leaf','forestMint','forestDeep','cloth'].includes(role)){
     // The neutral linen detail retains folds, unlike a dark velvet map.
     // A tiny green ambient lift keeps deep folds readable on smartphones,
     // without making the forest sorceress glow.
     m.emissive.setHex(role==='forestMint'?0x15391b:0x07331c);
     m.emissiveIntensity=.18;
     m.userData.forestVisibleGreen=true;
     m.userData.forestColorRole=role;
   }
   decorateAll50MonsterSurface(m,{speciesId:profile.id,role,detail});
   enhanceMonsterHumanoidCostumeMaterial(m,{profile,role,detail});
   materials.set(role,m);ownedMats.push(m);
  }
  return materials.get(role);
 };
 const attach=(frame,geometry,role,name,
   position=[0,0,0],rotation=[0,0,0],{groom=false}={})=>{
  const mesh=new THREE.Mesh(geometry,mat(role));
  mesh.name='monster-costume-'+name;
  mesh.position.set(...position);mesh.rotation.set(...rotation);
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.monsterCosplay=true;
  // Facial ornaments are authored for -Z, whereas the canonical actor's
  // FRONT is +Z. Flip only costume coordinates; head-fitted hair stays in
  // exact source-skull coordinates so no wig/scalp misalignment can occur.
  alignCostumeToCanonicalFacing(mesh,{groom});
  if(name.startsWith('regal-')&&outfitFit.calibrated){
   mesh.scale.x*=outfitFit.widthScale;
   mesh.scale.z*=outfitFit.depthScale;
   mesh.userData.anatomicalWidthFit=outfitFit.widthScale;
  }
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
 let suppressedFacialHair=0;
 model.traverse(node=>{
  if(construct&&node.isMesh){
   // Keep bones and imported animation clips, not the donor's naked skin,
   // ordinary human face, opaque clothing, hair or eye geometry.
   concealedDonorMeshes.push({node,visible:node.visible});
   node.visible=false;
   node.userData.constructDonorConcealed=true;
   return;
  }
  if(fullBody&&!construct&&node.isMesh){
   concealedDonorMeshes.push({node,visible:node.visible});
   node.visible=false;
   node.userData.constructDonorConcealed=true;
   return;
  }
  // The seraph is explicitly beardless. Do not hide scalp hair, eyelashes,
  // eyebrows or the whole face; only named moustache/beard meshes.
  if(profile.noBeard===true&&/(?:^|[_\\s-])(?:beard|moustache|mustache|goatee|stubble|facialhair)(?:$|[_\\s-])/i.test(node.name||'')){
   node.visible=false;suppressedFacialHair++;
   return;
  }
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
 // attach a single continuous head-grown scalp and long, tapered hair:
 // source Quaternius hair is intentionally hidden by canonical actor loader.
 const groom=construct?null:fullBody?null:attachCanonicalCharacterGroom({
  THREE,model,frames:{...frames,head:frames.headGroom},
  headBone:joints.head,profile,detail,
  attach:(frame,g,role,name,p,r)=>
   attach(frame,g,role,name,p,r,{groom:true})
 });
 const costume=profile.costume;
 const gothic=hasGothicMonsterSculpt(costume);
 const demonic=hasDemonCosmetics(profile);
 const femaleSummon=isFemaleSummonCostume(profile);
 if(gothic&&!fullBody)addGothicMonsterSculpt({
   THREE,profile,detail,frames,attach,tube,torus
 });
 if(profile.id==='m042')addGargoyleMonsterAnatomy({
   profile,detail,frames,attach,tube
 });
 else if(fullBody)addConstructMonsterCostume({
   THREE,profile,detail,frames,attach,tube
 });
 if(demonic&&!fullBody)addDemonicFaceCosmetics({
   THREE,profile,detail,frames,attach,tube,
   wingTailOnly:fullBody
 });
 const dragonSkull=['dragonkin_female','dragonkin_male'].includes(profile.costume)?
  measureCanonicalScalp(model,joints.head,{groomFrame:frames.headGroom}):null;
 const nativeDragonCrown=dragonSkull&&profile.hair==='bald'?
  createDragonkinNativeScalpOverlay({
   model,headBone:joints.head,groomFrame:frames.headGroom,scalp:dragonSkull,detail
  }):null;
 if(femaleSummon)addFemaleSummonCostume({
   THREE,profile,detail,frames,attach,tube,
   skullFit:dragonSkull,nativeScalp:nativeDragonCrown,
   attachGroom:(frame,g,role,name,p,r)=>
    attach(frame,g,role,name,p,r,{groom:true})
 });
 // Subtract only native crown triangles hidden under a fitted wig or scale
 // cap. Keep the real eyes, forehead, ears, neck, joint motion and GLB.
 // Important: measure and build all hair/armour BEFORE modifying indices.
 const scalpCoverKind=['forest_spirit_female','seraph_female'].includes(
  profile.costume)||(['dragonkin_female','dragonkin_male'].includes(
  profile.costume)&&profile.hair!=='bald')
  ?'wig':profile.costume==='dragonkin_female'&&nativeDragonCrown
  ?'scales':null;
 const scalpCut=scalpCoverKind?cutFemaleSummonScalpUnderCover({
  model,headBone:joints.head,groomFrame:frames.headGroom,
  scalp:scalpCoverKind==='wig'?groom?.scalp:dragonSkull,
  kind:scalpCoverKind
 }):null;
 // Structural garment layers are essential: the canonical full-body donor
 // wears little clothing. A cape or set of wings is not an outfit.
 const royalOutfit=fullBody?null:wardrobeFor(profile);
 if(royalOutfit)addRegalHumanoidOutfit({
   profile,detail,frames,attach,tube
 });
 // Mummies and the five constructs already own species-specific torso
 // sculpting. Close all exposed donor legs without placing a second gown
 // over bandages, crystal or rock armour. Every plate follows the source rig.
 if(!royalOutfit&&profile.costume==='mummy'){
  const role=profile.costume==='mummy'?'bandage':'metal';
  for(let i=0;i<2;i++){
   attach(frames.legs[i],createRegalLimbGeometry({
    detail,kind:'trouser',length:.51,top:.188,bottom:.137
   }),role,'monster-leg-coverage-thigh-'+i);
   attach(frames.calves[i],createRegalLimbGeometry({
    detail,kind:'boot',length:.49,top:.148,bottom:.112
   }),role,'monster-leg-coverage-shin-'+i);
   attach(frames.feet[i]||frames.calves[i],
    createRegalFootGeometry({detail}),role,'monster-leg-coverage-foot-'+i,
    frames.feet[i]?[0,0,0]:[0,-.49,0]);
  }
 }
 const ceremonial=['vampire','lich','succubus','death_knight','dark_knight'];
 if(!gothic&&ceremonial.includes(costume)){
  torus(frames.chest,'cloth','fitted-collar',0,.21,-.005,.17,.095,.045);
  torus(frames.chest,'metal','waist-belt',0,-.33,0,.19,.13,.024);
  for(const side of [-1,1])
   tube(frames.chest,'metal','lapel-'+side,[
    [side*.13,.29,-.12],[side*.08,.05,-.16],[side*.19,-.21,-.14]
   ],.014);
 }
 if(!gothic&&!fullBody&&['death_knight','dark_knight','demon','gargoyle'].includes(costume)){
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
 if((!gothic&&!demonic&&!femaleSummon&&profile.horns)||costume==='tengu'){
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
  if(costume==='tengu'){
   // Keep the canonical face/skeleton; use REAL 3-layer feather geometry.
   const source=getTenguWingDonor(detail),wingPivots=[];
   for(const side of [-1,1]){
    const suffix=side<0?'L':'R',pivot=new THREE.Group();
    pivot.name='tengu-flight-wing-pivot-'+suffix;
    pivot.position.set(side*.22,.14,-.24);
    pivot.userData.tenguFlightWingSide=side;
    frames.chest.add(pivot);
    const geometry=(side<0?source.left:source.right).clone();
    geometry.scale(.64,.58,.89);
    geometry.computeBoundingBox();
    if((geometry.boundingBox.min.z+geometry.boundingBox.max.z)*.5>0)
     geometry.scale(1,1,-1);
    const pos=geometry.getAttribute('position'),old=geometry.getAttribute('color'),
     rgb=new Float32Array(pos.count*3);
    const dark=new THREE.Color(0x262b37),mid=new THREE.Color(0x586274),
     bright=new THREE.Color(0x8994a5);
    for(let i=0;i<pos.count;i++){
     const r=clamp(Math.abs(pos.getX(i))/2.1,0,1),
      shade=old?(old.getX(i)+old.getY(i)+old.getZ(i))/3:.7;
     const tone=dark.clone().lerp(mid,.26+.34*shade)
      .lerp(bright,Math.pow(r,1.7)*.46);
     rgb[i*3]=tone.r;rgb[i*3+1]=tone.g;rgb[i*3+2]=tone.b;
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
    geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({
     vertexColors:true,side:THREE.DoubleSide,roughness:.80,metalness:.015
    });
    const wing=new THREE.Mesh(geometry,material);
    wing.name='avian-guardian-three-layer-wing-m015-'+suffix;
    wing.userData.angelSource='seraph_guardian';
    wing.userData.angelFeatherLayers=3;
    wing.userData.angelFeathersPerSide=detail==='low'||detail==='medium'?18:82;
    wing.userData.avianCanonicalTenguWing=true;
    wing.castShadow=true;wing.receiveShadow=true;
    pivot.add(wing);wingPivots.push(pivot);
    ownedGeo.push(geometry);ownedMats.push(material);
   }
   model.userData.tenguWingPivots=wingPivots;
   model.userData.tenguLegBones=joints.legs;
   model.userData.tenguGuardianFeatherRig=true;
  }else{
  // Wing roots are rigidly anchored to the canonical upper torso;
  // skinned shoulders retain their original motion and proportions.
  for(const side of [-1,1]){
   // Mirrored by alignCostumeToCanonicalFacing: +Z authoring back becomes
   // -Z behind the +Z-facing actor, not over their chest.
   const pts=[[side*.15,.20,.22],[side*.43,.46,.43],
    [side*.95,.55,.67],[side*1.25,.31,.79]];
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
 }
 if(profile.mage){
  bands(frames.chest,'rune-hem',-.38,-.21,.23,.17,1.9,'accent');
 }
 const conceptFinish=fullBody?Object.freeze({id:profile.id,
  revision:profile.id==='m042'?GARGOYLE_SPECIES_REVISION:
   CONSTRUCT_FULL_SHELL_REVISION,
  skeletonAnchored:true,visualApproved:false}):
  applyHumanlikeConceptFinish({THREE,profile,detail,frames,attach,tube});
 if(fullBody)model.userData.mineralArticulator=createMineralLimbArticulator({
  model,frames,id:profile.id
 });
 model.userData.monsterThemeFamily=profile.id==='m015'?'avian':
  ['m031','m032','m033','m034','m035'].includes(profile.id)?'undead':
  ['m036','m037','m038','m039','m040'].includes(profile.id)?'golem':'fiend';
 model.userData.monsterThemeBones={
  head:joints.head,spine:joints.spine,arms:joints.arms
 };
 if(profile.id==='m042'){
  model.userData.gargoyleWingPivots=frames.chest.userData.gargoyleWingPivots;
  model.userData.gargoyleFlightLegBones=joints.legs.filter(Boolean);
  model.userData.gargoyleSwordPivot=frames.chest.userData.gargoyleSwordPivot;
  model.userData.gargoyleChestFrame=frames.chest;
 }
 model.userData.monsterCostume={
  id:profile.id,kind:costume,heroSource:profile.modelId,
  humanConceptFinish:conceptFinish,
  originalSkeleton:true,overlayMeshes:ownedGeo.length,
  gothicSculptEdition:gothic?'gothic-horror-2026-11':null,
  constructSculptEdition:fullBody?(profile.id==='m042'?GARGOYLE_SPECIES_REVISION:
    CONSTRUCT_FULL_SHELL_REVISION):null,
  gargoyleSculptEdition:profile.id==='m042'?GARGOYLE_SPECIES_REVISION:null,
  gargoyleWings:profile.id==='m042'?frames.chest.userData.gargoyleWingCount??0:0,
  gargoyleTalons:profile.id==='m042'?frames.chest.userData.gargoyleClawCount??0:0,
  gargoyleSword:profile.id==='m042'?frames.chest.userData.gargoyleSwordCount===4:false,
  gargoyleSwordClashAvoidance:profile.id==='m042',
  gargoyleToeRootsEmbedded:profile.id==='m042',
  gargoyleFlight:profile.id==='m042',
  gargoyleStoneTexture:profile.id==='m042'?!!gargoyleTexture:false,
  armourSourceHumanFaceHidden:fullBody&&concealedDonorMeshes.length>0,
  noHumanoidUnderwear:fullBody,
  anatomicalLimbFitting:fullBody?model.userData.mineralArticulator.revision:null,
  fullBodyShellParts:fullBody?frames.chest.userData.golemShellParts??0:0,
  constructDonorMeshesConcealed:concealedDonorMeshes.length,
  constructSkinExposed:construct?false:null,
  constructMineralTheme:mineral?.theme??null,
  constructShellParts:construct?frames.chest.userData.golemShellParts??0:0,
  skinColor:profile.skin,skinMaterialIsolation:true,
  noBeard:profile.noBeard===true,beardSourceMeshesSuppressed:suppressedFacialHair,
  skinTone:profile.skinTone??null,
  demonCosmeticsEdition:demonic&&profile.id!=='m042'?'horns-makeup-runes-v1':null,
  femaleSummonCostumeEdition:femaleSummon?
   (profile.costume==='dragonkin_male'?'male-dragon-sovereign-plate-wings-v1':
    profile.costume==='dragonkin_female'?
     (profile.hair==='bald'?'dragonkin-native-head-topology-v3':
      'approved-dragon-queen-plum-groom-v4'):
    profile.costume==='seraph_female'?'seraph-original-wing-flight-v2':
    'female-summon-v1'):null,
  dragonCraniumFitted:dragonSkull?!!dragonSkull.fitted:null,
  dragonCraniumSamples:dragonSkull?.samples??0,
  dragonCraniumNativeTopology:!!nativeDragonCrown,
  dragonNativeScalpTriangles:nativeDragonCrown?.userData.sourceTriangles??0,
  sourceCraniumWigCut:!!scalpCut,
  sourceCraniumCutMode:scalpCut?.kind??null,
  sourceCraniumRemovedTriangles:scalpCut?.removedTriangles??0,
  sourceCraniumPreservedTriangles:scalpCut?.preservedTriangles??0,
  sourceCraniumSourcePreserved:scalpCut?.sourcePreserved??true,
  crownCovered:!!groom?.crown,hairStrands:!!groom?.locks,
  headBoneLocalGroom:!!groom?.crown&&groom.crown.parent===frames.headGroom,
  hairSurfaceSamples:groom?.scalp.samples??0,
  hairScalpFitted:!!groom?.scalp.fitted,
  modelUprightGroom:!!frames.headGroom.userData.modelUprightGroom,
  fullBodyOutfit:royalOutfit?.style||null,
  fullBodySkirt:!!royalOutfit,
  fullLegCoverage:!!royalOutfit||profile.costume==='mummy'||fullBody,
  clothCoverageValidated:!!royalOutfit,
  shoulderYokeAttached:!!royalOutfit,neckCollarTapered:!!royalOutfit,
  shoulderFitCalibrated:outfitFit.calibrated,
  shoulderWidthScale:outfitFit.widthScale,
  realShoulderSpan:outfitFit.shoulderSpan??null,
  jointAnchored:true,independentHeroMaterials:true,
 };
 return ()=>{
  delete model.userData.mineralArticulator;
  delete model.userData.monsterThemeBones;
  delete model.userData.monsterThemeFamily;
  delete model.userData.gargoyleSwordPivot;
  delete model.userData.gargoyleChestFrame;
  delete model.userData.gargoyleFlightLegBones;
  delete model.userData.gargoyleWingPivots;
  for(const {node,visible} of concealedDonorMeshes){
   node.visible=visible;delete node.userData.constructDonorConcealed;
  }
  scalpCut?.dispose();
  for(const frame of [...Object.values(frames).filter(x=>x?.isGroup),
   ...frames.arms,...frames.forearms,...frames.legs,...frames.calves,
   ...frames.feet.filter(Boolean),...frames.hands.filter(Boolean)])
   frame.parent?.remove(frame);
  for(const geo of ownedGeo)geo.dispose();
  for(const texture of ownedTextures)texture.dispose();
  for(const material of ownedMats){
   detachMonsterPhotoMaterial(material);
   material.dispose();
  }
 };
}
export function createCosplayedHumanoidMonster(spec,{
 detail='high',genderVariant=null,profileOverride=null,withoutFallback=false,
 studioActorPackage=null
}={}){
 const profile=profileOverride||humanoidMonsterCostumeFor(spec,{genderVariant});
 if(!profile)throw Error('No humanoid cosplay mapping '+String(spec?.id));
 // v59 face studio is a preview, NOT a skinned production body. Audit any
 // future candidate while keeping the proven Superhero actor live until a
 // separate, tested studio actor loader has been shipped.
 const humanBaseMigration=planHumanoidCosplayBase(profile,{
  studioPackage:studioActorPackage
 });
 const root=new THREE.Group();root.name=spec.id+'-'+spec.name+'-cosplay';
 const isFlyingTengu=spec.id==='m015';
 const isFlyingGargoyle=spec.id==='m042';
 if(isFlyingGargoyle){
  root.userData.gargoyleFlightMode=true;
  root.userData.gargoyleFlightHeight=1.35;
 }
 if(isFlyingTengu){
  root.userData.avianFlightMode=true;
  root.userData.tenguFlightMode=true;
  root.userData.avianFlightHeight=1.42;
  root.userData.avianGameSourceRevision=AVIAN_REALISM_REVISION;
  root.userData.tenguCanonicalFacePreserved=true;
 }
 const fallback=withoutFallback?null:createMonsterModel(spec,{detail});
 if(fallback)root.add(fallback);
 const host=new THREE.Group();host.name='character-cosplay-host';root.add(host);
 host.userData.actorId='monster-'+spec.id;
 host.userData.canonicalCharacterTrial=true;
 host.userData.characterBOM={jobId:profile.equipment==='bow'?'archer':
   profile.equipment==='staff'||profile.role==='royal'?'mage':'swordsman'};
 host.userData.previewAction='idle';
 host.userData.humanBaseMigration=humanBaseMigration;
 root.userData.humanBaseMigration=humanBaseMigration;
 let disposed=false,ready=false,failed=false,rig=null,visual=null;
 let seraphWingPivots=[],combatMotion=null;
 let disposeCostume=null,activeAction='idle',lastTime=null,lastAction='idle';
 // A GLB may finish loading after a user switches species. The late visual
 // must not remain attached to an already disposed preview host.
 const releaseLateCharacterLoad=()=>{
  combatMotion?.dispose();combatMotion=null;
  disposeCostume?.();disposeCostume=null;
  host.userData.canonicalMotion?.mixer?.stopAllAction();
  host.userData.canonicalMotion?.jobController?.dispose?.();
  host.userData.footContactIK?.dispose?.();
  const lateVisual=visual||host.userData.canonicalVisualRoot||
   host.children.find(x=>x.userData?.sourceModelId);
  if(lateVisual?.parent)lateVisual.parent.remove(lateVisual);
  host.parent?.remove(host);
 };
 const state={root,source:'procedural-loading',profile,
  humanBaseMigration,
  start(action,time=0){
   if(root.userData.action!==action||root.userData.actionAt!==time){
    root.userData.action=action;root.userData.actionAt=time;
   }
   if(!ready&&fallback)startMonsterAction(fallback,action,time);
  },
  update(time){
   if(disposed)return;
   let requested=root.userData.action||'idle';
   let theme=resolveMonsterThemeAction(spec,requested);
   let action=theme?.base||requested;
   let elapsed=Math.max(0,time-(root.userData.actionAt??0));
   const duration=theme?.duration??TIME_LIMITS[action];
   if(Number.isFinite(duration)&&elapsed>duration){
    action='idle';requested='idle';theme=null;
    root.userData.action='idle';root.userData.actionAt=time;
    elapsed=0;
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
   // A cast is not a sword swing. Keep the native idle base and overlay
   // a per-instance casting gesture; ordinary attacks still use the GLB clip.
   const clip=(isFlyingTengu||isFlyingGargoyle)&&
    ['run','walk','leap'].includes(action)?'idle':
    action==='special'?'idle':(DEFAULT_MOTION[action]||'idle');
   const chosen=motion.actions[clip]?clip:'idle';
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
   combatMotion?.update(profile.id==='m042'&&action==='attack'?'idle':action,
    clamp(elapsed/(TIME_LIMITS[action]||1),0,1),time);
   // Source mesh is hidden for mineral/armoured creatures: fit shells
   // between each moving pair of joints AFTER the native animation mixer.
   if(isFlyingTengu)updateCanonicalTenguFlight(root,host,visual,action,time,elapsed);
   if(isFlyingGargoyle)updateCanonicalGargoyleFlight(root,host,visual,action,time,elapsed);
   if(theme)applyCanonicalMonsterThemeMotion(visual,{
    tech:theme,progress:Number.isFinite(duration)?
     clamp(elapsed/duration,0,1):0,time
   });
   if(visual?.userData?.monsterCostume)
    visual.userData.monsterCostume.activeThemeAction=theme?.id??null;
   // Fit all mineral shells AFTER flight has folded the real leg joints.
   visual?.userData.mineralArticulator?.update(action);
   if(profile.costume==='seraph_female'){
    for(const pivot of seraphWingPivots){
     const side=pivot.userData.seraphFlightWingSide,beat=Math.sin(time*4.1);
     pivot.rotation.z=side*(.14+.23*beat);
     pivot.rotation.x=side*(.065+.10*Math.cos(time*4.1));
    }
   }
   host.userData.previewAction=action;
   host.userData.syncFacialSkeleton?.();
   // Costume groups are parented directly to the SAME GLB bones and require
   // no per-frame position copies, retargeting or extra skeleton allocation.
  },
  dispose(){
   if(disposed)return;
   disposed=true;
   combatMotion?.dispose();combatMotion=null;
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
   if(disposed){releaseLateCharacterLoad();return {source:'cancelled'};}
   disposeCostume=buildMonsterCostume(THREE,visual,profile,detail);
   state.metadata=visual.userData.monsterCostume;
   combatMotion=createHumanoidMonsterCombatMotion(visual,profile);
   state.metadata.combatMotionLayer='native-clip-plus-procedural-charge-release-v1';
   seraphWingPivots=[];
   if(profile.costume==='seraph_female')visual.traverse(node=>{
    if(node.userData?.seraphFlightWingSide===-1||
       node.userData?.seraphFlightWingSide===1)seraphWingPivots.push(node);
   });
   if(disposed){releaseLateCharacterLoad();return {source:'cancelled'};}
   // Female summon forms have NO procedural bestiary fallback owned by
   // this adapter: their live battle InstancedMesh already stays visible
   // until canonical GLB is ready. Do not dereference a null fallback.
   if(fallback){
     fallback.parent?.remove(fallback);
     disposeMonsterSculpture(fallback);
   }
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
   combatMotion?.dispose();combatMotion=null;
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
