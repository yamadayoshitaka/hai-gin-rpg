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
    // A face-open helmet conceals the crown, but the forehead opening may
    // expose the front fringe. The old horizontal cutoff shaved EVERY hair
    // strand above ear height, making all armored characters look bald.
    const foreheadSurface=Number.isFinite(foreheadZ)?foreheadZ:headBounds.max.z-size.z*.26;
    const forehead=position.z>=foreheadSurface-size.z*.12&&
      position.z<=foreheadSurface+size.z*.025&&
      Math.abs(position.x-center.x)<=size.x*.35&&
      // Keep hair under the visor but above the brows, never across the eyes.
      position.y>=headBounds.max.y-size.y*.37&&
      position.y<=headBounds.max.y-size.y*.26;
    // Below the rim only the BACK/NAPE hair is exposed. Allowing the full
    // cheek/front half made black triangular hair cards stick out of the jaw.
    const belowRim=position.y<=headBounds.max.y-size.y*.60&&
      position.z<=center.z-size.z*.10;
    return forehead||belowRim;
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

export function createVisibleHeadwearWisps(headBounds,color,mode,foreheadZ=null){
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
    // Real layered bangs remain behind the brow guard, in the face opening.
    // Break up their roots/tips individually to avoid a straight painted-on
    // fringe, and do not render any hair on the metal crown itself.
    // Recess the synthetic locks under the metal brow. The former forward
    // offset and long drop made black spikes cover the exposed eyes.
    const front=faceZ-depth*.009;
    for(let layer=0;layer<2;layer++)for(let i=0;i<40;i++){
      const seed=i+layer*47;
      const x=center.x+((i+.5+noise(seed,11)*.32-.16)/40-.5)*width*.60;
      const rootY=headBounds.max.y-height*(.265+layer*.011+noise(seed,12)*.019);
      // The 7-head GLTF eyebrows sit around 40-45% down from the crown.
      // Keep these tapered ends above them in the helmet opening.
      const fall=height*(.034+noise(seed,13)*.026);
      const sweep=(noise(seed,14)-.5)*width*.075;
      const w=width*(.007+noise(seed,15)*.006);
      const z=front+layer*.0007;
      const midY=rootY-fall*.52,tipY=rootY-fall;
      const midX=x+sweep*.49,tipX=x+sweep;
      const shade=.73+noise(seed,16)*.28;
      addRibbon(v(x-w,rootY,z),v(x+w,rootY,z),
        v(midX-w*.75,midY,z+.002),v(midX+w*.75,midY,z+.002),shade);
      addRibbon(v(midX-w*.75,midY,z+.002),v(midX+w*.75,midY,z+.002),
        v(tipX-w*.11,tipY,z+.001),v(tipX+w*.11,tipY,z+.001),shade*.96);
    }
    // The old 32 ribbons on EACH cheek reached forward of the ears and
    // looked like black bars stabbed into the jaw. Keep short wisps behind
    // the ear guard at the nape instead; never over the face/cheek plane.
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
