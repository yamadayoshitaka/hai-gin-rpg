import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 DISTANT_CARD_ENTER_PX,DISTANT_CARD_EXIT_PX,
 projectedSoldierHeightPx
} from '../src/skirmish-distance-impostors.js';

const camera={isPerspectiveCamera:true,fov:50,getEffectiveFOV(){return 50}};
const near=projectedSoldierHeightPx(camera,1000,45);
const far=projectedSoldierHeightPx(camera,1000,250);
assert.ok(near>DISTANT_CARD_EXIT_PX,
 'At 45m in a portrait phone, the clothed soldier is too large for a shared job photo');
assert.ok(far<DISTANT_CARD_ENTER_PX,
 'Far tiny soldiers may use inexpensive shared photos');
assert.ok(DISTANT_CARD_EXIT_PX>DISTANT_CARD_ENTER_PX+10,
 'Impostor transition must have a hysteresis gap to avoid LOD flicker');
assert.ok(projectedSoldierHeightPx(camera,500,45)<near,
 'CSS viewport height rather than raw device pixel ratio drives screen-space LOD');
assert.equal(projectedSoldierHeightPx(camera,1000,0),Infinity);
assert.ok(projectedSoldierHeightPx({isOrthographicCamera:true,zoom:1,top:10,bottom:-10},1000,5)>50);

const lod=readFileSync(new URL('../src/skirmish-distance-impostors.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const hair=readFileSync(new URL('../src/character-system/hair-attachment-runtime.js',import.meta.url),'utf8');
const outfit=readFileSync(new URL('../src/character-system/rigged-outfit-runtime.js',import.meta.url),'utf8');
assert.match(lod,/const wasCard=!!a\._distantCard/);
assert.match(lod,/projected>\(wasCard\?DISTANT_CARD_EXIT_PX:DISTANT_CARD_ENTER_PX\)/);
assert.match(game,/createSkirmishDistanceLod\(scene,renderer,actors,\{threshold:45\}\)/);
assert.match(game,/await prewarmBattleStudioHair\(\)/,
 'The middle haircut must be baked before the battle starts, not several seconds later');
assert.match(game,/if\(i%2===1\)await new Promise\(resolve=>setTimeout\(resolve,0\)\)/);
assert.match(game,/prewarmedStudioGrooms/);
assert.match(game,/hairNow-lastStudioHairSelectionAt>=280/);
assert.match(game,/bakeInterval=p95>33\?1400:p95>25\?850:350/);
assert.match(hair,/lod\.autoUpdate=false/,'No camera-controlled asset downgrade may reveal the scalp');
assert.match(hair,/const paths=\[0\]\.map/,'The full fitted hairstyle is loaded only once');
assert.match(outfit,/useSourceSkinnedLegs=\(lowDetail\|\|studioPreferSkinnedLegs\)/,
 'Keep imported 65-bone legs instead of pipe-shaped LOD placeholders');
assert.match(outfit,/retainedAsSkinnedTrouser=true/);
assert.match(game,/rigged-outfit-runtime\.js\?v=20261117-flatback-off4/);
assert.match(game,/skirmish-distance-impostors\.js\?v=20261117-stable-hair2/);
assert.match(outfit,/hair-attachment-runtime\.js\?v=20261116-silhouette-lod1/);
console.log('PASS: 50v50 projected-size photo gate, stable identical hairstyles, skinned legs and FPS-aware prewarm');
