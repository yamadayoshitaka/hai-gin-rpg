import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const menu=readFileSync(new URL('../index.html',import.meta.url),'utf8');

// Actors occupy 2.2m cells: render the dressed rigs at ordinary adult height,
// using the same scale for individual skeletons and baked crowd instances.
assert.match(game,/createCharacter\(\{job:appearanceJob,sex,height:sex==='female'\?2\.08:2\.16,jobs\}\)/);
assert.doesNotMatch(game,/createCharacter\(\{job:appearanceJob,sex,height:1\.02,jobs\}\)/);

// One authoritative camera setup: opening at the allied front, while a
// separate full-battle overview remains available as an intentional choice.
assert.match(game,/const cameraHome=\(actors\.find\(a=>a\.team===0\)\?\.root\.position\|\|openingFocus\)\.clone\(\)/);
assert.match(game,/const cameraCloseOffset=new THREE\.Vector3\(10,16,23\)/);
assert.match(game,/const cameraOverviewOffset=new THREE\.Vector3\(115,220,185\)/);
assert.equal((game.match(/\$\('camOverview'\)\.onclick=/g)||[]).length,1);
assert.equal((game.match(/\$\('camFollow'\)\.onclick=/g)||[]).length,1);
assert.equal((game.match(/\$\('camReset'\)\.onclick=/g)||[]).length,1);
assert.match(game,/if\(followCamera\)\{/);
assert.match(menu,/tactics-wireframe\.html\?army=100&amp;v=4\.3\.1/);
assert.match(menu,/tactics-wireframe\.html\?army=1000&amp;v=4\.3\.1/);

// Perspective: at the close camera's roughly 35m range, a 1.7m person
// should be several percent of viewport height, rather than under 1%.
const distance=Math.hypot(10,16,23),heightAtDistance=2*distance*Math.tan(48*Math.PI/360);
assert.ok(2.08/heightAtDistance>.07);
assert.ok(2.08/2.2>.94&&2.16/2.2<1,'both character heights must fit in one tactical tile');
console.log('PASS battle camera scale: life-size rigs, close opening view, full overview and camera follow');
