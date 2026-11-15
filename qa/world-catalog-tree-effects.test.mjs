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

test('large off-centre structures recenter the sun shadow target and keep light outside geometry',()=>{
 assert.match(source,/sun\.target\.position\.copy\(center\)/,'shadow target follows catalog world bounds');
 assert.match(source,/const sunOffset=Math\.max\(24,shadowHalf\*1\.4\)/,'sun distance scales with large objects');
 assert.match(source,/sun\.position\.copy\(center\)\.add\(new THREE\.Vector3/,'light moves with preview');
 assert.match(source,/sun\.shadow\.camera\.far=Math\.max\(500,sunOffset\*4\)/,'shadow depth range scales with preview');
 assert.match(source,/sun\.target\.updateMatrixWorld\(\);sun\.updateMatrixWorld\(\)/,'light matrices refreshed');
 const center={x:65,y:12,z:-35},half=Math.max(18,Math.hypot(100,100)*.6+24*.45);
 const offset=Math.max(24,half*1.4);
 const light={x:center.x+offset*.5,y:center.y+offset,z:center.z+offset*.4};
 assert.equal(light.x-center.x,offset*.5);
 assert.equal(light.z-center.z,offset*.4);
 assert(light.y>center.y+24,'light sits beyond top of tall castle');
});
test('returning to trees restores the original sun direction and target',()=>{
 assert.match(source,/sun\.target\.position\.set\(0,0,0\);sun\.position\.set\(10,20,8\);sun\.shadow\.camera\.far=500/);
});
