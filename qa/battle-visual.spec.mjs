import {test,expect} from '@playwright/test';

test('mobile 3D ATB: boot, party options, command UI and no runtime errors', async ({page},testInfo)=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/play-1210.html?v=atb-e2e',{waitUntil:'domcontentloaded',timeout:65000});
 console.log('ATB stage: DOM loaded');
 await expect(page.locator('#battle-attack')).toBeAttached({timeout:30000});
 console.log('ATB stage: battle entry button attached');
 await expect(page.locator('#hero-job-select option')).toHaveCount(40,{timeout:30000});
 console.log('ATB stage: party job options ready');
 const options=await page.locator('#hero-job-select option').evaluateAll(nodes=>nodes.map(n=>n.value));
 expect(new Set(options).size).toBe(40);
 await expect(page.locator('#atb-actions')).toBeAttached({timeout:20000});
 // Capture an actual rendered frame, without requiring an encounter to occur randomly.
 await page.screenshot({path:testInfo.outputPath('01-atb-field.png'),timeout:20000});
 console.log('ATB stage: screenshot captured');
 const qa=await page.evaluate(()=>({
  started:Boolean(window.__haiGinStarted),
  qa:typeof window.__haiGinReadQA,
  roster:window.__haiGinJobChoicesQA?.().count,
  error:document.querySelector('.boot-error')?.textContent||null
 }));
 console.log('ATB boot flags:',JSON.stringify(qa));
 expect(qa.started).toBe(true);
 expect(qa.qa).toBe('function');
 expect(qa.roster).toBe(40);
 expect(errors).toEqual([]);
});
