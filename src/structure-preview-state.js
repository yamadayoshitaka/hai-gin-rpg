import {STRUCTURE_DURABILITY,STRUCTURE_BURN_RATE,STRUCTURE_BURN_SECONDS} from './destructible-world.js';

const KIND_BY_CATALOG_ID=Object.freeze({
  castle_001:'castle',church_001:'church',weapon_shop_001:'weapon',
  inn_001:'inn',item_shop_001:'shop',town_house_001:'house',
  manor_noble_001:'manor_noble',manor_merchant_001:'manor_merchant',
  manor_garden_001:'manor_garden',stone_hut_001:'hut',
  timber_bridge_001:'timber_bridge',stone_bridge_001:'stone_bridge',
  wooden_watchtower_001:'hut'
});

/** Real combat HP and fire rules, expressed in the catalogue's local grid. */
export function describeCatalogPreviewStructure(catalogId,entry,model=null){
  if(!entry||entry.category!=='建造物'||!Number.isFinite(entry.widthCells)||
    !Number.isFinite(entry.depthCells))return null;
  const bridge=entry.kind==='bridge';
  const kind=KIND_BY_CATALOG_ID[catalogId]??'house';
  return {id:'catalog-structure',type:bridge?'bridge':'building',x:6,z:6,
    bounds:{minX:6-entry.widthCells/2,maxX:6+entry.widthCells/2,
      minZ:6-entry.depthCells/2,maxZ:6+entry.depthCells/2},
    hp:STRUCTURE_DURABILITY[kind]??STRUCTURE_DURABILITY.house,
    fireDamagePerSecond:STRUCTURE_BURN_RATE[kind]??STRUCTURE_BURN_RATE.house,
    burnSeconds:STRUCTURE_BURN_SECONDS[kind]??STRUCTURE_BURN_SECONDS.house,
    blocking:false,walkableWhenOpened:false,
    source:{data:{kind},type:bridge?(kind==='stone_bridge'?'stone':'timber'):null,
      model,structure:model?.userData?.structure,visualHeightScale:2.2}};
}
