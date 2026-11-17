import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Headwear masks are per-instance GPU geometry; source GLB hair must remain
// shared across 50v50 and 1000v1000 actors. This is a source ownership guard,
// NOT a substitute for WebGL image / Android FPS sign-off.
const source=readFileSync(new URL('../src/character-system/hair-attachment-runtime.js',import.meta.url),'utf8');

test('headwear transitions restore every original before disposing temporary clips',()=>{
 assert.match(source,/const ownedMasks=new Set\(\)/);
 assert.match(source,/function releaseMasks\(\)\{for\(const geometry of ownedMasks\)geometry\.dispose\(\);ownedMasks\.clear\(\)\}/);
 assert.match(source,/function trackMask\(geometry,original\)\{if\(geometry!==original\)ownedMasks\.add\(geometry\);return geometry\}/);
 assert.match(source,/for\(const item of hairMeshes\)item\.mesh\.geometry=item\.original;[\s\S]*?crown\.geometry=crownGeometry;[\s\S]*?if\(scalpFibers\)scalpFibers\.geometry=scalpFibersGeometry;[\s\S]*?releaseMasks\(\)/);
});
test('all clipped hair/scalp assets participate in owned mask cleanup',()=>{
 assert.match(source,/item\.mesh\.geometry=trackMask\(clipped\.geometry,item\.original\)/);
 assert.match(source,/crown\.geometry=trackMask\(cut\.geometry,crownGeometry\)/);
 assert.match(source,/scalpFibers\.geometry=trackMask\(fibers\.geometry,scalpFibersGeometry\)/);
 assert.match(source,/dispose\(\)\{bone\.remove\(hairRoot\);releaseMasks\(\);crownGeometry\.dispose\(\)/);
 assert.doesNotMatch(source,/item\.original\.dispose\(\)/);
});
