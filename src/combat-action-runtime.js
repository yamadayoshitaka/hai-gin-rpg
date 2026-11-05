/** Deterministic, renderer-independent job actions and battlefield objects. */
import { COMBAT_OBJECT_SPECS, COMBAT_RULES, availableCombatSkills, combatJobId } from './combat-action-spec.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const isAlive = u => u?.alive !== false && (u?.hp ?? 0) > 0;
// Story sorties may have sparse soldier IDs, while mass battle IDs are dense.
const unitById = (units, id) => units?.[id]?.id === id ? units[id] : units?.find(u => u.id === id);

export class CombatActionRuntime {
  constructor({ width = 232, height = 232, walkable = null } = {}) {
    this.width = width; this.height = height; this.walkable = walkable;
    this.objects = [];
    this.events = [];
    this.nextObjectId = 1;
    this.time = 0;
    this.castCount = 0;
    this.objectDamage = 0;
    this._sectors = new Map();
    this._occupancy = null;
    this.onDeath = null;
    this.onRevive = null;
    this.onRelocate = null;
    this.onNavigationChange = null;
  }

  /** Register a map building/door/bridge once, with its real collision cell. */
  registerStructure({ id, x, z, type = 'building', hp = 120, lockLevel = 0, walkableWhenOpened = true }) {
    if (!Number.isInteger(x) || !Number.isInteger(z)) throw Error('建物座標はマス単位で指定してください');
    if (this.objects.some(o => o.id === id)) throw Error('オブジェクトID重複: ' + id);
    const o = { id, x, z, type, category: 'structure', team: -1, hp, maxHp: hp,
      lockLevel, locked: lockLevel > 0, opened: false, alive: true, walkableWhenOpened,
      blocking: true, height: 0, createdAt: this.time, expiresAt: Infinity };
    this.objects.push(o); return o;
  }

  beginTick(dt, units, { occupancy = null, sectors = null, walkable = null } = {}) {
    this.time += dt;
    this.events.length = 0;
    this._occupancy = occupancy;
    this._units = units;
    this._sectors = sectors ?? new Map();
    if (walkable) this.walkable = walkable;
    for (const u of units) {
      if (!isAlive(u)) continue;
      if (u.mountId && !this.objects.some(o => o.alive && o.id === u.mountId && o.mountedBy === u.id)) u.mountId = null;
      u.mp ??= COMBAT_RULES.maxMp;
      u.maxMp ??= COMBAT_RULES.maxMp;
      u.rarity ??= 'N';
      u.mp = Math.min(u.maxMp, u.mp + COMBAT_RULES.mpRecoveryPerSecond * dt);
      if ((u.burningUntil || 0) > this.time) {
        u.burnAccum = (u.burnAccum || 0) + dt;
        if (u.burnAccum >= 1) { u.burnAccum -= 1; this.damageUnit(u, 3, null, 'fire'); }
      }
    }
    // Existing objects are updated independently of all soldier animation.
    for (const o of this.objects) {
      if (!o.alive) continue;
      if (o.category === 'mount') {
        const rider = unitById(units, o.mountedBy);
        if (rider && isAlive(rider)) { o.x = rider.x; o.z = rider.z; }
        else if (o.mountedBy != null) o.mountedBy = null;
      }
      if (o.category === 'hazard' && this.time >= o.expiresAt - (o.spec.duration - o.spec.fuse)) this.explode(o, units);
      else if (this.time >= o.expiresAt) this.removeObject(o, 'expire');
    }
    // All objects share the normal occupancy map; mounted horses are the one
    // exception because the rider and mount must occupy the same world cell.
    if (occupancy) for (const o of this.objects) {
      if (o.alive && o.blocking && o.mountedBy == null && this.inside(o.x, o.z)) {
        const i = o.z * this.width + o.x;
        if (occupancy[i] === -1) occupancy[i] = -2;
      }
    }
    this.tickSummons(dt, units);
    if (this.objects.length > 180) for (let i = this.objects.length - 1; i >= 0; i--)
      if (!this.objects[i].alive && this.time - (this.objects[i].removedAt || 0) > 1) this.objects.splice(i, 1);
  }

  inside(x, z) { return x >= 0 && z >= 0 && x < this.width && z < this.height; }
  free(x, z, flying = false) {
    if (!this.inside(x, z)) return false;
    const i = z * this.width + x;
    return (flying || !this.walkable || this.walkable[i] === 1) &&
      (flying || !this._occupancy || this._occupancy[i] === -1);
  }
  event(type, data) {
    if (this.events.length < 256) this.events.push({ type, time: this.time, ...data });
  }
  damageUnit(target, amount, attacker, element = 'physical') {
    if (target?.category) return this.damageObject(target, amount, attacker, element);
    if (!isAlive(target)) return 0;
    // Commander orders are modifiers on the same hit pipeline used by skills
    // and normal attacks; status effects are applied after the order bonus.
    let damage = amount > 0 ? Math.max(1, Math.round(amount *
      (1 + (attacker?.attackBonus || 0)) * (1 - (target.defenseBonus || 0)))) : 0;
    if ((target.fireWardUntil || 0) > this.time && element === 'fire') damage = 0;
    if ((target.guardUntil || 0) > this.time) damage *= .45;
    if ((target.absorbUntil || 0) > this.time) { target.hp = Math.min(target.maxHp, target.hp + damage * .25); damage *= .5; }
    damage = Math.max(0, Math.round(damage));
    target.hp = Math.max(0, target.hp - damage);
    target.hitFlash = .22;
    if (attacker && (target.reflectUntil || 0) > this.time && isAlive(attacker) && attacker !== target) {
      attacker.hp = Math.max(0, attacker.hp - Math.round(damage * .3));
      if (attacker.hp === 0) { if (this.onDeath) this.onDeath(attacker); else attacker.alive = false; }
    }
    if (target.hp === 0) {
      if (this.onDeath) this.onDeath(target);
      else target.alive = false;
      this.event('death', { targetId: target.id, team: target.team, x: target.x, z: target.z });
    }
    return damage;
  }
  damageObject(o, amount, attacker = null, element = 'physical') {
    if (!o?.alive || o.category === 'structure' && o.opened) return 0;
    const damage = Math.max(0, Math.round(amount * (1 + (attacker?.attackBonus || 0))));
    o.hp = Math.max(0, o.hp - damage);
    this.event('objectHit', { objectId: o.id, x: o.x, z: o.z, damage, effect: element });
    if (!o.hp) {
      this.removeObject(o, 'defeated');
      if (o.category === 'structure') this.openNavigationCell(o);
    }
    return damage;
  }
  removeObject(o, reason = 'expire') {
    if (!o.alive) return;
    o.alive = false; o.removedAt = this.time;
    if (o.category === 'mount' && o.mountedBy != null) {
      const rider = unitById(this._units, o.mountedBy);
      if (rider?.mountId === o.id) rider.mountId = null;
      o.mountedBy = null;
    }
    this.event('despawn', { objectId: o.id, objectType: o.type, reason, x: o.x, z: o.z });
  }
  openNavigationCell(o) {
    if (!this.walkable || !o.walkableWhenOpened || !this.inside(o.x,o.z)) return;
    this.walkable[o.z * this.width + o.x] = 1;
    this.onNavigationChange?.(o);
  }
  spawnObject(type, owner, x = owner.x, z = owner.z, { mounted = false } = {}) {
    const spec = COMBAT_OBJECT_SPECS[type];
    if (!spec || !isAlive(owner)) return null;
    const sideObjects = this.objects.filter(o => o.alive && o.team === owner.team && o.category !== 'structure');
    if (sideObjects.length >= COMBAT_RULES.maximumObjectsPerTeam) return null;
    if (spec.category === 'summon' && this.objects.filter(o => o.alive && o.category === 'summon' && o.ownerId === owner.id).length >= COMBAT_RULES.maximumSummonsPerCaster) return null;
    let at = { x, z };
    if (!mounted) {
      const candidates = [[1,0],[0,1],[-1,0],[0,-1],[2,0],[0,2],[-2,0],[0,-2]];
      const found = candidates.map(([dx,dz]) => ({ x: x + dx, z: z + dz })).find(p => this.free(p.x, p.z, spec.flying));
      if (!found) return null;
      at = found;
    }
    const o = { id: 'battle-object-' + this.nextObjectId++, type, category: spec.category, spec,
      team: owner.team, ownerId: owner.id, x: at.x, z: at.z, hp: spec.hp, maxHp: spec.hp,
      alive: true, blocking: !spec.flying && !mounted, flying: !!spec.flying,
      createdAt: this.time, expiresAt: this.time + spec.duration, nextAttackAt: this.time + .5,
      mountedBy: mounted ? owner.id : null, height: spec.flying ? 3 : 0 };
    this.objects.push(o);
    if (mounted) owner.mountId = o.id;
    if (this._occupancy && o.blocking) this._occupancy[o.z * this.width + o.x] = -2;
    this.event('spawn', { objectId: o.id, objectType: type, ownerId: owner.id, team: owner.team, x: o.x, z: o.z, flying: o.flying });
    return o;
  }
  summonOf(owner) { return this.objects.filter(o => o.alive && o.category === 'summon' && o.ownerId === owner.id); }
  nearby(team, x, z, range, { includeDead = false } = {}) {
    const out = [];
    // Spatial index can be supplied by the mass simulation. Dead combatants
    // are scanned separately for rare resurrection, never every AI frame.
    const sector = 5, span = Math.ceil(range / sector), cx = Math.floor(x / sector), cz = Math.floor(z / sector);
    for (let dx = -span; dx <= span; dx++) for (let dz = -span; dz <= span; dz++) {
      const group = this._sectors.get((cx + dx) + ':' + (cz + dz));
      if (!group) continue;
      for (const u of group) {
        if (u.team !== team || (!includeDead && !isAlive(u))) continue;
        if (Math.abs(u.x - x) <= range && Math.abs(u.z - z) <= range && distance(u, {x,z}) <= range) out.push(u);
      }
    }
    return out;
  }
  fireSkill(actor, skill, target, units) {
    if (!isAlive(actor) || actor.mp < skill.mp) return false;
    if (skill.mountedOnly && !actor.mountId) return false;
    const targetPos = target || actor;
    if (skill.range > 0 && distance(actor, targetPos) > skill.range) return false;
    const cast = () => { actor.mp -= skill.mp; actor._skillNext ??= {}; actor._skillNext[skill.id] = this.time + skill.cooldown;
      actor.action = 'skill'; actor.skillId = skill.id; actor.attackElapsed = 0;
      actor.skillPoseUntil = this.time + (skill.animation === 'cast' ? .85 : .55);
      this.castCount++;
      this.event('skill', { skillId: skill.id, jobId: combatJobId(actor.jobId || actor.jobName || actor.job?.id || actor.job?.name),
        sourceId: actor.id, team: actor.team, x: actor.x, z: actor.z,
        targetX: targetPos.x, targetZ: targetPos.z, effect: skill.effect, animation: skill.animation }); };
    if (skill.kind === 'damage' && isAlive(target) && target.team !== actor.team) {
      const victims = skill.radius ? [
        ...this.nearby(1 - actor.team, target.x, target.z, skill.radius),
        ...this.objects.filter(o => o.alive && o.team !== actor.team &&
          (o.category === 'summon' || o.category === 'mount') && distance(o, target) <= skill.radius),
      ] : [target];
      if (!victims.length) return false;
      cast();
      for (const u of victims) {
        this.damageUnit(u, skill.power, actor, skill.element || 'physical');
        if (skill.burnSeconds && isAlive(u)) u.burningUntil = this.time + skill.burnSeconds;
      }
      if (skill.structurePower) this.damageStructures(target.x, target.z, skill.radius || 1, skill.structurePower, skill.element);
      return true;
    }
    if (skill.kind === 'buff') {
      if (skill.buff === 'guard') actor.guardUntil = this.time + skill.seconds;
      else if (skill.buff === 'fireWard') actor.fireWardUntil = this.time + skill.seconds;
      else if (skill.buff === 'stealth') actor.stealthUntil = this.time + skill.seconds;
      else if (skill.buff === 'reflect') { actor.reflectUntil = this.time + skill.seconds; actor.absorbUntil = this.time + skill.seconds; }
      cast(); return true;
    }
    if (skill.kind === 'restore' && (actor.hp < actor.maxHp || actor.mp < actor.maxMp - skill.mpRestore)) {
      cast(); actor.hp = Math.min(actor.maxHp, actor.hp + skill.hp); actor.mp = Math.min(actor.maxMp, actor.mp + skill.mpRestore); return true;
    }
    if (skill.kind === 'heal' && isAlive(target) && target.team === actor.team && target.hp < target.maxHp) {
      const friends = skill.radius ? this.nearby(actor.team, target.x, target.z, skill.radius) : [target];
      if (!friends.length) return false;
      cast(); for (const u of friends) u.hp = Math.min(u.maxHp, u.hp + skill.power); return true;
    }
    if (skill.kind === 'revive' && target && target.team === actor.team && !isAlive(target) && distance(actor, target) <= skill.range) {
      const previousHp = target.hp, previousAlive = target.alive;
      target.hp = Math.max(1, Math.ceil(target.maxHp * skill.hpPercent)); target.alive = true;
      if (this.onRevive && !this.onRevive(target)) {
        target.hp = previousHp; target.alive = previousAlive; return false;
      }
      cast();
      this.event('revive', { targetId: target.id, x: target.x, z: target.z, team: target.team }); return true;
    }
    if (skill.kind === 'summon' || skill.kind === 'mount') {
      if (skill.kind === 'mount' && actor.mountId) return false;
      const o = this.spawnObject(skill.objectType, actor, actor.x, actor.z, { mounted: skill.kind === 'mount' });
      if (!o) return false;
      cast(); return true;
    }
    if (skill.kind === 'sacrifice') {
      const sacrifices = this.summonOf(actor).slice(0, skill.sacrificeCount);
      if (sacrifices.length < skill.sacrificeCount) return false;
      // Replacement is atomic: allocate a slot only after freeing sacrifices.
      for (const o of sacrifices) this.removeObject(o, 'sacrifice');
      const summoned = this.spawnObject(skill.objectType, actor, actor.x, actor.z);
      if (!summoned) { for (const o of sacrifices) o.alive = true; return false; }
      cast(); return true;
    }
    if (skill.kind === 'place') {
      const o = this.spawnObject(skill.objectType, actor, targetPos.x, targetPos.z);
      if (!o) return false;
      cast(); return true;
    }
    if (skill.kind === 'unlock') {
      const door = this.objects.find(o => o.alive && o.category === 'structure' && o.locked && o.lockLevel <= skill.lockLevel && distance(o, actor) <= skill.range);
      if (!door) return false;
      cast(); door.locked = false; door.opened = true; door.blocking = !door.walkableWhenOpened;
      this.openNavigationCell(door);
      this.event('unlock', { objectId: door.id, x: door.x, z: door.z, lockLevel: door.lockLevel }); return true;
    }
    if (skill.kind === 'mobility' && target && distance(actor, target) <= skill.range) {
      const dx = Math.sign(target.x - actor.x), dz = Math.sign(target.z - actor.z);
      for (let n = skill.tiles; n >= 1; n--) {
        const x = actor.x + dx * n, z = actor.z + dz * n;
        if (!this.free(x, z)) continue;
        if (this.onRelocate && !this.onRelocate(actor, x, z)) continue;
        actor.x = x; actor.z = z; cast(); return true;
      }
    }
    return false;
  }

  /** Shared AI entry point; a successful cast replaces an ordinary attack. */
  tryAutoAction(actor, enemy, units) {
    if (!isAlive(actor) || (actor.cooldown || 0) > 0) return false;
    const jobId = combatJobId(actor.jobId || actor.jobName || actor.job?.id || actor.job?.name);
    if (!jobId) return false;
    const skills = availableCombatSkills(jobId, actor.rarity).slice().reverse();
    const ready = s => actor.mp >= s.mp && (!actor._skillNext || (actor._skillNext[s.id] || 0) <= this.time);
    const wounded = jobId === 'priest' ? this.nearby(actor.team, actor.x, actor.z, 8).filter(u => u.hp < u.maxHp).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp)[0] : null;
    const fallen = jobId === 'priest' && actor.rarity === 'UR' && Math.floor(this.time * 10) % 30 === 0
      ? units.find(u => u.team === actor.team && !isAlive(u) && distance(actor, u) <= 6 && u.hp === 0) : null;
    for (const s of skills) {
      if (!ready(s)) continue;
      let target = enemy;
      if (s.kind === 'heal') target = wounded;
      if (s.kind === 'revive') target = fallen;
      if (s.kind === 'restore') target = actor;
      if (['mount','summon','sacrifice','buff','unlock'].includes(s.kind)) target = actor;
      if (s.kind === 'place' && !enemy) continue;
      if (s.kind === 'damage' && (!enemy || distance(actor, enemy) > s.range)) continue;
      if (s.kind === 'mobility' && (!enemy || distance(actor, enemy) <= 2)) continue;
      if (this.fireSkill(actor, s, target, units)) return true;
    }
    return false;
  }

  damageStructures(x, z, radius, power, element) {
    for (const o of this.objects) {
      if (!o.alive || o.category !== 'structure' || distance(o, {x,z}) > radius) continue;
      o.hp = Math.max(0, o.hp - power); this.objectDamage += power;
      this.event('structureHit', { objectId: o.id, x: o.x, z: o.z, effect: element, hp: o.hp });
      if (o.hp === 0) { o.blocking = false; this.removeObject(o, 'destroyed'); this.openNavigationCell(o); }
    }
  }
  explode(o, units) {
    if (!o.alive) return;
    const victims = units.filter(u => isAlive(u) && distance(u, o) <= o.spec.radius &&
      (COMBAT_RULES.blastFriendlyFire || u.team !== o.team));
    for (const u of victims) this.damageUnit(u, o.spec.attack, null, 'fire');
    this.damageStructures(o.x, o.z, o.spec.radius, o.spec.attack, 'fire');
    this.event('explode', { objectId: o.id, objectType: o.type, x: o.x, z: o.z, radius: o.spec.radius, effect: 'fire' });
    this.removeObject(o, 'exploded');
  }

  tickSummons(dt, units) {
    for (const o of this.objects) {
      if (!o.alive || o.category !== 'summon') continue;
      let target = null, best = (COMBAT_RULES.summonLeashTiles + o.spec.range) ** 2;
      for (const u of this.nearby(1 - o.team, o.x, o.z, COMBAT_RULES.summonLeashTiles + o.spec.range)) {
        if (!isAlive(u) || (u.stealthUntil || 0) > this.time) continue;
        const d = (u.x - o.x) ** 2 + (u.z - o.z) ** 2;
        if (d < best) { target = u; best = d; }
      }
      if (!target) continue;
      if (best <= o.spec.range ** 2) {
        if (this.time >= o.nextAttackAt) {
          this.damageUnit(target, o.spec.attack, null, o.type.includes('dragon') ? 'fire' : 'physical');
          o.nextAttackAt = this.time + o.spec.interval;
          this.event('objectAttack', { objectId: o.id, objectType: o.type, x: o.x, z: o.z, targetX: target.x, targetZ: target.z, effect: o.flying ? 'fire' : 'slash' });
        }
      } else {
        const dx = Math.sign(target.x - o.x), dz = Math.sign(target.z - o.z);
        const candidates = Math.abs(target.x - o.x) > Math.abs(target.z - o.z) ? [[dx,0],[0,dz]] : [[0,dz],[dx,0]];
        o.moveAccum = (o.moveAccum || 0) + dt * o.spec.speed;
        if (o.moveAccum < 1) continue;
        for (const [ax,az] of candidates) {
          if ((!ax && !az) || !this.free(o.x + ax, o.z + az, o.flying)) continue;
          if (!o.flying && this._occupancy) this._occupancy[o.z * this.width + o.x] = -1;
          o.x += ax; o.z += az; o.moveAccum -= 1;
          if (!o.flying && this._occupancy) this._occupancy[o.z * this.width + o.x] = -2;
          break;
        }
      }
    }
  }
  getStats() { return { casts: this.castCount, activeObjects: this.objects.filter(o => o.alive).length,
    summons: this.objects.filter(o => o.alive && o.category === 'summon').length,
    mounts: this.objects.filter(o => o.alive && o.category === 'mount').length,
    objectDamage: this.objectDamage }; }
}
