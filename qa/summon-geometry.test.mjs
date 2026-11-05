import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMBAT_OBJECT_SPECS} from '../src/combat-action-spec.js';

// The repository is a static browser site; Three.js is loaded through an
// import map, so this smoke test must not require npm dependencies in CI.
const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
for(const name of ['wolf','wyvern','dragon','elder_dragon','horse']){
  assert.ok(source.includes(name+': Object.freeze('),name+' の外観定義');
  assert.ok(COMBAT_OBJECT_SPECS[name],name+' の戦闘オブジェクト定義');
}
assert.match(source,/scalloped membrane/,'翼膜の立体構成');
assert.match(source,/Discrete layered scales/,'立体鱗');

const threeAvailable=await import('three').then(()=>true).catch(()=>false);
if(threeAvailable){
  const THREE=await import('three');
  const {buildCombatObjectGeometry}=await import('../src/combat-creature-geometry.js');
  const {createCombatWorldObjectRenderer}=await import('../src/combat-world-object-renderer.js');
  for(const type of Object.keys(COMBAT_OBJECT_SPECS)){
    const detailed=buildCombatObjectGeometry(type,{detail:'high'});
    const distant=buildCombatObjectGeometry(type,{detail:'low'});
    const vertices=parts=>Object.values(parts).reduce((sum,g)=>sum+g.getAttribute('position').count,0);
    assert.ok(vertices(detailed)>vertices(distant),type+' のLODが精細/軽量に分かれている');
    if(!['trap','dynamite'].includes(type)) assert.ok(vertices(detailed)>10000,type+' の詳細形状が十分細かい');
    for(const geometry of Object.values(detailed)){
      const count=geometry.getAttribute('position').count;
      assert.equal(geometry.getAttribute('normal').count,count);
      assert.equal(geometry.getAttribute('color').count,count);
      assert.equal(geometry.getAttribute('uv').count,count);
      const v=geometry.getAttribute('position');
      for(let i=0;i<count;i++) assert.ok(Number.isFinite(v.getX(i)+v.getY(i)+v.getZ(i)),type+' に不正な頂点がない');
    }
    if(['wyvern','dragon','elder_dragon'].includes(type))
      assert.ok(detailed.wingL&&detailed.wingR,type+' の左右翼');
    if(type==='wyvern')assert.ok(!detailed.legFrontL&&!detailed.legFrontR,'飛竜は翼が前肢');
    if(['wolf','dragon','elder_dragon','horse'].includes(type))
      assert.ok(detailed.legFrontL&&detailed.legBackR,type+' は四脚');
    for(const g of [...Object.values(detailed),...Object.values(distant)])g.dispose();
  }
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera();
  camera.position.set(1,2,9);
  const renderer=createCombatWorldObjectRenderer(scene,{camera});
  const entries=['wolf','wyvern','dragon','elder_dragon','horse'].map((type,i)=>({
    id:'creature-'+i,type,alive:true,team:0,x:i,z:0,flying:!!COMBAT_OBJECT_SPECS[type].flying,
  }));
  renderer.sync(entries,1);
  assert.equal(renderer.stats().dragon,1,'古竜は独立オブジェクトのまま');
  const wing=scene.getObjectByName('CombatWorldObject_dragon_high_wingL');
  const before=new THREE.Matrix4();
  wing.getMatrixAt(0,before);
  renderer.sync(entries,2);
  const after=new THREE.Matrix4();
  wing.getMatrixAt(0,after);
  assert.notDeepEqual(before.elements,after.elements,'翼ばたきの姿勢が時間とともに変化');
  camera.position.set(0,10,120);
  renderer.sync(entries,3);
  assert.equal(renderer.detailStats().dragon.low,1,'遠方では軽量LOD');
  renderer.dispose();
  assert.equal(scene.children.length,0,'描画リソースを破棄できる');
  console.log('召喚獣・軍馬 全7種 / 立体骨格 / 2段階LOD / アニメーション / GPU描画 OK');
}else{
  console.log('召喚獣データ契約 OK（3D形状テストは Three.js のローカル導入時に実行）');
}
