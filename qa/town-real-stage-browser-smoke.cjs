/* Android startup: one illustrated hub, six working services, fitted map. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>requests.push(r.url()));
 try{
  const response=await page.goto('http://127.0.0.1:8765/game.html?qa=illustrated-town',{waitUntil:'domcontentloaded'});
  assert.ok(response?.ok());
  if(await page.locator('#skip').isVisible())await page.locator('#skip').click();
  await page.locator('#newGame').click();
  if(await page.locator('#tutorialModal').isVisible())await page.locator('#guideSkip').click();
  await page.locator('#playerName').fill('町テスト軍師');
  await page.locator('#playerGender').selectOption('female');
  await page.locator('#newForm button[type=submit]').click();
  await page.waitForURL(/town-hub\.html/);
  await page.waitForFunction(()=>!document.body.classList.contains('town-loading'));
  if(await page.locator('#opening').isVisible())await page.locator('#skipPaper').click();
  await page.waitForFunction(()=>{const img=document.getElementById('townArtwork');return img?.complete&&img.naturalWidth>0;});
  assert.equal(await page.locator('iframe').count(),0,'town never creates a nested battle renderer');
  assert.equal(await page.locator('#townExplorerControls').isVisible(),false);
  assert.equal(await page.locator('#townFacilityPins button').count(),6);
  assert.equal(requests.filter(url=>/tactics-wireframe\.html/.test(url)).length,0,'town must not load a 3D battlefield');
  for(const [facility,title] of [['formation','宿屋'],['weapons','武具屋'],['tavern','酒場'],['story','王城'],['save','教会'],['items','道具屋']]){
   await page.locator('[data-facility="'+facility+'"]').click();
   assert.ok((await page.locator('#panelTitle').innerText()).includes(title),facility+' opens its real service');
   assert.equal(await page.locator('#panel').isVisible(),true);
   assert.ok((await page.locator('#panelContent').innerText()).length>20);
   await page.locator('#panelClose').click();
  }
  fs.mkdirSync('qa-reports/illustrated-town',{recursive:true});
  await page.screenshot({path:'qa-reports/illustrated-town/town-android.png'});
  // Closing the already-seen town outro keeps the navigation path under test.
  await page.locator('#leaveTown').click();
  if(await page.locator('#opening').isVisible())await page.locator('#skipPaper').click();
  await page.waitForURL(/world-map\.html/);
  await page.locator('#mapBoard .pin').first().waitFor();
  const locationBefore=await page.locator('.map-caption').innerText();
  assert.ok(locationBefore.includes('現在地')&&locationBefore.includes('レヴナ'));
  assert.equal(await page.locator('.current-location').count(),1);
  for(const size of [{width:412,height:915},{width:360,height:640}]){
   await page.setViewportSize(size);
   const fit=await page.evaluate(()=>{
    const view=document.getElementById('mapViewport').getBoundingClientRect();
    const board=document.getElementById('mapBoard').getBoundingClientRect();
    return board.width>0&&board.height>0&&board.left>=view.left&&board.right<=view.right&&
     board.top>=view.top&&board.bottom<=view.bottom&&[...document.querySelectorAll('#mapBoard .pin')].every(pin=>{
      const r=pin.getBoundingClientRect();return r.left>=view.left&&r.right<=view.right&&r.top>=view.top&&r.bottom<=view.bottom;
     });
   });
   assert.ok(fit,'all continent pins fit '+JSON.stringify(size));
  }
  await page.setViewportSize({width:412,height:915});
  await page.locator('#stageGrid [data-stage="c01-s02"]').click();
  assert.equal(await page.locator('.map-caption').innerText(),locationBefore,'selecting a destination does not move current location');
  await page.screenshot({path:'qa-reports/illustrated-town/world-map-android.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS Android illustrated town: six services, zero 3D requests, full map and stable current location');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
