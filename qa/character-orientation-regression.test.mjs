import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {EQUIPMENT_TYPES} from '../src/character-system/equipment-catalog.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(path.join(root,relative),'utf8');
function glb(relative){
  const buffer=readFileSync(path.join(root,relative));
  assert.equal(buffer.toString('ascii',0,4),'glTF');
  return JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
}
function sourceDepth(model,name){
  const node=model.nodes.find(item=>item.name===name);
  assert.ok(node,`Missing source armor surface ${name}`);
  const mesh=model.meshes[node.mesh];
  assert.ok(mesh,`Mesh missing for ${name}`);
  const pos=model.accessors[mesh.primitives[0].attributes.POSITION];
  return {min:pos.min[1],max:pos.max[1]};
}

// Blender-authored armor is Z-up, facing source -Y. The file root already
// converts it using a -90 degree X quaternion: source -Y then becomes world +Z.
// A second PI Y rotation reverses the outfit and puts the visor on the nape.
for(const sex of ['male','female'])for(const [part,mesh] of [
  ['head','Brow-mounted nasal guard'],['chest','Faceted breastplate reinforcement']]){
  const model=glb(`assets/characters/seven-head-equipment-candidates/plate_${part}-${sex}.glb`);
  const holder=model.nodes[model.scenes[0].nodes[0]];
  assert.ok(Math.abs(holder.rotation[0]+Math.SQRT1_2)<.001,`${sex}/${part} converted from Z up`);
  const depth=sourceDepth(model,mesh);
  assert.ok(depth.max<0,`${sex}/${part} source front extends toward -Y`);
  assert.ok(-depth.min>0,`${sex}/${part} source face transforms to +Z`);
}

const segmented=read('src/character-system/segmented-armor-runtime.js');
assert.doesNotMatch(segmented,/stage\.rotation\.y\s*=\s*Math\.PI\b/,'do not reverse an already rotated GLB');
const detail=read('src/outfit-maintenance-model.js');
assert.match(detail,/const front=surfaceAt\(cy-H\*\.09\)\+H\*\.008/,'chest decoration follows fitted +Z fabric');
assert.match(detail,/const waistFront=surfaceAt\(beltY\)\+H\*\.007/,'belt hardware follows waist surface');
assert.match(detail,/true,Math\.PI\/2,Math\.PI\)/,'cape half-shell must occupy -Z');
assert.match(detail,/three-dimensional-back-and-side-cape[^\n]+mz\+sz\*\.02/,'cape centered on the back shell');
for(let i=0;i<=16;i++){
  const angle=Math.PI/2+Math.PI*i/16;
  assert.ok(Math.cos(angle)<1e-10,'cape cylinder vertex must be on the back hemisphere');
}
const heraldry=read('src/character-system/armor-heraldry-runtime.js');
assert.match(heraldry,/frontZ=bounds\.max\.z\+\.008/,'cuirass embossing at front +Z');
assert.doesNotMatch(heraldry,/foreheadZ=helmBounds\.max\.z\+\.010/,
  'do not place raised helmet ornaments at the nose-guard maximum depth');
assert.equal(EQUIPMENT_TYPES.shield.mount.face,'+z','shield must guard character front');
const studio=read('motion-external-test.html');
assert.match(studio,/helmet\.checked=false/,'default preview must reveal hairstyles');
const wardrobe=read('outfit-maintenance.html');
assert.match(wardrobe,/activeOutfit\?\.setHelmetVisible\(\$\('showHelmet'\)\.checked\)/,
  'maintenance helmet toggle must also reveal hair');
assert.match(wardrobe,/c\.z\+\(back\?-d:d\)/,'front camera points at +Z face');
console.log('PASS orientation: source plate visor, chest crests, cape, shield, preview hair and front camera');
