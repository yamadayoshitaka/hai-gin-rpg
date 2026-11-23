/**
 * Female hair 01 v4: build the hairstyle on the *actual* v121 skin triangles.
 *
 * No isolated crown cards, projected spherical helmets, or guessed roof
 * coordinates. Source face and eyebrows are strictly read-only.
 * Coordinates: pivot-local metres, forward +Z.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const noise=i=>{const n=Math.sin(i*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
const PARTS=['crown','fringe','left','right','back'];
const ZONE_COLOR={crown:0xd4c2e6,fringe:0x9be3b8,left:0xe8b0b8,right:0xe8b0b8,back:0xb8c9f1};
const EXPLODE={crown:[0,.045,0],fringe:[0,0,.045],left:[-.055,0,0],right:[.055,0,0],back:[0,0,-.055]};
const vec=(attr,i)=>[attr.getX(i),attr.getY(i),attr.getZ(i)];
function measure(THREE,skin,pivot,headSize){
 skin.updateWorldMatrix(true,false);
 pivot.updateWorldMatrix(true,false);
 const local=pivot.matrixWorld.clone().invert().multiply(skin.matrixWorld);
 const geometry=skin.geometry.clone();
 geometry.applyMatrix4(local);
 const p=geometry.getAttribute('position');
 if(!p||p.count<1000)throw Error('髪を装着するv121顔の実メッシュがありません');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,top=box.max.y;
 // Use upper cranium, never the shoulder/bust box, for the wig size.
 const skull=[];
 for(let i=0;i<p.count;i++){const v=vec(p,i);if(v[1]>top-.125)skull.push(v);}
 if(skull.length<500)throw Error('頭頂メッシュの実測点が不足しています');
 const xs=skull.map(v=>v[0]).sort((a,b)=>a-b);
 const zs=skull.map(v=>v[2]).sort((a,b)=>a-b);
 const q=(a,r)=>a[Math.floor((a.length-1)*r)];
 const centerX=(q(xs,.06)+q(xs,.94))*.5;
 const centerZ=(q(zs,.06)+q(zs,.94))*.5;
 const rx=Math.max(.06,(q(xs,.97)-q(xs,.03))*.5);
 const rz=Math.max(.06,(q(zs,.97)-q(zs,.03))*.5);
 // Eyebrow top is measured from the source GLB's EXISTING eyebrow mesh.
 // It is not guessed using facial slider percentages.
 let eyebrowTop=null;
 const ancestor=skin.parent;
 if(ancestor?.traverse)ancestor.traverse(node=>{
  if(!node.isMesh||!/EYEBROW/i.test(node.name)||!node.geometry?.getAttribute('position'))return;
  node.updateWorldMatrix(true,false);
  const m=pivot.matrixWorld.clone().invert().multiply(node.matrixWorld);
  const a=node.geometry.getAttribute('position');
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
   const e=m.elements;
   const py=e[1]*x+e[5]*y+e[9]*z+e[13];
   eyebrowTop=Math.max(eyebrowTop??-Infinity,py);
  }
 });
 if(!Number.isFinite(eyebrowTop))eyebrowTop=top-Math.min(.085,headSize.height*.34);
 return {geometry,p,box,top,brow:eyebrowTop,centerX,centerZ,rx,rz};
}

/** Clip each real skin triangle against a smooth hairline, preserving topology. */
function realScalpShell(THREE,h){
 const {geometry:g,p,top,brow,centerX,centerZ,rx,rz}=h;
 const normals=g.getAttribute('normal'),sourceIndex=g.getIndex();
 const count=Math.floor((sourceIndex?.count??p.count)/3),pos=[],normal=[],uv=[],colors=[],triangles=[];
 const hairline=(x,z)=>{
  const front=clamp((z-centerZ)/rz,0,1);
  const back=clamp((centerZ-z)/rz,0,1);
  const side=clamp(Math.abs(x-centerX)/rx,0,1);
  // Frontal hairline ends above real eyebrows, sides wrap temples and
  // rear continues down the skull. No forehead-wide helmet slab.
  return brow+.030*front+.002*side-.070*back;
 };
 const vertex=i=>{
  const [x,y,z]=vec(p,i);
  const n=normals?vec(normals,i):[0,1,0];
  return {x,y,z,n,dist:y-hairline(x,z)};
 };
 const lerp=(a,b,t)=>({
  x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,
  n:a.n.map((v,j)=>v+(b.n[j]-v)*t),dist:0
 });
 for(let t=0;t<count;t++){
  const ids=[0,1,2].map(j=>sourceIndex?sourceIndex.getX(t*3+j):t*3+j);
  let poly=ids.map(vertex),out=[];
  for(let k=0;k<3;k++){
   const a=poly[k],b=poly[(k+1)%3],insideA=a.dist>=0,insideB=b.dist>=0;
   if(insideA)out.push(a);
   if(insideA!==insideB)out.push(lerp(a,b,a.dist/(a.dist-b.dist)));
  }
  if(out.length<3)continue;
  const emit=v=>{
   const n=v.n,inv=1/(Math.hypot(...n)||1);
   const nx=n[0]*inv,ny=n[1]*inv,nz=n[2]*inv;
   // Genuine cranium offset 2.8mm, not an arbitrary head sphere.
   pos.push(v.x+nx*.0028,v.y+ny*.0028,v.z+nz*.0028);
   normal.push(nx,ny,nz);
   uv.push((v.x-centerX)/(rx*2)+.5,(v.z-centerZ)/(rz*2)+.5);
   const wave=Math.sin((v.x-centerX)*155+(v.z-centerZ)*38)*.022;
   const shade=.94+wave;
   colors.push(shade,shade*.994,shade*.982);
  };
  for(let k=1;k<out.length-1;k++){
   emit(out[0]);emit(out[k]);emit(out[k+1]);
  }
 }
 if(pos.length<1500)throw Error('実メッシュの連続した頭頂部が生成できません');
 const out=new THREE.BufferGeometry();
 out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 out.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
 out.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 out.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 out.computeBoundingSphere();
 g.dispose();
 return {geometry:out,triangles:pos.length/9,hairline};
}

/** Fast head-surface sampler: front/back from x+y and side from z+y. */
function sampleHeadSurface(p){
 const cell=.0075,front=new Map(),sides=new Map(),put=(map,a,b,value)=>{
  const k=Math.floor(a/cell)+','+Math.floor(b/cell);
  if(!map.has(k))map.set(k,[]);
  map.get(k).push([a,b,value]);
 };
 for(let i=0;i<p.count;i++){
  const [x,y,z]=vec(p,i);
  if(y<-.08)continue;
  put(front,x,y,z);
  put(sides,z,y,x);
 }
 const pick=(map,a,b,mode,fallback)=>{
  const ia=Math.floor(a/cell),ib=Math.floor(b/cell);
  let near=[],best=Infinity;
  for(let range=1;range<=5;range++){
   for(let x=-range;x<=range;x++)for(let y=-range;y<=range;y++){
    for(const v of map.get((ia+x)+','+(ib+y))||[]){
     const d=(v[0]-a)**2+(v[1]-b)**2;
     if(d<best){best=d;near=[v[2]];}else if(d<=best+.000025){near.push(v[2]);}
    }
   }
   if(near.length)break;
  }
  return near.length?(mode==='max'?Math.max(...near):Math.min(...near)):fallback;
 };
 return {
  front:(x,y,fallback)=>pick(front,x,y,'max',fallback),
  back:(x,y,fallback)=>pick(front,x,y,'min',fallback),
  side:(sign,y,z,fallback)=>pick(sides,z,y,sign>0?'max':'min',fallback)
 };
}
function makeSurface(THREE,name,columns,rows,vertex,shade,color){
 const p=[],c=[],uv=[],index=[],weights=[];
 for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
  const t=i/rows,u=j/columns,v=vertex(u,t,j,i);
  p.push(v[0],v[1],v[2]);uv.push(u,t*2.5);
  const intensity=.91+.072*(.5+.5*Math.cos(j*.68+Math.sin(t*3)*2.3))+
   .015*(noise(j*47+name.length)-.5);
  c.push(intensity,intensity*.992,intensity*.982);
  weights.push(smooth(t)*shade);
 }
 for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
  const a=i*(columns+1)+j,b=a+columns+1;
  index.push(a,b,a+1,b,b+1,a+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
 geo.setIndex(index);geo.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.86,metalness:0,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geo,material);mesh.name='v121-fitted-hair01-'+name;
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 return {mesh,triangles:index.length/3,original:new Float32Array(p),weights};
}
function makeFineFiberTexture(THREE){
 if(typeof document==='undefined'||!THREE.CanvasTexture)return null;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.fillStyle='#f3f0e9';ctx.fillRect(0,0,256,512);
 for(let i=0;i<640;i++){
  const x=(i*.619)%256,a=.035+.055*noise(i);
  ctx.strokeStyle=i%4?'rgba(85,64,42,'+a+')':'rgba(255,250,238,'+(a*1.5)+')';
  ctx.lineWidth=i%7===0?.7:.35;
  ctx.beginPath();ctx.moveTo(x,0);
  for(let y=30;y<=512;y+=30)ctx.lineTo(x+1.2*Math.sin(i*.37+y*.012),y);
  ctx.stroke();
 }
 const tex=new THREE.CanvasTexture(canvas);
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.colorSpace=THREE.SRGBColorSpace;
 return tex;
}
export function buildHair01FromScratch(THREE,skin,{referenceRoot,headSize,color='#c5a36f'}={}){
 if(!skin?.isMesh||!referenceRoot||!headSize)throw Error('顔v121の実頭部が必要です');
 const h=measure(THREE,skin,referenceRoot,headSize);
 const shell=realScalpShell(THREE,h);
 const sample=sampleHeadSurface(h.p);
 const root=new THREE.Group();root.name='female-hair01-native-scalp-wig-v4';
 const zones=new Map(),owned=[],counts={},deformers=[];
 const tex=makeFineFiberTexture(THREE);
 const scalpMaterial=new THREE.MeshStandardMaterial({
  color,vertexColors:true,roughness:.88,metalness:0,side:THREE.DoubleSide,
  ...(tex?{map:tex}:{})
 });
 const scalp=new THREE.Mesh(shell.geometry,scalpMaterial);
 scalp.name='real-v121-continuous-scalp-cap';
 scalp.castShadow=true;scalp.receiveShadow=true;scalp.frustumCulled=false;
 root.add(scalp);owned.push({geometry:shell.geometry,material:scalpMaterial});
 counts.crown=shell.triangles;
 const {brow,top,centerX:cx,centerZ:cz,rx,rz}=h;
 // Full-width solid fringe, seated on actual forehead, with scalloped tips.
 const bang=makeSurface(THREE,'fringe',56,12,(u,t,j)=>{
  const x=cx+(u*2-1)*rx*.83;
  const side=Math.abs(2*u-1);
  const startY=brow+.043-.011*side;
  const endY=brow+.012+.019*smooth(side)+.0015*Math.sin(j*1.9);
  const y=startY+(endY-startY)*smooth(t);
  const z=sample.front(x,y,cz+rz*.52)+.0038+.0032*t;
  return [x+.0035*Math.sin(t*Math.PI)*Math.sin(u*Math.PI),y,z];
 },.16,color);
 const sidePanels=[];
 for(const sign of [-1,1]){
  const name=sign<0?'left':'right';
  const a=makeSurface(THREE,name,32,23,(u,t,j)=>{
   const z0=cz+(u*2-1)*rz*.77;
   const y0=brow+.025-.020*smooth(Math.abs(2*u-1));
   const length=.19+.045*Math.sin(Math.PI*u)**2+.015*noise(j*7+sign*30);
   const y=y0-t*length;
   const shellX=sample.side(sign,y0,z0,cx+sign*rx*.90);
   const x=shellX+sign*(.004+(.021+.006*Math.sin(2*Math.PI*u))*smooth(t));
   const z=z0+.013*(u-.5)*smooth(t)+.010*smooth(t);
   return [x,y,z];
  },.85,color);sidePanels.push([name,a]);
 }
 const back=makeSurface(THREE,'back',48,25,(u,t,j)=>{
  const x=cx+(u*2-1)*rx*.89;
  const y0=brow+.030-.017*smooth(Math.abs(u*2-1));
  const y=y0-t*(.205+.033*(.5+.5*Math.cos(j*.75)));
  const z0=sample.back(x,y0,cz-rz*.75);
  return [x*(1+.10*smooth(t)),y,z0-.0035-.015*smooth(t)];
 },.85,color);
 const built=[['fringe',bang],...sidePanels,['back',back]];
 for(const [name,item] of built){
  const section=new THREE.Group();section.name='v121-hair01-section-'+name;
  section.add(item.mesh);root.add(section);
  zones.set(name,section);counts[name]=item.triangles;
  owned.push({geometry:item.mesh.geometry,material:item.mesh.material});
  deformers.push(item);
 }
 const crownZone=new THREE.Group();crownZone.name='v121-hair01-section-crown';
 zones.set('crown',crownZone); // crown is the fixed root mesh, not a floating strand.
 let currentColor=color,inspection=false,exploded=false;
 const baseline={...headSize};
 const fitToHead=next=>{
  root.scale.set(next.width/baseline.width,next.height/baseline.height,next.depth/baseline.depth);
  root.position.set(0,0,0);
  root.userData.fit={scale:root.scale.toArray(),position:[0,0,0],headSize:next,
   fitMethod:'direct-v121-skin-clip-with-connected-locks',scalpGap:.0028};
  return root.userData.fit;
 };
 const colors=()=>{scalpMaterial.color.set(inspection?ZONE_COLOR.crown:currentColor);
  for(const [name,group] of zones)for(const mesh of group.children){
   if(mesh.material?.color)mesh.material.color.set(inspection?ZONE_COLOR[name]:currentColor);
  }
 };
 const setSectionColors=v=>{inspection=!!v;colors();};
 const setExploded=v=>{
  exploded=!!v;
  for(const [name,group] of zones)group.position.set(...(exploded?EXPLODE[name]:[0,0,0]));
  scalp.visible=!exploded; // no scalp floating away in exploded diagnostic
  setSectionColors(exploded||inspection);
 };
 const deformTips=(dx=0,dz=0)=>{
  for(const entry of deformers){
   const {original,weights}=entry,a=entry.mesh.geometry.getAttribute('position');
   for(let i=0;i<weights.length;i++){
    const k=i*3,w=weights[i];
    a.array[k]=original[k]+dx*w*.24;
    a.array[k+1]=original[k+1];
    a.array[k+2]=original[k+2]+dz*w*.24;
   }
   a.needsUpdate=true;
  }
  return 0;
 };
 const dispose=()=>{
  root.removeFromParent();
  for(const v of owned){v.geometry.dispose();v.material.dispose();}
  tex?.dispose?.();
 };
 fitToHead(baseline);
 // No source GLB is read; intact face/eyebrows are not mutated.
 return {root,cap:null,sectionCounts:counts,fitToHead,deformTips,dispose,
  setSectionColors,setExploded,setSectionVisible:(name,v)=>{
   if(name==='crown')scalp.visible=!!v;
   else if(zones.has(name))zones.get(name).visible=!!v;
  },
  setColor:v=>{currentColor=v;colors();},
  cleanupStats:{removedTriangles:0,removedComponents:0},
  diagnostics:()=>({rebuilt:true,legacySourceUsed:false,crownTriangles:shell.triangles,
   browY:brow,fringeTipY:brow+.012,sourceVertexCount:h.p.count,
   crownMethod:'clipped-original-skin-triangles',connectedPanels:4,
   triangles:Object.values(counts).reduce((a,b)=>a+b,0)})};
}
