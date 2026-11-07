import {test,expect} from '@playwright/test';

test('50v50 armored soldiers have only two visible legs and keep full-detail draws efficient',
 async ({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/tactics-wireframe.html?army=50&v=4.5.2',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
    const ready=window.getBattleStartupStats?.()?.ready;
    const failed=document.querySelector('#runtimeError')?.style.display==='block';
    return ready||failed;
  },null,{timeout:165000,polling:500});
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
