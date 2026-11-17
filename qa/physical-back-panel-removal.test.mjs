import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('src/outfit-maintenance-model.js');
const runtime=read('src/character-system/rigged-outfit-runtime.js');
const studio=read('face-body-studio.html');
const male=read('male-body-studio.html');
const game=read('tactics-wireframe.html');
const forbidden=['complete-back-tunic-lining','heroic-cuirass-backplate',
 'l-cuirass-closed-flank','r-cuirass-closed-flank'];
for(const name of forbidden){
 assert.ok(!source.includes("add('"+name+"'"),name+' must not be generated in preview or battle');
 assert.ok(runtime.includes("'"+name+"'"),name+' must remain on fail-safe removal list');
}
assert.match(source,/imported Ranger\/Peasant torso is already a real 65-bone garment/);
assert.match(runtime,/panel\.removeFromParent\(\)/,'legacy panels removed from scene graph');
for(const [s,label] of [[studio,'female studio'],[male,'male studio'],[game,'battle']]){
 assert.ok(s.includes('20261117-cape-rear-v74')||s.includes('74-cape-rear'),
  label+' must bust cached module URLs');
}
console.log('PASS no cardboard back meshes: female, male, battle, source geometry');
