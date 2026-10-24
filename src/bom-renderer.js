import {makeMaterialFactory} from './material-catalog.js';
import {PART_CATALOG,resolveBom} from './bom-catalog.js';
/** Render-only BOM adapter. Objects and materials are all catalog data. */
export function createBomRenderer(THREE){
 const material=makeMaterialFactory(THREE),geos=new Map();
 const geom=(partId)=>{if(!geos.has(partId)){
  const part=PART_CATALOG[partId],[w,h,d]=part.size;
  if(part.shape==='cylinder')geos.set(partId,new THREE.CylinderGeometry(w/2,w/2,h,20));
  else if(part.shape==='box'){
   const geometry=new THREE.BoxGeometry(w,h,d);
   // Unique part geometries are shared across all finished BOM objects.
   geos.set(partId,geometry);
  }else throw Error('Unknown part geometry: '+part.shape);
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
