/** Deterministic, renderer-independent job actions and battlefield objects. */
import { COMBAT_OBJECT_SPECS, COMBAT_RULES, availableCombatSkills, combatJobId } from './combat-action-spec.js?v=4.4.74';
import { elevatedRangedStats } from './elevation-combat.js';
import { CREATURE_PERFORMANCE, FLYING_CREATURE_ATTACK_RATE, mountableCreature } from './combat-creature-performance.js?v=4.4.74';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Closest distance to an actual footprint, not merely its centre tile. */
const structureDistance = (o,x,z) => o.bounds ? Math.hypot(
  Math.max(o.bounds.minX-x,0,x-o.bounds.maxX),
  Math.max(o.bounds.minZ-z,0,z-o.bounds.maxZ)) : distance(o,{x,z});
const isAlive = u => u?.alive !== false && (u?.hp ?? 0) > 0;
// Story sorties may have sparse soldier IDs, while mass battle IDs are dense.
const unitById = (units, id) => units?.[id]?.id === id ? units[id] : units?.find(u => u.id === id);

export class CombatActionRuntime {
  constructor({ width = 232, height = 232, walkable = null } = {}) {
    this.width = width; this.height = height; this.walkable = walkable;
    this.objects = [];
    this.events = [];
    this._unitHitEvents = 0;
    this._unitHitSlots = [];
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
  registerStructure({ id, x, z, type = 'building', hp = 120, lockLevel = 0,
    walkableWhenOpened = true, bounds = null, blocking = true,
    height = 0,
    fireDamagePerSecond = 8, burnSeconds = 30 }) {
    if (!Number.isInteger(x) || !Number.isInteger(z)) throw Error('建物座標はマス単位で指定してください');
    if (this.objects.some(o => o.id === id)) throw Error('オブジェクトID重複: ' + id);
    if (bounds && (!['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(bounds[k])) ||
      bounds.minX>bounds.maxX || bounds.minZ>bounds.maxZ)) throw Error('建物の占有範囲が不正です');
    const o = { id, x, z, type, category: 'structure', team: -1, hp, maxHp: hp,
      lockLevel, locked: lockLevel > 0, opened: false, alive: true, walkableWhenOpened,
      bounds, blocking, fireDamagePerSecond, burnSeconds, burningUntil: 0,
      burnStartedAt: 0, burnAccumulator: 0,
      height: Math.max(0,height), createdAt: this.time, expiresAt: Infinity };
    this.objects.push(o); return o;
  }

  beginTick(dt, units, { occupancy = null, sectors = null, walkable = null } = {}) {
    this.time += dt;
    this.events.length = 0;
    this._unitHitEvents = 0;
    this._unitHitSlots = [];
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
      if (o.category === 'structure') {
        if (o.burningUntil > 0) {
          const activeSeconds = Math.max(0, Math.min(this.time, o.burningUntil) -
            Math.max(this.time - dt, o.burnStartedAt));
          o.burnAccumulator += activeSeconds;
          const seconds = Math.floor(o.burnAccumulator);
          if (seconds > 0) {
            o.burnAccumulator -= seconds;
            this.hitStructure(o, seconds * o.fireDamagePerSecond, 'fire');
          }
          if (o.alive && this.time >= o.burningUntil) {
            o.burningUntil = 0; o.burnAccumulator = 0;
            this.event('structureFireEnded', { objectId:o.id });
          }
        }
        continue;
      }
      if (o.mountedBy != null && mountableCreature(o)) {
        const rider = unitById(units, o.mountedBy);
        if (rider && isAlive(rider)) { o.x = rider.x; o.z = rider.z; }
        else {
          o.mountedBy = null;
          o.blocking = !o.flying;
        }
      }
      if (o.category === 'hazard' && this.time >= o.expiresAt - (o.spec.duration - o.spec.fuse)) this.explode(o, units);
      else if (this.time >= o.expiresAt) this.removeObject(o, 'expire');
    }
    // Riders and their creatures share a cell; neither becomes an extra unit.
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

  /** Flying summons share a separate air lane, independent of ground walls. */
  airspaceClear(source,x,z){
    if(!this.inside(x,z))return false;
    return !this.objects.some(other=>other!==source&&other.alive&&other.flying&&
      Math.abs(other.x-x)<=1&&Math.abs(other.z-z)<=1&&
      Math.abs((other.height||3)-(source.height||3))<2);
  }
  flightRoofHeight(x,z){
    let roof=2.6;
    for(const o of this.objects){
      if(!o.alive||o.category!=='structure'||o.type!=='building'||!o.bounds)continue;
      if(x>=o.bounds.minX-1&&x<=o.bounds.maxX+1&&
        z>=o.bounds.minZ-1&&z<=o.bounds.maxZ+1)roof=Math.max(roof,o.height+1.5);
    }
    return roof;
  }
  event(type, data) {
    const entry={type,time:this.time,...data};
    if(this.events.length<256){this.events.push(entry);return;}
    // In a 2,000-soldier battle cosmetic events can fill the budget. Never
    // lose a structural collapse: it must also clear world collision and AI.
    if(type.startsWith('structure')||(type==='despawn'&&data.reason==='destroyed')){
      const index=this.events.findIndex(e=>!e.type.startsWith('structure')&&
        !(e.type==='despawn'&&e.reason==='destroyed'));
      if(index>=0)this.events[index]=entry;
    }
  }
  damageUnit(target, amount, attacker, element = 'physical', linked = false) {
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
    // Every real HP loss is eligible for visual feedback. A deterministic
    // reservoir spreads the 112 bounded hit events across BOTH armies, rather
    // than discarding all distant/later IDs or sampling only 1 in 5 attacks.
    // This leaves at least 144 of the 256 event slots for skills/structures.
    if(damage>0){
      const seen=++this._unitHitEvents,budget=112;
      const payload={targetId:target.id,sourceId:attacker?.id??null,
        team:target.team,x:target.x,z:target.z,sourceX:attacker?.x,sourceZ:attacker?.z,
        damage,effect:element,remainingHp:target.hp,maxHp:target.maxHp};
      if(this._unitHitSlots.length<budget){
        const index=this.events.length;
        this.event('unitHit',payload);
        if(this.events.length>index)this._unitHitSlots.push(index);
      }else{
        const hash=(Math.imul((Number(target.id)||seen)+1,0x9e3779b1)+
          Math.imul(seen,0x85ebca6b)+Math.floor(this.time*1000))>>>0;
        const chosen=hash%seen;
        if(chosen<budget){
          const index=this._unitHitSlots[chosen];
          // A later structure-collapse event may have replaced this slot.
          if(this.events[index]?.type==='unitHit')
            this.events[index]={type:'unitHit',time:this.time,...payload};
        }
      }
    }
    if (!linked && damage > 0 && combatJobId(target.jobId || target.jobName || target.job?.id || target.job?.name) === 'summoner') {
      const summon = this.summonOf(target)[0];
      if (summon) this.damageObject(summon, damage * COMBAT_RULES.summonDamageLinkRatio, null, element, true);
    }
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
  damageObject(o, amount, attacker = null, element = 'physical', linked = false) {
    if (!o?.alive || o.category === 'structure' && o.opened) return 0;
    const damage = Math.max(0, Math.round(amount * (1 + (attacker?.attackBonus || 0))));
    if (o.category === 'structure') {
      if (element === 'fire') this.igniteStructure(o.id);
      return this.hitStructure(o, damage, element);
    }
    o.hp = Math.max(0, o.hp - damage);
    if(damage>0){o.poseAction='hit';o.poseStartedAt=this.time;}
    this.event('objectHit', { objectId: o.id, x: o.x, z: o.z, damage, effect: element });
    if (!linked && damage > 0 && o.category === 'summon') {
      const summoner = unitById(this._units, o.ownerId);
      if (isAlive(summoner)) this.damageUnit(summoner, damage * COMBAT_RULES.summonDamageLinkRatio, null, element, true);
    }
    if (!o.hp) {
      this.removeObject(o, 'defeated');
      if (o.category === 'structure') this.openNavigationCell(o);
    }
    return damage;
  }
  removeObject(o, reason = 'expire') {
    if (!o.alive) return;
    o.alive = false; o.removedAt = this.time;
    if(reason==='defeated'&&['summon','mount'].includes(o.category)){
      o.poseAction='defeat';o.poseStartedAt=this.time;
    }
    if (o.mountedBy != null && ['mount','summon'].includes(o.category)) {
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
    const previous = spec.category === 'summon' ? this.summonOf(owner) : [];
    if (sideObjects.length - previous.length >= COMBAT_RULES.maximumObjectsPerTeam) return null;
    // Ten strategists begin mounted on their ceremonial horses. Without a
    // separate cavalry budget, automatic horse skills claim every remaining
    // world-object slot before the summoners get a turn: 1000-vs-1000 then
    // contains zero flying dragons despite having hundreds of summoners.
    if (spec.category === 'mount' && sideObjects.filter(o => o.category === 'mount').length >=
        COMBAT_RULES.maximumMountsPerTeam) return null;
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
      attackStartedAt: null, cryStartedAt:this.time, pendingAttack: null,
      mountedBy: mounted ? owner.id : null, height: spec.flying ? 3 : 0 };
    // Replace the owner's current familiar only after placement succeeds.
    for (const old of previous) {
      if (this._occupancy && old.blocking && this.inside(old.x, old.z))
        this._occupancy[old.z * this.width + old.x] = -1;
      this.removeObject(old, 'replaced');
    }
    this.objects.push(o);
    if (mounted) owner.mountId = o.id;
    if (this._occupancy && o.blocking) this._occupancy[o.z * this.width + o.x] = -2;
    this.event('spawn', { objectId: o.id, objectType: type, ownerId: owner.id, team: owner.team, x: o.x, z: o.z, flying: o.flying });
    if (mountableCreature(o)) this.event('objectCry',{objectId:o.id,objectType:type,x:o.x,z:o.z,kind:'spawn'});
    return o;
  }
  /** Mount an allied independent creature; no rider object or soldier slot is created. */
  mountObject(actor, creature) {
    if (!isAlive(actor) || actor.mountId || !mountableCreature(creature) ||
        creature.mountedBy != null || creature.team !== actor.team ||
        distance(actor,creature)>2) return false;
    if (this._occupancy && creature.blocking && this.inside(creature.x,creature.z)) {
      const cell=creature.z*this.width+creature.x;
      if(this._occupancy[cell]===-2)this._occupancy[cell]=-1;
    }
    creature.mountedBy=actor.id;
    creature.x=actor.x;creature.z=actor.z;
    creature.blocking=false;
    actor.mountId=creature.id;
    this.event('mount',{objectId:creature.id,objectType:creature.type,riderId:actor.id,x:actor.x,z:actor.z});
    return true;
  }
  dismountObject(actor) {
    const creature=this.objects.find(o=>o.alive&&o.id===actor?.mountId&&o.mountedBy===actor.id);
    if(!creature)return false;
    const spots=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]];
    const landing=spots.map(([dx,dz])=>({x:actor.x+dx,z:actor.z+dz}))
      .find(p=>this.free(p.x,p.z,creature.flying));
    if(!landing)return false;
    creature.x=landing.x;creature.z=landing.z;
    creature.mountedBy=null;creature.blocking=!creature.flying;
    actor.mountId=null;
    if(this._occupancy&&creature.blocking)this._occupancy[landing.z*this.width+landing.x]=-2;
    this.event('dismount',{objectId:creature.id,objectType:creature.type,riderId:actor.id,x:landing.x,z:landing.z});
    return true;
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
    const elevated=elevatedRangedStats(actor,{range:skill.range,damage:skill.power||0,
      radius:skill.radius||0,kind:skill.kind});
    if (skill.range > 0 && distance(actor, targetPos) > elevated.range) return false;
    const cast = () => { actor.mp -= skill.mp; actor._skillNext ??= {}; actor._skillNext[skill.id] = this.time + skill.cooldown;
      actor.action = 'skill'; actor.skillId = skill.id; actor.attackElapsed = 0;
      actor.skillPoseUntil = this.time + (skill.animation === 'cast' ? .85 : .55);
      this.castCount++;
      this.event('skill', { skillId: skill.id, jobId: combatJobId(actor.jobId || actor.jobName || actor.job?.id || actor.job?.name),
        sourceId: actor.id, team: actor.team, x: actor.x, z: actor.z,
        targetX: targetPos.x, targetZ: targetPos.z, effect: skill.effect, animation: skill.animation,
        skillKind:skill.kind, radius:elevated.radius||0, range:elevated.range }); };
    if (skill.kind === 'damage' && isAlive(target) && target.team !== actor.team) {
      const victims = skill.radius ? [
        ...this.nearby(1 - actor.team, target.x, target.z, elevated.radius),
        ...this.objects.filter(o => o.alive && o.team !== actor.team &&
          (o.category === 'summon' || o.category === 'mount') && distance(o, target) <= elevated.radius),
      ] : [target];
      if (!victims.length) return false;
      cast();
      for (const u of victims) {
        this.damageUnit(u, elevated.damage, actor, skill.element || 'physical');
        if (skill.burnSeconds && isAlive(u)) u.burningUntil = this.time + skill.burnSeconds;
      }
      if (skill.structurePower) this.damageStructures(target.x, target.z, elevated.radius || 1,
        skill.structurePower*elevated.multiplier, skill.element);
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
      // spawnObject atomically replaces the existing familiar on success.
      const summoned = this.spawnObject(skill.objectType, actor, actor.x, actor.z);
      if (!summoned) return false;
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
    if (!actor.mountId && ['sword','shield','lancer','archer','fighter','summoner'].includes(jobId)) {
      const creature=this.objects.find(o=>mountableCreature(o)&&o.category==='summon'&&
        o.team===actor.team&&o.mountedBy==null&&distance(o,actor)<=1.5);
      if(creature&&this.mountObject(actor,creature))return true;
    }
    const skills = availableCombatSkills(jobId, actor.rarity).slice().reverse();
    const existingSummon=jobId==='summoner'?this.summonOf(actor)[0]:null;
    const ready = s => actor.mp >= s.mp && (!actor._skillNext || (actor._skillNext[s.id] || 0) <= this.time);
    const nearbyWounded = jobId === 'priest' ? this.nearby(actor.team, actor.x, actor.z, 8).filter(u => u.hp < u.maxHp) : [];
    const assignedWounded = actor.healTargetSquadId == null ? [] : nearbyWounded.filter(u => String(u.squadId) === String(actor.healTargetSquadId));
    const wounded = (assignedWounded.length ? assignedWounded : nearbyWounded)
      .sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp)[0] || null;
    const fallen = jobId === 'priest' && actor.rarity === 'UR' && Math.floor(this.time * 10) % 30 === 0
      ? units.find(u => u.team === actor.team && !isAlive(u) && distance(actor, u) <= 6 && u.hp === 0) : null;
    for (const s of skills) {
      if (!ready(s)) continue;
      // A summoned wyvern used to be replaced by the cheaper wolf on the
      // following tick while the high-tier spell was cooling down. Keep the
      // strongest living creature until it falls or its contract expires.
      if(s.kind==='summon'&&existingSummon)continue;
      if(s.kind==='sacrifice'&&(!existingSummon||existingSummon.type!=='dragon'||
        this.time-existingSummon.createdAt<8))continue;
      let target = enemy;
      if (s.kind === 'heal') target = wounded;
      if (s.kind === 'revive') target = fallen;
      if (s.kind === 'restore') target = actor;
      if (['mount','summon','sacrifice','buff','unlock'].includes(s.kind)) target = actor;
      if (s.kind === 'place' && !enemy) continue;
      if (s.kind === 'damage' && (!enemy || distance(actor, enemy) >
          elevatedRangedStats(actor,{range:s.range,kind:s.kind}).range)) continue;
      if (s.kind === 'mobility' && (!enemy || distance(actor, enemy) <= 2)) continue;
      if (this.fireSkill(actor, s, target, units)) return true;
    }
    return false;
  }

  damageStructures(x, z, radius, power, element) {
    if (!(power>0)) return;
    for (const o of this.objects) {
      if (!o.alive || o.category !== 'structure' || structureDistance(o,x,z) > radius) continue;
      // The leading edge of a long bridge or castle wall must take a hit even
      // when its reference point is dozens of cells away from the explosion.
      if (element === 'fire') this.igniteStructure(o.id);
      this.hitStructure(o,power,element,{x,z});
    }
  }
  /** Shared HP pipeline for fire, spells, C4 and direct hits. */
  hitStructure(o,power,element,{x=o.x,z=o.z}={}) {
    if (!o?.alive || o.category !== 'structure' || !(power > 0)) return 0;
    const damage=Math.min(o.hp,Math.max(1,Math.round(power)));
    o.hp-=damage;this.objectDamage+=damage;
    this.event('structureHit',{objectId:o.id,x,z,effect:element,damage,hp:o.hp,maxHp:o.maxHp});
    if(o.hp===0){o.blocking=false;this.removeObject(o,'destroyed');this.openNavigationCell(o);}
    return damage;
  }
  /** Ignition keeps damaging HP for a material-dependent duration. */
  igniteStructure(id,{initialDamage=0,burnSeconds=null,fireDamagePerSecond=null}={}) {
    const o=this.objects.find(object=>object.id===id&&object.category==='structure'&&object.alive);
    if(!o)return false;
    if(Number.isFinite(fireDamagePerSecond))o.fireDamagePerSecond=Math.max(0,fireDamagePerSecond);
    const seconds=Number.isFinite(burnSeconds)?Math.max(0,burnSeconds):o.burnSeconds;
    const wasBurning=o.burningUntil>this.time;
    o.burningUntil=Math.max(o.burningUntil,this.time+seconds);
    if(!wasBurning){o.burnStartedAt=this.time;o.burnAccumulator=0;
      this.event('structureFireStarted',{objectId:o.id,hp:o.hp,maxHp:o.maxHp,burnUntil:o.burningUntil});}
    if(initialDamage>0)this.hitStructure(o,initialDamage,'fire');
    return true;
  }
  explode(o, units) {
    if (!o.alive) return;
    const victims = units.filter(u => isAlive(u) && distance(u, o) <= o.spec.radius &&
      (COMBAT_RULES.blastFriendlyFire || u.team !== o.team));
    for (const u of victims) this.damageUnit(u, o.spec.attack, null, 'fire');
    const creatureVictims=this.objects.filter(target=>target!==o&&target.alive&&
      (target.category==='summon'||target.category==='mount')&&
      distance(target,o)<=o.spec.radius&&
      (COMBAT_RULES.blastFriendlyFire||target.team!==o.team));
    for(const creature of creatureVictims)this.damageObject(creature,o.spec.attack,null,'fire');
    // C4 is a blast, not an incendiary spell. Damage accumulates across
    // explosions; one charge cannot secretly burn an intact bridge to zero.
    this.damageStructures(o.x, o.z, o.spec.radius, o.spec.attack, 'blast');
    this.event('explode', { objectId: o.id, objectType: o.type, x: o.x, z: o.z, radius: o.spec.radius, effect: 'fire' });
    this.removeObject(o, 'exploded');
  }

  tickSummons(dt, units) {
    for (const o of this.objects) {
      if (!o.alive || o.category !== 'summon') continue;
      if (!isAlive(unitById(units, o.ownerId))) { this.removeObject(o, 'owner_defeated'); continue; }
      if(o.flying){
        // Rooftops and castle towers are legal air destinations. Ascend
        // smoothly above roof height without testing any ground-wall cells.
        const targetHeight=this.flightRoofHeight(o.x,o.z);
        o.height+=(targetHeight-o.height)*Math.min(1,dt*3);
      }
      // Windup, contact and recovery are game-state events, not fake
      // particles emitted before the actual hit.
      if(o.pendingAttack&&this.time>=o.pendingAttack.impactAt){
        const pending=o.pendingAttack,target=unitById(units,pending.targetId);
        o.pendingAttack=null;
        if(isAlive(target)&&target.team!==o.team&&distance(target,o)<=o.spec.range+1){
          const attackRate=o.flying?FLYING_CREATURE_ATTACK_RATE:1;
          const element=o.type.includes('dragon')?'fire':o.type==='forest_archer'?'nature':
            o.type==='seraph_guardian'?'arcane':'physical';
          this.damageUnit(target,o.spec.attack/attackRate,null,element);
          this.damageStructures(target.x,target.z,Math.max(.8,o.spec.radius||1),
            o.spec.attack/attackRate*(o.type.includes('dragon')?2:.7),element);
          o.lastAttackHitAt=this.time;
          this.event('objectAttack',{objectId:o.id,objectType:o.type,attackType:CREATURE_PERFORMANCE[o.type]?.attack,
            x:o.x,z:o.z,targetX:target.x,targetZ:target.z,effect:o.type.includes('dragon')?'fire':o.type==='seraph_guardian'?'arcane':
             o.type==='forest_archer'?'nature':o.type==='wyvern'?'arcane':'slash'});
        }
      }
      // The angel supports nearby friends regardless of enemy line of sight.
      if(o.type==='seraph_guardian'){
        if(this.time >= (o.nextHealAt??0)){
          o.nextHealAt=this.time+7.5;
          const wounded=this.nearby(o.team,o.x,o.z,6)
            .filter(u=>isAlive(u)&&u.hp<u.maxHp)
            .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
          const center=wounded[0];
          if(center){
            for(const friend of wounded){
              if(distance(friend,center)<=2)
                friend.hp=Math.min(friend.maxHp,friend.hp+28);
            }
            this.event('skill',{skillId:'seraph_blessing',jobId:'summoner',
              sourceId:o.ownerId,team:o.team,x:o.x,z:o.z,targetX:center.x,
              targetZ:center.z,effect:'heal',skillKind:'heal',radius:2});
          }
        }
        if(this.time >= (o.nextReviveAt??(o.createdAt+16))){
          o.nextReviveAt=this.time+20;
          const fallen=units.find(u=>u.team===o.team&&!isAlive(u)&&u.hp===0&&distance(u,o)<=5);
          if(fallen){
            const previousAlive=fallen.alive,previousHp=fallen.hp;
            fallen.hp=Math.max(1,Math.ceil(fallen.maxHp*.3));fallen.alive=true;
            if(this.onRevive&&!this.onRevive(fallen)){
              fallen.hp=previousHp;fallen.alive=previousAlive;
            }else this.event('revive',{targetId:fallen.id,x:fallen.x,z:fallen.z,team:fallen.team});
          }
        }
      }
      let target = null, best = (COMBAT_RULES.summonLeashTiles + o.spec.range) ** 2;
      for (const u of this.nearby(1 - o.team, o.x, o.z, COMBAT_RULES.summonLeashTiles + o.spec.range)) {
        if (!isAlive(u) || (u.stealthUntil || 0) > this.time) continue;
        const d = (u.x - o.x) ** 2 + (u.z - o.z) ** 2;
        if (d < best) { target = u; best = d; }
      }
      if (!target) continue;
      if (best <= o.spec.range ** 2) {
        if (!o.pendingAttack&&this.time >= o.nextAttackAt) {
          const style=CREATURE_PERFORMANCE[o.type];
          o.attackStartedAt=this.time;
          o.attackTarget={x:target.x,z:target.z};
          const attackRate=o.flying?FLYING_CREATURE_ATTACK_RATE:1;
          o.pendingAttack={targetId:target.id,impactAt:this.time+(style?.windup??.1)/attackRate};
          o.nextAttackAt = this.time + o.spec.interval/attackRate;
          this.event('objectWindup',{objectId:o.id,objectType:o.type,attackType:style?.attack,
            x:o.x,z:o.z,targetX:target.x,targetZ:target.z});
        }
      } else if(o.mountedBy==null&&!o.pendingAttack) {
        o.moveAccum = Math.min(3,(o.moveAccum || 0) + dt * o.spec.speed);
        // A large dragon/horse can cover multiple tiles per AI tick, but must
        // check every intervening cell. No teleporting through castle walls.
        for(let step=0;step<3&&o.moveAccum>=1;step++){
          if((target.x-o.x)**2+(target.z-o.z)**2<=o.spec.range**2)break;
          const dx=Math.sign(target.x-o.x),dz=Math.sign(target.z-o.z);
          const candidates=Math.abs(target.x-o.x)>Math.abs(target.z-o.z)?[[dx,0],[0,dz]]:[[0,dz],[dx,0]];
          let moved=false;
          for (const [ax,az] of candidates) {
            if ((!ax && !az) || !this.free(o.x + ax, o.z + az, o.flying)||
              (o.flying&&!this.airspaceClear(o,o.x+ax,o.z+az))) continue;
            if (!o.flying && this._occupancy) this._occupancy[o.z * this.width + o.x] = -1;
            o.x += ax; o.z += az; o.moveAccum -= 1;
            if (!o.flying && this._occupancy) this._occupancy[o.z * this.width + o.x] = -2;
            moved=true;break;
          }
          if(!moved){o.moveAccum=Math.min(.5,o.moveAccum);break;}
        }
      }
    }
  }
  getStats() { return { casts: this.castCount, activeObjects: this.objects.filter(o => o.alive).length,
    summons: this.objects.filter(o => o.alive && o.category === 'summon').length,
    mounts: this.objects.filter(o => o.alive && o.category === 'mount').length,
    objectDamage: this.objectDamage }; }
}
