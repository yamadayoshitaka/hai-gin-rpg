/** Data-driven room pickups and shared battle inventory.
 * Room plans describe WHAT exists; a per-battle registry tracks WHERE it is
 * and who collected it. Never mutate a shared town-building model template.
 */
export const ROOM_ITEM_TYPES=Object.freeze({
  healing_potion:Object.freeze({id:'healing_potion',name:'回復薬',kind:'heal',healHp:50,maxStack:99})
});

const validQty=q=>Number.isSafeInteger(q)&&q>0&&q<=999;
const keyOf=(ownerId,typeId)=>String(ownerId)+':'+typeId;

export function createRoomItemPlan(structure,roomPlans=[]){
  if(!structure?.id||!Array.isArray(structure.floors))return [];
  const rooms=roomPlans.flatMap(plan=>(plan.rooms??[]).map(room=>({...room,floor:plan.floor})));
  const entries=[];
  for(const floor of structure.floors){
    const floorRooms=rooms.filter(room=>room.floor===floor.index);
    const {width,depth}=floor.footprint;
    const fallback=[{
      id:structure.id+':floor-'+floor.index+':main',
      label:floor.index===1?'1階の部屋':floor.index+'階の部屋',
      floor:floor.index,
      bounds:{minX:-width*.27,maxX:width*.27,minZ:-depth*.27,maxZ:depth*.27}
    }];
    for(const room of floorRooms.length?floorRooms:fallback){
      const b=room.bounds;
      const x=(b.minX+b.maxX)/2, z=(b.minZ+b.maxZ)/2;
      entries.push({
        id:structure.id+':'+room.id+':healing_potion',
        buildingId:structure.id,roomId:room.id,roomName:room.label??room.name??'部屋',
        floor:floor.index,x,y:floor.baseY,z,
        itemId:'healing_potion',item:'回復薬',quantity:1
      });
    }
  }
  return entries;
}

export class RoomItemRegistry {
  constructor(types=ROOM_ITEM_TYPES){
    this.types=new Map(Object.values(types).map(type=>[type.id,{...type}]));
    this.placements=new Map();
    this.inventory=new Map();
  }
  defineItem(type){
    if(!type?.id||!type.name||!['heal','material','key','quest'].includes(type.kind)||
      (type.kind==='heal'&&!(type.healHp>0)))throw Error('アイテム定義が不正です');
    this.types.set(type.id,{...type});
    return this.types.get(type.id);
  }
  place(buildingInstanceId,item){
    if(!buildingInstanceId||!this.types.has(item?.itemId)||!validQty(item.quantity)||
      !item.roomId||!Number.isFinite(item.x)||!Number.isFinite(item.z))
      throw Error('アイテム配置が不正です');
    const id=String(buildingInstanceId)+':'+item.id;
    if(this.placements.has(id))throw Error('アイテム配置IDが重複しています');
    const instance={...item,id,buildingInstanceId:String(buildingInstanceId),state:'placed',
      collectedBy:null};
    this.placements.set(id,instance);
    return instance;
  }
  registerBuilding(instanceId,items){
    if(!Array.isArray(items))throw Error('建物の配置定義が不正です');
    return items.map(item=>this.place(instanceId,item));
  }
  get(id){return this.placements.get(id)??null;}
  list({instanceId=null,floor=null,roomId=null,state=null}={}){
    return [...this.placements.values()].filter(item=>
      (instanceId==null||item.buildingInstanceId===String(instanceId))&&
      (floor==null||item.floor===floor)&&
      (roomId==null||item.roomId===roomId)&&
      (state==null||item.state===state));
  }
  setPlacement(id,changes={}){
    const item=this.get(id);
    if(!item||item.state!=='placed')return false;
    if(changes.itemId!=null&&!this.types.has(changes.itemId))return false;
    if(changes.quantity!=null&&!validQty(changes.quantity))return false;
    if(changes.x!=null&&!Number.isFinite(changes.x))return false;
    if(changes.z!=null&&!Number.isFinite(changes.z))return false;
    for(const field of ['itemId','quantity','x','z','floor','roomId','roomName'])
      if(changes[field]!=null)item[field]=changes[field];
    item.item=this.types.get(item.itemId).name;
    return true;
  }
  pickup(id,ownerId){
    const item=this.get(id);
    if(!item||item.state!=='placed'||ownerId==null)return false;
    const type=this.types.get(item.itemId);
    const owner=String(ownerId),key=keyOf(owner,item.itemId);
    const stack=this.inventory.get(key)??{ownerId:owner,itemId:item.itemId,
      name:type.name,quantity:0};
    if(stack.quantity+item.quantity>type.maxStack)return false;
    stack.quantity+=item.quantity;
    this.inventory.set(key,stack);
    item.state='collected';item.collectedBy=owner;
    // Two room definitions can share one physical loot marker (for example,
    // an overlapping castle room boundary). Picking that spot must never
    // mint a second reward when another soldier scans the same coordinates.
    // Other rooms, floors and building instances remain independent.
    for(const other of this.placements.values()){
      if(other===item||other.state!=='placed'||other.floor!==item.floor||
        other.buildingInstanceId!==item.buildingInstanceId)continue;
      if(Math.hypot(other.x-item.x,other.z-item.z)<=.55){
        other.state='empty';other.collectedBy=owner;
      }
    }
    return true;
  }
  owned(ownerId=null){
    return [...this.inventory.values()].filter(stack=>ownerId==null||
      stack.ownerId===String(ownerId)).map(stack=>({...stack}));
  }
  /** Move stack quantities between allied units; never mint or lose items. */
  transfer(sourceId,targetId,itemId,quantity=1){
    if(sourceId==null||targetId==null||String(sourceId)===String(targetId)||
       !Number.isSafeInteger(quantity)||quantity<1)return false;
    const fromKey=keyOf(sourceId,itemId),toKey=keyOf(targetId,itemId);
    const from=this.inventory.get(fromKey),type=this.types.get(itemId);
    if(!from||from.quantity<quantity||!type)return false;
    const to=this.inventory.get(toKey)??{ownerId:String(targetId),itemId,name:type.name,quantity:0};
    if(to.quantity+quantity>type.maxStack)return false;
    from.quantity-=quantity;to.quantity+=quantity;
    if(from.quantity<=0)this.inventory.delete(fromKey);
    this.inventory.set(toKey,to);
    return true;
  }
  consume(ownerId,itemId,target){
    const stack=this.inventory.get(keyOf(ownerId,itemId));
    const type=this.types.get(itemId);
    if(!stack||stack.quantity<=0||!type||type.kind!=='heal'||!target||
      !(target.hp>0)||!(target.maxHp>target.hp))return 0;
    const healed=Math.min(type.healHp,target.maxHp-target.hp);
    target.hp+=healed;
    if(--stack.quantity<=0)this.inventory.delete(keyOf(ownerId,itemId));
    return healed;
  }
}
