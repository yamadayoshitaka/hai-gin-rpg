/** Reusable anatomical sculpt tools for the fifty-monster bestiary.
 * 'source' is a deliberately expensive sculpting master (never automatic on
 * mobile); 'high' is the playable preview and 'low' is the future distance LOD.
 * Meshes are cached only where geometry parameters are genuinely reusable.
 */
import * as THREE from 'three';
import {buildCanineFurRibbonGeometry} from './canine-fur-ribbons.js?v=4.4.89';
import {decorateMonsterPhotoMaterial,detachMonsterPhotoMaterial} from './monster-photo-pbr.js?v=4.4.81';

export const MONSTER_DETAIL_LEVELS=Object.freeze({
  source:Object.freeze({sphere:[80,56],rock:3,rod:20,tube:[48,12],torus:[14,56]}),
  high:Object.freeze({sphere:[38,26],rock:2,rod:12,tube:[22,8],torus:[9,32]}),
  low:Object.freeze({sphere:[14,10],rock:0,rod:7,tube:[10,5],torus:[6,16]}),
});
const geometryCache=new Map(),materialCache=new Map();
function cachedGeometry(key,make){
 if(!geometryCache.has(key))geometryCache.set(key,make());
 return geometryCache.get(key);
}
function material(color,{metal=0.08,rough=.69,glow=false,translucent=false}={},spec={},role='skin',detail='high'){
 const key=[spec.family,role,detail,color,metal,rough,glow,translucent].join(':');
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
   if(role==='skin'||role==='light'||(spec.family==='golem'&&role==='shadow')){
     decorateMonsterPhotoMaterial(mat,{
       family:spec.family,role,detail,metal,glow,translucent,
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
 const resolution=MONSTER_DETAIL_LEVELS[detail];
 if(!resolution)throw Error('Unknown sculpture resolution: '+detail);
 const fine=detail!=='low',pivots={},root=new THREE.Group();root.name=spec.id+'-'+spec.name;
 const colors=spec.colors;
 const tone={skin:colors.base,light:colors.highlight,accent:colors.accent,
   shadow:'#26232c',bone:'#e9dfc5',eye:'#edaf73'};
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
   const geo=cachedGeometry('sphere:'+detail,()=>new THREE.SphereGeometry(1,w,h));
   const m=attach(parent,geo,shade,options);m.position.set(...position);m.scale.set(...scale);return m;
 };
 const rock=(parent,shade,position,scale,options={})=>{
   const geo=cachedGeometry('rock:'+detail,
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
 const fur=(parent,shade,guides)=>{
   if(!guides?.length)return null;
   const geometry=buildCanineFurRibbonGeometry(guides);
   const mesh=own(attach(parent,geometry,shade,{rough:.93,metal:0}));
   mesh.name='canine-coat-'+shade;
   mesh.userData.furStrands=guides.length;
   return mesh;
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
   const rows=detail==='source'?20:detail==='high'?9:2;
   const cols=detail==='source'?8:detail==='high'?4:2;
   const vertices=[],uv=[],indices=[];
   for(let i=0;i<=rows;i++){
     const t=i/rows,center=a.clone().lerp(b,t);
     const width=span*(.12+.88*Math.pow(Math.sin(Math.PI*(.025+.95*t)),.8))*(1-t*.20);
     for(let j=0;j<=cols;j++){
       const u=j/cols*2-1;
       const point=center.clone()
         .addScaledVector(side,width*u)
         .addScaledVector(normal,(1-u*u)*Math.sin(Math.PI*t)*span*.085);
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
   for(const side of [-1,1]){
     sphere(parent,'shadow',[side*width,y,z],[size*1.45,size*.83,size*.35]);
     sphere(parent,'eye',[side*width,y+.003,z+.012],[size*.70,size*.57,size*.21],
       {rough:.16,glow:true});
     sphere(parent,'bone',[side*width-size*.23,y+size*.20,z+.029],
       [size*.16,size*.14,size*.08],{rough:.12});
     sphere(parent,'skin',[side*width,y+size*.70,z-.004],
       [size*1.35,size*.19,size*.38]);
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
   const geo=cachedGeometry('torus:'+detail+':'+radius.toFixed(3)+':'+tubeRadius.toFixed(3),
     ()=>new THREE.TorusGeometry(radius,tubeRadius,tube,segments));
   const m=attach(parent,geo,shade,{metal:.32});m.position.set(...position);return m;
 };
 root.userData.detail=detail;
 return {root,pivots,group,sphere,rock,bone,spike,tube,bridge,fur,fin,eyes,claws,ring,fine,colors};
}
export function disposeMonsterSculpture(model){
 if(!model)return;
 model.traverse(obj=>{
   if(!obj.isMesh)return;
   if(obj.userData.ownedGeometry)obj.geometry.dispose();
   releaseMaterial(obj.material);
 });
 model.parent?.remove(model);
}
