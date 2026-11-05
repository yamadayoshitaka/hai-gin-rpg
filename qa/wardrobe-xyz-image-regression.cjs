// A rendered, anatomical regression: actual 65-joint WORLD XYZ, real palm-to-
// hilt distance and blade axis, plus PNG changes from enabling hair/equipment.
// Artifacts include front/side/back for every male/female job, so reviewers
// can approve stable golden references later without silently accepting bugs.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('node:fs');
const path=require('node:path');
const JOBS=['job01','job02','job03','job04','job05','job06','job07','job08','job09','job10',
 'king','minister','servant','princess','prince','queen'];
const shard=Number(process.env.QA_SHARD||0),shards=Number(process.env.QA_SHARDS||4);
if(!Number.isInteger(shard)||!Number.isInteger(shards)||shard<0||shard>=shards)throw Error('Invalid QA shard');
const dir=path.join('qa-screenshots','wardrobe-xyz','shard-'+shard);
fs.mkdirSync(dir,{recursive:true});
const failures=[],records=[];

function comparePng(first,second,label){
 const a=PNG.sync.read(first),b=PNG.sync.read(second);
 if(a.width!==b.width||a.height!==b.height)throw Error('PNG dimensions differ: '+label);
 const diff=new PNG({width:a.width,height:a.height});
 let changed=0,visible=0;
 for(let i=0;i<a.data.length;i+=4){
  const delta=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
  if(delta>35){changed++;diff.data[i]=255;diff.data[i+1]=75;diff.data[i+2]=35;diff.data[i+3]=255}
  else{diff.data[i]=a.data[i]*.2;diff.data[i+1]=a.data[i+1]*.2;diff.data[i+2]=a.data[i+2]*.2;diff.data[i+3]=255}
  visible++;
 }
 fs.writeFileSync(path.join(dir,label+'-difference.png'),PNG.sync.write(diff));
 return {changedPixels:changed,ratio:+(changed/visible).toFixed(5)};
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:8765/outfit-maintenance.html?wardrobe-xyz-regression=1',{waitUntil:'domcontentloaded'});
  const camera=async view=>{await page.evaluate(angle=>window.__wardrobeCamera(angle),view);await page.waitForTimeout(250)};
  const shot=async name=>{const file=path.join(dir,name+'.png');
    await page.locator('#viewport').screenshot({path:file,animations:'disabled',timeout:90000});return fs.readFileSync(file)};
  // Load each seven-head body once per shard/sex; otherwise switching gender
  // between every job repeatedly rebuilds expensive high-density mesh assets.
  for(const sex of ['male','female'])for(let i=shard;i<JOBS.length;i+=shards){
   const job=JOBS[i],key=job+'-'+sex;
   try{
    if(await page.locator('#sex').inputValue()!==sex){
     await page.selectOption('#sex',sex);
     await page.waitForFunction(sex=>window.__wardrobeQA?.()?.sex===sex,sex,{timeout:90000});
    }
    await page.selectOption('#jobList',job);
    await page.waitForFunction(({job,sex})=>{
     const data=window.__wardrobeQA?.();
     return data?.job===job&&data.sex===sex&&data.status.startsWith('表示中：');
    },{job,sex},{timeout:90000});
    const q=await page.evaluate(()=>window.__wardrobeQA());
    if(!q?.diagnostics?.hairAttached)throw Error('Hair GLB missing');
    if(q.presentation.maxJointXYZError>.006)throw Error('Outfit joint world-XYZ drift: '+JSON.stringify(q.presentation.worstJointOffsets));
    if(q.presentation.scalpMethod!=='skinned-head-surface'||q.presentation.scalpTriangles<20)
     throw Error('Real scalp surface missing: '+JSON.stringify(q.presentation));
    if(q.presentation.gearContacts.some(g=>g.error>.006||g.axisDot!==null&&g.axisDot<.45))
     throw Error('Weapon grip XYZ/angle wrong: '+JSON.stringify(q.presentation.gearContacts));
    if(q.presentation.gearContacts.length&&q.presentation.closedFingerJoints<12)
     throw Error('Holding hand did not articulate all four fingers');
    if(q.diagnostics.weaponKinds.includes('shield')&&q.presentation.shieldFrontDot<.7)
     throw Error('Shield faces away from front: '+q.presentation.shieldFrontDot);
    if(q.fit?.verified===false)throw Error('Outfit body bounds displaced: '+JSON.stringify(q.fit));
    const views={};
    for(const angle of ['front','side','back']){await camera(angle);views[angle]=await shot(key+'-'+angle)}
    const orientation=comparePng(views.front,views.back,key+'-front-back');
    if(orientation.changedPixels<180)throw Error('Front/back imagery unexpectedly identical');
    let hairDiff=null,weaponDiff=null;
    if(q.presentation.hairVisible){
     await camera('top');const withHair=await shot(key+'-hair-on');
     await page.locator('#showHair').uncheck();await page.waitForTimeout(200);
     const withoutHair=await shot(key+'-hair-off');
     hairDiff=comparePng(withHair,withoutHair,key+'-hair');
     if(hairDiff.changedPixels<100)throw Error('Hair and scalp are not visibly rendered');
     await page.locator('#showHair').check();
    }
    if(q.diagnostics.gear){
     await camera('front');const equipped=await shot(key+'-gear-on');
     await camera('hand');await shot(key+'-hand-grip-closeup');
     await camera('front');
     await page.locator('#showWeapon').uncheck();await page.waitForTimeout(200);
     const unequipped=await shot(key+'-gear-off');
     weaponDiff=comparePng(equipped,unequipped,key+'-gear');
     if(weaponDiff.changedPixels<60)throw Error('Equipped prop is not visibly rendered');
     await page.locator('#showWeapon').check();
    }
    const row={job,sex,bones:q.diagnostics.matchingBones,maxXYZ:q.presentation.maxJointXYZError,
     scalpTriangles:q.presentation.scalpTriangles,contacts:q.presentation.gearContacts,
     orientation,hairDiff,weaponDiff};
    records.push(row);console.log('PASS',key,JSON.stringify(row));
   }catch(error){failures.push({job,sex,error:String(error.message||error)});console.error('FAIL',key,error)}
  }
  failures.push(...pageErrors.map(error=>({error:'Browser: '+error})));
  const report={shard,shards,tested:records.length,expected:JOBS.filter((_,i)=>i%shards===shard).length*2,
   failures,records,notice:'Screenshot differences validate visibility; coordinate and joint checks validate anatomical contact. Human-approved visual baselines remain a separate acceptance step.'};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  if(failures.length||report.tested!==report.expected)process.exitCode=1;
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
