import assert from 'node:assert/strict';
import {
  createCampaign, colonize, recruit, trainCommander, transferTroops,
  troopCount, settleStoryBattle,
} from '../src/story-campaign.js';
import {
  STORY_BATTLE_MAX_UNITS, STORY_JOB_TO_BATTLE, allocateSortieSlots,
  createStoryBattleRequest, STORY_SPAWN_LANES,
} from '../src/story-battle-bridge.js';

assert.equal(STORY_BATTLE_MAX_UNITS, 50);
assert.equal(STORY_JOB_TO_BATTLE['盾騎士'], '盾戦士');
assert.deepEqual(STORY_SPAWN_LANES, ['north', 'center', 'south']);
const portions = allocateSortieSlots([{ id: 1, count: 70 }, { id: 2, count: 30 }]);
assert.equal(portions.reduce((n, entry) => n + entry.count, 0), 50);
assert.equal(portions[0].count, 35);
assert.equal(portions[1].count, 15);
assert.deepEqual(allocateSortieSlots([{ id: 1, count: 0 }]), []);

const state = createCampaign('戦闘連携テスト');
colonize(state, 'central-plains');
trainCommander(state, '副軍師');
state.commanders[0].level = 3;
recruit(state, { job: '魔法使い', rarity: 'N', count: 15, purpose: '補助', commanderId: 1 });
const squad = state.squads.find(s => s.job === '魔法使い');
assert.ok(squad);
const request = createStoryBattleRequest(state, 'border-town', {
  battleId: 'case-001', lanes: { 1: 'north', 2: 'south', [squad.id]: 'center' },
});
assert.equal(request.battleId, 'case-001');
assert.equal(request.territoryName, '境界の町');
assert.equal(request.units.length, 50);
assert.equal(request.enemyCount, 45);
assert.equal(request.units.find(u => u.squadId === 1)?.spawnLane, 'north');
assert.equal(request.units.find(u => u.squadId === 2)?.spawnLane, 'south');
assert.equal(request.units.find(u => u.squadId === squad.id)?.spawnLane, 'center');
assert.equal(request.units.find(u => u.squadId === squad.id)?.job, '魔法使い');
assert.equal(request.commanders.length, 2);
assert.deepEqual(request.commanders.map(c => c.orders.length), [1, 3]);
assert.throws(() => createStoryBattleRequest(state, 'green-capital'), /隣接する敵領地/);

const before = troopCount(state);
const result = { version: 1, battleId: request.battleId, territoryId: request.territoryId,
  victory: true, casualties: [{ squadId: 1, count: 2 }, { squadId: squad.id, count: 3 }] };
const settled = settleStoryBattle(state, request, result);
assert.deepEqual(settled, { victory: true, losses: 5, participants: 50 });
assert.equal(troopCount(state), before - 5);
assert.equal(state.owners['border-town'], 'player');
assert.throws(() => settleStoryBattle(state, request, result), /すでに反映/);

const losing = createCampaign('敗北テスト');
colonize(losing, 'central-plains');
const losingRequest = createStoryBattleRequest(losing, 'border-town', { battleId: 'case-loss' });
const badResult = { version: 1, battleId: 'case-loss', territoryId: 'border-town', victory: false,
  casualties: [{ squadId: 1, count: 999 }] };
assert.throws(() => settleStoryBattle(losing, losingRequest, badResult), /損害情報/);
assert.equal(losing.squads[0].count, 30, '不正な損害では保存兵数を変えない');
const lost = settleStoryBattle(losing, losingRequest, { ...badResult, casualties: [{ squadId: 1, count: 7 }] });
assert.equal(lost.victory, false);
assert.equal(losing.owners['border-town'], 'crimson');
assert.equal(losing.squads[0].count, 23);

const reserves = createCampaign('予備兵テスト');
colonize(reserves, 'central-plains');
for (const s of reserves.squads) transferTroops(reserves, s.id, 'reserve', s.count);
assert.throws(() => createStoryBattleRequest(reserves, 'border-town'), /予備兵/);
console.log('Story 3D battle bridge / lanes / live orders / casualties: OK');
