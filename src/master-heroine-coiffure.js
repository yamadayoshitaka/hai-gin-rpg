import * as THREE from 'three';

/**
 * Reference-driven heroine coiffure for the ACTUAL Blender Studio female
 * head: brushed-back crown, restrained flyaways, and a low nape bun.
 *
 * This is editable Three.js geometry, not an AI image or a purchased scan.
 * Meshes are expressed in the original CC0 head's source-local coordinates,
 * then fitted through the already measured scalp transform. The source GLBs
 * and the licensed donor-hair meshes are never altered.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fract=n=>n-Math.floor(n);
const hash=n=>fract(Math.sin(n*91.743+17.31)*43758.5453);
const blend=(a,b,t)=>a+(b-a)*t;
const v=(x,y,z)=>new THREE.Vector3(x,y,z);

export function buildReferenceHeroineHair(scalp,{style='swept-low-bun'}={}){
 if(style!=='swept-low-bun')throw Error('Unknown authored heroine hairstyle');
 const g=scalp?.geometry,p=g?.getAttribute('position'),mask=g?.getAttribute('color');
 const normals=g?.getAttribute('normal');
 if(!p||!mask||!normals||p.count<900)
  throw Error('Real sampled female head scalp with normals is required');
 if(mask.itemSize<4)throw Error('Scalp hairline alpha is required');
 g.computeBoundingBox();
 const b=g.boundingBox,d=b.getSize(new THREE.Vector3());
 if(d.x<.1||d.y<.1||d.z<.07)throw Error('Real source head bounds invalid');
 const cx=(b.min.x+b.max.x)*.5,cz=(b.min.z+b.max.z)*.5;
 const material=new THREE.MeshStandardMaterial({
  color:0x423027,vertexColors:true,roughness:.76,metalness:0,
  side:THREE.DoubleSide
 });
 const hair=new THREE.Group();
 hair.name='REFERENCE_HEROINE_BRUSHED_BACK_LOW_BUN';
 hair.matrixAutoUpdate=false;
 hair.matrix.copy(scalp.matrix);
 const coords=[],norms=[],alpha=[],frontStarts=[];
 const tmp=new THREE.Vector3(),nm=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  if(mask.getW(i)<.80)continue;
  tmp.fromBufferAttribute(p,i);
  nm.fromBufferAttribute(normals,i).normalize();
  coords.push(tmp.clone());norms.push(nm.clone());alpha.push(mask.getW(i));
  const y=(tmp.y-b.min.y)/d.y,z=(tmp.z-b.min.z)/d.z;
  if(y>.73&&z>.47&&mask.getW(i)>.94)frontStarts.push(coords.length-1);
 }
 if(coords.length<150||frontStarts.length<15)
  throw Error('Hairline-to-crown anchors absent from female source head');
 const cell=Math.max(.007,d.x/35);
 const map=new Map();
 const key=(x,y,z)=>x+','+y+','+z;
 const cellAt=q=>[Math.floor(q.x/cell),Math.floor(q.y/cell),Math.floor(q.z/cell)];
 for(let i=0;i<coords.length;i++){
  const [x,y,z]=cellAt(coords[i]),k=key(x,y,z);
  if(!map.has(k))map.set(k,[]);
  map.get(k).push(i);
 }
 function nearest(q){
  const [ix,iy,iz]=cellAt(q);
  let best=-1,ds=Infinity;
  for(let a=-2;a<=2;a++)for(let bb=-2;bb<=2;bb++)for(let c=-2;c<=2;c++){
   const bucket=map.get(key(ix+a,iy+bb,iz+c));
   if(!bucket)continue;
   for(const j of bucket){
    const score=coords[j].distanceToSquared(q);
    if(score<ds){ds=score;best=j;}
   }
  }
  return best<0?null:{point:coords[best],normal:norms[best],distance:Math.sqrt(ds)};
 }
 const pts=[],tri=[],tone=[];
 let strands=0,flowStreaks=0,maxSegment=0;
 function ribbon(path,width,seed){
  if(path.length<3||path.some(q=>![q.x,q.y,q.z].every(Number.isFinite)))return;
  // A narrow frontal scalp band can still cross the upper lids. Discard
  // those strands rather than silently reporting safe eye clearance.
  if(path.some(q=>(q.z-b.min.z)/d.z>.70&&
    (q.y-b.min.y)/d.y<.70))return;
  for(let j=1;j<path.length;j++){
   const length=path[j].distanceTo(path[j-1]);
   if(length>.014)throw Error('Hair strand jumped off female scalp: '+length);
   maxSegment=Math.max(maxSegment,length);
  }
  const start=pts.length/3;
  for(let j=0;j<path.length;j++){
   const q=path[j],before=path[Math.max(0,j-1)],
    after=path[Math.min(j+1,path.length-1)];
   const tangent=after.clone().sub(before).normalize();
   let normal=v(0,0,1);
   const info=nearest(q);
   if(info&&info.distance<.022)normal=info.normal;
   const perpendicular=new THREE.Vector3().crossVectors(tangent,normal).normalize();
   if(perpendicular.lengthSq()<.5)perpendicular.set(1,0,0);
   const t=j/(path.length-1),taper=Math.max(.12,Math.sin(Math.PI*(.06+.88*t)));
   const baseTone=.86+.06*hash(seed)+.018*Math.sin(seed*.2+j*.75);
   for(const side of [-1,1]){
    const xyz=q.clone().addScaledVector(perpendicular,side*width*taper);
    pts.push(xyz.x,xyz.y,xyz.z);
    const luminance=baseTone*(1+.06*side);
    tone.push(luminance,luminance*.92,luminance*.87);
   }
   if(j<path.length-1){
    const u=start+j*2;
    tri.push(u,u+1,u+2,u+1,u+3,u+2);
   }
  }
  strands++;
 }
 // Fine, coherent combed strands are projected back onto the original scalp.
 // Their path follows the actual sampled mesh instead of a floating wig shell.
 for(let i=0;i<coords.length;i++){
  if(i%2!==0||alpha[i]<.89)continue;
  const q=coords[i],n=norms[i];
  const relativeX=(q.x-cx)/Math.max(.01,d.x*.5);
  const dir=v(.25*Math.sign(relativeX||1),-.27,-1);
  dir.addScaledVector(n,-dir.dot(n)).normalize();
  if(dir.lengthSq()<.3)continue;
  const len=blend(.006,.014,hash(i*13.1));
  const path=[];
  for(let j=0;j<=6;j++){
   const t=j/6,arc=len*t;
   // A smoothly curving tangent path cannot jump to an unrelated triangle.
   // The previous nearest-vertex projection made 10cm spikes and grids.
   path.push(q.clone().addScaledVector(dir,arc)
    .addScaledVector(n,.0024+.00065*Math.sin(Math.PI*t)
     -(arc*arc)/(Math.max(.08,d.z)*2)*.20));
  }
  ribbon(path,blend(.00019,.00038,hash(i*4.3)),i);
 }
 // Long crown strands run away from the forehead, split naturally at a soft
 // off-centre part, and taper before the back of the scalp.
 for(let i=0;i<frontStarts.length;i+=2){
  const source=coords[frontStarts[i]];
  const nx=(source.x-cx)/Math.max(.01,d.x*.5),n=norms[frontStarts[i]];
  const direction=v(.27*Math.sign(nx+.12),-.10,-1);
  direction.addScaledVector(n,-direction.dot(n)).normalize();
  if(direction.lengthSq()<.2)continue;
  const len=blend(.012,.022,hash(i*17.4)),path=[];
  for(let j=0;j<=10;j++){
   const t=j/10;
   const arc=len*t;
   path.push(source.clone().addScaledVector(direction,arc)
    .addScaledVector(n,.003+.00065*Math.sin(t*Math.PI)
      -(arc*arc)/(Math.max(.08,d.z)*2)*.24));
  }
  ribbon(path,blend(.00028,.00057,hash(i+311)),i+2000);
  flowStreaks++;
 }
 if(strands<80||flowStreaks<7)throw Error('Female coiffure lacks source-anchored swept strands');
 const shell=new THREE.BufferGeometry();
 shell.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 shell.setAttribute('color',new THREE.Float32BufferAttribute(tone,3));
 shell.setIndex(tri);shell.computeVertexNormals();shell.computeBoundingSphere();
 const flow=new THREE.Mesh(shell,material);
 flow.name='FEMALE_REAL_HEAD_SWEPT_STRAND_GEOMETRY';
 flow.castShadow=true;flow.receiveShadow=false;
 hair.add(flow);

 // Low bun behind the RIGHT ear, not across the eyes or front cheeks.
 const bunCenter=v(cx+d.x*.06,b.min.y+d.y*.59,b.min.z+d.z*.018);
 const rx=d.x*.103,ry=d.y*.076,rz=d.z*.118;
 const bunMat=new THREE.MeshStandardMaterial({
  color:0x33231e,roughness:.77,metalness:0
 });
 const bun=new THREE.Mesh(new THREE.SphereGeometry(1,36,24),bunMat);
 bun.scale.set(rx,ry,rz);bun.position.copy(bunCenter);
 bun.castShadow=true;bun.name='REFERENCE_LOW_GATHERED_BUN_CORE';
 hair.add(bun);
 const knots=new THREE.Group();
 knots.name='REFERENCE_BUN_CONCENTRIC_HAIR_LOCKS';
 const lockMat=new THREE.MeshStandardMaterial({
  color:0x604337,roughness:.70,metalness:0,transparent:false
 });
 for(let k=0;k<21;k++){
  const t=k/21,offset=t*2*Math.PI;
  const points=[];
  for(let j=0;j<=18;j++){
   const angle=j/18*2*Math.PI+offset*.17;
   const radial=.50+.43*Math.sin(Math.PI*(j/18))*.9;
   const x=Math.cos(angle)*radial,y=Math.sin(angle)*radial;
   const z=Math.sqrt(Math.max(.02,1-x*x-y*y));
   points.push(v(bunCenter.x+rx*x,
    bunCenter.y+ry*y,
    bunCenter.z+rz*z+.0012));
  }
  const path=new THREE.CatmullRomCurve3(points,false,'centripetal');
  const thread=new THREE.Mesh(new THREE.TubeGeometry(path,36,.00045+d.x*.0011,4,false),
   lockMat);
  thread.name='BUN_COILED_HAIR_'+k;
  knots.add(thread);
 }
 hair.add(knots);
 // Side wisps leave the eye area clear and tuck behind the visible ear.
 const wispMat=new THREE.MeshStandardMaterial({color:0x423029,roughness:.73,metalness:0});
 for(let side of [-1,1]){
  for(let k=0;k<2;k++){
   const x=cx+side*d.x*(.42+.009*k),startY=b.min.y+d.y*(.79-.016*k);
   const path=new THREE.CatmullRomCurve3([
    v(x,startY,cz+d.z*.055),
    v(x+side*d.x*.015,startY-d.y*.025,cz-d.z*.035),
    v(x+side*d.x*.024,startY-d.y*.068,cz-d.z*.075),
    v(x+side*d.x*.030,startY-d.y*.095,cz-d.z*.090)
   ],false,'centripetal');
   const lock=new THREE.Mesh(new THREE.TubeGeometry(path,30,blend(.00035,.00075,hash(k+side*5)),5,false),wispMat);
   lock.name='TEMPLE_TUCKED_HAIR_'+side+'_'+k;hair.add(lock);
  }
 }
 const report=Object.freeze({
  authoredStyle:'swept-low-bun',originalCC0HeadUntouched:true,
  sourceAligned:true,sweptStrands:strands,flowStreaks,
  bunMeshes:22,templeWisps:4,
  maxStrandSegmentMeters:Number(maxSegment.toFixed(5)),
  bunCenterOffsetRatio:Number(((bunCenter.x-cx)/d.x).toFixed(3)),
  bunNormalizedHeight:Number(((bunCenter.y-b.min.y)/d.y).toFixed(3)),
  frontEyeZoneVertices:pts.reduce((count,n,j)=>j%3===0&&
      (pts[j+2]-b.min.z)/d.z>.72&&
      (pts[j+1]-b.min.y)/d.y<.68?count+1:count,0),
  scalpBoundsMeters:[d.x,d.y,d.z].map(n=>Number(n.toFixed(4))),
  noFaceSpanningCards:true,photoHairCertified:false,
  hairSimulationRigged:false
 });
 return {hair,report};
}
