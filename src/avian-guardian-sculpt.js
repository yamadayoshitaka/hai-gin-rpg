/**
 * Bird-family source sculpt, November 2026. m011 eagle, m012 griffin,
 * m013 phoenix and m014 owl each have independent anatomical proportions.
 *
 * IMPORTANT: the main wing is the exact 3-layer overlapping feather geometry
 * built for the original seraph_guardian summon (82 vanes per side near).
 * It is COPIED, recoloured and transformed, not substituted with image planes.
 * The common wing donor is generated once per LOD; per-model clones are
 * disposed by disposeMonsterSculpture. m015 humanlike tengu is deliberately
 * not routed through this avian body.
 */
import * as THREE from 'three';
import {createOriginalGuardianWingPair}
 from './female-summon-costumes.js?v=avian-guardian-donor-v1-20261118';

export const AVIAN_REALISM_REVISION='phoenix-cranial-flame-guardian-hands-stable-v8-20261118';
export const AVIAN_REFRESH_IDS=Object.freeze(['m011','m012','m013','m014']);

const profiles=Object.freeze({
 m011:Object.freeze({type:'eagle',wing:[.65,.58,.91],tail:1.18,
   body:1,neck:1,head:1,crest:6,breast:0xbaa688,
   dark:0x523829,mid:0x9c7051,light:0xd4bc93,tip:0xe1d1ae}),
 m012:Object.freeze({type:'griffin',wing:[.81,.67,.96],tail:1.02,
   body:1.20,neck:1.12,head:1.14,crest:13,breast:0xf0d1a0,
   dark:0x674b35,mid:0xa47d52,light:0xe4c58d,tip:0xffecc1}),
 m013:Object.freeze({type:'phoenix',wing:[1.24,1.03,1.19],tail:3.22,
   body:1.16,neck:1.38,head:.68,crest:25,breast:0xffe8c6,
   dark:0x871d20,mid:0xd83f27,light:0xff871e,tip:0xffdf8b}),
 m014:Object.freeze({type:'owl',wing:[.57,.46,.84],tail:.66,
   body:1.16,neck:.76,head:1.22,crest:11,breast:0xd9c7a9,
   dark:0x534c47,mid:0x918474,light:0xbeb1a0,tip:0xe2d8c4}),
});
export const avianProfile=id=>profiles[id]||null;
const PHOENIX_HEAD_STATIONS=Object.freeze([
   {z:.475,y:-.074,rx:.024,ry:.037},
   {z:.366,y:-.053,rx:.070,ry:.089},
   {z:.235,y:.012,rx:.110,ry:.135},
   {z:.075,y:.051,rx:.142,ry:.170},
   {z:-.175,y:.054,rx:.137,ry:.161},
   {z:-.395,y:.056,rx:.040,ry:.055}
 ]);
const guardianDonors=new Map();
function guardianPair(detail){
 const d=detail==='source'||detail==='high'?'high':'low';
 if(!guardianDonors.has(d))guardianDonors.set(d,createOriginalGuardianWingPair({detail:d}));
 return guardianDonors.get(d);
}
const color=hex=>new THREE.Color(hex);
const mix=(a,b,t)=>a.clone().lerp(b,Math.max(0,Math.min(1,t)));
/** GPU wave along each actual guardian feather. The animation only updates
 * two uniforms; no per-frame vertex upload, new meshes, or draw calls.
 * The 82 original feathers remain the underlying physical geometry.
 */
function addPhoenixWave(surface,kind){
 if(!surface?.isMesh)return surface;
 const state={time:0,power:.58,uniformTime:null,uniformPower:null};
 const mat=surface.material;
 mat.userData.phoenixWaveState=state;
 mat.onBeforeCompile=shader=>{
  shader.uniforms.phoenixWaveTime={value:state.time};
  shader.uniforms.phoenixWavePower={value:state.power};
  state.uniformTime=shader.uniforms.phoenixWaveTime;
  state.uniformPower=shader.uniforms.phoenixWavePower;
  const distance=kind==='wing'?'abs(position.x)':'max(0.0,-position.z)';
  const threshold=kind==='wing'?'0.34, 2.8':'0.22, 2.8';
  const stride=kind==='wing'?'4.8':'3.15';
  const phase=kind==='wing'?'2.05':'1.65';
  const y=kind==='wing'?'0.042':kind==='tail'?'0.105':'0.029';
  const secondary=kind==='wing'?'0.026':kind==='tail'?'0.048':'0.024';
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>', '#include <common>\nuniform float phoenixWaveTime;\nuniform float phoenixWavePower;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    float avianDistance = ${distance};
    float avianWaveFade = smoothstep(${threshold}, avianDistance);
    float avianWavePhase = phoenixWaveTime * ${stride} - avianDistance * ${phase};
    transformed.y += ${y} * phoenixWavePower * avianWaveFade * sin(avianWavePhase);
    transformed.z += ${secondary} * phoenixWavePower * avianWaveFade * cos(avianWavePhase + 0.7);`);
 };
 mat.customProgramCacheKey=()=>`phoenix-feather-travelling-wave-${kind}-v2`;
 surface.userData.phoenixWaveKind=kind;
 surface.userData.phoenixWaveDynamic=true;
 surface.userData.phoenixWaveGPU=true;
 return surface;
}
export function updatePhoenixFeatherWaves(model,time,action='idle'){
 const affected=model?.userData?.phoenixWaveMeshes;
 if(!affected?.length)return 0;
 const power=action==='special'?1.55:action==='attack'?1.25:
   action==='run'||action==='leap'?1.12:action==='defeat'?0:.075;
 for(const part of affected){
  const state=part.material?.userData?.phoenixWaveState;
  if(!state)continue;
  state.time=time;state.power=power;
  if(state.uniformTime)state.uniformTime.value=time;
  if(state.uniformPower)state.uniformPower.value=power;
 }
 return affected.length;
}
function mesh(parent,geometry,name,{emissive=false}={}){
 const mat=new THREE.MeshStandardMaterial({
   vertexColors:true,side:THREE.DoubleSide,
   metalness:.055,roughness:emissive?.54:.81,
   emissive:emissive?0x722608:0x000000,
   emissiveIntensity:emissive?.21:0
 });
 const object=new THREE.Mesh(geometry,mat);
 object.name=name;object.castShadow=true;object.receiveShadow=true;
 object.userData.ownedGeometry=true;
 object.userData.ownedEffectMaterial=true;
 parent.add(object);
 return object;
}
/** A single refinement pass on the guardian's REAL surface triangles.
 * Source remains a finer authored mesh than playable high LOD.
 * The source has no extra draw calls and no runtime subdivision.
 */
function refineOnce(input){
 const src=input.index?input.toNonIndexed():input;
 const pos=src.getAttribute('position'),uv=src.getAttribute('uv'),
   norm=src.getAttribute('normal'),tint=src.getAttribute('color');
 const vertices=[],uvs=[],normals=[],colors=[];
 const append=(indices,weights)=>{
   const read=(a,k)=>indices.reduce((v,n,i)=>v+weights[i]*a.getComponent(n,k),0);
   for(let k=0;k<3;k++)vertices.push(read(pos,k));
   for(let k=0;k<2;k++)uvs.push(uv?read(uv,k):0);
   for(let k=0;k<3;k++){
     normals.push(norm?read(norm,k):(k===2?1:0));
     colors.push(tint?read(tint,k):1);
   }
 };
 for(let i=0;i<pos.count;i+=3){
   const a=[i],[b]=[i+1],c=[i+2];
   const ab=[i,i+1],bc=[i+1,i+2],ca=[i+2,i];
   const v0=[[a,[1]],[ab,[.5,.5]],[ca,[.5,.5]]];
   const v1=[[ab,[.5,.5]],[[b],[1]],[bc,[.5,.5]]];
   const v2=[[ca,[.5,.5]],[bc,[.5,.5]],[c,[1]]];
   const v3=[[ab,[.5,.5]],[bc,[.5,.5]],[ca,[.5,.5]]];
   for(const tri of [v0,v1,v2,v3])for(const [ii,w] of tri)append(ii,w);
 }
 const out=new THREE.BufferGeometry();
 out.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 out.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 out.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 if(src!==input)src.dispose();
 return out;
}
function guardianDerivedWing(parent,spec,side,detail,{miniature=false,name=null}={}){
 const p=profiles[spec.id],donor=guardianPair(miniature&&detail==='medium'?'low':detail);
 const base=side<0?donor.left:donor.right;
 let geo=base.clone();
 if(detail==='source'&&!miniature){
   const refined=refineOnce(geo);geo.dispose();geo=refined;
 }
 const wingScale=miniature?[.27,.25,.245]:p.wing;
 geo.scale(...wingScale);
 const positions=geo.getAttribute('position');
 const old=geo.getAttribute('color'),arr=new Float32Array(positions.count*3);
 const dark=color(p.dark),mid=color(p.mid),light=color(p.light),tip=color(p.tip);
 for(let i=0;i<positions.count;i++){
   const radial=Math.min(1,Math.abs(positions.getX(i))/(2.95*wingScale[0]));
   const height=Math.min(1,Math.max(0,positions.getY(i)/(1.9*wingScale[1])));
   const sourceShade=old?(old.getX(i)+old.getY(i)+old.getZ(i))/3:1;
   const c=mix(dark,mid,.32+.42*height);
   c.lerp(light,Math.pow(radial,1.2)*.60);
   c.lerp(tip,Math.pow(radial,2.6)*.68);
   // Feather-to-feather tonal variation survives the recolour.
   c.multiplyScalar(.76+.28*sourceShade);
   arr[i*3]=c.r;arr[i*3+1]=c.g;arr[i*3+2]=c.b;
 }
 geo.setAttribute('color',new THREE.Float32BufferAttribute(arr,3));
 geo.computeBoundingSphere();
 const wing=mesh(parent,geo,name||'avian-guardian-three-layer-wing-'+spec.id+'-'+(side<0?'L':'R'),
   {emissive:spec.id==='m013'});
 wing.userData.angelSource='seraph_guardian';
 wing.userData.angelFeatherLayers=3;
 wing.userData.angelFeathersPerSide=detail==='low'||detail==='medium'?18:82;
 wing.userData.angelDonorGeometryTriangles=
   (base.index?.count??base.getAttribute('position').count)/3;
 wing.userData.birdWingRealGeometry=true;
 wing.userData.birdWingDetail=detail;
 wing.userData.birdWingRooted=true;
 if(miniature){
  wing.userData.phoenixGuardianFeatherHand=true;
  wing.userData.phoenixSameWingVaneSource=true;
  wing.userData.phoenixMiniatureDonorDetail=detail==='low'||detail==='medium'?'low':'high';
  wing.userData.phoenixMiniatureFeatherCount=wing.userData.angelFeathersPerSide;
  wing.castShadow=false;wing.receiveShadow=false;
  wing.rotation.set(-.48,side*.13,-side*.68);
  wing.position.set(side*.015,.030,-.045);
 }
 if(spec.id==='m013')addPhoenixWave(wing,'wing');
 return wing;
}
/** One merged, curved vane mesh per body region. No 200 separate draw calls.
 * Each vane has a narrowing distal profile, a raised central rachis and
 * natural layered overlap. All coordinates are local to its parent pivot.
 */
function layeredFeathers(parent,spec,detail,name,entries){
 const p=profiles[spec.id],source=detail==='source',low=detail==='low';
 const steps=source?13:detail==='high'?9:detail==='medium'?6:3,
   across=low?2:4;
 const points=[],uvs=[],indices=[],colors=[];
 const C=[color(p.dark),color(p.mid),color(p.light),color(p.tip),color(p.breast)];
 for(let id=0;id<entries.length;id++){
   const e=entries[id],a=new THREE.Vector3(...e.from),
     b=new THREE.Vector3(...e.to),dir=b.clone().sub(a);
   if(dir.lengthSq()<.000001)continue;
   const normal=new THREE.Vector3(...(e.normal||[0,.2,1])).normalize();
   const lateral=new THREE.Vector3().crossVectors(dir.clone().normalize(),normal).normalize();
   if(lateral.lengthSq()<.05)lateral.set(1,0,0);
   const baseCount=points.length/3,root=C[e.tint??(id%3)];
   for(let i=0;i<=steps;i++){
     const t=i/steps,sweep=Math.pow(Math.sin(Math.PI*t),.75);
     const center=a.clone().addScaledVector(dir,t);
     // Optional curling geometry for living flame plumes; other vane
     // shapes and source wing geometry are unchanged.
     if(e.curl)center.addScaledVector(lateral,e.curl*Math.sin(Math.PI*t)*t);
     if(e.rise)center.addScaledVector(normal,e.rise*Math.sin(Math.PI*t));
     const tone=mix(root,C[e.endTint??3],Math.pow(t,2.35)*(e.glow??.28));
     for(let j=0;j<=across;j++){
       const u=j/across*2-1;
       const pt=center.clone()
         .addScaledVector(lateral,u*(e.width||.047)*sweep)
         .addScaledVector(normal,(1-u*u)*sweep*(e.ridge||.014));
       points.push(pt.x,pt.y,pt.z);
       uvs.push(j/across,t);
       colors.push(tone.r,tone.g,tone.b);
     }
   }
   for(let i=0;i<steps;i++)for(let j=0;j<across;j++){
     const a0=baseCount+i*(across+1)+j,b0=a0+across+1;
     indices.push(a0,b0,a0+1,a0+1,b0,b0+1);
   }
 }
 if(!points.length)return null;
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const result=mesh(parent,geo,name,{emissive:spec.id==='m013'});
 result.userData.curvedAvianFeathers=entries.length;
 result.userData.mergedFeatherBatches=1;
 return result;
}
function plumageStations(p){
 if(p.type==='phoenix')return [
   // Strong chest & deep abdomen, small head remains unchanged.
   // Full continuous hull: shoulder keel, ribcage, pelvis, caudal socket.
   {z:.69,y:1.58,rx:.080,ry:.136},
   {z:.50,y:1.48,rx:.265,ry:.345},
   {z:.25,y:1.44,rx:.356,ry:.442},
   {z:-.12,y:1.44,rx:.365,ry:.468},
   {z:-.49,y:1.46,rx:.292,ry:.363},
   {z:-.82,y:1.49,rx:.054,ry:.086}
 ];
 const k=p.body;
 return [
  {z:.58*k,y:1.56,rx:.084*k,ry:.13*k},
  {z:.40*k,y:1.47,rx:.25*k,ry:.34*k},
  {z:.15*k,y:1.42,rx:.35*k,ry:.45*k},
  {z:-.12*k,y:1.44,rx:.36*k,ry:.44*k},
  {z:-.40*k,y:1.45,rx:.28*k,ry:.32*k},
  {z:-.64*k,y:1.45,rx:.06*k,ry:.085*k}
 ];
}

/** Continuous mathematical surface of the actual anatomical cross-section
 * loft, including the same Catmull-Rom interpolation used by axialLoft.
 * Scales inherit THIS surface. Never place a loose belt at a guessed radius.
 */
function phoenixAxialSurface(stations,u,theta){
 const x=Math.min(stations.length-1-1e-6,Math.max(0,u*(stations.length-1)));
 const j=Math.min(stations.length-2,Math.floor(x)),t=x-j;
 const a=stations[Math.max(0,j-1)],b=stations[j],
   c=stations[j+1],d=stations[Math.min(stations.length-1,j+2)];
 const cubic=(v,w,y,z)=>.5*(2*w+(-v+y)*t+
   (2*v-5*w+4*y-z)*t*t+(-v+3*w-3*y+z)*t*t*t);
 const val=k=>cubic(a[k],b[k],c[k],d[k]);
 const rx=Math.max(.02,val('rx')),ry=Math.max(.02,val('ry'));
 const cs=Math.cos(theta),sn=Math.sin(theta);
 return {
  point:new THREE.Vector3(cs*rx,val('y')+sn*ry,val('z')),
  normal:new THREE.Vector3(cs/rx,sn/ry,.08).normalize(),
  radius:(rx+ry)*.5,
  z:val('z')
 };
}
/** Three-dimensional curved, pointed scale tiles, merged into ONE indexed
 * mesh per body part. The root sits on the exact skin; the thickened
 * middle rises 0.02 and the point nestles under the next row.
 * Tile width is measured in world units, not merely an arbitrary counter.
 */
function phoenixSurfaceScutes(parent,s,detail,name,{
 rows,columns,surface,widthAt,skip=null,kind='anatomical-scale'
}){
 const vertices=[],indices=[],colors=[],uv=[];
 const palette=profiles[s.id],dark=color(palette.dark),
   mid=color(palette.mid),light=color(palette.light),
   hot=color(palette.tip);
 let scales=0,minWidth=Infinity,maxWidth=0;
 for(let r=0;r<rows;r++)for(let col=0;col<columns;col++){
  const u=(r+.15)/rows;
  const angle=2*Math.PI*(col+.5*(r%2))/columns;
  const anchor=surface(u,angle);
  if(skip?.(u,angle,anchor))continue;
  const width=widthAt(u,angle,anchor);
  if(!(width>0))continue;
  minWidth=Math.min(width,minWidth);maxWidth=Math.max(width,maxWidth);
  const angleHalf=Math.min(1.04,width/Math.max(.045,anchor.radius));
  const origin=vertices.length/3;
  const shade=mix(dark,mid,.27+(.47*(r%5)/5));
  shade.lerp(light,.22+(col%4)*.045);
  const shades=[shade,shade.clone().lerp(hot,.14),
    shade.clone().lerp(hot,.27),shade.clone().lerp(hot,.43)];
  const longitudinal=[0,.30,.72,1.09],
    breadth=[.77,1,.84,.045],lifts=[.004,.022,.023,.002];
  // Curved raised keratin plates: bevelled edges and one merged draw call.
  for(let v=0;v<4;v++)for(let j=0;j<5;j++){
   const side=(j-2)/2;
   const sample=surface(Math.min(.9999,u+longitudinal[v]/rows),
    angle+angleHalf*side*breadth[v]);
   const ridge=Math.pow(Math.max(0,1-side*side),1.5);
   const pos=sample.point.addScaledVector(sample.normal,
    lifts[v]+ridge*(v===1?.012:.007));
   vertices.push(pos.x,pos.y,pos.z);
   uv.push((side+1)/2,v/3);
   const tone=shades[v].clone().multiplyScalar(
    (.86+ridge*.24)*(1-.055*Math.abs(side)));
   colors.push(tone.r,tone.g,tone.b);
  }
  for(let v=0;v<3;v++)for(let j=0;j<4;j++){
   const a=origin+v*5+j,b=a+5;
   indices.push(a,b,a+1,a+1,b,b+1);
  }
  scales++;
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const coat=mesh(parent,geo,name,{emissive:s.id==='m013'});
 coat.userData.imbricatedKeratinScales=true;
 coat.userData.phoenixRaisedBevelScutes=true;
 coat.userData.curvedAvianFeathers=scales;
 coat.userData.mergedFeatherBatches=1;
 coat.userData.scaleCount=scales;
 coat.userData.phoenixAttachedScutes=true;
 coat.userData.phoenixScuteType=kind;
 coat.userData.phoenixScaleWidths={min:minWidth,max:maxWidth};
 coat.userData.phoenixScaleCount=scales;
 return coat;
}
function phoenixDenseScales(g,s,p,torso,detail){
 const stations=plumageStations(p);
 const density=detail==='source'?[20,18]:detail==='high'?[15,14]:
   detail==='medium'?[11,11]:[7,8];
 const coat=phoenixSurfaceScutes(torso,s,detail,
  'avian-layered-body-plumage-'+s.id,{
   rows:density[0],columns:density[1],
   surface:(u,a)=>phoenixAxialSurface(stations,u,a),
   widthAt:(u,a,v)=>{
    const belly=Math.sin(a)<-.26&&v.z<.32;
    return belly?.255:v.z>.42?.133:v.z<-.25?.200:.224;
   },kind:'close-fitted-thorax-diamond-scales'
  });
 coat.userData.phoenixAbdomenLargeScaleWidth=.255;
 coat.userData.phoenixBellyScaleMultiplier=11.09;
 coat.userData.phoenixScalesGradedToFace=true;
 coat.userData.originalBodyAnatomy='enlarged-closed-thorax-and-keel';
 g.root.userData.avianBodyFeatherCount=coat.userData.scaleCount;
 g.root.userData.phoenixDenseScaleCount=coat.userData.scaleCount;
 g.root.userData.phoenixLargeScaleMultiplier=11.09;
 return coat;
}
/** Real, overlapping ventral scutes, never floating ornament spheres.
 * Layered into a single batch per anatomical section; each local section
 * moves with its own bone group. Belly, thigh, shank and wing-hand scutes
 * retain a measured .069 half-width (3 times the old .023 source size).
 */
function phoenixCylindricalScutes(parent,s,detail,name,{
   rows=6,around=12,fromY=0,toY=-.5,
   fromZ=0,toZ=.04,radiusX=.082,radiusZ=.075,
   width=.069,scaleY=1}={}){
 const low=detail==='low',number=low?Math.max(3,Math.floor(rows*.58)):detail==='source'?Math.ceil(rows*1.5):rows,
   spokes=low?Math.max(5,Math.floor(around*.60)):detail==='source'?Math.ceil(around*1.3):around;
 const guides=[];
 for(let i=0;i<number;i++){
  const t=(i+.28)/(number+.15),y=fromY+(toY-fromY)*t,z=fromZ+(toZ-fromZ)*t;
  for(let j=0;j<spokes;j++){
   const a=Math.PI*2*(j+.5*(i%2))/spokes;
   const nx=Math.cos(a),nz=Math.sin(a);
   const baseX=nx*radiusX,baseZ=z+nz*radiusZ;
   guides.push({from:[baseX,y,baseZ],
     to:[baseX+nx*.010,y-.056*scaleY,baseZ+nz*.012+.016],
     width,normal:[nx,.17,nz],ridge:.012,
     tint:j%5===0?2:j%3===0?1:0,endTint:3,glow:.34});
  }
 }
 const result=layeredFeathers(parent,s,detail,name,guides);
 result.userData.phoenixAttachedScutes=true;
 result.userData.phoenixScaleWidth=width;
 result.userData.phoenixScaleMultiplier=width/.023;
 result.userData.phoenixScaleBone=parent.name;
 result.userData.phoenixScaleCount=guides.length;
 return result;
}

function phoenixNeckCrownScutes(g,s,p,torso,head,detail){
 const low=detail==='low',n=low?5:detail==='source'?17:12,
   cols=low?8:detail==='source'?22:16;
 const guides=[];
 for(let row=0;row<n;row++){
  const t=(row+.5)/(n+.5);
  const rad=(.217*p.body)*(1-t)+(.149*p.neck)*t;
  const cy=1.55+.41*t,cz=.22*p.body+(.30*p.neck-.22*p.body)*t;
  for(let j=0;j<cols;j++){
   const a=(j+.5*(row%2))*Math.PI*2/cols,
    nx=Math.cos(a),nz=Math.sin(a);
   // Body -> throat -> cheek: gradual physical reduction, never a
   // sudden tiny dot at the crown or a protruding floating necklace.
   const width=.143*(1-t)+.060*t;
   const x=nx*rad*1.015,z=cz+nz*rad*.989;
   guides.push({from:[x,cy,z],
    to:[x+nx*.007,cy+.039*(1-t),z+nz*.011-.030],
    width,normal:[nx,.15,nz],ridge:.014,
    tint:j%3===0?2:j%2===0?1:0,endTint:2,glow:.24});
  }
 }
 const neck=layeredFeathers(torso,s,detail,'phoenix-neck-fine-grading-scutes',guides);
 neck.userData.phoenixScalesShrinkTowardsFace=true;
 neck.userData.phoenixScaleWidthBase=.143;
 neck.userData.phoenixScaleWidthTip=.060;
 // Surface-fitted facial scales rather than an invisible decorative ring.
 // Leave the forward +Z eye sockets, nostrils and beak clearly exposed.
 const density=detail==='source'?[14,24]:detail==='high'?[10,17]:
  detail==='medium'?[8,13]:[5,9];
 const crown=phoenixSurfaceScutes(head,s,detail,'phoenix-fine-head-scales',{
  rows:density[0],columns:density[1],
  surface:(u,a)=>phoenixAxialSurface(PHOENIX_HEAD_STATIONS,u,a),
  widthAt:(u,a,v)=>v.z>.19?.052:v.z<-.19?.092:.080,
  skip:(u,a,v)=>v.z>.08&&Math.abs(Math.sin(a))<.45&&
   Math.abs(v.point.x)>.072,
  kind:'contour-fitted-forehead-cheek-cranial-scales'
 });
 crown.userData.phoenixFaceMicroScales=true;
 crown.userData.phoenixScaleWidthMax=.092;
 crown.userData.phoenixVisibleFaceScales=true;
 return {neck,crown};
}

function phoenixWingHandScutes(wing,s,side,detail,name,segment,donor){
 // The previous stand-alone elbow/wrist strips appeared as FREE-FLOATING
 // orange bands. The seraph feather donor itself is the only trustworthy
 // surface: sample its actual vertex coordinates in the same wing pivot.
 const geometry=donor.geometry,positions=geometry.getAttribute('position'),
   n=positions.count;
 let maxX=.01,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<n;i++){
  maxX=Math.max(maxX,Math.abs(positions.getX(i)));
  minY=Math.min(minY,positions.getY(i));
  maxY=Math.max(maxY,positions.getY(i));
 }
 const r0=segment==='elbow'?.10:.30,r1=segment==='elbow'?.31:.56;
 const bins=new Map();
 const step=Math.max(1,Math.floor(n/6500));
 for(let i=0;i<n;i+=step){
  const x=positions.getX(i),y=positions.getY(i),
    z=positions.getZ(i),r=Math.abs(x)/maxX;
  if(r<r0||r>r1)continue;
  const ix=Math.min(6,Math.floor((r-r0)/(r1-r0)*7)),
    iy=Math.min(4,Math.floor((y-minY)/Math.max(.001,maxY-minY)*5));
  const key=ix+':'+iy,prev=bins.get(key);
  // Choose front-most physical vane in the donor for each surface bin.
  if(!prev||z>prev.z)bins.set(key,{x,y,z});
 }
 const guides=[];
 for(const v of bins.values()){
  if(guides.length>32)break;
  const front=[v.x,v.y,v.z+.014];
  // A short shingle that follows the original guardian vane rather
  // than an invented human arm length. Both endpoints stay close.
  const back=[v.x+side*.058,v.y+.018,v.z+.019];
  guides.push({from:front,to:back,width:.087,
   normal:[0,.28,1],ridge:.010,
   tint:guides.length%3===0?2:guides.length%2===0?1:0,
   endTint:3,glow:.23});
 }
 if(!guides.length){
  const i=Math.max(0,Math.floor(n*.13)),
   x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  guides.push({from:[x,y,z+.012],to:[x+side*.05,y+.02,z+.018],
   width:.075,normal:[0,.3,1],tint:1,endTint:3});
 }
 const out=layeredFeathers(wing,s,detail,name,guides);
 out.userData.phoenixAttachedScutes=true;
 out.userData.phoenixScaleWidth=.087;
 out.userData.phoenixScaleMultiplier=.087/.023;
 out.userData.phoenixScaleBone=wing.name;
 out.userData.phoenixScaleCount=guides.length;
 out.userData.phoenixWingFeatherSurfaceFitted=true;
 out.userData.phoenixWingFloatingBandsRemoved=true;
 out.userData.phoenixWingScuteSource='guardian-actual-feather-vertices';
 return out;
}
/**
 * Phoenix feather hands are an EXTRA pair of feather-wrapped forelimbs,
 * emerging from the sternum below the main celestial wings. They are not
 * human fingers and they do not replace or detach the 82-feather wings.
 * Shoulder, forearm and 3 feather-digit tips each share real skin joints.
 */
function phoenixFeatheredArm(g,s,torso,side,detail){
 const suffix=side<0?'L':'R';
 const root=g.group('phoenixArm'+suffix,[side*.315,1.58,.285],torso);
 const upper=[side*.254,-.207,.136];
 const humerus=g.bone(root,'skin',[0,0,0],upper,.063,{tipRadius:.047});
 humerus.name='phoenix-feather-arm-humerus-'+suffix;
 const forearm=g.group('phoenixForearm'+suffix,upper,root);
 const radius=[side*.159,-.116,.080];
 const ulna=g.bone(forearm,'skin',[0,0,0],radius,.051,{tipRadius:.035});
 ulna.name='phoenix-feather-arm-ulna-'+suffix;
 const palm=g.group('phoenixFeatherHand'+suffix,radius,forearm);
 const handSkin=g.sphere(palm,'skin',[side*.030,-.020,.034],
  [.068,.060,.086],{name:'phoenix-feather-hand-palm-'+suffix});
 handSkin.userData.phoenixAvianHandPalm=true;
 const outer=[],inner=[];
 const layers=detail==='low'?7:detail==='medium'?11:detail==='source'?22:16;
 for(let i=0;i<layers;i++){
  const t=i/Math.max(1,layers-1),q=(i%3)-1;
  outer.push({from:[side*(.012+.018*(i%3)),
      .015-.020*(i%4),-.005],
    to:[side*(.24+.045*t),-.185-.035*t,.105+.045*q],
    width:.055+.021*(1-t),normal:[.03,.50,.90],
    ridge:.018,tint:i%4===0?3:i%3===0?2:1,endTint:3,glow:.35});
  inner.push({from:[side*(.020+.016*(i%3)),
    .006-.016*(i%4),-.004],
    to:[side*(.175+.065*t),-.115-.036*t,.125+.060*q],
    width:.049+.018*(1-t),normal:[.04,.65,.76],
    tint:i%3===0?2:1,endTint:3,glow:.32});
 }
 const sleeve=layeredFeathers(root,s,detail,
  'phoenix-feather-arm-sleeve-'+suffix,outer);
 const under=layeredFeathers(forearm,s,detail,
  'phoenix-feather-forearm-sleeve-'+suffix,inner);
 // Exact original Guardian 3-layer vane source, recoloured like back wings.
 const featherHand=guardianDerivedWing(palm,s,side,detail,{
  miniature:true,name:'phoenix-feather-hand-vanes-'+suffix
 });
 for(const part of [sleeve,under,featherHand]){
  part.userData.phoenixTrueFeatherForelimb=true;
  part.userData.phoenixFeatherHandSide=suffix;
 }
 featherHand.userData.phoenixFeatherHandDigits=3;
 featherHand.userData.phoenixNoHumanFingers=true;
 featherHand.userData.phoenixDenseHandCover=true;
 featherHand.userData.phoenixMiniGuardianWingVisible=true;
 humerus.visible=false;ulna.visible=false;handSkin.visible=false;
 palm.userData.phoenixHiddenHandBones=true;
 root.userData.phoenixIndependentFeatherArm=true;
 forearm.userData.phoenixFeatherWrappedUlna=true;
 palm.userData.phoenixAvianFeatherHand=true;
 g.root.userData.phoenixFeatherHands=true;
 return {root,forearm,palm,featherHand};
}
/** Continuous muscle mass: bulky upper femur narrows into a real knee.
 * The shank below the knee remains bony, dark, narrow and skinless-looking.
 * No shared cylindrical coat bridges the two articulated body parts.
 */
function phoenixThighSurface(u,angle){
 const k=Math.max(0,Math.min(.9999,u));
 const radius=k<.40?
  .165+.092*Math.sin(k/.40*Math.PI*.5):
  .257-.197*Math.pow((k-.40)/.60,.86);
 const rz=radius*.84;
 const ca=Math.cos(angle),sn=Math.sin(angle);
 return {
  point:new THREE.Vector3(ca*radius,.070-.58*k,.018+.087*k+rz*sn),
  normal:new THREE.Vector3(ca/radius,.22,sn/rz).normalize(),
  radius:(radius+rz)*.5
 };
}
function phoenixAnatomicalThigh(g,leg,s,side,detail){
 const radial=detail==='source'?40:detail==='high'?28:detail==='medium'?18:12;
 const rings=detail==='source'?27:detail==='high'?19:detail==='medium'?13:8;
 const points=[],colors=[],uv=[],triangles=[];
 const main=color(profiles[s.id].mid),deep=color(profiles[s.id].dark);
 for(let i=0;i<=rings;i++){
  const u=i/rings;
  for(let j=0;j<=radial;j++){
   const a=j/radial*Math.PI*2,v=phoenixThighSurface(u,a).point;
   points.push(v.x,v.y,v.z);
   const tint=mix(main,deep,.15+.32*u).multiplyScalar(1+.07*Math.sin(a*5+u*12));
   colors.push(tint.r,tint.g,tint.b);
   uv.push(j/radial,u);
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<radial;j++){
  const v=i*(radial+1)+j,w=v+radial+1;
  triangles.push(v,w,v+1,v+1,w,w+1);
 }
 const top=points.length/3;
 const upper=phoenixThighSurface(0,0).point;
 points.push(0,upper.y,upper.z);uv.push(.5,0);colors.push(main.r,main.g,main.b);
 const bottom=points.length/3;
 const lower=phoenixThighSurface(1,0).point;
 points.push(0,lower.y,.105);uv.push(.5,1);
 colors.push(deep.r,deep.g,deep.b);
 for(let i=0;i<radial;i++){
  triangles.push(top,i,i+1);
  const base=rings*(radial+1);
  triangles.push(bottom,base+i+1,base+i);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(triangles);geo.computeVertexNormals();geo.computeBoundingSphere();
 const thigh=mesh(leg,geo,'phoenix-femur-muscle-'+(side<0?'L':'R'),
   {emissive:true});
 thigh.userData.phoenixAnatomicalFemur=true;
 thigh.userData.phoenixFemurContinuousSkin=true;
 thigh.userData.phoenixFemurMaxRadius=.257;
 return thigh;
}
function buildPhoenixChickenLeg(g,s,torso,side,detail){
 const suffix=side<0?'L':'R',name='leg'+suffix;
 // The upper thigh is substantial and distinctly separate from the
 // slender, angular chicken shank. A real knee pivot articulates them.
 const leg=g.group(name,[side*.275,1.19,-.115],torso);
 const thighSkin=phoenixAnatomicalThigh(g,leg,s,side,detail);
 const thigh=phoenixSurfaceScutes(leg,s,detail,
  'phoenix-long-thigh-scutes-'+suffix,{
   rows:detail==='source'?12:detail==='high'?9:detail==='medium'?7:5,
   columns:detail==='source'?15:detail==='high'?12:detail==='medium'?10:8,
   surface:phoenixThighSurface,
   widthAt:(u)=>u<.70?.205:.138,
   kind:'anatomical-upper-femur-keratin-scales'
  });
 thigh.userData.phoenixScaleWidth=.205;
 thigh.userData.phoenixScaleMultiplier=.205/.023;
 thigh.userData.phoenixScaleBone=leg.name;
 const knee=g.group('birdKnee'+suffix,[0,-.510,.105],leg);
 knee.userData.phoenixRealKnee=true;
 knee.userData.phoenixSeparateUpperLowerLeg=true;
 // The dark small patella is tucked into the tapered end of the femur.
 g.sphere(knee,'shadow',[0,-.012,0],[.063,.075,.060],
  {name:'phoenix-separate-knee-'+suffix,rough:.9});
 const ankle=g.group('birdAnkle'+suffix,[0,0,0],knee);
 // A chicken's exposed tarsometatarsus is a slender bony shaft.
 g.bone(ankle,'shadow',[0,.015,0],[0,-.461,.029],.030,
  {tipRadius:.019});
 const foot=g.group('avianFoot'+suffix,[0,-.449,.029],ankle);
 g.bone(foot,'shadow',[0,.04,.012],[0,-.012,.107],.035,
  {tipRadius:.024});
 // Three bent digits with realistic knuckles and separate hooked talons.
 for(let digit=0;digit<3;digit++){
  const spread=(digit-1)*.147;
  const root=[spread*.25,-.012,.102],joint=[spread*.63,-.038,.235],
    end=[spread,-.060,.337];
  g.bone(foot,'shadow',root,joint,.032,{tipRadius:.025});
  g.bone(foot,'shadow',joint,end,.025,{tipRadius:.017});
  g.sphere(foot,'shadow',joint,[.027,.023,.028],
   {name:'phoenix-toe-knuckle-'+suffix+'-'+digit,rough:.86});
  g.rootedSpike(foot,'bone','shadow',end,
    [spread*1.12,-.145,.449],.026,
    {name:'avian-hooked-talon-'+name+'-'+digit});
 }
 const heel=[0,-.010,-.012],joint=[0,-.028,-.115],
   end=[0,-.050,-.195];
 g.bone(foot,'shadow',heel,joint,.029,{tipRadius:.023});
 g.bone(foot,'shadow',joint,end,.025,{tipRadius:.018});
 g.rootedSpike(foot,'bone','shadow',end,
  [0,-.120,-.288],.026,{name:'avian-hallux-'+name});
 const shank=phoenixSurfaceScutes(ankle,s,detail,
  'phoenix-chicken-shank-scutes-'+suffix,{
    rows:detail==='source'?10:detail==='high'?7:detail==='medium'?5:4,
    columns:detail==='source'?10:detail==='high'?8:6,
    surface:(u,a)=>{
     // Leave the top and bottom joints bare to separate thigh, knee,
     // tarsus and toes visually; scutes cannot bridge the joint.
     const t=.13+.71*u,cs=Math.cos(a),sn=Math.sin(a);
     const rad=.033-.010*t;
     return {point:new THREE.Vector3(rad*cs,-.461*t,.029*t+rad*sn),
      normal:new THREE.Vector3(cs,.12,sn).normalize(),radius:rad};
    },
    widthAt:()=>.048,kind:'narrow-bare-chicken-tarsus-scutes'
  });
 shank.userData.phoenixScaleWidth=.048;
 shank.userData.phoenixScaleMultiplier=.048/.023;
 shank.userData.phoenixScaleBone=ankle.name;
 const footScutes=[];
 for(let digit=-1;digit<=1;digit++)for(let i=0;i<(detail==='low'?4:9);i++){
  const q=i/(detail==='low'?3:8),x=digit*.147*q*.9;
  footScutes.push({from:[x,-.012-q*.044,.12+.20*q],
   to:[x+digit*.015,-.014-q*.052,.18+.20*q],
   width:.064,normal:[0,.93,.2],ridge:.019,
   tint:i%3===0?2:1,endTint:3,glow:.20});
 }
 const toes=layeredFeathers(foot,s,detail,
  'phoenix-foot-toe-scutes-'+suffix,footScutes);
 toes.userData.phoenixAttachedScutes=true;
 toes.userData.phoenixScaleWidth=.064;
 toes.userData.phoenixScaleMultiplier=.064/.023;
 toes.userData.phoenixScaleBone=foot.name;
 leg.userData.phoenixLongSlimThigh=true;
 leg.userData.phoenixThighLength=.580;
 leg.userData.phoenixThighRadius=.257;
 leg.userData.phoenixSeparateThigh=true;
 ankle.userData.phoenixChickenShank=true;
 ankle.userData.phoenixTarsusLength=.461;
 ankle.userData.phoenixBareLowerShank=true;
 foot.userData.phoenixChickenToes=4;
 foot.userData.phoenixArticulatedPhalanges=true;
 g.root.userData.phoenixChickenLegRig=true;
 g.root.userData.phoenixThighShankSeparated=true;
 return {leg,knee,ankle,foot,thighSkin,thigh,shank,toes};
}
function bodyFeathers(g,s,p,torso,detail){
 if(s.id==='m013')return phoenixDenseScales(g,s,p,torso,detail);
 const source=detail==='source',low=detail==='low';
 const rings=low?4:source?12:detail==='high'?9:6,
   around=low?10:source?36:detail==='high'?28:18;
 const plumes=[];
 for(let i=0;i<rings;i++){
   const t=i/(rings-1),z=.44*p.body-.87*p.body*t;
   const bulge=Math.pow(Math.sin(Math.PI*(.08+.86*t)),.64);
   const rx=(.29+.045*Math.sin(t*Math.PI))*p.body*bulge;
   const ry=(.355+.045*Math.sin(t*Math.PI))*p.body*bulge;
   for(let j=0;j<around;j++){
     const a=2*Math.PI*(j+.5*(i%2))/around;
     const x=Math.cos(a)*rx,y=1.43+Math.sin(a)*ry;
     const cream=Math.abs(x)<.28&&z>.08;
     plumes.push({
       from:[x,y,z],to:[x*1.065,y-.085-.04*Math.sin(j*3),z-.085-.032*(j%3)],
       width:.021+.012*(1-t),normal:[Math.cos(a),Math.sin(a),.22],
       tint:cream?4:j%5===0?2:j%2===0?1:0,
       endTint:cream?4:3,glow:s.id==='m013'?.42:.10,
       ridge:.009
     });
   }
 }
 const result=layeredFeathers(torso,s,detail,'avian-layered-body-plumage-'+s.id,plumes);
 g.root.userData.avianBodyFeatherCount=plumes.length;
 return result;
}
// Outward-facing avian orbits with independent dark almond eyeliner.
function phoenixSculptedEyes(head,detail){
 const shell=(root,name,position,scale,hex,rough=.48)=>{
  const geo=new THREE.SphereGeometry(1,detail==='low'?10:18,
   detail==='low'?7:12);
  const c=color(hex),n=geo.getAttribute('position').count;
  const rgb=new Float32Array(n*3);
  for(let i=0;i<n;i++){rgb[i*3]=c.r;rgb[i*3+1]=c.g;rgb[i*3+2]=c.b;}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
  const m=mesh(root,geo,name);
  m.position.set(...position);m.scale.set(...scale);
  m.material.roughness=rough;return m;
 };
 const liner=(root,name,points,radius,hex)=>{
  const curve=new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p)));
  const geo=new THREE.TubeGeometry(curve,detail==='low'?8:18,
   radius,detail==='low'?4:6,false);
  const c=color(hex),n=geo.getAttribute('position').count;
  const rgb=new Float32Array(n*3);
  for(let i=0;i<n;i++){rgb[i*3]=c.r;rgb[i*3+1]=c.g;rgb[i*3+2]=c.b;}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
  const m=mesh(root,geo,name);
  m.userData.phoenixPhysicalEyeliner=true;return m;
 };
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R',socket=new THREE.Group();
  socket.name='phoenix-sculpted-orbit-'+suffix;
  // Lateral skull fitting prevents eyes disappearing inside the beak.
  socket.position.set(side*.105,.050,.262);
  socket.rotation.y=side*.91;head.add(socket);
  shell(socket,'phoenix-eye-socket-'+suffix,[0,0,.003],
   [.051,.036,.012],0x200e13,.86);
  shell(socket,'phoenix-amber-eye-'+suffix,[0,0,.014],
   [.042,.026,.012],0xffdf9a,.30);
  shell(socket,'phoenix-iris-'+suffix,[side*.002,-.001,.025],
   [.024,.023,.008],0xc86e28,.26);
  shell(socket,'phoenix-pupil-'+suffix,[side*.002,-.001,.033],
   [.010,.017,.004],0x140c15,.19);
  shell(socket,'phoenix-cornea-glint-'+suffix,[-.009,.010,.039],
   [.006,.005,.003],0xfff2ce,.12);
  liner(socket,'phoenix-upper-eyeliner-'+suffix,[
   [-.051,.003,.020],[-.032,.024,.030],[0,.030,.032],
   [.030,.025,.030],[.052,.009,.018]],.0065,0x190b16);
  liner(socket,'phoenix-lower-eyeliner-'+suffix,[
   [-.046,-.008,.022],[-.025,-.025,.026],[0,-.029,.027],
   [.027,-.022,.026],[.048,-.008,.019]],.0045,0x39161a);
  socket.userData.phoenixEyesVisible=true;
 }
 head.userData.phoenixSculptedEyeLiner=true;
}

/** One merged flame-plumage mesh, rooted into brow, temple and cheek.
 * Real curled vanes trail backwards, not forward across the eye sockets.
 * No transparent billboards or per-feather draw calls.
 */
function phoenixCranialFireFeathers(head,s,detail){
 const strands=[],n=detail==='low'?6:detail==='medium'?9:
   detail==='source'?18:14;
 for(const side of [-1,1]){
  for(let i=0;i<n;i++){
   const t=i/Math.max(1,n-1);
   // Eyebrow roots stay above the eye socket (eye centre y=.050).
   strands.push({
    from:[side*(.060+.052*t),.167+.012*(i%2),.25-.22*t],
    to:[side*(.21+.145*t),.32+.105*t,-.20-.62*t],
    width:.043+.026*(1-t),normal:[side*.37,.88,.39],
    ridge:.028,curl:side*(.048+.033*t),rise:.043,
    tint:i%4===0?3:i%3===0?2:1,endTint:3,glow:.90
   });
   // Cheek flame roots stay BELOW and behind the eyeliner, so the
   // new amber eyes and their pupil remain in clear view.
   strands.push({
    from:[side*(.149+.012*(i%2)),-.090-.024*t,.16-.23*t],
    to:[side*(.235+.115*t),-.022+.072*t,-.38-.48*t],
    width:.041+.019*(1-t),normal:[side*.75,.30,.57],
    ridge:.024,curl:side*(.036+.030*t),rise:.033,
    tint:i%3===0?1:i%3===1?2:0,endTint:3,glow:.88
   });
  }
 }
 const central=detail==='low'?4:detail==='medium'?6:9;
 for(let i=0;i<central;i++){
  const t=i/Math.max(1,central-1),side=i%2?-1:1;
  strands.push({
   from:[side*(.012+.036*t),.176,.21-.13*t],
   to:[side*(.050+.085*t),.36+.086*t,-.26-.40*t],
   width:.038+.013*t,normal:[side*.10,.94,.35],
   ridge:.032,curl:side*.035,rise:.050,
   tint:i%3===0?2:1,endTint:3,glow:.95
  });
 }
 const flame=layeredFeathers(head,s,detail,
  'phoenix-cranial-fire-plumage',strands);
 flame.material.emissive.setHex(0xe9470c);
 flame.material.emissiveIntensity=.56;
 flame.material.roughness=.53;
 flame.castShadow=false;flame.receiveShadow=false;
 flame.userData.phoenixCranialFireSculpt=true;
 flame.userData.phoenixRaisedFireVanes=true;
 flame.userData.phoenixCranialFlameVanes=strands.length;
 flame.userData.phoenixEyesUncovered=true;
 addPhoenixWave(flame,'crest');
 return flame;
}

function headAndCrest(g,s,p,torso,detail){
 const head=g.group('head',[0,s.id==='m014'?1.99:2.065,.365*p.neck],torso);
 // Phoenix crown is a compact, LONG skull: narrow brow, pronounced
 // nasal bridge, no ears or lateral ear-like crests.
 const skull=g.axialLoft(head,'skin',s.id==='m013'?PHOENIX_HEAD_STATIONS:[
  {z:.36*p.head,y:-.045,rx:.037,ry:.056},
  {z:.25*p.head,y:0,rx:.16*p.head,ry:.175*p.head},
  {z:.06,y:.055,rx:.235*p.head,ry:.235*p.head},
  {z:-.18,y:.063,rx:.245*p.head,ry:.245*p.head},
  {z:-.34,y:.055,rx:.07,ry:.095}
 ],{name:'avian-cranium-'+s.id,rough:.82,ribbing:.004,capEnds:true});
 skull.userData.avianRealCranium=true;
 if(s.id==='m013'){
  skull.userData.phoenixSmallElongatedHead=true;
  skull.userData.phoenixNoEars=true;
 }
 const beakSize=s.id==='m014'?.72:s.id==='m012'?1.13:1;
 const beak=s.id==='m013'?
   g.curvedHorn(head,'bone',
     [0,-.076,.357],[0,-.092,.516],[0,-.156,.668],.061,
     {name:'avian-hooked-beak-'+s.id}):
   g.curvedHorn(head,'bone',
     [0,-.085,.235*p.head],
     [0,-.125,.41*beakSize],
     [0,-.225,.54*beakSize],.107*beakSize,
     {name:'avian-hooked-beak-'+s.id});
 beak.userData.avianHookedKeratin=true;
 if(s.id==='m013'){
  beak.userData.phoenixLongNarrowBeak=true;
  beak.userData.phoenixBeakLength=.668;
  beak.userData.phoenixShortBeak=true;
  beak.userData.phoenixLipReduced=true;
  for(const side of [-1,1]){
   g.sphere(head,'shadow',[side*.038,-.093,.413],[.010,.007,.011],
     {name:'phoenix-long-beak-nostril-'+(side<0?'L':'R')});
  }
 }
 g.sphere(head,'shadow',
   s.id==='m013'?[0,-.132,.460]:[0,-.151,.31*beakSize],
   s.id==='m013'?[.050,.009,.085]:[.095,.019,.085],
   {name:'avian-beak-oral-seam-'+s.id});
 if(s.id==='m014'){
   // Owl facial disc is a fitted front-facing double ring, not an
   // oversized human eye or a ball stuck on the skull.
   for(const side of [-1,1]){
     const x=side*.132;
     const disc=g.ring(head,'light',[x,.080,.245],.118,.021);
     disc.name='owl-facial-disc-'+(side<0?'L':'R');
     g.sphere(head,'shadow',[x,.080,.265],[.084,.09,.020],
       {name:'owl-orbital-disc-'+side});
     g.sphere(head,'eye',[x,.080,.285],[.045,.048,.016],
       {name:'owl-iris-'+side,rough:.24});
     g.sphere(head,'shadow',[x,.080,.302],[.018,.026,.009],
       {name:'owl-pupil-'+side});
   }
 }else{
   // A tiny phoenix skull cannot use the adult eagle's wide eye socket.
   // Recess both eyes into the narrow original head, not outside the mesh.
   if(s.id==='m013'){
     phoenixSculptedEyes(head,detail);
     phoenixCranialFireFeathers(head,s,detail);
   }
   else g.eyes(head,.235,.063,.172*p.head,.054);
 }
 const crest=[];
 const count=detail==='low'?Math.min(6,p.crest):p.crest;
 for(let i=0;i<count;i++){
  const side=i%2?1:-1,q=i/(count-1||1);
  if(s.id==='m013'){
   // Swept-back crest, NOT spikes standing up like ears. Each vane
   // starts on the occiput and trails behind the neck in an all-back flow.
   const sheet=(i%5)/5;
   crest.push({
    from:[side*(.028+.071*sheet),.126+.021*(i%3),-.065-.18*q],
    to:[side*(.08+.18*q),.20+.09*Math.sin(q*Math.PI),
      -.62-1.10*q],
    width:.029+.011*(i%4),
    normal:[side*.15,.88,.34],
    tint:i%4===0?3:i%3===0?2:1,endTint:3,glow:.85
   });
  }else{
   const scale=s.id==='m014'?.82:.63;
   crest.push({from:[side*(.025+.085*q),.194,-.01-.10*q],
    to:[side*(.06+.14*q),.22+(.19+.32*q)*scale,-.14-.45*q*scale],
    width:.033+.010*(i%3),normal:[side*.32,.40,.92],
    tint:i%4===0?2:0,endTint:2,glow:.12});
  }
 }
 const crestMesh=layeredFeathers(head,s,detail,'avian-articulated-crest-'+s.id,crest);
 if(s.id==='m013'){
  crestMesh.userData.phoenixAllBackCrest=true;
  crestMesh.userData.phoenixNoEarTufts=true;
  addPhoenixWave(crestMesh,'crest');
 }
 return head;
}
function buildRaptorLeg(g,s,torso,side,z,front=false){
 if(s.id==='m013')return buildPhoenixChickenLeg(g,s,torso,side,g.root.userData.detail);
 const suffix=side<0?'L':'R',griffin=s.id==='m012';
 const name=griffin?(front?'legFront':'legRear')+suffix:'leg'+suffix;
 const leg=g.group(name,[side*(front?.265:.205),1.10,z],torso);
 g.bone(leg,'skin',[0,.065,0],[0,-.39,front?.10:.065],front?.111:.099,
   {tipRadius:.065});
 const ankle=g.group('birdAnkle'+(griffin?(front?'Front':'Rear'):'')+suffix,
   [0,-.39,front?.10:.065],leg);
 g.bone(ankle,'shadow',[0,.035,0],[0,-.495,.05],.075,{tipRadius:.050});
 const clawParent=g.group('avianFoot'+(griffin?(front?'Front':'Rear'):'')+suffix,
   [0,-.475,.080],ankle);
 g.sphere(clawParent,'shadow',[0,-.003,.12],[.129,.075,.16],
  {name:'avian-articulated-metatarsus-'+name});
 for(let digit=0;digit<3;digit++){
   const spread=(digit-1)*.119;
   const p0=[spread*.44,-.015,.131],p1=[spread,-.052,.267];
   g.bone(clawParent,'shadow',p0,p1,.050,{tipRadius:.031});
   g.rootedSpike(clawParent,'bone','shadow',p1,
     [spread*1.20,-.140,.373],.033,
     {name:'avian-hooked-talon-'+name+'-'+digit});
 }
 // Rear hallux is essential for an actual gripping raptor foot.
 g.bone(clawParent,'shadow',[0,-.013,.045],[0,-.036,-.110],
   .045,{tipRadius:.031});
 g.rootedSpike(clawParent,'bone','shadow',
   [0,-.036,-.115],[0,-.110,-.243],.037,
   {name:'avian-hallux-'+name});
}
function tailFeathers(g,s,p,torso,detail){
 const tail=g.group('tail',[0,1.45,-.50*p.body],torso);
 const low=detail==='low',count=low?5:s.id==='m013'?
   detail==='medium'?17:31:s.id==='m014'?9:13;
 const guides=[];
 for(let i=0;i<count;i++){
   const q=(i-(count-1)/2)/Math.max(1,(count-1)/2);
   const spread=s.id==='m014'?.26:s.id==='m013'?1.28:.54;
   const length=p.tail*(s.id==='m013'?1.42:1);
   guides.push({from:[q*.095,.025,-.07],
    to:[q*spread+Math.sin(i*1.2)*.045,
      -.16-.14*(1-Math.abs(q))+(s.id==='m013'?.17*Math.sin(i*.45):0),
      -length*(.85+.25*(1-Math.abs(q)))],
    width:s.id==='m013'?.167:.087,
    normal:[q*.12,.83,.2],ridge:.025,
    tint:s.id==='m013'?(i%4===0?3:i%3===0?2:1):i%3,
    endTint:3,glow:s.id==='m013'?.92:.18});
 }
 const streamer=layeredFeathers(tail,s,detail,
   'avian-tail-rooted-streamers-'+s.id,guides);
 if(s.id==='m013'){
  streamer.userData.phoenixLongTailFan=true;
  streamer.userData.phoenixTailLength=p.tail*1.42;
  addPhoenixWave(streamer,'tail');
 }
 tail.userData.avianTailRootFitted=true;
 return tail;
}
export function buildGuardianDerivedBird(g,s){
 const p=profiles[s.id];if(!p)return false;
 const detail=g.root.userData.detail,torso=g.group('torso');
 g.root.userData.avianRebuildRevision=AVIAN_REALISM_REVISION;
 g.root.userData.avianGuardianGeometryDonor='seraph_guardian';
 g.root.userData.avianAnatomicalKind=p.type;
 if(s.id==='m013'){
  g.root.userData.phoenixSlenderAnatomy=false;
  g.root.userData.phoenixExpandedThorax=true;
  g.root.userData.phoenixTorsoRadiusX=.365;
  g.root.userData.phoenixTorsoRadiusY=.468;
  g.root.userData.phoenixNoExternalEars=true;
   g.root.userData.phoenixVisibleEyeliner=true;
    g.root.userData.phoenixFaceFlames=true;
    g.root.userData.phoenixMiniGuardianHandWings=true;
   g.root.userData.phoenixHandSkinHiddenUnderFeathers=true;
  g.root.userData.phoenixWingSpanFactor=p.wing[0];
 }
 const body=g.axialLoft(torso,'skin',plumageStations(p),
   {name:'avian-keel-rib-cavity-'+s.id,rough:.91,ribbing:.006,capEnds:true});
 body.userData.avianClosedThorax=true;
 bodyFeathers(g,s,p,torso,detail);
 // Feathered sternum and a continuous forward cervix, not a neck sphere.
 g.bridge(torso,'skin',[0,1.55,.22*p.body],
   [0,1.96,.30*p.neck],.217*p.body,.149*p.neck);
 // Distinct visible feather hands nest beside the chest, beneath the
 // unchanged guardian wings. No naked human arms or detached floating strips.
 if(s.id==='m013')for(const side of [-1,1])
  phoenixFeatheredArm(g,s,torso,side,detail);
 const head=headAndCrest(g,s,p,torso,detail);
 if(s.id==='m013')phoenixNeckCrownScutes(g,s,p,torso,head,detail);
 for(const side of [-1,1]){
   const suffix=side<0?'L':'R';
   const wing=g.group('wing'+suffix,[side*.295*p.body,1.71,-.10],torso);
   const donor=guardianDerivedWing(wing,s,side,detail);
   g.sphere(wing,'skin',[0,0,-.025],[.165,.177,.185],
     {name:'avian-scapula-cover-'+suffix});
   const elbow=g.group('wingElbow'+suffix,
     [side*.60,.36,-.13],wing);
   elbow.userData.avianWingBone='ulna-radius';
   const wrist=g.group('wingWrist'+suffix,
     [side*.56,.33,-.13],elbow);
   wrist.userData.avianWingBone='carpometacarpus';
   if(s.id==='m013'){
     phoenixWingHandScutes(wing,s,side,detail,
       'phoenix-wing-forearm-scutes-'+suffix,'elbow',donor);
     phoenixWingHandScutes(wing,s,side,detail,
       'phoenix-wing-hand-scutes-'+suffix,'wrist',donor);
   }
   // A separate hinged set of overlapping outer feathers gives pose
   // articulation without tearing the ONE-PIECE angel donor feather mesh.
   if(detail!=='low'){
     const out=[];
     for(let i=0;i<(detail==='source'?13:detail==='high'?9:5);i++){
       const t=i/Math.max(1,(detail==='source'?12:detail==='high'?8:4));
       out.push({from:[side*(.01+.12*t),.02+.10*t,-.08],
         to:[side*(.22+.58*t),.17+.21*t,-.32-.10*t],
         width:.075+.020*t,normal:[0,.46,.88],
         tint:i%4===0?2:i%3===0?0:1,endTint:3,glow:.25});
     }
     layeredFeathers(wrist,s,detail,'avian-wrist-overlapping-primary-'+suffix,out);
   }
   wing.userData.avianGuardianDonorTriangles=donor.userData.angelDonorGeometryTriangles;
 }
 if(s.id==='m012'){
   // Griffin hybrid uses four separate digitigrade legs with bird
   // talons in front and lion-like heavy hindquarters.
   for(const side of [-1,1]){
     buildRaptorLeg(g,s,torso,side,.29,true);
     buildRaptorLeg(g,s,torso,side,-.38,false);
   }
 }else for(const side of [-1,1])buildRaptorLeg(g,s,torso,side,.095);
 tailFeathers(g,s,p,torso,detail);
 if(s.id==='m013'){
  const animated=[];
  g.root.traverse(child=>{
   if(child.isMesh&&child.userData.phoenixWaveDynamic)animated.push(child);
  });
  g.root.userData.phoenixWaveMeshes=animated;
  g.root.userData.phoenixWaveMeshCount=animated.length;
 }
 g.root.scale.setScalar(s.size*.80);
 return true;
}
