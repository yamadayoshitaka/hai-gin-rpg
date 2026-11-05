import { BUFFS, TERRITORIES, accessible, squadCommanderId, reserveTroops } from './story-campaign.js';

export const STORY_BATTLE_REQUEST_KEY = 'hai-gin-story-sortie-v1';
export const STORY_BATTLE_RESULT_KEY = 'hai-gin-story-result-v1';
export const STORY_BATTLE_MAX_UNITS = 50;
export const STORY_SPAWN_LANES = ['north', 'center', 'south'];
export const STORY_SPAWN_LABELS = { north: '北の橋', center: '中央の橋', south: '南の橋' };
export const STORY_JOB_TO_BATTLE = {
  '騎士': '剣士', '盾騎士': '盾戦士', '忍者': '忍者', 'シーフ': '盗賊',
  '僧侶': '僧侶', '魔法使い': '魔法使い', '召喚士': '召喚士', '格闘家': '格闘家',
};

// For the current 50-person 3D renderer, distribute slots proportionally by
// squad size, while retaining each group's identity for casualties and spawn.
export function allocateSortieSlots(squads, limit = STORY_BATTLE_MAX_UNITS) {
  const eligible = squads.filter(s => Number.isInteger(s.count) && s.count > 0);
  const total = eligible.reduce((n, s) => n + s.count, 0);
  if (!total) return [];
  const target = Math.min(total, limit);
  const allocated = eligible.map(s => {
    const exact = s.count * target / total;
    return { squad: s, count: Math.floor(exact), remainder: exact % 1 };
  });
  let rest = target - allocated.reduce((n, a) => n + a.count, 0);
  const byRemainder = [...allocated].sort((a, b) => b.remainder - a.remainder || a.squad.id - b.squad.id);
  for (const item of byRemainder) {
    if (!rest) break;
    if (item.count < item.squad.count) { item.count++; rest--; }
  }
  return allocated.filter(a => a.count > 0);
}

export function createStoryBattleRequest(state, territoryId, { battleId = String(Date.now()), lanes = {} } = {}) {
  if (state.gameOver) throw new Error('この物語は終了しています。');
  const target = TERRITORIES.find(t => t.id === territoryId);
  if (!target || !['crimson', 'verdant'].includes(state.owners[territoryId]) || !accessible(state, territoryId))
    throw new Error('隣接する敵領地だけ攻撃できます。');
  const squads = state.squads.filter(s => squadCommanderId(s) !== 'reserve' && s.count > 0);
  const allotment = allocateSortieSlots(squads);
  if (!allotment.length) throw new Error('出撃できる兵士がいません。予備兵を軍師へ配属してください。');
  const leaders = [{ id: 'player', ...state.commander }, ...state.commanders];
  const activeIds = new Set(allotment.map(a => String(squadCommanderId(a.squad))));
  const commanders = leaders.filter(c => activeIds.has(String(c.id))).map(c => ({
    id: String(c.id), name: c.name, level: c.level,
    orders: BUFFS.filter(b => b.unlock <= c.level).map(b => ({ ...b })),
  }));
  const units = allotment.flatMap(({ squad, count }, i) => {
    const selectedLane = lanes[squad.id];
    const lane = STORY_SPAWN_LANES.includes(selectedLane) ? selectedLane : STORY_SPAWN_LANES[i % STORY_SPAWN_LANES.length];
    return Array.from({ length: count }, () => ({
      squadId: squad.id, commanderId: String(squadCommanderId(squad)),
      job: STORY_JOB_TO_BATTLE[squad.job] || '剣士', rarity: squad.rarity, spawnLane: lane,
    }));
  });
  return { version: 1, battleId: String(battleId), territoryId,
    territoryName: target.name, terrain: target.terrain,
    enemyName: state.owners[territoryId] === 'crimson' ? '紅炎軍' : '翠嵐軍',
    enemyCount: Math.min(50, Math.max(10, Math.ceil((state.garrisons[territoryId] || 150) / 4))),
    units, commanders, totalReserves: reserveTroops(state),
  };
}
