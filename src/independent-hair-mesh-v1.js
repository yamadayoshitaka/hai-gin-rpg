/**
 * A detachable GLB hairstyle broken into crown / fringe / sides / back.
 * Vertex motion is weighted to the free lengths; scalp/root vertices stay fixed.
 * Source geometry and textures remain independent of the face and body mesh.
 */
import {independentHairFit,classifyHairTriangle} from './independent-hair-library-v1.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let fibers=null;
function fiberTexture(THREE){
 if(fibers||typeof document==='undefined')return fibers;
 const c=document.createElement('canvas');c.width=c.height=256;
 const ctx=c.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='#ebdeca';ctx.fillRect(0,0,256,256);
 for(let i=0;i<1500;i++){
  const x=(i*163.733)%256,y=(i*19.827)%256;
  ctx.strokeStyle=i%3?'rgba(126,94,65,.22)':'rgba(255,252,241,.45)';
  ctx.lineWidth=i%5===0?.7:.38;ctx.beginPath();
  ctx.moveTo(x,y);ctx.bezierCurveTo(x-1,y+14,x+2,y+30,x,y+48);ctx.stroke();
 }
 fibers=new THREE.CanvasTexture(c);fibers.wrapS=fibers.wrapT=THREE.RepeatWrapping;
 fibers.colorSpace=THREE.SRGBColorSpace;return fibers;
}
const SECTIONS=['crown','fringe','left','right','back'];
const EXPLODE={
 crown:[0,.105,0],fringe:[0,.012,.13],
 left:[-.13,-.01,0],right:[.13,-.01,0],back:[0,-.025,-.17]
};
const SECTION_COLORS={crown:0xc3a4ee,fringe:0xa9e6bc,
 left:0xf1b5b5,right:0xf1b5b5,back:0x9ab8ec};
export function buildIndependentHairMesh(THREE,scene,{headSize={},color='#c5a36f'}={}){
 scene.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(scene);
 if(box.isEmpty())throw Error('読み込んだGLBに髪メッシュがありません');
 const asset={min:{x:box.min.x,y:box.min.y,z:box.min.z},
  max:{x:box.max.x,y:box.max.y,z:box.max.z}};
 const root=new THREE.Group();root.name='detachable-hair-asset';
 const zones=new Map(),deformers=[],owned=[];
 for(const id of SECTIONS){const group=new THREE.Group();group.name='hair-part-'+id;
  root.add(group);zones.set(id,group);}
 const mid=new THREE.Vector3(),v=new THREE.Vector3();
 scene.traverse(source=>{
  if(!source.isMesh||!source.geometry?.getAttribute('position'))return;
  const geometry=source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  const pos=geometry.getAttribute('position');
  const index=geometry.getIndex();
  const triangles=index?index.count/3:pos.count/3;
  const buckets=Object.fromEntries(SECTIONS.map(id=>[id,[]]));
  for(let t=0;t<triangles;t++){
   const a=index?index.getX(t*3):t*3;
   const b=index?index.getX(t*3+1):t*3+1;
   const c=index?index.getX(t*3+2):t*3+2;
   mid.set((pos.getX(a)+pos.getX(b)+pos.getX(c))/3,
    (pos.getY(a)+pos.getY(b)+pos.getY(c))/3,
    (pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3);
   const section=classifyHairTriangle(mid.x,mid.y,mid.z,asset,
    Math.min(.25,Math.max(.17,(box.max.x-box.min.x)*.8)));
   buckets[section].push(a,b,c);
  }
  const originalMaterial=Array.isArray(source.material)?
   source.material[0]:source.material;
  for(const id of SECTIONS){
   if(!buckets[id].length)continue;
   const geometryPart=geometry.clone();geometryPart.setIndex(buckets[id]);
   geometryPart.clearGroups();geometryPart.computeBoundingSphere();
   const material=originalMaterial?.clone()||
    new THREE.MeshStandardMaterial({roughness:.76,side:THREE.DoubleSide});
   material.side=THREE.DoubleSide;
   material.roughness=Math.max(.65,material.roughness??.78);
   material.metalness=0;
   if(!material.map&&geometryPart.getAttribute('uv'))material.map=fiberTexture(THREE);
   if(material.color)material.color.set(color);
   const mesh=new THREE.Mesh(geometryPart,material);
   mesh.name='hair-part-'+id;mesh.castShadow=true;mesh.receiveShadow=true;
   mesh.frustumCulled=false;zones.get(id).add(mesh);owned.push([geometryPart,material]);
   const attr=geometryPart.getAttribute('position');
   const original=new Float32Array(attr.array);
   const weights=new Float32Array(attr.count);
   const rootDistance=Math.max(.10,(box.max.x-box.min.x)*.52);
   for(let i=0;i<attr.count;i++){
    const y=original[i*3+1];
    const free=clamp((box.max.y-y-rootDistance*.58)/
     Math.max(.09,(box.max.y-box.min.y)*.65),0,1);
    weights[i]=id==='crown'?0:Math.pow(free,1.7);
   }
   deformers.push({attr,original,weights});
  }
  geometry.dispose();
 });
 if(!deformers.length)throw Error('髪の三角形を抽出できません');
 let exploded=false, tintMode=false;
 const fitToHead=next=>{
  const fit=independentHairFit(asset,next);
  root.scale.set(...fit.scale);
  root.position.set(...fit.position);
  root.userData.fit=fit;
  return fit;
 };
 const setExploded=flag=>{
  exploded=!!flag;
  for(const [id,g] of zones){
   const p=exploded?EXPLODE[id]:[0,0,0];
   g.position.set(...p);
  }
 };
 const setSectionColors=flag=>{
  tintMode=!!flag;
  for(const [id,g] of zones){
   g.traverse(child=>{
    if(!child.isMesh)return;
    child.material.color.set(tintMode?SECTION_COLORS[id]:color);
    // In breakdown mode show zone colors rather than tinting a blonde texture.
    child.material.map=tintMode?null:(child.userData.sourceMap||child.material.map);
    child.material.needsUpdate=true;
   });
  }
 };
 for(const g of zones.values())g.traverse(child=>{
  if(child.isMesh)child.userData.sourceMap=child.material.map||null;
 });
 const setColor=c=>{
  color=c;
  for(const [id,g] of zones)g.traverse(child=>{
   if(child.isMesh)child.material.color.set(tintMode?SECTION_COLORS[id]:c);
  });
 };
 let lastX=0,lastZ=0;
 const deformTips=(x=0,z=0)=>{
  if(Math.abs(x-lastX)+Math.abs(z-lastZ)<.00005)return;
  lastX=x;lastZ=z;
  for(const d of deformers){
   const {attr,original,weights}=d;
   for(let i=0;i<weights.length;i++){
    const j=i*3,w=weights[i];
    attr.array[j]=original[j]+x*w;
    attr.array[j+1]=original[j+1];
    attr.array[j+2]=original[j+2]+z*w;
   }
   attr.needsUpdate=true;
  }
 };
 const sectionCounts=Object.fromEntries([...zones].map(([id,g])=>
  [id,g.children.reduce((n,m)=>n+(m.geometry.getIndex()?.count||0)/3,0)]));
 fitToHead(headSize);
 return {
  root,assetBox:asset,sectionCounts,fitToHead,setColor,setExploded,
  setSectionColors,deformTips,
  setSectionVisible(id,visible){if(zones.has(id))zones.get(id).visible=!!visible;},
  dispose(){
   for(const [geometry,material] of owned){geometry.dispose();material.dispose();}
   root.parent?.remove(root);
  }
 };
}
