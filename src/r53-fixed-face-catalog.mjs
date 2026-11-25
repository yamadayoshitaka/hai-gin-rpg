// R53 fixed face asset contract. No generated identity or fallback face.
export const R53_REVISION = 'R53';
export const R53_NAMES = Object.freeze(['female','male'].flatMap(sex =>
  Array.from({length:10},(_,i)=>sex+'_face_'+String(i+1).padStart(2,'0'))));
export function validateCatalog(catalog) {
  if (catalog?.revision!==R53_REVISION || !Array.isArray(catalog.faces) ||
      catalog.faces.length!==R53_NAMES.length) throw Error('R53: 20 independent faces required');
  const seen=new Set(), hashes=new Set();
  for (const face of catalog.faces) {
    const {id,sex,glb,thumbnail,sha256,sourceSex}=face;
    if (!R53_NAMES.includes(id)||seen.has(id)||sex!==id.split('_')[0]||sourceSex!==sex)
      throw Error('R53: invalid or cross-sex identity '+id);
    if (glb!==id+'.glb'||thumbnail!==id+'.png'||!/^([a-f0-9]{64})$/.test(sha256)||hashes.has(sha256))
      throw Error('R53: missing or duplicate baked asset '+id);
    if (face.identityKey!=null||face.baseId!=null||face.settings!=null||face.derived===true)
      throw Error('R53: runtime identity preset forbidden '+id);
    seen.add(id);hashes.add(sha256);
  }
  return catalog.faces;
}
export async function loadFixedFace(face, baseURL, fetcher=fetch) {
  if (!R53_NAMES.includes(face.id)||face.glb!==face.id+'.glb') throw Error('R53: invalid identity');
  const response=await fetcher(new URL(face.glb,baseURL),{cache:'no-cache'});
  if (!response.ok) throw Error('R53: face unavailable '+face.id+' HTTP '+response.status);
  const buffer=await response.arrayBuffer(), v=new DataView(buffer);
  if(buffer.byteLength<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||
      v.getUint32(8,true)!==buffer.byteLength||v.getUint32(16,true)!==0x4e4f534a)
    throw Error('R53: invalid GLB '+face.id);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),
    x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==face.sha256) throw Error('R53: GLB hash mismatch '+face.id);
  return buffer;
}
// Build records only after all binaries have validated. Caller commits atomically to IndexedDB.
// The original storage key is reserved; never overwrite an unrelated custom record.
export function fixedRecord(face,buffer,previous) {
  const id='標準ベース '+(face.sex==='female'?'女性':'男性')+face.id.slice(-2);
  if(previous && (previous.id!==id ||
      !(previous.identityRevision===52 && String(previous.baseId||'').startsWith('__r45_base_')) &&
      previous.fixedFaceRevision!==R53_REVISION))
    throw Error('R53: preserve nonstandard existing record '+id);
  return {id,glb:new Blob([buffer],{type:'model/gltf-binary'}),fixedFaceId:face.id,
    fixedFaceRevision:R53_REVISION,identityKey:null,settings:{},
    profile:{...(previous?.profile||{}),sex:face.sex,age:'20'},
    hair:previous?.hair,savedAt:Date.now()};
}
