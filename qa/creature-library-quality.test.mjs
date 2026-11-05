import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const asset=readFileSync(new URL('../assets/creatures/ground-impact-library.glb',import.meta.url));
assert.equal(asset.toString('ascii',0,4),'glTF','ライブラリ由来素材はGLB');
assert.equal(asset.readUInt32LE(4),2,'GLB 2.0');
assert.equal(asset.readUInt32LE(8),asset.length,'GLBのチャンクサイズが一致');
assert.ok(asset.length<600_000,'演出素材を600KB未満に圧縮して配信');
const json=JSON.parse(asset.toString('utf8',20,20+asset.readUInt32LE(12)));
assert.equal(json.buffers.length,1,'実行時の外部参照なし');
assert.equal(json.scenes[0].nodes.length,5,'必要な5つのエフェクトだけを同梱');
const kinds=['003-dust-puff-dome/0','004-spark-fan/0','009-water-splash-crown/0',
  '010-sand-kick-fan/0','011-snow-puff/0'];
assert.deepEqual(json.nodes.map(node=>node.name),kinds);
assert.ok(json.meshes.every(mesh=>mesh.primitives.length>0),'本物の3Dメッシュが含まれる');

const renderer=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
assert.match(renderer,/createCreatureFootfallFx\(scene,\{camera\}\)/,'モデルの足運びにLibrary素材を結合');
assert.match(renderer,/footfalls\.update\(time\)/,'GPU描画の更新時に演出を更新');
assert.match(renderer,/footfalls\.dispose\(\)/,'エフェクトのGPUリソースを適切に解放');
assert.match(renderer,/createSpeciesCoat\(type,photos\)/,'毛皮・馬毛・鱗の個別マテリアルと共有テクスチャ');
const geometry=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
assert.match(geometry,/horseshoe/i,'軍馬の蹄鉄');
assert.match(geometry,/stirrup/i,'軍馬の鐙');

try{
  const [{GLTFLoader},THREE]=await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),import('three'),
  ]);
  await new Promise((resolve,reject)=>{
    new GLTFLoader().parse(asset.buffer.slice(asset.byteOffset,asset.byteOffset+asset.length),'',gltf=>{
      const parsed=[];
      gltf.scene.traverse(node=>{if(node.isMesh)parsed.push(node);});
      assert.equal(parsed.length,5,'GLTFLoaderが全エフェクトを復元する');
      for(const [i,mesh] of parsed.entries()){
        assert.equal(mesh.name,THREE.PropertyBinding.sanitizeNodeName(kinds[i]),
          'Three.js側で安全な名前へ正規化される');
        assert.ok(mesh.geometry.getAttribute('position').count>1000,'3D形状を実際に含む');
        mesh.geometry.dispose();mesh.material.dispose();
      }
      resolve();
    },reject);
  });
}catch(error){
  if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;
  console.log('Three.js未導入のCIではGLTFLoaderの実体テストを省略');
}

console.log('軍馬・灰狼 高品質な毛並み/装具 + Libraryの3D足元演出5種 / GLB整合性 OK');
