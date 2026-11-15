import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/tree-seasons.js',import.meta.url),'utf8');

test('catalog selection hides the independent tree damage effect group',()=>{
 assert.match(source,/const effectRoot=new THREE\.Group\(\);scene\.add\(effectRoot\)/);
 assert.match(source,/tree\.visible=!catalogItem;effectRoot\.visible=!catalogItem;floor\.visible=!catalogItem/);
 assert.match(source,/function showCatalogSelection\(\)/);
 assert.match(source,/function setEffect\(name\)/);
});
test('returning to a tree restores the damage group and refreshes its selected effect',()=>{
 assert.match(source,/showCatalogSelection\(\);flowerTree=\$\('object'\)\.value==='flower_tree';buildSeason\(\$\('season'\)\.value\);setEffect\(\$\('effect'\)\.value\)/);
});
