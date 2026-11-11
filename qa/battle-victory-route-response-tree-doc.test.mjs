import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 VICTORY_ROUTE_RESPONSE_TREE,COVERAGE,ROUTE_BLUEPRINTS
} from '../src/battle-victory-route-response-spec.js';

const md=readFileSync(new URL('../docs/battle-victory-route-response-tree.md',import.meta.url),'utf8');
const block=md.match(/```text\n([\s\S]*?)\n```/)?.[1];
assert.ok(block,'Plain-text hierarchical tree must be inside a single text code fence');
assert.ok(block.startsWith('勝利条件\n'));
const lines=block.split('\n');
const count=needle=>lines.filter(line=>line.includes(needle)).length;
const goalLines=lines.filter(line=>/^[├└]─ (敵軍殲滅|時間防衛|陣地制圧|攻城戦)/.test(line));
assert.equal(VICTORY_ROUTE_RESPONSE_TREE.length,8);
assert.equal(COVERAGE.routeChoices,32);
assert.equal(goalLines.length,8);
assert.equal(count('─ ルート：'),32);
assert.equal(count('─ 担当隊：'),32);
assert.equal(count('─ 戦況：'),32);
assert.equal(count('─ 味方の対応策：'),64);
assert.equal(count('─ 敵の対応策：'),128);
assert.equal(count('─ 味方の再対応策：'),256);
assert.ok(!md.includes('<details'),'No large nested HTML containers in the reader view');
assert.ok(!md.includes('<summary'),'No collapsible HTML in the reader view');
assert.ok(!md.includes('flowchart'),'No diagram replacing the simple tree');
assert.ok(!md.includes('|---|'),'No wide comparison tables');
assert.ok(!md.includes('：move（'),'Raw engine modes must use Japanese command labels');
for(const route of Object.values(ROUTE_BLUEPRINTS))
 assert.ok(md.includes(route.name),'Missing named route '+route.name);
for(const line of lines.filter(x=>/─ (味方の対応策|敵の対応策|味方の再対応策)：/.test(x))){
 assert.match(line,/（(?:味方|敵)：[^）]+隊[^）]*）/,
  'Each response must name eligible job squad(s): '+line.slice(0,200));
}
const canonical=readFileSync(new URL('../docs/battle-victory-route-response-spec.md',import.meta.url),'utf8');
assert.ok(canonical.includes('./battle-victory-route-response-tree.md'));
console.log('PASS readable ASCII tree: 8 goals, 32 routes, 32 situations, 64 ally actions, 128 enemy replies, 256 ally counter-counters with job labels');
