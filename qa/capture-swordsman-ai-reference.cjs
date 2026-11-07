/**
 * Capture ACTUAL live game swordsman for AI image-to-3D reference.
 * No generated 3D is claimed here. Output is a 3x3 source contact set.
 * Uses the real shared outfit runtime as the game and motion preview.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out='assets/ai-reference/swordsman';
const poses=['front','side','back'];
const cases=[
 {name:'equipped',body:true,outfit:true,hair:true,weapon:true},
 {name:'nude',body:true,outfit:false,hair:false,weapon:false},
 {name:'outfit',body:false,outfit:true,hair:false,weapon:false}
];
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 let page;
 try{
  page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')console.error('browser:',msg.text().slice(0,250))});
  await page.goto('http://127.0.0.1:8765/outfit-maintenance.html?job=job01&swordsman-ai-baseline=1',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>{
   const qa=window.__wardrobeQA?.();
   return qa?.job==='job01'&&qa?.sex==='male'&&qa.status.startsWith('表示中：')
       &&qa.diagnostics?.armorPieces>0;
  },null,{timeout:120000});
  await page.locator('#showHelmet').check();
  await page.waitForTimeout(500);
  const qa=await page.evaluate(()=>window.__wardrobeQA());
  const render={...qa,job:'job01',sex:'male',source:'live outfit-maintenance (uses same rigged outfit implementation as game)',
   generator:'Playwright screenshot only: NOT AI model generation',
   imageGeneration:false,renderedImages:[],qaErrors:[]};
  for(const {name,body,outfit,hair,weapon} of cases){
   for(const [selector,checked] of [
    ['#showBody',body],['#showOutfit',outfit],['#showHair',hair],
    ['#showWeapon',weapon],['#showHelmet',outfit]
   ]){
    const checkbox=page.locator(selector);
    if(checked)await checkbox.check();else await checkbox.uncheck();
   }
   await page.waitForTimeout(450);
   for(const pose of poses){
    await page.evaluate(p=>window.__wardrobeCamera(p),pose);
    await page.waitForTimeout(450);
    const filename=name+'-'+pose+'.png';
    const target=path.join(out,filename);
    await page.locator('#viewport canvas').screenshot({
     path:target,animations:'disabled',timeout:120000
    });
    const stat=fs.statSync(target);
    if(stat.size<7000)throw Error('Screenshot too small or blank: '+filename+' ('+stat.size+')');
    render.renderedImages.push({state:name,view:pose,file:out+'/'+filename,bytes:stat.size});
    console.log('Captured',filename,stat.size+' bytes');
   }
  }
  render.qaErrors=pageErrors;
  const file=path.join(out,'source-manifest.json');
  fs.writeFileSync(file,JSON.stringify(render,null,2)+'\n');
  if(pageErrors.length)throw Error('Game page error(s): '+pageErrors.join('; ').slice(0,600));
  if(render.renderedImages.length!==9)throw Error('Expected 9 source images');
  console.log('Current game swordsman reference captured:',render.renderedImages.length,'angles, 3 states');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
