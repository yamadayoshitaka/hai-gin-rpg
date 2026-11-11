import * as THREE from 'three';

/**
 * Two independent head-only clay mesh prototypes from the CC0 male and female
 * Blender Studio heads. All work is performed on owned geometry clones.
 * No game body, outfit, source GLB, hair, makeup, or battle model is changed.
 */
const bell=(v,c,w)=>Math.exp(-.5*((v-c)/w)**2);
const smooth=(a,b,v)=>{
 const t=THREE.MathUtils.clamp((v-a)/(b-a),0,1);
 return t*t*(3-2*t);
};

export const FACE_MASTER_SPEC=Object.freeze({
 male:Object.freeze({
  code:'male-face-base-v1',label:'男性・美青年ベース',
  jawNarrow:.035,cheekFill:.023,chinLift:.006,
  noseBridge:.008,browRelief:.004,mouthRecess:.006,
  eyeSocketSoftness:.002
 }),
 female:Object.freeze({
  code:'female-face-base-v1',label:'女性・美人ベース',
  jawNarrow:.077,cheekFill:.053,chinLift:.019,
  noseBridge:.005,browRelief:.001,mouthRecess:.010,
  eyeSocketSoftness:.003
 })
});

export function makeIndependentFaceMaster(sourceRoot,gender){
 const spec=FACE_MASTER_SPEC[gender];
 if(!sourceRoot?.traverse||!spec)
  throw Error('Real CC0 head hierarchy and male/female gender required');
 const root=sourceRoot.clone(true);
 root.name=gender.toUpperCase()+'_FACE_MASTER_SOURCE_CLONE';
 let face=null,most=0;
 root.traverse(o=>{
  if(!o.isMesh)return;
  const n=o.geometry?.getAttribute('position')?.count||0;
  if(!/sclera|iris|pupil|eyelash|eyebrow|eyelid/i.test(o.name)&&n>most){
   face=o;most=n;
  }
  o.visible=false;
 });
 if(!face||most<1100)throw Error('No high-resolution original human face mesh');
 // Do not mutate the GLB geometry, even when the same source is used twice.
 const original=face.geometry;
 const geometry=original.clone();
 face.geometry=geometry;
 if(face.morphTargetInfluences)face.morphTargetInfluences.fill(0);
 geometry.computeBoundingBox();
 const b=geometry.boundingBox.clone();
 const d=b.getSize(new THREE.Vector3());
 if(d.x<.02||d.y<.02||d.z<.02)throw Error('Invalid real head geometry bounds');
 const p=geometry.getAttribute('position');
 const originalPoints=p.array.slice();
 const cx=(b.min.x+b.max.x)/2;
 let changed=0,cheekDelta=0,chinDelta=0;
 // A continuous low-amplitude sculpt, not many stacked portrait morphs.
 // Refill sunken cheeks and soften the jaw without shifting nose, scalp,
 // rear skull, or the neck attachment. Male retains slightly stronger brow.
 for(let i=0;i<p.count;i++){
  const x=originalPoints[i*3],y=originalPoints[i*3+1],z=originalPoints[i*3+2];
  const xn=(x-cx)/(d.x*.5),yn=(y-b.min.y)/d.y,zn=(z-b.min.z)/d.z;
  const front=smooth(.30,.68,zn);
  const neckLock=smooth(.12,.27,yn);
  const cheek=bell(Math.abs(xn),.52,.36)*bell(yn,.515,.135)*front*neckLock;
  const lowerCheek=bell(Math.abs(xn),.61,.32)*bell(yn,.415,.14)*front*neckLock;
  const jaw=bell(yn,.315,.15)*smooth(.21,.48,Math.abs(xn))*neckLock;
  const chin=bell(xn,0,.48)*bell(yn,.26,.14)*front*neckLock;
  const brow=bell(Math.abs(xn),.43,.23)*bell(yn,.755,.07)*front;
  const nose=bell(xn,0,.23)*bell(yn,.605,.10)*front;
  const mouth=bell(xn,0,.35)*bell(yn,.445,.055)*front;
  // All distances scale with the source head. Values are fractions of
  // head width / height / depth, not extra meshes glued onto the surface.
  const nx=x-(x-cx)*spec.jawNarrow*jaw
    +(x-cx)*(.018*cheek-.012*lowerCheek);
  const ny=y+d.y*spec.chinLift*chin;
  const nz=z+d.z*(spec.cheekFill*(.75*cheek+.45*lowerCheek)
    +spec.browRelief*brow+spec.noseBridge*nose
    -spec.mouthRecess*mouth
    +spec.eyeSocketSoftness*bell(Math.abs(xn),.43,.22)
      *bell(yn,.69,.055)*front);
  p.setXYZ(i,nx,ny,nz);
  if(Math.abs(nx-x)+Math.abs(ny-y)+Math.abs(nz-z)>1e-6)changed++;
  cheekDelta+=Math.max(0,nz-z)*cheek;
  chinDelta+=Math.abs(ny-y)*chin;
 }
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 face.material=new THREE.MeshStandardMaterial({
  color:0xbfc3cb,roughness:.84,metalness:0,
  side:THREE.FrontSide,flatShading:false
 });
 face.visible=true;
 face.name=gender.toUpperCase()+'_INDEPENDENT_CLAY_FACE';
 // Other donor eye or hair meshes stay invisible: only the face topology
 // is being judged. No detached eyes, eyelashes, mouth decals or wigs.
 const triangleCount=geometry.index?
  geometry.index.count/3:p.count/3;
 const report=Object.freeze({
  code:spec.code,gender,sourceVertices:most,
  triangles:triangleCount,modifiedVertices:changed,
  cheekVolumeMetric:Number((cheekDelta/p.count).toFixed(9)),
  chinSmoothMetric:Number((chinDelta/p.count).toFixed(9)),
  sourceUntouched:true,sourceGeometryIndependent:face.geometry!==original,
  headOnly:true,bodyUnchanged:true,hairVisible:false,makeupVisible:false,
  material:'neutral-gray-clay',artCertified:false
 });
 root.userData.faceMasterReport=report;
 root.updateMatrixWorld(true);
 return {root,face,report};
}
