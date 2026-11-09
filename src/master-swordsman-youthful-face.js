import * as THREE from 'three';
import {deformFacePoint,validateFaceProportions,FACE_PROPORTION_DEFAULTS} from './master-swordsman-face-proportions.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const smooth=(a,b,x)=>{const q=clamp((x-a)/(b-a));return q*q*(3-2*q)};

/**
 * Directly reshapes the existing Blender Studio face vertices. It is not a
 * 2D portrait / retouch or a replacement model. The archived CC0 source GLB
 * and its seven existing expression-independent morph channels stay intact.
 *
 * This adjusts jaw/chin/nose/lip proportions subtly to make five authored
 * protagonist candidates read younger. A full artistic facial sculpt and
 * photoreal texture pass is still required.
 */
export function prepareYouthfulFace(headRoot){
 if(!headRoot)throw Error('Real Blender face root required');
 let faceMesh=null,best=0;
 headRoot.traverse(o=>{
  if(!o.isMesh||/iris|sclera|eyelid|pupil/i.test(o.name))return;
  const n=o.geometry?.getAttribute('position')?.count||0;
  if(n>best){faceMesh=o;best=n;}
 });
 if(!faceMesh||best<1100)throw Error('Actual CC0 head topology required');
 const original=faceMesh.geometry;
 const preview=original.clone();
 faceMesh.geometry=preview;
 preview.computeBoundingBox();
 // Keep a fixed source-space frame across every slider edit and reset.
 // computeBoundingBox mutates the geometry's boundingBox in place.
 const box=preview.boundingBox.clone();
 const size=box.getSize(new THREE.Vector3());
 const cx=(box.max.x+box.min.x)/2;
 const p=preview.getAttribute('position');
 const base=p.array.slice();
 // This face has no photographic albedo atlas. Introduce *subtle* cheek,
 // brow and lip skin tone variation on the actual source face triangles,
 // rather than leaving one featureless cream-coloured plastic surface.
 // No external texture is represented as photographic skin.
 const skinTones=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){
  const x=(base[i*3]-cx)/Math.max(.001,size.x*.5);
  const y=(base[i*3+1]-box.min.y)/Math.max(.001,size.y);
  const z=(base[i*3+2]-box.min.z)/Math.max(.001,size.z);
  const facing=smooth(.48,.75,z);
  const cheeks=bell(Math.abs(x),.49,.26)*bell(y,.49,.14)*facing;
  const lips=bell(x,0,.32)*bell(y,.37,.055)*facing;
  const brow=bell(Math.abs(x),.42,.23)*bell(y,.78,.085)*facing;
  skinTones[i*3]=1+.013*cheeks-.014*brow+.012*lips;
  skinTones[i*3+1]=1-.027*cheeks-.015*brow-.010*lips;
  skinTones[i*3+2]=1-.041*cheeks-.011*brow-.020*lips;
 }
 preview.setAttribute('color',new THREE.Float32BufferAttribute(skinTones,3));
 let modified=0, last=0, lastProportions=FACE_PROPORTION_DEFAULTS, geometryDigest=0;
 function apply(weight,proportions=FACE_PROPORTION_DEFAULTS){
  const control=validateFaceProportions(proportions);
  const amount=clamp(Number(weight)||0);
  let changes=0;
  let sampleHash=0;
  for(let i=0;i<p.count;i++){
   const x0=base[i*3],y0=base[i*3+1],z0=base[i*3+2];
   const xn=(x0-cx)/Math.max(.001,size.x*.5);
   const yn=(y0-box.min.y)/Math.max(.001,size.y);
   const zn=(z0-box.min.z)/Math.max(.001,size.z);
   const jaw=smooth(.58,.13,yn);
   const chin=smooth(.33,.12,yn)*bell(xn,0,.68);
   const front=smooth(.49,.77,zn);
   const nose=bell(xn,0,.24)*bell(yn,.61,.13)*front;
   const lips=bell(xn,0,.38)*bell(yn,.40,.07)*front;
   const juvenileX=x0-(x0-cx)*(.13*jaw+.065*nose)*amount;
   const juvenileY=y0+size.y*.040*chin*amount;
   const juvenileZ=z0-size.z*(.047*nose-.012*lips)*amount;
   const d=deformFacePoint(juvenileX,juvenileY,juvenileZ,box,control);
   const {x:xx,y:yy,z:zz}=d;
   p.setXYZ(i,xx,yy,zz);
   if(Math.abs(xx-x0)+Math.abs(yy-y0)+Math.abs(zz-z0)>.00005)changes++;
   if(i%23===0)sampleHash+=(xx*3+yy*7+zz*11)*((i%13)+1);
  }
  p.needsUpdate=true;
  preview.computeVertexNormals();preview.computeBoundingBox();
  preview.computeBoundingSphere();
  last=amount;modified=changes;lastProportions=control;
  geometryDigest=Number(sampleHash.toFixed(6));
  return {strength:amount,modifiedVertices:changes,
   geometryDigest,proportions:control,
   sourceUnchanged:true,realHeadTopology:true};
 }
 apply(0);
 return {faceMesh,apply,getReport:()=>({strength:last,modifiedVertices:modified,
   geometryDigest,proportions:lastProportions,
   sourceFaceVertices:best,sourceUnchanged:true,realHeadTopology:true})};
}
