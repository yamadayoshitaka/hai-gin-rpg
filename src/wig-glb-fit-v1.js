/**
 * Wig-only v1: real v121 head as a non-rendered measurement mold.
 * New GLB assets are fitted, NOT copied or regenerated from old hair models.
 * Three.js is injected; no imports from legacy hair-studio scripts.
 */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;

export function selectRealHeadMesh(root) {
 const candidates=[];
 root.traverse(node=>{
  const attribute=node.geometry?.getAttribute?.('position');
  if(!node.isMesh||!attribute||attribute.count<500)return;
  candidates.push({node,count:attribute.count});
 });
 candidates.sort((a,b)=>b.count-a.count);
 if(!candidates.length||candidates[0].count<5000)
  throw Error('顔v121の頭部実メッシュが見つかりません');
 return candidates[0].node;
}

/**
 * A front-surface lookup built from the actual transformed v121 vertices.
 * Each 5 mm XY cell stores its frontmost skin vertex; nearest cells are
 * smoothly interpolated. No synthetic sphere or old hair topology is used.
 */
function frontSurfaceSampler(points,cell=.005){
 const bins=new Map();
 for(const q of points){
  const ix=Math.round(q[0]/cell),iy=Math.round(q[1]/cell);
  const key=ix+':'+iy,old=bins.get(key);
  if(!old||old[2]<q[2])bins.set(key,q);
 }
 return (x,y)=>{
  const ix=Math.round(x/cell),iy=Math.round(y/cell);
  let sum=0,total=0;
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
   const v=bins.get((ix+dx)+':'+(iy+dy));
   if(!v)continue;
   const d2=(v[0]-x)**2+(v[1]-y)**2;
   const weight=1/(d2+.000002);
   sum+=v[2]*weight;total+=weight;
  }
  return total?sum/total:null;
 };
}
function percentile(points,axis,t){
 const sorted=points.map(p=>p[axis]).sort((a,b)=>a-b);
 return sorted[Math.floor((sorted.length-1)*t)];
}

export function measureRealHead(THREE,root){
 root.updateMatrixWorld(true);
 const mesh=selectRealHeadMesh(root);
 mesh.updateWorldMatrix(true,false);
 const position=mesh.geometry.getAttribute('position');
 const bounds=new THREE.Box3(),points=[];
 const v=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
  if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('頭部GLBの座標が不正です');
  bounds.expandByPoint(v);
  points.push([v.x,v.y,v.z]);
 }
 const top=bounds.max.y;
 // Sample only the skull band, not the nose, ears, lower jaw or neck.
 const scalp=points.filter(p=>p[1]>=top-.075&&p[1]<=top-.022);
 if(scalp.length<100)throw Error('v121の頭皮領域が不足しています');
 const cx=(percentile(scalp,0,.025)+percentile(scalp,0,.975))/2;
 const cz=(percentile(scalp,2,.05)+percentile(scalp,2,.95))/2;
 const rx=Math.max(.035,(percentile(scalp,0,.975)-percentile(scalp,0,.025))/2);
 const rz=Math.max(.035,(percentile(scalp,2,.95)-percentile(scalp,2,.05))/2);
 const forehead=scalp.filter(p=>Math.abs(p[0]-cx)<rx*.45);
 const frontZ=percentile(forehead.length>20?forehead:scalp,2,.95);
 const backZ=percentile(scalp,2,.05);
 const sampler=frontSurfaceSampler(points.filter(p=>p[1]>top-.17));
 return {
  mesh,vertices:position.count,cx,cz,rx,rz,top,
  hairlineY:top-.075,frontZ,backZ,bounds,
  scalpVertices:scalp.length,
  // Measurements use real-world v121 skin vertices and preserve facial curvature.
  frontAt(x,y){
   const z=sampler(x,y);
   return z===null?frontZ:z;
  }
 };
}

/** Crown measurements of the imported, static CC0 hair, not its long tips. */
export function measureWigCrown(THREE,wigRoot,sourceBounds){
 wigRoot.updateWorldMatrix(true,true);
 const width=sourceBounds.max.x-sourceBounds.min.x;
 const height=sourceBounds.max.y-sourceBounds.min.y;
 const top=sourceBounds.max.y;
 const lower=top-Math.max(width*.43,height*.12);
 const upper=top-Math.max(width*.045,height*.012);
 const samples=[],v=new THREE.Vector3();
 wigRoot.traverse(node=>{
  if(!node.isMesh)return;
  const a=node.geometry?.getAttribute?.('position');
  if(!a)return;
  for(let i=0;i<a.count;i++){
   v.fromBufferAttribute(a,i).applyMatrix4(node.matrixWorld);
   if(v.y>=lower&&v.y<=upper&&[v.x,v.y,v.z].every(Number.isFinite))
    samples.push([v.x,v.y,v.z]);
  }
 });
 if(samples.length<100)return null;
 const xl=percentile(samples,0,.04),xr=percentile(samples,0,.96);
 const zb=percentile(samples,2,.04),zf=percentile(samples,2,.96);
 if(xr-xl<width*.32||zf-zb<.015)return null;
 return {
  width:xr-xl,depth:zf-zb,
  cx:(xl+xr)/2,cz:(zb+zf)/2,
  frontAt:frontSurfaceSampler(samples)
 };
}

/**
 * Fit using both crown width and crown depth, not the full long-hair bounds.
 * A single uniform scale preserves the original CC0 wig shape.
 */
export function calculateWigFit(source,head,{
 widthRatio=1.11,vertical=0,forward=0,crown=null
}={}){
 if(!source?.min||!source?.max)throw Error('GLBの描画可能な境界がありません');
 const width=source.max.x-source.min.x;
 const height=source.max.y-source.min.y;
 if(!(width>.005&&height>.015))throw Error('GLBに有効な髪の大きさがありません');
 const targetWidth=head.rx*2*clamp(widthRatio,.95,1.35);
 const capWidth=crown?.width||width;
 const widthScale=targetWidth/capWidth;
 const depthScale=crown?.depth?(head.rz*2*1.035/crown.depth):widthScale;
 // Keep uniform scale. A depth mismatch can enlarge the cap a little,
 // but must not turn a narrow cap into an oversized floating helmet.
 const scale=Math.max(widthScale,Math.min(depthScale,widthScale*1.18));
 if(!Number.isFinite(scale)||scale<.002||scale>2000)throw Error('ウィッグの縮尺が異常です');
 const centerX=crown?.cx??(source.max.x+source.min.x)/2;
 const centerZ=crown?.cz??(source.max.z+source.min.z)/2;
 return {
  scale,
  x:head.cx-centerX*scale,
  y:head.top+(crown?.width?.003:.010)+clamp(vertical,-.035,.035)-source.max.y*scale,
  z:head.cz+clamp(forward,-.035,.045)-centerZ*scale,
  nativeWidth:width,expectedWidth:targetWidth,sourceHeight:height,
  capWidth:capWidth*scale,
  capDepth:(crown?.depth||source.max.z-source.min.z)*scale,
  headWidth:head.rx*2,
  headDepth:head.rz*2
 };
}

/** Deterministic fine-strand texture; exported with the standalone bang meshes. */
function fringeTexture(THREE){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=512;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.fillStyle='#e5e5e5';ctx.fillRect(0,0,256,512);
 for(let i=0;i<192;i++){
  const x=(i+.5)*256/192,d=Math.sin(i*1.618)*3.5;
  ctx.beginPath();ctx.moveTo(x,0);
  ctx.bezierCurveTo(x+d*.24,150,x-d*.15,330,x+d,512);
  ctx.strokeStyle=i%7===0?'rgba(255,255,255,.62)':'rgba(70,63,58,.23)';
  ctx.lineWidth=i%7===0?.7:.45+(i%3)*.2;
  ctx.stroke();
 }
 const tex=new THREE.CanvasTexture(canvas);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.ClampToEdgeWrapping;
 tex.anisotropy=8;
 return tex;
}


/**
 * Independent solid strands following the actual v121 front skin samples.
 * Roots sit close to the scalp, INSIDE the existing CC0 cap; no broad flat
 * sheet outside the skull and no editing of the original long-hair mesh.
 */
export function buildReferenceFringe(THREE,head,{
 color='#d2b17a',style='blunt',lengthMm=55,widthPct=95,forwardMm=0
}={}){
 const group=new THREE.Group();
 group.name='detachable-3d-bangs-'+style;
 if(style==='none')return group;
 if(!['blunt','center'].includes(style))throw Error('不正な前髪スタイルです');
 const count=72,steps=16,sides=8,p=[],uv=[],idx=[];
 const length=clamp(Number(lengthMm),30,115)/1000;
 const width=clamp(Number(widthPct),45,125)/100;
 const forward=clamp(Number(forwardMm),-20,35)/1000;
 const rootY=head.top-.037,span=head.rx*.76*width;
 const front=(x,y)=>{
  if(typeof head.frontAt==='function')return head.frontAt(x,y);
  return head.cz+head.rz*Math.sqrt(Math.max(.05,1-((x-head.cx)/head.rx)**2));
 };
 for(let i=0;i<count;i++){
  const u=(i+.5)/count*2-1;
  if(style==='center'&&Math.abs(u)<.055)continue;
  const rootX=head.cx+u*span;
  const sweep=style==='center'?Math.sign(u)*(.008+.009*(1-Math.min(1,Math.abs(u)))):0;
  const tipY=rootY-length*(style==='center'?.90+.09*Math.abs(u):1)
   +(style==='blunt'?.001*Math.sin(i*2.17):0);
  const start=p.length/3,half0=Math.max(.00065,span*1.95/count*.54);
  const surfaceX=t=>clamp(rootX+sweep*t,head.cx-head.rx*.94,head.cx+head.rx*.94);
  const rootZ=front(rootX,rootY)+.0009; // hidden under the CC0 outer layer
  for(let j=0;j<steps;j++){
   const t=j/(steps-1),ease=t*t*(3-2*t);
   const x=surfaceX(ease)+.00035*Math.sin(i*1.37+t*3)*t;
   const y=lerp(rootY,tipY,t)+.0014*Math.sin(Math.PI*t);
   // Individual forehead sampling keeps the locks tangential to real skin.
   const skin=front(x,y);
   const clearance=.0011+ .0034*ease;
   const z=lerp(rootZ,skin+clearance,ease)+forward+
    .0006*Math.sin(i*.73+t*3.1)*ease;
   const half=half0*(1-.17*t);
   for(let k=0;k<sides;k++){
    const theta=2*Math.PI*k/sides;
    p.push(x+half*Math.cos(theta),y,z+.0013*Math.sin(theta));
    uv.push(k/sides,t);
   }
  }
  const caps=p.length/3;
  const tipX=surfaceX(1),tipZ=front(tipX,tipY)+.0045+forward;
  p.push(rootX,rootY,rootZ+forward,tipX,tipY,tipZ);
  uv.push(.5,0,.5,1);
  for(let j=0;j<steps-1;j++)for(let k=0;k<sides;k++){
   const next=(k+1)%sides,a=start+j*sides+k,b=start+j*sides+next;
   idx.push(a,b,a+sides,b,b+sides,a+sides);
  }
  for(let k=0;k<sides;k++){
   const next=(k+1)%sides;
   idx.push(caps,start+next,start+k);
   idx.push(caps+1,start+(steps-1)*sides+k,start+(steps-1)*sides+next);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(idx);geo.computeVertexNormals();
 const tex=fringeTexture(THREE);
 const mat=new THREE.MeshStandardMaterial({
  color,roughness:.74,metalness:0,side:THREE.DoubleSide,
  ...(tex?{map:tex}:{})
 });
 const mesh=new THREE.Mesh(geo,mat);
 mesh.name='bangs-physical-strands';mesh.castShadow=true;
 group.add(mesh);
 group.userData.dispose=()=>{geo.dispose();mat.dispose();tex?.dispose();};
 return group;
}

/**
 * Display ONLY upper scalp triangles of the real v121 mesh, not the nose,
 * ears, jaw or neck. Preview sibling, never exported into the wig GLB.
 */
export function createRealHeadWireframe(THREE,head){
 if(!head?.mesh?.geometry)throw Error('ワイヤー用v121頭部がありません');
 head.mesh.updateWorldMatrix(true,false);
 const original=head.mesh.geometry;
 const position=original.getAttribute('position');
 if(!position)throw Error('v121頭部に頂点がありません');
 const worldPosition=new THREE.Vector3(),triangles=[];
 const index=original.getIndex();
 const getVertex=i=>new THREE.Vector3().fromBufferAttribute(position,i)
  .applyMatrix4(head.mesh.matrixWorld);
 // Crop via real mesh triangles; preserves exact scalp topology where shown.
 const floor=Number.isFinite(head.top)?head.top-.110:-Infinity;
 const triangleCount=Math.floor((index?index.count:position.count)/3);
 for(let i=0;i<triangleCount;i++){
  const ai=index?index.getX(i*3):i*3;
  const bi=index?index.getX(i*3+1):i*3+1;
  const ci=index?index.getX(i*3+2):i*3+2;
  const a=getVertex(ai),b=getVertex(bi),c=getVertex(ci);
  if(Math.min(a.y,b.y,c.y)<floor)continue;
  triangles.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
 }
 if(triangles.length<9)throw Error('v121頭部の頭皮ワイヤー用三角形が不足しています');
 const cropped=new THREE.BufferGeometry();
 cropped.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));
 const geo=new THREE.WireframeGeometry(cropped);
 cropped.dispose();
 const mat=new THREE.LineBasicMaterial({
  color:0x80dcff,transparent:true,opacity:.23,depthWrite:false,depthTest:true
 });
 const wire=new THREE.LineSegments(geo,mat);
 wire.name='preview-v121-scalp-wire-not-exported';
 wire.frustumCulled=false;
 wire.userData.dispose=()=>{geo.dispose();mat.dispose();};
 return wire;
}

export const PUBLIC_WIG_SOURCES=Object.freeze([
 Object.freeze({id:'long01',label:'ロング',file:'hair_long01.glb',license:'CC0'}),
 Object.freeze({id:'bob01',label:'ロングボブ',file:'hair_bob01.glb',license:'CC0'}),
 Object.freeze({id:'ponytail01',label:'ポニーテール',file:'hair_ponytail01.glb',license:'CC0'})
]);


/**
 * Discard the complete MakeHuman skeleton at import time. The CC0 hair GLB
 * POSITION data already contains an anatomically plausible rest-pose wig.
 * Keeping its whole-body Skinning/92 morphs in an unrelated face scene causes
 * enormous SkinnedMesh bounds and starburst geometry on screen.
 *
 * Returns a static-only THREE.Group: base POSITION/NORMAL/UV + original
 * materials. No SkinnedMesh, bones, morph targets, legacy hat, or human model.
 * IMPORTANT: fits must measure THIS static group, never the source glTF scene.
 */
export function extractUnskinnedWig(THREE,gltfRoot){
 const root=new THREE.Group();
 root.name='actual-hair-only-no-makehuman-skeleton';
 const audit={sourceSkinnedMeshes:0,staticMeshes:0,droppedSkeletons:0,
  droppedMorphTargets:0,vertices:0,triangles:0};
 gltfRoot.updateWorldMatrix(true,true);
 gltfRoot.traverse(node=>{
  if(node.isBone){audit.droppedSkeletons++;return;}
  if(!node.isMesh)return;
  if(node.isSkinnedMesh)audit.sourceSkinnedMeshes++;
  const source=node.geometry;
  if(!source?.getAttribute?.('position'))return;
  const vertices=source.getAttribute('position').count;
  if(vertices<100)throw Error('GLBの髪メッシュが小さすぎます');
  const geometry=source.clone();
  // Keep the rest-position physical hair geometry, NOT the deformed skin.
  geometry.deleteAttribute('skinIndex');
  geometry.deleteAttribute('skinWeight');
  audit.droppedMorphTargets+=Object.values(geometry.morphAttributes||{})
    .reduce((acc,x)=>acc+x.length,0);
  geometry.morphAttributes={};
  geometry.morphTargetsRelative=false;
  geometry.applyMatrix4(node.matrixWorld);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z].every(Number.isFinite)||size.x<.03||size.x>3||
      size.y<.025||size.y>3)
   throw Error('元GLBの頂点座標が異常です（髪幅・高さ）');
  const sourceMaterials=Array.isArray(node.material)?node.material:[node.material];
  const mesh=new THREE.Mesh(geometry,sourceMaterials.length===1?
    sourceMaterials[0]:sourceMaterials);
  mesh.name='unskinned-hair-'+(node.name||audit.staticMeshes+1);
  mesh.castShadow=true;mesh.receiveShadow=true;
  root.add(mesh);
  audit.staticMeshes++;audit.vertices+=vertices;
  audit.triangles+=geometry.getIndex()?
   Math.floor(geometry.getIndex().count/3):
   Math.floor(vertices/3);
 });
 if(audit.staticMeshes<1||audit.vertices<700)
  throw Error('3Dウィッグの髪メッシュが見つかりません');
 const native=new THREE.Box3().setFromObject(root);
 if(native.isEmpty())throw Error('ウィッグの独立形状が空です');
 const bounds=native.getSize(new THREE.Vector3());
 if(![bounds.x,bounds.y,bounds.z].every(Number.isFinite)||
   bounds.x<.03||bounds.x>.65||bounds.y<.04||bounds.y>1.4)
  throw Error('ウィッグGLBの元の大きさが不正です');
 return {root,bounds:native,audit};
}
