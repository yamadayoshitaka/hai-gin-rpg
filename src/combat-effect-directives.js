/** Renderer-independent instructions for battlefield VFX.
 * Radius is always in grid tiles; damage/healing remains simulation-owned. */
export function combatEffectDirective(event){
  if(!event)return null;
  // Native bestiary summons keep their original elemental identities:
  // Leviathan's sea surge is water, Hydra's toxic flora is nature and
  // Basilisk's stony gaze is earth, instead of generic sword slashes.
  // Only impact events render the royal six-tile-wide area attack.
  if(event.type==='objectAttack'&&event.attackType==='royal_starflare')
    return {kind:'area',element:'arcane',radius:Math.min(6,Math.max(1,event.radius||6))};
  if(event.type==='skill'&&['forest_rejuvenation','seraph_blessing'].includes(event.skillId))
    return {kind:'healArea',element:'nature',radius:Math.min(4,Math.max(1,event.radius||2.5))};
  if(event.type==='objectAttack'&&/^summon_m\d{3}$/.test(event.objectType||'')){
    const element=event.effect==='physical'?'heavy':event.effect||'arcane';
    return {kind:'area',element,radius:Math.min(2.4,Math.max(.5,(event.radius||2)*.3))};
  }
  if(event.type==='objectAttack'&&['dragon','elder_dragon','dragon_lord'].includes(event.objectType))
    return {kind:'breath',element:event.objectType==='elder_dragon'?'arcane':'fire',
      radius:event.objectType==='dragon_lord'?1.65:.9};
  if(event.type==='explode')return {kind:'explosion',element:'fire',radius:Math.max(.5,event.radius||1)};
  if(event.type==='spawn'&&['trap','dynamite','c4'].includes(event.objectType))
    return {kind:'fuse',element:'fire',radius:.75};
  if(event.type==='unlock')return {kind:'unlock',element:'spark',radius:.75};
  if(event.type!=='skill')return null;
  if(event.jobId==='mage'&&event.skillKind==='damage')
    return {kind:'area',element:event.effect||'arcane',radius:Math.max(.75,event.radius||.75)};
  if(event.jobId==='priest'&&['heal','revive'].includes(event.skillKind))
    return {kind:'healArea',element:'nature',radius:Math.max(.75,event.radius||.75)};
  if(['timed_dynamite','blast_trap','plant_c4'].includes(event.skillId))
    return {kind:'fuse',element:'fire',radius:.75};
  if(event.skillId==='grappling_hook')return {kind:'tether',element:'spark',radius:0};
  if(event.jobId==='thief'&&event.skillId==='shadow_veil')return {kind:'stealth',element:'arcane',radius:1};
  if(event.jobId==='thief'&&event.skillKind==='unlock')return {kind:'unlock',element:'spark',radius:.75};
  if(event.skillKind==='damage'&&event.radius>0)return {kind:'area',element:event.effect||'slash',radius:event.radius};
  return null;
}
