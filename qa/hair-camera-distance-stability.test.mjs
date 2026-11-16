import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('tactics-wireframe.html');
const hair=read('src/character-system/hair-attachment-runtime.js');
const graft=read('src/character-system/battle-artist-head-graft.js');
const distance=read('src/skirmish-distance-impostors.js');
const skirmish=read('src/combat-action-runtime.js');
const mass=read('src/mass-battle-grid-sim.js');

const prewarm=page.slice(page.indexOf('async function prewarmBattleStudioHair()'),
 page.indexOf('/**\n * All soldiers retain their ORIGINAL studio-cut middle haircut'));
const refresh=page.slice(page.indexOf('function refreshBattleStudioGroom('),
 page.indexOf('window.getBattleStartupStats=()'));
assert.ok(prewarm.includes(".sort((a,b)=>a.d-b.d);"));
assert.ok(!prewarm.includes('.slice(0,STUDIO_GROOM_MAX)'),
 'Prewarm all 100 middle grooms; never make moving camera wait for a missing hairstyle');
assert.match(hair,/const paths=\[0\]\.map/,'Only one complete GLB hair asset is needed');
assert.match(hair,/lod\.autoUpdate=false/,'Renderer never downgrades to a sparse bald far-LOD');
assert.match(hair,/hairRoot\.add\(crown,lod\)/,'Scalp-colored underlay is always present');
assert.match(graft,/studioWigVariants/,'Near geometry caches coexist with middle geometry');
assert.match(graft,/for\(const cached of variants.values\(\)\)cached.root.visible=/,
 'Near vs middle switches are instant, not a network or geometry rebuild');
assert.match(graft,/export function discardBattleStudioNearHair\(/);
assert.ok(!refresh.includes('releaseBattleStudioHair('),
 'Camera motion must NEVER free the visible middle hairstyle');
assert.ok(refresh.includes("quality:'middle'"),'Near demotes to already-baked middle');
assert.ok(refresh.includes("quality:'near'"),'Near visible characters receive finer strands');
assert.ok(refresh.includes('p95>35'),'Near refinement yields to FPS pressure without stripping hair');
assert.match(distance,/DISTANT_CARD_ENTER_PX=26/);
assert.match(distance,/DISTANT_CARD_EXIT_PX=40/);
assert.match(distance,/a\.isStrategist\|\|a\.isPlayerHero/);
assert.match(page,/mountInteriorMask=createMountInteriorMask/);
assert.match(skirmish,/groundMountAllowed/);
assert.match(mass,/_prepareMountedEntry\(/);
console.log('PASS: normal hair never disappears across camera distance, near detail is cached, mounted units stay outdoors');
