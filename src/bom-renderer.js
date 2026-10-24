import {PART_CATALOG,resolveBom} from './bom-catalog.js';
/** Render-only BOM adapter. Objects and materials are all catalog data. */
export function createBomRenderer(THREE){
 const mats=new Map(),geos=new Map();
 const colors={oak:0x846344,walnut:0x49352b,stone:0xb3a99a,iron:0x8a929c,linen:0xbcb09b,glass:0x8cbac0,brass:0xc6a45f,tile:0x765552,royal:0x87364d,lamp:0xffdd8a,charcoal:0x312d30};
 const material=(key)=>{
  if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color:colors[key]??0x8b785e,roughness:key==='iron'?.45:.83,metalness:key==='iron'||key==='brass'?.55:0,transparent:key==='glass',opacity:key==='glass'?.74:1,emissive:key==='lamp'?0xffaa33:0,emissiveIntensity:key==='lamp'?.7:0}));
  return mats.get(key);
 };
 const geom=(partId)=>{if(!geos.has(partId)){
  const part=PART_CATALOG[partId],[w,h,d]=part.size;
  geos.set(partId,part.shape==='cylinder'?new THREE.CylinderGeometry(w/2,w/2,h,12):new THREE.BoxGeometry(w,h,d));
 }return geos.get(partId)};
 const render=(modelId,parent,{id=modelId,position=[0,0,0]}={})=>{
  const bom=resolveBom(modelId),assembly=new THREE.Group();assembly.position.set(...position);
  assembly.userData={entityKey:id,bomId:bom.id};parent.add(assembly);
  for(const [index,item] of bom.parts.entries()){
   const part=PART_CATALOG[item.partId];
   const mesh=new THREE.Mesh(geom(item.partId),material(item.material??part.material));
   mesh.position.set(...item.position);
   if(item.rotation)mesh.rotation.set(...item.rotation);
   mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.partId=item.partId;
   mesh.userData.componentId=id+':'+index;assembly.add(mesh);
  }
  return assembly;
 };
 return {render,resolve:resolveBom};
}
