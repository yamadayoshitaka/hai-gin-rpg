const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:430,height:932},hasTouch:true,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/?v=ci-skin',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(window.__haiGinStarted&&window.__haiGinReadQA),{timeout:45000});
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
  await page.screenshot({path:'qa-screenshots/skin-and-movement.png'});
  await page.evaluate(()=>{window.__haiGinPortraitQA=true;});
  await page.waitForTimeout(500);
  await page.screenshot({path:'qa-screenshots/anime-face-closeup.png'});
  await page.evaluate(()=>{window.__haiGinPortraitQA=false;});
  // Exercise exterior -> interior -> exterior via the production transition controller.
  await page.evaluate(()=>window.__haiGinQAChangeHouse(0));
  await page.waitForFunction(()=>window.__haiGinReadQA().indoorIndex===0,{timeout:15000});
  await page.waitForTimeout(1300);
  const indoor=await page.evaluate(()=>window.__haiGinReadQA());
  assert.ok(indoor.humanSkin,'Skinned hero must survive interior transition');
  await page.screenshot({path:'qa-screenshots/skin-interior.png'});
  await page.evaluate(()=>window.__haiGinQAChangeHouse());
  await page.waitForFunction(()=>window.__haiGinReadQA().indoorIndex===-1,{timeout:15000});
  await page.waitForTimeout(800);
  const exteriorAgain=await page.evaluate(()=>window.__haiGinReadQA());
  assert.ok(exteriorAgain.humanSkin,'Skinned hero must survive return outdoors');
  await page.screenshot({path:'qa-screenshots/skin-outdoor-return.png'});
  console.log(JSON.stringify({status:'pass',distance,skin:after.humanSkin,joints:after.humanJoints,startHour:before.startHour}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
