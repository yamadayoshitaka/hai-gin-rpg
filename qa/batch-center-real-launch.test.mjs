import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page=fs.readFileSync('batch-monitor.html','utf8');
const code=page.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';

test('manual Issue dispatch is explicitly two-step, without false successful launch feedback',()=>{
 assert.doesNotThrow(()=>new vm.Script(code));
 assert.match(page,/id="batchLaunchEvidence"/);
 assert.match(page,/actions\/runs\/44104745097/);
 assert.match(page,/issues\/575/);
 assert.match(page,/GitHubでIssueを作成して起動/);
 assert.match(page,/Submit new issue/);
 assert.match(page,/このボタンだけでは起動しません/);
 assert.match(page,/Issue作成後にカテゴリ別QAのみ起動/);
});
test('Android does not double navigate on null noopener popup return',()=>{
 assert(!code.includes("if(!win)window.location.assign(link)"));
 assert(!code.includes("if(!win)location.assign(link)"));
 const manual=code.slice(code.indexOf("button.addEventListener('click',()=>{"),code.indexOf("$('cards').appendChild(c)"));
 assert.match(manual,/window\.location\.assign\(link\)/);
 assert.doesNotMatch(manual,/window\.open\(/);
 assert.match(code,/ChatGPT用指示をコピー/);
 assert.match(code,/navigator\.clipboard\.writeText\(request\)/);
 assert.match(code,/manualText\.hidden=false/);
});
test('backend manually dispatched QA and latest monitored stage are distinguished',()=>{
 const dispatcher=fs.readFileSync('scripts/manual-hourly-batch-dispatch.mjs','utf8');
 assert.match(dispatcher,/workflow','run'/);
 assert.match(dispatcher,/if\(child\.status!==0\)throw Error/);
 assert.match(page,/モデルのゲーム新規採用は確認されていません/);
 assert.match(page,/GitHub Actionsの自動スケジュールが毎時6回実行された証拠ではありません/);
});
