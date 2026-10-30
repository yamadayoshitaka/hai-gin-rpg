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
 if(!Number.isFinite(result.qa.equipment.renderedGripDistance)||result.qa.equipment.renderedGripDistance>.025)throw Error('Rendered sword handle differs from right hand by >2.5cm: '+result.qa.equipment.renderedGripDistance);
 if(result.qa.equipment.fingerBoneCount<20)throw Error('Insufficient finger joints: '+result.qa.equipment.fingerBoneCount);
 if(!Number.isFinite(result.qa.equipment.handAngle)||result.qa.equipment.handAngle>.12)throw Error('Weapon/hand rotation discrepancy: '+result.qa.equipment.handAngle);
 if(!Number.isFinite(result.qa.facialAlignment?.headBoneDistance)||result.qa.facialAlignment.headBoneDistance>.035)
  throw Error('Facial donor skeleton is not aligned with outfit: '+JSON.stringify(result.qa.facialAlignment));
 if(!Number.isFinite(result.qa.equipment.fingerGripDistance)||result.qa.equipment.fingerGripDistance>.16)
  throw Error('Weapon grip point too far from finger knuckles: '+result.qa.equipment.fingerGripDistance);

 const fingerEvidence={};
 for(const [action,index] of [['idle',0],['attack',3],['guard',4],['hit',5],['dead',6]]){
  await page.locator('#actions button').nth(index).click();
  await page.waitForFunction(expected=>window.__actionTestQA?.().fingerGrip?.action===expected,action,{timeout:2500});
  const evidence=await page.evaluate(()=>window.__actionTestQA?.().fingerGrip);
  if(evidence?.action!==action)throw Error('Grip action not synchronized: '+action);
  if(evidence.jointCount<20||evidence.right.length<10||evidence.left.length<10)throw Error('Missing imported finger chains for '+action);
  const rightFinger=evidence.right.find(x=>!x.thumb&&x.segment===2);
  const leftFinger=evidence.left.find(x=>!x.thumb&&x.segment===2);
  if(!rightFinger||!leftFinger)throw Error('Missing middle finger articulation for '+action);
  if(Math.abs(leftFinger.angle-.045)>.002)throw Error('Unarmed left hand should remain relaxed: '+leftFinger.angle);
  fingerEvidence[action]=rightFinger.angle;
 }
 if(!(fingerEvidence.attack>fingerEvidence.guard&&fingerEvidence.guard>fingerEvidence.idle&&fingerEvidence.idle>fingerEvidence.hit&&fingerEvidence.hit>fingerEvidence.dead))
  throw Error('Weapon grip action strengths are not distinct: '+JSON.stringify(fingerEvidence));
 console.log('Imported finger articulation evidence:',JSON.stringify(fingerEvidence));
 // Regression: verify the imported sword actually traverses windup, strike
 // and recovery, rather than merely exposing an attack action label.
 await page.locator('#actions button').nth(3).click();
 const swordSamples=[];
 await page.waitForFunction(()=>window.__actionTestQA?.().weaponActionPose?.active===true,null,{timeout:3000});
 for(let i=0;i<7;i++){
  await page.waitForTimeout(125);
  swordSamples.push(await page.evaluate(()=>{
   const q=window.__actionTestQA();
   return {phase:q.attackPhase,pose:q.weaponActionPose};
  }));
 }
 if(swordSamples.some(s=>!s.pose?.active||!Number.isFinite(s.pose.shoulderPitch)||!Number.isFinite(s.pose.elbowPitch)||!Number.isFinite(s.pose.wristPitch)))
  throw Error('Sword attack pose missing or non-finite: '+JSON.stringify(swordSamples));
 const ranges=['shoulderPitch','elbowPitch','wristPitch'].map(k=>Math.max(...swordSamples.map(s=>s.pose[k]))-Math.min(...swordSamples.map(s=>s.pose[k])));
 if(ranges.some(r=>r<.015))throw Error('Sword attack joints do not animate through the clip: '+JSON.stringify({ranges,swordSamples}));
 console.log('Sword attack phase articulation:',JSON.stringify({ranges,swordSamples}));

 const footResults=[];
 for(const [action,index] of [['walk',1],['run',2]]){
  await page.locator('#actions button').nth(index).click();
  // Wait for the IK solver's actual contact evidence, not an arbitrary
  // number of animation frames under throttled software WebGL.
  await page.waitForFunction(expected=>{
   const q=window.__actionTestQA?.();
   return q?.footContact?.action===expected&&q.footContact.planted>0;
  },action,{timeout:7000,polling:100});
  for(let i=0;i<5;i++){
   const measured=await page.evaluate(()=>window.__actionTestQA?.().footContact);
   if(measured?.action===action&&measured.planted>0)footResults.push({action,...measured});
   await page.waitForTimeout(100);
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
