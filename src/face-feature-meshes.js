import * as THREE from 'three';
import {normalizeFemaleFaceControls,normalizeMaleFaceControls,FACE_V7_PALETTE,MALE_REFERENCE_DEFAULT,safeContactColor} from './face-v7-controls.js';

/**
 * Actual face-only polygon meshes. No 2D decals, portrait planes or hair.
 * The underlying face surface (nose, cheek and philtrum) is sculpted by
 * independent-face-masters. These supplemental anatomical meshes are
 * projected into that same local coordinate system and parented to it:
 * two eyeballs, two sclera-facing iris/pupil pairs, four eyelid surfaces,
 * and two shallow, surface-conforming vermilion lip volumes.
 *
 * This is a 3D CLAY DRAFT, not a photogrammetry or animation-ready rig.
 */
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smoothstep=t=>{const q=clamp(t,0,1);return q*q*(3-2*q)};
const vertexMakeup=new WeakMap();
const orbitalRestPositions=new WeakMap();
function setVertexMakeup(mesh,rgb){
 mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
 mesh.material.vertexColors=true;mesh.material.needsUpdate=true;
 vertexMakeup.set(mesh.geometry,new Float32Array(rgb));
}
function colorizedMakeup(mesh,colored){
 const saved=vertexMakeup.get(mesh.geometry);
 if(!saved)return;
 const attribute=mesh.geometry.getAttribute('color');
 for(let i=0;i<saved.length;i++)attribute.array[i]=colored?saved[i]:1;
 attribute.needsUpdate=true;
}
function pigmentFactor(base,tint,opacity){
 return new THREE.Vector3(1+(tint.r/base.r-1)*opacity,
  1+(tint.g/base.g-1)*opacity,1+(tint.b/base.b-1)*opacity);
}
function buildGrid(name,columns,rows,point,material){
 const vertices=[],uv=[],indices=[];
 for(let j=0;j<=rows;j++){
  for(let i=0;i<=columns;i++){
   const u=i/columns,v=j/rows,p=point(u,v);
   vertices.push(p.x,p.y,p.z);uv.push(u,v);
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
  const k=j*(columns+1)+i;
  indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,material);
 mesh.name=name;mesh.renderOrder=2;
 return mesh;
}
function sampleGrid(mesh,columns,rows,u,v){
 const su=clamp(u,0,1)*columns,sv=clamp(v,0,1)*rows;
 const i=Math.min(columns-1,Math.floor(su)),j=Math.min(rows-1,Math.floor(sv));
 const a=su-i,b=sv-j,p=mesh.geometry.getAttribute('position');
 const vertex=(x,y)=>new THREE.Vector3().fromBufferAttribute(p,y*(columns+1)+x);
 return vertex(i,j).multiplyScalar((1-a)*(1-b))
  .addScaledVector(vertex(i+1,j),a*(1-b))
  .addScaledVector(vertex(i,j+1),(1-a)*b)
  .addScaledVector(vertex(i+1,j+1),a*b);
}
/** Stitch the two cosmetic eyelid bands at both eye corners in the
 * exact same mesh coordinate space, without detached makeup cards. */
function stitchLinerCorners(upper,lower,faceWidth,depth){
 const g=upper.geometry,vertices=Array.from(g.getAttribute('position').array);
 const uv=Array.from(g.getAttribute('uv').array);
 const index=Array.from(g.getIndex().array);
 for(const u of [0,1]){
  const a=sampleGrid(upper,28,3,u,0),b=sampleGrid(lower,28,3,u,0);
  const dx=(u===0?-1:1)*faceWidth*.0025;
  const dz=depth*.00024;
  const begin=vertices.length/3;
  for(const p of [a,b]){
   vertices.push(p.x,p.y,p.z+dz,p.x+dx,p.y,p.z+dz);
   uv.push(u,0,u,1);
  }
  index.push(begin,begin+1,begin+2,begin+2,begin+1,begin+3);
 }
 g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();
 upper.userData.eyelinerCornersClosed=true;
}
export function createAnatomicalFaceParts(face,{gender='female',controls={}}={}){
 if(!face?.isMesh||!['male','female'].includes(gender))
  throw Error('Sculpted face mesh and gender required for 3D facial parts');
 const settings=gender==='male'?normalizeMaleFaceControls(controls):
  normalizeFemaleFaceControls(controls);
 const geometry=face.geometry;
 geometry.computeBoundingBox();
 const box=geometry.boundingBox.clone(),d=box.getSize(new THREE.Vector3());
 if(d.x<.02||d.y<.02||d.z<.02)throw Error('No usable 3D face bounds');
 const cx=(box.min.x+box.max.x)*.5;
 const mat=color=>new THREE.MeshStandardMaterial({
  color,roughness:.89,metalness:0,side:THREE.DoubleSide
 });
 const lidMat=mat(0xbcbfc5),lipMat=mat(0xbfc3cb);
 const eyeMat=new THREE.MeshStandardMaterial({
  color:0xd5d8dd,roughness:.48,metalness:0
 });
 const irisMat=new THREE.MeshStandardMaterial({
  color:0x747a83,roughness:.55,metalness:0
 });
 const pupilMat=new THREE.MeshStandardMaterial({
  color:0x30353b,roughness:.43,metalness:0
 });
 const root=new THREE.Group();
 root.name=gender.toUpperCase()+'_ANATOMICAL_CLAY_FACE_PARTS';
 root.userData.headOnly=true;
 const surface=new THREE.Mesh(geometry,
  new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 surface.updateMatrixWorld(true);
 const ray=new THREE.Raycaster();
 const down=new THREE.Vector3(0,0,-1);
 const localVertices=geometry.getAttribute('position');
 let projected=0,projectionFallbacks=0;
 const surfaceAt=(x,y)=>{
  ray.set(new THREE.Vector3(x,y,box.max.z+d.z),down);
  ray.near=0;ray.far=d.z*4;
  const hits=ray.intersectObject(surface,false);
  if(hits.length){projected++;return hits[0].point.z;}
  // The surface is sparse around an open eye or mouth: only interpolate
  // inside the local face, never insert an arbitrary billboard plane.
  projectionFallbacks++;
  let best=Infinity,z=box.min.z;
  for(let i=0;i<localVertices.count;i++){
   const dx=localVertices.getX(i)-x,dy=localVertices.getY(i)-y;
   const dd=dx*dx+dy*dy;
   if(dd<best){best=dd;z=localVertices.getZ(i);}
  }
  return z;
 };
 const female=gender==='female';
 const eyeScale=settings.eyeSize;
 const originalIrisAngle=.585;
 const originalPupilAngle=.236;
 // A doubled requested projected diameter must remain on a sphere:
 // physical iris diameter is limited to 95.5% of the eye's diameter.
 const irisAngle=Math.asin(Math.min(.955,
  Math.sin(originalIrisAngle)*settings.irisDiameter));
 const pupilAngle=Math.asin(Math.min(.75,
  Math.sin(originalPupilAngle)*settings.irisDiameter));
 const eyeRadius=d.x*.052*eyeScale;
 const eyeHeight=box.min.y+d.y*.684;
 // Preserve the saved eye size, but move the sockets slightly toward
 // the true lateral face rather than burying the globe in the midface.
 const eyeSpacing=d.x*.123;
 const lateralEyeMargins=[];
 // Sclera centre is recessed. Upper and lower eyelids cover the spherical
 // edge, rather than drawing detached floating white eye disks.
 for(const side of [-1,1]){
  const firstChild=root.children.length;
  const x=cx+side*eyeSpacing,y=eyeHeight;
  const faceZ=surfaceAt(x,y);
  // Set globes into the socket but forward enough for the colored iris
  // to stay visible at oblique camera angles; not floating over the lids.
  // Real orbital geometry must remain in FRONT of the local head surface
  // at an oblique/profile camera angle, not only when viewed frontally.
  const z=faceZ+eyeRadius*.35;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(eyeRadius,36,24),eyeMat);
  globe.name=(side===-1?'LEFT':'RIGHT')+'_ORBITAL_EYEBALL';
  globe.scale.set(1.18,.79,.97);
  globe.userData.profileExposed=true;
  globe.position.set(x,y,z);
  globe.userData.sourceProjected=true;
  globe.userData.colorRole='sclera';
  root.add(globe);
  // Colored caps conform exactly to the SCULPTED ELLIPSOIDAL globe.
  // Previous undersized independent spheres were hidden behind the larger
  // white eyeball at a 45-degree camera angle.
  const makeCap=(label,angularRadius,material,raise)=>buildGrid(
   (side===-1?'LEFT':'RIGHT')+'_'+label,
   48,18,(u,v)=>{
    const az=u*Math.PI*2,theta=v*angularRadius;
    const sx=Math.sin(theta)*Math.cos(az);
    const sy=Math.sin(theta)*Math.sin(az);
    const sz=Math.cos(theta);
    return new THREE.Vector3(
     x+eyeRadius*1.18*sx,
     y+eyeRadius*.77*sy,
     z+eyeRadius*.97*sz+eyeRadius*raise
    );
   },material);
  irisMat.side=THREE.DoubleSide;pupilMat.side=THREE.DoubleSide;
  const iris=makeCap('CURVED_IRIS',irisAngle,irisMat,.024);
  iris.userData.colorRole='iris';root.add(iris);
  const pupil=makeCap('CURVED_PUPIL',pupilAngle,pupilMat,.031);
  pupil.userData.colorRole='pupil';root.add(pupil);
  // Profile ray margin: near-lateral cornea vs. actual sclera-skull
  // surface in the same head-local coordinates.
  const lateralX=x+side*eyeRadius*1.18*.86;
  const cornealZ=z+eyeRadius*.97*Math.sqrt(1-.86*.86);
  lateralEyeMargins.push(cornealZ-surfaceAt(lateralX,y));
  const width=eyeRadius*1.12;
  let upperEyeliner=null,lowerEyeliner=null;
  for(const upper of [true,false]){
   const label=(side===-1?'LEFT':'RIGHT')+(upper?'_UPPER':'_LOWER');
   const height=eyeRadius*.33;
   const mesh=buildGrid(label+'_ANATOMICAL_EYELID',28,4,(u,v)=>{
    const t=u*2-1,arch=Math.pow(Math.max(0,1-t*t),.73);
    const cornerTilt=(t+1)*eyeRadius*.045;
    const nearY=y+(upper?1:-1)*height*arch+cornerTilt;
    const farY=nearY+(upper?1:-1)*eyeRadius*(upper?.28:.19)*v;
    const globeZ=z+eyeRadius*(.71*Math.sqrt(Math.max(0,1-t*t))+.14);
    const skinZ=surfaceAt(x+t*width,farY)+d.z*.005;
    const zz=globeZ*(1-smoothstep(v))+skinZ*smoothstep(v);
    return new THREE.Vector3(x+t*width,farY,zz);
   },lidMat);
   mesh.userData.attachedToFace=true;
   mesh.userData.colorRole='eyelid';
   root.add(mesh);
   if(female){
    // Eyeliner shares the eye lid's actual surface and transformation.
    const linerMat=new THREE.MeshStandardMaterial({
     color:0x30252b,roughness:.84,metalness:0,side:THREE.DoubleSide,
     transparent:true,opacity:upper?.64:.53,depthWrite:false
    });
    const liner=buildGrid(label+'_EYELINER',28,3,(u,v)=>{
     const p=sampleGrid(mesh,28,4,u,.018+v*(upper?.064:.056));
     p.z+=Math.max(.00002,d.z*.00018);
     return p;
    },linerMat);
    liner.userData.colorRole='eyeliner';liner.userData.cosmetic=true;
    mesh.add(liner);
    if(upper)upperEyeliner=liner;else lowerEyeliner=liner;
   }
  }
  if(female)stitchLinerCorners(upperEyeliner,lowerEyeliner,d.x,d.z);
  if(female){
   // Two real 3D orbital surfaces per eye: a subtle upper-lid fold
   // (double eyelid) and a volume band directly under the lower lid.
   // Neither is a painted dark 'bag'; geometry supplies its own soft
   // highlight/occlusion when the head is rotated.
   const upperFold=buildGrid(
    (side===-1?'LEFT':'RIGHT')+'_DOUBLE_EYELID_FOLD',28,4,(u,v)=>{
     const t=2*u-1,soft=Math.pow(Math.max(0,1-t*t),.72);
     const yy=y+eyeRadius*(.58+.14*soft+.11*v);
     const xx=x+t*eyeRadius*1.15;
     const z=surfaceAt(xx,yy)+d.z*(.004+.0035*Math.sin(Math.PI*v)*soft);
     return new THREE.Vector3(xx,yy,z);
    },lidMat);
   upperFold.userData.anatomical='upper-lid-crease';
   upperFold.userData.colorRole='eyelid';
   root.add(upperFold);
   const accentMat=new THREE.MeshStandardMaterial({
    color:0x765458,roughness:.87,metalness:0,side:THREE.DoubleSide,
    transparent:true,opacity:.19,depthWrite:false
   });
   const accent=buildGrid((side===-1?'LEFT':'RIGHT')+'_EYE_ACCENT_LINE',
    28,2,(u,v)=>{
     const p=sampleGrid(upperFold,28,4,u,.19+.26*v);
     p.z+=Math.max(.00003,d.z*.00024);
     return p;
    },accentMat);
   accent.userData.colorRole='eyeAccent';accent.userData.cosmetic=true;
   upperFold.add(accent);
   const lowerVolume=buildGrid(
    (side===-1?'LEFT':'RIGHT')+'_LOWER_LID_VOLUME',28,5,(u,v)=>{
     const t=2*u-1,soft=Math.pow(Math.max(0,1-t*t),.80);
     const xx=x+t*eyeRadius*1.16;
     const yy=y-eyeRadius*(.50+.12*soft+.19*v);
     const z=surfaceAt(xx,yy)+d.z*(.003+
      .011*soft*Math.sin(Math.PI*v));
     return new THREE.Vector3(xx,yy,z);
    },lidMat);
   lowerVolume.userData.anatomical='lower-lid-fullness';
   lowerVolume.userData.colorRole='eyelid';
   root.add(lowerVolume);
   // Subtle actual under-eye cosmetic band; it shares the eye tilt pivot
   // with the double eyelid, lashes and brows.
   const shadowMat=new THREE.MeshStandardMaterial({
    color:0x60444e,transparent:true,opacity:.72,depthWrite:false,
    roughness:1,side:THREE.DoubleSide,vertexColors:true
   });
   const eyeShadow=buildGrid(
    (side===-1?'LEFT':'RIGHT')+'_UNDER_EYE_SHADOW',28,5,(u,v)=>{
     const t=2*u-1,soft=Math.pow(Math.max(0,1-t*t),.82);
     const xx=x+t*eyeRadius*.83;
     const yy=y-eyeRadius*(.65+.06*soft+.12*v);
     const zz=surfaceAt(xx,yy)+Math.max(.000025,d.z*.00025);
     return new THREE.Vector3(xx,yy,zz);
    },shadowMat);
   // Dark-but-feathered under-eye tone with transparent soft edges.
   const pigments=[];
   for(let j=0;j<=5;j++)for(let i=0;i<=28;i++){
    const u=i/28,v=j/5;
    const fade=Math.pow(Math.sin(Math.PI*u),.8)*
     Math.pow(Math.sin(Math.PI*v),.9);
    pigments.push(1,1,1,.66*fade);
   }
   eyeShadow.geometry.setAttribute('color',
    new THREE.Float32BufferAttribute(pigments,4));
   eyeShadow.userData.colorRole='underEye';
   eyeShadow.userData.feathered=true;
   root.add(eyeShadow);
  }
  if(female){
   const eyeLabel=side===-1?'LEFT':'RIGHT';
   const pivot=new THREE.Group();
   pivot.name=eyeLabel+'_BROW_ANGLE_CONTROL';
   const browY=y+eyeRadius*1.47;
   pivot.position.set(x,browY,surfaceAt(x,browY));
   pivot.userData.control='brow';
   pivot.userData.side=side;
   const eyebrow=buildGrid(eyeLabel+'_SCULPTED_EYEBROW',34,4,(u,v)=>{
    const t=2*u-1,arch=Math.pow(Math.max(0,1-t*t),.65);
    const xx=x+t*eyeRadius*1.37;
    const yy=browY+eyeRadius*.10*arch+(v-.5)*eyeRadius*.17*arch;
    const zz=surfaceAt(xx,yy)+d.z*(.011+.002*arch);
    return new THREE.Vector3(xx-pivot.position.x,yy-pivot.position.y,
     zz-pivot.position.z);
   },mat(0xa2a6ac));
   eyebrow.userData.colorRole='brow';
   pivot.add(eyebrow);root.add(pivot);

   const lashPivot=new THREE.Group();
   lashPivot.name=eyeLabel+'_LASH_ANGLE_CONTROL';
   lashPivot.position.set(x,y,z);
   lashPivot.userData.control='lashes';
   lashPivot.userData.side=side;
   for(const upper of [true,false]){
    const lash=buildGrid(eyeLabel+(upper?'_UPPER':'_LOWER')+'_LASH_MESH',
     34,3,(u,v)=>{
      const t=2*u-1,arch=Math.pow(Math.max(0,1-t*t),.76);
      const xx=x+t*width;
      const lidY=y+(upper?1:-1)*eyeRadius*(upper?.33:.29)*arch;
      const yy=lidY+(upper?1:-1)*v*eyeRadius*(upper?.20:.085)*arch;
      const zz=surfaceAt(xx,lidY)+d.z*(.010+.010*v*arch);
      return new THREE.Vector3(xx-lashPivot.position.x,
       yy-lashPivot.position.y,zz-lashPivot.position.z);
     },mat(0x8c929a));
    lash.userData.colorRole='lashes';
    lashPivot.add(lash);
   }
   root.add(lashPivot);
  }else{
   // The male is generated from the same smooth head, with a naturally
   // smaller eye and no liner/mascara/under-eye cosmetic layers.
   const pivot=new THREE.Group();
   const label=side===-1?'LEFT':'RIGHT';
   pivot.name=label+'_BROW_ANGLE_CONTROL';
   const browY=y+eyeRadius*1.56;
   pivot.position.set(x,browY,surfaceAt(x,browY));
   const brow=buildGrid(label+'_NATURAL_MALE_BROW',30,4,(u,v)=>{
    const t=2*u-1,arch=Math.pow(Math.max(0,1-t*t),.72);
    const xx=x+t*eyeRadius*1.37;
    const yy=browY+eyeRadius*.035*arch+
      (v-.5)*eyeRadius*.23*arch;
    const zz=surfaceAt(xx,yy)+d.z*.010;
    return new THREE.Vector3(xx-pivot.position.x,
      yy-pivot.position.y,zz-pivot.position.z);
   },mat(0xa2a6ac));
   brow.userData.colorRole='brow';
   pivot.add(brow);root.add(pivot);
  }
  // Move all eye-specific components into a joint local pivot. An angle
  // change now rotates the eyeball, lids, under-eye band, brows and lashes
  // together, not detached individual painted strips.
  const eyeJoint=new THREE.Group();
  eyeJoint.name=(side===-1?'LEFT':'RIGHT')+'_EYE_LINKED_PIVOT';
  eyeJoint.position.set(x,y,z);
  const origin=eyeJoint.position.clone();
  const children=root.children.slice(firstChild);
  for(const child of children){
   root.remove(child);
   if(child.isMesh){
    if(child.userData.sourceProjected)child.position.sub(origin);
    else child.traverse(o=>{
     // Nested eyeliner/accent child geometry must be moved with the lid.
     if(o.isMesh)o.geometry.translate(-x,-y,-z);
    });
   }else child.position.sub(origin);
   eyeJoint.add(child);
  }
  root.add(eyeJoint);
 }
 // Pigment on the source-derived head vertices, not hovering face quads.
 if(female){
  const skin=new THREE.Color(FACE_V7_PALETTE.skin);
  const tint=new THREE.Color(FACE_V7_PALETTE.blush);
  const colors=[],positions=face.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
   const x=Math.abs((positions.getX(i)-cx)/d.x);
   const y=(positions.getY(i)-box.min.y)/d.y;
   const z=(positions.getZ(i)-box.min.z)/d.z;
   const front=smoothstep((z-.57)/.20);
   const strength=.43*bell(x,.265,.105)*bell(y,.535,.056)*front;
   const rgb=pigmentFactor(skin,tint,strength);
   colors.push(rgb.x,rgb.y,rgb.z);
  }
  setVertexMakeup(face,colors);
 }
 // Original face remains the structural muzzle/philtrum/chin. Two shallow
 // lip strips follow that actual surface and use real triangle thickness.
 // Avoid a single flat 'mouth plate' or pigment printed on the chin.
 // Re-anchor the upper and lower vermilion to the source head's real
 // central mouth groove, within a narrow safe window around the source.
 const nominalMouthY=box.min.y+d.y*.509;
 let lipCenter=nominalMouthY,bestCrease=.0015*d.z;
 for(let k=-11;k<=11;k++){
  const y=nominalMouthY+d.y*k*.001;
  const crease=(surfaceAt(cx,y-d.y*.003)+surfaceAt(cx,y+d.y*.003))/2-
   surfaceAt(cx,y);
  if(crease>bestCrease){bestCrease=crease;lipCenter=y;}
 }
 const halfWidth=d.x*.044;
 const actualLips=new Map();
 for(const upper of [true,false]){
  const material=female?lipMat.clone():lipMat;
  const mesh=buildGrid((upper?'UPPER':'LOWER')+'_3D_VERMILION_LIP',
   32,8,(u,v)=>{
    const t=u*2-1;
    const taper=Math.pow(Math.max(0,1-t*t),.70);
    const cupid=upper?
      d.y*.0018*(bell(Math.abs(t),.37,.22)-.42*bell(t,0,.23)):0;
    const cy=lipCenter+(upper?d.y*.009:-d.y*.009)+cupid;
    const vertical=(v-.5)*d.y*(upper?.012:.015)*taper;
    const x=cx+t*halfWidth,y=cy+vertical;
    const fullness=(1-t*t)*Math.sin(Math.PI*v);
    const z=surfaceAt(x,y)+d.z*(.0009+.002*fullness*taper);
    return new THREE.Vector3(x,y,z);
   },material);
  mesh.userData.faceSurfaceConforming=true;
  mesh.userData.colorRole='lipBase';
  actualLips.set(upper,mesh);
  root.add(mesh);
 }
 // Lip color is vertex pigment on the SAME triangles as each actual lip.
 // There is no separate lipstick geometry that can slide onto the jaw.
 if(female)for(const upper of [true,false]){
  const lip=actualLips.get(upper);
  const natural=new THREE.Color(0xd9a699);
  const makeup=new THREE.Color(FACE_V7_PALETTE.lipstick);
  const shiftU=clamp(settings.lipstickX/.12,-1,1)*.23;
  const shiftV=clamp(settings.lipstickY/.12,-1,1)*.23;
  const extentU=settings.lipstickWidth*.50,extentV=settings.lipstickHeight*.50;
  const colors=[];
  for(let j=0;j<=8;j++)for(let i=0;i<=32;i++){
   const u=i/32,v=j/8;
   const fadeU=smoothstep((u-(.5+shiftU-extentU))/.09)*
    smoothstep(((.5+shiftU+extentU)-u)/.09);
   const fadeV=smoothstep((v-(.5+shiftV-extentV))/.12)*
    smoothstep(((.5+shiftV+extentV)-v)/.12);
   const rgb=pigmentFactor(natural,makeup,.83*fadeU*fadeV);
   colors.push(rgb.x,rgb.y,rgb.z);
  }
  setVertexMakeup(lip,colors);
  lip.userData.lipstickOnSameTriangles=true;
  lip.userData.lipstickCoverage={x:settings.lipstickX,y:settings.lipstickY,
   width:settings.lipstickWidth,height:settings.lipstickHeight};
 }
 // Male-only real 3D filaments, rooted in the same head surface and
 // re-generated if facial proportions or beard sliders change.
 if(!female){
  const beardMat=new THREE.MeshStandardMaterial({
   color:0x56443a,roughness:1,metalness:0,side:THREE.DoubleSide
  });
  const regions=[
   ['LEFT_MOUSTACHE',-.17,-.012,.531,.551,78],
   ['RIGHT_MOUSTACHE',.012,.17,.531,.551,78],
   ['CHIN_BEARD',-.24,.24,.345,.459,210],
   ['LEFT_JAW_BEARD',-.48,-.20,.392,.490,105],
   ['RIGHT_JAW_BEARD',.20,.48,.392,.490,105]
  ];
  for(const [name,xMin,xMax,yMin,yMax,maxCount] of regions){
   const points=[],count=Math.floor(maxCount*settings.beardDensity);
   for(let i=0;i<count;i++){
    const u=(i*.61803398875+.11)%1,v=(i*.754877666+.37)%1;
    const x=cx+d.x*(xMin+(xMax-xMin)*u);
    const y=box.min.y+d.y*(yMin+(yMax-yMin)*v);
    const z=surfaceAt(x,y)+Math.max(.0001,d.z*.00065);
    const thick=d.x*(.00052+.00034*(i%3));
    const length=d.y*.009*settings.beardLength*(.55+.45*u);
    const lift=d.z*.002*settings.beardLength;
    points.push(x-thick,y,z,x+thick,y,z,
     x+thick*.12,y-length,z+lift);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
   if(points.length)geo.computeVertexNormals();
   const strand=new THREE.Mesh(geo,beardMat);
   strand.name=name+'_3D_HAIR';
   strand.userData.colorRole='beard';
   strand.userData.filamentCount=count;
   strand.renderOrder=3;
   root.add(strand);
  }
 }
 // The face mesh itself carries the integrated nose, so DO NOT glue a
 // separate nose sphere in front of its nasal bridge.
 // The lightweight raycast proxy is still used by reprojectBrows when
 // the eye angle changes. Never detach its shared sculpted geometry.
 // It is not part of the scene and its only geometry is the owned face
 // geometry which is disposed together with the actual face mesh.
 const meshList=[];
 root.traverse(o=>{if(o.isMesh)meshList.push(o);});
 const partTriangles=meshList.reduce((n,m)=>n+
  (m.geometry.index?m.geometry.index.count/3:
   m.geometry.getAttribute('position').count/3),0);
 const report=Object.freeze({
  gender,partMeshCount:meshList.length,realSurfaceProjectionCount:projected,
  projectionFallbacks,eyeMeshCount:2,irisMeshCount:2,pupilMeshCount:2,
  eyelidMeshCount:4,lipMeshCount:2,lipstickMeshCount:0,
  lipstickPlacement:female?{
   x:settings.lipstickX,y:settings.lipstickY,
   width:settings.lipstickWidth,height:settings.lipstickHeight,
   anchoredToLipSurface:true,boundedWithinLipArea:true,
   attachedToLipMesh:true,paintAsVertexColor:true
  }:null,
  eyelinerMeshCount:female?4:0,eyelinerCornersClosed:female,
  eyeAccentMeshCount:female?2:0,
  blushMeshCount:0,blushVertexTint:female,
  blushOpacityFactor:female?.43:0,beardMeshCount:female?0:5,
  beardDensity:gender==='male'?settings.beardDensity:0,
  eyebrowMeshCount:2,eyelashMeshCount:female?4:0,
  underEyeShadowMeshCount:female?2:0,
  doubleLidCreaseMeshCount:female?2:0,
  lowerOrbitalVolumeMeshCount:female?2:0,
  irisPolarAngleRadians:Number(irisAngle.toFixed(4)),
  pupilPolarAngleRadians:Number(pupilAngle.toFixed(4)),
  irisDiameterRequestFactor:settings.irisDiameter,
  actualIrisDiameterFactor:Number((Math.sin(irisAngle)/Math.sin(originalIrisAngle)).toFixed(3)),
  mouthHalfWidthFraction:.044,
  lipCenterNormalized:Number(((lipCenter-box.min.y)/d.y).toFixed(4)),
  eyeScale,eyeProfileLateralMargins:lateralEyeMargins.map(v=>Number(v.toFixed(6))),
  eyeballProjection:'true-3d-profile-exposed',
  contactColorDefault:safeContactColor(settings.contactColor),
  eyeAngleDefault:settings.eyeAngle,
  maleCosmeticsDisabled:!female,
  noseSourceIntegrated:true,
  partTriangles,faceOnly:true,bodyIncluded:false,partGeometryReal:true,
  reference:'soft-cheek-small-nose-relaxed-almond-eyes-gentle-lips'
 });
 root.userData.report=report;
 // Rotate the orbital system together, then push brows back to the
 // head's real surface. Without reprojection a slanted brow sinks into
 // the skull and seems to disappear at +/- eye angles.
 root.reprojectBrows=()=>{
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.userData?.colorRole!=='brow')return;
   const attr=mesh.geometry.getAttribute('position');
   if(!attr)return;
   if(!orbitalRestPositions.has(mesh.geometry))
    orbitalRestPositions.set(mesh.geometry,attr.array.slice());
   const original=orbitalRestPositions.get(mesh.geometry);
   for(let i=0;i<attr.count;i++)
    attr.setXYZ(i,original[i*3],original[i*3+1],original[i*3+2]);
   mesh.updateWorldMatrix(true,false);
   for(let i=0;i<attr.count;i++){
    const p=new THREE.Vector3(attr.getX(i),attr.getY(i),attr.getZ(i));
    mesh.localToWorld(p);root.worldToLocal(p);
    // A bounded inner endpoint guarantees an inter-brow gap even when
    // both eye rigs rotate to their +/-20 degree extremes.
    const gap=d.x*.023;
    if(mesh.name.startsWith('LEFT_'))p.x=Math.min(p.x,cx-gap);
    else p.x=Math.max(p.x,cx+gap);
    const skin=surfaceAt(p.x,p.y);
    p.z=skin+d.z*.008;
    root.localToWorld(p);mesh.worldToLocal(p);
    attr.setXYZ(i,p.x,p.y,p.z);
   }
   attr.needsUpdate=true;
   mesh.geometry.computeVertexNormals();
   mesh.geometry.computeBoundingSphere();
  });
 };
 updateFaceFeatureAngles(root,settings);
 return {root,report};
}

/** Change eyebrow and lash tilts without rebuilding or changing the face mesh. */
export function updateFaceFeatureAngles(partsRoot,settings={}){
 const v=normalizeFemaleFaceControls(settings);
 const values={};
 for(const side of [-1,1]){
  const lbl=side===-1?'LEFT':'RIGHT';
  const joint=partsRoot.getObjectByName(lbl+'_EYE_LINKED_PIVOT');
  const brow=partsRoot.getObjectByName(lbl+'_BROW_ANGLE_CONTROL');
  const lashes=partsRoot.getObjectByName(lbl+'_LASH_ANGLE_CONTROL');
  if(joint)joint.rotation.z=side*THREE.MathUtils.degToRad(v.eyeAngle);
  if(brow)brow.rotation.z=side*THREE.MathUtils.degToRad(v.browAngle);
  if(lashes)lashes.rotation.z=side*THREE.MathUtils.degToRad(v.lashAngle);
 }
 values.eyeAngle=v.eyeAngle;
 values.browAngle=v.browAngle;
 values.lashAngle=v.lashAngle;
 values.linkedEyeBrowLashUnderEye=true;
 partsRoot.userData.featureAngles=values;
 partsRoot.reprojectBrows?.();
 return values;
}

/** Clay and color mode both keep the exact same geometry. */
export function applyFaceColorMode(face,mode='clay',{contactColor}={}){
 const colored=mode==='color';
 const male=face.name.startsWith('MALE_');
 const clay={
  skin:0xbfc3cb,eyelid:0xbcbfc5,lipBase:0xbfc3cb,
  lipstick:0xbfc3cb,underEye:0xbcbfc5,
  eyeliner:0xbcbfc5,eyeAccent:0xbcbfc5,blush:0xbfc3cb,beard:0x8c929a,
  sclera:0xd5d8dd,iris:0x747a83,pupil:0x30353b,
  brow:0xa2a6ac,lashes:0x8c929a
 };
 const palette={
  ...FACE_V7_PALETTE,lipBase:male?0xc9998b:0xd9a699,
  lipstick:0xc07c82,
  iris:male?0x50413b:parseInt(safeContactColor(contactColor).slice(1),16)
 };
 face.traverse(o=>{
  if(!o.isMesh||!o.material)return;
  const role=o.userData?.colorRole;
  if(['lipstick','underEye','eyeliner','eyeAccent','blush'].includes(role)){
   o.visible=colored&&!male;
  }
  if(role&&o.material.color){
   const hex=(colored?palette:clay)[role];
   if(hex!==undefined)o.material.color.setHex(hex);
   colorizedMakeup(o,colored);
   o.material.needsUpdate=true;
  }
 });
 face.userData.faceColorMode=colored?'color':'clay';
 face.userData.contactColor=male?null:safeContactColor(contactColor);
 return face.userData.faceColorMode;
}
