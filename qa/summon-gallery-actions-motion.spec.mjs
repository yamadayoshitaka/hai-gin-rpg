import {test,expect} from '@playwright/test';

test('forest spirit actually walks and runs with animated skinned legs, and has visible skill buttons',async({page})=>{
 test.setTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?summon=forest_archer&v=actions-walk-20261122',
  {waitUntil:'domcontentloaded',timeout:65000});
 await expect.poll(()=>page.evaluate(()=>window.__summonGalleryLayoutQA?.()?.femaleReady),
  {timeout:110000}).toBe(true);
 await expect(page.locator('#summonMotionStrip .speciesSkill')).toHaveCount(2);
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).speciesActionIds)
  .toEqual(['forest_rejuvenation','spirit_arrow']);
 const walk=page.locator('#walk');
 await walk.click();
 await expect.poll(()=>page.evaluate(()=>window.__summonGalleryLayoutQA?.()?.canonicalMovement?.requested),
  {timeout:12000}).toBe('walk');
 const first=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(first.walking).toBe(true);
 expect(first.running).toBe(false);
 expect(first.canonicalMovement.hasWalkClip).toBe(true);
 await page.waitForTimeout(480);
 const moved=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(moved.previewX).toBeGreaterThan(first.previewX+.35);
 expect(moved.canonicalMovement.position.x).toBeGreaterThan(
  first.canonicalMovement.position.x+.35);
 expect(moved.canonicalMovement.activeClip?.toLowerCase()).toContain('walk');
 expect(moved.canonicalMovement.legs.length).toBeGreaterThanOrEqual(2);
 const different=moved.canonicalMovement.legs.some((leg,i)=>
  leg.quaternion.some((n,j)=>Math.abs(n-(first.canonicalMovement.legs[i]?.quaternion[j]??n))>.001));
 expect(different).toBe(true);
 await page.screenshot({path:'test-results/forest-spirit-walking-legs-live.png',
  timeout:15000,animations:'disabled'});
 await page.locator('#runButton').click();
 await expect.poll(()=>page.evaluate(()=>window.__summonGalleryLayoutQA?.()?.canonicalMovement?.requested))
  .toBe('run');
 await page.locator('.speciesSkill[data-skill="forest_rejuvenation"]').click();
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).selectedSkill)
  .toBe('forest_rejuvenation');
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).canonicalMovement.requested)
  .toBe('special');
 await page.locator('.speciesSkill[data-skill="spirit_arrow"]').click();
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).selectedSkill)
  .toBe('spirit_arrow');
 expect(errors).toEqual([]);
});

test('angel and dragon abilities appear explicitly and trigger their own poses',async({page})=>{
 test.setTimeout(160000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?summon=seraph_guardian&v=actions-walk-20261122',
  {waitUntil:'domcontentloaded',timeout:65000});
 await expect(page.locator('#summonMotionStrip .speciesSkill')).toHaveCount(3);
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).speciesActionIds)
  .toEqual(['seraph_blessing','seraph_resurrection','radiant_lance']);
 await page.locator('.speciesSkill[data-skill="seraph_resurrection"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__summonGalleryLayoutQA?.()?.selectedSkill))
  .toBe('seraph_resurrection');
 await page.locator('#type').selectOption('dragon_lord');
 await expect(page.locator('#humanoidForm')).toHaveValue('original');
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).speciesActionIds)
  .toEqual(['dragon_lord_starflare','inferno_breath','royal_roar']);
 await page.locator('.speciesSkill[data-skill="dragon_lord_starflare"]').click();
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).selectedSkill)
  .toBe('dragon_lord_starflare');
 await page.locator('.speciesSkill[data-skill="inferno_breath"]').click();
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).selectedSkill)
  .toBe('inferno_breath');
 expect(errors).toEqual([]);
});
