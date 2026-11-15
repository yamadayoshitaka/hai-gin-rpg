/**
 * Bridges the 50 existing bestiary species to independent summoned actors.
 * No donor monster model, m005/m006 protected PR or humanoid source is edited.
 * Summoned copies use natural human-relative heights; bestiary/enemy specimens stay native.
 */
import {MONSTER_CATALOG,MONSTER_BY_ID} from './monster-catalog.js';

export const MONSTER_SUMMON_PREFIX='summon_';
export const MONSTER_SUMMON_MODEL_HEIGHT=1.7; // Restore original human-relative summon scale.
export const MONSTER_SUMMON_MAX_ACTIVE=24; // ten squads per side + small reserve
export const MONSTER_SUMMON_MAX_HIGH_DETAIL=2;
export const MONSTER_SUMMON_ENTRIES=Object.freeze(MONSTER_CATALOG.map(monster=>{
 const id=MONSTER_SUMMON_PREFIX+monster.id;
 const airborne=monster.family==='avian'||monster.id==='m042';
 const aquatic=monster.family==='aquatic'||monster.id==='m020';
 const rare=monster.rarity==='UR';
 const ranged=['undead','aquatic','fiend'].includes(monster.family)||
  ['m018','m020','m025','m030'].includes(monster.id);
 const rank=rare?'UR':monster.rarity==='R'||monster.rarity==='SR'?'R':'N';
 return Object.freeze({
  id,monsterId:monster.id,name:monster.name,family:monster.family,
  element:monster.element,rarity:monster.rarity,rank,
  // Preserve the source monster's original species size multiplier.
  size:Math.max(1,monster.size),flying:airborne,aquatic,
  objectSpec:Object.freeze({
   name:monster.name,category:'summon',sourceMonsterId:monster.id,
   hp:monster.stats.hp,speed:Math.max(6,Math.min(15,monster.stats.speed)),
   attack:monster.stats.attack,interval:rare?3.1:2.3,
   range:ranged?8:2,radius:rare?8:5,
   flying:airborne,duration:rare?33:45,
   element:monster.element,sourceSkill:monster.skill,
   monsterFamily:monster.family,monsterRarity:monster.rarity,
  }),
  skillSpec:Object.freeze({
   id:'call_'+monster.id,rank,kind:'summon',
   mp:rare?50:rank==='R'?27:15,
   cooldown:rare?55:rank==='R'?29:17,
   range:3,name:monster.name+'召喚',objectType:id,
   animation:'cast',effect:monster.element==='light'?'heal':
    ['fire','water','ice','earth','wind','lightning','nature'].includes(monster.element)?
     monster.element:'arcane'
  }),
 });
}));
export const MONSTER_SUMMON_BY_TYPE=Object.freeze(
 Object.fromEntries(MONSTER_SUMMON_ENTRIES.map(entry=>[entry.id,entry]))
);
export const MONSTER_SUMMON_SPECS=Object.freeze(
 Object.fromEntries(MONSTER_SUMMON_ENTRIES.map(e=>[e.id,e.objectSpec]))
);
export const MONSTER_SUMMON_SKILLS=Object.freeze(
 MONSTER_SUMMON_ENTRIES.map(e=>e.skillSpec)
);
export const isMonsterSummonType=type=>
 typeof type==='string'&&Object.hasOwn(MONSTER_SUMMON_BY_TYPE,type);
export function monsterSummonSource(type){
 const entry=MONSTER_SUMMON_BY_TYPE[type];
 return entry?MONSTER_BY_ID[entry.monsterId]:null;
}
export function monsterSummonWorldScale(type,boundsHeight){
 const item=MONSTER_SUMMON_BY_TYPE[type];
 if(!item)throw Error('Unknown bestiary summon '+type);
 if(!Number.isFinite(boundsHeight)||boundsHeight<=0)
  throw Error('Summon must have a measurable source model height');
 // Keep species-specific proportions and the original 1.7m reference.
 return MONSTER_SUMMON_MODEL_HEIGHT*item.size/boundsHeight;
}
