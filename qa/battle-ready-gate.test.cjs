const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {classifyBattleStartup}=require('./battle-ready-gate.cjs');
test('current production 50v50 can be ready with 100 actors and NO visible wizard',()=>{
 const actualLog={ready:true,actors:100,visibleWizard:false,errorVisible:false};
 assert.equal(classifyBattleStartup(actualLog),'running');
});
test('a real displayed wizard remains a required user interaction',()=>{
 assert.equal(classifyBattleStartup({
  ready:true,actors:100,visibleWizard:true
 }),'wizard');
});
test('readiness is never manufactured from static HTML or arbitrary counts',()=>{
 for(const x of [{ready:false,actors:100},{ready:true,actors:50},
  {ready:undefined,actors:100},{ready:false,actors:0,visibleWizard:false},
  {ready:'true',actors:100}])
  assert.equal(classifyBattleStartup(x),'pending',JSON.stringify(x));
 assert.equal(classifyBattleStartup({
  ready:true,actors:100,errorVisible:true
 }),'runtime_error');
});
test('real FPS probe observes production readiness and still verifies actual GPU telemetry',()=>{
 const s=fs.readFileSync('qa/game-quality-browser.cjs','utf8');
 assert(s.includes('classifyBattleStartup(state)'));
 assert(s.includes('window.getBattleStartupStats?.()?.ready===true'));
 assert(s.includes('p?.ready===true&&p?.actors>=100'));
 assert(s.includes("if(opening==='wizard')"));
 assert(s.includes("else if(opening!=='running')"));
 assert(s.includes('window.getSkirmishPerformanceStats?.()'));
 assert(s.includes('result.webglContextLost'));
 assert(s.includes("result.status=lane==='frame'?'measured_ci_fps'"));
});
