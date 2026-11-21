import {test,expect} from '@playwright/test';

test('mobile summon gallery: compact model-first view, functional drawers and camera zoom',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/summon-showcase.html?v=4.4.91',
    {waitUntil:'domcontentloaded',timeout:65000});

  // The species picker and motion strip stay accessible without opening settings.
  const choose=page.locator('#type');
  const drawer=page.locator('#controlsDrawer');
  const info=page.locator('#info');
  await expect(choose).toBeVisible();
  await expect(drawer).not.toHaveAttribute('open',/./);
  await expect(info).not.toHaveAttribute('open',/./);
  await expect(page.locator('#summonMotionStrip button')).toHaveCount(10);
  await expect(page.locator('#attack')).toBeVisible();

  // Compact header should not consume most of the phone's viewport.
  const size=await page.locator('#galleryHeader').boundingBox();
  expect(size?.height).toBeLessThan(90);
  await drawer.locator('summary').first().click();
  await expect(drawer).toHaveAttribute('open','');
  await expect(page.locator('#wireframe')).toBeVisible();
  await expect(page.locator('.inspectorGroup')).toHaveCount(3);
  const height=await page.locator('#controlsDrawer .extraControls').evaluate(
    el=>el.getBoundingClientRect().height);
  expect(height).toBeLessThan(page.viewportSize().height*.55);
  await page.locator('#dismissControls').click();
  await expect(page.locator('#attack')).toBeVisible();

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
  await page.locator('#summonMotionStrip [data-pose="special"]').click();
  const duringSpell=await page.evaluate(()=>window.__summonGalleryLayoutQA());
  expect(duringSpell.motionStripVisible).toBe(true);
  expect(duringSpell.activeMotion).toBe('special');
  await page.locator('#summonMotionStrip [data-pose="idle"]').click();
  expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).activeMotion).toBe('idle');

  // The portrait view starts roughly twice as close as the previous design.
  await expect.poll(()=>page.evaluate(()=>window.__summonGalleryLayoutQA?.()),
    {timeout:45000}).toMatchObject({
      mobile:true,controlsOpen:false,infoOpen:false,selected:'forest_archer'
    });
  const distance=await page.evaluate(()=>window.__summonGalleryLayoutQA().cameraDistance);
  expect(distance).toBeGreaterThan(40);
  expect(distance).toBeLessThan(95);
  expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).summonWorldScale).toBe(10);
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
  expect(wholeBodyDistance).toBeGreaterThan(40);
  expect(wholeBodyDistance).toBeLessThan(75);
  await page.screenshot({path:'test-results/wolf-fullbody-coat-legs-belly.png',
    animations:'disabled',timeout:15000});
  await page.locator('#faceCloseup').click();
  await expect.poll(async()=>page.evaluate(()=>
    window.__summonGalleryLayoutQA()?.cameraDistance),{timeout:15000})
    .toBeLessThan(40);
  await drawer.locator('summary').first().click();
  await expect(drawer).not.toHaveAttribute('open',/./);
  await page.screenshot({path:'test-results/summoned-wolf-fur-face-closeup.png',
    animations:'disabled',timeout:15000});
  expect(errors).toEqual([]);
});

test('forest spirit has green real clothing in the 3D viewer, not black velvet',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?v=4.5.21',
  {waitUntil:'domcontentloaded',timeout:65000});
 await page.locator('#type').selectOption('forest_archer');
 await expect.poll(()=>page.evaluate(()=>
   window.__summonGalleryLayoutQA?.()?.femaleReady),
  {timeout:110000}).toBe(true);
 const actual=await page.evaluate(()=>
  window.__summonGalleryLayoutQA()?.forestSurfaceAudit);
 expect(actual).toMatchObject({
   leafPanels:36,
   darkPhotoSurfaceMeshes:0,
   skin:0xe1b496
 });
 expect(actual.emeraldMeshes).toBeGreaterThanOrEqual(37);
 // Material and mesh checks ensure the green dress exists in the actual
 // skinned actor, not merely a profile color that a black texture obscures.
 await page.screenshot({
   path:'test-results/forest-spirit-emerald-robe-front-back-check-v4.5.21.png',
   animations:'disabled',timeout:20000
 });
 expect(errors).toEqual([]);
});

test('all 50 original monster summons: independently selectable giant models',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?v=4.5.22&summon=summon_m020',
   {waitUntil:'domcontentloaded',timeout:65000});
 await expect(page.locator('#type')).toHaveValue('summon_m020');
 await expect(page.locator('#type option[value^="summon_m"]')).toHaveCount(50);
 const picker=page.locator('#type');
 for(const [id,name] of [
   ['summon_m020','リヴァイアサン'],
   ['summon_m018','ヒュドラ'],
   ['summon_m017','バジリスク']
 ]){
   await picker.selectOption(id);
   await expect.poll(()=>page.evaluate(()=>({
     id:window.__summonGalleryLayoutQA?.()?.monsterSourceType,
     rendered:window.__summonGalleryLayoutQA?.()?.monsterRendered,
     framed:window.__summonGalleryLayoutQA?.()?.monsterFramed
   })),{timeout:110000}).toEqual({
     id:id.slice('summon_'.length),rendered:true,framed:true
   });
   await expect(page.locator('#species')).toContainText(name);
   await expect(page.locator('#summonMotionStrip [data-pose="special"]'))
     .toBeVisible();
   await page.locator('#summonMotionStrip [data-pose="special"]').click();
   await page.locator('#summonMotionStrip [data-pose="idle"]').click();
 }
 await page.screenshot({
   path:'test-results/bestiary-basilisk-giant-10x-v4.5.22.png',
   animations:'disabled',timeout:20000
 });
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
 expect(before.femaleFlightAltitude).toBeGreaterThan(6);
 expect(before.femaleFlightAltitude).toBeLessThan(10);
 await page.waitForTimeout(450);
 const after=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(Math.abs(after.femaleFlightAltitude-before.femaleFlightAltitude)).toBeGreaterThan(.005);
 await page.screenshot({path:'test-results/seraph-original-wings-flying-v4.5.13.png',
  animations:'disabled',timeout:15000});
 expect(errors).toEqual([]);
});

test('male Dragon Lord: canonical male GLB, battleplate and original creature toggle',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?v=4.5.19',
  {waitUntil:'domcontentloaded',timeout:65000});
 await page.locator('#type').selectOption('dragon_lord');
 await expect(page.locator('#humanoidForm')).toHaveValue('original');
 // Keep the original dragon as the default; this separate test explicitly
 // opts in to the male dragonkin preview for legacy feature coverage.
 await page.locator('#humanoidForm').selectOption('male');
 await expect.poll(()=>page.evaluate(()=>
  window.__summonGalleryLayoutQA?.()?.femaleReady),{timeout:110000}).toBe(true);
 const state=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(state.selected).toBe('dragon_lord');
 expect(state.femaleMode).toBe('male');
 expect(state.actorSex).toBe('male');
 expect(state.femaleSource).toBe('Superhero_Male_FullBody');
 expect(state.motionStripVisible).toBe(true);
 await expect(page.locator('#femaleSummonModeLabel')).toBeVisible();
 await expect(page.locator('#humanoidForm option[value="female"]')).toBeHidden();
 await expect(page.locator('#attack')).toBeVisible();
 await page.locator('#controlsDrawer summary').first().click();
 await expect(page.locator('#footCloseup')).toBeVisible();
 await page.locator('#footCloseup').click();
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).cameraDistance).toBeLessThan(40);
 await page.screenshot({path:'test-results/male-dragonlord-armoured-feet-v4.5.19.png',
  animations:'disabled',timeout:15000});
 await page.locator('#humanoidForm').selectOption('original');
 expect((await page.evaluate(()=>window.__summonGalleryLayoutQA())).femaleMode).toBe('original');
 await page.locator('#humanoidForm').selectOption('male');
 await expect.poll(()=>page.evaluate(()=>window.__summonGalleryLayoutQA?.()?.femaleReady),
  {timeout:110000}).toBe(true);
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


test('dragon lord three distinct canonical forms and white beardless seraph visual evidence',async({page})=>{
 test.setTimeout(180000);
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?v=4.6.91',{
  waitUntil:'domcontentloaded',timeout:65000
 });
 await page.locator('#type').selectOption('dragon_lord');
 await expect(page.locator('#humanoidForm')).toHaveValue('original');
 let state=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(state.dragonLordForm).toBe('original');
 expect(state.dragonLordCostume).toBe(null);
 await page.screenshot({path:'test-results/dragon-lord-original-dragon-default.png',
  animations:'disabled',timeout:20000});
 // Alternate dragonkin appearance is now an explicit user choice.
 await page.locator('#humanoidForm').selectOption('male');
 await expect.poll(()=>page.evaluate(()=>
  window.__summonGalleryLayoutQA?.()?.femaleReady),{timeout:110000}).toBe(true);
 state=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(state.dragonLordForm).toBe('male');
 expect(state.dragonLordCostume).toBe('dragonkin_male');
 await page.screenshot({path:'test-results/dragon-lord-dragonkin.png',
  animations:'disabled',timeout:20000});
 await page.locator('#humanoidForm').selectOption('human');
 await expect(page.locator('#species')).toContainText('人間型');
 await expect.poll(()=>page.evaluate(()=>({
  ready:window.__summonGalleryLayoutQA?.()?.femaleReady,
  form:window.__summonGalleryLayoutQA?.()?.dragonLordCostume
 })),{timeout:110000}).toEqual({ready:true,form:'human_royal'});
 state=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(state.actorSex).toBe('male');
 await page.screenshot({path:'test-results/dragon-lord-human-no-horns-wings.png',
  animations:'disabled',timeout:20000});
 await page.locator('#humanoidForm').selectOption('original');
 await expect(page.locator('#species')).toContainText('竜王');
 await expect(page.locator('#humanoidForm')).toHaveValue('original');
 await page.locator('#type').selectOption('seraph_guardian');
 await expect.poll(()=>page.evaluate(()=>
  window.__summonGalleryLayoutQA?.()?.femaleReady),{timeout:110000}).toBe(true);
 state=await page.evaluate(()=>window.__summonGalleryLayoutQA());
 expect(state.angelNoBeard).toBe(true);
 expect(state.angelSkinColor).toBe(0xf8f9f8);
 expect(state.seraphOriginalWingCount).toBe(2);
 await page.screenshot({path:'test-results/white-beardless-angel-original-wings.png',
  animations:'disabled',timeout:20000});
 expect(errors).toEqual([]);
});


test('showroom default CC0 wolf source uses licensed canine mesh and original monster colors',async({page})=>{
 test.setTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/summon-showcase.html?summon=wolf&v=4.6.92',
  {waitUntil:'domcontentloaded',timeout:65000});
 await expect(page.locator('#type')).toHaveValue('wolf');
 await expect.poll(()=>page.evaluate(()=>({
  active:window.__summonGalleryLayoutQA?.()?.wolfSourceActive,
  donor:window.__summonGalleryLayoutQA?.()?.wolfSourceDonor
 })),{timeout:80000}).toEqual({active:true,donor:'q022'});
 await page.screenshot({
  path:'test-results/wolf-cc0-source-summon-pbr-front.png',
  animations:'disabled',timeout:25000
 });
 expect(errors).toEqual([]);
});
