import * as THREE from 'three';
import {deformFacePoint,validateFaceProportions,FACE_PROPORTION_DEFAULTS} from './master-swordsman-face-proportions.js';
import {createReferenceHeroineFaceFitter,REFERENCE_HEROINE_FACE} from './master-heroine-reference-fit.js';
import {polishHeroineFacePoint,HEROINE_FACE_POLISH_VERSION} from './master-heroine-facial-refinement.js';

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
export function prepareYouthfulFace(headRoot,{referenceFit=false,referenceGuide=false}={}){
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
 // A single front-view sketch cannot automatically determine an entire
 // head's topology. The last full-strength warp stretched the jaw and caused
 // severe facial distortion, so tracing is display-only until calibrated.
 const silhouette=(referenceFit||referenceGuide)?
  createReferenceHeroineFaceFitter(base,box):null;
 const silhouetteMorphEnabled=false; // safety gate: visual QA failed
 let guide=null;
 if(silhouette){
  const points=[];
  const radius=silhouette.faceWidthMeters*.5;
  // Actual 3D world-space annotation based on the normalized 2D trace;
  // it is optional and never baked into the exported face mesh.
  for(const [t,r] of REFERENCE_HEROINE_FACE.outline)
   points.push(new THREE.Vector3(cx-radius*r,
    box.min.y+size.y*(.12+.81*t),box.max.z+.05));
  for(const [t,r] of [...REFERENCE_HEROINE_FACE.outline].reverse())
   points.push(new THREE.Vector3(cx+radius*r,
    box.min.y+size.y*(.12+.81*t),box.max.z+.05));
  const geometry=new THREE.BufferGeometry().setFromPoints(points);
  guide=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({
   color:0xff80bd,transparent:true,opacity:.85,
   depthTest:false,depthWrite:false
  }));
  guide.name='USER_APPROVED_FACE_2D_CONTOUR_TRACE_GUIDE';
  guide.visible=false;guide.renderOrder=999;
  faceMesh.add(guide);
 }
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
  // Subtle vertex-level lip and cheek albedo remains tied to the real
  // sculpt, with no fake face plane or overpainted mouth texture.
  const adultFace=referenceGuide?1:0;
  skinTones[i*3]=1+.020*cheeks-.014*brow+.020*lips*adultFace+.012*lips*(1-adultFace);
  skinTones[i*3+1]=1-.033*cheeks-.015*brow-.045*lips*adultFace-.010*lips*(1-adultFace);
  skinTones[i*3+2]=1-.051*cheeks-.011*brow-.066*lips*adultFace-.020*lips*(1-adultFace);
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
   // Youthful fantasy face: smaller jaw and nose, fuller upper cheeks,
   // and less protruding eyebrow ridge. Preserve the original facial
   // topology and let the socket-attachment regression follow this morph.
   const cheek=bell(Math.abs(xn),.53,.28)*bell(yn,.56,.13)*front;
   const browRidge=bell(Math.abs(xn),.41,.30)*bell(yn,.79,.075)*front;
   // Round the cheeks, shorten the low jaw and soften the supraorbital
   // ridge. This affects the source-derived face, not synthetic 2D textures.
   // Round the full cheek/jaw contour rather than creating a pointy
   // chin by squeezing all lower-face vertices toward the centre. The
   // cheekRoundness slider applies another controlled, reversible layer.
   const lowerCheek=bell(Math.abs(xn),.57,.38)*bell(yn,.43,.21)*front;
   const juvenileX=x0+(x0-cx)*(.082*cheek+.095*lowerCheek-.105*jaw-.069*nose)*amount;
   const juvenileY=y0+size.y*.051*chin*amount;
   const juvenileZ=z0+size.z*
     (-.061*nose+.010*lips+.052*cheek+.039*lowerCheek-.029*browRidge)*amount;
   const d=deformFacePoint(juvenileX,juvenileY,juvenileZ,box,control);
   // Follow the independently measured FRONT silhouette of the approved
   // 2D girl image. Only lateral face vertices move; the existing CC0 head
   // still supplies real 3D depths for cheek/nose/side/back.
   const matched=silhouette&&silhouetteMorphEnabled?
    silhouette.deform(d.x,d.y,d.z,amount):d;
   // Female-only real 3D sculpt refinement, independent of the optional
   // outline guide. Kept reversible because base vertices are immutable.
   const {x:xx,y:yy,z:zz}=referenceGuide?
    polishHeroineFacePoint(matched.x,matched.y,matched.z,box):matched;
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
   sourceUnchanged:true,realHeadTopology:true,
   referenceSilhouette:silhouette?.report||null,
   referenceSilhouetteApplied:false,
   femaleBeautyRefinement:referenceGuide?HEROINE_FACE_POLISH_VERSION:null};
 }
 apply(0);
 return {faceMesh,apply,setReferenceGuideVisible(show){
  if(guide)guide.visible=Boolean(show);
  return Boolean(guide?.visible);
 },getReport:()=>({strength:last,modifiedVertices:modified,
   geometryDigest,proportions:lastProportions,
   sourceFaceVertices:best,sourceUnchanged:true,realHeadTopology:true,
   referenceSilhouette:silhouette?.report||null,
   referenceSilhouetteApplied:false,
   femaleBeautyRefinement:referenceGuide?HEROINE_FACE_POLISH_VERSION:null,
   referenceGuideVisible:Boolean(guide?.visible)})};
}
