// The simulation retains casualty records for scores, healing and replay.
// Only their render representations expire; dead soldiers never occupy tiles.
export const DEFAULT_CORPSE_LIFETIME = 60;
export const MAX_RENDERED_CORPSES = 100;
export const CORPSE_FADE_SECONDS = 8;

export function corpseOpacity(age, lifetime = DEFAULT_CORPSE_LIFETIME) {
  if (age < 0) return 1;
  if (lifetime === Infinity) return 1;
  if (!Number.isFinite(lifetime) || lifetime <= 0 || age >= lifetime) return 0;
  const fade = Math.min(CORPSE_FADE_SECONDS, lifetime / 3);
  return Math.min(1, Math.max(0, (lifetime - age) / fade));
}

export class BattleCorpsePolicy {
  constructor({ lifetime = DEFAULT_CORPSE_LIFETIME, maxBodies = MAX_RENDERED_CORPSES } = {}) {
    this.lifetime = lifetime;
    this.maxBodies = maxBodies;
    this._tick = null;
    this._visible = new Set();
  }

  setLifetime(seconds) {
    if (seconds !== Infinity && (!Number.isFinite(seconds) || seconds <= 0)) {
      throw new RangeError('死体表示時間は正の秒数または Infinity');
    }
    this.lifetime = seconds;
    this._tick = null;
  }

  visibleIds(units, time, tick = time) {
    // One O(n log n) selection per AI snapshot, never once per draw frame.
    if (this._tick === tick) return this._visible;
    this._tick = tick;
    const eligible = units.filter(unit => !unit.alive && unit.deathAt >= 0 &&
      corpseOpacity(Math.max(0, time - unit.deathAt), this.lifetime) > 0);
    eligible.sort((a, b) => b.deathAt - a.deathAt || a.id - b.id);
    this._visible = new Set(eligible.slice(0, this.maxBodies).map(unit => unit.id));
    return this._visible;
  }

  opacity(unit, time, visibleIds) {
    if (unit.alive) return 1;
    if (!visibleIds.has(unit.id)) return 0;
    return corpseOpacity(Math.max(0, time - unit.deathAt), this.lifetime);
  }
}
