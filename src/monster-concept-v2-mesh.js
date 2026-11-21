/**
 * Concept-sheet geometry toolkit (2026-11-21, second pass).
 *
 * Tangent-space chitin, conforming carapace plates, real swept tapered limbs,
 * cup banks and a single flowing slime shell.  Geometry is intentionally
 * original and not a billboard, GLB placeholder, or two intersecting spheres.
 *
 * All custom meshes own their geometries. One material per actor/role is
 * disposed by the standard disposeMonsterSculpture traversal.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const UP=new THREE.Vector3(0,1,0);
const DOWN=new THREE.Vector3(0,-1,0);
const FRONT=new THREE.Vector3(0,0,1);
const PI2=Math.PI*2;
const vec=v=>new THREE.Vector3(...v);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
export const conceptDensity=(g,source,high,medium,low)=>{
 const d=g.root.userData.detail;
 return d==='source'?source:d==='high'?high:d==='medium'?medium:low;
};

const tone=(hex,mult)=>new THREE.Color(hex).multiplyScalar(mult);
const grayscale=new Uint8Array(64*64*4);
for(let y=0;y<64;y++)for(let x=0;x<64;x++){
 const p=(y*64+x)*4;
 const v=.50+.23*Math.sin(x*.93+y*.23)*Math.cos(y*1.17-x*.45)
   +.17*Math.sin(x*2.11+y*.59)*Math.sin(y*.43)
   +.10*Math.sin(x*.18+y*.24);
 const shade=Math.round(clamp(v)*255);
 grayscale[p]=shade;grayscale[p+1]=shade;grayscale[p+2]=shade;grayscale[p+3]=255;
}
const skinRelief=new THREE.DataTexture(grayscale,64,64,THREE.RGBAFormat);
skinRelief.needsUpdate=true;
skinRelief.wrapS=THREE.RepeatWrapping;
skinRelief.wrapT=THREE.RepeatWrapping;
skinRelief.repeat.set(3,2);

function actorMaterial(g,key,{
 color='#ffffff',metalness=.06,roughness=.41,clearcoat=.42,
 clearcoatRoughness=.23,emissive=null,emissiveIntensity=0,
 transparent=false,opacity=1,transmission=0,thickness=.2,ior=1.37,
 vertexColors=false,textured=false,side=THREE.DoubleSide
}={}){
 const pool=g.root.userData.conceptV2Materials??=new Map();
 let entry=pool.get(key);
 if(entry)return {material:entry.material,first:false};
 const material=new THREE.MeshPhysicalMaterial({
  color,metalness,roughness,clearcoat,clearcoatRoughness,
  ...(emissive?{emissive,emissiveIntensity}:{}),
  transparent,opacity,transmission,thickness,ior,vertexColors,side,
  depthWrite:!transparent,
  ...(textured?{bumpMap:skinRelief,bumpScale:.016}:{}),
 });
 material.userData.conceptV2Role=key;
 pool.set(key,{material});
 return {material,first:true};
}
export function placeMesh(g,parent,geometry,name,role,options={}){
 if(!geometry?.getAttribute('position'))throw Error('Concept V2 mesh needs vertices: '+name);
 const {material,first}=actorMaterial(g,role,options);
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
 mesh.userData.ownedGeometry=true;
 if(first)mesh.userData.ownedEffectMaterial=true;
 parent.add(mesh);
 return mesh;
}
const noise=(x,y,z)=>(
 .57*Math.sin(x*19.3+y*23.1+z*15.1)*Math.sin(z*11.3-x*17.9)
 +.25*Math.cos(y*42.7+z*31.1)*Math.sin(x*27.7-y*12.3)
 +.18*Math.sin(x*53.3+y*24.5+z*41.7)
);
export function texturedEllipsoid(g,parent,{
 name='anatomical-surface',center=[0,0,0],radii=[1,1,1],
 color='#483956',light='#9c75ac',role='surface',deform=.025,
 translucent=false,glow=false,roughness=.37,metalness=.12
}={}){
 const segments=conceptDensity(g,76,52,38,22);
 const lat=conceptDensity(g,52,34,25,16);
 const geo=new THREE.SphereGeometry(1,segments,lat);
 const p=geo.getAttribute('position');
 const colors=[];
 const colA=new THREE.Color(color),colB=new THREE.Color(light);
 const c=vec(center),r=vec(radii);
 for(let i=0;i<p.count;i++){
  const u=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
  const n=noise(u.x,u.y,u.z),waves=.6*Math.sin(u.y*13+u.x*8);
  const distortion=1+deform*(n+waves);
  p.setXYZ(i,c.x+u.x*r.x*distortion,
    c.y+u.y*r.y*distortion,c.z+u.z*r.z*distortion);
  const mixing=clamp(.27+u.y*.29+n*.22, .06,.82);
  const shade=colA.clone().lerp(colB,mixing).multiplyScalar(.86+.16*noise(u.z,u.x,u.y));
  colors.push(shade.r,shade.g,shade.b);
 }
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.computeVertexNormals();
 return placeMesh(g,parent,geo,name,role,{
  vertexColors:true,roughness,metalness,
  clearcoat:translucent?.95:.39,
  clearcoatRoughness:translucent?.08:.23,
  transparent:translucent,opacity:translucent?.65:1,
  transmission:translucent?.06:0,
  emissive:glow?'#147a7e':null,emissiveIntensity:glow?.22:0,
  textured:!translucent
 });
}

/** General cross-section-based smooth tapered organic volume. */
export function sweepVolume(g,parent,points,{
 name='organic-swept-volume',role='swept-skin',
 radius=.12,taper=.25,color='#503c72',light='#8c69b0',
 ridges=.12,roughness=.34,metalness=.07,caps=false,
 transparent=false,opacity=.9,
 glow=false
}={}){
 const curve=new THREE.CatmullRomCurve3(points.map(vec),false,'centripetal',.5);
 const rings=conceptDensity(g,58,36,25,12);
 const sides=conceptDensity(g,18,14,11,7);
 const frames=curve.computeFrenetFrames(rings,false);
 const colA=new THREE.Color(color),colB=new THREE.Color(light);
 const xyz=[],rgba=[],uv=[],indices=[];
 const radiusAt=t=>radius*Math.max(.014,(1-(1-taper)*t*t)*(1-.045*t));
 for(let i=0;i<=rings;i++){
  const t=i/rings,pos=curve.getPoint(t);
  const a=radiusAt(t);
  for(let j=0;j<=sides;j++){
   const phi=j/sides*PI2;
   const spoke=frames.normals[i].clone().multiplyScalar(Math.cos(phi))
      .addScaledVector(frames.binormals[i],Math.sin(phi));
   const micro=transparent?.006:role.includes('octopus')?.009:.019;
   const ringR=a*(1+ridges*.27*Math.sin(phi*5+t*8)
      +micro*Math.sin(t*23+phi*2));
   xyz.push(pos.x+spoke.x*ringR,
    pos.y+spoke.y*ringR,pos.z+spoke.z*ringR);
   let mix=clamp(.31+.22*Math.cos(phi)+.08*Math.sin(t*9+phi*5),.09,.81);
   const col=colA.clone().lerp(colB,mix);
   rgba.push(col.r,col.g,col.b);
   uv.push(j/sides,t);
   if(i<rings&&j<sides){
    const n=i*(sides+1)+j;
    indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);
   }
  }
 }
 // End caps on the old limbs rendered as hard black disks at every hinge.
 // Open cross-sections overlap organically; optional closure is only for
 // species where a genuinely exposed end is required.
 if(caps){
  const startI=xyz.length/3,first=curve.getPoint(0),last=curve.getPoint(1);
  xyz.push(first.x,first.y,first.z);rgba.push(colA.r,colA.g,colA.b);uv.push(.5,0);
  const endI=xyz.length/3;
  xyz.push(last.x,last.y,last.z);rgba.push(colA.r,colA.g,colA.b);uv.push(.5,1);
  for(let j=0;j<sides;j++){
   indices.push(startI,j+1,j);
   const k=rings*(sides+1)+j;
   indices.push(endI,k,k+1);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgba,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 const mesh=placeMesh(g,parent,geometry,name,role,{
  vertexColors:true,roughness,metalness,clearcoat:.57,
  transparent,opacity,transmission:transparent?.06:0,
  emissive:glow?'#125659':null,emissiveIntensity:glow?.22:0,
  textured:!transparent
 });
 return {mesh,curve,radiusAt,frames,rings,sides};
}

/** Curved dorsal plates hug the actual ellipsoidal surface. */
export function conformalCarapace(g,parent,{
 name='conformal-carapace-plate',
 center=[0,0,0],radii=[1,1,1],start=-.5,end=.5,
 color='#796785',light='#bf9fba',role='dorsal-plates',lift=.033,
 wing=.77,crest=.11
}={}){
 const rows=conceptDensity(g,12,9,7,4);
 const cols=conceptDensity(g,18,14,10,6);
 const pos=[],colors=[],uv=[],indices=[];
 const ca=new THREE.Color(color),cb=new THREE.Color(light);
 for(let i=0;i<=rows;i++){
  const v=i/rows,z=center[2]+lerp(start,end,v);
  const zNorm=(z-center[2])/radii[2];
  for(let j=0;j<=cols;j++){
   const u=(j/cols*2-1),window=Math.sqrt(Math.max(.03,1-zNorm*zNorm));
   const edge=(1-u*u);
   const x=center[0]+radii[0]*u*window*wing;
   const normalizedX=(x-center[0])/radii[0];
   const y=center[1]+radii[1]*Math.sqrt(Math.max(.01,1-normalizedX**2-zNorm**2));
   const crestY=crest*Math.pow(Math.max(0,edge),2)*Math.sin(Math.PI*v);
   pos.push(x,y+lift+crestY,z);
   const shade=ca.clone().lerp(cb,clamp(.17+.28*edge+.12*Math.sin(v*16)));
   colors.push(shade.r,shade.g,shade.b);
   uv.push(j/cols,v);
   if(i<rows&&j<cols){
    const n=i*(cols+1)+j;
    indices.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 return placeMesh(g,parent,geo,name,role,{
  vertexColors:true,roughness:.31,metalness:.27,clearcoat:.48,textured:true
 });
}

export function mergedSuckerRows(g,parent,sweep,{
 count=9,rows=2,rolePrefix='octopus-cups',scale=1,
 rimColor='#83d9cd',centerColor='#2c394f'
}={}){
 const rims=[],holes=[],Q=new THREE.Quaternion();
 const ringSegment=conceptDensity(g,10,9,7,6);
 const ringTube=conceptDensity(g,5,4,4,3);
 for(let i=0;i<count;i++){
  const t=(i+.70)/(count+.95),center=sweep.curve.getPoint(t);
  const tangent=sweep.curve.getTangent(t);
  const lateral=new THREE.Vector3().crossVectors(tangent,UP).normalize();
  if(lateral.lengthSq()<.01)lateral.set(1,0,0);
  const rad=sweep.radiusAt(t),cupR=rad*.46*scale;
  const cupFace=DOWN.clone().multiplyScalar(.42).addScaledVector(FRONT,.82).normalize();
  const floor=cupFace.clone().multiplyScalar(rad*.88);
  for(let r=0;r<rows;r++){
   const side=(r-(rows-1)/2);
   const foot=center.clone().add(floor).addScaledVector(lateral,side*rad*.48);
   const rotation=Q.setFromUnitVectors(FRONT,cupFace);
   const ring=new THREE.TorusGeometry(cupR,cupR*.20,ringTube,ringSegment)
      .applyQuaternion(rotation).translate(foot.x,foot.y,foot.z);
   rims.push(ring);
   const disk=new THREE.CircleGeometry(cupR*.61,ringSegment)
      .applyQuaternion(rotation).translate(foot.x,foot.y-.004,foot.z+.003);
   holes.push(disk);
  }
 }
 const rimGeo=mergeGeometries(rims,false),holeGeo=mergeGeometries(holes,false);
 for(const geo of [...rims,...holes])geo.dispose();
 if(!rimGeo||!holeGeo)throw Error('Could not merge octopus sucker geometry');
 placeMesh(g,parent,rimGeo,'sucker-fleshy-rim',rolePrefix+'-rim',{
  color:rimColor,roughness:.25,metalness:.06,clearcoat:.52
 });
 placeMesh(g,parent,holeGeo,'recessed-sucker-cavity',rolePrefix+'-hole',{
  color:centerColor,roughness:.47,metalness:0
 });
 return count*rows;
}

/** One continuous fluid silhouette, with scalloped lobes at ground level. */
export function slimeMembrane(g,parent,{name='translucent-main-gel'}={}){
 const profile=[
  [.06,1.46],[.20,1.49],[.43,1.40],[.61,1.21],
  [.72,1.02],[.77,.77],[.82,.56],[.92,.39],
  [1.09,.21],[1.20,.13],[1.22,.08]
 ];
 const sides=conceptDensity(g,100,70,48,26);
 const pos=[],uv=[],color=[],indices=[];
 const col1=new THREE.Color('#3078ad'),col2=new THREE.Color('#7af4ec');
 for(let row=0;row<profile.length;row++){
  const [radius,height]=profile[row];
  for(let col=0;col<=sides;col++){
   const a=col/sides*PI2;
   const t=row/(profile.length-1);
   const lobe=Math.sin(a*6+.42)*.055+
     Math.sin(a*11+1.8)*.023+Math.sin(a*3)*.018;
   const radial=(radius+(height<.42?lobe: lobe*.18));
   const y=height+(height<.41?.015*Math.sin(a*6+2.1):0);
   pos.push(Math.sin(a)*radial,y,Math.cos(a)*radial);
   uv.push(col/sides,t);
   const mix=clamp(.30+(1-height/1.6)*.37+.13*Math.cos(a*2.0));
   const c=col1.clone().lerp(col2,mix);
   color.push(c.r,c.g,c.b);
   if(row<profile.length-1&&col<sides){
    const i=row*(sides+1)+col;
    indices.push(i,i+sides+1,i+1,i+1,i+sides+1,i+sides+2);
   }
  }
 }
 // Close the tiny crown and underside holes with real curved cap vertices.
 // The previous open radial poles produced black starburst artifacts.
 const crown=pos.length/3;
 pos.push(0,1.51,0);uv.push(.5,0);color.push(col1.r,col1.g,col1.b);
 // The gel is intentionally open underneath, where it meets the ground.
 // A second underside shell previously showed through the transparent dome
 // as a black starburst/fan. Never render those hidden radial triangles.
 for(let j=0;j<sides;j++)indices.push(crown,j+1,j);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 return placeMesh(g,parent,geo,name,'slime-liquid-envelope',{
  vertexColors:true,roughness:.055,metalness:0,
  clearcoat:1,clearcoatRoughness:.03,transparent:true,
  opacity:.61,ior:1.34,transmission:.07,thickness:.65
 });
}
