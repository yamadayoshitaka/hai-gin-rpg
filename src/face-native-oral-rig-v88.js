import * as THREE from 'three';

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
 const cy=face.userData.actualMouthCreaseY??box.min.y+size.y*.509;
 const xs=boundary.map(i=>attr.getX(i)),ys=boundary.map(i=>attr.getY(i));
 const halfWidth=(Math.max(...xs)-Math.min(...xs))*.5;
 if(halfWidth<size.x*.025||halfWidth>size.x*.25||
    Math.abs(ys.reduce((a,b)=>a+b,0)/ys.length-cy)>size.y*.11)
  return {ready:false,reason:'oral-rim-outside-landmark'};
 const closedIndices=Array.from(index.array),originalCount=seal.initialTriangleCount*3;
 if(originalCount<=0||originalCount>=closedIndices.length)
  return {ready:false,reason:'unverified-native-cap-indices'};
 const openedIndices=closedIndices.slice(0,originalCount);
 const n=boundary.length,position=new Float32Array(n*2*3),color=new Float32Array(n*2*3);
 const triangles=[];
 for(let i=0;i<n;i++){
  const j=(i+1)%n;
  triangles.push(i,j,n+j,i,n+j,n+i);
  const t=i*3,u=(n+i)*3;
  color.set([.68,.29,.32],t);
  color.set([.24,.085,.10],u);
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
  weights[i]=Math.pow(Math.max(0,1-smooth(.78,1.50,normalizedX)),1.3)*
   (1-smooth(.008,.035,ny))*smooth(.52,.78,normFront);
  centerSign[i]=Math.tanh((y-cy)/(size.y*.0035));
 }
 const rig={face,g,attr,boundary,closedIndices,openedIndices,
  size,cx,cy,halfWidth,wall,skinBase:original.slice(),
  weights,centerSign,isOpen:false,lastOpen:-1};
 rigs.set(face,rig);
 const status={ready:true,kind:'native-boundary-recessed-vestibule',
  boundaryVertices:n,originalTriangleCount:originalCount/3,
  neutralTriangleCount:closedIndices.length/3,
  donorOwned:true,reversible:true,oralMeshOverlays:false};
 face.userData.v88NativeOralRig=status;
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
  const t=(x-cx)/Math.max(halfWidth,1e-7);
  const arch=Math.pow(Math.max(0,1-Math.min(1,t*t)),.52);
  // Gently raise the real commissure without pinching the donor lip boundary.
   const smileLift=(Math.abs(t)**1.8)*(size.y*.0075*s+size.y*.002*c);
  // A laugh must reveal the native inside of the mouth, not a pursed slit.
   // Keep the lower lip moving farther than the upper; the donor stays watertight.
   const opening=arch*size.y*.042*o*(sx>=0?.24:.76);
  // Real commissures widen gently during laughter but never cross each other.
   // Widen the real oral commissures on a laugh; previous 0.15 only
  // exposed a small pinched slit under an otherwise broad smile.
  attr.array[k]=x+(x-cx)*.51*s*w;
  attr.array[k+1]=y+w*(smileLift+(sx>=0?opening:-opening));
  attr.array[k+2]=z-size.z*.0017*o*w;
 }
 attr.needsUpdate=true;
 if(active){
  const wallAttr=wall.geometry.getAttribute('position');
  for(let j=0;j<boundary.length;j++){
   const i=boundary[j],k=i*3,p=j*3,q=(j+boundary.length)*3;
   const x=attr.array[k],y=attr.array[k+1],z=attr.array[k+2];
   const t=clamp((x-cx)/Math.max(halfWidth,1e-7),-1,1);
   wallAttr.array[p]=x;wallAttr.array[p+1]=y;wallAttr.array[p+2]=z;
   wallAttr.array[q]=cx+(x-cx)*.73;
   wallAttr.array[q+1]=cy+(y-cy)*.78;
   wallAttr.array[q+2]=z-size.z*.070;
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
  render.setDrawRange(0,active?capStart:mapping.length);
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
