import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('assets/story/chapters/c01/c01-s01-draft-registry-20261113.json',base),'utf8'));
const p=data.qualityPass;
assert.deepEqual(p.pixelDimensionsOfIndividualArt,[1536,864]);
assert.equal(p.genuinelyNewHighResolutionScenes.length,7);
assert.deepEqual(p.legacyUpscaleNeedsRepaint,['c01-s01-m03','c01-s01-m11','c01-s01-m12']);
assert.equal(p.humanApproved,false);
const e=data.editions.find(e=>e.edition==='pre'&&e.gender==='female');
assert.equal(e.panelCount,10);
for(const a of e.panels){
 const x=readFileSync(new URL(a.path,base));
 assert.equal(x.toString('ascii',0,4),'RIFF');
 assert.equal(x.toString('ascii',8,12),'WEBP');
 assert.equal(x.toString('ascii',12,16),'VP8 ');
 assert.equal(x.readUInt16LE(26)&0x3fff,1536,a.id+' width');
 assert.equal(x.readUInt16LE(28)&0x3fff,864,a.id+' height');
 assert.equal(x.length,a.bytes,'bytes '+a.id);
 assert(['source-high-resolution','upscaled-from-768-source-needs-repaint'].includes(a.qualityStatus));
}
console.log('PASS: 10 female stage-1 panels at 1536x864; seven high-res sources; three flagged for repaint, no human approval.');
