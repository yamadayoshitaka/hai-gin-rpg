import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const menu=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const module of ['../src/mass-battle-real-army.js','../src/mass-battle-grid-sim.js']){
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(module,import.meta.url))]);
}

// One full-footprint tactical tile is a human STEP (~1 metre). Body height
// must remain a realistic 1.7-1.8m rather than being reduced to one tile.
assert.match(game,/const SIZE=13,CELL=1\.0/);
assert.match(game,/createCharacter\(\{job:appearanceJob,sex,height:sex==='female'\?1\.68:1\.78,jobs\}\)/);
assert.doesNotMatch(game,/createCharacter\(\{job:appearanceJob,sex,height:1\.02,jobs\}\)/);

// Start at the central bridge with no northern castle wall blocking the view,
// while a separate full-battle overview remains a deliberate user choice.
assert.match(game,/const centralAlly=actors\.filter\(a=>a\.team===0\)\.sort\(/);
assert.match(game,/Math\.abs\(a\.cell\.z-116\)-Math\.abs\(b\.cell\.z-116\)/);
assert.match(game,/const cameraHome=\(centralAlly\?\.root\.position\|\|openingFocus\)\.clone\(\)/);
assert.match(game,/const cameraCloseOffset=new THREE\.Vector3\(5,8,12\)/);
assert.match(game,/const cameraOverviewOffset=new THREE\.Vector3\(64,118,100\)/);
assert.equal((game.match(/\$\('camOverview'\)\.onclick=/g)||[]).length,1);
assert.equal((game.match(/\$\('camFollow'\)\.onclick=/g)||[]).length,1);
assert.equal((game.match(/\$\('camReset'\)\.onclick=/g)||[]).length,1);
assert.match(game,/if\(followCamera\)\{/);
const runtimeVersion=game.match(/version:'(\d+\.\d+\.\d+)'/)?.[1];
assert.ok(runtimeVersion,'Battle runtime must advertise a version');
assert.ok(menu.includes('tactics-wireframe.html?army=100&amp;v='+runtimeVersion));
assert.ok(menu.includes('tactics-wireframe.html?army=1000&amp;v='+runtimeVersion));

// One step per grid tile: adult body ~1.7-1.8 tiles tall and camera shows
// much more of each anatomical character at the normal battle starting view.
const distance=Math.hypot(5,8,12),heightAtDistance=2*distance*Math.tan(48*Math.PI/360);
assert.ok(1.78/heightAtDistance>.12);
assert.ok(1.68/1.0>1.6&&1.78/1.0<1.85);
console.log('PASS battle camera scale: 1m footstep grid, adult rigs, close opening view and overview');
