import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('headwear occlusion replaces and disposes only owned masks on repeated changes',()=>{
 const src=fs.readFileSync('src/character-system/hair-attachment-runtime.js','utf8');
 assert.match(src,/const ownedMasks=new Map\(\)/);
 assert.match(src,/if\(previous&&previous!==nextGeometry\)previous\.dispose\(\)/);
 assert.match(src,/replaceMaskedGeometry\(item\.mesh,item\.original,null\)/);
 assert.match(src,/replaceMaskedGeometry\(item\.mesh,item\.original,clipped\.geometry\)/);
 assert.match(src,/replaceMaskedGeometry\(crown,crownGeometry,cut\.geometry\)/);
 assert.match(src,/replaceMaskedGeometry\(scalpFibers,scalpFibersGeometry,fibers\.geometry\)/);
 assert.match(src,/for\(const geometry of ownedMasks\.values\(\)\)geometry\.dispose\(\)/);
 assert.match(src,/mesh\.geometry=source/);
});
