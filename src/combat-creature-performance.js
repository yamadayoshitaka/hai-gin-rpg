/**
 * The sole presentation contract for creature attacks, voices and seats.
 * No Three.js dependency: battle AI, WebGPU workers, and WebGL renderer use
 * identical timings and object IDs.
 */
import {MONSTER_SUMMON_ENTRIES,MONSTER_SUMMON_BY_TYPE}
 from './monster-summon-registry.js?v=natural-size-20261116';

export const CREATURE_PERFORMANCE = Object.freeze({
  // Seat is soldier-root elevation, not saddle Y: pelvis is ~0.95 above root.
  wolf: Object.freeze({attack:'bite',windup:.19,duration:.58,voice:'bark/howl',seat:1.12,scaleWhenMounted:1.42,voiceLength:.72}),
  wyvern: Object.freeze({attack:'dive_claw',windup:.24,duration:.88,voice:'shriek',seat:1.55,scaleWhenMounted:1.05,voiceLength:.85}),
  dragon: Object.freeze({attack:'fire_breath',windup:.44,duration:1.18,voice:'roar',seat:2.68,scaleWhenMounted:1.35,voiceLength:1.3}),
  elder_dragon: Object.freeze({attack:'celestial_breath',windup:.58,duration:1.44,voice:'ancient_roar',seat:3.43,scaleWhenMounted:1.55,voiceLength:1.5}),
  dragon_lord: Object.freeze({attack:'inferno_breath',ultimate:'royal_starflare',
    windup:.76,duration:1.75,voice:'royal_roar',mountable:false,seat:0,
    scaleWhenMounted:1.70,voiceLength:1.8}),
  forest_archer: Object.freeze({attack:'spirit_arrow',windup:.38,duration:1.0,voice:'forest_chant',mountable:false,seat:0,scaleWhenMounted:1,voiceLength:.85}),
  seraph_guardian: Object.freeze({attack:'radiant_lance',windup:.54,duration:1.34,voice:'angelic_chime',mountable:false,seat:0,scaleWhenMounted:1,voiceLength:1.28}),
  // Real horse saddle top is ~1.79m (horse body 1.22 + saddle .51 + .055).
  // Old 1.34m root seat embedded the rider's pelvis inside the horse barrel.
  horse: Object.freeze({attack:'rear',windup:.2,duration:.78,voice:'whinny',seat:1.76,scaleWhenMounted:1,voiceLength:1.05}),
});

// Flying familiars perform five short attacks in the time formerly used for
// one. Damage per hit is reduced by the same factor in the battle runtime,
// preserving total DPS and building durability while making action readable.
export const FLYING_CREATURE_ATTACK_RATE = 5;

export function creatureInstancePhase(id){
  let hash=2166136261;
  for(const ch of String(id??''))hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  return (hash>>>0)%628/100;
}

// Restore species-native presentation rather than the experimental 10x enlargement.
// Horses, mount seats, animation and flight altitude continue sharing this scale.
export const SUMMON_WORLD_SCALE=1;
export const LARGE_SUMMON_IDS=Object.freeze([
 'wolf','wyvern','dragon','elder_dragon','dragon_lord',
 'forest_archer','seraph_guardian',
 ...MONSTER_SUMMON_ENTRIES.map(item=>item.id)
]);
const isColossalSummon=type=>LARGE_SUMMON_IDS.includes(type);

export function creatureFlightHeight(object,time=0){
 if(!object?.flying)return 0;
 const factor=isColossalSummon(object.type)?SUMMON_WORLD_SCALE:1;
 return Math.max(2.6*factor,object.height||0)+
  .22*factor*Math.sin(time*3.7+creatureInstancePhase(object.id));
}

export function creatureSize(type,mounted=false){
 const base={wolf:1,wyvern:1.05,dragon:1.35,elder_dragon:1.55,
  dragon_lord:1.70,forest_archer:1,seraph_guardian:1,horse:1};
 const catalogBase=MONSTER_SUMMON_BY_TYPE[type]?.size;
 const original=mounted?(CREATURE_PERFORMANCE[type]?.scaleWhenMounted??catalogBase??base[type]??1):
  (catalogBase??base[type]??1);
 return original*(isColossalSummon(type)?SUMMON_WORLD_SCALE:1);
}

/** Rider's local root offset relative to its mount's original origin.
 * All procedural mounts face +Z. The saddle is REAR of the shoulder, not
 * in the neck or belly. The character model stays a complete separate rig.
 */
/** Mount-local seat anchor is the single source of truth for both the full
 * skinned rider and the instanced 1000v1000 rider. The pelvis, not the root
 * or ankles, must meet the saddle. Positive Y includes thigh clearance and
 * Z is behind the creature's neck in its +Z-forward coordinates.
 */
export function riderSeatAnchor(object,time=0){
 if(!object)return {x:0,y:0,z:0};
 const settings=CREATURE_PERFORMANCE[object.type];
 if(settings?.seat==null)return {x:0,y:0,z:0};
 const size=creatureSize(object.type,true)*(object.commanderMount?1.12:1);
 // Horse's broad withers are forward of the true seating surface.
 // The actual horse saddle pad is centred at z=-0.18m. z=-0.43 sat on the
 // rear edge and made the rider appear to sink into the croup.
 const back={horse:-.20,wolf:-.24,wyvern:-.29,dragon:-.39,elder_dragon:-.47};
 // Flying mounts keep their pre-existing exact frame-synchronised vertical contract.
 const clearance={horse:.11,wolf:.12,wyvern:0,dragon:0,elder_dragon:0};
 const commanderRise=object.type==='horse'&&object.commanderMount?.26:0;
 return {
  x:0,
  y:settings.seat*(isColossalSummon(object.type)?SUMMON_WORLD_SCALE:1)+
    (clearance[object.type]??.1)*size+commanderRise+creatureFlightHeight(object,time),
  z:(back[object.type]??0)*size
 };
}
export function riderSeatLocalOffset(object){
 const anchor=riderSeatAnchor(object);
 return {x:anchor.x,z:anchor.z};
}
export function riderSeatHeight(object,time=0){
 return riderSeatAnchor(object,time).y;
}

/** Returns 0 outside the current, server-authoritative attack window. */
export function creatureAttackProgress(object,time=0){
  const settings=CREATURE_PERFORMANCE[object?.type];
  if(!settings||!Number.isFinite(object?.attackStartedAt))return 0;
  const duration=settings.duration/(object.flying?FLYING_CREATURE_ATTACK_RATE:1);
  const progress=(time-object.attackStartedAt)/duration;
  return progress>=0&&progress<=1?progress:0;
}


/**
 * A flying mount and its rider must use the SAME visual clock. Independent
 * body pitch/roll or attack displacement makes the soldier detach from a
 * moving saddle, even when their grid coordinates are identical.
 * Wing, claw and jaw animations remain independent of the seated body.
 */
export function mountedFlightSway(object,time=0){
  if(!object?.flying||object.mountedBy==null)return {pitch:0,roll:0};
  const phase=creatureInstancePhase(object.id);
  return {
    pitch:0.024*Math.sin(time*1.9+phase),
    roll:0.028*Math.sin(time*1.5+phase*.7),
  };
}

/** Ground-relative body height, or the authoritative visible rider height
 * minus the seat clearance. The latter is essential for roof insertion and
 * for Worker/render interpolation, where terrain sampling differs.
 */
export function mountedFlightBaseHeight(object,time=0,ground=0,riderY=null){
  const flight=creatureFlightHeight(object,time);
  if(!object?.flying||object.mountedBy==null||!Number.isFinite(riderY))
    return ground+flight;
  return riderY-(riderSeatHeight(object,time)-flight);
}

export function mountableCreature(object){
  return !!object?.alive&&!!CREATURE_PERFORMANCE[object.type]&&
    CREATURE_PERFORMANCE[object.type].mountable!==false&&
    ['summon','mount'].includes(object.category);
}
