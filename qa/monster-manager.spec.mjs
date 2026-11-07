import {test,expect} from '@playwright/test';

test('mobile bestiary: 50 unique 3D monsters, saved edits and sample motions',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('/monster-manager.html?v=4.4.78',
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
