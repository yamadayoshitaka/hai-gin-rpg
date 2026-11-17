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

export const AVIAN_REALISM_REVISION='phoenix-giant-wing-scaled-v2-20261118';
export const AVIAN_REFRESH_IDS=Object.freeze(['m011','m012','m013','m014']);

const profiles=Object.freeze({
 m011:Object.freeze({type:'eagle',wing:[.65,.58,.91],tail:1.18,
   body:1,neck:1,head:1,crest:6,breast:0xbaa688,
   dark:0x523829,mid:0x9c7051,light:0xd4bc93,tip:0xe1d1ae}),
 m012:Object.freeze({type:'griffin',wing:[.81,.67,.96],tail:1.02,
   body:1.20,neck:1.12,head:1.14,crest:13,breast:0xf0d1a0,
   dark:0x674b35,mid:0xa47d52,light:0xe4c58d,tip:0xffecc1}),
 m013:Object.freeze({type:'phoenix',wing:[1.24,1.03,1.19],tail:3.22,
   body:.82,neck:1.38,head:.68,crest:25,breast:0xffe8c6,
   dark:0x871d20,mid:0xd83f27,light:0xff871e,tip:0xffdf8b}),
 m014:Object.freeze({type:'owl',wing:[.57,.46,.84],tail:.66,
   body:1.16,neck:.76,head:1.22,crest:11,breast:0xd9c7a9,
   dark:0x534c47,mid:0x918474,light:0xbeb1a0,tip:0xe2d8c4}),
});
export const avianProfile=id=>profiles[id]||null;
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
   .replace('#include <common>', '#include <common>\\nuniform float phoenixWaveTime;\\nuniform float phoenixWavePower;')
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
   action==='run'||action==='leap'?1.12:action==='defeat'?.08:.58;
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
function guardianDerivedWing(parent,spec,side,detail){
 const p=profiles[spec.id],donor=guardianPair(detail);
 const base=side<0?donor.left:donor.right;
 let geo=base.clone();
 if(detail==='source'){
   const refined=refineOnce(geo);geo.dispose();geo=refined;
 }
 geo.scale(...p.wing);
 const positions=geo.getAttribute('position');
 const old=geo.getAttribute('color'),arr=new Float32Array(positions.count*3);
 const dark=color(p.dark),mid=color(p.mid),light=color(p.light),tip=color(p.tip);
 for(let i=0;i<positions.count;i++){
   const radial=Math.min(1,Math.abs(positions.getX(i))/(2.95*p.wing[0]));
   const height=Math.min(1,Math.max(0,positions.getY(i)/(1.9*p.wing[1])));
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
 const wing=mesh(parent,geo,'avian-guardian-three-layer-wing-'+spec.id+'-'+(side<0?'L':'R'),
   {emissive:spec.id==='m013'});
 wing.userData.angelSource='seraph_guardian';
 wing.userData.angelFeatherLayers=3;
 wing.userData.angelFeathersPerSide=detail==='low'||detail==='medium'?18:82;
 wing.userData.angelDonorGeometryTriangles=
   (base.index?.count??base.getAttribute('position').count)/3;
 wing.userData.birdWingRealGeometry=true;
 wing.userData.birdWingDetail=detail;
 wing.userData.birdWingRooted=true;
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
   // Tall, narrow, keel-forward silhouette; no bulky oval stomach.
   {z:.61,y:1.56,rx:.060,ry:.115},
   {z:.44,y:1.46,rx:.185,ry:.255},
   {z:.21,y:1.44,rx:.245,ry:.325},
   {z:-.11,y:1.44,rx:.258,ry:.332},
   {z:-.44,y:1.46,rx:.204,ry:.267},
   {z:-.72,y:1.49,rx:.042,ry:.070}
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
function phoenixDenseScales(g,s,p,torso,detail){
 // Each scale is a tiny overlapping curved feather vane, rooted directly
 // in the accurate THORAX surface. No floating plates or exposed skin.
 const close=detail==='source',high=detail==='high',low=detail==='low';
 const rows=low?7:close?34:high?23:15;
 const around=low?14:close?68:high?48:30;
 const stations=plumageStations(p);
 const surfaceAt=z=>{
  for(let n=0;n<stations.length-1;n++){
   const a=stations[n],b=stations[n+1];
   if(z<=a.z&&z>=b.z){
    const t=(a.z-z)/(a.z-b.z);
    return {y:a.y+(b.y-a.y)*t,rx:a.rx+(b.rx-a.rx)*t,
      ry:a.ry+(b.ry-a.ry)*t};
   }
  }
  return stations.at(-1);
 };
 const scales=[];
 for(let i=0;i<rows;i++){
  const z=.42-1.015*i/Math.max(1,rows-1);
  const v=surfaceAt(z);
  for(let j=0;j<around;j++){
   const theta=2*Math.PI*(j+.5*(i%2))/around;
   const sx=Math.cos(theta),sy=Math.sin(theta);
   const x=sx*v.rx*1.005,y=v.y+sy*v.ry*1.005;
   const cream=z>.15&&sy<-.30;
   scales.push({
    from:[x,y,z],
    to:[x+sx*.013,y+sy*.012-.017,z-(low?.125:.088)],
    width:(low?.034:.023)*(0.87+v.rx*.60),
    normal:[sx,sy,.13],ridge:low?.009:.014,
    tint:cream?4:j%7===0?2:j%3===0?1:0,
    endTint:cream?4:3,glow:.35
   });
  }
 }
 const coat=layeredFeathers(torso,s,detail,
   'avian-layered-body-plumage-'+s.id,scales);
 coat.userData.imbricatedKeratinScales=true;
 coat.userData.scaleCount=scales.length;
 coat.userData.originalBodyAnatomy='thin-closed-axial-thorax';
 g.root.userData.avianBodyFeatherCount=scales.length;
 g.root.userData.phoenixDenseScaleCount=scales.length;
 return coat;
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
function headAndCrest(g,s,p,torso,detail){
 const head=g.group('head',[0,s.id==='m014'?1.99:2.065,.365*p.neck],torso);
 // Phoenix crown is a compact, LONG skull: narrow brow, pronounced
 // nasal bridge, no ears or lateral ear-like crests.
 const skull=g.axialLoft(head,'skin',s.id==='m013'?[
   {z:.475,y:-.074,rx:.024,ry:.037},
   {z:.366,y:-.053,rx:.070,ry:.089},
   {z:.235,y:.012,rx:.110,ry:.135},
   {z:.075,y:.051,rx:.142,ry:.170},
   {z:-.175,y:.054,rx:.137,ry:.161},
   {z:-.395,y:.056,rx:.040,ry:.055}
 ]:[
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
     [0,-.076,.357],[0,-.084,.675],[0,-.216,.95],.061,
     {name:'avian-hooked-beak-'+s.id}):
   g.curvedHorn(head,'bone',
     [0,-.085,.235*p.head],
     [0,-.125,.41*beakSize],
     [0,-.225,.54*beakSize],.107*beakSize,
     {name:'avian-hooked-beak-'+s.id});
 beak.userData.avianHookedKeratin=true;
 if(s.id==='m013'){
  beak.userData.phoenixLongNarrowBeak=true;
  beak.userData.phoenixBeakLength=.95;
  for(const side of [-1,1]){
   g.sphere(head,'shadow',[side*.038,-.093,.435],[.010,.007,.011],
     {name:'phoenix-long-beak-nostril-'+(side<0?'L':'R')});
  }
 }
 g.sphere(head,'shadow',
   s.id==='m013'?[0,-.139,.518]:[0,-.151,.31*beakSize],
   s.id==='m013'?[.055,.011,.175]:[.095,.019,.085],
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
   g.eyes(head,.235,.063,.172*p.head,.054);
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
  g.root.userData.phoenixSlenderAnatomy=true;
  g.root.userData.phoenixNoExternalEars=true;
  g.root.userData.phoenixWingSpanFactor=p.wing[0];
 }
 const body=g.axialLoft(torso,'skin',plumageStations(p),
   {name:'avian-keel-rib-cavity-'+s.id,rough:.91,ribbing:.006,capEnds:true});
 body.userData.avianClosedThorax=true;
 bodyFeathers(g,s,p,torso,detail);
 // Feathered sternum and a continuous forward cervix, not a neck sphere.
 g.bridge(torso,'skin',[0,1.55,.22*p.body],
   [0,1.96,.30*p.neck],.217*p.body,.149*p.neck);
 headAndCrest(g,s,p,torso,detail);
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
