const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
let page;
try {
 page=await browser.newPage({viewport:{width:412,height:850},isMobile:true,hasTouch:true});
 page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('BROWSER',m.type(),m.text())});
 page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()));
 await page.goto('http://127.0.0.1:8768/preview/r53-hero/');
 await page.waitForFunction(()=>window.r53ImagesReady);
 for(const id of ['commander-male','commander-female']){
  await page.selectOption('#person',id);
  for(const v of ['front','left','right','rear','crown']){
   await page.selectOption('#view',v);
   await page.waitForFunction(()=>['oldImg','newImg'].every(id=>{const x=document.getElementById(id);return x.complete&&x.naturalWidth>0}),null,{polling:100});
  }
 }
 console.log('PASS actual image comparisons');
 await page.click('#start3d');
 const ready=async(id,v)=>{
  await page.waitForFunction(({id,v})=>window.r53ReviewError||(window.r53ReviewLoaded?.id===id&&window.r53ReviewLoaded?.version===v),{id,v},{timeout:90000,polling:200});
  const error=await page.evaluate(()=>window.r53ReviewError);
  if(error)throw Error('3D startup/load: '+error);
  console.log('PASS 3D loaded',id,v);
 };
 await ready('commander-female','new');
 for(const id of ['commander-male','commander-female'])for(const v of ['new','old']){
  await page.evaluate(({id,v})=>{document.getElementById('person').value=id;document.getElementById('version').value=v},{id,v});
  await page.evaluate(()=>window.r53Review.load());
  await ready(id,v);
  await page.selectOption('#morph','smile');
  const snap=await page.evaluate(()=>window.r53Review.capture());
  if(!snap.startsWith('data:image/png;base64,')||snap.length<1000)throw Error('canvas capture');
 }
 console.log('PASS R53 mobile image comparison and four GLB previews');
} catch(e){if(page)console.error('VISIBLE STATUS',await page.locator('#status').textContent().catch(()=>''));throw e}
finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
