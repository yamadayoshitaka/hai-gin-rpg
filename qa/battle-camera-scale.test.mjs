import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const menu=readFileSync(new URL('../index.html',import.meta.url),'utf8');

// One full-footprint tactical tile is a human STEP (~1 metre). Body height
// must remain a realistic 1.7-1.8m rather than being reduced to one tile.
assert.match(game,/const SIZE=13,CELL=1\.0/);
assert.match(game,/createCharacter\(\{job:appearanceJob,sex,height:sex==='female'\?1\.68:1\.78,jobs\}\)/);
assert.doesNotMatch(game,/createCharacter\(\{job:appearanceJob,sex,height:1\.02,jobs\}\)/);

// One authoritative camera setup: opening at the allied front, while a
// separate full-battle overview remains available as an intentional choice.
assert.match(game,/const cameraHome=\(actors\.find\(a=>a\.team===0\)\?\.root\.position\|\|openingFocus\)\.clone\(\)/);
assert.match(game,/const cameraCloseOffset=new THREE\.Vector3\(5,8,12\)/);
assert.match(game,/const cameraOverviewOffset=new THREE\.Vector3\(64,118,100\)/);
assert.equal((game.match(/\$\('camOverview'\)\.onclick=/g)||[]).length,1);
assert.equal((game.match(/\$\('camFollow'\)\.onclick=/g)||[]).length,1);
assert.equal((game.match(/\$\('camReset'\)\.onclick=/g)||[]).length,1);
assert.match(game,/if\(followCamera\)\{/);
assert.match(menu,/tactics-wireframe\.html\?army=100&amp;v=4\.4\.0/);
assert.match(menu,/tactics-wireframe\.html\?army=1000&amp;v=4\.4\.0/);

// One step per grid tile: adult body ~1.7-1.8 tiles tall and camera shows
// much more of each anatomical character at the normal battle starting view.
const distance=Math.hypot(5,8,12),heightAtDistance=2*distance*Math.tan(48*Math.PI/360);
assert.ok(1.78/heightAtDistance>.12);
assert.ok(1.68/1.0>1.6&&1.78/1.0<1.85);
console.log('PASS battle camera scale: 1m footstep grid, adult rigs, close opening view and overview');
