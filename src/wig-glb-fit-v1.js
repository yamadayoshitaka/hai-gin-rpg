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
export function measureRealHead(THREE,root) {
 root.updateMatrixWorld(true);
 const mesh=selectRealHeadMesh(root);
 mesh.updateWorldMatrix(true,false);
 const p=mesh.geometry.getAttribute('position');
 const bounds=new THREE.Box3();
 const points=[];
 const v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
  if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('頭部GLBの座標が不正です');
  bounds.expandByPoint(v);
  points.push([v.x,v.y,v.z]);
 }
 const upper=points.filter(q=>q[1]>bounds.max.y-.135);
 if(upper.length<300)throw Error('頭頂部の頂点数が不足しています');
 const xs=upper.map(v=>v[0]).sort((a,b)=>a-b);
 const zs=upper.map(v=>v[2]).sort((a,b)=>a-b);
 const q=(list,t)=>list[Math.floor((list.length-1)*t)];
 const cx=(q(xs,.025)+q(xs,.975))/2;
 const cz=(q(zs,.025)+q(zs,.975))/2;
 const rx=Math.max(.06,(q(xs,.98)-q(xs,.02))/2);
 const rz=Math.max(.067,(q(zs,.98)-q(zs,.02))/2);
 return {
  mesh,vertices:p.count,
  cx,cz,rx,rz,top:bounds.max.y,
  hairlineY:bounds.max.y-.075,
  frontZ:q(zs,.96),
  backZ:q(zs,.04),
  bounds
 };
}
/** Given native source-world bounds, put the wig around the measured v121 scalp. */
export function calculateWigFit(source,head,{widthRatio=1.11,vertical=0,forward=0}={}){
 if(!source?.min||!source?.max)throw Error('GLBの描画可能な境界がありません');
 const width=source.max.x-source.min.x;
 const height=source.max.y-source.min.y;
 if(!(width>.005&&height>.015))throw Error('GLBに有効な髪の大きさがありません');
 const targetWidth=head.rx*2*clamp(widthRatio,.95,1.35);
 const scale=targetWidth/width;
 if(!Number.isFinite(scale)||scale<.002||scale>2000)throw Error('ウィッグの縮尺が異常です');
 const centerX=(source.max.x+source.min.x)/2;
 const centerZ=(source.max.z+source.min.z)/2;
 return {
  scale,
  x:head.cx-centerX*scale,
  y:head.top+.010+clamp(vertical,-.035,.035)-source.max.y*scale,
  z:head.cz+clamp(forward,-.035,.045)-centerZ*scale,
  nativeWidth:width,
  expectedWidth:targetWidth,
  sourceHeight:height,
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

/** Separate UV-mapped solid strands. The imported CC0 wig is never edited. */
export function buildReferenceFringe(THREE,head,{
 color='#d2b17a',style='blunt',lengthMm=75,widthPct=95,forwardMm=8
}={}){
 const group=new THREE.Group();
 group.name='detachable-3d-bangs-'+style;
 if(style==='none')return group;
 if(!['blunt','center'].includes(style))throw Error('不正な前髪スタイルです');
 const count=72,steps=12,sides=8,p=[],uv=[],idx=[];
 const length=clamp(Number(lengthMm),30,115)/1000;
 const width=clamp(Number(widthPct),45,125)/100;
 const forward=clamp(Number(forwardMm),-20,35)/1000;
 const rootY=head.top-.023,span=head.rx*.87*width;
 for(let i=0;i<count;i++){
  const u=(i+.5)/count*2-1;
  if(style==='center'&&Math.abs(u)<.055)continue;
  const rootX=head.cx+u*span;
  const sweep=style==='center'?Math.sign(u)*(.012+.016*(1-Math.min(1,Math.abs(u)))):0;
  const tipY=rootY-length*(style==='center'?.93+.10*Math.abs(u):1)
   +(style==='blunt'?.0015*Math.sin(i*2.17):0);
  const scalpZ=head.cz+head.rz*Math.sqrt(Math.max(.06,1-(u*.91)**2));
  const baseZ=Math.max(scalpZ,head.frontZ-.009)+.004+forward;
  const start=p.length/3,half0=Math.max(.00075,span*1.93/count*.56);
  for(let j=0;j<steps;j++){
   const t=j/(steps-1),ease=t*t*(3-2*t);
   const x=rootX+sweep*ease+.0006*Math.sin(i*1.37+t*3)*t;
   const y=lerp(rootY,tipY,t)+.0032*Math.sin(Math.PI*t);
   const z=baseZ+.008*ease+.003*Math.sin(Math.PI*t);
   const half=half0*(1-.2*t);
   for(let k=0;k<sides;k++){
    const th=2*Math.PI*k/sides;
    p.push(x+half*Math.cos(th),y,z+.00165*Math.sin(th));
    uv.push(k/sides,t);
   }
  }
  const caps=p.length/3;
  p.push(rootX,rootY,baseZ,rootX+sweep,tipY,baseZ+.008);
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

/** Real v121 head geometry; preview-only and never part of the export root. */
export function createRealHeadWireframe(THREE,head){
 if(!head?.mesh?.geometry)throw Error('ワイヤー用v121頭部がありません');
 head.mesh.updateWorldMatrix(true,false);
 const tmp=head.mesh.geometry.clone();
 tmp.applyMatrix4(head.mesh.matrixWorld);
 const geo=new THREE.WireframeGeometry(tmp);
 tmp.dispose();
 const mat=new THREE.LineBasicMaterial({
  color:0x80dcff,transparent:true,opacity:.28,depthWrite:false,depthTest:true
 });
 const wire=new THREE.LineSegments(geo,mat);
 wire.name='preview-v121-head-wire-not-exported';
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
