import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPilotPlan,makePayload} from '../scripts/pilot-story-ai-horde.mjs';

test('pilot uses one immutable chapter1 stage4 shot and original source masters',()=>{
 const plan=buildPilotPlan();
 assert.equal(plan.target.key,'c01-s04|pre|male|c01-s04-m5');
 assert.deepEqual(plan.actors,['lucia','vess']);
 assert.equal(plan.screenplayText,'この勅命に記された王印は、本物ではありません。');
 assert.equal(plan.requestsMax,1);
 assert.equal(plan.costCeilingJpy,0);
 assert.equal(plan.automaticApproval,false);
 assert.equal(plan.referenceLimit,'ONE_IMAGE_ONLY_NOT_FULL_P0');
 assert.ok(plan.target.output.includes('/ai-horde-pilot/'));
 assert.ok(!plan.target.output.includes('/chapter1-provisional-live/'));
 for(const ref of plan.actualRefs)assert.match(ref.sha,/^[a-f0-9]{64}$/);
 assert.match(plan.prompt,/NO TEXT/);
 assert.match(plan.prompt,/STAGE/);
 assert.match(plan.prompt,/lucia/);
 assert.match(plan.prompt,/vess/);
});

test('single-source img2img request is image-only and unshared',()=>{
 const bytes=Buffer.alloc(40);
 bytes.write('RIFF',0,'ascii');bytes.write('WEBP',8,'ascii');
 bytes.write('VP8X',12,'ascii');
 bytes.writeUIntLE(1023,24,3);bytes.writeUIntLE(575,27,3);
 const payload=makePayload(buildPilotPlan(),bytes,'SDXL 1.0');
 assert.equal(payload.params.n,1);
 assert.equal(payload.params.width,1024);
 assert.equal(payload.params.height,576);
 assert.equal(payload.source_processing,'img2img');
 assert.equal(payload.source_image,bytes.toString('base64'));
 assert.equal(payload.shared,false);
 assert.equal(payload.dry_run,false);
 assert.equal(payload.nsfw,false);
 assert.deepEqual(payload.models,['SDXL 1.0']);
 assert.ok(payload.prompt.includes('###'));
 assert.ok(!('api_key' in payload));
});
test('cannot render from wrong-sized source',()=>{
 assert.throws(()=>makePayload(buildPilotPlan(),Buffer.from('bad')),/NOT_WEBP/);
});
