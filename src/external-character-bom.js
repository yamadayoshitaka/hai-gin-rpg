/** Optional external GLB asset BOM. Paths refer to repo-hosted, license-cleared assets.
 * No external assets are assumed to exist. Actor falls back to procedural mesh.
 */
export const EXTERNAL_CHARACTER_PARTS=Object.freeze({
 // Example: 'hair_long_01':{src:'assets/characters/hair_long_01.glb',slot:'head',scale:1,license:'CC0',source:'...'}
});
export function validateExternalPart(part){
 if(!part||typeof part.src!=='string'||!/^assets\/characters\/[\w./-]+\.glb$/i.test(part.src)||part.src.includes('..'))throw Error('Invalid local character asset path');
 if(!['head','body','back','leftHand','rightHand'].includes(part.slot))throw Error('Invalid character mount slot');
 if(!part.license||!part.source)throw Error('Asset attribution missing');
 return true;
}
export async function attachExternalCharacterParts({THREE,GLTFLoader,host,joints,parts,rootUrl='./'}){
 const report={loaded:[],failed:[]},loader=new GLTFLoader();
 const mounts={head:joints.head,body:joints.spine,back:joints.spine,leftHand:joints.wrists[0],rightHand:joints.wrists[1]};
 for(const [id,part] of Object.entries(parts||{})){
  try{
   validateExternalPart(part);
   const model=(await loader.loadAsync(new URL(part.src,new URL(rootUrl,location.href)).href)).scene;
   const clone=model.clone(true),mount=mounts[part.slot];
   if(!mount)throw Error('No attachment joint');
   const scale=Number.isFinite(part.scale)?part.scale:1;
   clone.scale.setScalar(scale);
   if(Array.isArray(part.position))clone.position.set(...part.position);
   if(Array.isArray(part.rotation))clone.rotation.set(...part.rotation);
   mount.add(clone);clone.userData.assetBomId=id;
   report.loaded.push(id);
  }catch(err){report.failed.push({id,reason:String(err.message||err)});}
 }
 host.userData.externalAssetBom=report;
 return report;
}
