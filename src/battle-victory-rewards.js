/** Deterministic battle rewards. Only authoritative settlements may credit balances. */
import {ROOM_ITEM_TYPES} from './room-item-registry.js';

const nonnegative=value=>Math.max(0,Math.floor(Number(value)||0));
const kindBonus={explore:0,capture:45,defend:55,siege:80,boss:150};
export function coreVictoryReward(stage){
 if(!stage||!['explore','capture','defend','siege','boss'].includes(stage.kind))
  return {gold:0,xp:0,loot:[]};
 const difficulty=nonnegative(stage.difficulty),chapter=nonnegative(stage.chapter),slot=nonnegative(stage.slot);
 return {gold:70+12*difficulty+10*chapter+5*slot+(kindBonus[stage.kind]||0),
  xp:35+4*difficulty+6*chapter+4*slot+Math.floor((kindBonus[stage.kind]||0)/2),
  loot:[]};
}
export function territoryVictoryReward(territory){
 return territory?.base?{gold:220,xp:200,loot:[]}:{gold:110,xp:110,loot:[]};
}
/** Validate item catalogue and accumulated physical chest pickups, not guessed treasure. */
export function verifiedBattleLoot(entries){
 if(!Array.isArray(entries)||entries.length>80)return [];
 const sums=new Map();let total=0;
 for(const row of entries){
  const id=String(row?.itemId||''),quantity=Number(row?.quantity);
  if(!Object.hasOwn(ROOM_ITEM_TYPES,id)||!Number.isSafeInteger(quantity)||
    quantity<1||quantity>99)return [];
  total+=quantity;
  if(total>300)return [];
  sums.set(id,(sums.get(id)||0)+quantity);
 }
 return [...sums].map(([itemId,quantity])=>({
  itemId,quantity,name:ROOM_ITEM_TYPES[itemId].name,category:ROOM_ITEM_TYPES[itemId].category
 }));
}
export function battleVictoryReceipt({reward,loot=[],story=false}={}){
 const validated=verifiedBattleLoot(loot);
 return {gold:nonnegative(reward?.gold),xp:nonnegative(reward?.xp),
  loot:validated,source:story?'story':'core'};
}
