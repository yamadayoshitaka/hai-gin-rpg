const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 let page;
 try{
  page=await browser.newPage({viewport:{width:412,height:850},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
  await page.goto('http://127.0.0.1:8768/preview/r53-hero/');
  await page.waitForFunction(()=>window.r53ImagesReady);
  const imageReady=()=>page.waitForFunction(()=>['oldImg','newImg'].every(id=>{const x=document.getElementById(id);return x.complete&&x.naturalWidth>0&&x.currentSrc===x.src}),null,{timeout:30000});
  for(const id of ['commander-male','commander-female']){
   await page.selectOption('#person',id);
   for(const mode of ['head','hair','studio','neck','full','expression']){
    await page.selectOption('#mode',mode);
    const vs=await page.locator('#view option').evaluateAll(a=>a.map(x=>x.value));
    if(mode==='expression'){await imageReady()}else for(const v of vs){await page.selectOption('#view',v);await imageReady()}
    if(mode==='expression')for(const e of ['jawOpen','smile','viseme_A','blink_L']){await page.selectOption('#expr',e);await imageReady()}
   }
   await page.selectOption('#mode','head');await page.selectOption('#baseline','original');await imageReady();
   await page.selectOption('#baseline','previous');await imageReady();
  }
  await page.click('#start3d');
  const ready=async(id,v)=>{
   await page.waitForFunction(({id,v})=>window.r53ReviewError||(window.r53ReviewLoaded?.id===id&&window.r53ReviewLoaded?.version===v),{id,v},{timeout:120000,polling:200});
   const e=await page.evaluate(()=>window.r53ReviewError);if(e)throw Error(e);
  };
  await ready('commander-female','new');
  for(const id of ['commander-male','commander-female'])for(const v of ['new','previous','hair','full','old']){
   await page.evaluate(({id,v})=>{document.getElementById('person').value=id;document.getElementById('version').value=v},{id,v});
   await page.evaluate(()=>window.r53Review.load());await ready(id,v);
   await page.selectOption('#morph','smile');
   const snap=await page.evaluate(()=>window.r53Review.capture());if(snap.length<1000)throw Error('capture');
   if(v==='full'){
    await page.selectOption('#mode','full');
    const n=await page.locator('#action option').count();if(n<2)throw Error('missing motion');
    await page.selectOption('#action','0');await page.selectOption('#action','');
    await page.selectOption('#mode','head');
   }
  }
  console.log('PASS latest paired image modes and ten GLB mobile previews');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
