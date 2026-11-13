/** Reusable anatomical sculpt tools for the fifty-monster bestiary.
 * 'source' is a deliberately expensive sculpting master (never automatic on
 * mobile); 'high' is the playable preview and 'low' is the future distance LOD.
 * Meshes are cached only where geometry parameters are genuinely reusable.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {nonhumanMonsterStage} from './nonhuman-model-quality.js';
import {realismPaletteFor} from './monster-realistic-palettes.js';
import {createMonsterAnatomicalLoft} from './monster-realistic-loft.js';
import {buildCanineFurRibbonGeometry} from './canine-fur-ribbons.js?v=4.4.89';
import {decorateMonsterPhotoMaterial,detachMonsterPhotoMaterial} from './monster-photo-pbr.js?v=4.4.95';

export const MONSTER_DETAIL_LEVELS=Object.freeze({
  source:Object.freeze({sphere:[80,56],rock:3,rod:20,tube:[48,12],torus:[14,56]}),
  high:Object.freeze({sphere:[38,26],rock:2,rod:12,tube:[22,8],torus:[9,32]}),
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
     role==='leather'||role==='metal'||(spec.family==='golem'&&role==='shadow')){
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
 const tone={skin:colors.base,light:colors.highlight,accent:colors.accent,
   shadow:'#26232c',bone:'#e9dfc5',
   fabric:'#493d43',bandage:'#b4a993',leather:'#4b3734',
   metal:'#737d83',hair:'#302a29',mortalSkin:'#a49b93',
   // Eyes are pigmented and recessed, never generic neon spheres.
   eye:['insect','arachnid'].includes(spec.family)?'#30262a':
     spec.family==='aquatic'?'#6fa0a2':
     spec.family==='reptile'?'#b18f4d':
     spec.family==='avian'?'#b99955':'#a68b51'};
 if(realism)Object.assign(tone,realism);
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
 const tube=(parent,shade,points,radius=.04)=>{
   const curve=new THREE.CatmullRomCurve3(points.map(V));
   const [segments,radial]=resolution.tube;
   return own(attach(parent,new THREE.TubeGeometry(curve,segments,radius,radial,false),shade));
 };
 /** Smooth continuous tapered joint between shoulder and skull; bury the
  * broad end in the body and the narrow end inside the head.
  */
 const bridge=(parent,shade,from,to,startRadius,endRadius)=>{
   const a=V(from),b=V(to),d=b.clone().sub(a),length=d.length();
   if(length<.0001)return null;
   const [segments,radial]=resolution.tube;
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
 const anatomicalLoft=(parent,shade,rings,{name='realistic-anatomical-mesh',
   kind='torso',asymmetry=0}={})=>{
   const mesh=own(attach(parent,createMonsterAnatomicalLoft(rings,
     {detail,kind,asymmetry}),shade,{rough:kind==='face'?.84:.92,metal:0,name}));
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
   const rows=detail==='source'?20+nonhumanStage:detail==='high'?9+Math.floor(nonhumanStage/2):2;
   const cols=detail==='source'?8+Math.floor(nonhumanStage/2):detail==='high'?4+Math.floor(nonhumanStage/4):2;
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
     spike(parent,'bone',[x,origin[1],z],
       [x+(i-(count-1)/2)*.016*scale,origin[1]-.09*scale,z+forward*.25*scale],.034*scale);
   }
 };
 const ring=(parent,shade,position,radius=.25,tubeRadius=.03)=>{
   const [tube,segments]=resolution.torus;
   const geo=cachedGeometry('torus:'+detail+':'+resolution.torus.join('x')+':'+radius.toFixed(3)+':'+tubeRadius.toFixed(3),
     ()=>new THREE.TorusGeometry(radius,tubeRadius,tube,segments));
   const m=attach(parent,geo,shade,{metal:.32});m.position.set(...position);return m;
 };
 root.userData.detail=detail;
 return {root,pivots,group,sphere,rock,bone,spike,tube,bridge,
   anatomicalLoft,fur,skinnedFur,bandage,fin,eyes,claws,ring,fine,colors};
}
export function disposeMonsterSculpture(model){
 if(!model)return;
 model.traverse(obj=>{
   if(!obj.isMesh)return;
   if(obj.userData.ownedGeometry)obj.geometry.dispose();
   if(obj.isSkinnedMesh)obj.skeleton?.dispose?.();
   releaseMaterial(obj.material);
 });
 model.parent?.remove(model);
}
