import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rpg-relay-'));
try{
 const build=spawnSync('python',['-c',`import importlib.util\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location('pages','scripts/prepare-pages-site.py')\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nout=Path(${JSON.stringify(dir)})\nfor i in range(5): (out/('page'+str(i)+'.html')).write_text('<html><head></head><body><script type="module">window.started=true;</script></body></html>')\nm.add_asset_relay(out,['assets/test.glb'],'revision123')`],{encoding:'utf8'});
 assert.equal(build.status,0,build.stderr);
 const html=fs.readFileSync(path.join(dir,'page0.html'),'utf8');
 assert.match(html,/await window\.__haiGinAssetRelayReady/);
 const boot=html.match(/<script id="pages-asset-relay-bootstrap">([\s\S]*?)<\/script>/)[1];
 const module=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 const parsed=spawnSync(process.execPath,['--check','--input-type=module'],{input:module,encoding:'utf8'});
 assert.equal(parsed.status,0,parsed.stderr);
 for(const mode of ['fresh','controlled','unsupported','failure']){
  let listener,registeredUrl,reloads=0;
  const worker={controller:mode==='controlled'?{}:null,
   addEventListener:(name,fn)=>{listener=fn;},removeEventListener:()=>{listener=null;},
   register:async url=>{registeredUrl=url;if(mode==='failure')throw Error('offline');return {installing:mode==='fresh'?{}:null};}};
  const context={window:{},navigator:mode==='unsupported'?{}:{serviceWorker:worker},
   location:{reload:()=>{reloads++;}},setTimeout:()=>1,clearTimeout:()=>{},console:{warn(){}}};
  vm.runInNewContext(boot,context);
  let ready=false;context.window.__haiGinAssetRelayReady.then(()=>{ready=true;});
  await new Promise(resolve=>setImmediate(resolve));
  if(mode==='fresh'){
   assert.equal(ready,false,'fresh install waits for the first controller');
   worker.controller={};listener();
  }
  await context.window.__haiGinAssetRelayReady;
  assert.equal(reloads,0,'worker changes never reload the running game');
  if(mode!=='unsupported')assert.match(registeredUrl,/rev=revision123/);
 }
 const battle=fs.readFileSync('tactics-wireframe.html','utf8');
 assert.ok(battle.indexOf('let focusedHumanUnitId=null')<battle.indexOf('else followSelectedCommander();'));
 assert.match(battle,/if\(battleLaunched\)return/,'rapid launch taps cannot create two animation loops');
 console.log('PASS: fresh/update/offline relay waits without reload; module gate, camera initialization and one-time launch');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
