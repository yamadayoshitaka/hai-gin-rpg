import {createBomRenderer} from './bom-renderer.js';
import {createCarpetTileData,CARPET_TILE_PART} from './carpet-module-data.js';
import {makeMaterialFactory} from './material-catalog.js';
/** Pure data input -> Three.js scene adapter. No per-furniture geometry switch. */
export function renderInteriorLayouts({THREE,layouts,floorGroups,levels,mobile=false}){
 const factory=createBomRenderer(THREE);
 const material=makeMaterialFactory(THREE);
 const carpetGeometry=new THREE.BoxGeometry(...CARPET_TILE_PART.size);
 const records=[];
 for(const layout of layouts??[]){
  const floorNumber=layout.floor??1,level=floorNumber-1;
  const parent=floorGroups[level],collision=levels[level]?.furniture;
  if(!parent)continue;
  for(const object of layout.objects??[]){
   if(!Array.isArray(object.position)||object.position.length!==3)throw Error('Object has no 3D position: '+object.id);
   const group=new THREE.Group();
   group.position.set(...object.position);
   group.userData.entityKey=object.id;
   group.userData.roleKeys=[...(object.roles??[])];
   group.userData.definition=object;
   group.userData.areaId=layout.areaId??null;
   if(object.model==='carpet'){
    const [width,depth]=object.size??[7,13];
    const tiles=createCarpetTileData({id:object.id,width,depth,color:object.color});
    if(tiles.length){
     const finish=material('linen').clone();
     finish.color.setHex(object.color??0x876149);
     const mesh=new THREE.InstancedMesh(carpetGeometry,finish,tiles.length);
     const dummy=new THREE.Object3D();
     tiles.forEach((tile,i)=>{
      dummy.position.set(...tile.position);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
     });
     mesh.instanceMatrix.needsUpdate=true;
     mesh.castShadow=false;mesh.receiveShadow=true;
     mesh.userData.partId=CARPET_TILE_PART.id;
     group.add(mesh);
    }
   }else{
    factory.render(object.model??object.modelKey,group,{id:object.id});
   }
   parent.add(group);
   if(object.collision&&collision){
    const bom=factory.resolve(object.model??object.modelKey);
    const dims=bom.collision??[2.3,1,2.3];
    collision.push({id:object.id,x:object.position[0],z:object.position[2],w:dims[0],d:dims[2]});
   }
   records.push({id:object.id,floor:floorNumber,entity:group,definition:object});
  }
 }
 return records;
}
