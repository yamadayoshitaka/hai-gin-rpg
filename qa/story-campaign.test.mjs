import assert from 'node:assert/strict';
import {
  TERRITORIES, createCampaign, troopCount, maxSquads, isAdjacent,
  armyTroops, reserveTroops, deployedTroopCount, AUTO_FORMATIONS, autoFormArmy,
  formationCapabilities, setFormationPurpose, setSquadCommander, transferTroops,
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
assert.ok(formationCapabilities(game).attack > 0);
assert.ok(formationCapabilities(game).defense > 0);
assert.ok(formationCapabilities(game).mobility > 0);

assert.throws(() => recruit(game, { job: '騎士', rarity: 'UR', count: 10, purpose: '前線' }), /軍師レベル/);
recruit(game, { job: '忍者', rarity: 'N', count: 10, purpose: '環境' });
assert.ok(formationCapabilities(game).abilities.includes('鉤縄・罠設置'));
assert.equal(formationCapabilities(game).counts['忍者'], 10);
assert.ok(formationCapabilities(game).mobility > formationCapabilities(createCampaign('対照軍')).mobility);
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
assert.throws(() => transferTroops(game, 3, 1, 4), /上限100人/);
assert.throws(() => recruit(game, { job: '騎士', rarity: 'N', count: 1, purpose: '前線', commanderId: 1 }), /上限は100人/);
assignCommander(game, 1, 'western-pass');
assert.equal(game.commanders[0].territory, 'western-pass');
assert.throws(() => assignCommander(game, 1, 'green-capital'), /自領地/);

const battle = attackTerritory(game, 'border-town', () => 0);
assert.equal(battle.victory, true);
assert.equal(game.owners['border-town'], 'player');
assert.ok(battle.losses > 0);
assert.ok(game.commander.level >= 2);

const transferGame = createCampaign('編成テスト');
trainCommander(transferGame, '新軍師');
recruit(transferGame, { job: '忍者', rarity: 'N', count: 10, purpose: '環境' });
const original = troopCount(transferGame);
transferTroops(transferGame, 3, 1, 4);
assert.equal(armyTroops(transferGame, 1), 4);
assert.equal(armyTroops(transferGame, 'player'), original - 4);
assert.equal(troopCount(transferGame), original);
assert.equal(formationCapabilities(transferGame, 1).counts['忍者'], 4);

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

// New v0.6 hierarchy: unattached soldiers sit in the top-level pool.
const hierarchy = createCampaign('階層テスト');
trainCommander(hierarchy, '独立軍師');
for (const job of ['騎士','盾騎士','忍者','シーフ','僧侶','魔法使い','召喚士','格闘家']) {
  recruit(hierarchy, { job, rarity: 'N', count: 20, purpose: '前線', commanderId: 'reserve' });
}
assert.equal(reserveTroops(hierarchy), 160);
assert.equal(deployedTroopCount(hierarchy), 40);
assert.equal(troopCount(hierarchy), 200);
const reserveNinja = hierarchy.squads.find(s => s.job === '忍者' && s.commanderId === 'reserve');
transferTroops(hierarchy, reserveNinja.id, 1, 8);
assert.equal(armyTroops(hierarchy, 1), 8);
assert.equal(reserveTroops(hierarchy), 152);
const deputyArmy = JSON.stringify(hierarchy.squads.filter(s => String(s.commanderId) === '1'));
const attacker = structuredClone(hierarchy), defender = structuredClone(hierarchy), runner = structuredClone(hierarchy);
for (const priority of AUTO_FORMATIONS) {
  const temp = structuredClone(hierarchy);
  assert.equal(autoFormArmy(temp, 'player', priority), 100);
  assert.equal(armyTroops(temp, 'player'), 100);
  assert.equal(armyTroops(temp, 1), 8);
  assert.equal(reserveTroops(temp), 92);
  assert.equal(troopCount(temp), 200);
  assert.equal(JSON.stringify(temp.squads.filter(s => String(s.commanderId) === '1')), deputyArmy);
  assert.ok(temp.squads.every(s => s.count > 0));
}
autoFormArmy(attacker, 'player', '攻撃重視');
autoFormArmy(defender, 'player', '防御重視');
autoFormArmy(runner, 'player', '機動重視');
assert.ok(formationCapabilities(attacker).attack > formationCapabilities(defender).attack);
assert.ok(formationCapabilities(defender).defense > formationCapabilities(attacker).defense);
assert.ok(formationCapabilities(runner).mobility > formationCapabilities(defender).mobility);
assert.throws(() => autoFormArmy(hierarchy, 'reserve', '均衡'), /軍師/);
assert.throws(() => autoFormArmy(hierarchy, 'player', '未知の方針'), /方針/);
const firstAssigned = attacker.squads.find(s => s.commanderId === 'player');
transferTroops(attacker, firstAssigned.id, 'reserve', Math.min(5, firstAssigned.count));
assert.equal(troopCount(attacker), 200);
assert.equal(armyTroops(attacker, 1), 8);

// Hired but unassigned soldiers must not fight, be injured or defend territory.
const reserveOnly = createCampaign('待機軍師');
reserveOnly.squads.forEach(s => { s.commanderId = 'reserve'; });
colonize(reserveOnly, 'central-plains');
assert.equal(deployedTroopCount(reserveOnly), 0);
assert.throws(() => attackTerritory(reserveOnly, 'border-town'), /予備兵/);
assert.equal(reserveTroops(reserveOnly), 40);
console.log('Story campaign v0.6 / reserve pool / auto formation / battlefield isolation: OK');
