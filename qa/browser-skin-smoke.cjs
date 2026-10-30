const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:430,height:932},hasTouch:true,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/play-1210.html?v=ci-skin',{waitUntil:'domcontentloaded',timeout:60000});
  // Browser RAF can be heavily throttled by SwiftShader; inspect boot state outside
  // waitForFunction polling to avoid false timeouts after the game has started.
  await page.waitForTimeout(4500);
  // Model loading can be slow with software WebGL; wait for the actual app signal.
  await page.waitForFunction(()=>Boolean(window.__haiGinStarted),null,{timeout:75000}).catch(()=>{});
  const boot=await page.evaluate(()=>({
   started:Boolean(window.__haiGinStarted),
   readQA:typeof window.__haiGinReadQA,
   error:document.querySelector('#game-boot-error')?.textContent||null
  }));
  if(!boot.started){
   fs.mkdirSync('qa-screenshots',{recursive:true});
   await page.screenshot({animations:'disabled',timeout:60000,path:'qa-screenshots/game-boot-failure.png'});
   console.log('Boot loading diagnostic:',await page.evaluate(()=>({loading:document.querySelector('#loading')?.innerText,ready:document.readyState,resources:performance.getEntriesByType('resource').length})));
  }
  assert.ok(boot.started&&boot.readQA==='function','Game boot state: '+JSON.stringify({boot,errors}));
  // Regression: measure rendered CSS pixels, not declarations or screenshot impressions.
  const controlSizes=await page.evaluate(()=>{
   const ids=['stick-base','quality','talk','battle-attack'];
   return Object.fromEntries(ids.map(id=>{
    const node=document.getElementById(id),r=node.getBoundingClientRect(),css=getComputedStyle(node);
    return [id,{width:r.width,height:r.height,display:css.display,visibility:css.visibility}];
   }));
  });
  for(const [id,minW,minH] of [['stick-base',170,170],['quality',180,70],['talk',180,70],['battle-attack',110,80]]){
   const got=controlSizes[id];
   assert.ok(got.width>=minW&&got.height>=minH,id+' must be touch-sized: '+JSON.stringify(got));
   assert.notEqual(got.display,'none',id+' must be visible');
  }
  console.log('Mobile control dimensions:',JSON.stringify(controlSizes));
  // The active game uses 3D ATB, not the retired three-button arcade UI.
  assert.ok(await page.locator('#battle-attack').count(),'3D ATB entry button exists');
  console.log('3D ATB entry controls validated');
  // An imported GLTF is not acceptable simply because it loads: bad skeleton or T-pose
  // must safely remain on the legacy anatomical model, and the reason is reported.
  await page.waitForTimeout(2600);
  // NPC GLTF imports are asynchronous. Observe completion instead of
  // asserting on an arbitrary intermediate frame after 2.6 seconds.
  await page.waitForFunction(()=>{
   const v=window.__haiGinCharacterVisualQA?.();
   return v&&v.npcTotal===30&&(v.npcLoaded===0||v.npcLoaded===v.npcTotal);
  },null,{timeout:30000,polling:500}).catch(()=>{});
  const visuals=await page.evaluate(()=>window.__haiGinCharacterVisualQA?.());
  assert.ok(visuals,'Character visual QA must exist');
  assert.equal(visuals.npcTotal,30,'Town NPC count must match 30-character design');
  assert.ok(visuals.npcLoaded===0||visuals.npcLoaded===visuals.npcTotal,'All NPC models must use a consistent acceptance contract');
  assert.ok(['quaternius-cc0-outfit','anatomical-human-bom','stable-procedural-bom','ual-external-motion'].includes(visuals.hero),'Hero must use a known safe model: '+visuals.hero);
  console.log('Validated character visuals:',JSON.stringify(visuals));
  const before=await page.evaluate(()=>window.__haiGinReadQA());
  assert.ok(before.humanSkin,'Protagonist must have continuous skinned human mesh');
  assert.ok(before.humanJoints>=10,'Protagonist joints must be instantiated');
  assert.ok(before.startHour>=8&&before.startHour<9,'Morning game world start');
  const joystick=page.locator('#stick-base');
  const box=await joystick.boundingBox();
  assert.ok(box,'Visible mobile joystick');
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  await page.mouse.move(cx,cy);
  await page.mouse.down();
  await page.mouse.move(cx,cy-box.height*.33,{steps:6});
  await page.waitForTimeout(1400);
  await page.mouse.up();
  const after=await page.evaluate(()=>window.__haiGinReadQA());
  const distance=Math.hypot(after.position[0]-before.position[0],after.position[2]-before.position[2]);
  assert.ok(distance>.05,'Player must move when the joystick is held: '+distance);
  assert.equal(errors.length,0,'Browser JavaScript errors: '+errors.join(' | '));
  fs.mkdirSync('qa-screenshots',{recursive:true});
  await page.screenshot({animations:'disabled',timeout:60000,path:'qa-screenshots/skin-and-movement.png'});
  await page.evaluate(()=>{window.__haiGinPortraitQA=true;});
  await page.waitForTimeout(500);
  await page.screenshot({animations:'disabled',timeout:60000,path:'qa-screenshots/anime-face-closeup.png'});
  await page.evaluate(()=>{window.__haiGinPortraitQA=false;});
  // Exercise exterior -> interior -> exterior via the production transition controller.
  await page.evaluate(()=>window.__haiGinQAChangeHouse(0));
  await page.waitForFunction(()=>window.__haiGinReadQA().indoorIndex===0,{timeout:15000});
  await page.waitForTimeout(1300);
  const indoor=await page.evaluate(()=>window.__haiGinReadQA());
  assert.ok(indoor.humanSkin,'Skinned hero must survive interior transition');
  await page.screenshot({animations:'disabled',timeout:60000,path:'qa-screenshots/skin-interior.png'});
  await page.evaluate(()=>window.__haiGinQAChangeHouse());
  await page.waitForFunction(()=>window.__haiGinReadQA().indoorIndex===-1,{timeout:15000});
  await page.waitForTimeout(800);
  const exteriorAgain=await page.evaluate(()=>window.__haiGinReadQA());
  assert.ok(exteriorAgain.humanSkin,'Skinned hero must survive return outdoors');
  await page.screenshot({animations:'disabled',timeout:60000,path:'qa-screenshots/skin-outdoor-return.png'});
  console.log(JSON.stringify({status:'pass',distance,skin:after.humanSkin,joints:after.humanJoints,startHour:before.startHour}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
