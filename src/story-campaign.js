// Story campaign rules, intentionally independent of the 3D battle renderer.
// The temporary territory-battle resolver can later be replaced by real battle results.
export const CAMPAIGN_VERSION = 1;
export const FACTIONS = {
  player: { name: '灰銀軍', color: '#68c7ee' },
  crimson: { name: '紅炎軍', color: '#f58a78' },
  verdant: { name: '翠嵐軍', color: '#94d7a1' },
  neutral: { name: '未開拓', color: '#8d98a5' },
};

export const TERRITORIES = [
  { id: 'western-pass', name: '西の関所', x: 0, y: 0, mapX: 20, mapY: 23, owner: 'player', terrain: '丘陵', capacity: 500, income: 110, base: false },
  { id: 'pine-forest', name: '松影の森', x: 1, y: 0, mapX: 42, mapY: 25, owner: 'neutral', terrain: '森林', capacity: 500, income: 85, base: false },
  { id: 'flame-fort', name: '紅炎砦', x: 2, y: 0, mapX: 65, mapY: 16, owner: 'crimson', terrain: '城塞', capacity: 600, income: 135, base: true },
  { id: 'northern-cliff', name: '北の断崖', x: 3, y: 0, mapX: 86, mapY: 20, owner: 'crimson', terrain: '山岳', capacity: 400, income: 105, base: false },
  { id: 'silver-capital', name: '灰銀の本城', x: 0, y: 1, mapX: 20, mapY: 48, owner: 'player', terrain: '城塞', capacity: 800, income: 190, base: true },
  { id: 'central-plains', name: '中央平原', x: 1, y: 1, mapX: 43, mapY: 48, owner: 'neutral', terrain: '平地', capacity: 1000, income: 150, base: false },
  { id: 'border-town', name: '境界の町', x: 2, y: 1, mapX: 64, mapY: 44, owner: 'crimson', terrain: '市街', capacity: 500, income: 125, base: false },
  { id: 'green-watch', name: '翠嵐の砦', x: 3, y: 1, mapX: 85, mapY: 47, owner: 'verdant', terrain: '丘陵', capacity: 500, income: 100, base: false },
  { id: 'river-port', name: '大河の港', x: 0, y: 2, mapX: 17, mapY: 74, owner: 'player', terrain: '河川', capacity: 500, income: 140, base: false },
  { id: 'lakeshore', name: '湖畔の荒地', x: 1, y: 2, mapX: 44, mapY: 71, owner: 'neutral', terrain: '湿地', capacity: 500, income: 95, base: false },
  { id: 'green-capital', name: '翠嵐の王都', x: 2, y: 2, mapX: 67, mapY: 72, owner: 'verdant', terrain: '城塞', capacity: 700, income: 165, base: true },
  { id: 'southern-woods', name: '南の樹海', x: 3, y: 2, mapX: 86, mapY: 78, owner: 'verdant', terrain: '森林', capacity: 500, income: 100, base: false },
];

export const JOBS = ['騎士', '盾騎士', '忍者', 'シーフ', '僧侶', '魔法使い', '召喚士', '格闘家'];
export const JOB_FACE_VARIANTS = 4;
// Legacy squads did not store portraits. Their squad ID supplies a stable default.
export function squadFaceVariant(squad) {
  return Number.isInteger(squad?.faceId) && squad.faceId >= 0 && squad.faceId < JOB_FACE_VARIANTS
    ? squad.faceId : ((Math.max(1, Number(squad?.id) || 1) - 1) % JOB_FACE_VARIANTS);
}
export const PURPOSES = ['前線', '補助', '環境'];
export const RARITIES = {
  N: { label: 'ノーマル', hire: 10, wage: 1, level: 1, power: 1 },
  R: { label: 'レア', hire: 28, wage: 3, level: 3, power: 1.55 },
  UR: { label: 'ウルトラレア', hire: 90, wage: 9, level: 6, power: 2.7 },
};
export const BUFFS = [
  { id: 'rally', name: '鼓舞', unlock: 1, duration: 12, attack: 0.18, defense: 0 },
  { id: 'guard', name: '堅守の号令', unlock: 2, duration: 10, attack: 0, defense: 0.2 },
  { id: 'advance', name: '進撃の号令', unlock: 3, duration: 12, attack: 0.25, defense: 0 },
  { id: 'aegis', name: '護衛の号令', unlock: 4, duration: 10, attack: 0, defense: 0.3 },
  { id: 'assault', name: '猛攻の号令', unlock: 5, duration: 8, attack: 0.4, defense: 0 },
  { id: 'resolve', name: '不屈の号令', unlock: 6, duration: 14, attack: 0, defense: 0.3 },
  { id: 'valor', name: '奮起の号令', unlock: 7, duration: 15, attack: 0.32, defense: 0 },
  { id: 'bulwark', name: '鉄壁の号令', unlock: 8, duration: 12, attack: 0, defense: 0.42 },
  { id: 'breakthrough', name: '破陣の号令', unlock: 9, duration: 10, attack: 0.5, defense: 0 },
  { id: 'conquest', name: '覇軍の号令', unlock: 10, duration: 12, attack: 0.6, defense: 0 },
];

const provinceById = Object.fromEntries(TERRITORIES.map(territory => [territory.id, territory]));
const initialGarrisons = { 'flame-fort': 300, 'northern-cliff': 150, 'border-town': 180, 'green-watch': 170, 'green-capital': 300, 'southern-woods': 160 };
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
const randomNumber = rng => clamp(Number(rng()), 0, 0.999999);
// Existing saves without an assignment remain under the player's command.
export const squadCommanderId = squad => squad.commanderId ?? 'player';
export const RESERVE_COMMANDER_ID = 'reserve';
export const AUTO_FORMATIONS = ['均衡', '攻撃重視', '防御重視', '機動重視', '支援重視'];
export const COMMANDER_GENDERS = ['male', 'female'];
export const COMMANDER_FACE_VARIANTS = 8;
export function commanderAppearance(leader) {
  return {
    gender: COMMANDER_GENDERS.includes(leader?.gender) ? leader.gender : 'male',
    faceId: Number.isInteger(leader?.faceId) && leader.faceId >= 0 && leader.faceId < COMMANDER_FACE_VARIANTS ? leader.faceId : 0,
  };
}
function selectedAppearance(options = {}) {
  const { gender = 'male', faceId = 0 } = options;
  if (!COMMANDER_GENDERS.includes(gender) || !Number.isInteger(faceId) || faceId < 0 || faceId >= COMMANDER_FACE_VARIANTS)
    throw new Error('軍師の性別または顔の選択が正しくありません。');
  return { gender, faceId };
}
export function squadCommander(state, squad) {
  const id = squadCommanderId(squad);
  return id === 'player' ? state.commander : state.commanders.find(c => String(c.id) === String(id)) ?? state.commander;
}
function resolveCommander(state, id, allowReserve = false) {
  if (allowReserve && String(id) === RESERVE_COMMANDER_ID) return RESERVE_COMMANDER_ID;
  if (id == null || String(id) === 'player') return 'player';
  const leader = state.commanders.find(c => String(c.id) === String(id));
  if (!leader) throw new Error('担当する軍師を選択してください。');
  return String(leader.id);
}

export function createCampaign(commanderName, appearance = {}) {
  const name = String(commanderName || '').trim().slice(0, 24);
  if (!name) throw new Error('軍師の名前を入力してください。');
  const look = selectedAppearance(appearance);
  return {
    version: CAMPAIGN_VERSION, month: 1, treasury: 2300, gameOver: null,
    commander: { name, ...look, level: 1, xp: 0, active: true, territory: 'silver-capital', purpose: '前線' },
    commanders: [], nextSquadId: 3,
    squads: [
      { id: 1, job: '騎士', rarity: 'N', count: 30, purpose: '前線', buff: 'rally', commanderId: 'player', faceId: 0 },
      { id: 2, job: '僧侶', rarity: 'N', count: 10, purpose: '補助', buff: 'rally', commanderId: 'player', faceId: 2 },
    ],
    owners: Object.fromEntries(TERRITORIES.map(t => [t.id, t.owner])),
    garrisons: { ...initialGarrisons },
    log: ['灰銀軍を率いる軍師『' + name + '』の物語が始まりました。'],
  };
}

export const troopCount = state => state.squads.reduce((sum, squad) => sum + squad.count, 0);
export const monthlyIncome = state => TERRITORIES.filter(t => state.owners[t.id] === 'player').reduce((sum, t) => sum + t.income, 0);
export const monthlyWages = state => state.squads.reduce((sum, squad) => sum + squad.count * RARITIES[squad.rarity].wage, 0) + state.commanders.length * 35;
export const maxSquads = state => Math.min(10, state.commander.level + 1);
// One commander leads one mixed-job army, with 100 soldiers per commander.
export const armyTroops = (state, commanderId = 'player') => state.squads
  .filter(s => String(squadCommanderId(s)) === String(commanderId))
  .reduce((total, unit) => total + unit.count, 0);
export const reserveTroops = state => armyTroops(state, RESERVE_COMMANDER_ID);
export const deployedTroopCount = state => troopCount(state) - reserveTroops(state);
const jobRatings = {
  '騎士': [2.0, 0.1, 0.2], '盾騎士': [1.1, 0.9, 0.4],
  '忍者': [1.5, 0.2, 2.1], 'シーフ': [0.5, 0.1, 2.4],
  '僧侶': [0.35, 2.4, 0.4], '魔法使い': [1.8, 0.5, 1.8],
  '召喚士': [0.3, 2.0, 1.6], '格闘家': [2.2, 0.2, 0.2],
};
// Per-job tactical combat ratings: attack, defense, mobility (0..100 scale).
// Counts change the weighted army average; higher rarity improves an individual's rating.
export const JOB_COMBAT_RATINGS = {
  '騎士': [82, 65, 50], '盾騎士': [61, 96, 28],
  '忍者': [87, 43, 96], 'シーフ': [59, 37, 94],
  '僧侶': [35, 53, 44], '魔法使い': [88, 31, 40],
  '召喚士': [54, 63, 37], '格闘家': [86, 59, 80],
};
const abilityRules = [
  ['騎士', 20, '突破攻撃'], ['盾騎士', 15, '盾陣防御'],
  ['忍者', 10, '鉤縄・罠設置'], ['シーフ', 10, '鍵開け・潜入'],
  ['僧侶', 15, '範囲回復'], ['魔法使い', 15, '広域魔法'],
  ['召喚士', 10, '召喚支援'], ['格闘家', 20, '気功・突撃'],
];
export function formationCapabilities(state, commanderId = 'player') {
  const units = state.squads.filter(s => String(squadCommanderId(s)) === String(commanderId));
  const total = units.reduce((sum, u) => sum + u.count, 0);
  const counts = Object.fromEntries(JOBS.map(job => [job, 0]));
  const raw = [0, 0, 0];
  const combatRaw = [0, 0, 0];
  for (const unit of units) {
    counts[unit.job] = (counts[unit.job] || 0) + unit.count;
    const factor = RARITIES[unit.rarity]?.power ?? 1;
    (jobRatings[unit.job] ?? [1, 1, 1]).forEach((weight, i) => { raw[i] += unit.count * weight * factor; });
    const rarityBonus = unit.rarity === 'UR' ? 14 : unit.rarity === 'R' ? 7 : 0;
    (JOB_COMBAT_RATINGS[unit.job] ?? [50, 50, 50]).forEach((rating, i) => { combatRaw[i] += unit.count * Math.min(100, rating + rarityBonus); });
  }
  const scores = raw.map(value => Math.min(100, Math.round(value * 50 / Math.max(total, 1))));
  const combatScores = combatRaw.map(value => total ? Math.round(value / total) : 0);
  return { total, counts, frontline: scores[0], support: scores[1], environment: scores[2],
    attack: combatScores[0], defense: combatScores[1], mobility: combatScores[2],
    abilities: abilityRules.filter(([job, threshold]) => counts[job] >= threshold).map(([, , name]) => name) };
}
export const isAdjacent = (a, b) => Boolean(provinceById[a] && provinceById[b] && Math.abs(provinceById[a].x - provinceById[b].x) + Math.abs(provinceById[a].y - provinceById[b].y) === 1);
export const accessible = (state, id) => TERRITORIES.some(t => state.owners[t.id] === 'player' && isAdjacent(t.id, id));
export const territoryOf = id => provinceById[id] || null;

function ensurePlaying(state) { if (state.gameOver) throw new Error('この物語は終了しています。'); }
function record(state, message) { state.log.unshift(message); state.log = state.log.slice(0, 40); }

export function recruit(state, { job, rarity, count, purpose, commanderId = 'player', faceId = 0 }) {
  ensurePlaying(state);
  const n = Number(count);
  if (!JOBS.includes(job) || !RARITIES[rarity] || !PURPOSES.includes(purpose) || !Number.isInteger(n) || n < 1 || n > 100) throw new Error('雇用条件を確認してください。');
  if (!Number.isInteger(faceId) || faceId < 0 || faceId >= JOB_FACE_VARIANTS) throw new Error('兵士の顔を正しく選んでください。');
  const assigned = resolveCommander(state, commanderId, true);
  const rule = RARITIES[rarity];
  if (state.commander.level < rule.level) throw new Error(rule.label + 'を雇用するには軍師レベル' + rule.level + 'が必要です。');
  const cost = n * rule.hire;
  if (state.treasury < cost) throw new Error('雇用資金が不足しています。');
  if (troopCount(state) + n > 1000) throw new Error('1軍の上限は1000人です。');
  if (assigned !== RESERVE_COMMANDER_ID && armyTroops(state, assigned) + n > 100) throw new Error('各軍師の部隊上限は100人です。新しい軍師を雇って別部隊を編成してください。');
  const candidate = state.squads.find(s => s.job === job && s.rarity === rarity && s.purpose === purpose && squadCommanderId(s) === assigned && squadFaceVariant(s) === faceId && s.count + n <= 100);
  if (candidate) candidate.count += n;
  else state.squads.push({ id: state.nextSquadId++, job, rarity, count: n, purpose, buff: 'rally', commanderId: assigned, faceId });
  state.treasury -= cost;
  record(state, job + ' ' + rule.label + ' ' + n + '人を' + cost + 'Gで雇用しました。');
  return cost;
}

export function setSquadPurpose(state, id, purpose) {
  ensurePlaying(state);
  if (!PURPOSES.includes(purpose)) throw new Error('不明な部隊目的です。');
  const squad = state.squads.find(s => s.id === Number(id));
  if (!squad) throw new Error('部隊が見つかりません。');
  squad.purpose = purpose;
  record(state, '第' + squad.id + '部隊の目的を「' + purpose + '」に変更しました。');
}

export function setSquadFace(state, id, faceId) {
  ensurePlaying(state);
  const squad = state.squads.find(s => s.id === Number(id));
  if (!squad) throw new Error('兵士グループが見つかりません。');
  if (!Number.isInteger(faceId) || faceId < 0 || faceId >= JOB_FACE_VARIANTS) throw new Error('兵士の顔を正しく選んでください。');
  squad.faceId = faceId;
  record(state, squad.job + '部隊の肖像を変更しました。');
}

export function setSquadCommander(state, id, commanderId) {
  ensurePlaying(state);
  const squad = state.squads.find(s => s.id === Number(id));
  if (!squad) throw new Error('部隊が見つかりません。');
  const assigned = resolveCommander(state, commanderId);
  if (String(squadCommanderId(squad)) !== assigned && armyTroops(state, assigned) + squad.count > 100) throw new Error('配属先の部隊上限100人を超えます。');
  squad.commanderId = assigned;
  const leader = squadCommander(state, squad);
  if (BUFFS.find(b => b.id === squad.buff)?.unlock > leader.level) squad.buff = 'rally';
  record(state, '第' + squad.id + '部隊の担当軍師を変更しました。');
}

// Reassign any number of soldiers from one commander's job contingent to another.
export function transferTroops(state, squadId, commanderId, count) {
  ensurePlaying(state);
  const unit = state.squads.find(s => s.id === Number(squadId));
  const assigned = resolveCommander(state, commanderId, true);
  const n = Number(count);
  if (!unit || !Number.isInteger(n) || n < 1 || n > unit.count) throw new Error('移動させる兵士の人数を確認してください。');
  if (String(squadCommanderId(unit)) === assigned) throw new Error('移動先には別の軍団を選んでください。');
  if (assigned !== RESERVE_COMMANDER_ID && armyTroops(state, assigned) + n > 100) throw new Error('配属先の部隊上限100人を超えます。');
  const leader = assigned === 'player' ? state.commander : state.commanders.find(c => String(c.id) === assigned);
  const buff = leader && BUFFS.some(b => b.id === unit.buff && b.unlock <= leader.level) ? unit.buff : 'rally';
  const job = unit.job;
  if (n === unit.count) {
    unit.commanderId = assigned;
    unit.buff = buff;
  } else {
    unit.count -= n;
    const candidate = state.squads.find(s => s.job === unit.job && s.rarity === unit.rarity && s.purpose === unit.purpose && s.buff === buff && String(squadCommanderId(s)) === assigned && squadFaceVariant(s) === squadFaceVariant(unit) && s.count + n <= 100);
    if (candidate) candidate.count += n;
    else state.squads.push({ id: state.nextSquadId++, job: unit.job, rarity: unit.rarity, count: n, purpose: unit.purpose, buff, commanderId: assigned, faceId: squadFaceVariant(unit) });
  }
  record(state, job + ' ' + n + '人を別軍団へ編入しました。');
}

// Optimize one commander's army using its own soldiers plus unattached reserves.
// Other commanders never lose units. Each soldier keeps job, rarity and role.
const formationWeights = {
  '均衡':     { '騎士': 20, '盾騎士': 20, '忍者': 10, 'シーフ': 5, '僧侶': 15, '魔法使い': 15, '召喚士': 5, '格闘家': 10 },
  '攻撃重視': { '騎士': 30, '盾騎士': 5, '忍者': 10, 'シーフ': 0, '僧侶': 10, '魔法使い': 30, '召喚士': 0, '格闘家': 15 },
  '防御重視': { '騎士': 20, '盾騎士': 45, '忍者': 0, 'シーフ': 0, '僧侶': 20, '魔法使い': 5, '召喚士': 10, '格闘家': 0 },
  '機動重視': { '騎士': 5, '盾騎士': 0, '忍者': 40, 'シーフ': 30, '僧侶': 5, '魔法使い': 0, '召喚士': 0, '格闘家': 20 },
  '支援重視': { '騎士': 5, '盾騎士': 15, '忍者': 0, 'シーフ': 0, '僧侶': 40, '魔法使い': 10, '召喚士': 30, '格闘家': 0 },
};
export function autoFormArmy(state, commanderId, priority = '均衡') {
  ensurePlaying(state);
  const assigned = resolveCommander(state, commanderId);
  if (!AUTO_FORMATIONS.includes(priority)) throw new Error('自動編成の方針を選んでください。');
  const sources = state.squads.filter(s => [assigned, RESERVE_COMMANDER_ID].includes(String(squadCommanderId(s))));
  const stock = sources.map(s => ({ ...s }));
  const available = stock.reduce((sum, s) => sum + s.count, 0);
  const targetSize = Math.min(100, available);
  const jobsByPriority = [...JOBS].sort((a, b) => formationWeights[priority][b] - formationWeights[priority][a]);
  const orderedStock = [...stock].sort((a, b) => ({ UR: 0, R: 1, N: 2 }[a.rarity] ?? 3) - ({ UR: 0, R: 1, N: 2 }[b.rarity] ?? 3));
  const result = [];
  let remaining = targetSize;
  function take(job, wanted) {
    for (const s of orderedStock) {
      if (s.job !== job || !s.count || !wanted || !remaining) continue;
      const n = Math.min(s.count, wanted, remaining);
      const leader = assigned === 'player' ? state.commander : state.commanders.find(c => String(c.id) === assigned);
      const buff = BUFFS.some(b => b.id === s.buff && b.unlock <= leader.level) ? s.buff : 'rally';
      result.push({ ...s, id: state.nextSquadId++, count: n, commanderId: assigned, buff });
      s.count -= n;
      wanted -= n;
      remaining -= n;
    }
  }
  for (const job of JOBS) take(job, Math.floor(targetSize * formationWeights[priority][job] / 100));
  for (const job of jobsByPriority) take(job, remaining);
  const otherArmies = state.squads.filter(s => ![assigned, RESERVE_COMMANDER_ID].includes(String(squadCommanderId(s))));
  state.squads = otherArmies.concat(result, stock.filter(s => s.count > 0).map(s => ({ ...s, id: state.nextSquadId++, commanderId: RESERVE_COMMANDER_ID, buff: 'rally' })));
  const name = assigned === 'player' ? state.commander.name : state.commanders.find(c => String(c.id) === assigned).name;
  record(state, '軍師『' + name + '』の軍団を「' + priority + '」で自動編成（' + targetSize + '/100人）。');
  return targetSize;
}

export function setSquadBuff(state, id, buffId) {
  ensurePlaying(state);
  const squad = state.squads.find(s => s.id === Number(id));
  const buff = BUFFS.find(b => b.id === buffId);
  if (!squad || !buff || buff.unlock > squadCommander(state, squad).level) throw new Error('担当軍師のレベルではこの号令を設定できません。');
  squad.buff = buff.id;
}

export function setFormationPurpose(state, commanderId, purpose) {
  ensurePlaying(state);
  if (!PURPOSES.includes(purpose)) throw new Error('不明な作戦目的です。');
  const id = resolveCommander(state, commanderId);
  const leader = id === 'player' ? state.commander : state.commanders.find(c => String(c.id) === id);
  leader.purpose = purpose;
  record(state, '軍師『' + leader.name + '』の部隊目的を「' + purpose + '」に変更しました。');
}

export function trainCommander(state, name, appearance = {}) {
  ensurePlaying(state);
  const safeName = String(name || '').trim().slice(0, 24);
  if (!safeName) throw new Error('副軍師の名前を入力してください。');
  const look = selectedAppearance(appearance);
  if (state.commanders.length >= 9 || state.commanders.length + 1 >= maxSquads(state)) throw new Error('軍師レベルに対する部隊数上限です。レベルを上げると新しい軍師を雇えます。');
  if (state.treasury < 600) throw new Error('副軍師の育成費600Gが必要です。');
  state.treasury -= 600;
  state.commanders.push({ id: state.commanders.length + 1, name: safeName, ...look, level: 1, xp: 0, territory: 'silver-capital', purpose: '前線' });
  record(state, '副軍師『' + safeName + '』を育成しました。');
}

// Appearance is cosmetic, and can be changed without affecting troop statistics.
export function setCommanderAppearance(state, id, appearance) {
  ensurePlaying(state);
  const look = selectedAppearance(appearance);
  const leader = String(id) === 'player' ? state.commander : state.commanders.find(c => String(c.id) === String(id));
  if (!leader) throw new Error('軍師が見つかりません。');
  Object.assign(leader, look);
  record(state, '軍師『' + leader.name + '』の容姿を変更しました。');
}

export function assignCommander(state, id, territoryId) {
  ensurePlaying(state);
  const leader = state.commanders.find(c => c.id === Number(id));
  if (!leader || state.owners[territoryId] !== 'player') throw new Error('自領地に軍師を配置してください。');
  leader.territory = territoryId;
  record(state, leader.name + 'を' + provinceById[territoryId].name + 'に配置しました。');
}

function gainExperience(state, value) {
  state.commander.xp += value;
  while (state.commander.xp >= state.commander.level * 100 && state.commander.level < 10) {
    state.commander.xp -= state.commander.level * 100;
    state.commander.level++;
    record(state, '軍師レベルが' + state.commander.level + 'になりました！編成枠と号令を確認してください。');
  }
}

function checkOutcome(state) {
  if (state.treasury <= 0) state.gameOver = '資金が尽きたため、敗北しました。';
  if (state.owners['silver-capital'] !== 'player') state.gameOver = '本城が占領されたため、敗北しました。';
  if (state.owners['flame-fort'] === 'player' && state.owners['green-capital'] === 'player') state.gameOver = '両勢力の本拠地を制圧！天下統一に成功しました。';
}

function removeLosses(state, count) {
  let remaining = Math.min(deployedTroopCount(state), Math.max(0, Math.floor(count)));
  for (const squad of [...state.squads].reverse()) {
    if (squadCommanderId(squad) === RESERVE_COMMANDER_ID) continue;
    const n = Math.min(squad.count, remaining);
    squad.count -= n; remaining -= n;
    if (!remaining) break;
  }
  state.squads = state.squads.filter(s => s.count > 0);
}

const jobPower = { '騎士': 1.2, '盾騎士': 1.05, '忍者': 1.25, 'シーフ': 0.8, '僧侶': 0.9, '魔法使い': 1.2, '召喚士': 1.1, '格闘家': 1.25 };
function calculatePower(state, capacity) {
  let remaining = Math.min(deployedTroopCount(state), capacity);
  let power = 0;
  const ratingCache = new Map();
  for (const squad of state.squads) {
    if (squadCommanderId(squad) === RESERVE_COMMANDER_ID) continue;
    const participating = Math.min(remaining, squad.count); remaining -= participating;
    const leader = squadCommander(state, squad);
    const canCommand = squadCommanderId(squad) !== 'player' || state.commander.active;
    const buff = canCommand ? BUFFS.find(b => b.id === squad.buff && b.unlock <= leader.level) : null;
    // A 30-second abstract encounter. Temporary resolver until the 3D battle integration.
    const attackBonus = buff ? buff.attack * buff.duration / 30 : 0;
    const id = String(squadCommanderId(squad));
    if (!ratingCache.has(id)) ratingCache.set(id, formationCapabilities(state, id));
    const armyStats = ratingCache.get(id);
    const combatBonus = armyStats.attack / 100 * 0.12;
    power += participating * RARITIES[squad.rarity].power * jobPower[squad.job] * (1 + attackBonus + combatBonus);
  }
  return power;
}

function calculateProtection(state, capacity) {
  let remaining = Math.min(deployedTroopCount(state), capacity);
  const participatingTotal = remaining;
  let protectedWeight = 0;
  const ratingCache = new Map();
  for (const squad of state.squads) {
    if (squadCommanderId(squad) === RESERVE_COMMANDER_ID) continue;
    const participating = Math.min(remaining, squad.count); remaining -= participating;
    const leader = squadCommander(state, squad);
    const canCommand = squadCommanderId(squad) !== 'player' || state.commander.active;
    const buff = canCommand ? BUFFS.find(b => b.id === squad.buff && b.unlock <= leader.level) : null;
    if (buff) protectedWeight += participating * buff.defense * buff.duration / 30;
    const id = String(squadCommanderId(squad));
    if (!ratingCache.has(id)) ratingCache.set(id, formationCapabilities(state, id));
    const armyStats = ratingCache.get(id);
    protectedWeight += participating * (armyStats.defense * 0.0012 + armyStats.mobility * 0.0005);
    if (!remaining) break;
  }
  return participatingTotal ? protectedWeight / participatingTotal : 0;
}

export function colonize(state, territoryId) {
  ensurePlaying(state);
  if (state.owners[territoryId] !== 'neutral' || !accessible(state, territoryId)) throw new Error('開拓できる隣接未開拓地を選んでください。');
  const cost = 300;
  if (state.treasury < cost) throw new Error('開拓費300Gが必要です。');
  state.treasury -= cost; state.owners[territoryId] = 'player';
  gainExperience(state, 45);
  record(state, provinceById[territoryId].name + 'を300Gで開拓しました。');
  checkOutcome(state);
}

export function attackTerritory(state, territoryId, rng = Math.random) {
  ensurePlaying(state);
  const target = provinceById[territoryId];
  const owner = state.owners[territoryId];
  if (!target || !['crimson', 'verdant'].includes(owner) || !accessible(state, territoryId)) throw new Error('隣接する敵領地だけ攻撃できます。');
  if (deployedTroopCount(state) === 0) throw new Error('出撃できる傭兵がいません。予備兵を軍師へ配属してください。');
  const participants = Math.min(deployedTroopCount(state), target.capacity);
  const attack = calculatePower(state, target.capacity);
  const defense = (state.garrisons[territoryId] || 150) * (target.terrain === '城塞' ? 1.35 : target.terrain === '山岳' ? 1.2 : 1);
  const victory = attack >= defense * (0.88 + 0.24 * randomNumber(rng));
  const protection = calculateProtection(state, target.capacity);
  const losses = Math.max(1, Math.round(participants * (victory ? 0.08 + randomNumber(rng) * 0.1 : 0.22 + randomNumber(rng) * 0.15) * (1 - protection)));
  removeLosses(state, losses);
  if (victory) {
    state.owners[territoryId] = 'player';
    state.garrisons[territoryId] = 90;
    gainExperience(state, target.base ? 200 : 110);
    record(state, target.name + 'に勝利！損失' + losses + '人。');
  } else {
    state.garrisons[territoryId] = Math.max(40, Math.round((state.garrisons[territoryId] || 150) * 0.85));
    if (randomNumber(rng) < 0.12) {
      state.commander.active = false;
      record(state, '軍師が戦闘不能になりました。戦闘中の命令は初期設定のみで、その後は自動行動です。');
    }
    record(state, target.name + 'の攻略に失敗。損失' + losses + '人。');
  }
  checkOutcome(state);
  return { victory, losses, attack, defense, participants };
}

function enemyPhase(state, rng) {
  for (const enemy of ['crimson', 'verdant']) {
    const held = TERRITORIES.filter(t => state.owners[t.id] === enemy);
    if (!held.length) continue;
    const neutralTargets = TERRITORIES.filter(t => state.owners[t.id] === 'neutral' && held.some(h => isAdjacent(h.id, t.id)));
    if (neutralTargets.length) {
      const target = neutralTargets[Math.floor(randomNumber(rng) * neutralTargets.length)];
      state.owners[target.id] = enemy;
      state.garrisons[target.id] = 100;
      record(state, FACTIONS[enemy].name + 'が' + target.name + 'へ進出しました。');
      continue;
    }
    const targets = TERRITORIES.filter(t => state.owners[t.id] === 'player' && held.some(h => isAdjacent(h.id, t.id)));
    if (!targets.length || randomNumber(rng) < 0.55) continue;
    const target = targets[Math.floor(randomNumber(rng) * targets.length)];
    const lieutenant = state.commanders.some(c => c.territory === target.id);
    const guard = (target.base ? 220 : 130) + (lieutenant ? 100 : 0) + Math.min(deployedTroopCount(state), target.capacity) * 0.12;
    const aggression = (held.reduce((sum, t) => sum + (state.garrisons[t.id] || 100), 0) / held.length) * (0.9 + randomNumber(rng) * 0.25);
    if (aggression > guard) {
      state.owners[target.id] = enemy;
      state.garrisons[target.id] = 120;
      record(state, FACTIONS[enemy].name + 'が' + target.name + 'を占領しました！');
      checkOutcome(state);
    } else record(state, target.name + 'への敵軍の攻勢を防ぎました。');
    if (state.gameOver) return;
  }
}

export function nextMonth(state, rng = Math.random) {
  ensurePlaying(state);
  const income = monthlyIncome(state), wages = monthlyWages(state);
  state.treasury += income - wages;
  state.month++;
  record(state, state.month + 'か月目：領地収入+' + income + 'G、給料-' + wages + 'G。');
  if (!state.commander.active) {
    state.commander.active = true;
    record(state, '軍師が療養から復帰しました。');
  }
  checkOutcome(state);
  if (!state.gameOver) enemyPhase(state, rng);
  checkOutcome(state);
  return { income, wages, treasury: state.treasury };
}

export function validateSavedCampaign(value) {
  return Boolean(value && value.version === CAMPAIGN_VERSION && value.commander && typeof value.commander.name === 'string' && Array.isArray(value.squads) && value.owners && typeof value.treasury === 'number' && Array.isArray(value.log));
}

