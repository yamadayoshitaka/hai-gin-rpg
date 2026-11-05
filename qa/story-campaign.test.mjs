import assert from 'node:assert/strict';
import {
  TERRITORIES, createCampaign, troopCount, maxSquads, isAdjacent,
  armyTroops, formationCapabilities, setFormationPurpose, setSquadCommander,
  recruit, colonize, attackTerritory, nextMonth,
  setSquadBuff, trainCommander, assignCommander,
} from '../src/story-campaign.js';

const game = createCampaign('テスト軍師');
assert.equal(game.commander.name, 'テスト軍師');
assert.equal(troopCount(game), 40);
assert.equal(armyTroops(game, 'player'), 40);
assert.equal(maxSquads(game), 2);
assert.equal(TERRITORIES.length, 12);
assert.ok(TERRITORIES.every(t => Number.isFinite(t.mapX) && Number.isFinite(t.mapY)));
assert.ok(isAdjacent('silver-capital', 'central-plains'));
assert.ok(!isAdjacent('silver-capital', 'flame-fort'));
assert.ok(formationCapabilities(game).abilities.includes('突破攻撃'));

assert.throws(() => recruit(game, { job: '騎士', rarity: 'UR', count: 10, purpose: '前線' }), /軍師レベル/);
recruit(game, { job: '忍者', rarity: 'N', count: 10, purpose: '環境' });
assert.ok(formationCapabilities(game).abilities.includes('鉤縄・罠設置'));
assert.equal(formationCapabilities(game).counts['忍者'], 10);
assert.throws(() => recruit(game, { job: '騎士', rarity: 'N', count: 60, purpose: '前線' }), /上限は100人/);
const cost = recruit(game, { job: '僧侶', rarity: 'N', count: 25, purpose: '補助' });
assert.equal(cost, 250);
assert.equal(armyTroops(game), 75);
setFormationPurpose(game, 'player', '環境');
assert.equal(game.commander.purpose, '環境');
setSquadBuff(game, 1, 'rally');
assert.throws(() => setSquadBuff(game, 1, 'assault'), /レベルでは/);

colonize(game, 'central-plains');
assert.equal(game.owners['central-plains'], 'player');
assert.throws(() => colonize(game, 'northern-cliff'), /開拓できる/);

trainCommander(game, '副軍師');
assert.equal(game.commanders.length, 1);
assert.equal(armyTroops(game, 1), 0);
assert.throws(() => trainCommander(game, '追加軍師'), /部隊数上限/);
recruit(game, { job: '騎士', rarity: 'N', count: 100, purpose: '前線', commanderId: 1 });
assert.equal(armyTroops(game, 1), 100);
assert.throws(() => setSquadCommander(game, 3, 1), /上限100人/);
assert.throws(() => recruit(game, { job: '騎士', rarity: 'N', count: 1, purpose: '前線', commanderId: 1 }), /上限は100人/);
assignCommander(game, 1, 'western-pass');
assert.equal(game.commanders[0].territory, 'western-pass');
assert.throws(() => assignCommander(game, 1, 'green-capital'), /自領地/);

const battle = attackTerritory(game, 'border-town', () => 0);
assert.equal(battle.victory, true);
assert.equal(game.owners['border-town'], 'player');
assert.ok(battle.losses > 0);
assert.ok(game.commander.level >= 2);

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
console.log('Story campaign v0.4 / army mix / castle map: OK');
