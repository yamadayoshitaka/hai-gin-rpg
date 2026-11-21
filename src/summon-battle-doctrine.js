/**
 * Balance contract for native summoned creatures.
 * This is simulation-side data shared by mass battles and normal battles.
 * Healers are competent damage dealers but cast FIRST whenever a living
 * ally is hurt; revival is reserved for the UR guardian.
 */
export const SUMMON_BATTLE_DOCTRINE_REVISION='support-first-starflare-v1-20261121';

export const SUMMON_SUPPORT_PROFILES=Object.freeze({
 forest_archer:Object.freeze({
  skillId:'forest_rejuvenation',skillName:'森の再生祈祷',
  heal:27,cooldown:5.5,range:7,area:2.7,maxTargets:10,
  revival:false,element:'nature'
 }),
 seraph_guardian:Object.freeze({
  skillId:'seraph_blessing',skillName:'聖翼の祝福',
  heal:44,cooldown:6,range:8,area:3.2,maxTargets:12,
  revival:true,reviveSkillId:'seraph_resurrection',reviveSkillName:'天翼の蘇生',
  reviveRange:6,reviveFraction:.45,reviveCooldown:19,
  firstReviveDelay:7,element:'heal'
 })
});

export const DRAGON_LORD_STARFLARE=Object.freeze({
 id:'dragon_lord_starflare',
 name:'星滅の大焔',
 attackType:'royal_starflare',
 windup:1.22,initialDelay:8,cooldown:14,
 radius:6,damage:195,structureDamage:142,
 maxTargets:24,element:'arcane',animation:'special'
});

/**
 * Select a real injured ally, not a fake visual target or an enemy.
 * Sorting is deterministic for Worker / main-thread mirror parity.
 */
export function selectSummonHealTarget(allies,summon){
 if(!summon)return null;
 const profile=SUMMON_SUPPORT_PROFILES[summon.type];
 if(!profile)return null;
 const candidates=(allies||[]).filter(unit=>
  unit?.team===summon.team&&unit.alive!==false&&
  Number.isFinite(unit.hp)&&unit.hp>0&&
  Number.isFinite(unit.maxHp)&&unit.hp<unit.maxHp&&
  Math.hypot(unit.x-summon.x,unit.z-summon.z)<=profile.range);
 candidates.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||
  Math.hypot(a.x-summon.x,a.z-summon.z)-
    Math.hypot(b.x-summon.x,b.z-summon.z)||
  String(a.id).localeCompare(String(b.id)));
 return candidates[0]||null;
}

export function selectSummonReviveTarget(allies,summon){
 const profile=SUMMON_SUPPORT_PROFILES[summon?.type];
 if(!profile?.revival)return null;
 return (allies||[]).filter(unit=>unit?.team===summon.team&&
   (unit.alive===false||unit.hp<=0)&&unit.hp===0&&
   Number.isFinite(unit.maxHp)&&unit.maxHp>0&&
   Math.hypot(unit.x-summon.x,unit.z-summon.z)<=profile.reviveRange)
  .sort((a,b)=>Math.hypot(a.x-summon.x,a.z-summon.z)-
    Math.hypot(b.x-summon.x,b.z-summon.z)||
    String(a.id).localeCompare(String(b.id)))[0]||null;
}
