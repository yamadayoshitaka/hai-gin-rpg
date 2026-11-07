import {test,expect} from '@playwright/test';

test('mobile bestiary: 50 unique 3D monsters, saved edits and sample motions',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('/monster-manager.html?v=4.4.85',
   {waitUntil:'domcontentloaded',timeout:65000});
 await expect(page.locator('#items .specimen')).toHaveCount(50,{timeout:50000});
 await expect(page.locator('#view canvas')).toBeVisible();
 await expect(page.locator('#name')).toContainText('灰牙の狼王');
 const silhouettes=[
  ['m006','黒爪パンサー'],['m011','荒野の大鷲'],
  ['m016','沼地の大蜥蜴'],['m021','鉄甲ビートル'],
  ['m026','洞窟スパイダー'],['m031','骸骨剣士'],
  ['m036','石壁ゴーレム'],['m041','小鬼インプ'],
  ['m046','浅瀬スライム'],['m050','珊瑚の海神獣']
 ];
 for(const [id,name] of silhouettes){
   await page.locator('.specimen[data-id="'+id+'"]').click({timeout:15000});
   await expect(page.locator('#name')).toContainText(name);
   await expect(page.locator('#hud')).toContainText('3Dモデル');
 }
 await page.locator('#actions button[title="special"]').click();
 await expect(page.locator('#notice')).toContainText('固有技');
 await page.locator('#actions button[title="dodge"]').click();
 await expect(page.locator('#notice')).toContainText('回避');
 // An editable monster should persist through reselection and reload.
 await page.locator('#edit-hp').fill('7777');
 await page.locator('#save').click();
 await expect(page.locator('#edit-hp')).toHaveValue('7777');
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#items .specimen')).toHaveCount(50,{timeout:50000});
 await page.locator('.specimen[data-id="m050"]').click();
 await expect(page.locator('#edit-hp')).toHaveValue('7777');
 await page.locator('#reset').click();
 await expect(page.locator('#edit-hp')).not.toHaveValue('7777');
 await expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/monster-manager-50.png',
   animations:'disabled',timeout:15000});
});

test('50-monster quality inspector: source/high/low & photo PBR, no geometry leakage',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/monster-manager.html?v=4.4.85',{waitUntil:'domcontentloaded',timeout:65000});
 await expect(page.locator('#items .specimen')).toHaveCount(50,{timeout:50000});
 const qa=()=>page.evaluate(()=>window.__monsterQualityQA?.());
 const high=await qa();
 expect(high?.detail).toBe('high');
 expect(high?.triangles).toBeGreaterThan(1000);
 expect(high?.photoSurfaces).toContain('fur');
 expect(high?.cache.activeMaterials).toBeGreaterThan(0);
 await page.locator('#quality').selectOption('source');
 const source=await qa();
 expect(source.detail).toBe('source');
 expect(source.triangles).toBeGreaterThan(high.triangles*1.7);
 await expect(page.locator('#geometryStats')).toContainText('三角形');
 await page.screenshot({path:'test-results/monster-master-source.png',
   animations:'disabled',timeout:15000});
 await page.locator('#quality').selectOption('low');
 const low=await qa();
 expect(low.triangles).toBeLessThan(high.triangles*.7);
 await page.locator('#quality').selectOption('high');
 for(const id of ['m011','m016','m021','m026','m031','m036','m041','m046']){
   await page.locator('.specimen[data-id="'+id+'"]').click();
   const current=await qa();
   expect(current.id).toBe(id);
   expect(current.triangles).toBeGreaterThan(1000);
   expect(current.cache.activeMaterials).toBeLessThan(50);
   if(['m011','m036','m041'].includes(id)){
     await page.screenshot({path:'test-results/monster-anatomy-'+id+'.png',
       animations:'disabled',timeout:15000});
   }
 }
 expect(errors).toEqual([]);
});

test('CC0 GLB registration, safe procedural fallback, personal GLB input',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/monster-manager.html?v=4.4.85',{waitUntil:'domcontentloaded',timeout:65000});
 await expect(page.locator('#items .specimen')).toHaveCount(50,{timeout:50000});
 await expect(page.locator('#assetSource')).toBeVisible();
 await expect(page.locator('#personalGlb')).toBeAttached();
 await expect(page.locator('#assetStatus')).toContainText(/CC0|GLB|外部/,{timeout:30000});
 let info=await page.evaluate(()=>window.__monsterImportQA?.());
 expect(info).toBeTruthy();
 expect(info.source).toBe('procedural');
 expect(info.approvedEntries).toBeGreaterThanOrEqual(0);
 await page.locator('.specimen[data-id="m043"]').click();
 await page.locator('#assetSource').selectOption('licensed');
 if(info.approvedEntries>0){
   await expect.poll(async()=>page.evaluate(()=>window.__monsterImportQA?.().externalActive),
     {timeout:30000}).toBe(true);
   const imported=await page.evaluate(()=>window.__monsterImportQA?.());
   expect(imported.clips.length).toBeGreaterThanOrEqual(1);
   await page.locator('#actions button[title="attack"]').click();
   await expect(page.locator('#notice')).toContainText('通常攻撃');
 }else{
   await expect(page.locator('#assetStatus')).toContainText('未登録');
 }
 await page.locator('#assetSource').selectOption('procedural');
 await expect.poll(async()=>page.evaluate(()=>window.__monsterImportQA?.().externalActive)).toBe(false);
 await expect(errors).toEqual([]);
});

test('Quaternius all fifty-model registration: catalog, 3D animation and saved appearance',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/monster-manager.html?v=4.4.85',{
   waitUntil:'domcontentloaded',timeout:65000
 });
 await expect(page.locator('#items .specimen')).toHaveCount(50,{timeout:50000});
 await expect(page.locator('#externalAsset')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__monsterImportQA?.()?.approvedEntries>=0),
  {timeout:30000}).toBe(true);
 const available=await page.evaluate(()=>window.__monsterImportQA());
 expect([0,50]).toContain(available.all50Count);
 const options=page.locator('#externalAsset option[value^="q"]');
 await expect(options).toHaveCount(available.all50Count);
 if(available.all50Count!==50){
   // PR checks run before GitHub Actions publishes the verified 50 GLBs.
   await expect(page.locator('#assetStatus')).toContainText(/0 \/ 50|外部/);
   expect(errors).toEqual([]);
   return;
 }
 await page.locator('.specimen[data-id="m001"]').click();
 await page.locator('#externalAsset').selectOption('q050');
 await expect.poll(()=>page.evaluate(()=>window.__monsterImportQA()?.externalActive),
  {timeout:50000}).toBe(true);
 const active=await page.evaluate(()=>window.__monsterImportQA());
 expect(active.clips.length).toBeGreaterThan(0);
 expect(active.externalAsset).toBe('q050');
 await page.locator('#rememberAsset').click();
 await expect(page.locator('#assignmentStatus')).toContainText('割当保存済み');
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.__monsterImportQA()?.externalAsset),
  {timeout:30000}).toBe('q050');
 await expect.poll(()=>page.evaluate(()=>window.__monsterImportQA()?.externalActive),
  {timeout:50000}).toBe(true);
 await page.locator('#clearAsset').click();
 await expect.poll(()=>page.evaluate(()=>window.__monsterImportQA()?.externalActive)).toBe(false);
 expect(errors).toEqual([]);
});
