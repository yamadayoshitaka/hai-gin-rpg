/**
 * Inspect 3dai.dev UI safely. Does NOT click Generate or upload user data.
 * Generates evidence for grounding the automated workflow; no network API hacking.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const OUT='qa-screenshots/3dai-site-inspection';
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,acceptDownloads:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:920},acceptDownloads:true,locale:'en-US'});
  page.on('console',msg=>{if(msg.type()==='error')console.log('UI_CONSOLE_ERROR',msg.text().slice(0,300))});
  const response=await page.goto('https://3dai.dev/en',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForTimeout(6000);
  const state=await page.evaluate(()=>{
   const selected=el=>({
    tag:el.tagName,id:el.id,outerHTML:el.outerHTML.slice(0,1200),
    text:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,200),
    disabled:!!el.disabled,checked:!!el.checked
   });
   return {
    url:location.href,title:document.title,
    buttons:[...document.querySelectorAll('button,[role=button]')].slice(0,70).map(selected),
    inputs:[...document.querySelectorAll('input')].slice(0,50).map(selected),
    labels:[...document.querySelectorAll('label')].slice(0,50).map(selected),
    tabs:[...document.querySelectorAll('[role=tab]')].slice(0,30).map(selected),
    text:(document.body?.innerText||'').slice(0,12000),
    forms:[...document.forms].map(f=>f.outerHTML.slice(0,1500))
   };
  });
  state.http=response?.status();
  fs.writeFileSync(path.join(OUT,'inspect.json'),JSON.stringify(state,null,2));
  await page.screenshot({path:path.join(OUT,'site.png'),fullPage:true,timeout:90000});
  // Click only the UI's Multi-view tab, without uploading or requesting generation.
  const b=page.getByRole('button',{name:/Multi-view/i}).first();
  if(await b.count()){
   await b.click({timeout:10000});
   await page.waitForTimeout(1000);
   const multiview=await page.evaluate(()=>({
    text:(document.body?.innerText||'').slice(0,12000),
    inputs:[...document.querySelectorAll('input')].map(x=>x.outerHTML.slice(0,1200)),
    buttons:[...document.querySelectorAll('button')].map(x=>({label:x.textContent?.trim().slice(0,100),html:x.outerHTML.slice(0,750)}))
   }));
   fs.writeFileSync(path.join(OUT,'multiview.json'),JSON.stringify(multiview,null,2));
   await page.screenshot({path:path.join(OUT,'multiview.png'),fullPage:true});
  } else {
   console.log('Multi-view button not exposed under expected accessible name');
  }
  console.log('SITE_INSPECT',JSON.stringify({
    http:state.http,url:state.url,title:state.title,
    buttons:state.buttons.map(x=>({text:x.text,id:x.id,disabled:x.disabled})).slice(0,45),
    inputs:state.inputs.map(x=>({id:x.id,type:x.outerHTML.match(/type="[^"]*"/)?.[0],html:x.outerHTML.slice(0,180)})).slice(0,35),
    multiViewCapture:fs.existsSync(path.join(OUT,'multiview.json')),
    text:state.text.slice(0,4200)
  },null,2));
  if(state.http!==200)throw Error('Site unavailable HTTP '+state.http);
 }finally{await browser.close()}
})().catch(err=>{console.error('INSPECT_FAILED',err);process.exitCode=1});
