/**
 * Chrome DevTools browser QA: wait for real WebGL/GLTF rendering, not merely
 * a screenshot large enough to contain the word FAILED. Node 22 built-ins.
 * Usage: node qa/capture-monster-body-cdp.mjs m038 idle out.png
 */
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,existsSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const [id,pose,outPath]=process.argv.slice(2);
if(!['m036','m037','m038','m039','m040','m042','m045'].includes(id)||
 !['idle','walk','attack','special','guard'].includes(pose)||!outPath)
 throw Error('Usage: node capture-monster-body-cdp.mjs ID pose out.png');
const sleep=t=>new Promise(resolve=>setTimeout(resolve,t));
const tmp=mkdtempSync(path.join(tmpdir(),'golem-cdp-'));
const target='http://127.0.0.1:8765/qa/monster-golem-full-shell-visual.html?id='+id+'&pose='+pose;
const chrome=spawn('google-chrome',[
 '--headless','--no-sandbox','--disable-dev-shm-usage',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 '--remote-debugging-port=0','--user-data-dir='+tmp,
 '--window-size=900,1000','--hide-scrollbars',target
],{stdio:['ignore','ignore','pipe']});
let errors='',closed=false;
chrome.stderr.on('data',c=>{errors+=String(c).slice(-3000);if(errors.length>5000)errors=errors.slice(-5000);});
chrome.on('exit',()=>{closed=true;});
let socket=null;
try{
 let port=null,tab=null;
 for(let retry=0;retry<100;retry++){
  if(closed)throw Error('Chrome exited early: '+errors.slice(-2000));
  const file=path.join(tmp,'DevToolsActivePort');
  if(existsSync(file)){port=Number(readFileSync(file,'utf8').split('\n')[0]);break;}
  await sleep(150);
 }
 if(!Number.isInteger(port))throw Error('Chromium CDP port did not open: '+errors.slice(-2000));
 for(let retry=0;retry<100;retry++){
  try{
   const response=await fetch('http://127.0.0.1:'+port+'/json/list');
   const pages=await response.json();
   tab=pages.find(p=>p.type==='page'&&p.url.includes('monster-golem-full-shell-visual'))||
    pages.find(p=>p.type==='page');
   if(tab?.webSocketDebuggerUrl)break;
  }catch{}
  await sleep(150);
 }
 if(!tab?.webSocketDebuggerUrl)throw Error('Cannot locate Chrome debugging page');
 socket=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  const tm=setTimeout(()=>reject(Error('CDP WebSocket connection timed out')),6000);
  socket.onopen=()=>{clearTimeout(tm);resolve();};
  socket.onerror=()=>{clearTimeout(tm);reject(Error('CDP WebSocket error'));};
 });
 let next=0;const outstanding=new Map();
 socket.onmessage=({data})=>{
  const m=JSON.parse(String(data));
  if(m.id){
   const entry=outstanding.get(m.id);if(!entry)return;
   outstanding.delete(m.id);
   if(m.error)entry.reject(Error(JSON.stringify(m.error)));
   else entry.resolve(m.result);
  }
 };
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++next;
  outstanding.set(id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params}));
 });
 await send('Page.enable');
 await send('Runtime.enable');
 let state=null;
 for(let retry=0;retry<150;retry++){
  const r=await send('Runtime.evaluate',{
   expression:"({ready:document.body?.dataset?.ready||'',error:document.body?.dataset?.error||'',originalVisible:document.body?.dataset?.originalVisible||'',mineralParts:document.body?.dataset?.mineralParts||'',snapshot:!!document.getElementById('actual-golem-render-snapshot'),status:document.getElementById('status')?.textContent?.slice(0,320)||''})",
   returnByValue:true
  });
  state=r.result?.value??null;
  if(state?.error)throw Error('GLTF/WebGL render failed: '+state.error);
  if(state?.ready==='true')break;
  await sleep(200);
 }
 if(state?.ready!=='true'||state.originalVisible!=='0'||
  !state.snapshot||Number(state.mineralParts)<45)
  throw Error('Incomplete real 3D render for '+id+'/'+pose+': '+JSON.stringify(state));
 const png=await send('Page.captureScreenshot',{format:'png',fromSurface:true});
 const pixels=Buffer.from(png.data,'base64');
 if(pixels.length<44000||pixels[0]!==137||pixels[1]!==80)
  throw Error('Chrome returned invalid or blank PNG: '+pixels.length);
 mkdirSync(path.dirname(outPath),{recursive:true});
 writeFileSync(outPath,pixels);
 console.log('PASS-SKINNED-RENDER '+id+'/'+pose+' '+pixels.length+
  ' bytes | '+state.mineralParts+' body meshes | '+state.originalVisible+
  ' visible donor meshes | '+state.status);
}finally{
 try{socket?.close()}catch{}
 try{chrome.kill('SIGTERM')}catch{}
 rmSync(tmp,{recursive:true,force:true});
}
