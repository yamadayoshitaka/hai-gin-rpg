// Real browser gate: source OBJ must visibly render and wireframe mode must
// change the inspected pixels. Does NOT claim anatomical fit or FF13 art.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('node:fs'),path=require('node:path');
const output='qa-screenshots/master-eye-source';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:760},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:8765/master-eye-source-inspector.html?qa=1',{waitUntil:'domcontentloaded',timeout:60000});
  try{
   await page.waitForFunction(()=>window.__masterEyeSourceQA?.().imported===true,null,{timeout:55000,polling:350});
  }catch(e){
   console.error('EYE_INSPECTOR_DIAGNOSTIC',await page.locator('#stats').textContent());
   await page.screenshot({path:path.join(output,'failed.png')});throw e;
  }
  const stats=await page.evaluate(()=>window.__masterEyeSourceQA());
  if(stats.originalVertices!==1064||stats.originalQuadFaces!==1020||stats.optimized!==false)
   throw Error('The rendered geometry was replaced or simplified: '+JSON.stringify(stats));
  if(stats.characterFitValidated!==false||stats.ff13LevelVerified!==false)
   throw Error('Quality claims must remain honest');
  const canvas=page.locator('#scene');
  await canvas.screenshot({path:path.join(output,'shaded.png')});
  await page.getByRole('button',{name:'ワイヤー表示'}).click();
  await page.waitForFunction(()=>document.querySelector('#modeWire')?.getAttribute('aria-pressed')==='true');
  await page.waitForTimeout(200);
  await canvas.screenshot({path:path.join(output,'wireframe.png')});
  const shaded=PNG.sync.read(fs.readFileSync(path.join(output,'shaded.png')));
  const wire=PNG.sync.read(fs.readFileSync(path.join(output,'wireframe.png')));
  if(shaded.width!==wire.width||shaded.height!==wire.height)throw Error('Inconsistent camera frames');
  let changed=0;
  for(let i=0;i<shaded.data.length;i+=4){
   const d=Math.abs(shaded.data[i]-wire.data[i])+Math.abs(shaded.data[i+1]-wire.data[i+1])+Math.abs(shaded.data[i+2]-wire.data[i+2]);
   if(d>60)changed++;
  }
  if(changed<500)throw Error('Wireframe is not visibly different from PBR shaded mesh: '+changed);
  await page.getByRole('button',{name:'重ねて比較'}).click();
  if(await page.locator('#modeBoth').getAttribute('aria-pressed')!=='true')throw Error('Combined mode inactive');
  await canvas.screenshot({path:path.join(output,'overlay.png')});
  if(errors.length)throw Error('Browser errors '+errors.join(' | '));
  const report={...stats,wireframeChangedPixels:changed,real3dRendered:true,
   shadingComparisonPassed:true,realSourceGeometryVerified:true,errors};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('MASTER_EYE_SOURCE_BROWSER_PASS '+JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error('MASTER_EYE_SOURCE_BROWSER_FAILED',e);process.exitCode=1});
