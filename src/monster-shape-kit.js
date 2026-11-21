/** Reusable anatomical sculpt tools for the fifty-monster bestiary.
 * 'source' is a deliberately expensive sculpting master (never automatic on
 * mobile); 'high' is the playable preview and 'low' is the future distance LOD.
 * Meshes are cached only where geometry parameters are genuinely reusable.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {nonhumanMonsterStage} from './nonhuman-model-quality.js';
import {realismPaletteFor} from './monster-realistic-palettes.js?v=m018-armored-four-cell-hydra-v24-20261121';
import {createMonsterAnatomicalLoft} from './monster-realistic-loft.js?v=4.4.99';
import {createCreatureGumSocketGeometry,createCreatureFittedHemGeometry} from './creature-seam-geometry.js';
import {createRootedCreatureHornGeometry} from './creature-anatomy-mesh.js';
import {creatureFaceVolume,sculptAxialFacePoint} from './creature-face-volume.js?v=m001-photo-wolf-v11-20261116';
import {buildCanineFurRibbonGeometry} from './canine-fur-ribbons.js?v=4.4.89';
import {decorateMonsterPhotoMaterial,detachMonsterPhotoMaterial} from './monster-photo-pbr.js?v=m016-m017-salamander-quality-v21-20261121';

export const MONSTER_DETAIL_LEVELS=Object.freeze({
  source:Object.freeze({sphere:[112,80],rock:4,rod:28,tube:[64,16],torus:[16,72]}),
  high:Object.freeze({sphere:[38,26],rock:2,rod:12,tube:[22,8],torus:[9,32]}),
  medium:Object.freeze({sphere:[27,19],rock:1,rod:9,tube:[16,6],torus:[7,24]}),
  low:Object.freeze({sphere:[14,10],rock:0,rod:7,tube:[10,5],torus:[6,16]}),
});
/** Per-family sculpt quality: human-like monster families are intentionally frozen. */
export function monsterResolutionFor(spec,detail='high'){
 const base=MONSTER_DETAIL_LEVELS[detail];
 if(!base)throw Error('Unknown sculpture resolution: '+detail);
 const stage=detail==='low'?0:nonhumanMonsterStage(spec);
 if(!stage)return base;
 return {
   sphere:[base.sphere[0]+stage*(detail==='source'?2:1),
     base.sphere[1]+stage*(detail==='source'?2:1)],
   rock:base.rock,
   rod:base.rod+Math.ceil(stage/2),
   tube:[base.tube[0]+stage*(detail==='source'?2:1),
     base.tube[1]+Math.ceil(stage/3)],
   torus:[base.torus[0]+Math.ceil(stage/3),base.torus[1]+stage],
 };
}
/** Tone down saturated game-toy pigments while preserving each element.
 * Ritual accents remain identifiable; bodily surfaces resemble dry skin,
 * worn scales and fur under neutral cinematic lighting.
 */
const naturalPigment=(hex,saturation=.80)=>{
 const color=new THREE.Color(hex),hsl={};
 color.getHSL(hsl);
 color.setHSL(hsl.h,Math.max(0,Math.min(1,hsl.s*saturation)),
   Math.max(0,Math.min(1,hsl.l*.97)));
 return '#'+color.getHexString();
};
const geometryCache=new Map(),materialCache=new Map();
function cachedGeometry(key,make){
 if(!geometryCache.has(key))geometryCache.set(key,make());
 return geometryCache.get(key);
}
function material(color,{metal=0.08,rough=.69,glow=false,translucent=false}={},spec={},role='skin',detail='high'){
 const key=[spec.id,spec.family,role,detail,color,metal,rough,glow,translucent].join(':');
 let entry=materialCache.get(key);
 if(!entry){
   const wet=spec.family==='aquatic'&&translucent;
   const M=wet?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;
   const mat=new M({
     color,roughness:wet?.13:rough,metalness:wet?0:metal,
     side:THREE.DoubleSide,
     emissive:glow?color:0x000000,emissiveIntensity:glow?.46:0,
     transparent:translucent,opacity:translucent?.82:1,
     depthWrite:!translucent,
     ...(wet?{clearcoat:.88,clearcoatRoughness:.085,ior:1.35,
       transmission:.14,thickness:.4}:{}),
   });
   if(role==='skin'||role==='light'||role==='fabric'||role==='bandage'||
     role==='leather'||role==='metal'||(spec.family==='golem'&&role==='shadow')||(['m016','m017','m019'].includes(spec.id)&&role==='shadow')){
     decorateMonsterPhotoMaterial(mat,{
       family:spec.family,speciesId:spec.id,role,detail,metal,glow,translucent,
     });
   }
   mat.userData.monsterCacheKey=key;
   entry={mat,refs:0};
   materialCache.set(key,entry);
 }
 entry.refs++;
 return entry.mat;
}
function releaseMaterial(mat){
 const key=mat?.userData?.monsterCacheKey;
 const entry=materialCache.get(key);
 if(!entry)return;
 entry.refs--;
 if(entry.refs===0){
   detachMonsterPhotoMaterial(entry.mat);
   entry.mat.dispose();
   materialCache.delete(key);
 }
}
export function monsterSculptCacheStats(){
 return {geometries:geometryCache.size,activeMaterials:materialCache.size};
}
export function createSculpture(spec,detail='high'){
 const resolution=monsterResolutionFor(spec,detail);
 const nonhumanStage=detail==='low'?0:nonhumanMonsterStage(spec);
 if(!resolution)throw Error('Unknown sculpture resolution: '+detail);
 const fine=detail!=='low',pivots={},root=new THREE.Group();root.name=spec.id+'-'+spec.name;
 const colors=spec.colors,realism=realismPaletteFor(spec);
 const tone={skin:naturalPigment(colors.base,.80),
   light:naturalPigment(colors.highlight,.83),
   accent:naturalPigment(colors.accent,.90),
   shadow:'#26232c',bone:'#e9dfc5',
   fabric:'#493d43',bandage:'#b4a993',leather:'#4b3734',
   metal:'#737d83',hair:'#302a29',mortalSkin:'#a49b93',
   // Eyes are pigmented and recessed, never generic neon spheres.
   eye:['insect','arachnid'].includes(spec.family)?'#30262a':
     spec.family==='aquatic'?'#6fa0a2':
     spec.family==='reptile'?'#b18f4d':
     spec.family==='avian'?'#b99955':'#a68b51'};
 if(realism)Object.assign(tone,realism);
 if(spec.id==='m001'){
   // Wolf king: earthy rust/amber irises, subdued ivory keratin and no
   // emissive circular stickers. All other species retain their palettes.
   tone.eye='#b66d43';
   tone.bone='#ddd0b5';
 }
 const V=v=>new THREE.Vector3(...v);
 const attach=(parent,geo,shade,opt={})=>{
   const isRole=typeof shade==='string'&&Object.hasOwn(tone,shade);
   const role=isRole?shade:'detail';
   const mesh=new THREE.Mesh(geo,material(tone[shade]??shade,opt,spec,role,detail));
   mesh.name=opt.name??shade;mesh.castShadow=true;mesh.receiveShadow=true;
   parent.add(mesh);return mesh;
 };
 const own=(mesh)=>{mesh.userData.ownedGeometry=true;return mesh;};
 const group=(name,position=[0,0,0],parent=root)=>{
   const g=new THREE.Group();g.name=name;g.position.set(...position);
   parent.add(g);pivots[name]=g;return g;
 };
 const sphere=(parent,shade,position,scale,options={})=>{
   const [w,h]=resolution.sphere;
   const geo=cachedGeometry('sphere:'+detail+':'+w+':'+h,
     ()=>new THREE.SphereGeometry(1,w,h));
   const m=attach(parent,geo,shade,options);m.position.set(...position);m.scale.set(...scale);return m;
 };
 const rock=(parent,shade,position,scale,options={})=>{
   const geo=cachedGeometry('rock:'+detail+':'+resolution.rock,
     ()=>new THREE.DodecahedronGeometry(1,resolution.rock));
   const m=attach(parent,geo,shade,{rough:.88,metal:.07,...options});
   m.position.set(...position);m.scale.set(...scale);return m;
 };
 const oriented=(parent,shade,from,to,radius,tipRadius,geoFactory,options={})=>{
   const a=V(from),b=V(to),dir=b.clone().sub(a),length=dir.length();
   if(length<1e-5)return null;
   const geo=geoFactory(length);
   const m=own(attach(parent,geo,shade,options));
   m.position.copy(a).add(b).multiplyScalar(.5);
   m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
   return m;
 };
 const bone=(parent,shade,from,to,radius,{tipRadius=.025,metal=.07,rough=.72}={})=>
   oriented(parent,shade,from,to,radius,tipRadius,
     length=>new THREE.CylinderGeometry(tipRadius,radius,length,resolution.rod,2),
     {metal,rough});
 const spike=(parent,shade,from,to,radius=.08)=>
   oriented(parent,shade,from,to,radius,0,
     length=>new THREE.ConeGeometry(radius,length,resolution.rod,2));
 // A rooted organic tooth/nail has a buried enamel base and a material-
 // correct flesh/keratin socket, both inheriting the same animated parent.
 const rootedSpike=(parent,enamel,rootShade,from,to,radius=.034,{name='claw'}={})=>{
   const a=V(from),axis=V(to).sub(a);
   if(axis.lengthSq()<1e-9)return null;
   const buried=a.clone().addScaledVector(axis,-.12).toArray();
   const tooth=spike(parent,enamel,buried,to,radius);
   if(tooth)tooth.name=name;
   const socket=own(attach(parent,createCreatureGumSocketGeometry({
     base:from,tip:to,radius,detail
   }),rootShade,{name:name+'-root',rough:.88,metal:0}));
   return {tooth,socket};
 };
 const seamHem=(parent,shade,{center,axis=[0,1,0],radiusX,radiusZ,
   width=.06,thickness=.012,name='fitted-garment-hem'}={})=>{
   const geometry=createCreatureFittedHemGeometry({
     center,axis,radiusX,radiusZ,width,thickness,detail
   });
   return own(attach(parent,geometry,shade,{
     name,rough:.91,metal:shade==='metal'?.54:0
   }));
 };
 const tube=(parent,shade,points,radius=.04,{
   name=null,capEnds=false,taper=1,glow=false,
   tubularSegments=null,radialSegments=null
 }={})=>{
   const curve=new THREE.CatmullRomCurve3(points.map(V));
   const [defaultSegments,defaultRadial]=resolution.tube;
   const segments=tubularSegments??defaultSegments;
   const radial=radialSegments??defaultRadial;
   const geo=new THREE.TubeGeometry(curve,segments,radius,radial,false);
   // Skinned tails and organic necks are NOT open pipes. Rebuild tapered
   // rings in place, then add real triangles closing both extremities.
   if(capEnds||taper!==1){
     const p=geo.getAttribute('position');
     for(let row=0;row<=segments;row++){
       const t=row/segments,center=curve.getPointAt(t);
       const width=1+(taper-1)*(t*t*(3-2*t));
       for(let j=0;j<=radial;j++){
         const i=row*(radial+1)+j;
         p.setXYZ(i,center.x+(p.getX(i)-center.x)*width,
           center.y+(p.getY(i)-center.y)*width,
           center.z+(p.getZ(i)-center.z)*width);
       }
     }
     if(capEnds){
       const positions=Array.from(p.array),uv=Array.from(geo.getAttribute('uv').array);
       const index=Array.from(geo.getIndex().array);
       const first=positions.length/3;positions.push(...curve.getPointAt(0).toArray());uv.push(.5,0);
       const last=positions.length/3;positions.push(...curve.getPointAt(1).toArray());uv.push(.5,1);
       const end=segments*(radial+1);
       for(let j=0;j<radial;j++){
         index.push(first,j+1,j);
         index.push(last,end+j,end+j+1);
       }
       geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
       geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
       geo.setIndex(index);
     }else p.needsUpdate=true;
     geo.computeVertexNormals();
     geo.computeBoundingSphere();
   }
   const mesh=own(attach(parent,geo,shade,{name:name||shade,glow}));
   if(capEnds){
     mesh.userData.cappedTubularSkin=true;
     mesh.userData.endCapTriangles=radial*2;
     mesh.userData.tailTaper=taper;
   }
   return mesh;
 };
 /** Smooth continuous tapered joint between shoulder and skull; bury the
  * broad end in the body and the narrow end inside the head.
  */
 const bridge=(parent,shade,from,to,startRadius,endRadius,{
   longitudinalSegments=null,radialSegments=null
 }={})=>{
   const a=V(from),b=V(to),d=b.clone().sub(a),length=d.length();
   if(length<.0001)return null;
   // Keep the proven mobile oriented-bridge renderer. Optional quality
   // rings are used only for m019; every other species keeps its old LOD.
   const [defaultSegments,defaultRadial]=resolution.tube;
   const segments=longitudinalSegments??defaultSegments;
   const radial=radialSegments??defaultRadial;
   const axis=d.normalize(),u=new THREE.Vector3(1,0,0);
   if(Math.abs(u.dot(axis))>.94)u.set(0,0,1);
   u.addScaledVector(axis,-u.dot(axis)).normalize();
   const v=new THREE.Vector3().crossVectors(axis,u).normalize();
   const vertices=[],uv=[],indices=[];
   for(let i=0;i<=segments;i++){
     const t=i/segments,smooth=t*t*(3-2*t);
     const radius=startRadius+(endRadius-startRadius)*smooth;
     const center=a.clone().lerp(b,t);
     for(let j=0;j<=radial;j++){
       const angle=2*Math.PI*j/radial;
       const p=center.clone().addScaledVector(u,Math.cos(angle)*radius)
         .addScaledVector(v,Math.sin(angle)*radius);
       vertices.push(p.x,p.y,p.z);uv.push(j/radial,t);
     }
   }
   for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){
     const x=i*(radial+1)+j,y=x+radial+1;
     indices.push(x,y,x+1,x+1,y,y+1);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(indices);geo.computeVertexNormals();
   return own(attach(parent,geo,shade));
 };
 /**
  * Axially continuous organic source surface with independently authored
  * anatomical cross-sections (not sphere subdivision). The source geometry
  * changes actual shoulder/rib/pelvis volumes before LOD is derived.
  * Station order is nose (+Z) -> tail (-Z). Animated parts remain separate.
  */
 const axialLoft=(parent,shade,stations,{name='axial-anatomical-source',
   rough=.78,ribbing=.012,faceSculpt=false,capEnds=false}={})=>{
   if(!Array.isArray(stations)||stations.length<3||
     !stations.every(p=>Number.isFinite(p.z)&&Number.isFinite(p.y)&&
       Number.isFinite(p.rx)&&p.rx>0&&Number.isFinite(p.ry)&&p.ry>0))
     throw Error('Axial sculpt needs at least three finite positive anatomical stations');
   for(let i=1;i<stations.length;i++)
     if(stations[i-1].z<=stations[i].z)
       throw Error('Axial stations must run from head (+Z) to tail (-Z)');
   const radial=detail==='source'?64:detail==='high'?36:
     detail==='medium'?24:12;
   const steps=detail==='source'?8:detail==='high'?4:
     detail==='medium'?3:2;
   const count=(stations.length-1)*steps+1;
   const vertex=[],uv=[],indices=[];
   const facialVolume=faceSculpt?creatureFaceVolume(spec.id,spec.family):null;
   const cubic=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+
     (2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
   for(let i=0;i<count;i++){
     const band=Math.min(stations.length-2,Math.floor(i/steps));
     const t=i===count-1?1:(i-band*steps)/steps;
     const p0=stations[Math.max(0,band-1)],p1=stations[band],
       p2=stations[band+1],p3=stations[Math.min(stations.length-1,band+2)];
     const interpolate=key=>cubic(p0[key],p1[key],p2[key],p3[key],t);
     const z=interpolate('z'),y=interpolate('y'),
       rx=Math.max(.012,interpolate('rx')),ry=Math.max(.012,interpolate('ry'));
     for(let j=0;j<=radial;j++){
       const a=j/radial*Math.PI*2;
       const organic=1+(detail==='low'?0:ribbing)*
         Math.sin(a*5+z*3.1)*Math.sin(Math.PI*i/(count-1));
       const x=Math.cos(a)*rx*organic,yy=y+Math.sin(a)*ry*organic;
       const point=facialVolume?
         sculptAxialFacePoint(x,yy,z,1-i/(count-1),a,facialVolume):
         [x,yy,z];
       vertex.push(...point);
       uv.push(j/radial,i/(count-1));
     }
   }
   for(let i=0;i<count-1;i++)for(let j=0;j<radial;j++){
     const a=i*(radial+1)+j,b=a+radial+1;
     indices.push(a,b,a+1,a+1,b,b+1);
   }
   if(capEnds){
     // Torso has a genuine closed hull, not just a two-sided open sleeve.
     const front=vertex.length/3;
     vertex.push(0,stations[0].y,stations[0].z);uv.push(.5,0);
     const back=vertex.length/3;
     const last=stations[stations.length-1];
     vertex.push(0,last.y,last.z);uv.push(.5,1);
     const lastRow=(count-1)*(radial+1);
     for(let j=0;j<radial;j++){
       indices.push(front,j,j+1);
       indices.push(back,lastRow+j+1,lastRow+j);
     }
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertex,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(indices);
   geo.computeVertexNormals();
   geo.computeBoundingSphere();
   if(facialVolume){
     geo.userData.anatomy='face';
     geo.userData.faceVolumeApplied=true;
   }
   const mesh=own(attach(parent,geo,shade,{name,rough,metal:0}));
   if(facialVolume)mesh.userData.anatomyLoft=true;
   mesh.userData.axialAnatomy=true;
   mesh.userData.anatomicalStations=stations.length;
   mesh.userData.proceduralSource=true;
   if(capEnds){
     mesh.userData.closedAnatomicalHull=true;
     mesh.userData.anatomicalEndCaps=radial*2;
   }
   return mesh;
 };
 /** Anatomical quadruped muscle surface, in existing articulated joint space.
  * No disconnected sphere at the elbow, hock or shoulder. Each mesh is a
  * continuous variable-section skin shell and follows its owning pivot.
  */
 const limbLoft=(parent,shade,stations,{name='beast-anatomical-limb'}={})=>{
   if(!Array.isArray(stations)||stations.length<3||stations.some((p,i)=>
     !['x','y','z','rx','rz'].every(k=>Number.isFinite(p[k]))||
     p.rx<=0||p.rz<=0||(i&&stations[i-1].y<=p.y)))
     throw Error('Malformed anatomical limb cross sections');
   const radial=detail==='source'?48:detail==='high'?28:detail==='medium'?20:10;
   const rows=detail==='source'?8:detail==='high'?5:3;
   const vertices=[],uv=[],idx=[];
   for(let i=0;i<stations.length-1;i++)for(let row=0;row<rows;row++){
     const a=stations[i],b=stations[i+1],t=row/rows,
       u=t*t*(3-2*t),mix=k=>a[k]*(1-u)+b[k]*u;
     const x=mix('x'),y=mix('y'),z=mix('z'),rx=mix('rx'),rz=mix('rz');
     for(let j=0;j<=radial;j++){
       const theta=j/radial*Math.PI*2;
       const muscle=1+.035*Math.cos(theta*3)*Math.sin(Math.PI*(i+u)/(stations.length-1));
       vertices.push(x+Math.cos(theta)*rx*muscle,y,z+Math.sin(theta)*rz*muscle);
       uv.push(j/radial,(i+u)/(stations.length-1));
     }
   }
   const last=stations[stations.length-1];
   for(let j=0;j<=radial;j++){
     const a=j/radial*Math.PI*2;
     vertices.push(last.x+Math.cos(a)*last.rx,last.y,last.z+Math.sin(a)*last.rz);
     uv.push(j/radial,1);
   }
   for(let i=0;i<(stations.length-1)*rows;i++)for(let j=0;j<radial;j++){
     const a=i*(radial+1)+j,b=a+radial+1;
     idx.push(a,b,a+1,a+1,b,b+1);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(idx);geo.computeVertexNormals();geo.computeBoundingSphere();
   const mesh=own(attach(parent,geo,shade,{name,rough:.86,metal:0}));
   mesh.userData.anatomicalLimb=true;
   return mesh;
 };
 /**
  * One anatomical skin for each cat leg (hip -> elbow/stifle -> ankle -> paw).
  * Existing articulated pivots skin one continuous surface rather than
  * stacking cylinders at moving joints.
  */
 const felineContinuousLimb=(leg,distal,toe,{fore=true,side=1,name='feline-continuous-limb'}={})=>{
   if(!leg||!distal||!toe||!leg.parent)
     throw Error('Feline limb requires torso, hip, knee and paw joints');
   // The broad proximal rings remain inside the torso and the distal rings
   // continue into the paw. No separate seam cover geometry is required.
   const sections=fore?[
     // Narrow joint root is buried in the torso, not a visible open pipe.
     [.72,.018,.062,.077],[.59,.022,.126,.158],[.43,.040,.185,.205],
     [.27,-.020,.184,.188],[.13,-.065,.150,.152],
     [.025,-.087,.129,.132],[-.115,-.083,.112,.115],
     [-.255,-.020,.097,.111],[-.380,.057,.099,.112],
     [-.479,.147,.112,.139],[-.551,.192,.119,.142],
     [-.587,.205,.070,.100]
   ]:[
     // From inside the pelvis along a real gluteal->femur muscle curve.
     // Previous z=-.185 root sat OUTSIDE the rear body's narrow croup.
     [.77,.175,.057,.074],[.64,.105,.112,.141],
     [.49,-.028,.184,.205],[.34,-.105,.205,.218],
     [.27,-.015,.204,.197],[.13,.128,.161,.152],
     [.025,.168,.137,.142],[-.115,.132,.115,.119],
     [-.255,.000,.099,.113],[-.380,-.109,.090,.106],
     [-.479,.143,.109,.128],[-.551,.192,.118,.141],
     [-.587,.210,.070,.102]
   ];
   const radial=detail==='source'?48:detail==='high'?32:20;
   const steps=detail==='source'?6:detail==='high'?4:2;
   const vertices=[],uv=[],indices=[],weights=[],boneIndices=[];
   const smooth=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
   for(let row=0;row<sections.length-1;row++)
     for(let step=0;step<steps;step++){
       const t=smooth(step/steps),a=sections[row],b=sections[row+1];
       const y=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
       const rx=(a[2]+(b[2]-a[2])*t)*.81;
       const rz=(a[3]+(b[3]-a[3])*t)*.80;
       // The upper skin is ANCHORED TO THE TORSO, not to the rotating
       // hip. The old three-leg-bone version rotated its cut edge out of
       // the croup during a step, exposing a stump. Smooth shoulder/hip
       // deform into thigh -> hock -> paw without independent joint tubes.
       const torsoLock=smooth((y-.19)/.45);
       const knee=smooth((.23-y)/.34);
       const paw=smooth((-.34-y)/.23);
       const w0=torsoLock;
       const w1=(1-torsoLock)*(1-knee);
       const w2=(1-torsoLock)*knee*(1-paw);
       const w3=(1-torsoLock)*knee*paw;
       for(let j=0;j<=radial;j++){
         const theta=j/radial*2*Math.PI;
         const muscle=1+.028*Math.cos(theta*3)*
           Math.sin(Math.PI*(row+t)/(sections.length-1));
         // Scapula and femoral head start medially INSIDE the torso,
         // blending laterally into the lower limb, not a cut tube.
         const medial=.100*smooth((y-.19)/.49);
         vertices.push(Math.cos(theta)*rx*muscle-side*medial,y,
           z+Math.sin(theta)*rz*muscle);
         uv.push(j/radial,(row+t)/(sections.length-1));
         boneIndices.push(0,1,2,3);
         weights.push(w0,w1,w2,w3);
       }
     }
   const last=sections[sections.length-1];
   for(let j=0;j<=radial;j++){
     const theta=j/radial*2*Math.PI;
     vertices.push(Math.cos(theta)*last[2]*.81,last[0],
       last[1]+Math.sin(theta)*last[3]*.80);
     uv.push(j/radial,1);
     boneIndices.push(0,1,2,3);weights.push(0,0,0,1);
   }
   const bands=(sections.length-1)*steps;
   for(let row=0;row<bands;row++)for(let j=0;j<radial;j++){
     const a=row*(radial+1)+j,b=a+radial+1;
     indices.push(a,b,a+1,a+1,b,b+1);
   }
   // Close BOTH ends in the one skinned shell: a double-sided material
   // cannot cover the missing triangles that looked like black pipes.
   const rootCenter=vertices.length/3;
   // Cap centre shares the same medial blend as the first ring.
   vertices.push(-side*.100,sections[0][0]+.026,sections[0][1]);
   uv.push(.5,0);boneIndices.push(0,1,2,3);weights.push(1,0,0,0);
   const pawCenter=vertices.length/3;
   vertices.push(0,last[0]-.018,last[1]);
   uv.push(.5,1);boneIndices.push(0,1,2,3);weights.push(0,0,0,1);
   const lastStart=bands*(radial+1);
   for(let j=0;j<radial;j++){
     indices.push(rootCenter,j+1,j);
     indices.push(pawCenter,lastStart+j,lastStart+j+1);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(boneIndices,4));
   geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
   geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
   const bone0=new THREE.Bone(),bone1=new THREE.Bone(),
     bone2=new THREE.Bone(),bone3=new THREE.Bone();
   bone0.name=name+'-torso-anchor';
   bone1.name=name+'-hip';bone2.name=name+'-stifle';
   bone3.name=name+'-metapodial';
   // Bone0 does NOT inherit hip rotation. This fixes the apparent
   // shoulder/haunch separation in idle, walk, run and turn animations.
   leg.parent.add(bone0);leg.add(bone1);distal.add(bone2);toe.add(bone3);
   const skin=new THREE.SkinnedMesh(geo,material(tone.skin,
     {rough:.86,metal:0},spec,'skin',detail));
   skin.name=name;skin.castShadow=true;skin.receiveShadow=true;
   skin.frustumCulled=false;
   skin.userData.ownedGeometry=true;
   skin.userData.anatomicalLimb=true;
   skin.userData.felineContinuousSurface=true;
   skin.userData.skinningBones=4;
   skin.userData.jointTopology='torso-anchored-closed-rings-four-bone-weights';
   skin.userData.torsoAnchoredProximalSkin=true;
   skin.userData.felineSealedTop=true;
   skin.userData.felineSealedBottom=true;
   skin.userData.felineEndCapTriangles=radial*2;
   skin.userData.felineRootBuriedInTorso=true;
   skin.userData.felineMedialMuscleOrigin=true;
   skin.userData.felineHipSculpt=fore?'scapular-fascia':'gluteal-femur-contour';
   leg.add(skin);
   root.updateMatrixWorld(true);
   skin.bind(new THREE.Skeleton([bone0,bone1,bone2,bone3]));
   return skin;
 };
 /** Buried curved horn/ivory root with continuous ridged tapered skin. */
 const curvedHorn=(parent,shade,rootPoint,elbow,tip,radius,{name='beast-keratin',rough=.49}={})=>{
   const geo=createRootedCreatureHornGeometry({
     root:rootPoint,elbow,tip,radius,detail:detail==='low'?'low':'high'
   });
   const mesh=own(attach(parent,geo,shade,{name,rough,metal:0}));
   mesh.userData.rootedKeratin=true;
   return mesh;
 };
 /**
  * Fox-like cartilage pinna: a tapered 3D ear leaf with a recessed inner
  * surface. Unlike the previous cone-with-cone ear, both surfaces share
  * the same cartilage centre-line and continuously narrowing silhouette.
  */
 const foxPinna=(parent,{side=1,height=.435,width=.119,
   spread=.090,name='fox-pinna'}={})=>{
   if(![side,height,width,spread].every(Number.isFinite)||Math.abs(side)!==1||
     height<=0||width<=0)throw Error('Invalid canine pinna proportions');
   const sections=detail==='source'?24:detail==='high'?17:9;
   const radial=detail==='source'?24:detail==='high'?16:10;
   const positions=[],uv=[],index=[];
   const shape=t=>Math.max(.012,
     t<.12?.73+t*2.25:Math.pow(1-t,.73)*1.12);
   for(let row=0;row<=sections;row++){
     const t=row/sections,hw=width*shape(t);
     for(let col=0;col<=radial;col++){
       const a=col/radial*Math.PI*2;
       positions.push(side*spread*t+Math.cos(a)*hw,
         height*t,
         -.032*t+Math.sin(a)*(.029*(1-t*.65)));
       uv.push(col/radial,t);
     }
   }
   for(let i=0;i<sections;i++)for(let j=0;j<radial;j++){
     const a=i*(radial+1)+j,b=a+radial+1;
     index.push(a,b,a+1,a+1,b,b+1);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(index);geo.computeVertexNormals();geo.computeBoundingSphere();
   const outer=own(attach(parent,geo,'skin',{name,rough:.92,metal:0}));
   outer.userData.foxPinna=true;
   // Interior cartilage is a gently concave two-dimensional patch lying
   // just forward of the ear leaf. It does not float as a separate cone.
   const innerPos=[],innerUv=[],innerIndices=[],steps=detail==='source'?12:8;
   for(let i=0;i<=steps;i++){
     const t=.12+.77*i/steps,hw=width*shape(t)*.67;
     for(let j=0;j<=4;j++){
       const across=(j-2)/2;
       innerPos.push(side*spread*t+hw*across,height*t,
         -.032*t+.031*(1-t*.65)+.005-.009*(1-across*across));
       innerUv.push(j/4,t);
     }
   }
   for(let i=0;i<steps;i++)for(let j=0;j<4;j++){
     const a=i*5+j,b=a+5;
     // Two-sided triangles without mutating shared cached PBR materials.
     innerIndices.push(a,a+1,b,a+1,b+1,b,
       b,a+1,a,b,b+1,a+1);
   }
   const innerGeo=new THREE.BufferGeometry();
   innerGeo.setAttribute('position',new THREE.Float32BufferAttribute(innerPos,3));
   innerGeo.setAttribute('uv',new THREE.Float32BufferAttribute(innerUv,2));
   innerGeo.setIndex(innerIndices);
   innerGeo.computeVertexNormals();innerGeo.computeBoundingSphere();
   const inner=own(attach(parent,innerGeo,'shadow',
     {name:name+'-inner-cartilage',rough:.94,metal:0}));
   // Shared material cache stays untouched; the inner ear is double-sided geometry.
   inner.userData.foxPinnaInner=true;
   return outer;
 };
 /**
  * Canine adaptation of the model generator's eye fitting:
  * first recess the head source topology, then fit a narrow optical almond
  * UNDER its surrounding skin eyelid. No orbiting colored sphere is used.
  * This mutates only the owned monster cranium, never a shared GLB mesh.
  */
 const recessCanineEyeSockets=(cranium,{centerX=.146}={})=>{
   if(!cranium?.geometry?.getAttribute?.('position')||
      !cranium.userData.ownedGeometry)throw Error('Owned cranium required');
   const p=cranium.geometry.getAttribute('position');
   let sculpted=0,maxInset=0;
   for(let i=0;i<p.count;i++){
     const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
     if(z<.07)continue;
     const nx=(Math.abs(x)-centerX)/.110;
     const ny=(y-.115)/.095;
     const q=nx*nx+ny*ny;
     if(q>2.65)continue;
     const front=Math.min(1,Math.max(0,(z-.07)/.21));
     const inset=.067*Math.exp(-2.4*q)*front;
     if(inset<.00002)continue;
     p.setZ(i,z-inset);sculpted++;maxInset=Math.max(maxInset,inset);
   }
   if(sculpted){p.needsUpdate=true;cranium.geometry.computeVertexNormals();
     cranium.geometry.computeBoundingSphere();}
   cranium.userData.canineEyeSocketsRecessed=true;
   cranium.userData.canineEyeSocketCenterX=centerX;
   cranium.userData.canineEyeSocketSculptedVertices=sculpted;
   cranium.userData.canineEyeSocketMaxInset=maxInset;
   return cranium;
 };
 /**
  * A genuine almond-shaped eye opening, with a shadowed socket, thin
  * partially covered iris, slit pupil and wet corneal catchlight.
  * One specialized wolf-king eye uses 5 small meshes, not spherical globes.
  */
 const recessedCanineAlmondEye=(parent,
   {side=1,name='beast',centerX=.146}={})=>{
   if(Math.abs(side)!==1)throw Error('Invalid wolf eye side');
   // The earlier +/-0.230 placed eyes near the outer cheek silhouette.
   // Inset both paired sockets toward the frontal skull by ~14%.
   // The m001 eyes must sit in the cranium, not on its cheek outline.
   // Both optics, lid and recess use exactly one medial canid center.
   // Place both optical sockets on the forward muzzle wedge, rather than
   // the separated left/right outer surface. Fit the optic closer to skin.
   // Both lids and pigments are thin surface patches INSIDE a carved
   // orbital bowl, not separate protruding eye globes. The former z=.232
   // sat visibly in front of the cranium at this x/y station.
   const center=[side*centerX,.116,.182];
   const slices=detail==='source'?40:detail==='high'?32:20;
   const bands=detail==='source'?5:3;
   // Shape follows the inner/outer canthus; the outside corner sits higher.
   const tilt=.195;
   const geometryDisk=(rx,ry,depth,bulge=0)=>{
     const pos=[],uv=[],indices=[];
     for(let row=0;row<=bands;row++){
       const r=row/bands;
       for(let col=0;col<=slices;col++){
         const a=col/slices*2*Math.PI;
         const cx=rx*r*Math.cos(a),cy=ry*r*Math.sin(a);
         // Drape the aperture onto the curvature of the cranial wedge:
         // the canthi return behind the brow, not a planar floating disc.
         const inset=.033*Math.pow(Math.abs(cx)/.064,2)+
           .007*r*r*Math.pow(Math.sin(a),2);
         pos.push(side*cx,cy+tilt*cx,depth+bulge*(1-r*r)-inset);
         uv.push(.5+.5*r*Math.cos(a),.5+.5*r*Math.sin(a));
       }
     }
     for(let i=0;i<bands;i++)for(let j=0;j<slices;j++){
       const a=i*(slices+1)+j,b=a+slices+1;
       // Both windings keep the fitted optical patch visible from side.
       indices.push(a,b,a+1,a+1,b,b+1,a+1,b,a,b+1,b,a+1);
     }
     const geo=new THREE.BufferGeometry();
     geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
     geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
     geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
     return geo;
   };
   const patch=(shade,id,rx,ry,depth,bulge,shift=[0,0,0])=>{
     const m=own(attach(parent,geometryDisk(rx,ry,depth,bulge),shade,
       {name:id,rough:shade==='eye'?.24:.73,metal:0}));
     m.position.set(center[0]+side*shift[0],center[1]+shift[1],
       center[2]+shift[2]);
     m.userData.recessedCanineEye=true;
     m.userData.almondAperture=shade==='eye';
     return m;
   };
   // Eyelid contact ring must be in front of optic centre; pigmented
   // eye is recessed, so its specular highlight cannot bulge from skull.
   // Thin socket, no thick painted-on black eyeliner. The pupil is an
   // actual visible dark patch IN FRONT of the amber iris, not hidden
   // behind the heavy eyelid rim as in the earlier revision.
   // A slim shadowed eye fissure, not an externally projecting liner.
   const orbital=patch('shadow','beast-orbit',.064,.024,.001,.0005);
   orbital.userData.socketApertureHalfWidth=.064;
   orbital.userData.m001OrbitalCenterX=center[0];
   orbital.userData.curvedSkullAperture=true;
   orbital.userData.socketApertureHalfHeight=.024;
   const iris=patch('eye','eye',.0295,.023,.0035,.0015,[-.008,0,0]);
   iris.userData.generatorFittedIris=true;
   iris.userData.openingHeight=.046;
   iris.userData.recessedOpticDepth=.0035;
   iris.userData.m001OrbitalCenterX=center[0];
   // Wolves have rounded pupils, not a cat's vertical slit.
   const pupil=patch('shadow','beast-pupil',.011,.013,.006,.001,[-.008,0,0]);
   pupil.userData.roundCanidPupil=true;
   pupil.userData.blackPupilVisible=true;
   const glint=patch('bone','beast-corneal-glint',.0016,.0025,.007,.0005,
     [-.016,.010,0]);
   glint.userData.corneaWetHighlight=true;
   // Inset the lid beneath the anterior iris/pupil instead of wrapping the
   // eye with a 0.015-wide, elevated, outward-facing skin wall. Two very
   // narrow bands preserve a closed anatomical rim with negligible relief.
   const eyelidPos=[],eyelidUv=[],eyelidIndex=[];
   for(let row=0;row<=2;row++){
     const t=row/2;
     const rx=.064+(.0015*t),ry=.024+(.001*t);
     const rz=.0075+(.0005*t);
     for(let col=0;col<=slices;col++){
       const a=col/slices*2*Math.PI,cx=rx*Math.cos(a);
       const inset=.033*Math.pow(Math.abs(cx)/.064,2)+
         .007*Math.pow(Math.sin(a),2);
       eyelidPos.push(center[0]+side*cx,
         center[1]+ry*Math.sin(a)+tilt*cx,
         center[2]+rz-inset);
       eyelidUv.push(col/slices,t);
     }
   }
   for(let i=0;i<2;i++)for(let j=0;j<slices;j++){
     const a=i*(slices+1)+j,b=a+slices+1;
     eyelidIndex.push(a,b,a+1,a+1,b,b+1,a+1,b,a,b+1,b,a+1);
   }
   const lidGeo=new THREE.BufferGeometry();
   lidGeo.setAttribute('position',
     new THREE.Float32BufferAttribute(eyelidPos,3));
   lidGeo.setAttribute('uv',new THREE.Float32BufferAttribute(eyelidUv,2));
   lidGeo.setIndex(eyelidIndex);
   lidGeo.computeVertexNormals();lidGeo.computeBoundingSphere();
   const lid=own(attach(parent,lidGeo,'skin',
     {name:'beast-almond-eyelid-'+(side<0?'L':'R'),rough:.89,metal:0}));
   lid.userData.socketContactRim=true;
   lid.userData.anatomicalAlmondEyelid=true;
   lid.userData.flushSkinLid=true;
   lid.userData.opticsRecessedBehindLid=true;
   lid.userData.curvedSkullAperture=true;
   lid.userData.solidEyeballRequired=false;
   return {orbital,iris,pupil,glint,lid};
 };
 const anatomicalLoft=(parent,shade,rings,{name='realistic-anatomical-mesh',
   kind='torso',asymmetry=0}={})=>{
   const mesh=own(attach(parent,createMonsterAnatomicalLoft(rings,
     {detail,kind,asymmetry,faceVolume:kind==='face'?creatureFaceVolume(spec.id,spec.family):null}),shade,{rough:kind==='face'?.84:.92,metal:0,name}));
   mesh.userData.anatomyLoft=true;
   return mesh;
 };
 const fur=(parent,shade,guides)=>{
   if(!guides?.length)return null;
   const geometry=buildCanineFurRibbonGeometry(guides);
   const mesh=own(attach(parent,geometry,shade,{rough:.93,metal:0}));
   mesh.name='canine-coat-'+shade;
   mesh.userData.furStrands=guides.length;
   return mesh;
 };
 /** A SINGLE skinned draw call per limb, including upper coat, shin and
  * toe hairs. Bone attachment is inherited from the already animated Groups.
  * All ribbons are authored in the upper-leg's bind space; no per-frame CPU
  * geometry edits, extra limb meshes or duplicate skin materials.
  */
 const skinnedFur=(parent,shade,regions,{name='jointed-coat'}={})=>{
   if(!regions?.length)return null;
   const bones=[],geometryParts=[];
   let strands=0;
   try{
     for(let slot=0;slot<regions.length;slot++){
       const {joint,guides,region}=regions[slot];
       if(!joint||!guides?.length)throw Error('Missing coat joint or guides');
       const bone=new THREE.Bone();
       bone.name=name+'-'+region+'-bone';
       joint.add(bone);
       bones.push(bone);
       const geo=buildCanineFurRibbonGeometry(guides);
       const pos=geo.getAttribute('position'),count=pos.count;
       const index=new Uint16Array(count*4);
       const weight=new Float32Array(count*4);
       for(let i=0;i<count;i++){
         const y=pos.getY(i);
         let other=slot,blend=0;
         // A narrow 2-bone feathering zone prevents a hard hinge line
         // where coat blades cross the elbow/hock. Otherwise keep follicles
         // on their anatomical parent, so they cannot hover.
         if(region==='upper'){other=1;blend=Math.min(.24,Math.max(0,(-.02-y)*1.2));}
         else if(region==='lower'){
           if(y>-.13){other=0;blend=Math.min(.24,(y+.13)*1.6);}
           else {other=2;blend=Math.min(.24,Math.max(0,(-.40-y)*1.1));}
         }else if(region==='paw'){other=1;blend=Math.min(.22,Math.max(0,(y+.50)*1.5));}
         index[i*4]=slot;
         index[i*4+1]=other;
         weight[i*4]=1-blend;
         weight[i*4+1]=blend;
       }
       geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(index,4));
       geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weight,4));
       geometryParts.push(geo);
       strands+=guides.length;
     }
     const geometry=mergeGeometries(geometryParts,false);
     if(!geometry)throw Error('Fur limb skinning merge failed');
     geometry.userData={kind:'articulated-canine-coat',strands};
     geometry.computeBoundingSphere();
     const role=Object.hasOwn(tone,shade)?shade:'detail';
     const skin=new THREE.SkinnedMesh(geometry,material(
       tone[shade]??shade,{rough:.93,metal:0},spec,role,detail));
     skin.name=name;skin.castShadow=true;skin.receiveShadow=true;
     skin.userData.ownedGeometry=true;
     skin.userData.furStrands=strands;
     skin.userData.furRegion='limb';
     // One animated limb in the inspector, not thousands of crowds.
     skin.frustumCulled=false;
     parent.add(skin);
     root.updateMatrixWorld(true);
     skin.bind(new THREE.Skeleton(bones));
     return skin;
   }finally{
     for(const geo of geometryParts)geo.dispose();
   }
 };
 /**
  * Real ribbon-wrapped bandage, UV mapped and slightly lifted above the
  * anatomical mesh. It belongs to its owning pivot (torso/head/forearm/shin)
  * and therefore bends WITH the limb rather than floating beside it.
  */
 const bandage=(parent,shade,{name='cloth-bandage',center=[0,0,0],
   radii=[.25,.25],startY=-.2,endY=.2,turns=2.5,width=.07,
   phase=0,segments=68}={})=>{
   const vertices=[],uv=[],indices=[];
   const [cx,,cz]=center,[rx,rz]=radii;
   const steps=Math.max(12,Math.min(144,Math.round(segments)));
   for(let i=0;i<=steps;i++){
     const t=i/steps,angle=phase+t*Math.PI*2*turns;
     const ripple=1+.018*Math.sin(angle*3.2+phase)+.012*Math.sin(t*27+phase);
     const x=cx+Math.cos(angle)*rx*ripple,z=cz+Math.sin(angle)*rz*ripple;
     const y=center[1]+startY+(endY-startY)*t;
     const taper=.55+.45*Math.min(1,t*13,(1-t)*13);
     for(const sign of [-1,1]){
       vertices.push(x,y+sign*width*taper*.5,z);
       uv.push(t*turns,sign<0?0:1);
     }
   }
   for(let i=0;i<steps;i++){
     const a=2*i,b=a+2;
     indices.push(a,b,a+1,a+1,b,b+1);
   }
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geometry.setIndex(indices);geometry.computeVertexNormals();
   return own(attach(parent,geometry,shade,{
     rough:.95,metal:0,name,
   }));
 };
 const fin=(parent,shade,base,tip,span=.34,options={})=>{
   // A curved tapered feather/wing membrane, not a planar two-triangle card.
   // Near LOD has curvature and subpixel normal detail; low LOD is compact.
   const a=V(base),b=V(tip),direction=b.clone().sub(a).normalize();
   const side=new THREE.Vector3(1,0,0);
   side.addScaledVector(direction,-side.dot(direction));
   if(side.lengthSq()<.05){
     side.set(0,0,1).addScaledVector(direction,-direction.z);
   }
   side.normalize();
   const normal=new THREE.Vector3().crossVectors(direction,side).normalize();
   const rows=detail==='source'?20+nonhumanStage:detail==='high'?9+Math.floor(nonhumanStage/2):detail==='medium'?6+Math.floor(nonhumanStage/3):2;
   const cols=detail==='source'?8+Math.floor(nonhumanStage/2):detail==='high'?4+Math.floor(nonhumanStage/4):detail==='medium'?3:2;
   const vertices=[],uv=[],indices=[];
   for(let i=0;i<=rows;i++){
     const t=i/rows,center=a.clone().lerp(b,t);
     const width=span*(.12+.88*Math.pow(Math.sin(Math.PI*(.025+.95*t)),.8))*(1-t*.20);
     for(let j=0;j<=cols;j++){
       const u=j/cols*2-1;
       const point=center.clone()
         .addScaledVector(side,width*u)
         .addScaledVector(normal,(1-u*u)*Math.sin(Math.PI*t)*span*(.085+.002*nonhumanStage));
       vertices.push(point.x,point.y,point.z);
       uv.push(j/cols,t);
     }
   }
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
     const x=i*(cols+1)+j,y=x+cols+1;
     indices.push(x,y,x+1,x+1,y,y+1);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(indices);geo.computeVertexNormals();
   return own(attach(parent,geo,shade,{rough:.61,translucent:options.translucent??false}));
 };
 const eyes=(parent,z=.34,y=.03,width=.19,size=.05)=>{
   const organic=nonhumanMonsterStage(spec)>0;
   for(const side of [-1,1]){
     // Eyes sit under a raised orbital ridge, rather than glowing orbs.
     sphere(parent,'shadow',[side*width,y,z],[size*1.45,size*.83,size*.35]);
     sphere(parent,'eye',[side*width,y+.003,z+.012],[size*.70,size*.57,size*.21],
       {rough:.35,glow:false});
     sphere(parent,'bone',[side*(width-size*.23),y+size*.20,z+.029],
       [size*.16,size*.14,size*.08],{rough:.12});
     sphere(parent,'skin',[side*width,y+size*.70,z-.004],
       [size*1.35,size*.19,size*.38]);
     // Birds/reptiles have a nictitating lid. This is real cheek-local
     // geometry, animated on a pivot; insect compound eyes do not blink.
     if(organic&&['avian','reptile'].includes(spec.family)){
       const lid=group('eyelid'+(side<0?'L':'R'),
         [side*width,y+size*1.20,z+size*.34],parent);
       lid.userData.restY=lid.position.y;
       lid.userData.blinkTravel=size*1.12;
       sphere(lid,'skin',[0,0,0],[size*1.08,size*.62,size*.23],
         {rough:.74,name:'nictitating-membrane'});
     }
   }
 };
 const claws=(parent,origin,forward=1,count=3,scale=1)=>{
   for(let i=0;i<count;i++){
     const x=origin[0]+(i-(count-1)/2)*.073*scale,z=origin[2]+forward*.07*scale;
     rootedSpike(parent,'bone','skin',[x,origin[1],z],
       [x+(i-(count-1)/2)*.016*scale,origin[1]-.09*scale,z+forward*.25*scale],.034*scale,
       {name:'rooted-claw-'+i});
   }
 };
 const ring=(parent,shade,position,radius=.25,tubeRadius=.03)=>{
   const [tube,segments]=resolution.torus;
   const geo=cachedGeometry('torus:'+detail+':'+resolution.torus.join('x')+':'+radius.toFixed(3)+':'+tubeRadius.toFixed(3),
     ()=>new THREE.TorusGeometry(radius,tubeRadius,tube,segments));
   const m=attach(parent,geo,shade,{metal:.32});m.position.set(...position);return m;
 };
 root.userData.detail=detail;
 return {root,pivots,group,sphere,rock,bone,spike,rootedSpike,seamHem,tube,bridge,
   axialLoft,limbLoft,felineContinuousLimb,curvedHorn,foxPinna,recessCanineEyeSockets,recessedCanineAlmondEye,anatomicalLoft,fur,skinnedFur,bandage,fin,eyes,claws,ring,fine,colors};
}
export function disposeMonsterSculpture(model){
 if(!model)return;
 model.traverse(obj=>{
   if(!obj.isMesh)return;
   if(obj.userData.ownedGeometry)obj.geometry.dispose();
   if(obj.isSkinnedMesh)obj.skeleton?.dispose?.();
   if(obj.userData.ownedEffectMaterial)obj.material?.dispose();
   else releaseMaterial(obj.material);
 });
 model.parent?.remove(model);
}
