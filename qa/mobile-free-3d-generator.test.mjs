import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../mobile-3d-generator.html',import.meta.url),'utf8');
const menu=readFileSync(new URL('../dev-menu.html',import.meta.url),'utf8');
const studio=readFileSync(new URL('../ai-model-studio.html',import.meta.url),'utf8');

test('mobile generator points to the verified official free GPU demo',()=>{
 assert.match(html,/https:\/\/microsoft-trellis-2\.hf\.space\//);
 assert.match(html,/https:\/\/huggingface\.co\/spaces\/microsoft\/TRELLIS\.2/);
 assert.match(html,/referrerpolicy="no-referrer"/);
});
test('mobile generator makes NO unattended paid API request or production model swap',()=>{
 assert.doesNotMatch(html,/TRIPO_API_KEY|HUNYUAN_API_TOKEN|hf_[A-Za-z0-9]{10,}/);
 assert.match(html,/外部送信なし/);
 assert.match(html,/本編への反映は実施されません/);
});
test('GLB validation, size cap, candidate manifest, and rigging disclaimer exist',()=>{
 assert.match(html,/MAX_BYTES=75\*1024\*1024/);
 assert.match(html,/inspectGLB\(await f\.arrayBuffer\(\)\)/);
 assert.match(html,/hai-gin\/ai-3d-inbox\/v1/);
 assert.match(html,/skins/);
 assert.match(html,/animations/);
 assert.match(html,/approvedForGame|本編モデルを|ゲーム本体は変更しません/);
});
test('game menu and AI studio expose phone generator',()=>{
 assert.match(menu,/mobile-3d-generator\.html/);
 assert.match(studio,/mobile-3d-generator\.html/);
});
