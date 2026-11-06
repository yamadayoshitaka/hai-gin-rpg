/**
 * The sole presentation contract for creature attacks, voices and seats.
 * No Three.js dependency: battle AI, WebGPU workers, and WebGL renderer use
 * identical timings and object IDs.
 */
export const CREATURE_PERFORMANCE = Object.freeze({
  // Seat is soldier-root elevation, not saddle Y: pelvis is ~0.95 above root.
  wolf: Object.freeze({attack:'bite',windup:.19,duration:.58,voice:'bark/howl',seat:.78,scaleWhenMounted:1.42,voiceLength:.72}),
  wyvern: Object.freeze({attack:'dive_claw',windup:.24,duration:.88,voice:'shriek',seat:1.17,scaleWhenMounted:1.05,voiceLength:.85}),
  dragon: Object.freeze({attack:'fire_breath',windup:.44,duration:1.18,voice:'roar',seat:2.38,scaleWhenMounted:1.35,voiceLength:1.3}),
  elder_dragon: Object.freeze({attack:'celestial_breath',windup:.58,duration:1.44,voice:'ancient_roar',seat:3.10,scaleWhenMounted:1.55,voiceLength:1.5}),
  horse: Object.freeze({attack:'rear',windup:.2,duration:.78,voice:'whinny',seat:.79,scaleWhenMounted:1,voiceLength:1.05}),
});

export function creatureInstancePhase(id){
  let hash=2166136261;
  for(const ch of String(id??''))hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  return (hash>>>0)%628/100;
}

export function creatureFlightHeight(object,time=0){
  if(!object?.flying)return 0;
  return Math.max(2.6,object.height||0)+.22*Math.sin(time*3.7+creatureInstancePhase(object.id));
}

export function creatureSize(type,mounted=false){
  const base={wolf:1,wyvern:1.05,dragon:1.35,elder_dragon:1.55,horse:1};
  return mounted?(CREATURE_PERFORMANCE[type]?.scaleWhenMounted??base[type]??1):(base[type]??1);
}

export function riderSeatHeight(object,time=0){
  if(!object)return 0;
  const settings=CREATURE_PERFORMANCE[object.type];
  return settings?.seat==null?0:settings.seat+creatureFlightHeight(object,time);
}

/** Returns 0 outside the current, server-authoritative attack window. */
export function creatureAttackProgress(object,time=0){
  const settings=CREATURE_PERFORMANCE[object?.type];
  if(!settings||!Number.isFinite(object?.attackStartedAt))return 0;
  const progress=(time-object.attackStartedAt)/settings.duration;
  return progress>=0&&progress<=1?progress:0;
}

export function mountableCreature(object){
  return !!object?.alive&&!!CREATURE_PERFORMANCE[object.type]&&
    ['summon','mount'].includes(object.category);
}
