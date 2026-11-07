import {test,expect} from '@playwright/test';

test('mobile summon gallery: compact model-first view, functional drawers and camera zoom',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/summon-showcase.html?v=4.4.84',
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
  expect(errors).toEqual([]);
});
