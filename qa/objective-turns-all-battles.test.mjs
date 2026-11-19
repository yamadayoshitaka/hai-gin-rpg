// Former objective-turn integration QA: battle mode is now fully real-time.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const realtime=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
const group=readFileSync(new URL('../src/battle-three-group-panel.js',import.meta.url),'utf8');
assert.match(html,/const objectiveTurnUI=null/);
assert.doesNotMatch(html,/import \{installObjectiveTurnPanel\}/);
assert.doesNotMatch(html,/objectiveTurnUI\.begin\(\)/);
assert.doesNotMatch(html,/objectiveTurnUI\.update\(/);
assert.match(html,/createRealtimeBattleCommands/);
assert.match(html,/realtimeCommandUI\?\.openDeployment\(\)/);
assert.match(html,/setBattlePaused\(false\)/);
assert.match(html,/onMove:\(id,point\)=>/);
assert.match(html,/getBattleRealtimeQA/);
assert.match(html,/const threeGroupPanel=!TOWN_MODE\?createBattleThreeGroupPanel/);
assert.match(group,/allowRecompose=true/);
assert.match(realtime,/realtimeBattleCanvas/);
assert.match(realtime,/realtimeSquadSelect/);
assert.match(css,/body\.battle-realtime-clean #battleTopDock/);
assert.match(css,/body\.battle-realtime-clean #battleObjectiveTurnStatus/);
for(const file of ['src/battle-realtime-commands.js','src/battle-three-group-panel.js']){
 const code=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 new SourceTextModule(code,{identifier:file});
}
const scripts=[...html.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length);
for(const entry of scripts)new SourceTextModule(entry[1],{identifier:'battle-inline'});
console.log('PASS: turn controller unmounted, one-time deployment, continuous map orders, clear viewport');
