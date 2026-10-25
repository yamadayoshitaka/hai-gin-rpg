import {test,expect} from '@playwright/test';

test('mobile: boot, enter battle, attack and move with arcade lever', async ({page},testInfo)=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/?v=e2e-visual',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#battle-attack')).toBeAttached({timeout:65000});
  await expect(page.locator('#loading')).toBeHidden({timeout:65000});
  await page.screenshot({path:testInfo.outputPath('01-field.png')});
  // Field action is the only fight trigger. The live game decides when combat begins.
  const attack=page.locator('#battle-attack');
  await expect(attack).toBeVisible();
  await attack.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:1});
  await page.waitForTimeout(1400);
  await page.screenshot({path:testInfo.outputPath('02-after-fight.png')});
  await expect(page.locator('body')).toHaveClass(/in-combat/,{timeout:12000});
  const stick=page.locator('#stick-base');
  await expect(stick).toBeVisible();
  const box=await stick.boundingBox();
  if(!box)throw Error('Joystick bounding box missing');
  const cx=box.x+box.width/2,cy=box.y+box.height/2, radius=Math.min(box.width,box.height)*.38;
  async function lever(dx,dy,ms=330){
    await page.mouse.move(cx,cy);
    await page.mouse.down();
    await page.mouse.move(cx+dx*radius,cy+dy*radius,{steps:8});
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  await lever(0,-1);
  await page.screenshot({path:testInfo.outputPath('03-jump.png')});
  await page.waitForTimeout(700);
  await lever(1,-1);
  await page.screenshot({path:testInfo.outputPath('04-diagonal-jump.png')});
  await page.waitForTimeout(700);
  await lever(0,1);
  await page.screenshot({path:testInfo.outputPath('05-crouch.png')});
  for(const [n,id] of [['weak','battle-weak'],['medium','battle-medium'],['strong','battle-strong']]){
    await expect(page.locator('#'+id)).toBeVisible();
    await page.locator('#'+id).dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:5});
    await page.waitForTimeout(600);
    await page.screenshot({path:testInfo.outputPath('06-'+n+'.png')});
  }
  await lever(0,1,120);
  await lever(.70,.70,120);
  await lever(1,0,120);
  await page.locator('#battle-weak').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:6});
  await page.waitForTimeout(500);
  await page.screenshot({path:testInfo.outputPath('07-command-special.png')});
  expect(errors,'Unhandled browser JS errors').toEqual([]);
});
