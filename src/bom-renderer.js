import {makeMaterialFactory} from './material-catalog.js';
import {PART_CATALOG,resolveBom} from './bom-catalog.js';
/** Render-only BOM adapter. Objects and materials are all catalog data. */
export function createBomRenderer(THREE){
 const material=makeMaterialFactory(THREE),geos=new Map();
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
