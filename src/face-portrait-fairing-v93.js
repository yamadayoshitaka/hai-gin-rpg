import * as THREE from 'three';

/**
 * V93: conservative fairing on the owned 5k-vertex donor head.
 * Existing v91 edits produced a skull-like lower cheek and doubled sharp
 * nasal planes on young women, even when all black-pixel tests passed.
 *
 * Run once after age/slider sculpt, before eye aperture and mouth setup.
 * Never touch the source GLB, rear skull, ear, lip boundary or original UV.
 * Only adjust the Z component; original silhouette and expression landmarks
 * stay in exactly the same XY locations.
 */
export function fairYoungPortraitSurface(geometry,{gender='female',ageWrinkles=0,ageBand='twenties',bodyType='normal',cheekContourMode='v101'}={}){
 const p=geometry?.getAttribute?.('position'),index=geometry?.getIndex?.();
 if(!p||!index||p.count<80||index.count<90)
  return {applied:false,reason:'missing-owned-indexed-face'};
 if(gender!=='female')
  return {applied:false,reason:'male-unchanged'};
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,d=box.getSize(new THREE.Vector3());
 if(Math.min(d.x,d.y,d.z)<1e-5)return {applied:false,reason:'invalid-bounds'};
 const youth=THREE.MathUtils.clamp(1-(Number(ageWrinkles)||0)*1.7,0,1);
 if(youth<.02)return {applied:false,reason:'mature-age-relief-preserved'};
 const cx=(box.min.x+box.max.x)*.5;
 const src=p.array.slice(),nextZ=new Float32Array(p.count);
 const links=Array.from({length:p.count},()=>new Set());
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
  if(a>=p.count||b>=p.count||c>=p.count)continue;
  links[a].add(b);links[a].add(c);
  links[b].add(a);links[b].add(c);
  links[c].add(a);links[c].add(b);
 }
 const bell=(a,c,w)=>Math.exp(-.5*Math.pow((a-c)/w,2));
 const smooth=(lo,hi,v)=>THREE.MathUtils.smoothstep(v,lo,hi);
 let count=0,maxMove=0,meanMove=0;
 const touched=new Uint8Array(p.count);
 const weights=new Float32Array(p.count),lifts=new Float32Array(p.count);
 const ratio=bodyType==='ultraThin'?1.09:bodyType==='thin'?1:.76;
 const childCheek=ageBand==='under10'?1.16:1;
 for(let i=0;i<p.count;i++){
  const x=src[i*3],y=src[i*3+1],z=src[i*3+2];
  const ax=Math.abs((x-cx)/(d.x*.5)),ny=(y-box.min.y)/d.y;
  const front=smooth(.55,.82,(z-box.min.z)/d.z);
  // The actual severe hollow in the v92 screenshot is HIGH on the cheek
  // (between lower lid and alar wing), not only at the lower jaw. Support
  // the midface independently without swelling the eyelid or nasal bridge.
  const upperCheek=smooth(.30,.42,ax)*(1-smooth(.79,.91,ax))*
   bell(ax,.52,.18)*bell(ny,.574,.076)*front;
  const lowerCheek=smooth(.19,.32,ax)*(1-smooth(.76,.90,ax))*
   bell(ax,.49,.21)*bell(ny,.454,.090)*front;
  // Restore the inner malar pad alongside the nose with a gradual fade.
  const innerMalar=smooth(.17,.27,ax)*(1-smooth(.60,.74,ax))*
   bell(ax,.35,.16)*bell(ny,.564,.088)*front;
  const oralSafe=1-bell(ax,.15,.085)*bell(ny,.509,.042);
  const eyeSafe=1-bell(ax,.34,.23)*bell(ny,.685,.058);
  const faceField=(upperCheek*.78+lowerCheek*.49+
   innerMalar*.82)*oralSafe*eyeSafe;
  // v101: the 20s reference had an isolated malar high point, with a
  // depression immediately below it. Replace the upper/inner Gaussian bump
  // with an overlapping, wider mid/lower-cheek field. Fade the CHANGE in
  // from the lateral nasal region, so the v100 nose tip and nostril contour
  // remain untouched. Keep the legacy path for geometric A/B regression.
  const broadMid=smooth(.29,.39,ax)*(1-smooth(.69,.83,ax))*
   bell(ax,.48,.26)*bell(ny,.507,.120)*front;
  const midSupport=(
   .014*upperCheek+
   .046*lowerCheek+
   .013*innerMalar+
   .020*broadMid
  )*oralSafe*eyeSafe;
  const legacySupport=(
   .054*upperCheek+
   .030*lowerCheek+
   .042*innerMalar
  )*oralSafe*eyeSafe;
  // A strict facial-zone guard: nose (x<.28), lip edge and orbital rim
  // have identical v100 positions. Outer cheek/ear and jaw also remain.
  const transition=smooth(.285,.388,ax)*(1-smooth(.715,.84,ax))*
   smooth(.404,.485,ny)*(1-smooth(.638,.695,ny));
  const cheekBlend=cheekContourMode==='v100'?0:transition;
  // Smooth alar sidewalls carefully to remove the black triangular ledges,
  // while preserving real donor nostril openings and nose-tip landmarks.
  const nostrilSafe=1-bell(ax,.14,.09)*bell(ny,.526,.018);
  const noseWall=bell(ax,.17,.085)*bell(ny,.591,.060)*front*nostrilSafe;
  const noseAlar=bell(ax,.135,.045)*bell(ny,.550,.024)*front;
  const broadField=(upperCheek*.27+lowerCheek*.78+
   innerMalar*.23+broadMid*.92)*oralSafe*eyeSafe;
  const contourField=faceField+(broadField-faceField)*cheekBlend;
  weights[i]=Math.min(.94,youth*(contourField*.86+noseWall*.17+noseAlar*.11));
  lifts[i]=youth*d.z*ratio*childCheek*(
   legacySupport+(midSupport-legacySupport)*cheekBlend+
   .0025*noseAlar);
 }
 // Smooth only close triangulated neighbors; no cross-mouth interpolations.
 const maxDistance=d.x*.105;
 for(let pass=0;pass<3;pass++){
  for(let i=0;i<p.count;i++){
   const w=weights[i],at=i*3;
   if(w<.001){nextZ[i]=p.getZ(i);continue;}
   let sum=0,total=0;
   for(const j of links[i]){
    const bx=src[j*3]-src[at],by=src[j*3+1]-src[at+1];
    const dist=Math.hypot(bx,by);
    if(dist>maxDistance)continue;
    const b=1/(dist+d.x*.004);
    sum+=p.getZ(j)*b;total+=b;
   }
   const z=p.getZ(i);
   nextZ[i]=total?z+w*.55*(sum/total-z):z;
  }
  for(let i=0;i<p.count;i++)p.setZ(i,nextZ[i]);
 }
 for(let i=0;i<p.count;i++){
  const dz=lifts[i],w=weights[i];
  if(w<.001&&dz<.000001)continue;
  // Keep the true lip edge & donor point indices untouched.
  const old=src[i*3+2],z=p.getZ(i)+dz;
  const bounded=THREE.MathUtils.clamp(z,old-d.z*.010,old+d.z*.094);
  const change=Math.abs(bounded-old);
  if(change>1e-8){p.setZ(i,bounded);touched[i]=1;count++;meanMove+=change;
   maxMove=Math.max(maxMove,change);}
 }
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.v93CheekNoseFairing=true;
 geometry.userData.v97ContinuousInnerMalarSupport=true;
 geometry.userData.v97ChildCheekSupport=ageBand==='under10';
 geometry.userData.v93PortraitFairingVertices=count;
 geometry.userData.v101BroadCheekContour=cheekContourMode!=='v100';
 return {applied:true,vertices:count,maxMove,meanMove:count?meanMove/count:0,
  ageProtected:youth<1,onlyDepthAdjusted:true,originalSourceUntouched:true,
  cheekContourMode,nonNasalContourBlended:cheekContourMode!=='v100'};
}
