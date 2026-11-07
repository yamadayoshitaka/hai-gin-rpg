/** Shared sculpture tools for the 50-species bestiary.
 * Uses smooth 3D surfaces, independent articulated pivots and a bounded
 * geometry/material cache. No per-frame mesh allocations.
 */
import * as THREE from 'three';
const geometryCache=new Map(), materialCache=new Map();
function cachedGeometry(key,make){
 if(!geometryCache.has(key))geometryCache.set(key,make());
 return geometryCache.get(key);
}
function material(color,{metal=0.08,rough=.69,glow=false,translucent=false}={}){
 const key=[color,metal,rough,glow,translucent].join(':');
 if(!materialCache.has(key)){
   materialCache.set(key,new THREE.MeshStandardMaterial({
     color,roughness:rough,metalness:metal,side:THREE.DoubleSide,
     emissive:glow?color:0x000000,emissiveIntensity:glow?.38:0,
     transparent:translucent,opacity:translucent?.81:1,depthWrite:!translucent,
   }));
 }
 return materialCache.get(key);
}
export function createSculpture(spec,detail='high'){
 const fine=detail==='high',pivots={},root=new THREE.Group();root.name=spec.id+'-'+spec.name;
 const colors=spec.colors;
 const tone={skin:colors.base,light:colors.highlight,accent:colors.accent,shadow:'#26232c',bone:'#ede0b5',eye:'#ffb589'};
 const V=(v)=>new THREE.Vector3(...v);
 const attach=(parent,geo,shade,opt={})=>{
   const mesh=new THREE.Mesh(geo,material(tone[shade]??shade,opt));
   mesh.name=opt.name??shade;mesh.castShadow=true;mesh.receiveShadow=true;
   parent.add(mesh);return mesh;
 };
 const group=(name,position=[0,0,0],parent=root)=>{
   const g=new THREE.Group();g.name=name;g.position.set(...position);
   parent.add(g);pivots[name]=g;return g;
 };
 const sphere=(parent,shade,position,scale,options={})=>{
   const geo=cachedGeometry('sphere'+(fine?'H':'L'),()=>new THREE.SphereGeometry(1,fine?24:12,fine?16:8));
   const m=attach(parent,geo,shade,options);m.position.set(...position);m.scale.set(...scale);return m;
 };
 const rock=(parent,shade,position,scale,options={})=>{
   const geo=cachedGeometry('rock'+(fine?'H':'L'),()=>new THREE.DodecahedronGeometry(1,fine?1:0));
   const m=attach(parent,geo,shade,{rough:.95,metal:.14,...options});m.position.set(...position);m.scale.set(...scale);return m;
 };
 const bone=(parent,shade,from,to,radius,{tipRadius=.025,metal=0.07,rough=.7}={})=>{
   const a=V(from),b=V(to),d=b.clone().sub(a),length=d.length();
   if(length<1e-5)return null;
   const geo=cachedGeometry('rod'+radius.toFixed(3)+'-'+tipRadius.toFixed(3)+'-'+length.toFixed(2)+(fine?'H':'L'),
    ()=>new THREE.CylinderGeometry(tipRadius,radius,length,fine?12:7,1));
   const m=attach(parent,geo,shade,{metal,rough});
   m.position.copy(a).add(b).multiplyScalar(.5);
   m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
   return m;
 };
 const spike=(parent,shade,from,to,radius=.08)=>{
   const a=V(from),b=V(to),d=b.clone().sub(a),length=d.length();
   const geo=cachedGeometry('spike'+radius.toFixed(3)+'-'+length.toFixed(2)+(fine?'H':'L'),
    ()=>new THREE.ConeGeometry(radius,length,fine?12:7,1));
   const m=attach(parent,geo,shade);
   m.position.copy(a).add(b).multiplyScalar(.5);
   m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
   return m;
 };
 const tube=(parent,shade,points,radius=.04)=>{
   const pts=points.map(V),curve=new THREE.CatmullRomCurve3(pts);
   const geo=new THREE.TubeGeometry(curve,fine?18:9,radius,fine?8:5,false);
   const m=attach(parent,geo,shade);m.userData.ownedGeometry=true;return m;
 };
 const fin=(parent,shade,base,tip,span=.34,options={})=>{
   const a=V(base),b=V(tip),m=a.clone().lerp(b,.50);
   const side=new THREE.Vector3(span,0,0);
   const verts=new Float32Array([
     a.x-side.x,a.y,a.z, b.x,b.y,b.z, m.x+side.x,m.y,m.z,
     a.x-side.x,a.y,a.z, m.x+side.x,m.y,m.z, a.x,a.y,a.z-.09
   ]);
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.BufferAttribute(verts,3));
   geo.computeVertexNormals();
   const piece=attach(parent,geo,shade,{rough:.61,translucent:options.translucent??false});
   piece.userData.ownedGeometry=true;return piece;
 };
 const eyes=(parent,z=0.34,y=0.03,width=.19,size=.05)=>{
   for(const side of [-1,1]){
     sphere(parent,'shadow',[side*width,y,z],[size*1.25,size*.82,size*.35]);
     sphere(parent,'eye',[side*width,y+.003,z+.012],[size*.68,size*.58,size*.23],{rough:.15,glow:true});
     sphere(parent,'bone',[side*width-.009,y+.013,z+.026],[size*.18,size*.15,size*.08],{rough:.12});
   }
 };
 const claws=(parent,origin,forward=1,count=3,scale=1)=>{
   for(let i=0;i<count;i++){
     const x=origin[0]+(i-(count-1)/2)*.073*scale,z=origin[2]+forward*.07*scale;
     spike(parent,'bone',[x,origin[1],z],[x+(i-(count-1)/2)*.016*scale,origin[1]-.09*scale,z+forward*.25*scale],.034*scale);
   }
 };
 const ring=(parent,shade,position,radius=.25,tubeRadius=.03)=>{
   const geo=cachedGeometry('torus'+radius.toFixed(2)+'-'+tubeRadius.toFixed(2)+(fine?'H':'L'),
     ()=>new THREE.TorusGeometry(radius,tubeRadius,fine?10:6,fine?35:16));
   const m=attach(parent,geo,shade,{metal:.32});m.position.set(...position);return m;
 };
 return {root,pivots,group,sphere,rock,bone,spike,tube,fin,eyes,claws,ring,fine,colors};
}
export function disposeMonsterSculpture(model){
 // Shared primitives and materials intentionally persist across species.
 // Only one-off tubes and fins are destroyed on selection changes.
 model?.traverse(obj=>{if(obj.isMesh&&obj.userData.ownedGeometry)obj.geometry.dispose();});
 model?.parent?.remove(model);
}
