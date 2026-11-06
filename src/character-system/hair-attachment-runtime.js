// Hair is a reusable, head-bone-attached visual asset, not an opaque scalp
// helmet or a procedurally approximated wig. Each style has three game LODs.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {maskHairGeometry,createVisibleHeadwearWisps} from './hair-headwear-occlusion.js?v=4.4.56';

const loader=new GLTFLoader(),sources=new Map(),materials=new Map();
let fiberMap=null;
function scalpFiberMap(){
 if(fiberMap||typeof document==='undefined')return fiberMap;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
 const context=canvas.getContext('2d');if(!context)return null;
 context.fillStyle='#e8ddd0';context.fillRect(0,0,512,512);
 // Fine, directional roots instead of a single smooth plastic scalp shell.
 // Deterministic strokes keep screenshot-diff tests stable between builds.
 for(let i=0;i<3800;i++){
  const u=(i*0.6180339887498949)%1,v=(i*0.7548776662466927)%1;
  const x=u*512,y=v*512,len=16+(i%37),swing=Math.sin(i*.81)*3;
  context.beginPath();context.moveTo(x,y);context.quadraticCurveTo(x+swing*.5,y+len*.5,x+swing,y+len);
  context.lineWidth=i%7===0?1.3:.55;
  context.strokeStyle=i%4===0?'rgba(60,49,43,.29)':i%3===0?'rgba(255,250,237,.40)':'rgba(118,92,72,.18)';
  context.stroke();
 }
 fiberMap=new THREE.CanvasTexture(canvas);fiberMap.colorSpace=THREE.SRGBColorSpace;
 fiberMap.wrapS=THREE.RepeatWrapping;fiberMap.wrapT=THREE.RepeatWrapping;
 return fiberMap;
}
export const HAIR_STYLE_COUNTS=Object.freeze({male:14,female:12});
export const HAIR_COLORS=Object.freeze([0x35271f,0x664632,0x8b5e41,0x28262a,0x9b774b,0x57352d]);
const jobStyles=Object.freeze({
 job01:[3,2],job02:[6,11],job03:[9,4],job04:[4,8],
 job05:[2,9],job06:[5,1],job07:[11,5],job08:[14,7],
 job09:[10,3],job10:[8,10],strategist:[7,6]
});
function load(path){
 if(!sources.has(path))sources.set(path,loader.loadAsync(path).catch(error=>{sources.delete(path);throw error}));
 return sources.get(path);
}
function headBone(model){
 let head=null;model.traverse(node=>{if(node.isBone&&node.name.toLowerCase()==='head')head=node});
 if(!head)throw Error('髪の取付先 head 骨がありません');
 return head;
}

// Sample the *real* head vertices influenced by the head bone. Its local axes
// follow animation, allowing one fitting algorithm across sexes and body sizes.
export function measureHeadLocalBounds(model,head=headBone(model)){
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3(),point=new THREE.Vector3();
 let samples=0;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.skeleton||!mesh.geometry?.attributes?.position)return;
  const index=mesh.skeleton.bones.findIndex(b=>b.name.toLowerCase()==='head');
  if(index<0)return;
  const joints=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
  if(!joints||!weights)return;
  const count=mesh.geometry.attributes.position.count,stride=Math.max(1,Math.floor(count/18000));
  for(let i=0;i<count;i+=stride){
   let influence=0;
   for(let k=0;k<4;k++)if(joints.getComponent(i,k)===index)influence+=weights.getComponent(i,k);
   if(influence<.52)continue;
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
   head.worldToLocal(point);
   if(!Number.isFinite(point.x+point.y+point.z))continue;
   bounds.expandByPoint(point);samples++;
  }
 });
 if(samples<30||bounds.isEmpty()){
  bounds.min.set(-.103,-.10,-.100);
  bounds.max.set(.103,.125,.110);
 }
 return {bounds,samples,dimensions:bounds.getSize(new THREE.Vector3())};
}

function measuredForeheadDepth(model,bone,bounds){
 const values=[],point=new THREE.Vector3(),center=bounds.getCenter(new THREE.Vector3());
 const width=bounds.max.x-bounds.min.x,depth=bounds.max.z-bounds.min.z;
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!/eyebrow|brow/i.test(mesh.name))return;
  mesh.updateMatrixWorld(true);
  const count=mesh.geometry?.attributes?.position?.count||0;
  for(let i=0;i<count;i++){
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
   bone.worldToLocal(point);
   if(Math.abs(point.x-center.x)<=width*.32&&Number.isFinite(point.z))values.push(point.z);
  }
 });
 values.sort((a,b)=>a-b);
 // Use the real eyebrow/forehead skin plane. Nose-tip maxZ is 3-6 cm too
 // far forward, as the sideways motion-studio screenshot demonstrated.
 const fallback=bounds.max.z-depth*.26;
 return values.length>10?THREE.MathUtils.clamp(values[Math.floor(values.length*.55)],
   bounds.max.z-depth*.42,bounds.max.z-depth*.16):fallback;
}

// Trace the actual deformed skin triangles, then offset them a few millimetres
// outside the cranium. Ellipsoid wigs fail on asymmetric male/female heads and
// sometimes inherit a transparent hair-card texture, exposing bald islands.
function fittedScalpSurface(model,bone,headBounds){
 const candidates=[];
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.skeleton||!mesh.geometry?.index)return;
  const index=mesh.skeleton.bones.findIndex(b=>b.name.toLowerCase()==='head');
  if(index<0)return;
  const joints=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
  if(!joints||!weights)return;
  // The largest skinned mesh is the actual body; tiny eyebrow/eye meshes
  // cannot be mistaken for scalp geometry.
  candidates.push({mesh,index,joints,weights,vertices:mesh.geometry.attributes.position.count});
 });
 candidates.sort((a,b)=>b.vertices-a.vertices);
 const candidate=candidates[0];if(!candidate)return null;
 const {mesh,index,joints,weights,vertices}=candidate;
 const threshold=headBounds.max.y-(headBounds.max.y-headBounds.min.y)*.46;
 const center=headBounds.getCenter(new THREE.Vector3());
 const eligible=new Uint8Array(vertices),local=new Float32Array(vertices*3);
 const point=new THREE.Vector3(),radial=new THREE.Vector3();
 for(let i=0;i<vertices;i++){
  let weight=0;
  for(let k=0;k<4;k++)if(joints.getComponent(i,k)===index)weight+=weights.getComponent(i,k);
  if(weight<.56)continue;
  mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
  bone.worldToLocal(point);
  if(point.y<threshold)continue;
  radial.copy(point).sub(center).normalize().multiplyScalar(.0045);
  point.add(radial);
  local.set([point.x,point.y,point.z],i*3);eligible[i]=1;
 }
 const triangles=[],uv=[],indices=mesh.geometry.index.array;
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i],b=indices[i+1],c=indices[i+2];
  if(!eligible[a]||!eligible[b]||!eligible[c])continue;
  for(const v of [a,b,c]){
   const x=local[v*3],y=local[v*3+1],z=local[v*3+2];
   triangles.push(x,y,z);
   uv.push(.5+Math.atan2(x-center.x,z-center.z)/(Math.PI*2),
    Math.max(0,Math.min(1,(y-threshold)/Math.max(.01,headBounds.max.y-threshold))));
  }
 }
 if(triangles.length<90)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return geometry;
}

// A correct XYZ scalp mesh alone can still look bald: the previous smooth
// brown underlay was especially obvious through parted female hairstyles.
// Put actual thin, swept polygon fibers above the sampled anatomical scalp.
// These are preview-only, vertex-color batched into a single draw call, and
// deterministic so that visual regression screenshots remain comparable.
function fittedScalpFibers(surface,bounds,tint,quality='preview'){
 if(!surface)return null;
 const positions=surface.getAttribute('position'),points=[],colors=[];
 const center=bounds.getCenter(new THREE.Vector3()),base=new THREE.Color(tint);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const p=new THREE.Vector3(),normal=new THREE.Vector3(),direction=new THREE.Vector3();
 const widthAxis=new THREE.Vector3(),q=new THREE.Vector3(),tmp=new THREE.Vector3();
 for(let tri=0;tri<positions.count;tri+=3){
  a.fromBufferAttribute(positions,tri);
  b.fromBufferAttribute(positions,tri+1);
  c.fromBufferAttribute(positions,tri+2);
  normal.subVectors(b,a).cross(tmp.subVectors(c,a)).normalize();
  // The geometry can have both clockwise and counterclockwise source faces.
  p.copy(a).add(b).add(c).multiplyScalar(1/3);
  if(normal.dot(tmp.copy(p).sub(center))<0)normal.negate();
  // Crowd characters need the SAME anatomical scalp, with one real fiber
  // ribbon per triangle instead of the five used by the inspection studio.
  // This preserves the hairline at a fraction of the GPU triangle cost.
  for(let j=0;j<(quality==='battle'?1:5);j++){
   const u=((tri*17+j*37)%97+1)/100,v=((tri*31+j*19)%83+1)/100;
   const x=Math.min(.94,u*.73),y=Math.min(.94-x,v*(.95-x));
   p.copy(a).multiplyScalar(1-x-y).addScaledVector(b,x).addScaledVector(c,y);
   direction.set(p.x-center.x,0,p.z-center.z);
   if(direction.lengthSq()<.00001)direction.set(.5,0,-.5);
   direction.addScaledVector(normal,-direction.dot(normal)).normalize();
   if(direction.lengthSq()<.001){direction.set(0,0,-1);
    direction.addScaledVector(normal,-direction.dot(normal)).normalize()}
   widthAxis.crossVectors(normal,direction).normalize();
   const length=.015+(j%4)*.004,halfWidth=.00038+(j%3)*.00011;
   const origin=p.clone().addScaledVector(normal,.0018);
   q.copy(origin).addScaledVector(direction,length).addScaledVector(normal,.0008);
   const left=origin.clone().addScaledVector(widthAxis,-halfWidth);
   const right=origin.clone().addScaledVector(widthAxis,halfWidth);
   const farLeft=q.clone().addScaledVector(widthAxis,-halfWidth*.6);
   const farRight=q.clone().addScaledVector(widthAxis,halfWidth*.6);
   for(const vertex of [left,right,farLeft,right,farRight,farLeft]){
    points.push(vertex.x,vertex.y,vertex.z);
    const shade=.99+((tri*11+j*13)%9)*.093;
    const tone=base.clone().multiplyScalar(shade);
    colors.push(tone.r,tone.g,tone.b);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,
  side:THREE.DoubleSide,roughness:.8,metalness:0}));
}

function materialFor(source,color){
 const key=source.uuid+'/'+color;
 if(!materials.has(key)){
  const material=source.clone();
  material.color?.setHex(color);
  material.side=THREE.DoubleSide;
  material.roughness=.78;
  material.metalness=0;
  material.needsUpdate=true;
  materials.set(key,material);
 }
 return materials.get(key);
}
export function selectedHairStyle(job,sex,choice=null){
 const count=HAIR_STYLE_COUNTS[sex]||HAIR_STYLE_COUNTS.male;
 const number=choice==null?(jobStyles[job]?.[sex==='female'?1:0]||1):Number(choice);
 if(!Number.isInteger(number)||number<1||number>count)throw Error('髪型番号が不正: '+choice);
 return String(number).padStart(2,'0');
}

export async function attachCharacterHair({model,job,sex='male',style=null,color=null,quality='preview',helmet=false,headwear=null}){
 const id=selectedHairStyle(job,sex,style);
 const tint=color==null?HAIR_COLORS[Number(id)%HAIR_COLORS.length]:Number(color);
 const prefix=sex==='female'?'female':'male';
 const paths=[0,1,2].map(lod=>`./assets/characters/hair-fitted-v1/${prefix}_hair_${id}_lod${lod}.glb`);
 const resources=await Promise.all(paths.map(load));
 const bone=headBone(model),size=measureHeadLocalBounds(model,bone);
 const lod=new THREE.LOD(),assetBox=new THREE.Box3(),hairMeshes=[];
 resources.forEach((resource,index)=>{
  const scene=resource.scene.clone(true);
  scene.name=`hair-${prefix}-${id}-lod${index}`;
  scene.traverse(child=>{
   if(!child.isMesh)return;
   child.castShadow=true;child.receiveShadow=true;
   child.frustumCulled=false;
   const src=Array.isArray(child.material)?child.material:[child.material];
   const result=src.map(m=>materialFor(m,tint));
   child.material=Array.isArray(child.material)?result:result[0];
  });
  // Record each source transform BEFORE mounting the scene under the scaled
  // hairstyle LOD. The cover mask is evaluated in anatomical head XYZ rather
  // than in the arbitrary authoring coordinates of each downloaded GLB.
  scene.updateMatrixWorld(true);
  scene.traverse(child=>{if(child.isMesh)hairMeshes.push({mesh:child,
    original:child.geometry,sourceMatrix:child.matrixWorld.clone()})});
  if(index===0){scene.updateMatrixWorld(true);assetBox.setFromObject(scene)}
  // Keep the best real hairstyle through close and medium battle views.
  // Switching to low-detail hair at 2.4 m made soldiers look shaved.
  lod.addLevel(scene,index===0?0:index===1?4:12);
 });
 if(assetBox.isEmpty())throw Error('髪モデルにメッシュがありません: '+id);
 const sourceSize=assetBox.getSize(new THREE.Vector3());
 const bodySize=size.dimensions;
 // Independent scalp width and depth are crucial for long, asymmetric styles.
 // An average uniform scale left bare foreheads/crowns on several female jobs.
 const fitX=THREE.MathUtils.clamp(bodySize.x*1.075/Math.max(.03,sourceSize.x),.55,2.15);
 const fitZ=THREE.MathUtils.clamp(bodySize.z*1.07/Math.max(.03,sourceSize.z),.55,2.15);
 const fitY=THREE.MathUtils.clamp(Math.sqrt(fitX*fitZ),.55,2.15);
 const center=assetBox.getCenter(new THREE.Vector3()),headCenter=size.bounds.getCenter(new THREE.Vector3());
 lod.scale.set(fitX,fitY,fitZ);
 lod.position.set(headCenter.x-center.x*fitX,
  size.bounds.max.y+Math.max(.003,bodySize.y*.026)-assetBox.max.y*fitY,
  headCenter.z+bodySize.z*.035-center.z*fitZ);
 lod.name='changeable-hair-'+prefix+'-'+id;
 // A few source haircuts are only strands/locks, not a closed scalp cap.
 // A thin, anatomically fitted crown underlay fills their exposed bald patch;
 // it uses the same material and follows the same head bone at every LOD.
 const hairRoot=new THREE.Group();hairRoot.name=lod.name+'-with-scalp';
 const crownHeight=bodySize.y*.47;
 // Previous battle-only SphereGeometry was a smooth bald cap. A roughly
 // 500-triangle skin-conforming scalp is inexpensive and can be instanced.
 const scalpSurface=fittedScalpSurface(model,bone,size.bounds);
 const fiber=scalpFiberMap();
 const crown=new THREE.Mesh(scalpSurface||new THREE.SphereGeometry(1,28,12,0,Math.PI*2,0,Math.PI*.56),
  new THREE.MeshStandardMaterial({color:tint,map:fiber,bumpMap:fiber,bumpScale:.0015,
   roughness:.87,metalness:0,side:THREE.DoubleSide}));
 crown.name='fitted-scalp-underlay';
 if(!scalpSurface){
  crown.scale.set(bodySize.x*.53,crownHeight,bodySize.z*.53);
  crown.position.set(headCenter.x,size.bounds.max.y-crownHeight+.004,headCenter.z-bodySize.z*.015);
 }
 crown.castShadow=true;crown.receiveShadow=true;
 hairRoot.add(crown,lod);
 const scalpFibers=fittedScalpFibers(scalpSurface,size.bounds,tint,quality);
 if(scalpFibers){scalpFibers.name='anatomical-root-fibers';hairRoot.add(scalpFibers)}
 // Preserve the real, fiber-textured scalp in the exposed part of a hood's
 // face opening. Previously we hid the entire crown mesh whenever headwear
 // was enabled; the dark, natural hairline disappeared and the forehead
 // looked shaved even though a few isolated hair cards survived.
 const crownGeometry=crown.geometry,scalpFibersGeometry=scalpFibers?.geometry;
 crown.updateMatrix();
 const crownMatrix=crown.matrix.clone();
 const fiberMatrix=new THREE.Matrix4();
 const foreheadZ=measuredForeheadDepth(model,bone,size.bounds);
 const hoodWisps=createVisibleHeadwearWisps(size.bounds,tint,'hood',foreheadZ);
 const helmetWisps=createVisibleHeadwearWisps(size.bounds,tint,'helmet',foreheadZ);
 hoodWisps.visible=false;helmetWisps.visible=false;
 hairRoot.add(hoodWisps,helmetWisps);
 hairRoot.visible=true;
 hairRoot.userData={equipmentClass:'hair',style:id,sex,source:'Vincent Freelance CC BY 4.0',
  scalpUnderlay:true,scalpMethod:scalpSurface?'skinned-head-surface':'lightweight-crown',
  scalpTriangles:scalpSurface?scalpSurface.attributes.position.count/3:0,
  rootFiberTriangles:scalpFibers?scalpFibers.geometry.attributes.position.count/3:0,
  fittingScale:[fitX,fitY,fitZ],headSamples:size.samples,headWidth:bodySize.x,headDepth:bodySize.z,
  foreheadHairDepth:foreheadZ,
  headwearMode:'none',headwearSourceTriangles:0,headwearKeptTriangles:0};
 const fit={position:lod.position.clone(),scale:lod.scale.clone()};
 let selectedCoverage=null;
 function setHeadwear(value){
  const next=value==='hood'?'hood':value==='helmet'?'helmet':null;
  if(selectedCoverage===next)return;
  selectedCoverage=next;
  let sourceTriangles=0,keptTriangles=0;
  for(const item of hairMeshes){
    if(!next){item.mesh.geometry=item.original;continue}
    const clipped=maskHairGeometry(item.original,item.sourceMatrix,fit,size.bounds,next,foreheadZ);
    item.mesh.geometry=clipped.geometry;
    sourceTriangles+=clipped.sourceTriangles;keptTriangles+=clipped.keptTriangles;
  }
  // Mask only the portions hidden BY the headpiece, instead of turning off
  // all anatomical root fibers. This keeps a natural hairline under the
  // cloth hood and leaves the upper scalp occluded by metal helmets.
  if(next){
    const cut=maskHairGeometry(crownGeometry,crownMatrix,{
      position:new THREE.Vector3(),scale:new THREE.Vector3(1,1,1)},size.bounds,next,foreheadZ);
    crown.geometry=cut.geometry;crown.visible=cut.keptTriangles>0;
    if(scalpFibers){
      const fibers=maskHairGeometry(scalpFibersGeometry,fiberMatrix,{
        position:new THREE.Vector3(),scale:new THREE.Vector3(1,1,1)},size.bounds,next,foreheadZ);
      scalpFibers.geometry=fibers.geometry;scalpFibers.visible=fibers.keptTriangles>0;
    }
  }else{
    crown.geometry=crownGeometry;crown.visible=true;
    if(scalpFibers){scalpFibers.geometry=scalpFibersGeometry;scalpFibers.visible=true}
  }
  hoodWisps.visible=next==='hood';helmetWisps.visible=next==='helmet';
  hairRoot.userData.headwearMode=next||'none';
  hairRoot.userData.headwearSourceTriangles=sourceTriangles;
  hairRoot.userData.headwearKeptTriangles=keptTriangles;
 }
 setHeadwear(headwear||(helmet?'helmet':null));
 bone.add(hairRoot);
 return {object:hairRoot,style:id,sex,color:tint,diagnostics:hairRoot.userData,
  setVisible(value){hairRoot.visible=Boolean(value)},
  setHeadwear,
  dispose(){bone.remove(hairRoot);crownGeometry.dispose();crown.material.dispose();
   scalpFibersGeometry?.dispose();scalpFibers?.material.dispose();
   for(const wisps of [hoodWisps,helmetWisps]){wisps.geometry.dispose();wisps.material.dispose()}}};
}
