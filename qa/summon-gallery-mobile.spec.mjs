import {test,expect} from '@playwright/test';

test('mobile summon gallery: compact model-first view, functional drawers and camera zoom',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/summon-showcase.html?v=4.4.91',
    {waitUntil:'domcontentloaded',timeout:65000});

  // The species picker remains usable when actions are hidden.
  const choose=page.locator('#type');
  const drawer=page.locator('#controlsDrawer');
  const info=page.locator('#info');
  await expect(choose).toBeVisible();
  await expect(drawer).not.toHaveAttribute('open',/./);
  await expect(info).not.toHaveAttribute('open',/./);
  await expect(page.locator('#attack')).toBeHidden();

  // Compact header should not consume most of the phone's viewport.
  const size=await page.locator('#galleryHeader').boundingBox();
  expect(size?.height).toBeLessThan(90);
  await drawer.locator('summary').first().click();
  await expect(drawer).toHaveAttribute('open','');
  await expect(page.locator('#attack')).toBeVisible();
  await drawer.locator('summary').first().click();
  await expect(page.locator('#attack')).toBeHidden();

  await info.locator('summary').click();
  await expect(info).toHaveAttribute('open','');
  await expect(page.locator('#desc')).toBeVisible();
  await info.locator('summary').click();
  await expect(page.locator('#desc')).toBeHidden();

  // A compact picker changes the model without reopening overlays.
  await choose.selectOption('seraph_guardian');
  await expect(page.locator('#species')).toContainText('守護天使');
  await expect(drawer).not.toHaveAttribute('open',/./);
  await choose.selectOption('forest_archer');
  await expect(page.locator('#species')).toContainText('精霊弓士');

  // The portrait view starts roughly twice as close as the previous design.
  await expect.poll(()=>page.evaluate(()=>window.__summonGalleryLayoutQA?.()),
    {timeout:45000}).toMatchObject({
      mobile:true,controlsOpen:false,infoOpen:false,selected:'forest_archer'
    });
  const distance=await page.evaluate(()=>window.__summonGalleryLayoutQA().cameraDistance);
  expect(distance).toBeGreaterThan(4);
  expect(distance).toBeLessThan(9);
  await expect(page.locator('canvas')).toBeVisible();

  // Wolf face/fur must be inspectable in the same folded mobile showcase.
  await choose.selectOption('wolf');
  await expect(page.locator('#species')).toContainText('灰狼');
  await drawer.locator('summary').first().click();
  await expect(page.locator('#faceCloseup')).toBeEnabled();
  await expect(page.locator('#coatCloseup')).toBeEnabled();
  await page.locator('#coatCloseup').click();
  const wholeBodyDistance=await page.evaluate(()=>
    window.__summonGalleryLayoutQA()?.cameraDistance);
  expect(wholeBodyDistance).toBeGreaterThan(4);
  expect(wholeBodyDistance).toBeLessThan(7.5);
  await page.screenshot({path:'test-results/wolf-fullbody-coat-legs-belly.png',
    animations:'disabled',timeout:15000});
  await page.locator('#faceCloseup').click();
  await expect.poll(async()=>page.evaluate(()=>
    window.__summonGalleryLayoutQA()?.cameraDistance),{timeout:15000})
    .toBeLessThan(4);
  await drawer.locator('summary').first().click();
  await expect(drawer).not.toHaveAttribute('open',/./);
  await page.screenshot({path:'test-results/summoned-wolf-fur-face-closeup.png',
    animations:'disabled',timeout:15000});
  expect(errors).toEqual([]);
});

test('female seraph: original wing pair and animated airborne preview',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?v=4.5.13',
  {waitUntil:'domcontentloaded',timeout:65000});
 await page.locator('#type').selectOption('seraph_guardian');
 await expect.poll(()=>page.evaluate(()=>
  window.__summonGalleryLayoutQA?.()?.femaleReady),{timeout:110000}).toBe(true);
 const before=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(before.seraphOriginalWingCount).toBe(2);
 expect(before.sourceCraniumWigCut).toBe(true);
 expect(before.sourceCraniumCutMode).toBe('wig');
 expect(before.sourceCraniumRemovedTriangles).toBeGreaterThan(8);
 expect(before.sourceCraniumPreservedTriangles).toBeGreaterThan(8);
 expect(before.femaleFlightAltitude).toBeGreaterThan(.60);
 expect(before.femaleFlightAltitude).toBeLessThan(.95);
 await page.waitForTimeout(450);
 const after=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(Math.abs(after.femaleFlightAltitude-before.femaleFlightAltitude)).toBeGreaterThan(.005);
 await page.screenshot({path:'test-results/seraph-original-wings-flying-v4.5.13.png',
  animations:'disabled',timeout:15000});
 expect(errors).toEqual([]);
});

test('female Dragon Lord: approved plum hair instead of an oversized purple cap',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?v=4.5.14',
  {waitUntil:'domcontentloaded',timeout:65000});
 await page.locator('#type').selectOption('dragon_lord');
 await expect.poll(()=>page.evaluate(()=>
  window.__summonGalleryLayoutQA?.()?.femaleReady),{timeout:110000}).toBe(true);
 const state=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(state.dragonCraniumNativeTopology).toBe(false);
 expect(state.dragonNativeScalpTriangles).toBe(0);
 expect(state.hairStrands).toBe(true);
 expect(state.sourceCraniumWigCut).toBe(true);
 expect(state.sourceCraniumCutMode).toBe('wig');
 expect(state.sourceCraniumRemovedTriangles).toBeGreaterThan(8);
 await page.screenshot({path:'test-results/dragonlord-approved-plum-hair-v4.5.17.png',
  animations:'disabled',timeout:15000});
 expect(errors).toEqual([]);
});

test('mobile bestiary: catalog and setting drawers remain operable after responsive redesign',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/monster-manager.html?v=4.5.06',
   {waitUntil:'domcontentloaded',timeout:65000});
 await expect(page.locator('#items .specimen')).toHaveCount(50,{timeout:50000});
 const panel=page.locator('#catalogPanel'),tools=page.locator('#modelTools');
 await expect(panel).toBeHidden();
 await expect(tools).toBeHidden();
 await page.locator('#toggleCatalog').click();
 await expect(panel).toBeVisible();
 await page.locator('.specimen[data-id="m005"]').click();
 await expect(page.locator('#name')).toContainText('翠森の古狼');
 await expect(panel).toBeHidden();
 await page.locator('#toggleTools').click();
 await expect(tools).toBeVisible();
 await page.locator('#quality').selectOption('low');
 await expect.poll(async()=>page.evaluate(()=>
   window.__monsterQualityQA?.().detail),{timeout:20000}).toBe('low');
 await page.locator('#toggleTools').click();
 await expect(tools).toBeHidden();
 expect(errors).toEqual([]);
});
