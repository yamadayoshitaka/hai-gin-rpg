/**
 * Reversible, shared photographic steel finish for white AI armor and one
 * optional battle swordsman. Same steel.jpg assets and correction as wardrobe.
 * A PBR material cannot repair poor geometry, normals or missing rigging.
 */
import * as THREE from 'three';
import {loadPhotoMaterials} from '../outfit-maintenance-model.js?v=4.4.47';

let photoPromise;
const originals=new WeakMap();
export function needsSwordsmanFinish(material) {
 const mats=Array.isArray(material)?material:[material];
 return mats.every(m=>!m?.map&&!m?.normalMap&&!m?.bumpMap);
}
export function projectSteelUV(geometry){
 const source=geometry?.getAttribute('position');
 if(!source||source.count<3)throw Error('モデルの頂点が不足しています');
 const uv=geometry.getAttribute('uv');
 if(uv&&uv.count===source.count){
  let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;
  const step=Math.max(1,Math.floor(uv.count/256));
  for(let i=0;i<uv.count;i+=step){
   a=Math.min(a,uv.getX(i));b=Math.max(b,uv.getX(i));
   c=Math.min(c,uv.getY(i));d=Math.max(d,uv.getY(i));
  }
  if(b-a>0.0001&&d-c>0.0001)return {geometry,generated:false};
 }
 const triangles=Math.floor((geometry.index?.count||source.count)/3);
 if(triangles<1||triangles>350000)throw Error('UVのないモデルが重すぎます（最大35万三角形）');
 // Split vertices for per-face dominant-planar UVs (helmet, chest, limbs).
 const prepared=geometry.index?geometry.toNonIndexed():geometry.clone();
 const xyz=prepared.getAttribute('position');
 prepared.computeVertexNormals();
 prepared.computeBoundingBox();
 const min=prepared.boundingBox.min,size=prepared.boundingBox.getSize(new THREE.Vector3());
 const scale=3/Math.max(size.length(),0.001);
 const coords=new Float32Array(xyz.count*2);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),
  ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();
 for(let i=0;i+2<xyz.count;i+=3){
  a.fromBufferAttribute(xyz,i);b.fromBufferAttribute(xyz,i+1);c.fromBufferAttribute(xyz,i+2);
  n.copy(ab.subVectors(b,a).cross(ac.subVectors(c,a))).normalize();
  const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
  for(let j=0;j<3;j++){
   const q=i+j,x=xyz.getX(q),y=xyz.getY(q),z=xyz.getZ(q);
   if(ay>=ax&&ay>=az){coords[2*q]=(x-min.x)*scale;coords[2*q+1]=(z-min.z)*scale}
   else if(ax>=az){coords[2*q]=(z-min.z)*scale;coords[2*q+1]=(y-min.y)*scale}
   else{coords[2*q]=(x-min.x)*scale;coords[2*q+1]=(y-min.y)*scale}
  }
 }
 prepared.setAttribute('uv',new THREE.BufferAttribute(coords,2));
 return {geometry:prepared,generated:true};
}
async function photos(){
 if(!photoPromise)photoPromise=loadPhotoMaterials().catch(e=>{photoPromise=null;throw e});
 return photoPromise;
}
export async function applySwordsmanSteelFinish(root,{force=false,armorOnly=false}={}){
 if(!root)throw Error('3Dモデルがありません');
 if(originals.has(root))return originals.get(root).summary;
 const targets=[];
 root.traverse(obj=>{
  if(!obj.isMesh||!obj.geometry?.getAttribute('position'))return;
  if(armorOnly&&obj.userData?.equipmentClass!=='armor'&&!/^armor[-_]/i.test(obj.name))return;
  if(/hair|face|headskin|eye|flesh|skin|nude|blade|sword|hilt/i.test(obj.name)&&
    obj.userData?.equipmentClass!=='armor')return;
  if(!force&&!needsSwordsmanFinish(obj.material))return;
  targets.push(obj);
 });
 if(!targets.length)return {applied:0,uvGenerated:0,detail:'既存のテクスチャを維持'};
 const textures=await photos();
 const edits=[];let generated=0;
 try{
  for(const mesh of targets){
   const prior={mesh,geometry:mesh.geometry,material:mesh.material};
   const projected=projectSteelUV(mesh.geometry);
   if(projected.generated){mesh.geometry=projected.geometry;generated++}
   const trim=/trim|gold|edge|crest|ornament|rivet|buckle|縁|装飾/i.test(
     mesh.name+' '+(mesh.userData?.equipmentMaterial||''));
   const map=trim?(textures['gold-brocade']||textures.steel):textures.steel;
   const grain=trim?map:(textures['steel-grain']||textures.steel);
   const material=new THREE.MeshPhysicalMaterial({
     name:trim?'AI_Preview_GoldTrim':'AI_Preview_SwordsmanSteel',
     color:trim?0xf3dfb7:0xd2dce5,map,
     bumpMap:grain,bumpScale:trim?0.001:0.0014,
     metalness:trim?.64:.40,roughness:trim?.33:.37,
     clearcoat:trim?.05:.15,clearcoatRoughness:.4,side:THREE.DoubleSide
   });
   mesh.material=material;
   mesh.castShadow=true;mesh.receiveShadow=true;
   edits.push({...prior,appliedMaterial:material,generated:projected.generated});
  }
 }catch(e){
  for(const row of edits.reverse()){
   row.mesh.material=row.material;
   if(row.generated){row.mesh.geometry.dispose();row.mesh.geometry=row.geometry}
   row.appliedMaterial.dispose();
  }
  throw e;
 }
 const summary={applied:edits.length,uvGenerated:generated,
  detail:'剣士の写真鋼材 '+edits.length+'メッシュ／自動UV '+generated+'メッシュ'};
 originals.set(root,{edits,summary});
 return summary;
}
export function restoreSwordsmanSteelFinish(root){
 const entry=originals.get(root);
 if(!entry)return {restored:0};
 for(const row of entry.edits){
  row.mesh.material=row.material;
  if(row.generated){row.mesh.geometry.dispose();row.mesh.geometry=row.geometry}
  row.appliedMaterial.dispose();
 }
 originals.delete(root);
 return {restored:entry.edits.length};
}
