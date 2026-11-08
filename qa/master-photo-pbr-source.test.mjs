import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BUNDLED_PHOTO_MATERIALS,FREE_PHOTO_PBR_REFERENCES,
 PHOTO_PBR_CHANNEL_POLICY,MASTER_PHOTO_TEXTURE_POLICY,USER_CAPTURE_METHOD}
 from '../src/master-photo-pbr-catalog.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('all local photo surface records point at actual unchanged images',()=>{
 assert.equal(BUNDLED_PHOTO_MATERIALS.length,10);
 const ids=new Set();
 for(const source of BUNDLED_PHOTO_MATERIALS){
  assert.ok(!ids.has(source.id),'duplicate material: '+source.id);ids.add(source.id);
  assert.equal(source.state,'existing-original');
  assert.notEqual(source.license,'CC0-1.0','unverified local photos cannot claim CC0');
  for(const [channel,path] of Object.entries(source.maps)){
   assert.ok(['albedo','normal','roughness'].includes(channel),source.id+' invalid map');
   assert.ok(path.startsWith('assets/')&&!path.includes('..'),source.id+' unsafe local path');
   assert.ok(existsSync(resolve(root,path)),source.id+' '+channel+' missing: '+path);
  }
 }
});
test('skin maps are real gender-specific donor UV atlas channels, not tiled fabrics',()=>{
 for(const sex of ['male','female']){
  const skin=BUNDLED_PHOTO_MATERIALS.find(m=>m.id==='skin-'+sex);
  assert.ok(skin.atlasUV);
  assert.equal(skin.role,'skin');
  assert.ok(skin.maps.normal&&skin.maps.roughness);
  const file=JSON.parse(read('assets/characters/quaternius-base/Superhero_'+
    (sex==='male'?'Male':'Female')+'_FullBody.gltf'));
  const material=file.materials.find(x=>new RegExp('MI_Superhero_'+sex,'i').test(x.name));
  assert.ok(material,'missing original character skin material '+sex);
  const pbr=material.pbrMetallicRoughness;
  const sourcePath=index=>('assets/characters/quaternius-base/'+file.images[file.textures[index].source].uri);
  assert.equal(skin.maps.albedo,sourcePath(pbr.baseColorTexture.index));
  assert.equal(skin.maps.normal,sourcePath(material.normalTexture.index));
  assert.equal(skin.maps.roughness,sourcePath(pbr.metallicRoughnessTexture.index));
 }
});
test('free externally referenced photo materials are separate from installed assets',()=>{
 assert.ok(FREE_PHOTO_PBR_REFERENCES.length>=4);
 for(const x of FREE_PHOTO_PBR_REFERENCES){
  assert.equal(x.state,'candidate-not-installed');
  assert.equal(x.license,'CC0-1.0');
  assert.ok(x.url.startsWith('https://polyhaven.com/a/'),x.id+' must link official creator');
  assert.equal(x.licenseUrl,'https://polyhaven.com/license');
  assert.equal(x.maps,null);
  assert.equal(x.noRemoteRuntimeLoad,true);
  assert.equal(x.paidAccessRequired,false);
  assert.equal(x.commercialUseAllowed,true);
 }
});
test('production-quality original photo capture requires proper material channels and attribution',()=>{
 assert.equal(MASTER_PHOTO_TEXTURE_POLICY.maxSourceBytes,null);
 assert.equal(MASTER_PHOTO_TEXTURE_POLICY.maxSourceTexturePixels,null);
 assert.equal(MASTER_PHOTO_TEXTURE_POLICY.enablePaidAPIs,false);
 assert.equal(MASTER_PHOTO_TEXTURE_POLICY.enableRemoteRuntimeFetch,false);
 assert.equal(MASTER_PHOTO_TEXTURE_POLICY.forbidGenericSkinReplacement,true);
 assert.equal(PHOTO_PBR_CHANNEL_POLICY.baseColor.colorSpace,'srgb');
 for(const channel of ['normal','roughness','metalness','ao','displacement'])
  assert.equal(PHOTO_PBR_CHANNEL_POLICY[channel].colorSpace,'linear',channel);
 assert.equal(USER_CAPTURE_METHOD.fileNeverUploaded,true);
 assert.equal(USER_CAPTURE_METHOD.privacy,'local-preview-only');
 assert.ok(USER_CAPTURE_METHOD.instructions.length>=6);
});
test('browser photo lab previews images only locally and discloses limits',()=>{
 const lab=read('photo-texture-lab.html');
 assert.ok(lab.includes('URL.createObjectURL(file)'));
 assert.ok(lab.includes('URL.revokeObjectURL(url)'));
 assert.ok(lab.includes('MeshPhysicalMaterial'));
 assert.ok(lab.includes('THREE.SRGBColorSpace'));
 assert.ok(lab.includes("id=\"albedo\""));
 assert.ok(lab.includes('capture=\"environment\"'));
 assert.ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon|form action=/.test(lab),
   'local photos must not be transmitted to a server');
 assert.ok(lab.includes('写真1枚だけでは'));
 const manager=read('master-model-manager.html');
 assert.ok(manager.includes('FREE_PHOTO_PBR_REFERENCES'));
 assert.ok(manager.includes('photo-texture-lab.html'));
});
