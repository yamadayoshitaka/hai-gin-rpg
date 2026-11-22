import * as THREE from 'three';
import {createTopologyOralMuscleField,createThreeRingVestibuleIndices} from './face-muscle-topology-v95.js?v=95-nasal-side-edgeflow';
import {naturalLaughLipDelta} from './face-v96-smile-cosmetics.js?v=96-anatomical-expression';

/**
 * V88 native oral articulation. This operates ONLY on the owned donor-head
 * clone and the donor's measured lip-boundary vertices. No screen-space
 * mouth stickers, floating black front sphere, source GLB edits or fake
 * open-mouth painted texture.
 *
 * The v86 rest-state patches are retained for a watertight neutral face.
 * Once the jaw opens, those caps are excluded from the render index and a
 * recessed, boundary-conforming vestibule is visible behind the REAL gap.
 * Full geometry is restored at closure. Expression motion always starts from
 * the freshly calculated head-skin pose, never the preceding animation frame.
 */
const rigs=new WeakMap();
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const fall=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

/**
 * v94: remove source-head triangles which cover the inner mouth *only
 * while open*. A closed mouth retains every original donor triangle.
 * Previously only the additional neutral caps were hidden, leaving giant
 * ivory skin triangles masquerading as front teeth during laughter.
 */
export function classifyDonorOralInterior(geometry,boundary,triangles,{donorName=''}={}){
 // Real WebGL ray-traces identified these exact ORIGINAL white-mouth
 // face triangles, both outside the 40-vertex closed rim polygon.
 // This correction is only for the verified CC0 female head.
 const verifiedHead=donorName==='FEMALE_INDEPENDENT_CLAY_FACE';
 const rayVerifiedFolds=verifiedHead?
  new Set(['1882/2240/2242','1879/2244/3242']):new Set();
 const a=geometry?.getAttribute?.('position'),box=geometry?.boundingBox;
 const fallback=reason=>({opened:triangles.slice(),hidden:new Set(),removed:0,reason});
 if(!a||!box||!Array.isArray(boundary)||boundary.length<30)
  return fallback('missing-native-outer-ring');
 const d=box.getSize(new THREE.Vector3());
 const poly=boundary.map(i=>[a.getX(i),a.getY(i)]);
 const xx=poly.map(v=>v[0]),yy=poly.map(v=>v[1]);
 const w=Math.max(...xx)-Math.min(...xx),h=Math.max(...yy)-Math.min(...yy);
 if(w<d.x*.055||w>d.x*.31||h<d.y*.007||h>d.y*.12)
  return fallback('unexpected-oral-boundary');
 const inside=(x,y)=>{
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const [xi,yi]=poly[i],[xj,yj]=poly[j];
   if(((yi>y)!==(yj>y))&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)
    hit=!hit;
  }
  return hit;
 };
 const opened=[],hidden=new Set();
 const minZ=box.min.z+d.z*.48;
 for(let i=0;i<triangles.length;i+=3){
  const ids=triangles.slice(i,i+3);
  const x=(a.getX(ids[0])+a.getX(ids[1])+a.getX(ids[2]))/3;
  const y=(a.getY(ids[0])+a.getY(ids[1])+a.getY(ids[2]))/3;
  const z=(a.getZ(ids[0])+a.getZ(ids[1])+a.getZ(ids[2]))/3;
  const key=ids.slice().sort((u,v)=>u-v).join('/');
  const verifiedFold=rayVerifiedFolds.has(key)&&a.count===3490&&
   z>minZ&&Math.abs(x)<d.x*.095;
  // Earlier polygon-only removal selected far too much of the face.
  // On the verified donor, only the 2 ray-confirmed folds are removed.
  // All other heads retain conservative, protected classification.
  if(verifiedHead?verifiedFold:(z>minZ&&inside(x,y))){
   hidden.add(key);continue;
  }
  opened.push(...ids);
 }
 if(hidden.size>Math.min(250,triangles.length/3*.035))
  return fallback('too-many-face-triangles');
 return {opened,hidden,removed:hidden.size};
}
export function initializeNativeOralRig(face){
 const seal=face?.userData?.v86OralSeal;
 const g=face?.geometry,attr=g?.getAttribute('position'),index=g?.getIndex();
 if(!seal?.sealed||!Array.isArray(seal.lipRing)||seal.lipRing.length<24||
    !attr||!index||!Number.isInteger(seal.initialTriangleCount))
  return {ready:false,reason:'unverified-donor-oral-boundary'};
 const boundary=seal.outerSelectedRing?.length>=30?
  seal.outerSelectedRing:seal.lipRing;
 if(boundary.some(i=>!Number.isInteger(i)||i<0||i>=attr.count))
  return {ready:false,reason:'invalid-lip-rim-index'};
 g.computeBoundingBox();
 const box=g.boundingBox.clone(),size=box.getSize(new THREE.Vector3());
 const cx=(box.min.x+box.max.x)*.5;
 const xs=boundary.map(i=>attr.getX(i)),ys=boundary.map(i=>attr.getY(i));
 // v97: the native connected lip aperture defines the dental/oral origin.
 // The former color-curvature guess could sit on the philtrum and push
 // teeth into uncut face triangles in child/ultra-thin presets.
 const cy=(Math.min(...ys)+Math.max(...ys))*.5;
 const landmarkY=face.userData.actualMouthCreaseY??box.min.y+size.y*.509;
 const halfWidth=(Math.max(...xs)-Math.min(...xs))*.5;
 if(halfWidth<size.x*.025||halfWidth>size.x*.25||
    Math.abs(landmarkY-cy)>size.y*.11)
  return {ready:false,reason:'oral-rim-outside-landmark'};
 const closedIndices=Array.from(index.array),originalCount=seal.initialTriangleCount*3;
 if(originalCount<=0||originalCount>=closedIndices.length)
  return {ready:false,reason:'unverified-native-cap-indices'};
 const filtered=classifyDonorOralInterior(g,boundary,
  closedIndices.slice(0,originalCount),{donorName:face.name});
 const openedIndices=filtered.opened;
 // Three linked closed loops: lip boundary, mucosal transition and inner
 // vestibule. Every quad is welded to the donor's original lip edge.
 const oralTopology=createTopologyOralMuscleField(g,boundary,{
  sourceTriangleCount:seal.initialTriangleCount,centerY:cy});
 const n=boundary.length,position=new Float32Array(n*3*3),
  color=new Float32Array(n*3*3);
 const triangles=createThreeRingVestibuleIndices(n);
 for(let i=0;i<n;i++){
  color.set([.67,.27,.31],i*3);
  color.set([.41,.14,.18],(n+i)*3);
  color.set([.20,.065,.09],(2*n+i)*3);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.BufferAttribute(position,3));
 geo.setAttribute('color',new THREE.BufferAttribute(color,3));
 geo.setIndex(triangles);
 const material=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.79,metalness:0,
  side:THREE.DoubleSide,depthTest:true,depthWrite:true
 });
 const wall=new THREE.Mesh(geo,material);
 wall.name='V88_NATIVE_RECESSED_ORAL_VESTIBULE';
 wall.visible=false;wall.frustumCulled=false;
 wall.userData.anatomicalRole='inner-oral-wall';
 face.add(wall);
 const original=attr.array.slice();
 const weights=new Float32Array(attr.count);
 const centerSign=new Float32Array(attr.count);
 for(let i=0;i<attr.count;i++){
  const x=original[i*3],y=original[i*3+1],z=original[i*3+2];
  const normFront=(z-box.min.z)/Math.max(1e-8,size.z);
  const normalizedX=Math.abs(x-cx)/Math.max(1e-8,halfWidth);
  const ny=Math.abs(y-cy)/size.y;
  // A strict oral envelope avoids the alar nose, cheekbones and lower lids.
  // The old XY Gaussian gave the actual lip seam ZERO influence at
  // y == centerY, resulting in a puckered smile. A topological shortest
  // path instead makes all donor lip-loop vertices fully active.
  weights[i]=oralTopology.valid?oralTopology.weights[i]:
   Math.pow(Math.max(0,1-smooth(.78,1.50,normalizedX)),1.3)*
   (1-smooth(.008,.035,ny))*smooth(.52,.78,normFront);
  centerSign[i]=Math.tanh((y-cy)/(size.y*.0045));
 }
 const rig={face,g,attr,boundary,closedIndices,openedIndices,
  oralTopology,
  removedOriginalTriKeys:filtered.hidden,removedOriginalTriangles:filtered.removed,
  size,cx,cy,halfWidth,wall,skinBase:original.slice(),
  weights,centerSign,isOpen:false,lastOpen:-1};
 rigs.set(face,rig);
 const status={ready:true,kind:'native-boundary-recessed-vestibule',
  boundaryVertices:n,originalTriangleCount:originalCount/3,
  neutralTriangleCount:closedIndices.length/3,
  donorOwned:true,reversible:true,oralMeshOverlays:false,
  v94HiddenDonorInteriorTriangles:filtered.removed,
  v95ThreeConnectedOralRings:true,
  v96EllipticalSmile:true,v96MaximumLipSpread:.085,
  v97NativeOralLandmarkY:cy,
  v97NativeMouthHalfWidth:halfWidth,
  v97AnatomicalLandmarkAligned:true,
  v95OralEdgeFlowValid:oralTopology.valid,
  v95OralEdgeFlowReason:oralTopology.valid?null:oralTopology.reason,
  v95OralEdgeConnectedVertices:oralTopology.influencedVertices??0,
  v94ClassifierReason:filtered.reason||null,
  v94ClassifierDonorName:face.name,
  v94SourceVertexCount:attr.count,
  v94KnownTrianglePresence:(()=>{
   const found=new Set();
   for(let k=0;k<originalCount;k+=3){
    const ids=closedIndices.slice(k,k+3).sort((a,b)=>a-b).join('/');
    if(ids==='1882/2240/2242'||ids==='1879/2244/3242')found.add(ids);
   }
   return [...found];
  })()};
 face.userData.v88NativeOralRig=status;
 face.userData.actualMouthCreaseY=cy;
 updateNativeOralPose(face,{open:0});
 return status;
}

/** Read the full neutral index order even while the jaw is open. Scalp
 * clipping must build from this owned source, never from the opened cap-less
 * index. Only the original donor mesh is queried. */
export function getNativeOralClosedIndices(face){
 const rig=rigs.get(face);
 return rig?rig.closedIndices.slice():null;
}

export function captureNativeOralSkinPose(face){
 const r=rigs.get(face);
 if(!r)return false;
 r.skinBase.set(r.attr.array);
 r.lastOpen=-1;
 return true;
}

export function updateNativeOralPose(face,{open=0,smile=0,cheek=0}={}){
 const r=rigs.get(face);
 if(!r)return false;
 const o=clamp(open),s=clamp(smile,-1,1),c=clamp(cheek,-1,1);
 const active=o>.045;
 if(active!==r.isOpen){
  r.g.setIndex(active?r.openedIndices:r.closedIndices);
  r.isOpen=active;
 }
 const {attr,skinBase,size,weights,centerSign,cx,cy,halfWidth,boundary,wall}=r;
 // Restore from the fresh FACS skin pose on EVERY frame. Never accumulate
 // deformations or move a single vertex near the nose/eye for jaw opening.
 for(let i=0;i<attr.count;i++){
  const k=i*3,w=weights[i];
  if(w<.0001)continue;
  const sx=centerSign[i];
  const x=skinBase[k],y=skinBase[k+1],z=skinBase[k+2];
  if(face.name.startsWith('FEMALE_')){
   // The original connected female lip loop opens as a smooth oval.
   const pose=naturalLaughLipDelta({t:(x-cx)/Math.max(halfWidth,1e-7),
    sign:sx,smile:s,open:o,cheek:c,width:halfWidth,
    height:size.y,depth:size.z});
   attr.array[k]=x+w*pose.dx;
   attr.array[k+1]=y+w*pose.dy;
   attr.array[k+2]=z+w*pose.dz;
  }else{
   // The male rig is outside this female v96 sculpt change.
   const t=(x-cx)/Math.max(halfWidth,1e-7);
   const arch=Math.pow(Math.max(0,1-Math.min(1,t*t)),.52);
   const smileLift=(Math.abs(t)**1.8)*(size.y*.0075*s+size.y*.002*c);
   const opening=arch*size.y*.042*o*(sx>=0?.24:.76);
   attr.array[k]=x+(x-cx)*.51*s*w;
   attr.array[k+1]=y+w*(smileLift+(sx>=0?opening:-opening));
   attr.array[k+2]=z-size.z*.0017*o*w;
  }
 }
 attr.needsUpdate=true;
 if(active){
  const wallAttr=wall.geometry.getAttribute('position');
  for(let j=0;j<boundary.length;j++){
   const i=boundary[j],k=i*3,p=j*3,q=(j+boundary.length)*3,
    inner=(j+boundary.length*2)*3;
   const x=attr.array[k],y=attr.array[k+1],z=attr.array[k+2];
   wallAttr.array[p]=x;wallAttr.array[p+1]=y;wallAttr.array[p+2]=z;
   // Outer -> transitional mucosal ring (same ordered index cycle).
   wallAttr.array[q]=cx+(x-cx)*.88;
   wallAttr.array[q+1]=cy+(y-cy)*.92;
   wallAttr.array[q+2]=z-size.z*.033;
   // Transition -> darker inner oral wall: C1-tapered rather than
   // an opaque floating disc in front of the teeth.
   wallAttr.array[inner]=cx+(x-cx)*.69;
   wallAttr.array[inner+1]=cy+(y-cy)*.72;
   wallAttr.array[inner+2]=z-size.z*.081;
  }
  wallAttr.needsUpdate=true;
  wall.geometry.computeVertexNormals();
  wall.geometry.computeBoundingSphere();
 }
 wall.visible=active;
 r.lastOpen=o;
 r.g.computeVertexNormals();
 r.g.computeBoundingSphere();
 // V53 hair scalp clipping creates a NONINDEXED render clone. Native FACS
 // and donor oral articulation use the ORIGINAL indexed head. Mirror the
 // changed skin vertices into that render clone, preserving UV/RGB attributes,
 // and hide the original v86 seal cap triangles when the jaw opens.
 const render=face.geometry,mapping=render?._v88SourceIndex;
 if(render!==r.g&&mapping&&mapping.length===render.getAttribute('position')?.count){
  const visible=render.getAttribute('position'),original=r.attr;
  for(let i=0;i<mapping.length;i++){
   const j=mapping[i];
   if(j<0)continue; // scalp intersection vertices are outside the face
   visible.setXYZ(i,original.getX(j),original.getY(j),original.getZ(j));
  }
  visible.needsUpdate=true;
  const capStart=render._v88CapStart??mapping.length;
  // V94: scalp clipping creates a *nonindexed* visible face clone. Hiding
  // original inner-mouth triangles in the source index buffer alone does
  // not hide them in that render clone. Rebuild the draw indices once and
  // switch back reversibly when the lips close.
  if(r.removedOriginalTriKeys.size){
   if(!render._v94OpenDrawIndex){
    const out=[];let removed=0;
    for(let k=0;k+2<capStart;k+=3){
     const ids=[mapping[k],mapping[k+1],mapping[k+2]];
     const key=ids.every(id=>id>=0)?
      ids.slice().sort((u,v)=>u-v).join('/'):null;
     if(key&&r.removedOriginalTriKeys.has(key)){removed++;continue;}
     out.push(k,k+1,k+2);
    }
    render._v94OpenDrawIndex=out;
    render._v94SavedGroups=render.groups.map(v=>({...v}));
    render._v94RemovedDrawTriangles=removed;
    face.userData.v94HiddenRenderTriangles=removed;
   }
   if(active&&!render._v94RenderOpen){
    render.setIndex(render._v94OpenDrawIndex);
    render.clearGroups();render.addGroup(0,render._v94OpenDrawIndex.length,0);
    render._v94RenderOpen=true;
   }else if(!active&&render._v94RenderOpen){
    render.setIndex(null);
    render.clearGroups();
    for(const group of render._v94SavedGroups)
     render.addGroup(group.start,group.count,group.materialIndex);
    render._v94RenderOpen=false;
   }
   render.setDrawRange(0,active?render._v94OpenDrawIndex.length:mapping.length);
  }else render.setDrawRange(0,active?capStart:mapping.length);
  render.computeBoundingSphere();
 }
 face.userData.v88CurrentMouthOpening=o;
 return true;
}

export function getNativeOralRigReport(face){
 const r=rigs.get(face);
 return r?{...face.userData.v88NativeOralRig,opened:r.isOpen,
  opening:r.lastOpen,teethOccludedWhenClosed:!r.isOpen}:null;
}
