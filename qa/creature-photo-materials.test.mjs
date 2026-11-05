import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const source=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
assert.match(source,/new THREE\.TextureLoader\(\)/,'写実的なPBR画像をブラウザで読み込む');
assert.match(source,/material\.map=loaded/,'色画像がモデルの表面に貼られる');
assert.match(source,/material\.normalMap=loaded/,'凹凸画像がモデルの表面に貼られる');
assert.match(source,/typeof document==='undefined'/,'Node環境は画像読込をスキップする');
assert.match(source,/photos\.dispose\(\)/,'共有写真テクスチャを破棄できる');
assert.match(source,/roughness:isFur/,'毛・皮・鱗の光沢を区別する');
assert.match(source,/part==='eyes'\?eyeMaterial/,'眼球には毛皮・鱗の模様を貼らない');
assert.match(source,/clearcoatRoughness:\.18/,'瞳に控えめな濡れた角膜光沢を付ける');

for(const material of ['horse-coat','wolf-fur','dragon-scales']){
  for(const channel of ['albedo','normal']){
    const path=new URL(`../assets/creatures/${material}-${channel}-v1.webp`,import.meta.url);
    const bytes=readFileSync(path);
    assert.equal(bytes.toString('ascii',0,4),'RIFF',`${material} ${channel}: RIFF`);
    assert.equal(bytes.toString('ascii',8,12),'WEBP',`${material} ${channel}: WebP`);
    assert.ok(bytes.length>10000,`${material} ${channel}: 写実的な表面ディテール`);
    assert.ok(statSync(path).size<250000,`${material} ${channel}: モバイル向けの軽量な画像`);
  }
}
const threeAvailable=await import('three').then(()=>true).catch(()=>false);
if(threeAvailable){
  const THREE=await import('three');
  const {createCombatWorldObjectRenderer}=await import('../src/combat-world-object-renderer.js');
  const scene=new THREE.Scene();
  const renderer=createCombatWorldObjectRenderer(scene);
  for(const type of ['horse','wolf','wyvern','dragon','elder_dragon']){
    const mesh=scene.getObjectByName(`CombatWorldObject_${type}_high_core`);
    assert.ok(mesh?.isInstancedMesh,`${type}: GPUインスタンスを維持する`);
    assert.ok(mesh.material.map&&mesh.material.normalMap,`${type}: 読込中もテクスチャがある`);
    assert.equal(mesh.material.metalness,0,`${type}: 生物の皮膚を金属として光らせない`);
    const eyes=scene.getObjectByName(`CombatWorldObject_${type}_high_eyes`);
    assert.ok(eyes?.isInstancedMesh,`${type}: 眼裂もGPUインスタンスで表示する`);
    assert.ok(!eyes.material.map&&eyes.material.roughness<.4,
      `${type}: 眼裂に毛皮を描かず角膜の質感を保持する`);
  }
  renderer.dispose();
  // Simulate a browser's asynchronous image loader. Verify the photo maps
  // actually replace their procedural fallbacks on every GPU instance.
  const originalLoad=THREE.TextureLoader.prototype.load;
  const originalDocument=globalThis.document;
  const pending=[];
  try{
    globalThis.document={};
    THREE.TextureLoader.prototype.load=function(url,onLoad){
      const texture=new THREE.Texture();
      pending.push({url,texture,onLoad});
      return texture;
    };
    const browserScene=new THREE.Scene();
    const browserRenderer=createCombatWorldObjectRenderer(browserScene);
    assert.equal(pending.length,6,'馬・狼・3種共通の竜の色と凹凸を合計6枚だけ読み込む');
    for(const {texture,onLoad} of pending)onLoad(texture);
    for(const type of ['horse','wolf','dragon']){
      const mesh=browserScene.getObjectByName(`CombatWorldObject_${type}_high_core`);
      assert.ok(pending.some(({texture})=>mesh.material.map===texture),`${type}: 写実的な色画像に差し替える`);
      assert.ok(pending.some(({texture})=>mesh.material.normalMap===texture),`${type}: 写実的な凹凸画像に差し替える`);
    }
    assert.ok(pending.every(({texture})=>texture.wrapS===THREE.RepeatWrapping),'全画像のUVを繰り返し可能にする');
    browserRenderer.dispose();
  }finally{
    THREE.TextureLoader.prototype.load=originalLoad;
    if(originalDocument===undefined)delete globalThis.document;
    else globalThis.document=originalDocument;
  }
}
console.log('軍馬・灰狼・3種の竜 写実的PBRテクスチャ / 軽量化 / GPUインスタンス OK');
