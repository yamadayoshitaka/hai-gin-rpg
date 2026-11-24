import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const html=readFileSync(new URL('../face-neutral-v121.html',import.meta.url),'utf8');
test('v121 wig buttons use three real CC0 GLBs plus bald, never legacy meshes',()=>{
 for(const id of ['none','bob01','long01','ponytail01'])
  assert.match(html,new RegExp('data-wig="'+id+'"'));
 assert.match(html,/PUBLIC_WIG_SOURCES/);
 assert.match(html,/assets\/wigs\/cc0\//);
 assert.match(html,/new GLTFLoader\(\)/);
 assert.match(html,/extractUnskinnedWig\(THREE,gltf\.scene\)/);
 assert.match(html,/measureWigCrown\(THREE,isolated\.root,isolated\.bounds\)/);
 assert.match(html,/calculateWigFit\(isolated\.bounds,wigHead,/);
 assert.match(html,/buildFittedScalpCap\(THREE,wigHead,/);
});
test('wig swap releases existing meshes, ignores stale requests, and persists selection',()=>{
 assert.match(html,/removeCurrentWig\(\); \/\/ do not stack old\/new wigs/);
 assert.match(html,/const ticket=\+\+wigRequestId/);
 assert.match(html,/if\(ticket!==wigRequestId\)return/);
 assert.match(html,/scene\.remove\(wigRoot\)/);
 assert.match(html,/o\.geometry\?\.dispose\(\)/);
 assert.match(html,/window\.localStorage\.setItem\(WIG_STORE_KEY,style\)/);
 assert.match(html,/selectWig\(restoreWigChoice\(\)\)/);
 assert.match(html,/wigRoot\.userData\.scalpCap\?\.userData\?\.dispose/);
});
test('face above nasal base stays isolated and expressions/sliders remain disabled',()=>{
 assert.match(html,/sourceURL=.*compact-mouth-v27/);
 assert.doesNotMatch(html,/import .*face-v121-expression-player/);
 assert.doesNotMatch(html,/import .*face-v121-parametric-sliders/);
 assert.doesNotMatch(html,/<div id="v121-tuning"/);
 assert.doesNotMatch(html,/<div id="v121-expressions"/);
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(script,'face 3D module missing');
 const check=spawnSync(process.execPath,['--input-type=module','--check'],
  {input:script[1],encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});

import {scalpIndexWithoutCovered} from '../src/wig-glb-fit-v1.js';
test('scalp removal is reversible and leaves non-covered faces and original index unchanged',()=>{
 const master=new Uint32Array([0,1,2,2,3,4,5,6,7]);
 const masked=scalpIndexWithoutCovered(master,[1]);
 assert.deepEqual([...masked],[0,1,2,5,6,7]);
 assert.deepEqual([...master],[0,1,2,2,3,4,5,6,7]);
 assert.match(html,/face\.geometry\.setIndex\(fullScalpIndex\)/);
 assert.match(html,/applyScalpVisibility\(\)/);
});
