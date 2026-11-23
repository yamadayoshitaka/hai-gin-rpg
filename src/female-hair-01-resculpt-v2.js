/**
 * Female Hair 01 — full rebuild against the original v121 cranium.
 * Do not reuse the corrupt CC-BY hair geometry, its cap, or orphan cards.
 * This builds a head-conformal opaque crown and continuous raised locks.
 * Positive Z is forward. Units are metres. Face, brows and eyes are read only.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const rand=n=>{const x=Math.sin(n*129.3387+78.233)*43758.5453;return x-Math.floor(x);};
const DEBUG={crown:0xdcc5a0,fringe:0xe4c5a1,left:0xe3a5a5,right:0xe3a5a5,back:0xb9cde8};
const PARTS=['crown','fringe','left','right','back'];
const EXPLODE={crown:[0,.065,0],fringe:[0,0,.07],left:[-.08,0,0],right:[.08,0,0],back:[0,-.018,-.08]};
function headRoof(geometry,top,width,depth){
 const pos=geometry.getAttribute('position'),cell=.009,grid=new Map();
 const idx=x=>Math.floor(x/cell);
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  if(y<top-.17||Math.abs(x)>width*.64||Math.abs(z)>depth*.64)continue;
  const key=idx(x)+','+idx(z);
  if(!grid.has(key))grid.set(key,[]);
  grid.get(key).push([x,y,z]);
 }
 return (x,z)=>{
  const a=idx(x),b=idx(z);
  let total=0,weight=0,nearest=Infinity,nearY=top-.075;
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
   for(const p of grid.get((a+dx)+','+(b+dz))||[]){
    const d=(p[0]-x)**2+(p[2]-z)**2;
    if(d<nearest){nearest=d;nearY=p[1];}
    if(d<.0005){const w=1/(d+.000015);total+=p[1]*w;weight+=w;}
   }
  }
  if(weight)return clamp(total/weight,top-.17,top);
  const nx=x/(width*.53),nz=z/(depth*.53);
  const fallback=top-.13*(1-Math.sqrt(Math.max(0,1-clamp(nx*nx+nz*nz,0,1))));
  return nearest<.0025?nearY:fallback;
 };
}
function ribbonMesh(THREE,part,ribbons,color){
 const vertices=[],colors=[],uvs=[],indices=[];
 for(let n=0;n<ribbons.length;n++){
  const {path,width,seed,forward}=ribbons[n];
  if(path.length<2)continue;
  const base=vertices.length/3,rows=path.length;
  for(let i=0;i<rows;i++){
   const t=i/(rows-1),p=path[i],prev=path[Math.max(i-1,0)],next=path[Math.min(i+1,rows-1)];
   const dx=next[0]-prev[0],dz=next[2]-prev[2];
   let sx=-dz,sz=dx,len=Math.hypot(sx,sz);
   if(len<1e-5){sx=forward[0];sz=forward[2];len=Math.hypot(sx,sz)||1;}
   sx/=len;sz/=len;
   const taper=Math.pow(Math.sin(Math.PI*(.055+.89*t)),.55);
   const half=width*.5*clamp(taper,.1,1.02)*(1-.26*ease(t));
   const outLen=Math.hypot(p[0],p[2])||1;
   let ox=p[0]/outLen,oy=part==='crown'?.9:part==='fringe'?.35:.12,oz=p[2]/outLen;
   const ol=Math.hypot(ox,oy,oz)||1;ox/=ol;oy/=ol;oz/=ol;
   const thickness=.0015+.001*rand(seed+7);
   for(let k=0;k<5;k++){
    const u=(k-2)/2,bulge=Math.sqrt(Math.max(0,1-u*u))*thickness;
    vertices.push(p[0]+sx*half*u+ox*bulge,p[1]+oy*bulge,p[2]+sz*half*u+oz*bulge);
    const shine=.82+.13*Math.cos(u*Math.PI*.5)+.065*(rand(seed*17+k*31)-.5)+.025*Math.sin(i*1.9+n*2.1);
    colors.push(shine,shine*.995,shine*.97);uvs.push((u+1)*.5,t*3);
   }
  }
  for(let i=0;i<rows-1;i++)for(let k=0;k<4;k++){
   const a=base+i*5+k,b=a+5;
   indices.push(a,b,a+1,b,b+1,a+1);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.79,metalness:0,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='fresh-female-hair01-'+part;
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 return {mesh,triangles:indices.length/3};
}
const path=(n,fn)=>Array.from({length:n},(_,i)=>fn(i/(n-1),i));
function topLocks(h,roof){
 const {width:w,depth:d}=h,ribbons=[];
 // Overlapping left/right swept clumps from a fine parting, not a circular plate.
 for(const side of [-1,1])for(let i=0;i<66;i++){
  const startZ=-d*.30+d*.67*(i+.5)/66,startX=side*(.003+.004*rand(i*11+side*17));
  const endX=side*w*(.45+.036*rand(i*3+13));
  const zFlow=(rand(i*19+7)-.5)*.018;
  ribbons.push({path:path(15,t=>{
    const k=ease(t),x=startX+(endX-startX)*k;
    const z=startZ+zFlow*k+.011*Math.sin(Math.PI*t)*side;
    return [x,roof(x,z)+.0054+.0022*rand(i*7+19)+.0011*Math.sin(t*12+i),z];
   }),width:.0084+.0038*rand(i*6+side*3),seed:i+side*1000,forward:[0,1,0]});
 }
 // Rear combing is separate so there is never an untextured vertex fan.
 for(let i=0;i<48;i++){
  const x=w*.42*((i+.5)/48*2-1);
  ribbons.push({path:path(14,t=>{
    const z=-.015-d*.43*ease(t),xx=x*(.5+.5*ease(t));
    return [xx,roof(xx,z)+.0064+.0008*Math.sin(i*1.7),z];
   }),width:.006+.003*rand(13*i+4),seed:2000+i,forward:[1,0,0]});
 }
 return ribbons;
}
function frontLocks(h,roof){
 const {width:w,depth:d,height:y}=h,top=y*.5,ribbons=[];
 for(let i=0;i<38;i++){
  const lateral=(i+.5)/38*2-1,x0=lateral*w*.42;
  const endY=top-y*(.37+.042*rand(i*23+3)); // above eyebrows, not the eyes
  const p=path(13,t=>{
   const x=x0+.0036*Math.sin(i*.9)*t,z=d*(.28+.30*ease(t));
   const startY=Math.max(endY+.035,roof(x,d*.28)+.009);
   return [x,startY+(endY-startY)*ease(t),z];
  });
  ribbons.push({path:p,width:.0068+.003*rand(i*9),seed:4000+i,forward:[1,0,0]});
 }
 for(const side of [-1,1])for(let i=0;i<10;i++){
  const x=w*side*(.42+.025*rand(i*41)),z=d*(.22+.035*rand(i*37));
  const y0=roof(x*.88,z)+.012;
  ribbons.push({path:path(15,t=>[
   x+side*.01*t,y0-(.095+.035*rand(i*3))*ease(t),z+.007*Math.sin(Math.PI*t)
  ]),width:.0068+.0035*rand(i*7),seed:4300+i+side*100,forward:[0,0,1]});
 }
 return ribbons;
}
function sideLocks(h,roof,side){
 const {width:w,depth:d,height:y}=h,ribbons=[];
 for(let i=0;i<42;i++){
  const t0=(i+.45)/42,j=rand(i*17+side*111),back=t0>.64;
  const z0=d*(.47-t0*.63),x0=side*w*(.40+.048*j);
  const y0=clamp(roof(x0*.92,z0)+.009,-.019,y*.5-.017);
  const length=(back?.22:.27)+.036*j;
  ribbons.push({path:path(18,t=>{
   const bend=ease(t);
   return [x0+side*(.020*bend+.008*Math.sin(Math.PI*t)+(j-.5)*.013*t),
    y0-length*t,z0+(back?-.012:.053)*bend+Math.sin(t*7+i*2.3)*.0028*bend];
  }),width:.0062+.0055*rand(i*13+3),seed:5000+i+side*200,forward:[0,0,1]});
 }
 return ribbons;
}
function backLocks(h,roof){
 const {width:w,depth:d}=h,ribbons=[];
 for(let i=0;i<55;i++){
  const side=(i+.5)/55*2-1,r=rand(i*23+10);
  const x0=side*w*.42,z0=-d*(.34+.07*r),y0=clamp(roof(x0,z0)+.008,-.015,.095);
  ribbons.push({path:path(18,t=>{
   const fall=ease(t);
   return [x0+side*.027*fall+.002*Math.sin(i*2+t*9)*fall,
    y0-(.25+.03*r)*t,z0-.03*fall-.0035*Math.cos(t*7+i)*fall];
  }),width:.008+.005*rand(i*29),seed:6200+i,forward:[1,0,0]});
 }
 return ribbons;
}
function crownShell(THREE,skin,referenceRoot,h){
 skin.updateWorldMatrix(true,false);referenceRoot.updateWorldMatrix(true,false);
 const matrix=referenceRoot.matrixWorld.clone().invert().multiply(skin.matrixWorld);
 const geometry=skin.geometry.clone();geometry.applyMatrix4(matrix);
 const p=geometry.getAttribute('position'),norm=geometry.getAttribute('normal');
 const top=h.height*.5;
 const covered=i=>{
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const front=clamp(z/(h.depth*.5),0,1),back=clamp(-z/(h.depth*.5),0,1);
  const cut=top-h.height*(.55-.18*front+.22*back);
  return y>=cut&&Math.abs(x)<h.width*.67&&Math.abs(z)<h.depth*.65;
 };
 const originalIndex=geometry.getIndex(),n=Math.floor((originalIndex?.count||p.count)/3),kept=[];
 for(let i=0;i<n;i++){
  const a=originalIndex?originalIndex.getX(i*3):i*3;
  const b=originalIndex?originalIndex.getX(i*3+1):i*3+1;
  const c=originalIndex?originalIndex.getX(i*3+2):i*3+2;
  if(covered(a)&&covered(b)&&covered(c))kept.push(a,b,c);
 }
 if(kept.length<1300)throw Error('v121の頭頂形状が読み取れません（不完全な髪は表示しません）');
 // 3.2mm ABOVE the real cranium, but BELOW new 5-8mm raised strands.
 for(let i=0;i<p.count;i++){
  p.setXYZ(i,p.getX(i)+(norm?.getX(i)||0)*.0032,
   p.getY(i)+(norm?.getY(i)||0)*.0032,
   p.getZ(i)+(norm?.getZ(i)||0)*.0032);
 }
 geometry.setIndex(kept);geometry.clearGroups();geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {geometry,triangles:kept.length/3};
}
export function buildHair01FromScratch(THREE,skin,{referenceRoot,headSize,headScalp,color='#c5a36f'}={}){
 if(!skin?.isMesh||!referenceRoot)throw Error('顔v121実メッシュが必要です');
 const size={width:headSize.width,height:headSize.height,depth:headSize.depth};
 const root=new THREE.Group();root.name='female-hair-01-fully-resculpted-v2';
 const crown=crownShell(THREE,skin,referenceRoot,size);
 const scalpMaterial=new THREE.MeshStandardMaterial({color,roughness:.8,metalness:0,side:THREE.DoubleSide});
 const shell=new THREE.Mesh(crown.geometry,scalpMaterial);
 shell.name='actual-v121-head-conformal-continuous-hair-crown';
 shell.castShadow=true;shell.receiveShadow=true;root.add(shell);
 // Percentile head-size controls under-report lateral extents on v121.
 // Sample the actual covered scalp box for every lock root; otherwise side
 // hair can start buried inside the cheeks while only its tips protrude.
 const bbox=crown.geometry.boundingBox;
 const sculptureSize={...size,
  width:Math.max(size.width,bbox.max.x-bbox.min.x),
  depth:Math.max(size.depth,bbox.max.z-bbox.min.z)};
 const roof=headRoof(crown.geometry,bbox.max.y,sculptureSize.width,sculptureSize.depth);
 const plan={crown:topLocks(sculptureSize,roof),fringe:frontLocks(sculptureSize,roof),
  left:sideLocks(sculptureSize,roof,-1),right:sideLocks(sculptureSize,roof,1),
  back:backLocks(sculptureSize,roof)};
 const zones=new Map(),owned=[crown.geometry],materials=[scalpMaterial];
 const counts={crown:crown.triangles,fringe:0,left:0,right:0,back:0};
 for(const part of PARTS){
  const group=new THREE.Group();group.name='native-rebuild-'+part;root.add(group);zones.set(part,group);
  const result=ribbonMesh(THREE,part,plan[part],color);group.add(result.mesh);
  owned.push(result.mesh.geometry);materials.push(result.mesh.material);counts[part]+=result.triangles;
 }
 let tint=color,breakdown=false,exploded=false;
 const fitToHead=(next=size)=>{
  root.scale.set(next.width/size.width,next.height/size.height,next.depth/size.depth);
  root.position.set(0,0,0);
  root.userData.fit={scale:root.scale.toArray(),position:[0,0,0],headSize:next,
   fitMethod:'v121-actual-scalp-complete-remesh',scalpGap:.0032};
  return root.userData.fit;
 };
 const setSectionColors=enabled=>{
  breakdown=Boolean(enabled);scalpMaterial.color.set(breakdown?DEBUG.crown:tint);
  for(const [part,g] of zones)g.children[0].material.color.set(breakdown?DEBUG[part]:tint);
 };
 const setExploded=enabled=>{
  exploded=Boolean(enabled);
  for(const [part,g] of zones)g.position.set(...(exploded?EXPLODE[part]:[0,0,0]));
  setSectionColors(exploded||breakdown);
 };
 // Motion is bounded and applied to entire ribbon rows; no per-vertex collision shredding.
 const originals=[...zones.values()].map(g=>{
  const p=g.children[0].geometry.getAttribute('position');
  return {p,original:new Float32Array(p.array)};
 });
 const deformTips=(dx=0,dz=0)=>{
  for(let k=0;k<PARTS.length;k++){
   const part=PARTS[k],{p,original}=originals[k];
   for(let i=0;i<p.count;i++){
    const j=i*3,y=original[j+1];
    const factor=part==='crown'?0:clamp((size.height*.25-y)/.4,0,1)**1.5;
    p.array[j]=original[j]+dx*factor*.35;
    p.array[j+2]=original[j+2]+dz*factor*.35;
   }
   p.needsUpdate=true;
  }
  return 0;
 };
 const dispose=()=>{root.removeFromParent();for(const g of owned)g.dispose();for(const m of materials)m.dispose();};
 fitToHead(size);
 return {root,cap:null,cleanupStats:{removedTriangles:0,removedComponents:0},
  sectionCounts:counts,fitToHead,deformTips,dispose,setSectionColors,setExploded,
  setSectionVisible:(part,value)=>{if(zones.has(part))zones.get(part).visible=Boolean(value);},
  setColor:value=>{tint=value;setSectionColors(breakdown);},
  diagnostics:()=>({headFit:root.userData.fit,crownTriangles:crown.triangles,
   rebuilt:true,legacySourceUsed:false,opaqueCrown:true,
   triangles:Object.values(counts).reduce((a,b)=>a+b,0)})};
}
