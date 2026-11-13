/**
 * Anatomical contour loft for the bestiary's sculpted monster heads and torsos.
 * Avoids the identical scaled spheres that make vampire/mummy models read as
 * cartoons. Smooth normals, UVs, deterministic wrinkle relief and bounded LOD.
 * Geometry only; no model loaders, network access or animation-side allocations.
 */
import * as THREE from 'three';
import {sculptVerticalFacePoint} from './creature-face-volume.js';

const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const interpolate=(a,b,t)=>a+(b-a)*t;
const gauss=(v,center,width)=>{
 const u=(v-center)/width;
 return Math.exp(-u*u*2.3);
};
const poseAt=(rings,y)=>{
 let i=0;
 while(i<rings.length-2&&y>rings[i+1].y)i++;
 const a=rings[i],b=rings[i+1];
 const q=clamp((y-a.y)/(b.y-a.y),0,1);
 const t=q*q*(3-2*q);
 return {
  rx:interpolate(a.rx,b.rx,t),
  rz:interpolate(a.rz,b.rz,t),
  cx:interpolate(a.cx??0,b.cx??0,t),
  cz:interpolate(a.cz??0,b.cz??0,t),
 };
};
/**
 * The front of each specimen is +Z. Each point of the face ring uses
 * anatomically modest orbital depression / zygoma projection / nasal bridge.
 * Shape features are geometry, not oversized button eyes or emissive stickers.
 */
export function createMonsterAnatomicalLoft(rings,{
 detail='high',kind='torso',asymmetry=0,faceVolume=null,
}={}){
 if(!Array.isArray(rings)||rings.length<3 ||
   rings.some((r,i)=>!Number.isFinite(r.y)||!Number.isFinite(r.rx)||
     !Number.isFinite(r.rz)||r.rx<=0||r.rz<=0||
     (i>0&&r.y<=rings[i-1].y)))
   throw Error('Loft requires three+ ascending positive anatomical rings');
 const steps=detail==='source'?72:detail==='high'?44:18;
 const around=detail==='source'?56:detail==='high'?40:16;
 const positions=[],uv=[],indices=[];
 const ymin=rings[0].y,ymax=rings[rings.length-1].y;
 for(let row=0;row<=steps;row++){
  const v=row/steps,y=interpolate(ymin,ymax,v),r=poseAt(rings,y);
  for(let col=0;col<=around;col++){
   const u=col/around,angle=u*Math.PI*2;
   const side=Math.sin(angle),front=Math.cos(angle);
   let x=r.cx+r.rx*side,z=r.cz+r.rz*front;
   if(kind==='face'){
    const faceFront=Math.pow(Math.max(0,front),3.8);
    // Nose bridge near sagittal midline, with a pinched tip and alar foot.
    const nose=gauss(y,-.045,.091)*gauss(side,0,.27);
    // Deep orbit beneath the supraorbital shelf; avoid separate toy eyeballs.
    const orbit=gauss(y,.058,.066)*gauss(Math.abs(side),.49,.27);
    const brow=gauss(y,.144,.045)*gauss(Math.abs(side),.46,.37);
    const zygoma=gauss(y,-.035,.077)*gauss(Math.abs(side),.70,.20);
    const mouth=gauss(y,-.166,.037)*gauss(side,0,.45);
    z+=faceFront*(.050*nose-.024*orbit+.017*brow+
      .019*zygoma+.012*mouth);
    // Mummy skulls have a sharper malar ridge, not larger eyeballs.
    x+=(Math.sign(side)*.013)*gauss(y,-.028,.076)*
      gauss(Math.abs(side),.73,.22);
   }else if(kind==='torso'){
    // Subtle pectoral/ribcage relief, asymmetric enough to look organic.
    const chest=gauss(y,1.57,.24);
    z+=.020*Math.pow(Math.max(0,front),4)*chest*
      (1-.17*gauss(side,0,.22));
    const navel=gauss(y,1.16,.035)*gauss(side,0,.15);
    z-=.008*Math.max(0,front)*navel;
   }
   if(kind==='face'&&faceVolume){
    [x,,z]=sculptVerticalFacePoint(x,y,z,v,side,front,faceVolume);
   }
   if(asymmetry){
    const fine=(Math.sin(y*59.1+angle*5.7)+
       .52*Math.cos(y*81.3-angle*11.2))*.0026*asymmetry;
    x+=side*fine;z+=front*fine;
   }
   positions.push(x,y,z);uv.push(u,v);
  }
 }
 for(let row=0;row<steps;row++)for(let col=0;col<around;col++){
  const a=row*(around+1)+col,b=a+around+1;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);
 geo.computeVertexNormals();
 geo.computeBoundingSphere();
 geo.userData={kind:'realistic-anatomical-loft',anatomy:kind,
   profileRings:rings.length,detail,faceVolumeApplied:kind==='face'&&!!faceVolume};
 return geo;
}
export const MORTAL_HEAD_RINGS=Object.freeze([
 {y:-.325,rx:.043,rz:.065,cz:.100},
 {y:-.285,rx:.105,rz:.110,cz:.095},
 {y:-.230,rx:.152,rz:.166,cz:.048},
 {y:-.155,rx:.197,rz:.198,cz:.018},
 {y:-.060,rx:.238,rz:.222,cz:0},
 {y:.025,rx:.257,rz:.241,cz:-.010},
 {y:.105,rx:.247,rz:.239,cz:-.023},
 {y:.208,rx:.235,rz:.231,cz:-.028},
 {y:.284,rx:.162,rz:.166,cz:-.035},
 {y:.340,rx:.035,rz:.050,cz:-.031},
]);
export const MORTAL_TORSO_RINGS=Object.freeze([
 {y:.75,rx:.145,rz:.135,cz:-.025},
 {y:.85,rx:.285,rz:.222,cz:-.018},
 {y:1.01,rx:.338,rz:.257,cz:.005},
 {y:1.18,rx:.260,rz:.210,cz:0},
 {y:1.34,rx:.298,rz:.235,cz:0},
 {y:1.52,rx:.375,rz:.269,cz:-.020},
 {y:1.68,rx:.392,rz:.245,cz:-.013},
 {y:1.82,rx:.340,rz:.212,cz:.007},
 {y:1.91,rx:.185,rz:.155,cz:.012},
 {y:1.97,rx:.090,rz:.091,cz:.025},
]);
