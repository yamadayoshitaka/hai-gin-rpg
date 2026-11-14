// Actual three-step battle launch used by browser E2E tests.
// Do not bypass gameplay by setting battleReady or dispatching private events.
// The formation / initial-orders / launch wizard is user-facing and must remain.
const assert=require('node:assert/strict');

async function launchBattleViaThreeStepWizard(page,{
  timeout=180000,requireReady=true
}={}){
  await page.waitForFunction(()=>{
    const error=document.querySelector('#runtimeError');
    const tabs=document.querySelectorAll('.openingWizardTabs button');
    const loading=document.querySelector('#loadingStage')?.textContent||'';
    return error?.style.display==='block'||
      (tabs.length===3&&loading.includes('準備完了'));
  },null,{timeout,polling:500});

  const ready=await page.evaluate(()=>({
    error:document.querySelector('#runtimeError')?.style.display==='block'
      ?document.querySelector('#runtimeError')?.textContent:null,
    stage:document.querySelector('#loadingStage')?.textContent,
    tabs:[...document.querySelectorAll('.openingWizardTabs button')].map(x=>x.textContent),
    startHidden:document.querySelector('#loadingStart')?.hidden
  }));
  assert.ok(!ready.error,'Battle startup error before the 3-stage wizard: '+ready.error);
  assert.deepEqual(ready.tabs.map(x=>x?.trim()),
    ['① 編成','② 初期号令','③ 開戦'],
    'Keep the real 3-stage prebattle menu, not a debug shortcut');
  assert.equal(ready.startHidden,true,'Launch must be hidden on the formation page');

  const tabs=page.locator('.openingWizardTabs button');
  await tabs.nth(1).click();
  await page.locator('#openingSquadOrders').waitFor({state:'visible',timeout:15000});
  await tabs.nth(2).click();
  await page.locator('#loadingStart').waitFor({state:'visible',timeout:15000});
  await page.locator('#loadingStart').click();
  // Audio autoplay is not guaranteed in headless Chrome. Use the game's
  // existing visible silent-play button, instead of spoofing game state.
  await page.waitForFunction(()=>{
    const error=document.querySelector('#runtimeError');
    const silent=document.querySelector('#loadingSkipAudio');
    return error?.style.display==='block'||
      window.getBattleStartupStats?.()?.ready||
      !!(silent&&!silent.hidden);
  },null,{timeout:30000,polling:300});
  const hasStarted=await page.evaluate(()=>!!window.getBattleStartupStats?.()?.ready);
  if(!hasStarted){
    const error=await page.evaluate(()=>
      document.querySelector('#runtimeError')?.style.display==='block'
        ?document.querySelector('#runtimeError')?.textContent:null);
    assert.ok(!error,'Battle audio start error: '+error);
    await page.locator('#loadingSkipAudio').click();
  }
  if(requireReady){
    await page.waitForFunction(()=>{
      const error=document.querySelector('#runtimeError');
      return window.getBattleStartupStats?.()?.ready||
        error?.style.display==='block';
    },null,{timeout:60000,polling:500});
    const state=await page.evaluate(()=>({
      ready:!!window.getBattleStartupStats?.()?.ready,
      error:document.querySelector('#runtimeError')?.style.display==='block'
        ?document.querySelector('#runtimeError')?.textContent:null
    }));
    assert.ok(!state.error,'Battle runtime error after launch: '+state.error);
    assert.equal(state.ready,true,'The launch page must really start the battle');
  }
}
module.exports={launchBattleViaThreeStepWizard};
