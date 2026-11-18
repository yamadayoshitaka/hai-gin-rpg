import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/character-system/hair-attachment-runtime.js',import.meta.url),'utf8');
test('scalp source is selected by actual head-bone skin weights, not body mesh vertex count',()=>{
 const start=source.indexOf('function fittedScalpSurface(');
 const end=source.indexOf('function fittedScalpFibers(',start);
 assert.ok(start>=0&&end>start,'fitted scalp source exists');
 const fn=source.slice(start,end);
 assert.match(fn,/headInfluenced\+\+/);
 assert.match(fn,/weight>=\.56/);
 assert.match(fn,/candidates\.sort\(\(a,b\)=>b\.headInfluenced-a\.headInfluenced/);
 assert.doesNotMatch(fn,/candidates\.sort\(\(a,b\)=>b\.vertices-a\.vertices\)/);
 assert.match(fn,/for\(const candidate of candidates\)/,'Retry anatomical source candidates');
 assert.match(fn,/if\(triangles\.length<90\)continue/,'Do not stop after a bald candidate');
});
