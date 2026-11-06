/**
 * Real-time army combat contract v1.0. Pure data: no renderer, skeleton or
 * wardrobe dependencies. One tile is a human step. Values are design baselines.
 */
export const RARITY_RANK = Object.freeze({ N: 0, R: 1, UR: 2 });
export const COMBAT_RULES = Object.freeze({
  tickSeconds: 0.1, maxMp: 100, mpRecoveryPerSecond: 0.45,
  maximumObjectsPerTeam: 36, maximumSummonsPerCaster: 1,
  summonDamageLinkRatio: .5,
  summonLeashTiles: 22, summonLifetimeSeconds: 45,
  horseLifetimeSeconds: 240, mountedSpeedMultiplier: 3.2,
  blastFuseSeconds: 60, blastFriendlyFire: true,
  defeatBodyBlocksMovement: false,
});

const skill = (id, rank, kind, mp, cooldown, range, extra = {}) =>
  Object.freeze({ id, rank, kind, mp, cooldown, range, ...extra });

/** IDs are deliberately compatible with the existing mass-battle roster. */
export const COMBAT_JOB_SPECS = Object.freeze({
  sword: Object.freeze({ name: '騎士', aliases: ['剣士', 'swordsman', 'knight'], role: 'front',
    skills: Object.freeze([
      skill('sword_slash', 'N', 'damage', 0, 2.2, 2, { name: '剣撃', power: 19, animation: 'attack', effect: 'slash' }),
      skill('mount_horse', 'R', 'mount', 14, 35, 2, { name: '軍馬騎乗', objectType: 'horse', animation: 'skill', effect: 'dust' }),
      skill('cavalry_charge', 'UR', 'damage', 20, 12, 4, { name: '騎馬突撃', power: 45, radius: 1, mountedOnly: true, animation: 'attack', effect: 'heavy' }),
    ]) }),
  shield: Object.freeze({ name: '盾騎士', aliases: ['盾戦士', 'guardian'], role: 'front',
    skills: Object.freeze([
      skill('shield_attack', 'N', 'damage', 0, 2.4, 2, { name: '通常攻撃', power: 16, animation: 'attack', effect: 'slash' }),
      skill('shield_guard', 'N', 'buff', 0, 8, 0, { name: '守護の盾', buff: 'guard', seconds: 4, animation: 'guard', effect: 'guard' }),
      skill('flame_ward', 'R', 'buff', 12, 16, 0, { name: '炎防壁', buff: 'fireWard', seconds: 8, animation: 'guard', effect: 'guard' }),
      skill('mirror_shield', 'UR', 'buff', 24, 24, 0, { name: '反射吸収', buff: 'reflect', seconds: 6, animation: 'guard', effect: 'arcane' }),
    ]) }),
  fighter: Object.freeze({ name: '格闘家', aliases: ['武闘家', 'monk'], role: 'front',
    skills: Object.freeze([
      skill('iron_fist', 'N', 'damage', 0, 2, 2, { name: '剛拳', power: 22, animation: 'attack', effect: 'heavy' }),
      skill('qi_wave', 'R', 'damage', 12, 8, 5, { name: '気功波', power: 30, radius: 1, element: 'arcane', animation: 'skill', effect: 'arcane' }),
      skill('hundred_fists', 'UR', 'damage', 28, 18, 2, { name: '百裂拳', power: 65, radius: 2, animation: 'attack', effect: 'heavy' }),
      skill('meditation', 'N', 'restore', 0, 25, 0, { name: '瞑想', hp: 18, mpRestore: 15, animation: 'skill', effect: 'heal' }),
    ]) }),
  ninja: Object.freeze({ name: '忍者', aliases: [], role: 'environment',
    skills: Object.freeze([
      skill('shadow_strike', 'N', 'damage', 0, 2.5, 2, { name: '影斬り', power: 24, animation: 'attack', effect: 'slash' }),
      skill('grappling_hook', 'R', 'mobility', 10, 15, 6, { name: '鉤縄', tiles: 3, animation: 'jump', effect: 'dust' }),
      skill('blast_trap', 'R', 'place', 12, 18, 3, { name: '爆薬罠', objectType: 'trap', animation: 'skill', effect: 'earth' }),
      skill('plant_c4', 'R', 'place', 18, 22, 3, { name: 'C4設置', objectType: 'c4', animation: 'skill', effect: 'fire' }),
      skill('timed_dynamite', 'UR', 'place', 35, 60, 4, { name: '時限ダイナマイト', objectType: 'dynamite', animation: 'skill', effect: 'fire' }),
    ]) }),
  thief: Object.freeze({ name: 'シーフ', aliases: ['盗賊', 'rogue'], role: 'environment',
    skills: Object.freeze([
      skill('quick_stab', 'N', 'damage', 0, 1.8, 2, { name: '疾風突き', power: 11, animation: 'attack', effect: 'slash' }),
      skill('pick_lock', 'N', 'unlock', 0, 3, 1, { name: '解錠', lockLevel: 1, animation: 'skill', effect: 'spark' }),
      skill('advanced_lock', 'R', 'unlock', 8, 7, 1, { name: '上級解錠', lockLevel: 3, animation: 'skill', effect: 'spark' }),
      skill('master_lock', 'UR', 'unlock', 18, 12, 1, { name: '万能解錠', lockLevel: 5, animation: 'skill', effect: 'spark' }),
      skill('shadow_veil', 'R', 'buff', 10, 16, 0, { name: '隠密', buff: 'stealth', seconds: 7, animation: 'dodge', effect: 'arcane' }),
    ]) }),
  archer: Object.freeze({ name: '弓使い', aliases: ['ranger'], role: 'rear',
    skills: Object.freeze([
      skill('long_shot', 'N', 'damage', 0, 2.5, 10, { name: '曲射', power: 14, animation: 'ranged', effect: 'arrow', projectile: 'ballistic' }),
      skill('twin_shot', 'R', 'damage', 10, 7, 10, { name: '二連射', power: 25, animation: 'ranged', effect: 'arrow', projectile: 'ballistic' }),
      skill('arrow_rain', 'UR', 'damage', 25, 18, 10, { name: '矢の雨', power: 35, radius: 3, animation: 'ranged', effect: 'arrow', projectile: 'ballistic' }),
    ]) }),
  mage: Object.freeze({ name: '魔法使い', aliases: ['wizard'], role: 'rear',
    skills: Object.freeze([
      skill('fire_bolt', 'N', 'damage', 8, 3.5, 10, { name: '火炎弾', power: 23, radius: 1, element: 'fire', burnSeconds: 4, structurePower: 15, animation: 'cast', effect: 'fire' }),
      skill('earth_spike', 'R', 'damage', 17, 9, 10, { name: '岩槍陣', power: 33, radius: 2, element: 'earth', structurePower: 30, animation: 'cast', effect: 'earth' }),
      skill('inferno', 'UR', 'damage', 38, 24, 10, { name: '業火大爆発', power: 65, radius: 4, element: 'fire', burnSeconds: 7, structurePower: 65, animation: 'cast', effect: 'fire' }),
    ]) }),
  priest: Object.freeze({ name: '僧侶', aliases: [], role: 'support',
    skills: Object.freeze([
      skill('heal', 'N', 'heal', 8, 4, 8, { name: '治癒', power: 25, animation: 'cast', effect: 'heal' }),
      skill('group_heal', 'R', 'heal', 18, 12, 8, { name: '範囲治癒', power: 22, radius: 3, animation: 'cast', effect: 'heal' }),
      skill('resurrection', 'UR', 'revive', 40, 30, 6, { name: '蘇生', hpPercent: .4, animation: 'cast', effect: 'nature' }),
    ]) }),
  summoner: Object.freeze({ name: '召喚士', aliases: [], role: 'support',
    skills: Object.freeze([
      skill('call_wolf', 'N', 'summon', 15, 16, 3, { name: '灰狼召喚', objectType: 'wolf', animation: 'cast', effect: 'nature' }),
      skill('call_wyvern', 'R', 'summon', 25, 24, 3, { name: '飛竜召喚', objectType: 'wyvern', animation: 'cast', effect: 'arcane' }),
      skill('call_dragon', 'UR', 'summon', 48, 50, 3, { name: '古竜召喚', objectType: 'dragon', animation: 'cast', effect: 'fire' }),
      skill('sacrifice_dragon', 'UR', 'sacrifice', 35, 50, 3, { name: '生贄・天竜降臨', objectType: 'elder_dragon', sacrificeCount: 1, animation: 'cast', effect: 'arcane' }),
    ]) }),
  lancer: Object.freeze({ name: '槍兵', aliases: [], role: 'front',
    skills: Object.freeze([
      skill('spear_thrust', 'N', 'damage', 0, 2.5, 3, { name: '突き', power: 18, animation: 'attack', effect: 'slash' }),
      skill('spear_sweep', 'R', 'damage', 12, 8, 3, { name: '薙ぎ払い', power: 26, radius: 2, animation: 'attack', effect: 'heavy' }),
      skill('spear_charge', 'UR', 'damage', 28, 18, 4, { name: '槍衾', power: 48, radius: 2, animation: 'attack', effect: 'heavy' }),
    ]) }),
});

/** Summons, mounts and timed explosives are world objects, never soldiers. */
export const COMBAT_OBJECT_SPECS = Object.freeze({
  wolf: Object.freeze({ name: '灰狼', category: 'summon', hp: 65, speed: 6.4, attack: 12, interval: 1.3, range: 1, radius: .7, flying: false, duration: 45 }),
  wyvern: Object.freeze({ name: '飛竜', category: 'summon', hp: 110, speed: 7.8, attack: 21, interval: 2, range: 3, radius: 1, flying: true, duration: 45 }),
  dragon: Object.freeze({ name: '古竜', category: 'summon', hp: 260, speed: 5.8, attack: 34, interval: 2.5, range: 4, radius: 2, flying: true, duration: 45 }),
  elder_dragon: Object.freeze({ name: '天竜', category: 'summon', hp: 390, speed: 7.2, attack: 52, interval: 3, range: 5, radius: 3, flying: true, duration: 30 }),
  horse: Object.freeze({ name: '軍馬', category: 'mount', hp: 150, speed: 8.6, attack: 0, interval: 0, range: 0, radius: .9, flying: false, duration: 240 }),
  trap: Object.freeze({ name: '爆薬罠', category: 'hazard', hp: 12, attack: 35, radius: 2, fuse: 5, flying: false, duration: 8 }),
  c4: Object.freeze({ name: 'C4爆薬', category: 'hazard', hp: 18, attack: 58, radius: 3, fuse: 8, flying: false, duration: 10 }),
  dynamite: Object.freeze({ name: '時限ダイナマイト', category: 'hazard', hp: 25, attack: 85, radius: 5, fuse: 60, flying: false, duration: 65 }),
});

const aliases = new Map();
for (const [id, job] of Object.entries(COMBAT_JOB_SPECS)) {
  for (const key of [id, job.name, ...job.aliases]) aliases.set(key, id);
}
export function combatJobId(value) { return aliases.get(String(value ?? '')) ?? null; }
export function availableCombatSkills(job, rarity = 'N') {
  const spec = COMBAT_JOB_SPECS[combatJobId(job)];
  return spec ? spec.skills.filter(s => RARITY_RANK[s.rank] <= (RARITY_RANK[rarity] ?? 0)) : [];
}
