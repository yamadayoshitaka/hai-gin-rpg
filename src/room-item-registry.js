/** Data-driven room pickups and shared battle inventory.
 * Room plans describe WHAT exists; a per-battle registry tracks WHERE it is
 * and who collected it. Never mutate a shared town-building model template.
 */
export const ROOM_ITEM_TYPES=Object.freeze({
  healing_potion:Object.freeze({id:'healing_potion',name:'回復薬',kind:'heal',healHp:50,squadHealHp:200,maxStack:99,category:'回復'}),
  high_potion:Object.freeze({id:'high_potion',name:'上級回復薬',kind:'heal',healHp:150,squadHealHp:600,maxStack:99,category:'回復'}),
  elixir:Object.freeze({id:'elixir',name:'特級回復薬',kind:'heal',healHp:300,squadHealHp:1500,maxStack:20,category:'回復'}),
  war_banner:Object.freeze({id:'war_banner',name:'勇猛の軍旗',kind:'squad_buff',attack:.20,duration:25,maxStack:20,category:'部隊強化',description:'所属部隊の攻撃力+20%／25秒'}),
  aegis_seal:Object.freeze({id:'aegis_seal',name:'守護の護符',kind:'squad_buff',defense:.18,duration:25,maxStack:20,category:'部隊強化',description:'所属部隊の被ダメージ-18%／25秒'}),
  wind_scroll:Object.freeze({id:'wind_scroll',name:'疾風の巻物',kind:'squad_buff',speed:.25,duration:25,maxStack:20,category:'部隊強化',description:'所属部隊の移動速度+25%／25秒'}),
  field_bandage:Object.freeze({id:'field_bandage',name:'応急包帯',kind:'heal',healHp:35,squadHealHp:120,maxStack:99,category:'回復'}),
  medical_kit:Object.freeze({id:'medical_kit',name:'救急箱',kind:'heal',healHp:110,squadHealHp:450,maxStack:60,category:'回復'}),
  royal_elixir:Object.freeze({id:'royal_elixir',name:'王家の秘薬',kind:'heal',healHp:500,squadHealHp:2300,maxStack:10,category:'回復'}),
  berserk_draught:Object.freeze({id:'berserk_draught',name:'戦鬼の霊薬',kind:'squad_buff',attack:.35,duration:15,maxStack:20,category:'部隊強化',description:'部隊攻撃力+35%／15秒'}),
  steel_wall_scroll:Object.freeze({id:'steel_wall_scroll',name:'鉄壁の巻物',kind:'squad_buff',defense:.28,duration:18,maxStack:20,category:'部隊強化',description:'部隊被ダメージ-28%／18秒'}),
  haste_tonic:Object.freeze({id:'haste_tonic',name:'加速の秘薬',kind:'squad_buff',speed:.40,duration:15,maxStack:20,category:'部隊強化',description:'部隊移動速度+40%／15秒'}),
  rally_horn:Object.freeze({id:'rally_horn',name:'進軍の角笛',kind:'squad_buff',attack:.12,duration:45,maxStack:30,category:'部隊強化',description:'部隊攻撃力+12%／45秒'}),
  guardian_shield:Object.freeze({id:'guardian_shield',name:'守護の聖印',kind:'squad_buff',defense:.12,duration:50,maxStack:30,category:'部隊強化',description:'部隊被ダメージ-12%／50秒'}),
  hunter_boots:Object.freeze({id:'hunter_boots',name:'探索者の靴',kind:'squad_buff',speed:.15,duration:45,maxStack:30,category:'部隊強化',description:'部隊移動速度+15%／45秒'}),
  silver_key:Object.freeze({id:'silver_key',name:'銀の鍵',kind:'key',maxStack:15,category:'鍵'}),
  gold_key:Object.freeze({id:'gold_key',name:'黄金の鍵',kind:'key',maxStack:10,category:'鍵'}),
  medicinal_herbs:Object.freeze({id:'medicinal_herbs',name:'薬草の束',kind:'material',maxStack:99,category:'素材'}),
  enchanted_ore:Object.freeze({id:'enchanted_ore',name:'魔鉱石',kind:'material',maxStack:99,category:'素材'}),
  old_map:Object.freeze({id:'old_map',name:'古い地図',kind:'quest',maxStack:20,category:'貴重品'}),
  iron_key:Object.freeze({id:'iron_key',name:'鉄の鍵',kind:'key',maxStack:20,category:'鍵'}),
  steel_fragment:Object.freeze({id:'steel_fragment',name:'鋼鉄の欠片',kind:'material',maxStack:99,category:'素材'}),
  arcane_crystal:Object.freeze({id:'arcane_crystal',name:'魔力結晶',kind:'material',maxStack:99,category:'素材'}),
  ancient_emblem:Object.freeze({id:'ancient_emblem',name:'古代の紋章',kind:'quest',maxStack:9,category:'貴重品'})
});

const validQty=q=>Number.isSafeInteger(q)&&q>0&&q<=999;
const keyOf=(ownerId,typeId)=>String(ownerId)+':'+typeId;

export function createRoomItemPlan(structure,roomPlans=[]){
  if(!structure?.id||!Array.isArray(structure.floors))return [];
  const rooms=roomPlans.flatMap(plan=>(plan.rooms??[]).map(room=>({...room,floor:plan.floor})));
  const entries=[];
  // Every room keeps its original heal chest, plus one deterministic secondary
  // reward. Stable IDs/positions prevent loot re-rolling or accidental minting.
  const treasure=['field_bandage','medical_kit','war_banner','aegis_seal',
    'wind_scroll','haste_tonic','steel_wall_scroll','silver_key',
    'medicinal_herbs','arcane_crystal','royal_elixir','old_map',
    'berserk_draught','rally_horn','guardian_shield','enchanted_ore'];
  let roomIndex=0;
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
      const lootId=treasure[(roomIndex++ + floor.index*3+structure.id.length)%treasure.length];
      const type=ROOM_ITEM_TYPES[lootId];
      // Do not physically stack both pickups. Respect each authored room bound.
      const tx=Math.max(b.minX+.15,Math.min(b.maxX-.15,x+.85));
      const tz=Math.max(b.minZ+.15,Math.min(b.maxZ-.15,z-.72));
      entries.push({
        id:structure.id+':'+room.id+':treasure-'+lootId,
        buildingId:structure.id,roomId:room.id,roomName:room.label??room.name??'部屋',
        floor:floor.index,x:tx,y:floor.baseY,z:tz,
        itemId:lootId,item:type.name,quantity:1
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
    if(!type?.id||!type.name||!['heal','squad_buff','material','key','quest'].includes(type.kind)||
      (type.kind==='heal'&&!(type.healHp>0))||
      (type.kind==='squad_buff'&&(!(type.duration>0)||!(type.attack>0||type.defense>0||type.speed>0))))throw Error('アイテム定義が不正です');
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
  /** Finite deployment supplies, registered explicitly by the battle setup. */
  grant(ownerId,itemId,quantity=1){
    const type=this.types.get(itemId);
    if(ownerId==null||!type||!validQty(quantity))return false;
    const key=keyOf(ownerId,itemId);
    const stack=this.inventory.get(key)??{ownerId:String(ownerId),itemId,name:type.name,quantity:0};
    if(stack.quantity+quantity>type.maxStack)return false;
    stack.quantity+=quantity;
    this.inventory.set(key,stack);
    return true;
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
  /** Consume exactly one item for a squad-wide effect. Game/Worker own HP and buff state. */
  consumeSquad(ownerId,itemId){
    const stack=this.inventory.get(keyOf(ownerId,itemId));
    const type=this.types.get(itemId);
    if(!stack||stack.quantity<=0||!type||!['heal','squad_buff'].includes(type.kind))return null;
    if(type.kind==='heal'&&!(type.squadHealHp>0))return null;
    if(type.kind==='squad_buff'&&!(type.duration>0))return null;
    if(--stack.quantity<=0)this.inventory.delete(keyOf(ownerId,itemId));
    return {...type};
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

/** Share a fixed total HP budget fairly across a squad; never heal enemies or revive dead. */
export function applySquadHeal(units,squadId,totalHp,{team=0}={}){
  let remaining=Math.max(0,Math.floor(Number(totalHp)||0)),affected=0,total=0;
  let pending=(units||[]).filter(u=>u.team===team&&String(u.squadId)===String(squadId)&&
    u.alive!==false&&u.hp>0&&u.maxHp>u.hp);
  const changed=new Set();
  while(remaining>0&&pending.length){
    const share=Math.max(1,Math.floor(remaining/pending.length));
    let progressed=false;
    for(const u of pending){
      const gain=Math.min(share,remaining,Math.max(0,Math.ceil(u.maxHp-u.hp)));
      if(gain<=0)continue;
      u.hp=Math.min(u.maxHp,u.hp+gain);
      remaining-=gain;total+=gain;changed.add(u.id);progressed=true;
      if(!remaining)break;
    }
    if(!progressed)break;
    pending=pending.filter(u=>u.hp<u.maxHp);
  }
  affected=changed.size;
  return {affected,total};
}
