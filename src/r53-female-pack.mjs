// R53-R5: exact, locally stored, unapproved female models. No network upload.
const hashes = [
'd64570bb74ef72d14a07df87254ea8236f5a01a005f7788cffa0765607f9eea6',
'cf6ea081a003b9721e3368316221bb2e2a9dea4445203f60531c962b04e51294',
'3eb852f0b55002e072e11d9b971c87a8f0ee1476d0a76540e6d62a49834a4149',
'f92a23794ca89ab8729fc1fcac2c265c856c2ff06647e18bb77aa4f580b38e8a',
'a15dd76db84978ec75b00097bc769c0c68da7d99f9ae336c93818312fce5edb9',
'957b51275bb631009f1c6583a452e5f4342a0500ecb2fed6a58d8b263295c5fc',
'58f31958f6cd0d2614c59e16d2d0acf12bf7cdf6ee630f37f172079c4abe86af',
'eaf645b60ea5730c3566da13f92c5c8d31bcf71f3131610977ff3f316d1f60b2',
'f1f8cd4504272ddae65914260e634865f96e98ce51968150dce69ec57849687f',
'2f11c9b8b5a8882a1e10ad7b05310072c7f81c1f3e03c3ed98aff31103188646'];
const ids=hashes.map((_,i)=>'female_face_'+String(i+1).padStart(2,'0'));
const expected=new Map(ids.map((id,i)=>[id,hashes[i]]));
const DB='hai-gin-r53-female-preview',KEY='R53-R5-complete',STORE='packs';
const view=async(blob,start,end)=>new DataView(await blob.slice(start,end).arrayBuffer());
const require=(ok,message)=>{if(!ok)throw Error(message)};
export async function openFemalePack(blob){
 require(blob instanceof Blob&&blob.size>=22&&blob.size<=200_000_000,'R5 ZIPのサイズが不正です');
 const start=Math.max(0,blob.size-65557),tail=await view(blob,start,blob.size);
 let end=-1;for(let i=tail.byteLength-22;i>=0;i--){if(tail.getUint32(i,true)===0x06054b50&&i+22+tail.getUint16(i+20,true)===tail.byteLength){end=i;break}}
 require(end>=0,'ZIPの終端がありません');
 const count=tail.getUint16(end+10,true),size=tail.getUint32(end+12,true),offset=tail.getUint32(end+16,true);
 require(tail.getUint16(end+4,true)===0&&tail.getUint16(end+6,true)===0&&tail.getUint16(end+8,true)===count&&count<=32&&size<=1_000_000&&offset+size<=start+end,'対応していないZIP形式です');
 const central=await view(blob,offset,offset+size),decoder=new TextDecoder(),entries=new Map();let at=0;
 for(let i=0;i<count;i++){
  require(at+46<=size&&central.getUint32(at,true)===0x02014b50,'ZIP索引不正');
  const flags=central.getUint16(at+8,true),method=central.getUint16(at+10,true),compressed=central.getUint32(at+20,true),length=central.getUint32(at+24,true),nl=central.getUint16(at+28,true),xl=central.getUint16(at+30,true),cl=central.getUint16(at+32,true),local=central.getUint32(at+42,true);
  require(at+46+nl+xl+cl<=size,'ZIP索引が途中で終了しています');
  const name=decoder.decode(new Uint8Array(central.buffer,at+46,nl));at+=46+nl+xl+cl;
  const id=name.replace(/\.glb$/,'');if(!expected.has(id)||name!==id+'.glb')continue;
  require(!entries.has(id)&&!(flags&1)&&(method===0||method===8)&&length>=20&&length<=50_000_000&&compressed>0&&local+30<offset,'不正または重複した女性GLB '+id);
  const h=await view(blob,local,local+30);require(h.getUint32(0,true)===0x04034b50&&h.getUint16(8,true)===method,'ZIPファイルヘッダー不正');
  const localNameLength=h.getUint16(26,true),dataStart=local+30+localNameLength+h.getUint16(28,true);
  require(dataStart+compressed<=offset,'ZIP圧縮データの範囲が不正です');
  const localName=decoder.decode(await blob.slice(local+30,local+30+localNameLength).arrayBuffer());require(localName===name,'ZIPファイル名不一致');
  entries.set(id,{name,async arrayBuffer(){
   const part=blob.slice(dataStart,dataStart+compressed);let b;
   if(method===0)b=await part.arrayBuffer();else{
    require(typeof DecompressionStream==='function','このブラウザはZIP展開に未対応です');
    const reader=part.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),output=new Uint8Array(length);let pos=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;require(pos+value.length<=length,'ZIP展開サイズ超過');output.set(value,pos);pos+=value.length}}catch(e){await reader.cancel().catch(()=>{});throw e}finally{reader.releaseLock()}
    require(pos===length,'ZIP展開サイズ不一致');b=output.buffer;
   }
   const g=new DataView(b);require(b.byteLength===length&&g.getUint32(0,true)===0x46546c67&&g.getUint32(4,true)===2&&g.getUint32(8,true)===length,'GLBデータ不正');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');require(digest===expected.get(id),'R5のGLBと一致しません：'+id);return b;
  }});
 }
 require(entries.size===10,'R5女性10体入りの完全版ZIPを選択してください（'+entries.size+'/10体）');return entries;
}
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('保存領域が使用中です'))})}
async function cache(mode,op){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),r=op(tx.objectStore(STORE));tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error||r.error);tx.onabort=()=>reject(tx.error||Error('保存が中断されました'))})}finally{db.close()}}
export function bindFemalePack(container,models,onChange){
 const box=document.createElement('div'),label=document.createElement('label'),input=document.createElement('input'),message=document.createElement('p'),remove=document.createElement('button');
 label.textContent='女性R5完全版ZIP（初回のみ選択） ';input.type='file';input.accept='.zip,application/zip';input.id='r53FemaleZip';label.append(input);message.setAttribute('role','status');message.id='r53FemalePackStatus';message.textContent='女性GLBは端末に保存する方式です。ZIPは展開不要。';remove.type='button';remove.textContent='女性ZIPの端末登録を解除';remove.disabled=true;box.append(label,message,remove);container.prepend(box);
 let epoch=0;function install(entries){for(const [id,f]of entries)models.set(id,f);remove.disabled=false;onChange()}
 input.onchange=async()=>{const file=input.files[0];if(!file)return;const n=++epoch;input.disabled=true;remove.disabled=true;message.textContent='ZIPの10体を確認中…';try{const entries=await openFemalePack(file);if(n!==epoch)return;install(entries);message.textContent='女性10体を選択できます。端末へ保存中…';try{await cache('readwrite',s=>s.put(file,KEY));if(n===epoch)message.textContent='女性10体登録済み。次回も自動で読み込みます。'}catch(e){if(n===epoch)message.textContent='女性10体は今回選択できます。端末保存不可：'+e.message}}catch(e){if(n===epoch)message.textContent='ZIP読込失敗：'+e.message}finally{if(n===epoch){input.disabled=false;remove.disabled=!models.size;input.value=''}}};
 remove.onclick=async()=>{const n=++epoch;input.disabled=true;remove.disabled=true;try{await cache('readwrite',s=>s.delete(KEY));if(n!==epoch)return;for(const id of ids)models.delete(id);onChange();message.textContent='女性ZIPの登録を解除しました。'}catch(e){if(n===epoch)message.textContent='解除失敗：'+e.message}finally{if(n===epoch){input.disabled=false;remove.disabled=!models.size}}};
 (async()=>{const n=epoch;try{const blob=await cache('readonly',s=>s.get(KEY));if(!blob||n!==epoch)return;const entries=await openFemalePack(blob);if(n!==epoch)return;install(entries);message.textContent='保存済みの女性R5 10体を読み込みました。'}catch(e){if(n===epoch)message.textContent='女性ZIPを初回選択してください。保存済みデータを読めません：'+e.message}})();
}
