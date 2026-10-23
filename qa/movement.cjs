const { chromium } = require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const BASE=process.env.QA_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const dir='qa-screenshots';fs.mkdirSync(dir,{recursive:true});
 const results=[];
 try{
  const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1,hasTouch:true});
  page.on('pageerror',e=>results.push({test:'pageerror',ok:false,details:e.message}));
  await page.goto(BASE+'?build=movement-qa',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!document.querySelector('#loading')||getComputedStyle(document.querySelector('#loading')).display==='none',{timeout:30000});
  const snapshot=()=>page.evaluate(()=>({
   version:document.querySelector('.brand small')?.textContent,
   inRoom:typeof indoorIndex!=='undefined'?indoorIndex:-2,
   heroModel:!!player.userData.combatModel&&player.userData.combatModel.visible,
   heroChibi:!!player.userData.chibi?.root?.visible,
   residents:indoorIndex>=0?rooms[indoorIndex].people.map(n=>({id:n.id,x:n.g.position.x,z:n.g.position.z,chibi:!!n.g.userData.chibi})):[],
   sceneValid:indoorIndex>=0?rooms[indoorIndex].g.visible:true
  }));
  const initial=await snapshot();
  results.push({test:'startup',ok:initial.inRoom===-1,initial});
  // Use the normal game entry method; do not force qaIndoor= to avoid hiding entry bugs.
  await page.evaluate(()=>changeHouse(0));
  await page.waitForTimeout(2600);
  const entry=await snapshot();results.push({test:'first-entry',ok:entry.inRoom===0&&entry.sceneValid&&entry.residents.length>0,entry});
  await page.screenshot({path:dir+'/functional-first-entry.png'});
  // Walk for several seconds, exercising joystick input and NPC simulation.
  const before=entry.residents;
  await page.evaluate(()=>{stickX=0;stickY=-.8;stickMagnitude=.8;});
  const poses=[];
  for(let frame=0;frame<9;frame++){
   await page.waitForTimeout(210);
   poses.push(await page.evaluate(()=>{
    const m=player.userData.combatModel;
    return m?{y:m.position.y,rz:m.rotation.z,ry:m.rotation.y,
      bones:player.userData.skeletonWalk?.animated||false,
      moving:player.userData.chibi?.moving||false}:null;
   }));
  }
  const varyingPose=poses.filter(Boolean);
  const motionRange=varyingPose.length?Math.max(...varyingPose.map(p=>p.y))-Math.min(...varyingPose.map(p=>p.y)):0;
  const turnRange=varyingPose.length?Math.max(...varyingPose.map(p=>p.rz))-Math.min(...varyingPose.map(p=>p.rz)):0;
  results.push({test:'hero-visible-gait',ok:varyingPose.length>3&&(motionRange>.015||turnRange>.02),
   yRange:motionRange,rollRange:turnRange,poses});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>{stickX=0;stickY=0;stickMagnitude=0;});
  const after=await snapshot();
  const moved=before.some(n=>{const q=after.residents.find(m=>m.id===n.id);return q&&Math.hypot(q.x-n.x,q.z-n.z)>.10});
  results.push({test:'resident-movement',ok:moved,delta:after.residents.map(n=>{const b=before.find(m=>m.id===n.id);return {id:n.id,delta:b?Math.hypot(n.x-b.x,n.z-b.z):null}})});
  results.push({test:'3d-hero-not-doll',ok:after.heroModel&&!after.heroChibi,after});
  await page.screenshot({path:dir+'/functional-after-walking.png'});
  // Verify exit and second entry do not depend on a first-failure warmup.
  await page.evaluate(()=>{if(indoorIndex>=0){const h=houseEntries[indoorIndex];indoorIndex=-1;setIndoorScene(-1);player.position.set(h.outX,0,h.outZ);}});
  await page.evaluate(()=>changeHouse(0));
  await page.waitForTimeout(2400);
  const second=await snapshot();results.push({test:'re-entry',ok:second.inRoom===0&&second.sceneValid,second});
  await page.close();
 }finally{await browser.close();}
 fs.writeFileSync(dir+'/movement-report.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 if(results.some(x=>!x.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});