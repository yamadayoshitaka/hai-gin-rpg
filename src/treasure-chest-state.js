/**
 * A treasure chest remains in the world after its one-time item pickup.
 * The lid is a separate hinged mesh and opens without a pop-up dialog.
 * The registry alone owns the item state; this module is visual-only.
 */
export const TREASURE_CHEST_OBJECT_ID='treasure_chest_001';
export function openTreasureChestModel(chest){
 if(!chest||chest.userData?.opened)return false;
 chest.userData.opened=true;
 chest.userData.empty=true;
 chest.visible=true;
 const lid=chest.getObjectByName?.('treasure_chest_lid');
 if(lid)lid.rotation.x=-1.23;
 return true;
}
export function syncTreasureChestState(chest,itemState){
 if(itemState==='placed')return false;
 return openTreasureChestModel(chest);
}
