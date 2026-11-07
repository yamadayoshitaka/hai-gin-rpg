import * as THREE from 'three';

// A headpiece must not simply switch hair off. It instead removes triangles
// whose entire surface would pass through the hood/crown, leaving only safe
// hair below the helmet rim or within the hood's forward face opening. Masks
// are made once per source geometry and fit; toggling a helmet only swaps the
// index buffer, never rebuilds the high-density hairstyle.
const masks=new WeakMap();
const point=new THREE.Vector3();

export function headwearAllowsHair(position,headBounds,mode,foreheadZ=null){
  if(mode!=='hood'&&mode!=='helmet')return true;
  const size=headBounds.getSize(new THREE.Vector3());
  const center=headBounds.getCenter(new THREE.Vector3());
  if(mode==='helmet'){
    // A helmet is a hollow cap, not a global "hide everything above the
    // ears" plane. Keep the natural scalp/hairstyle INSIDE its cavity and
    // trim just inside the shell. Opaque metal hides the covered strands by
    // depth testing; the opening still exposes the original fitted hairline.
    const clearance=Math.max(.0025,size.x*.011);
    const innerX=Math.max(.02,size.x*.515-clearance);
    const innerZ=Math.max(.02,size.z*.525-clearance);
    const dx=(position.x-center.x)/innerX,dz=(position.z-center.z)/innerZ;
    const innerShell=dx*dx+dz*dz<=1&&
      position.y>=headBounds.max.y-size.y*.64&&
      position.y<=headBounds.max.y+size.y*.009;
    const foreheadSurface=Number.isFinite(foreheadZ)?foreheadZ:headBounds.max.z-size.z*.26;
    const atFace=position.z>=foreheadSurface-size.z*.16&&
      Math.abs(position.x-center.x)<=size.x*.44;
    // Clip hair that actually pierces the crown/visor, not every strand
    // outside an arbitrary 6%-high forehead strip. That tiny strip removed
    // almost all GLB bangs and left only synthetic black stubble visible.
    // The wider FACE OPENING retains the real tapered locks above the brows.
    const u=(position.x-center.x)/Math.max(.001,size.x);
    const edge=Math.sin(u*19.1)*.008+Math.sin(u*37.7+1.3)*.005;
    const side=Math.abs(position.x-center.x);
    const templeOpening=side>=size.x*.34&&side<=size.x*.49&&
      position.z>=center.z+size.z*.015&&
      position.z<=center.z+size.z*.115&&
      position.y<=headBounds.max.y-size.y*.41&&
      position.y>=headBounds.max.y-size.y*.67;
    if(templeOpening)return true;
    if(atFace){
      const foreheadOpening=position.z>=foreheadSurface-size.z*.105&&
        position.z<=foreheadSurface+size.z*.040&&
        position.y>=headBounds.max.y-size.y*(.425+edge)&&
        position.y<=headBounds.max.y-size.y*(.255+edge*.35);
      // Hair deeper inside the helmet can remain beneath opaque steel. It
      // must not be mistaken for a protruding forelock and shaved away.
      const underBrow=innerShell&&position.z<foreheadSurface-size.z*.065&&
        position.y>headBounds.max.y-size.y*.26;
      // Keep real GLB locks inside the opaque metal's cavity. The helmet's
      // depth buffer hides covered strands without shaving the forehead.
      const underCrown=innerShell&&
        position.z<=foreheadSurface+size.z*.035&&
        position.y>=headBounds.max.y-size.y*.43;
      return foreheadOpening||underBrow||underCrown;
    }
    // Broad imported side locks reached through the cheek/ear opening as
    // black rectangular wedges. Only hair deeper inside the cap survives.
    const sideExterior=Math.abs(position.x-center.x)>size.x*.40&&
      position.z>center.z-size.z*.10&&
      position.y<headBounds.max.y-size.y*.39;
    const belowRim=position.y<=headBounds.max.y-size.y*.60&&
      position.z<=center.z-size.z*.10;
    return !sideExterior&&(innerShell||belowRim);
  }
  // The cloth hood has an OPEN FACE. The previous tiny forward/deep mask
  // discarded almost every triangle of actual GLB hair, creating a bald
  // forehead. Keep front bangs in the oval opening, shorter temple strands,
  // and hair falling below the hood at the nape. Never expose the crown or
  // back of the head where cloth covers it.
  const faceOpening=position.z>=headBounds.max.z-size.z*.26&&
    Math.abs(position.x-center.x)<=size.x*.46&&
    position.y<=headBounds.max.y-size.y*.17;
  const templeOpening=position.z>=center.z+size.z*.15&&
    Math.abs(position.x-center.x)<=size.x*.59&&
    position.y<=headBounds.max.y-size.y*.39;
  const nape=position.y<=headBounds.max.y-size.y*.75;
  return faceOpening||templeOpening||nape;
}

export function maskHairGeometry(geometry,sourceMatrix,fit,headBounds,mode,foreheadZ=null){
  if(mode!=='hood'&&mode!=='helmet')return {geometry,sourceTriangles:(geometry.index?.count||geometry.attributes.position.count)/3,keptTriangles:(geometry.index?.count||geometry.attributes.position.count)/3};
  const source=geometry.getAttribute('position');
  if(!source)throw Error('Hair mesh without positions cannot be clipped');
  const index=geometry.index;
  const signature=[mode,Number.isFinite(foreheadZ)?foreheadZ:-1,...fit.position.toArray(),...fit.scale.toArray(),
    ...headBounds.min.toArray(),...headBounds.max.toArray(),...sourceMatrix.elements]
    .map(n=>typeof n==='number'?n.toFixed(3):n).join('|');
  let cache=masks.get(geometry);
  if(!cache){cache=new Map();masks.set(geometry,cache)}
  if(cache.has(signature))return cache.get(signature);
  const allowed=new Uint8Array(source.count);
  for(let i=0;i<source.count;i++){
    point.fromBufferAttribute(source,i).applyMatrix4(sourceMatrix);
    point.multiply(fit.scale).add(fit.position);
    allowed[i]=headwearAllowsHair(point,headBounds,mode,foreheadZ)?1:0;
  }
  const result=[];
  const count=index?.count||source.count;
  for(let i=0;i<count;i+=3){
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    if(allowed[a]&&allowed[b]&&allowed[c])result.push(a,b,c);
  }
  const masked=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(geometry.attributes))masked.setAttribute(name,attribute);
  masked.setIndex(result);
  // The original bounding sphere remains a conservative superset, which is
  // safer for animation/frustum culling than a headwear-dependent tight fit.
  if(geometry.boundingSphere)masked.boundingSphere=geometry.boundingSphere.clone();
  const entry={geometry:masked,sourceTriangles:count/3,keptTriangles:result.length/3};
  cache.set(signature,entry);
  return entry;
}

export function createVisibleHeadwearWisps(headBounds,color,mode,foreheadZ=null,style=1,quality='preview'){
  const width=headBounds.max.x-headBounds.min.x,height=headBounds.max.y-headBounds.min.y;
  const depth=headBounds.max.z-headBounds.min.z;
  const center=headBounds.getCenter(new THREE.Vector3());
  // The head's maximum +Z is the TIP OF THE NOSE, not the forehead. Hair
  // attached near maxZ was hovering in front of the eyebrows and eyes in
  // side views. Use the sampled anatomical forehead plane instead.
  const faceZ=Number.isFinite(foreheadZ)?foreheadZ:headBounds.max.z-depth*.26;
  const vertices=[],shades=[];
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  const noise=(i,seed)=>{const value=Math.sin(i*12.9898+seed*78.233)*43758.5453;
    return value-Math.floor(value)};
  const base=new THREE.Color(color);
  // Haircuts must not acquire an identical painted-on fringe when equipped.
  // Change the strand layout deterministically with the selected GLB style.
  const styleSeed=Number.isFinite(Number(style))?Number(style):1;
  const addRibbon=(a,b,c,d,shade)=>{
    const tone=base.clone().multiplyScalar(shade);
    for(const p of [a,b,c,b,d,c]){
      vertices.push(p.x,p.y,p.z);shades.push(tone.r,tone.g,tone.b);
    }
  };
  if(mode==='hood'){
    // Several staggered layers of tapered, curved real-width hair cards fill
    // the opening with a naturally broken hairline. Each layer is a single
    // batched mesh; none protrudes through the top or side walls of the hood.
    // Put cloth-hood bangs against skin, not in the air near the nose tip.
    const front=faceZ+depth*.009;
    for(let layer=0;layer<3;layer++)for(let i=0;i<56;i++){
      const seed=i+layer*59;
      const x=center.x+((i+.5+noise(seed,1)*.46-.23)/56-.5)*width*.83;
      const rootY=headBounds.max.y-height*(.18+layer*.038+noise(seed,2)*.075);
      const halfWidth=width*(.011+noise(seed,3)*.007);
      const fall=height*(.115+noise(seed,4)*.105+layer*.018);
      const sweep=width*(noise(seed,5)-.5)*(.085+layer*.012);
      const z=front+layer*.0012;
      const midY=rootY-fall*.48,tipY=rootY-fall;
      const midX=x+sweep*.47,tipX=x+sweep;
      const shade=.76+noise(seed,6)*.30;
      addRibbon(v(x-halfWidth,rootY,z),v(x+halfWidth,rootY,z),
        v(midX-halfWidth*.82,midY,z+.003),v(midX+halfWidth*.82,midY,z+.003),shade);
      addRibbon(v(midX-halfWidth*.82,midY,z+.003),v(midX+halfWidth*.82,midY,z+.003),
        v(tipX-halfWidth*.12,tipY,z+.006),v(tipX+halfWidth*.12,tipY,z+.006),shade*.93);
    }
    // The exposed cheek/temple area also needs hair. Without this, only a
    // central forehead rectangle was covered while the soldier looked bald.
    for(const side of [-1,1])for(let i=0;i<24;i++){
      const x=center.x+side*width*(.315+noise(i,side)*.092);
      const y=headBounds.max.y-height*(.34+noise(i,side+3)*.11);
      const z=front+.002,w=width*(.010+noise(i,side+5)*.006);
      const tipX=x+side*width*.026,tipY=y-height*(.12+noise(i,side+7)*.13);
      addRibbon(v(x-w,y,z),v(x+w,y,z),
        v(tipX-w*.22,tipY,z+.005),v(tipX+w*.22,tipY,z+.005),.74+noise(i,side+8)*.32);
    }
  }else if(mode==='helmet'){
    // Keep the measured skin-level depth and the rim height. v4.4.62 reduced
    // the face to 53 very narrow locks; on mobile the helmet occluded most
    // roots and only isolated black ticks survived. Restore a dense, layered
    // fringe, with variable tips rather than a single horizontal lower edge.
    const front=faceZ+Math.max(.002,depth*.010);
    for(const [layer,count] of [48,38,28].entries())for(let i=0;i<count;i++){
      const seed=i+layer*37+styleSeed*101;
      const u=(i+.5+(noise(seed,11)-.5)*.48)/count-.5;
      const x=center.x+u*width*(.74-layer*.055);
      const temple=Math.pow(Math.min(1,Math.abs(u)*2),1.5);
      const rootFraction=.255+layer*.016+temple*.014+noise(seed,12)*.012;
      const tipFraction=Math.min(.404,rootFraction+.048+noise(seed,13)*.046);
      const rootY=headBounds.max.y-height*rootFraction;
      const tipY=headBounds.max.y-height*tipFraction;
      const sweep=(noise(seed,14)-.5)*width*.065+
        width*.009*((styleSeed%5)-2)*(1-temple);
      const w=width*(.0023+noise(seed,15)*.0027);
      const z=front+layer*depth*.004;
      const midY=rootY+(tipY-rootY)*.47;
      const midX=x+sweep*.41,tipX=x+sweep;
      const shade=.73+noise(seed,16)*.32;
      addRibbon(v(x-w,rootY,z),v(x+w,rootY,z),
        v(midX-w*.76,midY,z+depth*.011),v(midX+w*.76,midY,z+depth*.011),shade);
      addRibbon(v(midX-w*.76,midY,z+depth*.011),v(midX+w*.76,midY,z+depth*.011),
        v(tipX-w*.09,tipY,z+depth*.014),v(tipX+w*.09,tipY,z+depth*.014),shade*.92);
    }
    // The imported short hairstyle parts at the centre. Its real side locks
    // survive clipping, yet the synthetic full-width fringe can disappear
    // behind the convex middle of the forehead. Fill that anatomical gap
    // with overlapping, skin-close tapered locks. Keep their roots inside
    // the visor and their tips safely above the eyebrows; the slight extra
    // centre depth follows the forehead instead of forming a floating wig.
    for(let layer=0;layer<2;layer++)for(let i=0;i<38;i++){
      const seed=styleSeed*173+layer*47+i;
      const u=(i+.5+(noise(seed,31)-.5)*.36)/38-.5;
      const x=center.x+u*width*.465;
      const rootFraction=.258+layer*.019+noise(seed,32)*.024;
      const tipFraction=Math.min(.405,rootFraction+.073+noise(seed,33)*.043);
      const rootY=headBounds.max.y-height*rootFraction;
      const tipY=headBounds.max.y-height*tipFraction;
      const sweep=width*((noise(seed,34)-.5)*.047+(styleSeed%3-1)*.006);
      const w=width*(.0022+noise(seed,35)*.0023);
      const z=faceZ+depth*(.027+(.009*(1-Math.abs(u)*2))+layer*.003);
      const middleY=rootY+(tipY-rootY)*.53;
      const middleX=x+sweep*.44,tipX=x+sweep;
      const shade=.74+noise(seed,36)*.29;
      addRibbon(v(x-w,rootY,z),v(x+w,rootY,z),
        v(middleX-w*.68,middleY,z+depth*.003),v(middleX+w*.68,middleY,z+depth*.003),shade);
      addRibbon(v(middleX-w*.68,middleY,z+depth*.003),v(middleX+w*.68,middleY,z+depth*.003),
        v(tipX-w*.08,tipY,z+depth*.006),v(tipX+w*.08,tipY,z+depth*.006),shade*.94);
    }
    // A contiguous strip of 92 quads fixed the bald middle but made a hard,
    // flat horizontal plate when seen from below. Replace it with hundreds of
    // *individual* swept ribbons. Their roots overlap just inside the visor,
    // while the two curved segments and tapered tips follow the convex brow.
    // No joined bottom boundary is left to produce a blunt "bowl cut".
    // Crowd models use the same physical placement with fewer wider cards;
    // close inspection retains the full density without taxing 1000v1000.
    const hairlineStrands=quality==='battle'?104:300;
    for(let i=0;i<hairlineStrands;i++){
      const seed=styleSeed*241+i;
      const u=(i+.5+(noise(seed,41)-.5)*.44)/hairlineStrands-.5;
      const crownShape=1-Math.pow(Math.abs(u)*2,1.6);
      const sweepSide=styleSeed%2===0?-1:1;
      const x=center.x+u*width*.75;
      const rootDrop=.256+.015*noise(seed,42);
      const tipDrop=THREE.MathUtils.clamp(.331+.017*crownShape+
        sweepSide*u*.056+.020*Math.sin(u*10.4+styleSeed*.46)+
        .013*Math.sin(u*31+styleSeed*.73)+
        .020*(noise(seed,43)-.5),.295,.411);
      const rootY=headBounds.max.y-height*rootDrop;
      const tipY=headBounds.max.y-height*tipDrop;
      const sweep=width*(sweepSide*.016+(noise(seed,44)-.5)*.032);
      const halfWidth=width*(.0014+noise(seed,45)*.0020)*(quality==='battle'?1.8:1);
      const z=faceZ+depth*(.028+.012*crownShape);
      const midX=x+sweep*.46,tipX=x+sweep;
      const midY=rootY+(tipY-rootY)*.49;
      const shade=.77+noise(seed,46)*.26;
      addRibbon(v(x-halfWidth,rootY,z),v(x+halfWidth,rootY,z),
        v(midX-halfWidth*.78,midY,z+depth*.004),
        v(midX+halfWidth*.78,midY,z+depth*.004),shade);
      addRibbon(v(midX-halfWidth*.78,midY,z+depth*.004),
        v(midX+halfWidth*.78,midY,z+depth*.004),
        v(tipX-halfWidth*.07,tipY,z+depth*.008),
        v(tipX+halfWidth*.07,tipY,z+depth*.008),shade*.92);
    }
    // Restore subtle temple hair inside the side opening. Do not send it in
    // front of the cheek or down across the jaw/face guard.
    for(const side of [-1,1])for(let i=0;i<10;i++){
      const seed=i+styleSeed*29+side*37,n=noise(seed,21);
      const x=center.x+side*width*(.345+n*.085);
      const z=center.z+depth*(.025+noise(seed,22)*.055);
      const rootFraction=.48+noise(seed,23)*.055;
      const tipFraction=Math.min(.665,rootFraction+.055+noise(seed,24)*.067);
      const y=headBounds.max.y-height*rootFraction;
      const tipY=headBounds.max.y-height*tipFraction;
      const w=width*(.004+noise(seed,25)*.004);
      const tipX=x+side*width*.009;
      addRibbon(v(x-w,y,z),v(x+w,y,z),
        v(tipX-w*.12,tipY,z-depth*.007),v(tipX+w*.12,tipY,z-depth*.007),.72+noise(seed,26)*.27);
    }
    // Nape wisps are tucked behind the ear guard, never across the jaw.
    for(const side of [-1,1])for(let i=0;i<18;i++){
      const n=noise(i,side+2),x=center.x+side*width*(.405+n*.035);
      const z=center.z-depth*(.12+n*.24);
      const y=headBounds.max.y-height*(.69+noise(i,side+4)*.07);
      const w=width*(.006+n*.006),length=height*(.08+noise(i,side+6)*.09);
      const tipX=x+side*w*(noise(i,side+8)-.5)*1.3;
      addRibbon(v(x-w,y,z),v(x+w,y,z),
        v(tipX-w*.19,y-length,z+.006),v(tipX+w*.19,y-length,z+.006),.73+noise(i,side+9)*.31);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(shades,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,
    roughness:.86,metalness:0,side:THREE.DoubleSide,depthWrite:true}));
  mesh.name=`headwear-safe-${mode}-face-fringe`;
  mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}
