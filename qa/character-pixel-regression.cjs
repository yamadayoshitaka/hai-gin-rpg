// Rendered-pixel regression: visual changes must be visible, not merely present in JSON.
// This is a deterministic image-change gate, not a learned "naturalness" classifier.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('node:fs');
const path=require('node:path');
const OUT='qa-screenshots/visual-diff';
fs.mkdirSync(OUT,{recursive:true});
function compare(a,b,{top=0,bottom=1,left=0,right=1,threshold=24}={}){
 const x=PNG.sync.read(a),y=PNG.sync.read(b);
 if(x.width!==y.width||x.height!==y.height)throw Error('Image dimensions differ');
 let changed=0,total=0,sum=0;
 for(let j=Math.floor(x.height*top);j<Math.floor(x.height*bottom);j+=2)
  for(let i=Math.floor(x.width*left);i<Math.floor(x.width*right);i+=2){
   const at=(j*x.width+i)*4;
   const diff=(Math.abs(x.data[at]-y.data[at])+Math.abs(x.data[at+1]-y.data[at+1])+Math.abs(x.data[at+2]-y.data[at+2]))/3;
   sum+=diff; total++; if(diff>threshold)changed++;
  }
 return {changedRatio:changed/total,meanDiff:sum/total};
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const faults=[],metrics={};
  page.on('pageerror',e=>faults.push('JS: '+e.message));
  await page.goto('http://127.0.0.1:8765/action-test.html?pixel-regression=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__actionTestQA?.().visibleModels?.length===1,null,{timeout:45000});
  await page.selectOption('#job','swordsman');
  const shot=async(label)=>{
   await page.waitForFunction(()=>window.__actionTestQA?.().visibleModels?.length===1,null,{timeout:45000});
   await page.waitForTimeout(700);
   const file=path.join(OUT,label+'.png');
   await page.locator('#view').screenshot({path:file,animations:'disabled'});
   return fs.readFileSync(file);
  };
  await page.locator('#actions button').nth(0).click();
  await page.selectOption('#edit-hair','bald');const bald=await shot('hair-bald');
  await page.selectOption('#edit-hair','layered');const layered=await shot('hair-layered');
  metrics.hair=compare(bald,layered,{top:.07,bottom:.42,left:.25,right:.75});
  if(metrics.hair.changedRatio<.003)faults.push('Hair change not visible in head region: '+JSON.stringify(metrics.hair));
  await page.selectOption('#edit-equipment','none');const bare=await shot('equipment-none');
  await page.selectOption('#edit-equipment','sword');const sword=await shot('equipment-sword');
  metrics.weapon=compare(bare,sword,{top:.25,bottom:.86,left:.42,right:.95});
  if(metrics.weapon.changedRatio<.004)faults.push('Sword toggle not visible in hand region: '+JSON.stringify(metrics.weapon));
  await page.locator('#actions button').nth(0).click();const idle=await shot('pose-idle');
  await page.locator('#actions button').nth(4).click();const guard=await shot('pose-guard');
  metrics.guard=compare(idle,guard,{top:.18,bottom:.77});
  if(metrics.guard.changedRatio<.012)faults.push('Guard visually indistinguishable from idle: '+JSON.stringify(metrics.guard));
  await page.locator('#actions button').nth(6).click();const dead=await shot('pose-dead');
  metrics.dead=compare(idle,dead,{top:.18,bottom:.94});
  if(metrics.dead.changedRatio<.03)faults.push('Incapacitated pose visually indistinguishable from idle: '+JSON.stringify(metrics.dead));
  const state=await page.evaluate(()=>window.__actionTestQA?.());
  if(!state?.visibleModels?.length)faults.push('Imported model disappeared');
  const report={status:faults.length?'FAIL':'PASS',metrics,faults,limits:['Changed-pixel detection checks visible differentiation, not human-level anatomical realism.','Hand-grip penetration and hair silhouette still require semantic masks or reviewed reference images.']};
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(faults.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
