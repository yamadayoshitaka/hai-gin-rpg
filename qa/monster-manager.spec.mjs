import {test,expect} from '@playwright/test';

test('mobile bestiary: 50 unique 3D monsters, saved edits and sample motions',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('/monster-manager.html?v=4.4.81',
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
 await page.goto('/monster-manager.html?v=4.4.81',{waitUntil:'domcontentloaded',timeout:65000});
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
