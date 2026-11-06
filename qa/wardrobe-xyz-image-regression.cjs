// A rendered, anatomical regression: actual 65-joint WORLD XYZ, real palm-to-
// hilt distance and blade axis, plus PNG changes from enabling hair/equipment.
// Artifacts include front/side/back for every male/female job, so reviewers
// can approve stable golden references later without silently accepting bugs.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const JOBS=['job01','job02','job03','job04','job05','job06','job07','job08','job09','job10',
 'king','minister','servant','princess','prince','queen','strategist'];
// Pushes exercise high-risk variants quickly. The nightly/manual full run still
// checks every job and gender, including all three views and hand closeups.
const mode=['smoke','fast'].includes(process.env.QA_MODE)?process.env.QA_MODE:'full';
const quick=mode!=='full';
const SMOKE_CASES=[{job:'job01',sex:'male'},{job:'job06',sex:'female'}];
const FAST_CASES=[
 {job:'job01',sex:'male'},     // steel helmet, gambeson, blade
 {job:'job05',sex:'female'},   // plate armor, helmet, shield
 {job:'job06',sex:'male'},     // hood + twelve split leather panels
 {job:'job06',sex:'female'},   // hood hair clipping against female scalp
 {job:'strategist',sex:'female'}, // command mantle, brocade, new baton
 {job:'job04',sex:'male'},     // ranged weapon and hand pose
];
// If the last two runs stalled, change which asset families are inspected.
// This automatically pivots the *diagnosis*, never silently rewrites art.
const PIVOT_CASES={
 unchanged:[{job:'strategist',sex:'male'},{job:'strategist',sex:'female'},
  {job:'job02',sex:'male'},{job:'job07',sex:'male'},{job:'job07',sex:'female'},
  {job:'queen',sex:'female'}],
 hair_headwear:[{job:'job01',sex:'male'},{job:'job01',sex:'female'},{job:'job05',sex:'male'},
  {job:'job05',sex:'female'},{job:'job06',sex:'male'},{job:'job06',sex:'female'}],
 rig_fit:[{job:'job01',sex:'male'},{job:'job01',sex:'female'},{job:'job02',sex:'male'},
  {job:'job02',sex:'female'},{job:'job05',sex:'male'},{job:'job05',sex:'female'}],
 weapon_socket:[{job:'job01',sex:'male'},{job:'job01',sex:'female'},{job:'job04',sex:'male'},
  {job:'job04',sex:'female'},{job:'job05',sex:'male'},{job:'job05',sex:'female'}],
};
let pivotFocus=null;
try{
 const file=process.env.QA_PREVIOUS_FEEDBACK;
 if(file&&fs.existsSync(file)){
  const last=JSON.parse(fs.readFileSync(file,'utf8'));
  if(last.action==='change_direction'&&PIVOT_CASES[last.focus])pivotFocus=last.focus;
 }
}catch(error){console.warn('Previous QA feedback unreadable:',error.message)}
const shard=Number(process.env.QA_SHARD||0),shards=Number(process.env.QA_SHARDS||(quick?1:4));
if(!Number.isInteger(shard)||!Number.isInteger(shards)||shard<0||shard>=shards)throw Error('Invalid QA shard');
const selected=(quick?(PIVOT_CASES[pivotFocus]||(mode==='smoke'?SMOKE_CASES:FAST_CASES))
 :('male female'.split(' ').flatMap(sex=>JOBS.map(job=>({job,sex})))))
 .filter(({job})=>quick?shard===0:JOBS.indexOf(job)%shards===shard);
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

// A coarse visual fingerprint deliberately ignores tiny frame/AA differences.
// This is a change detector, not a subjective beauty score.
function visualSample(bytes){
 const {width,height,data}=PNG.sync.read(bytes),grid=[];
 for(let y=0;y<18;y++)for(let x=0;x<12;x++){
  const px=Math.floor((x+.5)*width/12),py=Math.floor((y+.5)*height/18);
  const index=4*(py*width+px);
  for(let c=0;c<3;c++)grid.push(Math.round(data[index+c]/8));
 }
 return grid;
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:8765/outfit-maintenance.html?wardrobe-xyz-regression=1',{waitUntil:'domcontentloaded'});
  const camera=async view=>{await page.evaluate(angle=>window.__wardrobeCamera(angle),view);await page.waitForTimeout(quick?100:250)};
  const shot=async name=>{const file=path.join(dir,name+'.png');
    await page.locator('#viewport').screenshot({path:file,animations:'disabled',timeout:90000});return fs.readFileSync(file)};
  // Load each seven-head body once per shard/sex; otherwise switching gender
  // between every job repeatedly rebuilds expensive high-density mesh assets.
  for(const {job,sex} of selected){
   const key=job+'-'+sex;
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
    if(job==='job06'&&q.diagnostics.tunicPanels!==12)
     throw Error('Thief waist garment became a solid cylinder instead of twelve split leather panels');
    if(job==='job06'&&q.diagnostics.thiefSourceBeltsHidden<2)
     throw Error('Ranger oversized stock leather hoops still surround the thief waist');
    if(job==='strategist'&&(q.diagnostics.commanderPieces<10||
      q.diagnostics.detailMotif!=='compass'||q.diagnostics.commanderUniformMeshes<1||
      !q.diagnostics.weaponKinds.includes('command-baton')))
     throw Error('Strategist lost bespoke mantle, command insignia or baton');
    if((job==='job01'||job==='job05')&&q.diagnostics.gambesonMeshes<1)
     throw Error('Knight photo-textured gambeson absent; green Ranger tunic may show through armor');
    if((job==='job01'||job==='job05')&&(q.diagnostics.correctedLimbMeshes<2||q.diagnostics.preservedSkinMaterials<1))
     throw Error('Armor recoloring reached bare hands or left green source leggings: '+JSON.stringify(q.diagnostics));
    if(q.presentation.hairCoverage==='hood'&&!q.presentation.hairVisible)
     throw Error('Hood obscured all hair instead of preserving safe face-framing strands');
    if(q.presentation.maxJointXYZError>.006)throw Error('Outfit joint world-XYZ drift: '+JSON.stringify(q.presentation.worstJointOffsets));
    if(q.presentation.scalpMethod!=='skinned-head-surface'||q.presentation.scalpTriangles<20)
     throw Error('Real scalp surface missing: '+JSON.stringify(q.presentation));
    if(q.presentation.rootFiberTriangles<1000)
     throw Error('Scalp is a smooth bald cap with no polygon hair fibers: '+JSON.stringify(q.presentation));
    if(q.presentation.gearContacts.some(g=>g.error>.006||g.bladeUpDot<.72||
      g.tipAbovePalm<.10||g.bladeForwardDot<.1||g.gripCalibratedAxis!=='raised-in-palm'))
      throw Error('Weapon is not upright and grasped at the palm in XYZ: '+JSON.stringify(q.presentation.gearContacts));
    if(q.presentation.gearContacts.length&&q.presentation.closedFingerJoints<15)
     throw Error('Holding hand did not articulate all four fingers and opposing thumb');
    if(q.presentation.gearContacts.some(g=>g.thumbToHandle===null||g.thumbToHandle>.05))
     throw Error('Thumb tip is not touching the real weapon hilt: '+JSON.stringify(q.presentation.gearContacts));
    if(q.presentation.gearContacts.some(g=>Object.values(g.fingerToHandle||{})
      .some(distance=>distance===null||distance>.030)))
     throw Error('At least one finger remains visibly open around the weapon handle: '+JSON.stringify(q.presentation.gearContacts));
    if(q.diagnostics.weaponKinds.includes('shield')&&q.presentation.shieldFrontDot<.7)
     throw Error('Shield faces away from front: '+q.presentation.shieldFrontDot);
    if(q.fit?.verified===false)throw Error('Outfit body bounds displaced: '+JSON.stringify(q.fit));
    const views={};
    for(const angle of (quick?['front','back']:['front','side','back'])){
     await camera(angle);views[angle]=await shot(key+'-'+angle);
    }
    const orientation=comparePng(views.front,views.back,key+'-front-back');
    if(orientation.changedPixels<180)throw Error('Front/back imagery unexpectedly identical');
    let hairDiff=null,weaponDiff=null;
    if(q.presentation.hairVisible){
     await camera(q.presentation.hairCoverage==='hood'?'front':'top');
     const withHair=await shot(key+'-hair-on');
     await page.locator('#showHair').uncheck();await page.waitForTimeout(200);
     const withoutHair=await shot(key+'-hair-off');
     hairDiff=comparePng(withHair,withoutHair,key+'-hair');
     if(hairDiff.changedPixels<(q.presentation.hairCoverage==='hood'?45:100))
      throw Error('Hair and scalp are not visibly rendered under selected headwear');
     await page.locator('#showHair').check();
    }
    if(q.diagnostics.armorPieces){
     await page.locator('#showHelmet').check();
     await page.waitForTimeout(180);
     const wearing=await page.evaluate(()=>window.__wardrobeQA().presentation);
     if(!wearing.helmetVisible||!wearing.hairVisible||wearing.hairCoverage!=='helmet')
      throw Error('Metal helmet must remain visible with clipped hair underneath');
     if(wearing.headwearKeptTriangles>=wearing.headwearSourceTriangles)
      throw Error('Helmet does not cull upper hair that pierces the steel');
     await page.locator('#showHelmet').uncheck();
    }
    if(q.diagnostics.gear){
     await camera('front');const equipped=await shot(key+'-gear-on');
     if(mode==='full'){await camera('hand');await shot(key+'-hand-grip-closeup')}
     await camera('front');
     await page.locator('#showWeapon').uncheck();await page.waitForTimeout(200);
     const unequipped=await shot(key+'-gear-off');
     weaponDiff=comparePng(equipped,unequipped,key+'-gear');
     const minPixels=q.diagnostics.weaponKinds.includes('sword')?500:60;
     if(weaponDiff.changedPixels<minPixels)throw Error('Equipped prop is not visibly rendered: '+JSON.stringify(weaponDiff));
     await page.locator('#showWeapon').check();
    }
    const row={job,sex,bones:q.diagnostics.matchingBones,maxXYZ:q.presentation.maxJointXYZError,
     scalpTriangles:q.presentation.scalpTriangles,contacts:q.presentation.gearContacts,
     orientation,hairDiff,weaponDiff,
     visualSignature:crypto.createHash('sha256').update(views.front).update(views.back).digest('hex'),
     visualSample:visualSample(views.front)};
    records.push(row);console.log('PASS',key,JSON.stringify({...row,visualSample:undefined}));
   }catch(error){failures.push({job,sex,error:String(error.message||error)});console.error('FAIL',key,error)}
  }
  failures.push(...pageErrors.map(error=>({error:'Browser: '+error})));
  const report={mode,pivotFocus,shard,shards,tested:records.length,expected:selected.length,
   failures,records,notice:'Screenshot differences validate visibility; coordinate and joint checks validate anatomical contact. Human-approved visual baselines remain a separate acceptance step.'};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  if(failures.length||report.tested!==report.expected)process.exitCode=1;
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
