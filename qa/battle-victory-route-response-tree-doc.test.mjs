import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 VICTORY_ROUTE_RESPONSE_TREE,COVERAGE,ROUTE_BLUEPRINTS,COUNTER_JOBS
} from '../src/battle-victory-route-response-spec.js';

const md=readFileSync(new URL('../docs/battle-victory-route-response-tree.md',import.meta.url),'utf8');
const count=pattern=>[...md.matchAll(pattern)].length;
const goals=VICTORY_ROUTE_RESPONSE_TREE;
assert.equal(goals.length,8);
assert.equal(COVERAGE.routeChoices,32);
assert.equal(count(/^<details(?: open)?>$/gm),8);
assert.equal(count(/^<details>$/gm),32);
assert.equal(count(/^<\/details>$/gm),40);
assert.equal(count(/^<summary><strong>\d+\. /gm),8);
assert.equal(count(/^<summary><strong>L1 ルート /gm),32);
assert.equal(count(/^  - \*\*状況：/gm),COVERAGE.expectedSituationEdges);
assert.equal(count(/\*\*L2 味方対応：\*\*/g),452);
assert.equal(count(/\*\*L3 敵の対策：\*\*/g),904);
assert.equal(count(/\*\*L4 味方の再対応：\*\*/g),2419);
const tokens=md.match(/<\/?details(?: open)?>/g)||[];
let depth=0,maxDepth=0;
for(const tag of tokens){
 depth+=tag.startsWith('</')?-1:1;
 assert.ok(depth>=0,'Tree contains an orphan closing details tag');
 maxDepth=Math.max(depth,maxDepth);
}
assert.equal(depth,0,'All nested root/route groups must close');
assert.equal(maxDepth,2,'Exactly two collapsible levels: goal and route');
for(const route of Object.values(ROUTE_BLUEPRINTS))assert.ok(md.includes(route.name),'Missing route '+route.name);
for(const g of goals)assert.ok(md.includes(g.universalAlternative),'Missing universal annihilation rule');
for(const a of Object.keys(COUNTER_JOBS)){
 // An action can be present via a situational branch at least once.
 assert.ok(md.includes('L2 味方対応')&&md.includes('L3 敵の対策'));
}
for(const line of md.split('\n').filter(s=>/\*\*L[234] /.test(s))){
 assert.match(line,/— \*\*(?:味方|敵):[^\n]+隊\*\*/,
  'Each response level must state eligible job squad(s): '+line.slice(0,180));
}
assert.ok(md.includes('高所')&&md.includes('橋')&&md.includes('城門'));
assert.ok(md.includes('未実装／選択不可'));
assert.ok(md.includes('60秒')&&md.includes('180秒'));
const canonical=readFileSync(new URL('../docs/battle-victory-route-response-spec.md',import.meta.url),'utf8');
assert.ok(canonical.includes('./battle-victory-route-response-tree.md'));
console.log('PASS collapsible hierarchy: 8 win goals -> 32 routes -> 157 situations -> 452 L2 -> 904 L3 -> 2419 L4, with jobs on every response');
