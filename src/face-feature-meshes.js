import * as THREE from 'three';
import {normalizeFemaleFaceControls,FACE_V7_PALETTE,MALE_REFERENCE_DEFAULT,safeContactColor} from './face-v7-controls.js';

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
export function createAnatomicalFaceParts(face,{gender='female',controls={}}={}){
 if(!face?.isMesh||!['male','female'].includes(gender))
  throw Error('Sculpted face mesh and gender required for 3D facial parts');
 const settings=normalizeFemaleFaceControls(controls);
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
 const eyeScale=female?settings.eyeSize:MALE_REFERENCE_DEFAULT.eyeSize;
 const originalIrisAngle=female?.585:.47;
 const originalPupilAngle=female?.236:.19;
 // A doubled requested projected diameter must remain on a sphere:
 // physical iris diameter is limited to 95.5% of the eye's diameter.
 const irisAngle=female?Math.asin(Math.min(.955,
  Math.sin(originalIrisAngle)*settings.irisDiameter)):originalIrisAngle;
 const pupilAngle=female?Math.asin(Math.min(.75,
  Math.sin(originalPupilAngle)*settings.irisDiameter)):originalPupilAngle;
 const eyeRadius=d.x*(female?.052:.051)*eyeScale;
 const eyeHeight=box.min.y+d.y*(female?.684:.687);
 const eyeSpacing=d.x*(female?.112:.115);
 // Sclera centre is recessed. Upper and lower eyelids cover the spherical
 // edge, rather than drawing detached floating white eye disks.
 for(const side of [-1,1]){
  const firstChild=root.children.length;
  const x=cx+side*eyeSpacing,y=eyeHeight;
  const faceZ=surfaceAt(x,y);
  // Set globes into the socket but forward enough for the colored iris
  // to stay visible at oblique camera angles; not floating over the lids.
  const z=faceZ-eyeRadius*.30;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(eyeRadius,36,24),eyeMat);
  globe.name=(side===-1?'LEFT':'RIGHT')+'_ORBITAL_EYEBALL';
  globe.scale.set(1.18,.77,.89);
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
     z+eyeRadius*.89*sz+eyeRadius*raise
    );
   },material);
  irisMat.side=THREE.DoubleSide;pupilMat.side=THREE.DoubleSide;
  const iris=makeCap('CURVED_IRIS',irisAngle,irisMat,.018);
  iris.userData.colorRole='iris';root.add(iris);
  const pupil=makeCap('CURVED_PUPIL',pupilAngle,pupilMat,.024);
  pupil.userData.colorRole='pupil';root.add(pupil);
  const width=eyeRadius*1.12;
  for(const upper of [true,false]){
   const label=(side===-1?'LEFT':'RIGHT')+(upper?'_UPPER':'_LOWER');
   const height=eyeRadius*(female?.33:.30);
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
  }
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
    color:0xb99085,transparent:true,opacity:.29,depthWrite:false,
    roughness:1,side:THREE.DoubleSide
   });
   const eyeShadow=buildGrid(
    (side===-1?'LEFT':'RIGHT')+'_UNDER_EYE_SHADOW',28,5,(u,v)=>{
     const t=2*u-1,soft=Math.pow(Math.max(0,1-t*t),.82);
     const xx=x+t*eyeRadius*1.11;
     const yy=y-eyeRadius*(.70+.13*soft+.29*v);
     const zz=surfaceAt(xx,yy)+d.z*(.006+.003*Math.sin(Math.PI*v)*soft);
     return new THREE.Vector3(xx,yy,zz);
    },shadowMat);
   eyeShadow.userData.colorRole='underEye';
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
    const xx=x+t*eyeRadius*1.64;
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
    const xx=x+t*eyeRadius*1.66;
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
    else child.geometry.translate(-x,-y,-z);
   }else child.position.sub(origin);
   eyeJoint.add(child);
  }
  root.add(eyeJoint);
 }
 // Original face remains the structural muzzle/philtrum/chin. Two shallow
 // lip strips follow that actual surface and use real triangle thickness.
 // Avoid a single flat 'mouth plate' or pigment printed on the chin.
 const lipCenter=box.min.y+d.y*(female?.509:.509);
 const halfWidth=d.x*.044;
 // Bounds measured from real upper/lower lip meshes (float32 vertices).
 const lipBounds=new Map();
 for(const upper of [true,false]){
  const material=lipMat;
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
    const z=surfaceAt(x,y)+d.z*(.0015+.005*fullness*taper);
    return new THREE.Vector3(x,y,z);
   },material);
  mesh.userData.faceSurfaceConforming=true;
  mesh.userData.colorRole='lipBase';
  lipBounds.set(upper,new THREE.Box3().setFromBufferAttribute(
   mesh.geometry.getAttribute('position')));
  root.add(mesh);
 }
 // Separate lipstick overlay: this colors only the actual mouth surface,
 // not the chin, and can move horizontally/vertically or resize without
 // changing the sculpted lip anatomy. The base projection is IDENTICAL
 // to the structural lip strips at neutral position and scale.
 if(female)for(const upper of [true,false]){
  const pigment=new THREE.MeshStandardMaterial({
   color:0xc07c82,roughness:.75,metalness:0,side:THREE.DoubleSide,
   transparent:true,opacity:.91,depthWrite:false
  });
  const patch=buildGrid(
   (upper?'UPPER':'LOWER')+'_LIPSTICK_MAKEUP',32,8,(u,v)=>{
    // Slide the cosmetic coverage WITHIN the real lip's UV-like domain.
    // Formerly offsets of 0.12 * head size could paint the chin/cheeks.
    // Refit oversize/shifted coverage instead of letting it escape the lips.
    const xShift=THREE.MathUtils.clamp(settings.lipstickX/.12,-1,1)*.7;
    const yShift=THREE.MathUtils.clamp(settings.lipstickY/.12,-1,1)*.7;
    const xFit=Math.max(1,Math.abs(xShift)+settings.lipstickWidth);
    const yFit=Math.max(1,Math.abs(yShift)+settings.lipstickHeight);
    const t=((u*2-1)*settings.lipstickWidth+xShift)/xFit;
    const lipV=.5+((v-.5)*2*settings.lipstickHeight+yShift)/(2*yFit);
    const taper=Math.pow(Math.max(0,1-t*t),.70);
    const cupid=upper?
      d.y*.0018*(bell(Math.abs(t),.37,.22)-.42*bell(t,0,.23)):0;
    const cy=lipCenter+(upper?d.y*.009:-d.y*.009)+cupid;
    const vertical=(lipV-.5)*d.y*(upper?.012:.015)*taper;
    const anatomicalBounds=lipBounds.get(upper);
    const x=THREE.MathUtils.clamp(cx+t*halfWidth,
     anatomicalBounds.min.x,anatomicalBounds.max.x);
    const y=THREE.MathUtils.clamp(cy+vertical,
     anatomicalBounds.min.y,anatomicalBounds.max.y);
    const fullness=(1-t*t)*Math.sin(Math.PI*v);
    const z=surfaceAt(x,y)+d.z*(.0038+.005*fullness*taper);
    return new THREE.Vector3(x,y,z);
   },pigment);
  patch.userData.colorRole='lipstick';
  patch.userData.cosmetic=true;
  root.add(patch);
 }
 // The face mesh itself carries the integrated nose, so DO NOT glue a
 // separate nose sphere in front of its nasal bridge.
 surface.geometry=null;surface.material.dispose();
 const meshList=[];
 root.traverse(o=>{if(o.isMesh)meshList.push(o);});
 const partTriangles=meshList.reduce((n,m)=>n+
  (m.geometry.index?m.geometry.index.count/3:
   m.geometry.getAttribute('position').count/3),0);
 const report=Object.freeze({
  gender,partMeshCount:meshList.length,realSurfaceProjectionCount:projected,
  projectionFallbacks,eyeMeshCount:2,irisMeshCount:2,pupilMeshCount:2,
  eyelidMeshCount:4,lipMeshCount:2,lipstickMeshCount:female?2:0,
  lipstickPlacement:female?{
   x:settings.lipstickX,y:settings.lipstickY,
   width:settings.lipstickWidth,height:settings.lipstickHeight,
   anchoredToLipSurface:true,boundedWithinLipArea:true
  }:null,
  eyebrowMeshCount:2,eyelashMeshCount:female?4:0,
  underEyeShadowMeshCount:female?2:0,
  doubleLidCreaseMeshCount:female?2:0,
  lowerOrbitalVolumeMeshCount:female?2:0,
  irisPolarAngleRadians:Number(irisAngle.toFixed(4)),
  pupilPolarAngleRadians:Number(pupilAngle.toFixed(4)),
  irisDiameterRequestFactor:gender==='female'?settings.irisDiameter:1,
  actualIrisDiameterFactor:Number((Math.sin(irisAngle)/Math.sin(originalIrisAngle)).toFixed(3)),
  mouthHalfWidthFraction:.044,
  eyeScale,contactColorDefault:safeContactColor(settings.contactColor),
  eyeAngleDefault:gender==='female'?settings.eyeAngle:0,
  maleCosmeticsDisabled:!female,
  noseSourceIntegrated:true,
  partTriangles,faceOnly:true,bodyIncluded:false,partGeometryReal:true,
  reference:'soft-cheek-small-nose-relaxed-almond-eyes-gentle-lips'
 });
 root.userData.report=report;
 updateFaceFeatureAngles(root,female?settings:{
  eyeAngle:0,browAngle:0,lashAngle:0
 });
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
 return values;
}

/** Clay and color mode both keep the exact same geometry. */
export function applyFaceColorMode(face,mode='clay',{contactColor}={}){
 const colored=mode==='color';
 const male=face.name.startsWith('MALE_');
 const clay={
  skin:0xbfc3cb,eyelid:0xbcbfc5,lipBase:0xbfc3cb,
  lipstick:0xbfc3cb,underEye:0xbcbfc5,
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
  if(role==='lipstick'||role==='underEye'){
   o.visible=colored&&!male;
  }
  if(role&&o.material.color){
   const hex=(colored?palette:clay)[role];
   if(hex!==undefined)o.material.color.setHex(hex);
   o.material.needsUpdate=true;
  }
 });
 face.userData.faceColorMode=colored?'color':'clay';
 face.userData.contactColor=male?null:safeContactColor(contactColor);
 return face.userData.faceColorMode;
}
