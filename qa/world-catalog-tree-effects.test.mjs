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

test('large catalog buildings expand the directional shadow camera beyond tree-sized limits',()=>{
 assert.match(source,/const shadowHalf=Math\.max\(18,Math\.hypot\(size\.x,size\.z\)\*\.6\+size\.y\*\.45\)/);
 assert.match(source,/sun\.shadow\.camera\.left=-shadowHalf;sun\.shadow\.camera\.right=shadowHalf/);
 assert.match(source,/sun\.shadow\.camera\.top=shadowHalf;sun\.shadow\.camera\.bottom=-shadowHalf/);
 assert.match(source,/sun\.shadow\.camera\.updateProjectionMatrix\(\);sun\.shadow\.needsUpdate=true/);
 const castle={x:100,y:24,z:100};
 const half=Math.max(18,Math.hypot(castle.x,castle.z)*.6+castle.y*.45);
 assert(half>80,'100x100 castle must fit a much larger sun-shadow region than the 26 m tree frustum');
});
test('tree selection restores the smaller shadow map projection for better detail',()=>{
 assert.match(source,/sun\.shadow\.camera\.left=-18;sun\.shadow\.camera\.right=18;sun\.shadow\.camera\.top=18;sun\.shadow\.camera\.bottom=-18/);
});
