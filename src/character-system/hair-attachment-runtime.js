// Hair is a reusable, head-bone-attached visual asset, not an opaque scalp
// helmet or a procedurally approximated wig. Each style has three game LODs.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const loader=new GLTFLoader(),sources=new Map(),materials=new Map();
export const HAIR_STYLE_COUNTS=Object.freeze({male:14,female:12});
export const HAIR_COLORS=Object.freeze([0x35271f,0x664632,0x8b5e41,0x28262a,0x9b774b,0x57352d]);
const jobStyles=Object.freeze({
 job01:[3,2],job02:[6,11],job03:[9,4],job04:[4,8],
 job05:[2,9],job06:[5,1],job07:[11,5],job08:[14,7],
 job09:[10,3],job10:[8,10]
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

export async function attachCharacterHair({model,job,sex='male',style=null,color=null,quality='preview',helmet=false}){
 const id=selectedHairStyle(job,sex,style);
 const tint=color==null?HAIR_COLORS[Number(id)%HAIR_COLORS.length]:Number(color);
 const prefix=sex==='female'?'female':'male';
 const paths=[0,1,2].map(lod=>`./assets/characters/hair-fitted-v1/${prefix}_hair_${id}_lod${lod}.glb`);
 const resources=await Promise.all(paths.map(load));
 const bone=headBone(model),size=measureHeadLocalBounds(model,bone);
 const lod=new THREE.LOD(),assetBox=new THREE.Box3();
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
  if(index===0){scene.updateMatrixWorld(true);assetBox.setFromObject(scene)}
  lod.addLevel(scene,index===0?0:index===1?(quality==='battle'?2.4:4):(quality==='battle'?7:12));
 });
 if(assetBox.isEmpty())throw Error('髪モデルにメッシュがありません: '+id);
 const sourceSize=assetBox.getSize(new THREE.Vector3());
 const bodySize=size.dimensions;
 const fitX=bodySize.x*1.13/Math.max(.03,sourceSize.x);
 const fitZ=bodySize.z*1.12/Math.max(.03,sourceSize.z);
 const scale=THREE.MathUtils.clamp((fitX+fitZ)*.5,.55,1.8);
 const center=assetBox.getCenter(new THREE.Vector3()),headCenter=size.bounds.getCenter(new THREE.Vector3());
 lod.scale.setScalar(scale);
 lod.position.set(headCenter.x-center.x*scale,
  size.bounds.max.y+Math.max(.008,bodySize.y*.065)-assetBox.max.y*scale,
  headCenter.z-center.z*scale);
 lod.name='changeable-hair-'+prefix+'-'+id;
 lod.visible=!helmet;
 lod.userData={equipmentClass:'hair',style:id,sex,source:'Vincent Freelance CC BY 4.0',
  fittingScale:scale,headSamples:size.samples,headWidth:bodySize.x,headDepth:bodySize.z};
 bone.add(lod);
 return {object:lod,style:id,sex,color:tint,diagnostics:lod.userData,
  setVisible(value){lod.visible=Boolean(value)},
  dispose(){bone.remove(lod)}};
}
