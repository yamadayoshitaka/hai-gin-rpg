import {test,expect} from '@playwright/test';

test('50v50 armored soldiers have only two visible legs and keep full-detail draws efficient',
 async ({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/tactics-wireframe.html?army=50&v=4.5.2',
    {waitUntil:'domcontentloaded',timeout:60000});
  // The current battle intentionally stops at a three-step opening wizard.
  // Do not wait for battleReady before the user-visible launch interaction.
  await page.waitForFunction(()=>{
    const failed=document.querySelector('#runtimeError')?.style.display==='block';
    return failed||Boolean(document.querySelector('.openingWizardTabs button'));
  },null,{timeout:145000,polling:500});
  const opening=await page.evaluate(()=>({
    wizard:Boolean(document.querySelector('.openingWizardTabs')),
    runtimeError:document.querySelector('#runtimeError')?.style.display==='block'
      ?document.querySelector('#runtimeError').textContent:''
  }));
  expect(opening.wizard,opening.runtimeError||'Pre-battle wizard did not appear').toBe(true);
  // Exercise the actual UI: formation -> launch tab -> music-on launch.
  await page.locator('.openingWizardTabs button').filter({hasText:'③ 開戦'}).click();
  await expect(page.locator('#loadingStart')).toBeVisible();
  await page.locator('#loadingStart').click();
  await page.waitForFunction(()=>{
    const ready=window.getBattleStartupStats?.()?.ready;
    const failed=document.querySelector('#runtimeError')?.style.display==='block';
    const silent=document.querySelector('#loadingSkipAudio');
    return ready||failed||Boolean(silent&&!silent.hidden);
  },null,{timeout:25000,polling:250});
  // CI's headless browser may deny audio playback. Follow the visible
  // fallback button rather than invoking private launch code.
  if(await page.locator('#loadingSkipAudio').isVisible())
    await page.locator('#loadingSkipAudio').click();
  await page.waitForFunction(()=>{
    const ready=window.getBattleStartupStats?.()?.ready;
    const failed=document.querySelector('#runtimeError')?.style.display==='block';
    return ready||failed;
  },null,{timeout:25000,polling:250});
  const result=await page.evaluate(()=>({
    startup:window.getBattleStartupStats?.(),
    legs:window.getBattleLegAssemblyReport?.(),
    perf:window.getSkirmishPerformanceStats?.(),
    runtimeError:document.querySelector('#runtimeError')?.textContent||''
  }));
  expect(result.startup?.ready,JSON.stringify(result.runtimeError)).toBe(true);
  expect(result.startup?.actors).toBe(100);
  expect(result.startup?.dressed).toBe(100);
  expect(result.legs?.actors?.length).toBeGreaterThanOrEqual(10);
  for(const actor of result.legs.actors){
   expect(actor.broken,JSON.stringify(actor)).toBe(false);
   expect(actor.originalLegAndBootMeshesSuppressed).toBe(1);
   expect(actor.retainedSkinnedLegMeshes).toBe(1);
   expect(actor.useSourceSkinnedLegs).toBe(true);
   for(const slot of ['thigh','knee','shin','boot-foot']){
    expect(actor.legSideCounts?.[slot]?.l).toBeGreaterThan(0);
    expect(actor.legSideCounts?.[slot]?.r).toBeGreaterThan(0);
   }
   expect(actor.plateTrouserLegMeshesSkipped).toBe(2);
   expect(actor.plateBootShaftMeshesSkipped).toBe(2);
   expect(actor.armorDrawPieces).toBeLessThan(actor.armorOriginalPieces);
  }
  expect(result.perf?.armorDrawPieces).toBeLessThan(result.perf?.armorOriginalPieces);
  expect(pageErrors).toEqual([]);
  // Real mobile GPU evidence: screenshot failure is reported separately from
  // mechanical correctness, since CI SwiftShader can time out on readback.
  try{await page.screenshot({path:'test-results/50v50-fitted-plate-legs.png',timeout:10000});}
  catch(error){console.warn('50v50 visual capture unavailable:',error.message);}
  console.log('50v50 two-leg render + real GLB consolidation PASS',
    JSON.stringify({actors:result.startup.actors,perf:result.perf,
      auditedPlateWearers:result.legs.actors.length}));
});
