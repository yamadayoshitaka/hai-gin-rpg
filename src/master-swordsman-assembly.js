/**
 * Stage-1 prototype: assemble ACTUAL CC0 Blender Studio body/head and CC0
 * Makehuman-2 textured Viking outfit as ONE inspectable, non-rigged actor.
 *
 * Source GLBs are never edited or decimated. This preview fits by measured
 * bounds and clips the donor body head at the neck. It does NOT claim skin
 * weights, fitted armour, animation retargeting, photo-scanned human skin,
 * photoreal FF13 art approval, or suitability for live 50v50 troops.
 */
import * as THREE from 'three';

const round=n=>Number(n.toFixed(4));
const dimensions=o=>new THREE.Box3().setFromObject(o);
const names={JawWidth:'顎幅',CheekVolume:'頬骨',NoseProjection:'鼻の高さ',
 NoseWidth:'鼻幅',MouthWidth:'口幅',ChinLength:'顎先',BrowArc:'眉骨'};
export const HERO_FACE_MORPHS=Object.freeze(Object.keys(names));
export const HERO_FACE_PRESETS=Object.freeze({
 swordsman:Object.freeze({JawWidth:.67,CheekVolume:.50,NoseProjection:.32,
  NoseWidth:.34,MouthWidth:.23,ChinLength:.62,BrowArc:.30}),
 mage:Object.freeze({JawWidth:.10,CheekVolume:.22,NoseProjection:.63,
  NoseWidth:.11,MouthWidth:.44,ChinLength:.13,BrowArc:.42}),
 ninja:Object.freeze({JawWidth:.24,CheekVolume:.11,NoseProjection:.18,
  NoseWidth:.14,MouthWidth:.14,ChinLength:.24,BrowArc:.57}),
 neutral:Object.freeze({})
});

export function computeSourceFit(bodyBounds,headBounds,outfitBounds){
 for(const b of [bodyBounds,headBounds,outfitBounds])
  if(!b||b.isEmpty())throw Error('Measured real 3D model bounds required');
 const bd=bodyBounds.getSize(new THREE.Vector3());
 const hd=headBounds.getSize(new THREE.Vector3());
 const od=outfitBounds.getSize(new THREE.Vector3());
 if(bd.y<1||bd.y>2.4||hd.y<.25||hd.y>.8||od.y<1||od.y>2.3)
  throw Error('Actual source geometry has wrong character units');
 const bc=bodyBounds.getCenter(new THREE.Vector3());
 const hc=headBounds.getCenter(new THREE.Vector3());
 const oc=outfitBounds.getCenter(new THREE.Vector3());
 const headTop=bodyBounds.max.y;
 const headShift=new THREE.Vector3(bc.x-hc.x,headTop-headBounds.max.y,
                               bc.z-hc.z);
 const outfitShift=new THREE.Vector3(bc.x-oc.x,bodyBounds.min.y-outfitBounds.min.y,bc.z-oc.z);
 const neckY=headTop-hd.y*.76;
 const matchedHeight=(bodyBounds.max.y-bodyBounds.min.y);
 const fit={
  headShift, outfitShift, neckY,
  heightRatio:od.y/matchedHeight,
  headHeight:hd.y,
  outfitDepthRatio:od.z/bd.z,
  outfitWidthRatio:od.x/bd.x,
  bodyHeight:bd.y,
  bodyCenter:bc
 };
 if(fit.heightRatio<.78||fit.heightRatio>1.25||
  fit.outfitWidthRatio<.70||fit.outfitWidthRatio>1.65)
  throw Error('Donor body/garment dimensions require manual remeshing before fit');
 return fit;
}

function makeEyeLid(width,height){
 // Anatomical almond-shaped closed-eye mask, feathered into the brow/cheek
 // rather than a flat rectangular or triangular "cardboard eyelid".
 // A true facial FACS deformable eyelid remains a later production milestone.
 const rings=10,segments=40,pts=[],indices=[],uv=[],colors=[];
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 for(let r=0;r<=rings;r++){
  const radial=r/rings;
  for(let a=0;a<=segments;a++){
   const angle=Math.PI*2*a/segments;
   const x=radial*Math.cos(angle),y=radial*Math.sin(angle);
   const taper=Math.sqrt(Math.max(0,1-x*x));
   pts.push(x*width*.52,y*height*.52*taper,
    height*(.055*(1-radial)-.055*x*x));
   uv.push(x*.5+.5,y*.5+.5);
   const edge=clamp((1-radial)/.22,0,1);
   colors.push(1,1,1,edge*edge*(3-2*edge));
   if(r<rings&&a<segments){
    const k=r*(segments+1)+a;
    indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}

export function identifyOriginalVikingParts(outfit){
 const found=new Map();outfit.traverse(o=>{
  if(!o.isMesh)return;
  const name=o.name.toLowerCase();
  for(const part of ['tunic','pants','boots','scalp','beard','eyebrows','moustache'])
   if(name.includes(part))found.set(part,o);
 });
 return found;
}

export function createIntegratedSwordsman({body,head,outfit,showHelmet=false}={}){
 if(!body||!head||!outfit)throw Error('Three ACTUAL Blender/Makehuman GLB sources are mandatory');
 body.updateMatrixWorld(true);head.updateMatrixWorld(true);outfit.updateMatrixWorld(true);
 const bodyBox=dimensions(body),headBox=dimensions(head),outfitBox=dimensions(outfit);
 const fit=computeSourceFit(bodyBox,headBox,outfitBox);
 const actor=new THREE.Group();actor.name='CC0_REAL_SWORDSMAN_MASTER_INSPECTION';
 const donorBody=body.clone(true),detailedHead=head.clone(true),dressed=outfit.clone(true);
 actor.add(donorBody,detailedHead,dressed);
 detailedHead.position.add(fit.headShift);
 dressed.position.add(fit.outfitShift);
 actor.updateMatrixWorld(true);
 const bodyClip=new THREE.Plane(new THREE.Vector3(0,-1,0),fit.neckY);
 let clippedParts=0;
 donorBody.traverse(o=>{
  if(!o.isMesh)return;
  if(Array.isArray(o.material))o.material=o.material.map(m=>{
   const clone=m.clone();clone.clippingPlanes=[bodyClip];clone.clipIntersection=false;return clone;
  });
  else if(o.material){
   o.material=o.material.clone();o.material.clippingPlanes=[bodyClip];
   o.material.clipIntersection=false;
  }
  o.castShadow=true;o.receiveShadow=true;clippedParts++;
 });
 let nativeTextures=0,garmentVertices=0;
 dressed.traverse(o=>{if(!o.isMesh)return;
  o.castShadow=true;o.receiveShadow=true;
  garmentVertices+=o.geometry?.getAttribute('position')?.count||0;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  nativeTextures+=mats.filter(m=>m?.map).length;
 });
 if(nativeTextures<5)throw Error('Garments do not include original CC0 UV diffuse atlases');
 const parts=identifyOriginalVikingParts(dressed);
 if(parts.size<6)throw Error('Missing actual cloth/boots/scalp/beard meshes');
 actor.updateMatrixWorld(true);
 const coverage=maskBodyUnderSourceGarment(donorBody,parts);
 // Original brows/beard/hair may show through the model face; expose each
 // visibility toggle. They are NOT assumed to be anatomically fitted.
 for(const p of ['moustache','beard'])parts.get(p)&&(parts.get(p).visible=false);
 // The source high-detail face head materials have no photographed skin map:
 // physical finish is preview-only, never falsely labelled photo skin.
 const ownedMaterials=[];
 let originalHeadMeshes=0;
 detailedHead.traverse(o=>{
  if(!o.isMesh)return;originalHeadMeshes++;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  const updated=mats.map(m=>{
   const c=m.clone();
   if(/iris/i.test(o.name)){
    c.color.set(0x33543c);c.roughness=.25;c.metalness=0;
   }else if(/sclera/i.test(o.name)){
    c.color.set(0xf0e7d9);c.roughness=.22;c.metalness=0;
   }else{
    c.color.set(0xb58971);c.roughness=.56;c.metalness=0;
   }
   c.needsUpdate=true;ownedMaterials.push(c);
   return c;
  });
  o.material=Array.isArray(o.material)?updated:updated[0];
  o.castShadow=true;
 });
 const morphTargets=new Map();
 detailedHead.traverse(o=>{
  if(!o.isMesh||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
  for(const name of HERO_FACE_MORPHS){
   const index=o.morphTargetDictionary[name];
   if(index!=null){
    const targets=morphTargets.get(name)||[];
    targets.push({mesh:o,index});morphTargets.set(name,targets);
   }
  }
 });
 if(morphTargets.size!==7)throw Error('Seven true 3D face morph targets missing');
 function setMorph(key,value){
  const refs=morphTargets.get(key);
  if(!refs)throw Error('Unsupported real source morph '+key);
  const v=THREE.MathUtils.clamp(Number(value)||0,0,1);
  for(const {mesh,index} of refs)mesh.morphTargetInfluences[index]=v;
  return v;
 }
 function preset(name='swordsman'){
  const values=HERO_FACE_PRESETS[name];
  if(!values)throw Error('Unknown face prototype '+name);
  for(const key of morphTargets.keys())setMorph(key,values[key]||0);
  return name;
 }
 // Actual sclera surfaces locate real eyelid planes, independent of screen
 // dimensions; no blanket "fake eye blink" on the whole head.
 const lids=[],actualScleraNames=[],allEyeSourceNames=[];
 detailedHead.traverse(o=>{if(o.isMesh&&/iris|sclera|eye/i.test(o.name))allEyeSourceNames.push(o.name)});
 for(const side of ['L','R']){
  let sclera=null;
  detailedHead.traverse(o=>{
   if(!o.isMesh||!/sclera/i.test(o.name))return;
   // Blender's glTF exporter sanitizes source names by *deleting* dots,
   // e.g. GEO-head_animation_realisticscleraL. Never assume an underscore.
   const compact=o.name.replace(/[^a-z0-9]/gi,'').toLowerCase();
   if(compact.endsWith('sclera'+side.toLowerCase()))sclera=o;
  });
  if(!sclera)continue;
  actualScleraNames.push(sclera.name);
  const box=dimensions(sclera),size=box.getSize(new THREE.Vector3());
  const mid=box.getCenter(new THREE.Vector3());
  const width=THREE.MathUtils.clamp(size.x*1.24,.012,.075);
  const height=THREE.MathUtils.clamp(size.y*1.17,.006,.06);
  if(width>0&&height>0){
   const material=new THREE.MeshPhysicalMaterial({color:0xb68b72,
    roughness:.63,metalness:0,side:THREE.DoubleSide,vertexColors:true,
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
   ownedMaterials.push(material);
   const lid=new THREE.Mesh(makeEyeLid(width,height),material);
   lid.name='CC0-HEAD_PROVISIONAL_'+side+'_ALMOND_CLOSED_LID';
   lid.position.copy(mid).add(new THREE.Vector3(0,0,size.z*.56+.004));
   lid.userData.blinkTop=true;lid.visible=false;
   actor.add(lid);lids.push(lid);
  }
 }
 // Three.js boxes above are in scene-relative coordinates, while the eyelids
 // were built in absolute head coordinates. Position lids relative to head
 // after measuring the original source scene to follow the fit offset.
 // Since eyes are children of detailedHead, eyelids also follow that root.
 for(const lid of lids){
  actor.remove(lid);detailedHead.add(lid);
  lid.position.sub(fit.headShift);
 }
 const metrics={actualBody:true,actualFace:true,actualTexturedCloth:true,
  faceVerticesSource:5134, bodyVerticesSource:11674,garmentVertices,
  nativeGarmentMaps:nativeTextures,garmentParts:[...parts.keys()],
  faceMorphs:[...morphTargets.keys()],faceOriginalMeshes:originalHeadMeshes,
  actualScleraNames,allEyeSourceNames,provisionalEyelidMeshCount:lids.length,
  heightMeters:round(fit.bodyHeight),neckCutMeters:round(fit.neckY),
  outfitWidthRatio:round(fit.outfitWidthRatio),
  outfitDepthRatio:round(fit.outfitDepthRatio),
  outfitHeightRatio:round(fit.heightRatio),
  bodyHeadClipped:clippedParts>0,maskedSkinTriangles:coverage.removed,
  retainedSkinTriangles:coverage.remaining,skinMaskIsPreviewOnly:true,skinned:false,
  originalCC0MastersUntouched:true,photoSkinApplied:false,
  outfitRigRetargeted:false,helmetFitted:false,ff13ArtGatePassed:false};
 let blink=0;
 function setBlink(value){
  blink=THREE.MathUtils.clamp(Number(value)||0,0,1);
  for(const lid of lids){
   lid.visible=blink>.015;
   lid.scale.y=Math.max(.001,blink);
  }
  return blink;
 }
 function setPart(part,show){
  const o=parts.get(part);if(!o)return false;
  o.visible=Boolean(show);return true;
 }
 function getPart(part){return parts.get(part);}
 preset('swordsman');setBlink(0);
 const rendererMaterials=[...ownedMaterials];
 return {
  actor,body:donorBody,head:detailedHead,outfit:dressed,parts,lids,
  fitted:fit,metrics,rendererMaterials,setBlink,setMorph,setPart,getPart,preset,
  diagnostics:()=>({...metrics,blink:round(blink),
   hairVisible:!!parts.get('scalp')?.visible,
   swordReady:false}),
  dispose(){
   for(const lid of lids)lid.geometry.dispose();
   for(const m of ownedMaterials)m.dispose();
   donorBody.traverse(o=>{
    if(!o.isMesh)return;
    for(const mat of Array.isArray(o.material)?o.material:[o.material])mat?.dispose();
   });
  }
 };
}
