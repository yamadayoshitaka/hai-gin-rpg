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
 const scalp=points.filter(p=>p[1]>=top-.105&&p[1]<=top-.032);
 if(scalp.length<100)throw Error('v121の頭皮領域が不足しています');
 const cx=(percentile(scalp,0,.04)+percentile(scalp,0,.96))/2;
 const cz=(percentile(scalp,2,.04)+percentile(scalp,2,.96))/2;
 const rx=Math.max(.035,(percentile(scalp,0,.96)-percentile(scalp,0,.04))/2);
 const rz=Math.max(.035,(percentile(scalp,2,.96)-percentile(scalp,2,.04))/2);
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
 if(xr-xl<width*.32||zf-zb<Math.max(.015,width*.28))return null;
 return {
  width:xr-xl,depth:zf-zb,
  cx:(xl+xr)/2,cz:(zb+zf)/2,
  frontAt:frontSurfaceSampler(samples)
 };
}

/**
 * Fit policies based on the three verified independent CC0 source silhouettes.
 *
 * Bob is the already approved reference, so its old full-coverage scale is
 * retained exactly. The long and ponytail assets have disproportionately
 * large hair-tip / narrow-ponytail dimensions, so forcing BOTH outer axes to
 * cover the full skull greatly exaggerates them. Their actual skull covering
 * geometry is complemented by the independently fitted v121 hair under-cap.
 */
export const WIG_FIT_PROFILES=Object.freeze({
 long01:Object.freeze({mode:'balanced-crown',silhouette:0.87}),
 bob01:Object.freeze({mode:'full-coverage',silhouette:1}),
 ponytail01:Object.freeze({mode:'balanced-crown',silhouette:0.99})
});

/**
 * All three styles share the same v121 centroid and crown coordinates.
 * Fit the CC0 crown, not the length of its tips. Use a uniform XYZ scale to
 * avoid distorting the original strand meshes, and reserve the v121 hair
 * under-cap for gaps rather than inflating the entire source geometry.
 */
export function calculateWigFit(source,head,{
 widthRatio=1.11,vertical=0,forward=0,crown=null,style='bob01'
}={}){
 if(!source?.min||!source?.max)throw Error('GLBの描画可能な境界がありません');
 const width=source.max.x-source.min.x;
 const height=source.max.y-source.min.y;
 if(!(width>.005&&height>.015))throw Error('GLBに有効な髪の大きさがありません');
 const ratio=clamp(widthRatio,.95,1.60);
 const targetWidth=head.rx*2*ratio;
 const capWidth=crown?.width||width;
 const capDepth=crown?.depth||(source.max.z-source.min.z);
 if(!(capWidth>.005&&capDepth>.005))throw Error('ウィッグ頂部の寸法が不正です');
 const widthScale=head.rx*2*1.035/capWidth;
 const depthScale=head.rz*2*1.035/capDepth;
 const profile=WIG_FIT_PROFILES[style]||WIG_FIT_PROFILES.bob01;
 // Bob is a regression anchor. Long and ponytail no longer use the larger
 // X/Z scale alone; instead they retain their silhouette via a balanced fit.
 const baseScale=profile.mode==='balanced-crown'?
  Math.sqrt(widthScale*depthScale)*profile.silhouette:
  Math.max(widthScale,depthScale);
 // Without measured crown, keep the original bounds-only contract.
 const scale=crown?baseScale*ratio:targetWidth/width;
 if(!Number.isFinite(scale)||scale<.002||scale>2000)throw Error('ウィッグの縮尺が異常です');
 const centerX=crown?.cx??(source.max.x+source.min.x)/2;
 const centerZ=crown?.cz??(source.max.z+source.min.z)/2;
 return {
  scale,x:head.cx-centerX*scale,
  y:head.top+(crown?.width?.009:.010)+clamp(vertical,-.035,.035)-source.max.y*scale,
  z:head.cz+clamp(forward,-.035,.045)-centerZ*scale,
  nativeWidth:width,expectedWidth:targetWidth,sourceHeight:height,
  capWidth:capWidth*scale,capDepth:capDepth*scale,
  headWidth:head.rx*2,headDepth:head.rz*2,
  coverageX:capWidth*scale/(head.rx*2),
  coverageZ:capDepth*scale/(head.rz*2),
  // A coverage value below 100% is intentional for styles whose original
  // strands are narrow: the real-v121 tinted under-cap covers those regions.
  fitBasis:crown?'actual-v121-head-vs-cc0-crown':'legacy-bounds',
  fitMode:profile.mode,
  fitStyle:style in WIG_FIT_PROFILES?style:'bob01',
  uniformSize:true,
  fullCoverageScale:Math.max(widthScale,depthScale)*ratio
 };
}

/** Deterministic fine-strand texture; exported with the standalone bang meshes. */
function fringeTexture(THREE){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');
 canvas.width=512;canvas.height=1024;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 // A mostly neutral fiber map: tint remains controlled by the hair-color input.
 ctx.fillStyle='#efeeeb';ctx.fillRect(0,0,512,1024);
 for(let i=0;i<420;i++){
  const x=(i+.5)*512/420,phase=i*2.399963;
  const wind=Math.sin(phase)*4.5;
  ctx.beginPath();
  ctx.moveTo(x,0);
  ctx.bezierCurveTo(x+wind,260,x-wind*.5,680,x+wind*.65,1024);
  const value=i%11===0?255:(i%7===0?188:110);
  ctx.strokeStyle=value===255?'rgba(255,255,255,.65)':
   value===188?'rgba(255,255,255,.28)':'rgba(64,60,56,.21)';
  ctx.lineWidth=i%11===0?.85:.36+(i%4)*.15;
  ctx.stroke();
 }
 const tex=new THREE.CanvasTexture(canvas);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
 tex.anisotropy=8;
 return tex;
}

/**
 * Two interleaved layers of fine, tapered, solid 3D locks. Roots are hidden
 * under the existing CC0 cap, while visible ends are 2–4 mm off the actual
 * v121 forehead surface. Never alter the original imported wig geometry.
 */
export function buildReferenceFringe(THREE,head,{
 color='#d2b17a',style='blunt',lengthMm=70,widthPct=100,forwardMm=0
}={}){
 const group=new THREE.Group();
 group.name='detachable-layered-bangs-'+style;
 if(style==='none')return group;
 if(!['blunt','center'].includes(style))throw Error('不正な前髪スタイルです');
 const count=88,layers=2,steps=20,sides=6;
 const pos=[],uv=[],idx=[],colors=[];
 const length=clamp(Number(lengthMm),30,115)/1000;
 const width=clamp(Number(widthPct),45,125)/100;
 const forward=clamp(Number(forwardMm),-20,35)/1000;
 const span=head.rx*.84*width,baseY=head.top-.024;
 const front=(x,y)=>{
  if(typeof head.frontAt==='function')return head.frontAt(x,y);
  const ratio=(x-head.cx)/Math.max(head.rx,.01);
  return head.cz+head.rz*Math.sqrt(Math.max(.05,1-ratio*ratio));
 };
 const lateral=t=>clamp(t,head.cx-head.rx*.97,head.cx+head.rx*.97);
 for(let layer=0;layer<layers;layer++)for(let i=0;i<count;i++){
  const u=(i+.5+(layer?.34:0))/count*2-1;
  // Recess the part rather than forming a blunt center wall.
  if(style==='center'&&Math.abs(u)<.075)continue;
  const id=i+layer*count;
  const jitter=Math.sin(id*2.399963);
  const rootX=head.cx+u*span+layer*.00045;
  const rootY=baseY+(layer?.004:0)+.0018*Math.sin(i*.53);
  const part=Math.sign(u)*(style==='center'?
    (.013+.014*(1-Math.min(1,Math.abs(u)))):0);
  const side=style==='blunt'?Math.sign(u)*Math.pow(Math.abs(u),3)*.006:0;
  const sweep=part+side;
  const tipLength=length*(style==='center'?(.97+.08*Math.abs(u)):(.96+.045*Math.abs(u)));
  const stagger=.0020*Math.sin(id*2.17)+.0012*Math.sin(i*.48);
  const tipY=rootY-tipLength+(layer?.004:0)+stagger;
  const xSpan=(2*span/count)*(.57+layer*.06);
  const start=pos.length/3;
  const current=(t)=>{
   const e=t*t*(3-2*t);
   const x=lateral(rootX+sweep*e+
     (.0008*Math.sin(i*.71+t*3.7)+.0005*jitter)*t);
   const y=lerp(rootY,tipY,t)+.0012*Math.sin(Math.PI*t);
   const skin=front(x,y);
   // The negative root clearance hides the seam INSIDE the cap.
   // The free tip stays close to actual forehead, not a planar curtain.
   const clearance=lerp(-.0035,.0030,e)+(layer?.0013:0);
   const z=skin+clearance+forward+
    .00085*Math.sin(i*.57+1.4*t)*Math.sin(Math.PI*t);
   return {x,y,z};
  };
  for(let j=0;j<steps;j++){
   const t=j/(steps-1),p=current(t);
   const taper=(.35+.65*Math.min(1,t/.18))*(1-.63*t*t);
   const half=Math.max(.00018,xSpan*taper);
   const thickness=(.00055+.00023*(1-t));
   const fiberTone=Math.max(.72,Math.min(1.0,
    .90+.065*Math.sin(i*1.93+layer*4)+.028*Math.sin(i*.49)));
   for(let k=0;k<sides;k++){
    const theta=2*Math.PI*k/sides;
    pos.push(p.x+half*Math.cos(theta),p.y,p.z+thickness*Math.sin(theta));
    uv.push((k/sides)*1.5+(i%7)*.04,t*2.6);
    const highlight=Math.max(.67,Math.min(1,fiberTone+.04*Math.cos(theta)+.018*Math.sin(t*23+i)));
    colors.push(highlight,highlight*.992,highlight*.978);
   }
  }
  const cap0=pos.length/3,first=current(0),last=current(1);
  pos.push(first.x,first.y,first.z,last.x,last.y,last.z);
  uv.push(.5,0,.5,2.6);
  colors.push(.9,.9,.9,.9,.9,.9);
  for(let j=0;j<steps-1;j++)for(let k=0;k<sides;k++){
   const next=(k+1)%sides;
   const a=start+j*sides+k,b=start+j*sides+next;
   idx.push(a,b,a+sides,b,b+sides,a+sides);
  }
  for(let k=0;k<sides;k++){
   const next=(k+1)%sides;
   idx.push(cap0,start+next,start+k);
   idx.push(cap0+1,start+(steps-1)*sides+k,start+(steps-1)*sides+next);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(pos.length),3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(idx);
 geo.computeVertexNormals();
 const texture=fringeTexture(THREE);
 const mat=new THREE.MeshStandardMaterial({
  color,roughness:.77,metalness:0,side:THREE.DoubleSide,vertexColors:true,
  ...(texture?{map:texture}:{})
 });
 const mesh=new THREE.Mesh(geo,mat);
 mesh.name='bangs-layered-tapered-fibers';
 mesh.castShadow=true;
 group.add(mesh);
 group.userData.dispose=()=>{geo.dispose();mat.dispose();texture?.dispose();};
 return group;
}


/**
 * v121 is the single coordinate authority for every CC0 style. This is a
 * separately textured *hair* under-cap generated from its actual triangles,
 * not a skin-head preview and not part of the MakeHuman source GLB.
 *
 * The cap is included in wig GLB, while the cyan head guide stays preview only.
 * Crown/temple/back cutoffs are asymmetric to keep eyes and face uncovered.
 */
/**
 * Hair-color underlay, built from the ACTUAL v121 scalp, not a fake sphere.
 *
 * Long hair already supplies its own continuous outer shell at the back.
 * An all-around head cap was protruding through it as a faceted oval patch.
 * Therefore the long style uses a small, inward-set FRONT hairline liner:
 * no rear triangles are generated at all. Other styles retain the existing
 * coverage envelope while also benefiting from smooth source normals.
 *
 * All source CC0 mesh geometry, original UVs, and hair textures are untouched.
 */
export function buildFittedScalpCap(THREE,head,{
 color='#d2b17a',style='bob01'
}={}){
 if(!head?.mesh?.geometry)throw Error('v121頭部メッシュがありません');
 head.mesh.updateWorldMatrix(true,false);
 const world=head.mesh.geometry.clone();
 world.applyMatrix4(head.mesh.matrixWorld);
 if(!world.getAttribute('normal'))world.computeVertexNormals();
 const src=world,p=src.getAttribute('position'),normals=src.getAttribute('normal');
 if(!p){world.dispose();throw Error('v121頭部の頂点データがありません');}
 const ind=src.getIndex(),n=Math.floor((ind?ind.count:p.count)/3);
 const positions=[],uvs=[],tints=[],smoothNormals=[];
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const v=new THREE.Vector3(),normal=new THREE.Vector3();
 const headCenterY=head.top-.12;
 const isLong=style==='long01';
 // Behind this plane the CC0 long-hair shell is the ONLY visible hair.
 const rearCutZ=head.cz+head.rz*.20;
 const spanX=Math.max(head.rx*2,.04),spanY=.22;
 const getPoint=(id,out)=>out.fromBufferAttribute(p,id);
 function floorAt(x,z){
  const forward=(z-head.cz)/Math.max(head.rz,.03);
  const lateral=Math.abs(x-head.cx)/Math.max(head.rx,.03);
  if(isLong){
   // Shallow root liner only, safely inside the front hairline.
   // It must never extend over the eyes or wrap around the back.
   return head.top-(forward>.65?.058:.072);
  }
  const drop=forward>.45?(lateral>.72?.124:.092):
    (forward>-.15?.137:.160);
  return head.top-drop;
 }
 for(let i=0;i<n;i++){
  const ai=ind?ind.getX(i*3):i*3;
  const bi=ind?ind.getX(i*3+1):i*3+1;
  const ci=ind?ind.getX(i*3+2):i*3+2;
  getPoint(ai,a);getPoint(bi,b);getPoint(ci,c);
  const verts=[a,b,c],ids=[ai,bi,ci];
  if(isLong&&verts.some(q=>q.z<rearCutZ))continue;
  if(verts.some(q=>q.y<floorAt(q.x,q.z)))continue;
  for(let j=0;j<3;j++){
   const q=verts[j],id=ids[j];
   // Long: slightly INSET from the head surface and behind the real wig.
   // Others retain previous outward clearance for their missing cap areas.
   v.set(q.x-head.cx,(q.y-headCenterY)*.82,q.z-head.cz);
   v.normalize().multiplyScalar(isLong?-.0016:.0027);
   positions.push(q.x+v.x,q.y+v.y,q.z+v.z);
   const u=(q.x-head.cx)/spanX+.5;
   const hairV=(head.top-q.y)/spanY;
   uvs.push(u*3.8,hairV*5.0);
   const shade=.93+.045*Math.sin(q.x*147+q.z*83);
   tints.push(shade,shade*.99,shade*.98);
   // Reuse smooth vertex normals from v121 instead of computing a new
   // hard normal for every duplicate triangle (the prior low-poly patch).
   normal.fromBufferAttribute(normals,id).normalize();
   smoothNormals.push(normal.x,normal.y,normal.z);
  }
 }
 world.dispose();
 if(positions.length<300)throw Error('v121頭部から髪キャップを構築できません');
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(smoothNormals,3));
 const texture=fringeTexture(THREE);
 const mat=new THREE.MeshStandardMaterial({
  color,roughness:.79,metalness:0,side:THREE.DoubleSide,
  vertexColors:true,...(texture?{map:texture}:{})
 });
 const mesh=new THREE.Mesh(geo,mat);
 mesh.name=isLong?'v121-inner-front-hairline-long-no-rear-cap':
  'v121-scalp-fitted-CC0-hair-under-cap';
 mesh.castShadow=true;
 const group=new THREE.Group();
 group.name='v121-hair-coverage-cap-not-skin';
 group.add(mesh);
 group.userData.dispose=()=>{geo.dispose();mat.dispose();texture?.dispose();};
 group.userData.triangleCount=positions.length/9;
 group.userData.style=style;
 group.userData.rearCutZ=isLong?rearCutZ:null;
 group.userData.longBackFacesExcluded=isLong;
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
