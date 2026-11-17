import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CrowdPerformanceBudget} from '../src/crowd-performance-budget.js';
import {AdaptiveBattleResolution} from '../src/adaptive-battle-resolution.js';
import {crowdRequires3DFromOverhead,useCrowdImpostor} from '../src/crowd-lod-policy.js';
import * as THREE from 'three';
import {deriveGarmentCoverage} from '../src/character-system/garment-coverage-runtime.js';

// The reported Android case: 1000v1000, 12 FPS and 4790 draw calls.
// Reduce draw submissions before offering higher pixel resolution.
const dense=new CrowdPerformanceBudget({targetFps:45,minPx:52,maxPx:100});
assert.equal(dense.enterPx,52);
assert.equal(dense.sample({fps:12,fullMeshVisible:113,drawCalls:4790}),70);
assert.equal(dense.sample({fps:12,fullMeshVisible:113,drawCalls:4790}),88);
assert.equal(dense.sample({fps:12,fullMeshVisible:113,drawCalls:4790}),100);
assert.equal(dense.sample({fps:12,fullMeshVisible:113,drawCalls:4790}),100);
assert.equal(useCrowdImpostor(95,false,dense.enterPx),true,
  'crowd source 224px atlas can render a 95px distant silhouette');
assert.equal(crowdRequires3DFromOverhead(100,.9,110),false);
assert.equal(crowdRequires3DFromOverhead(118,.9,110),true);
for(let i=0;i<24;i++)dense.sample({fps:60,drawCalls:180,fullMeshVisible:24});
assert.equal(dense.enterPx,64,'the full 3D mesh tier recovers only after stable FPS');

// High-quality output is earned by recovered frame time, not forced at 12 FPS.
const adaptive=new AdaptiveBattleResolution({
 maxRatio:1.14,minRatio:.74,initialRatio:.92,targetFps:45,
 intervalMs:1000
});
assert.equal(adaptive.getStats().ratio,.92);
for(let i=0;i<4;i++)adaptive.sample({fps:60,p95Ms:16,nowMs:1000*i});
assert.ok(adaptive.getStats().ratio>.92,'recover original rendering resolution');
for(let i=0;i<60;i++)adaptive.sample({fps:60,p95Ms:16,nowMs:4000+1000*i});
assert.equal(adaptive.getStats().ratio,1.14,'bounded upscale never exceeds safe cap');
for(let i=0;i<4;i++)adaptive.sample({fps:12,p95Ms:129,nowMs:65000+1000*i});
assert.ok(adaptive.getStats().ratio<1.14,'slow GPU reduces fill rate before models');
assert.throws(()=>new AdaptiveBattleResolution({maxRatio:1,minRatio:.8,initialRatio:1.1}));

// A real two-legged skinned fabric is an opaque envelope; no invisible
// naked thigh/calf skin needs to be uploaded behind it.
const dressed=new THREE.Group();
const pants=new THREE.SkinnedMesh(new THREE.BoxGeometry(1,1,1),
 new THREE.MeshStandardMaterial({name:'MI_Peasant_Cloth'}));
pants.name='Male_Peasant_Legs';
dressed.add(pants);
const coverage=deriveGarmentCoverage({dressed});
assert.ok(coverage.enclosedRegions.includes('thigh'));
assert.ok(coverage.enclosedRegions.includes('calf'));
assert.ok(!coverage.enclosedRegions.includes('foot'),
 'bare feet must never be deleted without actual footwear');

const army=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
const mask=readFileSync(new URL('../src/character-system/garment-coverage-runtime.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(army,/layer\.visible=visible>0/,'zero-count full-mesh batches are not submitted');
assert.match(army,/impostor\.mesh\.visible=farVisible>0/,'zero-count image batches are not submitted');
assert.match(army,/const fittedBefore=representative\.outfit\.getHairState/,'bake complete source wig');
assert.match(army,/studioHairRoot\.visible=false/,'exclude sparse studio middle groom from dense army');
assert.match(army,/studioHairRoot\.visible=studioHairBefore/,'restore original studio hair after GPU bake');
assert.match(mask,/protectedEdge\[i\]=exposedWeight>=\.56/,
 'face/neck/hand seams are protected from opaque clothing culling');
assert.match(game,/initialBattlePixelRatio/);
assert.match(game,/minPx:52,maxPx:100/);
console.log('PASS mass 2000 crowd: no bald photo / clothed-only skin / GPU batch and recovery-first pixel ratio');
