// 兵数に依存する描画処理を持たない、大規模戦闘の軽量シミュレーター。
export const JOBS = Object.freeze([
  { id: 'sword', name: '剣士', color: 0x4778c5, hp: 108, speed: 2.65, range: 1.9, damage: 25, interval: 1.0, weapon: 'sword' },
  { id: 'shield', name: '盾戦士', color: 0x7e88a4, hp: 300, speed: 1.65, range: 1.7, damage: 7, interval: 1.4, weapon: 'shield' },
  { id: 'fighter', name: '格闘家', color: 0xc46e42, hp: 205, speed: 3.1, range: 1.5, damage: 37, interval: 0.8, weapon: 'fist' },
  { id: 'ninja', name: '忍者', color: 0x53546a, hp: 80, speed: 3.7, range: 2.0, damage: 14, interval: 0.8, weapon: 'dagger' },
  { id: 'thief', name: '盗賊', color: 0x528469, hp: 95, speed: 3.25, range: 1.9, damage: 10, interval: 0.9, weapon: 'dagger' },
  { id: 'archer', name: '弓使い', color: 0x8d743a, hp: 85, speed: 2.45, range: 12, damage: 10, interval: 1.55, weapon: 'bow' },
  { id: 'mage', name: '魔法使い', color: 0x8156ad, hp: 75, speed: 2.2, range: 11, damage: 18, interval: 2.1, weapon: 'staff' },
  { id: 'priest', name: '僧侶', color: 0xe3dac7, hp: 95, speed: 2.3, range: 8, damage: 8, interval: 1.45, weapon: 'staff' },
  { id: 'summoner', name: '召喚士', color: 0x6986ab, hp: 45, speed: 2.15, range: 10, damage: 3, interval: 2.6, weapon: 'staff' },
  { id: 'lancer', name: '槍兵', color: 0xb55c60, hp: 120, speed: 2.45, range: 2.6, damage: 14, interval: 1.25, weapon: 'spear' }
]);

export const BRIDGE_Z = Object.freeze([-42, 0, 42]);
export const BRIDGE_HALF_WIDTH = 14;
const CELL = 1.12;
const SECTOR = 4;

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gridKey = (x, z, size) => `${Math.round(x / size)}:${Math.round(z / size)}`;
const sectorKey = (x, z) => `${Math.floor(x / SECTOR)}:${Math.floor(z / SECTOR)}`;

export function isWalkable(x, z, bridges = BRIDGE_Z) {
  if (Math.abs(x) > 4.5) return true;
  return bridges.some(bridge => Math.abs(z - bridge) < BRIDGE_HALF_WIDTH);
}

export class MassBattleSimulation {
  constructor(sideCount = 200, seed = 12345, options = {}) {
    if (!Number.isInteger(sideCount) || sideCount < 1 || sideCount > 1000) {
      throw new RangeError('sideCount は 1～1000 にしてください');
    }
    this.sideCount = sideCount;
    this.seed = seed;
    this.bridges = options.bridges || BRIDGE_Z;
    if (!this.bridges.length) throw new RangeError('橋がありません');
    this.strategy = 'balanced';
    this.time = 0;
    this.tickCount = 0;
    this.attacks = 0;
    this.lastAiMs = 0;
    this.units = [];
    const rnd = randomGenerator(seed);
    // 職業はチーム内で均等に混ぜ、同じシードなら再現可能。
    for (let team = 0; team < 2; team++) {
      for (let n = 0; n < sideCount; n++) {
        const bridgeIndex = n % this.bridges.length;
        const rank = Math.floor(n / this.bridges.length);
        const col = Math.floor(rank / 15);
        const row = rank % 15;
        const jobIndex = (n * 7 + team * 3) % JOBS.length;
        const job = JOBS[jobIndex];
        const x = (team === 0 ? -1 : 1) * (16 + col * 1.75);
        const z = this.bridges[bridgeIndex] + (row - 7) * 1.72;
        this.units.push({
          id: team * sideCount + n, team, jobIndex, male: rnd() > 0.48,
          x, z, y: 0, bridgeIndex, hp: job.hp, maxHp: job.hp,
          alive: true, cooldown: rnd() * job.interval, phase: rnd() * 6.28,
          vx: 0, vz: 0, hitFlash: 0, action: 'advance'
        });
      }
    }
    this.live = [sideCount, sideCount];
  }

  step(dt = 0.1) {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    dt = Math.min(Math.max(dt, 0), 0.2);
    this.time += dt;
    this.tickCount++;
    const occupancy = new Map();
    const sectors = new Map();
    for (const unit of this.units) {
      if (!unit.alive) continue;
      occupancy.set(gridKey(unit.x, unit.z, CELL), unit.id);
      const key = sectorKey(unit.x, unit.z);
      if (!sectors.has(key)) sectors.set(key, []);
      sectors.get(key).push(unit);
    }

    for (const unit of this.units) {
      if (!unit.alive) continue;
      const job = JOBS[unit.jobIndex];
      unit.cooldown = Math.max(-0.1, unit.cooldown - dt);
      unit.hitFlash = Math.max(0, unit.hitFlash - dt);
      const sectorX = Math.floor(unit.x / SECTOR);
      const sectorZ = Math.floor(unit.z / SECTOR);
      const searchRadius = Math.ceil((job.range + 3) / SECTOR);
      let nearest = null;
      let bestSq = (job.range + 3) ** 2;
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dz = -searchRadius; dz <= searchRadius; dz++) {
          const group = sectors.get(`${sectorX + dx}:${sectorZ + dz}`);
          if (!group) continue;
          for (const other of group) {
            if (!other.alive || other.team === unit.team) continue;
            const distSq = (other.x - unit.x) ** 2 + (other.z - unit.z) ** 2;
            if (distSq < bestSq) { bestSq = distSq; nearest = other; }
          }
        }
      }

      if (nearest && bestSq <= job.range ** 2) {
        unit.vx = 0; unit.vz = 0;
        unit.action = 'attack';
        if (unit.cooldown <= 0) {
          unit.cooldown += job.interval;
          nearest.hp -= job.damage;
          nearest.hitFlash = 0.22;
          this.attacks++;
          if (nearest.hp <= 0) {
            nearest.hp = 0; nearest.alive = false;
            this.live[nearest.team]--;
            occupancy.delete(gridKey(nearest.x, nearest.z, CELL));
          }
        }
        continue;
      }

      // 遠距離職は近くの敵を追跡。それ以外は対応する橋を渡って進軍する。
      const dir = unit.team === 0 ? 1 : -1;
      let goalX = dir * 24;
      let goalZ = this.bridges[unit.bridgeIndex];
      if (nearest) { goalX = nearest.x; goalZ = nearest.z; }
      else if (unit.x * dir > 5.5) { goalX = dir * 72; goalZ = unit.z; }
      const dx = goalX - unit.x;
      const dz = goalZ - unit.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.12) { unit.vx = 0; unit.vz = 0; continue; }
      const strategy = unit.team === 0 ? (unit.order || this.strategy) : 'balanced';
      if (strategy === 'retreat') { goalX = -82; goalZ = unit.z; }
      if (strategy === 'hold' && !nearest) { unit.vx = 0; unit.vz = 0; continue; }
      if (strategy === 'defend' && unit.team === 0 && unit.x >= -12 && !nearest) {
        unit.vx = 0; unit.vz = 0; continue;
      }
      const advance = job.speed * dt * (strategy === 'charge' ? 1.3 : strategy === 'defend' ? .65 : 1);
      const ux = dx / len, uz = dz / len;
      const oldKey = gridKey(unit.x, unit.z, CELL);
      const detour = unit.id % 2 === 0 ? 1 : -1;
      const attempts = [
        [ux, uz], [ux * 0.85 - uz * detour * 0.53, uz * 0.85 + ux * detour * 0.53],
        [ux * 0.85 + uz * detour * 0.53, uz * 0.85 - ux * detour * 0.53]
      ];
      let moved = false;
      for (const [sx, sz] of attempts) {
        const nextX = unit.x + sx * advance, nextZ = unit.z + sz * advance;
        if (!isWalkable(nextX, nextZ, this.bridges) || Math.abs(nextX) > 95 || Math.abs(nextZ) > 82) continue;
        const nextKey = gridKey(nextX, nextZ, CELL);
        if (nextKey !== oldKey && occupancy.has(nextKey)) continue;
        occupancy.delete(oldKey);
        occupancy.set(nextKey, unit.id);
        unit.x = nextX; unit.z = nextZ;
        unit.vx = sx * job.speed; unit.vz = sz * job.speed;
        unit.phase += advance * 3.7;
        unit.action = 'walk';
        moved = true;
        break;
      }
      if (!moved) { unit.vx = 0; unit.vz = 0; unit.action = 'blocked'; }
    }
    this.lastAiMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    return this.live;
  }

  getStats() {
    return { sideCount: this.sideCount, alive: this.live.slice(), total: this.units.length,
      attacks: this.attacks, time: this.time, tickCount: this.tickCount, aiMs: this.lastAiMs };
  }
}
