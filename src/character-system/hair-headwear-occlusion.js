import * as THREE from 'three';

// A headpiece must not simply switch hair off. It instead removes triangles
// whose entire surface would pass through the hood/crown, leaving only safe
// hair below the helmet rim or within the hood's forward face opening. Masks
// are made once per source geometry and fit; toggling a helmet only swaps the
// index buffer, never rebuilds the high-density hairstyle.
const masks=new WeakMap();
const point=new THREE.Vector3();

export function headwearAllowsHair(position,headBounds,mode){
  if(mode!=='hood'&&mode!=='helmet')return true;
  const size=headBounds.getSize(new THREE.Vector3());
  const center=headBounds.getCenter(new THREE.Vector3());
  if(mode==='helmet'){
    // The actual plated helmet encloses the crown and ears. Only lower locks
    // below its rim are safe to expose; upper hair remains under the metal.
    return position.y<=headBounds.max.y-size.y*.66;
  }
  // The Ranger hood covers the top, temples and back of the head. Keep real
  // bangs/side locks exclusively in front of the face opening and below its
  // forehead rim. The rear/upper geometry is masked, not pushed through cloth.
  return position.y<=headBounds.max.y-size.y*.38&&
    position.z>=headBounds.max.z-size.z*.065&&
    Math.abs(position.x-center.x)<=size.x*.57;
}

export function maskHairGeometry(geometry,sourceMatrix,fit,headBounds,mode){
  if(mode!=='hood'&&mode!=='helmet')return {geometry,sourceTriangles:(geometry.index?.count||geometry.attributes.position.count)/3,keptTriangles:(geometry.index?.count||geometry.attributes.position.count)/3};
  const source=geometry.getAttribute('position');
  if(!source)throw Error('Hair mesh without positions cannot be clipped');
  const index=geometry.index;
  const signature=[mode,...fit.position.toArray(),...fit.scale.toArray(),
    ...headBounds.min.toArray(),...headBounds.max.toArray(),...sourceMatrix.elements]
    .map(n=>typeof n==='number'?n.toFixed(3):n).join('|');
  let cache=masks.get(geometry);
  if(!cache){cache=new Map();masks.set(geometry,cache)}
  if(cache.has(signature))return cache.get(signature);
  const allowed=new Uint8Array(source.count);
  for(let i=0;i<source.count;i++){
    point.fromBufferAttribute(source,i).applyMatrix4(sourceMatrix);
    point.multiply(fit.scale).add(fit.position);
    allowed[i]=headwearAllowsHair(point,headBounds,mode)?1:0;
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

export function createVisibleHeadwearWisps(headBounds,color,mode){
  const width=headBounds.max.x-headBounds.min.x,height=headBounds.max.y-headBounds.min.y;
  const depth=headBounds.max.z-headBounds.min.z;
  const center=headBounds.getCenter(new THREE.Vector3());
  const vertices=[],shades=[];
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  const base=new THREE.Color(color);
  const addRibbon=(a,b,c,d,shade)=>{
    const tone=base.clone().multiplyScalar(shade);
    for(const p of [a,b,c,b,d,c]){
      vertices.push(p.x,p.y,p.z);shades.push(tone.r,tone.g,tone.b);
    }
  };
  if(mode==='hood'){
    // A previously low, straight fringe left a large pale rectangle of
    // forehead visible beneath the thief's green hood. Root the locks higher
    // in its actual face opening, WITHIN the front opening depth, and sweep
    // them to different lengths instead of forming one straight cardboard
    // strip. The underlying full GLB haircut remains clipped at the hood.
    const n=29,front=headBounds.max.z+Math.max(.014,depth*.10);
    for(let i=0;i<n;i++){
      const x=center.x+(i/(n-1)-.5)*width*.78;
      const rootY=headBounds.max.y-height*(.24+(i%4)*.011);
      const halfWidth=width*(.017+(i%3)*.002);
      const fall=height*(.13+(i%7)*.022);
      const sweep=(i%2?1:-1)*width*(.035+(i%5)*.005);
      const middleY=rootY-fall*.48,tipY=rootY-fall;
      const midX=x+sweep*.45,tipX=x+sweep;
      const middleZ=front+.001,tipZ=front+.004;
      const shade=.72+(i%7)*.07;
      addRibbon(v(x-halfWidth,rootY,front),v(x+halfWidth,rootY,front),
        v(midX-halfWidth*.67,middleY,middleZ),v(midX+halfWidth*.67,middleY,middleZ),shade);
      addRibbon(v(midX-halfWidth*.67,middleY,middleZ),v(midX+halfWidth*.67,middleY,middleZ),
        v(tipX-halfWidth*.12,tipY,tipZ),v(tipX+halfWidth*.12,tipY,tipZ),shade*.95);
    }
    // Sparse asymmetric temple locks stay inside the exposed oval of skin,
    // instead of growing through the side walls of the cloth hood.
    for(const side of [-1,1])for(let i=0;i<7;i++){
      const x=center.x+side*width*(.315+i*.013),y=headBounds.max.y-height*(.36+i*.024);
      const w=width*.012,z=front+.001;
      addRibbon(v(x-w,y,z),v(x+w,y,z),
        v(x+side*w*.55,y-height*(.13+i*.007),z+.002),
        v(x+side*w*.75,y-height*(.13+i*.007),z+.002),.78+i*.025);
    }
  }else if(mode==='helmet'){
    // Short sideburns and neck locks sit BELOW the helmet/ear guards, not on
    // the top of the rigid metal helmet. The under-helmet hairstyle remains
    // present and follows the animated head bone.
    for(const side of [-1,1])for(let i=0;i<8;i++){
      const x=center.x+side*width*(.38+(i%3)*.022);
      const z=center.z+depth*((i/7-.5)*.44);
      const y=headBounds.max.y-height*(.66+(i%3)*.015);
      const w=width*.027,length=height*(.095+(i%4)*.018);
      addRibbon(new THREE.Vector3(x-w,y,z),new THREE.Vector3(x+w,y,z),
        new THREE.Vector3(x+side*w*.35-w*.25,y-length,z+.003),
        new THREE.Vector3(x+side*w*.35+w*.25,y-length,z+.003),.73+(i%5)*.07);
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
