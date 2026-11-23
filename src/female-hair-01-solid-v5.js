/**
 * Female Hair 01 v5 — new implementation, no prior hair generator imports.
 * The v121 skin is the ONLY geometric input. Hair is made by:
 *   1. copying the original cranial triangles,
 *   2. closing their clipped border as a finite-thickness shell,
 *   3. extending that very same border into bangs/side/back hair,
 *   4. sculpting the extension and applying damped strand motion.
 * The original face, eyes, brows and skin buffers are never modified.
 */
const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=limit(t,0,1);return t*t*(3-2*t);};
const hash=n=>{const t=Math.sin(n*83.173+13.52)*45326.57;return t-Math.floor(t);};
const COLOR_SECTIONS=['crown','fringe','left','right','back'];
const EXAM_COLORS=[0xcaa9ea,0xbbe4bf,0xf2bcbc,0xf2bcbc,0xb5cde9];
function vector(attr,i){return [attr.getX(i),attr.getY(i),attr.getZ(i)];}
function id3(v){return v.map(n=>Math.round(n*1e5)).join(':');}
function boundsOf(geo){
 geo.computeBoundingBox();
 return geo.boundingBox;
}
function skinInHeadSpace(skin,pivot){
 skin.updateWorldMatrix(true,false);pivot.updateWorldMatrix(true,false);
 const transform=pivot.matrixWorld.clone().invert().multiply(skin.matrixWorld);
 const copy=skin.geometry.clone();copy.applyMatrix4(transform);
 return copy;
}
function browElevation(skin,pivot,top,headSize){
 let highest=-Infinity;
 // Actual v121 eyebrow fibers are an independent mesh. Their upper extent
 // is a stable facial measurement unlike a head-height percentage.
 const parent=skin.parent;
 if(parent?.traverse)parent.traverse(node=>{
  if(!node.isMesh||!/eyebrow/i.test(node.name)||!node.geometry?.getAttribute('position'))return;
  node.updateWorldMatrix(true,false);
  const m=pivot.matrixWorld.clone().invert().multiply(node.matrixWorld);
  const a=node.geometry.getAttribute('position');
  // Transform manually, avoiding a global THREE object in unit tests.
  const e=m.elements;
  if(!e||e.length!==16)return;
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
   highest=Math.max(highest,e[1]*x+e[5]*y+e[9]*z+e[13]);
  }
 });
 return Number.isFinite(highest)?highest:top-Math.min(.076,headSize.height*.31);
}
function actualHeadAnatomy(geo,eyebrowTop){
 const p=geo.getAttribute('position'),box=boundsOf(geo),top=box.max.y,upper=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  if(y>top-.135 && y<top+.001)upper.push([x,y,z]);
 }
 if(upper.length<280)throw Error('頭部の実際の頭頂メッシュ頂点が不足しています');
 const xs=upper.map(v=>v[0]).sort((a,b)=>a-b),
       zs=upper.map(v=>v[2]).sort((a,b)=>a-b);
 const at=(a,f)=>a[Math.round((a.length-1)*f)];
 const cx=(at(xs,.04)+at(xs,.96))/2;
 const cz=(at(zs,.04)+at(zs,.96))/2;
 const rx=Math.max(.055,(at(xs,.97)-at(xs,.03))/2);
 const rz=Math.max(.06,(at(zs,.97)-at(zs,.03))/2);
 return {cx,cz,rx,rz,top,brow:eyebrowTop};
}
/** True head-local hairline: short on the forehead, lower on side and rear. */
export function headDerivedHairline(x,z,h){
 const radialAngle=Math.abs(Math.atan2(x-h.cx,z-h.cz));
 const front=1-smooth((radialAngle-.35)/.6);
 const back=smooth((radialAngle-1.4)/1.3);
 return h.brow+.018+.017*front-.018*(1-front)-.045*back;
}
/** Full blunt fringe in front, tapering smoothly to long side/rear lengths. */
export function headDerivedLength(x,z,h){
 const angle=Math.abs(Math.atan2(x-h.cx,z-h.cz));
 const side=smooth((angle-.49)/.80);
 const tipNoise=.005*(hash(Math.floor(angle*68)+Math.sign(x-h.cx)*71)-.5);
 return .025+.193*side+tipNoise;
}
function buildClippedCranium(source,h){
 const positions=source.getAttribute('position');
 const normals=source.getAttribute('normal');
 const index=source.getIndex(),triangles=Math.floor((index?.count??positions.count)/3);
 const verts=[],faces=[],vertexKeys=new Map();
 const threshold=v=>v.y-headDerivedHairline(v.x,v.z,h);
 const get=i=>{
  const a=vector(positions,i),n=normals?vector(normals,i):[0,1,0];
  return {x:a[0],y:a[1],z:a[2],n};
 };
 const interpolate=(a,b,t)=>({
  x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,
  n:a.n.map((v,i)=>v+(b.n[i]-v)*t)
 });
 const register=v=>{
  const key=id3([v.x,v.y,v.z]);
  if(vertexKeys.has(key))return vertexKeys.get(key);
  const id=verts.length;verts.push(v);vertexKeys.set(key,id);return id;
 };
 for(let i=0;i<triangles;i++){
  const triangle=[0,1,2].map(k=>get(index?index.getX(i*3+k):i*3+k));
  const clipped=[];
  for(let j=0;j<3;j++){
   const a=triangle[j],b=triangle[(j+1)%3],
    ta=threshold(a),tb=threshold(b),insideA=ta>=0,insideB=tb>=0;
   if(insideA)clipped.push(a);
   if(insideA!==insideB)clipped.push(interpolate(a,b,ta/(ta-tb)));
  }
  if(clipped.length<3)continue;
  const root=register(clipped[0]);
  for(let j=1;j<clipped.length-1;j++){
   const a=register(clipped[j]),b=register(clipped[j+1]);
   if(root!==a&&a!==b&&root!==b)faces.push([root,a,b]);
  }
 }
 if(faces.length<650)throw Error('実頭皮の連続面が十分に生成できません');
 const edges=new Map();
 for(const tri of faces)for(let j=0;j<3;j++){
  const a=tri[j],b=tri[(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
  const prev=edges.get(key);
  if(prev)prev.uses++;
  else edges.set(key,{a,b,uses:1});
 }
 const boundary=[...edges.values()].filter(e=>e.uses===1);
 if(boundary.length<35)throw Error('実頭皮の生え際境界を計測できません');
 return {verts,faces,boundary};
}
function makeFiberMap(THREE){
 if(typeof document==='undefined'||!THREE.CanvasTexture)return null;
 const cv=document.createElement('canvas');cv.width=256;cv.height=512;
 const g=cv.getContext('2d');if(!g)return null;
 g.fillStyle='#f3f0eb';g.fillRect(0,0,256,512);
 for(let i=0;i<590;i++){
  const x=(i*1.637)%256,t=hash(i);
  g.lineWidth=i%9===0?.75:.36;
  g.strokeStyle=i%4===0?'rgba(94,71,48,'+(.035+.08*t)+')':
   'rgba(255,249,227,'+(.05+.08*t)+')';
  g.beginPath();g.moveTo(x,0);
  for(let y=32;y<=512;y+=32)g.lineTo(x+Math.sin(y*.01+i*.27)*1.2,y);
  g.stroke();
 }
 const result=new THREE.CanvasTexture(cv);
 result.colorSpace=THREE.SRGBColorSpace;
 result.wrapS=result.wrapT=THREE.RepeatWrapping;
 return result;
}
function createHairBody(THREE,head,anatomy,color){
 const {verts,faces,boundary}=head;
 const vertices=[],colorData=[],uvData=[],triByPart=COLOR_SECTIONS.map(()=>[]),motions=[];
 const size=verts.length,insideStart=size;
 const register=(v,part,weight)=>{
  const id=vertices.length/3;vertices.push(v[0],v[1],v[2]);
  motions.push({weight,part,angle:Math.atan2(v[0]-anatomy.cx,v[2]-anatomy.cz)});
  const strand=Math.sin((v[0]-anatomy.cx)*185+(v[2]-anatomy.cz)*53)*.015;
  const brightness=part===0?.94:.88+strand;
  colorData.push(brightness,brightness*.997,brightness*.987);
  uvData.push((Math.atan2(v[0]-anatomy.cx,v[2]-anatomy.cz)+Math.PI)/(Math.PI*2)*6,
   (anatomy.top-v[1])*16);
  return id;
 };
 for(const p of verts){
  const n=p.n,mag=Math.hypot(...n)||1;
  const d=[n[0]/mag,n[1]/mag,n[2]/mag];
  const f=smooth((p.y-anatomy.brow)/Math.max(.04,anatomy.top-anatomy.brow));
  const groove=Math.sin(p.x*128+p.z*72)*.00055;
  const offset=.0031+.0015*f+groove;
  register([p.x+d[0]*offset,p.y+d[1]*offset,p.z+d[2]*offset],0,0);
 }
 for(const p of verts){
  const n=p.n,mag=Math.hypot(...n)||1;
  register([p.x+n[0]/mag*.00065,p.y+n[1]/mag*.00065,p.z+n[2]/mag*.00065],0,0);
 }
 for(const [a,b,c] of faces){
  triByPart[0].push(a,b,c,c+insideStart,b+insideStart,a+insideStart);
 }
 const steps=12,outer=new Map(),inner=new Map();
 const partOf=(x,z)=>{
  const angle=Math.atan2(x-anatomy.cx,z-anatomy.cz),a=Math.abs(angle);
  if(a<.62)return 1;
  if(a>2.34)return 4;
  return angle<0?2:3;
 };
 const extruded=(id,row,inside)=>{
  if(row===0)return id+(inside?insideStart:0);
  const key=id+':'+row,map=inside?inner:outer;
  if(map.has(key))return map.get(key);
  const p=verts[id],t=row/steps,dist=Math.hypot(p.x-anatomy.cx,p.z-anatomy.cz)||1,
    ex=(p.x-anatomy.cx)/dist,ez=(p.z-anatomy.cz)/dist,
    angle=Math.atan2(p.x-anatomy.cx,p.z-anatomy.cz),abs=Math.abs(angle);
  const length=headDerivedLength(p.x,p.z,anatomy);
  const curve=smooth(t),front=1-smooth((abs-.36)/.72);
  const x=p.x+ex*(.002+.014*curve)+Math.sin(angle*4)*.003*curve;
  const y=p.y-length*t+.002*Math.sin(t*Math.PI);
  const z=p.z+ez*(.002+.014*curve)+.003*front*curve;
  const offset=inside?.0008:.0035;
  const part=partOf(p.x,p.z);
  const v=[x+ex*offset,y,z+ez*offset],weight=t*t*(3-2*t);
  const out=register(v,part,weight);
  map.set(key,out);return out;
 };
 for(const e of boundary){
  const {a,b}=e,part=partOf((verts[a].x+verts[b].x)*.5,(verts[a].z+verts[b].z)*.5);
  for(let row=0;row<steps;row++){
   const a0=extruded(a,row,false),b0=extruded(b,row,false);
   const a1=extruded(a,row+1,false),b1=extruded(b,row+1,false);
   triByPart[part].push(a0,b0,a1,b0,b1,a1);
   const ia0=extruded(a,row,true),ib0=extruded(b,row,true);
   const ia1=extruded(a,row+1,true),ib1=extruded(b,row+1,true);
   triByPart[part].push(ia0,ia1,ib0,ib0,ia1,ib1);
  }
  const ao=extruded(a,steps,false),bo=extruded(b,steps,false);
  const ai=extruded(a,steps,true),bi=extruded(b,steps,true);
  triByPart[part].push(ao,bo,ai,bo,bi,ai);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvData,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colorData,3));
 let all=[],counts={}; 
 for(let i=0;i<triByPart.length;i++){
  geo.addGroup(all.length,triByPart[i].length,i);
  all=all.concat(triByPart[i]);
  counts[COLOR_SECTIONS[i]]=triByPart[i].length/3;
 }
 geo.setIndex(all);geo.computeVertexNormals();geo.computeBoundingSphere();
 const map=makeFiberMap(THREE);
 const materials=COLOR_SECTIONS.map(()=>new THREE.MeshStandardMaterial({
  color,roughness:.82,metalness:0,vertexColors:true,side:THREE.DoubleSide,
  ...(map?{map}:{})
 }));
 const mesh=new THREE.Mesh(geo,materials);
 mesh.name='v121-native-extruded-single-solid-groomed-hair01-v5';
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 return {mesh,materials,map,base:new Float32Array(vertices),motions,counts,verts,
  diagnostic:{crownTriangles:faces.length,scalpVertices:verts.length,
   borderEdges:boundary.length,generatedVertices:vertices.length/3,
   connectedFromOriginalSkin:true,thickDoubleSurface:true}};
}
export function buildHeadDerivedHair01(THREE,skin,{referenceRoot,headSize,color='#c5a36f'}={}){
 if(!skin?.isMesh||!referenceRoot||!headSize)throw Error('v121の実頭部メッシュが必要です');
 const source=skinInHeadSpace(skin,referenceRoot);
 const eyebrow=browElevation(skin,referenceRoot,source.boundingBox?.max?.y||headSize.height*.5,headSize);
 const anatomy=actualHeadAnatomy(source,eyebrow);
 // If the face's parent scene uses a different transform, update brow from
 // transformed actual crown height rather than a guessed head-height offset.
 if(eyebrow>anatomy.top-.025||eyebrow<anatomy.top-.15)
  anatomy.brow=anatomy.top-.076;
 const scalp=buildClippedCranium(source,anatomy);
 source.dispose();
 const solid=createHairBody(THREE,scalp,anatomy,color);
 const root=new THREE.Group();root.name='hair01-head-mesh-solid-sculpt-v5';root.add(solid.mesh);
 const firstSize={...headSize};
 let tint=color,diagnostic=false,exploded=false,clock=0,dx=0,dz=0,vx=0,vz=0;
 const pos=solid.mesh.geometry.getAttribute('position');
 const resetVerts=()=>{
  const a=pos.array,b=solid.base;
  for(let i=0;i<solid.motions.length;i++){
   const m=solid.motions[i],k=i*3,w=m.weight;
   const wave=1+.14*Math.sin(m.angle*2.3+clock*2);
   const lift=exploded?.038*w:0;
   a[k]=b[k]+dx*w*wave+Math.sin(m.angle)*lift;
   a[k+1]=b[k+1]+lift*.5;
   a[k+2]=b[k+2]+dz*w*wave+Math.cos(m.angle)*lift;
  }
  pos.needsUpdate=true;
  solid.mesh.geometry.computeVertexNormals();
 };
 const fitToHead=(size=firstSize)=>{
  root.scale.set(size.width/firstSize.width,size.height/firstSize.height,
   size.depth/firstSize.depth);
  root.position.set(0,0,0);
  root.userData.fit={scale:root.scale.toArray(),position:[0,0,0],headSize:size,
   fitMethod:'one-extruded-v121-skin-mesh',scalpGap:.0031};
  return root.userData.fit;
 };
 const paint=()=>{
  solid.materials.forEach((m,i)=>m.color.set(diagnostic?EXAM_COLORS[i]:tint));
 };
 const updateMotion=(dt,{motion='idle',wind=0,time=clock}={})=>{
  clock=Number.isFinite(time)?time:clock+dt;dt=limit(dt,1/240,.05);
  const amplitude=motion==='run'?1.65:motion==='walk'?1:motion==='turn'?.85:.3;
  const pace=motion==='run'?12:motion==='walk'?7:motion==='turn'?3:1.7;
  const tx=Math.sin(clock*pace)*.009*amplitude+Math.sin(clock*1.3)*.005*wind;
  const tz=Math.cos(clock*pace*.78)*.006*amplitude+Math.cos(clock*1.1)*.006*wind;
  const k=30,d=9.5;
  vx+=(k*(tx-dx)-d*vx)*dt;vz+=(k*(tz-dz)-d*vz)*dt;
  dx=limit(dx+vx*dt,-.039,.039);dz=limit(dz+vz*dt,-.035,.035);
  resetVerts();return {dx,dz};
 };
 const deformTips=(x=0,z=0)=>{
  dx=limit(x,-.035,.035);dz=limit(z,-.035,.035);resetVerts();return 0;
 };
 const setSectionVisible=(name,enabled)=>{
  const i=COLOR_SECTIONS.indexOf(name);
  if(i>=0)solid.materials[i].visible=Boolean(enabled);
 };
 const dispose=()=>{
  root.removeFromParent();solid.mesh.geometry.dispose();
  for(const m of solid.materials)m.dispose();solid.map?.dispose?.();
 };
 fitToHead();
 return {
  root,cap:null,cleanupStats:{removedTriangles:0,removedComponents:0},
  sectionCounts:solid.counts,fitToHead,updateMotion,deformTips,dispose,
  setSectionVisible,setSectionColors:v=>{diagnostic=!!v;paint();},
  setExploded:v=>{exploded=!!v;resetVerts();},
  setColor:value=>{tint=value;paint();},
  diagnostics:()=>({...solid.diagnostic,
   browY:anatomy.brow,topY:anatomy.top,sourceHeadOnly:true,
   reusedFormerHairGeometry:false,singleContiguousThickWig:true,
   motion:'damped-root-fixed-vertex-sway'})
 };
}
