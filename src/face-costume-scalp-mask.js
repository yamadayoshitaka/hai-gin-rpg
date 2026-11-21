import * as THREE from 'three';
import {buzzHairlineFractionAtPoint} from './face-scalp-wig.js';
import {isSadakoFamilyStyle} from './face-wig-styles.js?v=65';

/**
 * Hide ONLY the native skin underneath the independent wig in the full-body
 * costume studio. The salon already clips this same donor contour; the outfit
 * view previously left the bare head intact, so at oblique angles its skin
 * depth-tested IN FRONT of the stubble/long-hair undercoat ("half bald").
 *
 * Source donor geometry is never edited. Clothing, neck and eyebrows remain.
 */
export function setCostumeHairScalpMask(face,styleId,{
 wigVisible=true,scalpReferenceGeometry=null}={}){
 if(!face?.isMesh)return {active:false,reason:'no-head'};
 const data=face.userData;
 const donor=data.originalCostumeScalpGeometry||face.geometry;
 data.originalCostumeScalpGeometry=donor;
 if(face.geometry!==donor){
  face.geometry.dispose();face.geometry=donor;
 }
 const useMask=wigVisible&&(styleId==='buzz-cut'||isSadakoFamilyStyle(styleId));
 data.costumeScalpMaskActive=false;
 data.costumeScalpMaskRemovedTriangles=0;
 data.costumeScalpMaskClippedTriangles=0;
 data.costumeScalpMaskStyle=styleId||null;
 if(!useMask)return {active:false,restored:true};
 const pos=donor.getAttribute('position');
 if(!pos||pos.count<3)return {active:false,reason:'no-position'};
 // Fitted costume geometry includes a WELDED neck / jaw bridge. Its
 // bounding box is NOT the immutable follicle donor bounds used by the
 // wig and salon. Using the neck-extended bounds was responsible for
 // view-dependent bare patches and an artificial neckline cut.
 const reference=scalpReferenceGeometry?.getAttribute?.('position')?
  scalpReferenceGeometry:donor;
 reference.computeBoundingBox();
 const box=reference.boundingBox,sz=box.getSize(new THREE.Vector3());
 const center=box.getCenter(new THREE.Vector3());
 if(sz.x<=0||sz.y<=0||sz.z<=0)return {active:false,reason:'invalid-bounds'};
 // The exact same curved donor hairline as face-mesh-studio.html.
 // Never use a hemisphere threshold, which cuts a visible horizontal line.
 const distance=p=>p[1]-box.min.y-sz.y*(
  buzzHairlineFractionAtPoint({x:p[0],y:p[1],z:p[2]},box,sz,center)+
  (styleId==='buzz-cut' ? -.012 : -.018));
 // Only crop the actual face donor. The lower collar is a second sewn
 // surface and must NEVER become a clipped hairline polygon.
 const originalStitchedVertices=donor.userData?.studioOriginalFaceVertexCount;
 const protectedNeckIndex=Number.isInteger(originalStitchedVertices)?
  originalStitchedVertices:Infinity;
 const attrs=Object.entries(donor.attributes);
 const morphs=Object.entries(donor.morphAttributes||{});
 const index=donor.index,groups=donor.groups.length?donor.groups:
  [{start:0,count:index?index.count:pos.count,materialIndex:0}];
 const output=Object.fromEntries(attrs.map(([name])=>[name,[]]));
 const morphOutput=Object.fromEntries(morphs.map(([name,list])=>
  [name,list.map(()=>[])]));
 const retainedGroups=[];
 let vertices=0,removed=0,clipped=0;
 const read=i=>{
  const v={fields:{},morph:{},dist:0};
  for(const [key,a] of attrs){
   v.fields[key]=Array.from({length:a.itemSize},(_,j)=>a.getComponent(i,j));
  }
  for(const [key,list] of morphs)
   v.morph[key]=list.map(a=>Array.from({length:a.itemSize},(_,j)=>a.getComponent(i,j)));
  v.dist=distance(v.fields.position);return v;
 };
 const lerp=(a,b,t)=>{
  const v={fields:{},morph:{},dist:0};
  for(const [key] of attrs)
   v.fields[key]=a.fields[key].map((x,j)=>x+(b.fields[key][j]-x)*t);
  for(const [key,list] of morphs)
   v.morph[key]=list.map((_,m)=>a.morph[key][m].map((x,j)=>
    x+(b.morph[key][m][j]-x)*t));
  v.dist=distance(v.fields.position);
  return v;
 };
 const edge=(a,b)=>{
  // Curved boundary: bracket the surface crossing, not just a y-plane.
  let lo=0,hi=1;
  for(let k=0;k<13;k++){
   const mid=(lo+hi)*.5;
   if((lerp(a,b,mid).dist<=0)===(a.dist<=0))lo=mid;
   else hi=mid;
  }
  const v=lerp(a,b,(lo+hi)*.5);
  v.dist=0;return v;
 };
 for(const g of groups){
  const start=vertices,stop=Math.min(g.start+g.count,index?index.count:pos.count);
  for(let k=g.start;k+2<stop;k+=3){
   const ids=[0,1,2].map(j=>index?index.getX(k+j):k+j);
   const source=ids.map(read);
   const stitchedNeck=ids.some(id=>id>=protectedNeckIndex);
   const inside=stitchedNeck?[true,true,true]:source.map(v=>v.dist<=0);
   const poly=[];
   for(let j=0;j<3;j++){
    const a=source[j],b=source[(j+1)%3];
    if(inside[j])poly.push(a);
    if(inside[j]!==inside[(j+1)%3])poly.push(edge(a,b));
   }
   if(poly.length<3){removed++;continue;}
   if(!inside.every(Boolean))clipped++;
   for(let j=1;j+1<poly.length;j++){
    for(const v of [poly[0],poly[j],poly[j+1]]){
     for(const [key] of attrs)output[key].push(...v.fields[key]);
     for(const [key,list] of morphs)for(let m=0;m<list.length;m++)
      morphOutput[key][m].push(...v.morph[key][m]);
     vertices++;
    }
   }
  }
  if(vertices>start)retainedGroups.push({
   start,count:vertices-start,materialIndex:g.materialIndex});
 }
 if(!removed&&!clipped)return {active:false,reason:'no-triangles-to-mask'};
 const masked=new THREE.BufferGeometry();
 for(const [key,attr] of attrs){
  const values=output[key];
  if(key==='skinIndex')for(let i=0;i<values.length;i++)values[i]=Math.round(values[i]);
  masked.setAttribute(key,new THREE.BufferAttribute(
   new attr.array.constructor(values),attr.itemSize,attr.normalized));
 }
 for(const [key,list] of morphs)
  masked.morphAttributes[key]=list.map((a,m)=>new THREE.BufferAttribute(
   new a.array.constructor(morphOutput[key][m]),a.itemSize,a.normalized));
 masked.morphTargetsRelative=donor.morphTargetsRelative;
 for(const g of retainedGroups)masked.addGroup(g.start,g.count,g.materialIndex);
 masked.computeBoundingBox();masked.computeBoundingSphere();
 face.geometry=masked;
 data.costumeScalpMaskActive=true;
 data.costumeScalpMaskRemovedTriangles=removed;
 data.costumeScalpMaskClippedTriangles=clipped;
 data.costumeScalpMaskMode='donor-reference-neck-safe-v63';
 data.costumeScalpMaskReference=reference===donor?'displayed-face':'uncut-follicle-donor';
 return {active:true,removed,clipped,styleId,
  source: data.costumeScalpMaskReference,protectedNeckIndex};
}

export function releaseCostumeHairScalpMask(face){
 if(!face?.isMesh)return;
 const donor=face.userData.originalCostumeScalpGeometry;
 if(!donor)return;
 if(face.geometry!==donor)face.geometry.dispose();
 face.geometry=donor;
 delete face.userData.originalCostumeScalpGeometry;
 face.userData.costumeScalpMaskActive=false;
}
