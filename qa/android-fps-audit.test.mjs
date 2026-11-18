import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
test('device benchmark measures real engine metrics and never claims synthetic Android FPS',()=>{
 const page=fs.readFileSync('android-fps-audit.html','utf8');
 assert.match(page,/getSkirmishPerformanceStats/);
 assert.match(page,/getMassBattleStats/);
 assert.match(page,/measured_android_browser/);
 assert.match(page,/measured_non_android_browser/);
 assert.match(page,/samples\.length<12/);
 assert.match(page,/runtimeErrors/);
 assert.match(page,/frameP95Ms/);
 assert.match(page,/navigator\.clipboard\.writeText/);
 assert.match(page,/結果は端末内に表示され、送信されません/);
 const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert(script);assert.doesNotThrow(()=>new vm.Script(script));
});
