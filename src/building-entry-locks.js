/**
 * A single, data-driven lock definition for each building's OUTSIDE entrance.
 * Interior doors and stair portals deliberately do not use these rules.
 *
 * A grade describes the quality/security of a building; lockLevel is the
 * skill/key tier required when that entrance is actually locked. Public
 * entrances retain their lock hardware/level without locking out customers.
 */
export const BUILDING_ENTRY_GRADES=Object.freeze({
 home:1,old:1,artisan:1,house:1,stone_hut:1,
 scholar:2,weapons:2,weapon:2,armor:2,items:2,shop:2,inn:2,
 merchant:3,church:3,manor_merchant:3,
 manor:4,manor_noble:4,manor_garden:4,castle:5
});

// Tactical-world catalog objects share `kind:'town_building'`; resolve by
// their catalog identifier instead of their shared renderer category.
export const CATALOG_ENTRY_GRADES=Object.freeze({
 castle_001:5,church_001:3,weapon_shop_001:2,inn_001:2,
 item_shop_001:2,town_house_001:1,manor_noble_001:4,
 manor_merchant_001:3,manor_garden_001:4,stone_hut_001:1
});

export const BUILDING_ENTRY_PUBLIC_KINDS=Object.freeze([
 'weapons','armor','items','inn','merchant','church'
]);

const PUBLIC_KINDS=new Set([...BUILDING_ENTRY_PUBLIC_KINDS,'weapon','shop']);
const PUBLIC_CATALOG_IDS=new Set(['church_001','weapon_shop_001','inn_001','item_shop_001']);
const validLevel=value=>Number.isInteger(value)&&value>=0&&value<=5;

/**
 * Resolve grade and the entry door's lock from authored building data.
 * `entryDoor` overrides are instance-local; no per-building control code.
 */
export function resolveBuildingEntryDoor(building={}){
 const custom=building.entryDoor??{};
 const grade=custom.grade??building.grade??CATALOG_ENTRY_GRADES[building.id]??(building.id==='castle'?5:BUILDING_ENTRY_GRADES[building.kind]??1);
 if(!validLevel(grade)||grade<1)throw Error('Invalid building grade: '+building.id);
 const lockLevel=custom.lockLevel??grade;
 if(!validLevel(lockLevel))throw Error('Invalid entrance lock level: '+building.id);
 const isPublic=PUBLIC_KINDS.has(building.kind)||PUBLIC_CATALOG_IDS.has(building.id)||building.id==='home-hero';
 const permission=custom.permission??(['castle','castle_001'].includes(building.id)?'royal-visitor':null);
 const locked=custom.locked??(!isPublic&&lockLevel>0);
 return {
  id:custom.id??String(building.id??building.kind??'building')+':entrance',
  type:'door',entranceOnly:true,
  grade,lockLevel,locked:Boolean(locked),
  permission,label:custom.label??'入口の扉'
 };
}

/**
 * Returns both the decision and a user-facing explanation. Permission is
 * explicit: the caller decides when story/guard access has been granted.
 * A held key can be expressed as a numeric keyLevel or an array of keyLevels.
 */
export function evaluateBuildingEntry(building,access={}){
 const door=resolveBuildingEntryDoor(building);
 const keyLevel=Number.isInteger(access.keyLevel)?access.keyLevel:0;
 const additionalKeys=Array.isArray(access.keyLevels)?access.keyLevels:[];
 const bestKeyLevel=Math.max(0,keyLevel,...additionalKeys.filter(Number.isInteger));
 const permissions=access.permissions instanceof Set?access.permissions:new Set(access.permissions??[]);
 const hasPermission=door.permission!=null&&permissions.has(door.permission);
 if(!door.locked||door.lockLevel===0)
  return {allowed:true,reason:'open',message:'入口は開いている。',door,bestKeyLevel};
 if(hasPermission)
  return {allowed:true,reason:'permission',message:'通行許可により入れる。',door,bestKeyLevel};
 if(bestKeyLevel>=door.lockLevel)
  return {allowed:true,reason:'key',message:'レベル'+bestKeyLevel+'の鍵で開錠した。',door,bestKeyLevel};
 return {allowed:false,reason:'locked',message:'入口は施錠中（鍵Lv.'+door.lockLevel+'／所持Lv.'+bestKeyLevel+'）。',door,bestKeyLevel};
}
