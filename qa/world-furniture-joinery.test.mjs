import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
const table=src.match(/if\(id==='cottage_table_001'\)\{([\s\S]*?)\n  \}/)?.[1];
const chair=src.match(/if\(id==='cottage_chair_001'\)\{([\s\S]*?)\n  \}/)?.[1];
test('solid timber table has multiple physical boards, aprons and load bearing legs',()=>{
 assert(table,'table geometry path');
 assert.match(table,/plankWidths=\[/);
 assert.match(table,/for\(const z of \[-\.52,\.52\]\)/);
 assert.match(table,/for\(const x of \[-\.82,\.82\]\)for\(const z of \[-\.46,\.46\]\)/);
 assert.match(table,/brace\.rotation\.z/);
 assert.doesNotMatch(table,/b\(2\*c,\.13\*c,1\.25\*c/);
});
test('chair has grounded legs, open spindle back and separate structural rails',()=>{
 assert(chair,'chair geometry path');
 assert.match(chair,/rear\?1\.32:\.48/);
 assert.match(chair,/for\(let i=0;i<3;i\+\+\)/);
 assert.match(chair,/for\(const y of \[\.84,1\.25\]\)/);
 assert.match(chair,/for\(const x of \[-\.18,0,\.18\]\)/);
 assert.doesNotMatch(chair,/b\(\.7\*c,\.83\*c,\.11\*c/);
});
