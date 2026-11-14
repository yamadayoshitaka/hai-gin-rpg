/**
 * Build the Dragon Lord's hard, scale-coloured cranial epidermis from the
 * actual source female SkinnedMesh triangles, not from another SphereGeometry.
 *
 * The previous parametric dome projected as an enormous purple 'onion' with
 * concentric bands and orange skin holes. This module copies the ALREADY
 * skinned native scalp surface in a Head-bone-attached upright frame and
 * offsets it only 3mm, retaining the donor's exact head proportions.
 *
 * Species-local overlay ONLY: never edit the source GLB, its skinning weights
 * or shared playable actor materials. Not for beast/dragon summon forms.
 */
import * as THREE from 'three';

export function createDragonkinNativeScalpOverlay({
 model,headBone,groomFrame,scalp,detail='high'
}={}){
 if(!model||!headBone?.isBone||!groomFrame||
    groomFrame.parent!==headBone||!scalp?.fitted)return null;
 if(!Array.isArray(scalp.center)||!Array.isArray(scalp.radius)||
    scalp.radius.some(r=>!Number.isFinite(r)||r<=0))return null;
 model.updateMatrixWorld(true,true);
 groomFrame.updateWorldMatrix(true,false);
 const inverse=groomFrame.matrixWorld.clone().invert();
 const [cx,cy,cz]=scalp.center,[rx,ry,rz]=scalp.radius;
 // Stop above eyes and brows. Natural female facial topology stays visible.
 const minY=cy+ry*.15;
 const positions=[],uv=[];
 let sourceTriangles=0;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute('position')||
     !mesh.skeleton||!mesh.visible)return;
  for(let n=mesh.parent;n&&n!==model;n=n.parent)if(!n.visible)return;
  if(/hair|wig|helmet|hat|eyebrow|eyelash|eyes|iris|cornea/i.test(mesh.name))
   return;
  const g=mesh.geometry,vertices=g.getAttribute('position'),
   weights=g.getAttribute('skinWeight'),boneIds=g.getAttribute('skinIndex'),
   sourceUV=g.getAttribute('uv'),index=g.getIndex();
  if(!weights||!boneIds)return;
  const headIndex=mesh.skeleton.bones.findIndex(b=>b===headBone);
  if(headIndex<0)return;
  const cache=new Map(),v=new THREE.Vector3();
  function sample(i){
   if(cache.has(i))return cache.get(i);
   let weight=0;
   for(let k=0;k<4;k++)if(boneIds.getComponent(i,k)===headIndex)
    weight+=weights.getComponent(i,k);
   if(weight<.73){cache.set(i,null);return null;}
   mesh.getVertexPosition(i,v);
   const p=v.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
   if(![p.x,p.y,p.z].every(Number.isFinite)||p.y<minY||
      Math.abs(p.x-cx)>rx*1.55||Math.abs(p.z-cz)>rz*1.55){
    cache.set(i,null);return null;
   }
   const outward=p.clone().sub(new THREE.Vector3(cx,cy,cz));
   if(outward.lengthSq()<1e-10)outward.set(0,1,0);
   outward.normalize().multiplyScalar(.0030);
   const sample={point:p.add(outward),
    uv:sourceUV?[sourceUV.getX(i),sourceUV.getY(i)]:[.5,.5]};
   cache.set(i,sample);return sample;
  }
  const total=index?.count??vertices.count;
  for(let i=0;i+2<total;i+=3){
   const a=sample(index?index.getX(i):i),
    b=sample(index?index.getX(i+1):i+1),
    c=sample(index?index.getX(i+2):i+2);
   if(!a||!b||!c)continue;
   for(const item of [a,b,c]){
    positions.push(item.point.x,item.point.y,item.point.z);
    uv.push(...item.uv);
   }
   sourceTriangles++;
  }
 });
 if(sourceTriangles<20)return null;
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.computeVertexNormals();
 geo.userData={kind:'dragonkin-native-scalp-surface',detail,
  originalHeadTopology:true,sourceTriangles,
  offsetMetres:.003,sourceHairless:true};
 return geo;
}
