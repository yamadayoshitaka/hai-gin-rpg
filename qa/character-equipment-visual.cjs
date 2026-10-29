const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/action-test.html?qa=weapon-v12744',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(8000);
 await page.selectOption('#job','swordsman');
 await page.waitForTimeout(9000);
 fs.mkdirSync('qa-screenshots',{recursive:true});
 await page.screenshot({path:'qa-screenshots/action-test-swordsman-mobile.png'});
 const result=await page.evaluate(()=>({title:document.querySelector('header strong')?.textContent,qa:window.__actionTestQA?.(),errors:document.querySelector('#diagnostics')?.textContent}));
 console.log(JSON.stringify(result,null,2));
 if(!/^職業別アクションテスト v\d+\.\d+$/.test(result.title||''))throw Error('Missing or invalid editor version');
 if(!result.qa?.visibleModels?.length)throw Error('No visible imported character model: '+(result.qa?.visualError||result.qa?.modelStatus||'unknown'));
 if(result.qa?.equipment?.requested!=='sword')throw Error('Incorrect equipment selection');
 if(!result.qa?.equipment?.loaded?.includes('Sword_Bronze'))throw Error('Sword GLTF not loaded');
 if(result.qa.equipment.handDistance===null||result.qa.equipment.handDistance>.02)throw Error('Sword pivot differs from hand by >2cm');
 const footResults=[];
 for(const [action,index] of [['walk',1],['run',2]]){
  await page.locator('#actions button').nth(index).click();
  for(let i=0;i<5;i++){
   await page.waitForTimeout(150);
   const measured=await page.evaluate(()=>window.__actionTestQA?.().footContact);
   if(measured?.action===action&&measured.planted>0)footResults.push({action,...measured});
  }
 }
 console.log('Foot contact evidence:',JSON.stringify(footResults));
 for(const action of ['walk','run']){
  const values=footResults.filter(x=>x.action===action);
  if(!values.length)throw Error('No IK planted foot evidence for '+action);
  if(values.some(x=>!Number.isFinite(x.maxError)||x.maxError>.06))throw Error('Foot contact drift exceeds 6cm for '+action+': '+JSON.stringify(values));
 }
 if(errors.length)console.warn('Browser errors:',errors.join('\n'));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
