/**
 * Battlefield room supplies and a shared, bounded item bag.
 * Data is independent of rendering, so LOD/scene rebuilds do not duplicate loot.
 * A stable building-instance ID distinguishes repeated catalog house templates.
 */
export const BATTLE_ITEMS=Object.freeze({
  recovery_potion:Object.freeze({
    id:'recovery_potion',name:'回復薬',category:'consumable',
    heal:50,description:'味方1人のHPを最大50回復'
  })
});

/** The castle has authored rooms on all three storeys; normal houses get one
 * recoverable supply in each accessible floor until bespoke rooms are authored.
 * Coordinates are local to the building's model, exactly like its furnishings.
 */
export function planRoomRecoveryItems(structure,roomsByFloor=[],instanceId=structure?.id??'unknown'){
  const floors=structure?.floors??[];
  const result=[];
  for(const floor of floors){
    const rooms=roomsByFloor.find(p=>p.floor===floor.index)?.rooms??[];
    const positions=rooms.length?rooms.map(room=>({
      roomId:room.id,roomName:room.name??room.label??'部屋',
      x:(room.bounds.minX+room.bounds.maxX)/2,
      z:(room.bounds.minZ+room.bounds.maxZ)/2
    })):[{
      roomId:'floor-'+floor.index+'-room-1',roomName:floor.index+'階の部屋',
      x:-Math.min(floor.footprint.width*.21,structure.stair?.stair?.outerRadius+2||3),
      z:Math.min(floor.footprint.depth*.19,3.5)
    }];
    for(const [index,room] of positions.entries()){
      result.push({
        id:String(instanceId)+':'+room.roomId,
        buildingId:String(instanceId),roomId:room.roomId,
        roomName:room.roomName,floor:floor.index,
        x:room.x,y:floor.baseY+.32,z:room.z,
        itemId:'recovery_potion',quantity:1,
        order:index
      });
    }
  }
  return result;
}

export function createBattleItemInventory(){
  const amounts=new Map(),collected=new Set();
  let acquired=0,used=0;
  function entries(){
    return [...amounts].filter(([,qty])=>qty>0).map(([id,quantity])=>({
      ...BATTLE_ITEMS[id],quantity
    })).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  }
  function count(id){return amounts.get(id)??0;}
  function collect(loot){
    if(!loot||typeof loot.id!=='string'||collected.has(loot.id)||
       !BATTLE_ITEMS[loot.itemId]||!Number.isInteger(loot.quantity)||loot.quantity<=0)return false;
    collected.add(loot.id);
    amounts.set(loot.itemId,count(loot.itemId)+loot.quantity);
    acquired+=loot.quantity;
    return true;
  }
  function use(itemId,target){
    const item=BATTLE_ITEMS[itemId];
    if(!item||item.category!=='consumable'||count(itemId)<1||
       !target||target.alive===false||!(target.hp>0)||!(target.maxHp>target.hp))return 0;
    const heal=Math.min(item.heal,target.maxHp-target.hp);
    target.hp+=heal;
    amounts.set(itemId,count(itemId)-1);
    used++;
    return heal;
  }
  function snapshot(){return {entries:entries(),collectedIds:[...collected],acquired,used};}
  return {entries,count,collect,use,snapshot,isCollected:id=>collected.has(id)};
}
