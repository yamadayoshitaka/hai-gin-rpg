import assert from 'node:assert/strict';
import fs from 'node:fs';
import {peasantHeadSourceRequired,townHeadSourceForSex} from '../src/town-civilian-head.js';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const town=read('tactics-wireframe.html'),hub=read('town-hub.html');
for(const sex of ['Male','Female']){
 const raw=JSON.parse(read('assets/characters/quaternius-outfits/'+sex+'_Peasant.gltf'));
 assert.ok(peasantHeadSourceRequired(raw),sex+' Peasant has Head bone but no head mesh');
 assert.ok(fs.existsSync(new URL('../'+townHeadSourceForSex(sex.toLowerCase()).slice(2),import.meta.url)),
  'actual face GLTF source must exist');
 const base=JSON.parse(read('assets/characters/quaternius-base/Superhero_'+sex+'_FullBody.gltf'));
 assert.ok(base.meshes.some(x=>/eye/i.test(x.name)),'face needs actual 3D eye geometry');
 assert.ok(base.nodes.some(x=>x.name==='Head'),'source body must have a matching skull bone');
}
assert.match(town,/import \{attachTownCivilianHead,townHeadSourceForSex\}/);
assert.match(town,/citizen\.townHead=attachTownCivilianHead\(THREE,model,await getHeadSource\(citizen\.sex\)/);
assert.match(town,/actor\.townHead=attachTownCivilianHead\(THREE,model,await getHeadSource\(sex\)/);
assert.match(town,/headMeshes:townStreetCitizens\.map/,'runtime QA must count face meshes');
assert.match(town,/fallbackHeadMeshes:actors\.filter/);

// This is a town-only change. Never touch soldier rendering, battle collision
// or tactical AI to fix the static Peasant GLTF outfits.
assert.match(town,/if\(!TOWN_MODE\)return;\s*const loader=new GLTFLoader\(\)/);
assert.match(town,/townIndoorSolidBoxes=.*?\.map\(mesh=>/s,'indoor colliders derive from placed meshes');
assert.match(town,/townIndoorSolidBoxes\.some\(box=>/);
assert.match(town,/registerTownSolidDecoration\(root,mesh,/);
assert.match(town,/height>=\.28&&bottom<1\.05&&width>=\.25&&depth>=\.24/);
assert.match(town,/townIndoorSolidBoxes=\[\]/,'furniture blockers must reset on exit');
assert.match(town,/createTownOverviewTexture\(\)/);
assert.match(town,/townPost\('hai-gin-town-overview'/);
assert.match(hub,/id="townGuideCanvas"/);
assert.match(hub,/id="townOverhead"/);
assert.match(town,/magnitude<\.63\?'walk':'run'/);
assert.match(town,/updateTownContactShadows\(\)/);
assert.match(town,/townCourtFigure\(root,'国王'/);
assert.match(town,/townCourtFigure\(root,'王女'/);
assert.match(town,/townCourtFigure\(root,'王子'/);
assert.match(town,/townCourtFigure\(root,'大臣'/);
for(const s of ['shop','tavern','inn','castle','church'])assert.match(read('src/town-audio-director.js'),new RegExp(s+':'));
assert.match(town,/TownFacadeFinish_/);
assert.match(town,/townDecorCylinder\(root,\.075,\.09,\.23/,'decorated shelves must have bottles');
assert.match(town,/const carpet=kind===/);
console.log('PASS civilian face source, town-isolated head attachment, solid indoor props and nine town features');
