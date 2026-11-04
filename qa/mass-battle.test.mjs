import assert from 'node:assert/strict';
import { MassBattleSimulation, JOBS, isWalkable } from '../src/mass-battle-sim.js';

for (const sideCount of [50, 200, 500, 1000]) {
  const sim = new MassBattleSimulation(sideCount, 20261104);
  assert.equal(sim.units.length, sideCount * 2, '人数');
  assert.deepEqual(sim.live, [sideCount, sideCount], '人数の内訳');
  assert.ok(sim.units.every(u => JOBS[u.jobIndex] && isWalkable(u.x, u.z)), '職業・初期位置');
  const initial = new Set(sim.units.map(u => `${u.x.toFixed(3)}:${u.z.toFixed(3)}`));
  assert.equal(initial.size, sideCount * 2, '開始地点が重複していない');
  const first = sim.units[0];
  const repeat = new MassBattleSimulation(sideCount, 20261104);
  assert.deepEqual(first, repeat.units[0], '同じシードは同じ初期データ');
  const started = performance.now();
  for (let t = 0; t < 15; t++) sim.step(0.1);
  const duration = performance.now() - started;
  assert.ok(sim.units.filter(u => u.alive).every(u => isWalkable(u.x, u.z)), '水面に侵入しない');
  assert.equal(sim.live[0] + sim.live[1], sim.units.filter(u => u.alive).length, '死亡集計');
  assert.equal(sim.getStats().tickCount, 15);
  console.log(`${sideCount}対${sideCount}: 初期化・15フレーム成功 / ${duration.toFixed(1)}ms / 平均${(duration/15).toFixed(2)}ms/tick`);
}

const battle = new MassBattleSimulation(50, 123);
for (let t = 0; t < 260; t++) battle.step(0.1);
assert.ok(battle.attacks > 0, '両軍は接触して攻撃を開始する');
console.log(`50対50で26秒進行: ${battle.attacks}回攻撃 / 生存 ${battle.live.join('対')}`);
console.log('大規模戦闘テスト OK');
