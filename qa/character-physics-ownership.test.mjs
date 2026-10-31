import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const visual=readFileSync(new URL('../src/cc0-town-npc-visuals.js',import.meta.url),'utf8');
const preview=readFileSync(new URL('../action-test.html',import.meta.url),'utf8');
test('death physics owns imported skeleton without clip overwrite',()=>{
 assert.match(visual,/if\(host\.userData\.physicsDeathActive\)\{/);
 assert.match(preview,/physicsDeathActive=name==='dead'/);
});
test('death collision samples deformed mesh and ordinary actions release physics ownership',()=>{
 assert.match(preview,/correctMeshFloor\(/);
 assert.match(preview,/physicsDeathActive=false/);
});
