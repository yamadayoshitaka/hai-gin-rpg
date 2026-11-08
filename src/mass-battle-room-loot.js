/**
 * Spatially indexed, authoritative ground-floor loot for 100/1000-per-side
 * battles. Registry state lives on the presentation thread; the worker only
 * owns soldiers, movement and damage. No 2000 x number-of-chests scan.
 */
const cellKey=(x,z)=>x+','+z;
export class MassBattleRoomLootCollector {
 constructor({registry,buildings,doors=[],cellSize,offset=6,radius=1.1}){
  if(!registry||!Array.isArray(buildings)||!(cellSize>0))throw Error('Mass loot configuration is invalid');
  this.registry=registry;this.byCell=new Map();
  this.cellSize=cellSize;this.offset=offset;
  this.radius=Math.min(radius,cellSize*.5);
  const entryByBuilding=new Map();
  for(const entry of doors instanceof Map?doors.values():doors)
   if(entry?.building)entryByBuilding.set(entry.building,entry.object);
  const buildingById=new Map(buildings.map(b=>[b.model.uuid,b]));
  for(const loot of registry.list({floor:1,state:'placed'})){
   const building=buildingById.get(loot.buildingInstanceId);
   if(!building)continue;
   const x=building.model.position.x+loot.x;
   const z=building.model.position.z+loot.z;
   const tileX=Math.round(x/cellSize+offset),tileZ=Math.round(z/cellSize+offset);
   const key=cellKey(tileX,tileZ);
   const entry={loot,building,door:entryByBuilding.get(building)??null,x,z};
   if(!this.byCell.has(key))this.byCell.set(key,[]);
   this.byCell.get(key).push(entry);
  }
 }
 collect(units,{destroyedBuildings=null}={}){
  const picked=[];
  if(!Array.isArray(units))return picked;
  const {cellSize,offset,radius}=this;
  for(const unit of units){
   if(!unit.alive||unit.hp<=0||unit.team!==0||unit.isStrategist)continue;
   // A grid unit's x/z jump to its target cell at the START of the step.
   // Do not award an item before the feet have actually arrived.
   if(unit.moveDuration>0&&unit.moveElapsed<unit.moveDuration)continue;
   const ux=(unit.x-offset)*cellSize,uz=(unit.z-offset)*cellSize;
   let collected=false;
   for(let dz=-1;dz<=1&&!collected;dz++)for(let dx=-1;dx<=1&&!collected;dx++){
    const candidates=this.byCell.get(cellKey(unit.x+dx,unit.z+dz));
    if(!candidates)continue;
    for(const {loot,building,door,x,z} of candidates){
     if(loot.state!=='placed'||destroyedBuildings?.has(building.data)||
       destroyedBuildings?.has(building.model))continue;
     if(door?.locked&&door.team!==unit.team)continue;
     if(Math.hypot(ux-x,uz-z)>radius)continue;
     const bounds=building.model.userData?.groundFloorRooms?.
       find(room=>room.id===loot.roomId)?.bounds;
     if(bounds){
      const localX=ux-building.model.position.x,localZ=uz-building.model.position.z;
      if(localX<bounds.minX-.08||localX>bounds.maxX+.08||
         localZ<bounds.minZ-.08||localZ>bounds.maxZ+.08)continue;
     }
     if(!this.registry.pickup(loot.id,unit.id))continue;
     picked.push({loot,building,unit});
     collected=true;
     break;
    }
   }
  }
  return picked;
 }
}
