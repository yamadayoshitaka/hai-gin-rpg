import assert from 'node:assert/strict';
import {
  TERRITORIES, createCampaign, troopCount, maxSquads, isAdjacent,
  recruit, colonize, attackTerritory, nextMonth,
  setSquadPurpose, setSquadBuff, trainCommander, assignCommander,
} from '../src/story-campaign.js';

const game = createCampaign('テスト軍師');
assert.equal(game.commander.name, 'テスト軍師');
assert.equal(troopCount(game), 150);
assert.equal(maxSquads(game), 2);
assert.equal(TERRITORIES.length, 12);
assert.ok(isAdjacent('silver-capital', 'central-plains'));
assert.ok(!isAdjacent('silver-capital', 'flame-fort'));

assert.throws(() => recruit(game, { job: '騎士', rarity: 'UR', count: 10, purpose: '前線' }), /軍師レベル/);
assert.throws(() => recruit(game, { job: '忍者', rarity: 'N', count: 10, purpose: '環境' }), /部隊数上限/);
assert.throws(() => recruit(game, { job: '騎士', rarity: 'N', count: 100, purpose: '前線' }), /部隊数上限/);
const cost = recruit(game, { job: '僧侶', rarity: 'N', count: 25, purpose: '補助' });
assert.equal(cost, 250);
assert.equal(troopCount(game), 175);
setSquadPurpose(game, 1, '環境');
assert.equal(game.squads[0].purpose, '環境');
setSquadBuff(game, 1, 'rally');
assert.throws(() => setSquadBuff(game, 1, 'assault'), /軍師レベル/);

colonize(game, 'central-plains');
assert.equal(game.owners['central-plains'], 'player');
assert.throws(() => colonize(game, 'northern-cliff'), /開拓できる/);
const battle = attackTerritory(game, 'border-town', () => 0);
assert.equal(battle.victory, true);
assert.equal(game.owners['border-town'], 'player');
assert.ok(battle.losses > 0);
assert.ok(game.commander.level >= 2);

trainCommander(game, '副軍師');
assert.equal(game.commanders.length, 1);
assignCommander(game, 1, 'western-pass');
assert.equal(game.commanders[0].territory, 'western-pass');
assert.throws(() => assignCommander(game, 1, 'green-capital'), /自領地/);

const weak = createCampaign('弱小軍');
weak.squads = [{ id: 1, job: '騎士', rarity: 'N', count: 1, purpose: '前線', buff: 'rally' }];
colonize(weak, 'central-plains');
const loss = attackTerritory(weak, 'border-town', () => 0);
assert.equal(loss.victory, false);
assert.equal(weak.commander.active, false);
assert.equal(troopCount(weak), 0);
nextMonth(weak, () => 0);
assert.equal(weak.commander.active, true);

const insolvent = createCampaign('財政破綻');
insolvent.treasury = 1;
insolvent.squads[0].count = 1000;
nextMonth(insolvent, () => 0);
assert.match(insolvent.gameOver, /資金/);

assert.throws(() => createCampaign('   '), /名前/);
console.log('Story campaign rules: OK');
