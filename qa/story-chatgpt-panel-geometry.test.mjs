import assert from 'node:assert/strict';
import fs from 'node:fs';
import {minimumChatGPTPanelPixels,validChatGPTPanelGeometry} from '../src/story-chatgpt-panel-geometry.js';

assert.deepEqual(minimumChatGPTPanelPixels('c01-s04'),[800,450]);
assert.deepEqual(minimumChatGPTPanelPixels('c01-s05'),[1536,864]);
assert.deepEqual(minimumChatGPTPanelPixels('c01-s02'),[768,320]);
const manifest=JSON.parse(fs.readFileSync('assets/story/stage-manifests/c01-s04.manifest.json','utf8'));
assert.deepEqual(minimumChatGPTPanelPixels('c01-s04'),manifest.layout.minPerPanelNativePixels);
for(const dims of [[800,450],[816,459],[832,468],[1664,936]]){
  assert.ok(validChatGPTPanelGeometry('c01-s04',...dims),dims.join('x')+' should pass');
}
for(const dims of [[799,450],[800,449],[816,460],[800,500],[0,0],[832.5,468]]){
  assert.equal(validChatGPTPanelGeometry('c01-s04',...dims),false,dims.join('x')+' must fail');
}
assert.equal(validChatGPTPanelGeometry('c01-s05',816,459),false,'Stage 5 threshold must not change');
assert.equal(validChatGPTPanelGeometry('c01-s05',1536,864),true);
console.log('PASS: stage4 2-up native frame intake, no upscale, strict 16:9, stage isolation');
