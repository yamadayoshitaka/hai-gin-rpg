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
import {bendSourceTunicSleeves} from './master-swordsman-fitted-shoulders.js';
import {buildHeadConformingScalp} from './master-swordsman-scalp-shell.js';

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

/**
 * Preview-specific cover mask. Selectively removes donor-skin triangles
 * underneath real cloth volumes (tunic/pants/boots). The imported GLB is never
 * modified: every displayed geometry is a clone. This is a coarse first pass,
 * NOT an artist-approved garment-surface or limb intersection proof.
 */
export function maskBodyUnderSourceGarment(bodyRoot,dressParts,{margin=.028}={}){
 if(!bodyRoot||!dressParts)throw Error('Both real body and source dress are required');
 const boxes=['tunic','pants','boots'].map(n=>dressParts.get(n)).filter(Boolean)
  .map(mesh=>new THREE.Box3().setFromObject(mesh).expandByVector(new THREE.Vector3(margin,.018,margin+.024)));
 if(boxes.length!==3)throw Error('Cannot build coverage without real source tunic, pants and boots');
 bodyRoot.updateWorldMatrix(true,true);
 const bodyBox=new THREE.Box3().setFromObject(bodyRoot);
 const bodyHeight=bodyBox.max.y-bodyBox.min.y;
 const midX=(bodyBox.min.x+bodyBox.max.x)*.5;
 let total=0,removed=0,remaining=0,modifiedMeshes=0;
 const p=new THREE.Vector3();
 const centroid=new THREE.Vector3();
 bodyRoot.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
  const original=mesh.geometry;
  const positions=original.getAttribute('position');
  const index=original.getIndex();
  const count=index?index.count:positions.count;
  if(count%3!==0)throw Error('Triangle mesh source required for garment coverage');
  // Missing or single-vertex source geometry should never be optimized away.
  if(count<3)return;
  const kept=[],get=i=>index?index.getX(i):i;
  const bone=new THREE.Vector3();
  for(let i=0;i<count;i+=3){
   centroid.set(0,0,0);
   for(let t=0;t<3;t++){
    const j=get(i+t);
    p.fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld);
    centroid.add(p);
   }
   centroid.multiplyScalar(1/3);
   const t=(centroid.y-bodyBox.min.y)/bodyHeight;
   const absX=Math.abs(centroid.x-midX);
   // Keep genuine exposed arms, wrists and hands. The Viking tunic bounding
   // box extends beyond shoulder sleeves; blindly masking the whole bbox
   // produced handless black tubes and was a false-positive coverage pass.
   const centralTorso=t>=.43&&t<=.82&&absX<.275;
   const centralLegs=t<.50&&absX<.245;
   const hidden=(centralTorso||centralLegs)&&boxes.some(b=>b.containsPoint(centroid));
   total++;
   if(hidden){removed++;continue;}
   remaining++;
   kept.push(get(i),get(i+1),get(i+2));
  }
  if(kept.length!==count){
   const preview=original.clone();
   preview.setIndex(kept);
   preview.computeBoundingSphere();
   mesh.geometry=preview;
   modifiedMeshes++;
  }
 });
 if(total<300||removed<200||remaining<100)
  throw Error('Non-destructive outfit coverage had implausible triangle counts '+JSON.stringify({total,removed,remaining}));
 return Object.freeze({total,removed,remaining,modifiedMeshes,sourceWasNotEdited:true,coverage:'coarse-preview-only'});
}

export function fitCCBYHairToHead(asset,actorHead,{density='source-lod0'}={}){
 if(!asset||!actorHead)throw Error('Actual head and separately credited hairstyle required');
 asset.updateWorldMatrix(true,true);actorHead.updateWorldMatrix(true,true);
 const original=new THREE.Box3().setFromObject(asset);
 const b=new THREE.Box3().setFromObject(actorHead);
 const src=original.getSize(new THREE.Vector3());
 const size=b.getSize(new THREE.Vector3());
 if(src.x<=0||src.y<=0||src.z<=0||size.y<=0)throw Error('Empty hair/head mesh');
 const fitted=asset.clone(true);
 // The old 1.07x width and high crown created a hovering bowl-cut wig.
 // Shrink laterally and seat it on the actual head top, overlapping scalp.
 const scale=new THREE.Vector3(size.x*.91/src.x,
   size.y*.44/src.y,size.z*.82/src.z);
 fitted.scale.multiply(scale);
 fitted.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(fitted);
 const bc=b.getCenter(new THREE.Vector3()),hc=box.getCenter(new THREE.Vector3());
 // A full scalp crown must extend from the hairline to the top of the head.
 fitted.position.add(new THREE.Vector3(bc.x-hc.x,b.max.y-.035-box.max.y,
   bc.z-hc.z-size.z*.065));
 fitted.name='LICENSE_CC_BY_4_HIGH_DENSITY_FITTED_HAIR';
 // Some public collection hairstyles contain only side hair and expose a
 // bald scalp. Add a separately identified procedural scalp layer, preserving
 // the ORIGINAL licensed strand meshes untouched. The layer is not claimed
 // to have come from the original asset.
 // Reuse the real high-resolution Blender head triangles to cover crown
 // and occiput without generating a floating sphere or straight wig boundary.
 const {scalp,report:scalpReport}=buildHeadConformingScalp(actorHead);
 const hairGroup=new THREE.Group();hairGroup.name='CC_BY_HAIR_AND_REAL_HEAD_SCALP';
 hairGroup.add(fitted,scalp);
 // The Sketchfab hair source often defaults to a bleached preview material.
 // Retain source alpha and real cutout cards but give the swordsman a natural
 // dark chestnut tint, while preserving the original glTF/material assets.
 fitted.traverse(o=>{
  if(!o.isMesh)return;
  const apply=original=>{
   if(!original?.isMaterial)return original;
   const mat=original.clone();
   if(mat.color)mat.color.setHex(0x43352c);
   if('roughness' in mat)mat.roughness=.78;
   if('metalness' in mat)mat.metalness=0;
   mat.side=THREE.DoubleSide;
   mat.needsUpdate=true;
   return mat;
  };
  o.material=Array.isArray(o.material)?o.material.map(apply):apply(o.material);
  o.castShadow=true;
 });
 let vertices=0,materials=0;
 fitted.traverse(mesh=>{if(mesh.isMesh){
  vertices+=mesh.geometry?.getAttribute('position')?.count||0;
  materials+=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(Boolean).length;
 }});
 if(vertices<500)throw Error('Licensed hairstyle has no meaningful 3D geometry');
 return {hair:hairGroup,report:Object.freeze({vertices,materials,density,
  headConformingScalp:scalpReport,originalHairMeshesPreserved:true,sourceAttribution:
  'Vincent Freelance CC BY 4.0; see assets/characters/hair-fitted-v1/ATTRIBUTION.md',
  actual3d:true,headMeshFittedApproximate:true,helmetIntersectionApproved:false})};
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
 const bodySkinMaterials=[];
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
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(!/iris|sclera/i.test(o.name))bodySkinMaterials.push(...mats.filter(Boolean));
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
 // Adapt exported cloth sleeve source geometry from its horizontal T pose
 // to the lower arm angle of the actual Blender Studio body.
 const sleeveFit=bendSourceTunicSleeves(parts.get('tunic'),donorBody);
 actor.updateMatrixWorld(true);
 const coverage=maskBodyUnderSourceGarment(donorBody,parts);
 // Original brows/beard/hair may show through the model face; expose each
 // visibility toggle. They are NOT assumed to be anatomically fitted.
 for(const p of ['moustache','beard'])parts.get(p)&&(parts.get(p).visible=false);
 // The source high-detail face head materials have no photographed skin map:
 // physical finish is preview-only, never falsely labelled photo skin.
 const ownedMaterials=[],headSkinMaterials=[],nativeIrisMaterials=[],overlayIrisMaterials=[];
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
   if(/iris/i.test(o.name))nativeIrisMaterials.push(c);
   else if(!/sclera/i.test(o.name))headSkinMaterials.push(c);
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
 const lids=[],irisOverlays=[],actualScleraNames=[],allEyeSourceNames=[];
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
  // Native iris normals/face overlap caused a white-eye screenshot. A real
  // visible pupil/iris is layered onto the actual sclera bounds, rather than
  // swapping the whole eye for a flat skin texture. It remains a preview.
  const irisRadius=THREE.MathUtils.clamp(Math.min(size.x,size.y)*.31,.008,.020);
  const irisGroup=new THREE.Group();
  irisGroup.name='VisibleRealEyeIris_'+side;
  irisGroup.position.set(mid.x,mid.y,box.max.z+.0028);
  const rimMat=new THREE.MeshPhysicalMaterial({color:0x243b42,roughness:.32,metalness:0,
   side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  const tintMat=new THREE.MeshPhysicalMaterial({color:0x517996,roughness:.3,metalness:0,
   side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3});
  const pupilMat=new THREE.MeshPhysicalMaterial({color:0x11141b,roughness:.12,metalness:0,
   side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4});
  const shineMat=new THREE.MeshBasicMaterial({color:0xfafaff,side:THREE.DoubleSide});
  const addEye=(name,radius,depth,material,x=0,y=0)=>{
   const mesh=new THREE.Mesh(new THREE.CircleGeometry(radius,36),material);
   mesh.name=name;mesh.position.set(x,y,depth);irisGroup.add(mesh);return mesh;
  };
  addEye('IRIS_LIMBAL_RING',irisRadius,0,rimMat);
  addEye('IRIS_COLORED',irisRadius*.86,.0008,tintMat);
  addEye('IRIS_TRUE_BLACK_PUPIL',irisRadius*.40,.0018,pupilMat);
  addEye('CORNEAL_CATCHLIGHT',irisRadius*.16,.0024,shineMat,-irisRadius*.23,irisRadius*.32);
  irisGroup.position.sub(fit.headShift);
  detailedHead.add(irisGroup);
  irisOverlays.push(irisGroup);
  overlayIrisMaterials.push(tintMat);
  ownedMaterials.push(rimMat,tintMat,pupilMat,shineMat);
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
  visibleIrisMeshes:irisOverlays.length,realPupilMeshes:irisOverlays.length,
  heightMeters:round(fit.bodyHeight),neckCutMeters:round(fit.neckY),
  outfitWidthRatio:round(fit.outfitWidthRatio),
  outfitDepthRatio:round(fit.outfitDepthRatio),
  sourceSleeveVerticesBent:sleeveFit.movedSourceVertices,
  sourceSleeveUVPreserved:sleeveFit.sourceTrianglesUnchanged,
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
 function setAppearance(profile){
  if(!profile||!/^#[0-9a-f]{6}$/i.test(profile.skin||'')||
      !/^#[0-9a-f]{6}$/i.test(profile.iris||''))
   throw Error('Skin and iris colors must be valid six-digit hexadecimal values');
  const skin=new THREE.Color(profile.skin);
  const iris=new THREE.Color(profile.iris);
  for(const mat of [...headSkinMaterials,...bodySkinMaterials]){
   if(mat.color)mat.color.copy(skin);
   if('roughness' in mat)mat.roughness=profile.skinRoughness||.59;
   mat.needsUpdate=true;
  }
  for(const mat of [...nativeIrisMaterials,...overlayIrisMaterials]){
   if(mat.color)mat.color.copy(iris);
   mat.needsUpdate=true;
  }
  for(const key of HERO_FACE_MORPHS)
   if(profile.face&&profile.face[key]!==undefined)setMorph(key,profile.face[key]);
  // Shape the ACTUAL face mesh, not merely the accompanying preview portrait.
  // Target of .93..1.02 makes youthful candidates subtly narrower at the jaw.
  const faceWidth=THREE.MathUtils.clamp(Number(profile.faceWidth)||1,.90,1.04);
  detailedHead.scale.x=faceWidth;
  const eyeScale=THREE.MathUtils.clamp(Number(profile.eyeSize)||1,.92,1.24);
  for(const irisGroup of irisOverlays)irisGroup.scale.set(eyeScale,eyeScale,1);
  return {skin:profile.skin,iris:profile.iris,faceWidth,eyeScale,
   real3dMorphs:7,visiblePupils:irisOverlays.length};
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
  fitted:fit,metrics,rendererMaterials,setBlink,setMorph,setPart,getPart,preset,setAppearance,
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
