/**
 * Real gallery actions for the original 3 featured summons.
 * Each action represents an existing battlefield skill, animation or attack,
 * never merely a new button with no effect. The gallery previews VFX without
 * changing live combat health. Gameplay HP is owned by CombatActionRuntime.
 */
export const SUMMON_GALLERY_ACTIONS=Object.freeze({
 forest_archer:Object.freeze([
  Object.freeze({id:'forest_rejuvenation',label:'森の再生祈祷',pose:'special',vfx:'heal',description:'味方への範囲回復'}),
  Object.freeze({id:'spirit_arrow',label:'精霊の矢',pose:'attack',vfx:'arrow',description:'自然属性の弓攻撃'})
 ]),
 seraph_guardian:Object.freeze([
  Object.freeze({id:'seraph_blessing',label:'聖翼の祝福',pose:'special',vfx:'heal',description:'味方への範囲回復'}),
  Object.freeze({id:'seraph_resurrection',label:'天翼の蘇生',pose:'special',vfx:'revive',description:'倒れた味方の蘇生'}),
  Object.freeze({id:'radiant_lance',label:'光の槍',pose:'attack',vfx:'radiant',description:'光属性攻撃'})
 ]),
 dragon_lord:Object.freeze([
  Object.freeze({id:'dragon_lord_starflare',label:'星滅の大焔',pose:'special',vfx:'starflare',description:'広範囲必殺魔法'}),
  Object.freeze({id:'inferno_breath',label:'煉獄ブレス',pose:'attack',vfx:'breath',description:'火炎ブレス'}),
  Object.freeze({id:'royal_roar',label:'竜王の咆哮',pose:'roar',vfx:'roar',description:'咆哮・威嚇'})
 ])
});
export const summonGalleryActions=species=>SUMMON_GALLERY_ACTIONS[species]??Object.freeze([]);
export const summonGalleryAction=(species,id)=>
 summonGalleryActions(species).find(a=>a.id===id)??null;
