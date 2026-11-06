import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMBAT_OBJECT_SPECS} from '../src/combat-action-spec.js';

// The repository is a static browser site; Three.js is loaded through an
// import map, so this smoke test must not require npm dependencies in CI.
const source=readFileSync(new URL('../src/combat-creature-geometry.js',import.meta.url),'utf8');
for(const name of ['wolf','wyvern','dragon','elder_dragon','dragon_lord','forest_archer','seraph_guardian','horse']){
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
    if(!['trap','dynamite','c4'].includes(type)) assert.ok(vertices(detailed)>10000,type+' の詳細形状が十分細かい');
    for(const geometry of Object.values(detailed)){
      const count=geometry.getAttribute('position').count;
      assert.equal(geometry.getAttribute('normal').count,count);
      assert.equal(geometry.getAttribute('color').count,count);
      assert.equal(geometry.getAttribute('uv').count,count);
      const v=geometry.getAttribute('position');
      for(let i=0;i<count;i++) assert.ok(Number.isFinite(v.getX(i)+v.getY(i)+v.getZ(i)),type+' に不正な頂点がない');
    }
    if(['wyvern','dragon','elder_dragon','dragon_lord','seraph_guardian'].includes(type))
      assert.ok(detailed.wingL&&detailed.wingR,type+' の左右翼');
    if(type==='wyvern')assert.ok(!detailed.legFrontL&&!detailed.legFrontR,'飛竜は翼が前肢');
    if(['wolf','dragon','elder_dragon','horse'].includes(type))
      assert.ok(detailed.legFrontL&&detailed.legBackR,type+' は四脚');
    if(type==='forest_archer'||type==='seraph_guardian')
      assert.ok(detailed.armL&&detailed.armR&&detailed.legBackL&&detailed.legBackR,type+' は人型の可動四肢を持つ');
    if(type==='dragon_lord')
      assert.ok(detailed.legBackL&&detailed.legBackR&&detailed.armL&&detailed.armR&&!detailed.legFrontL,
        '竜王は独立した腕2本と後肢2本を持つ二足竜');
    if(['wolf','wyvern','dragon','elder_dragon','dragon_lord','horse'].includes(type))
      assert.ok(detailed.jaw&&distant.jaw,type+' は顎が独立して動く');
    for(const g of [...Object.values(detailed),...Object.values(distant)])g.dispose();
  }
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera();
  camera.position.set(1,2,9);
  const renderer=createCombatWorldObjectRenderer(scene,{camera});
  const entries=['wolf','wyvern','dragon','elder_dragon','dragon_lord','horse'].map((type,i)=>({
    id:'creature-'+i,type,alive:true,team:0,x:i,z:0,flying:!!COMBAT_OBJECT_SPECS[type].flying,
  }));
  renderer.sync(entries,1);
  assert.equal(renderer.stats().dragon,1,'古竜は独立オブジェクトのまま');
  const wing=scene.getObjectByName('CombatWorldObject_dragon_high_wingL');
  const lordWing=scene.getObjectByName('CombatWorldObject_dragon_lord_high_wingL');
  const lordArm=scene.getObjectByName('CombatWorldObject_dragon_lord_high_armR');
  assert.ok(lordWing&&lordArm,'竜王の翼と腕は独立したGPU描画メッシュ');
  const lordWingBefore=new THREE.Matrix4(),lordArmBefore=new THREE.Matrix4();
  lordWing.getMatrixAt(0,lordWingBefore);lordArm.getMatrixAt(0,lordArmBefore);
  const before=new THREE.Matrix4();
  wing.getMatrixAt(0,before);
  renderer.sync(entries,2);
  const lordWingAfter=new THREE.Matrix4(),lordArmAfter=new THREE.Matrix4();
  lordWing.getMatrixAt(0,lordWingAfter);lordArm.getMatrixAt(0,lordArmAfter);
  assert.notDeepEqual(lordWingBefore.elements,lordWingAfter.elements,'竜王の大翼は羽ばたく');
  assert.notDeepEqual(lordArmBefore.elements,lordArmAfter.elements,'竜王の腕は翼と独立して動く');
  const after=new THREE.Matrix4();
  wing.getMatrixAt(0,after);
  assert.notDeepEqual(before.elements,after.elements,'翼ばたきの姿勢が時間とともに変化');
  entries[0].x=1;
  renderer.sync(entries,2.03);
  const torso=scene.getObjectByName('CombatWorldObject_wolf_high_core');
  const movingTorso=new THREE.Matrix4();torso.getMatrixAt(0,movingTorso);
  const smoothX=movingTorso.elements[12];
  assert.ok(smoothX>-6*1.12&&smoothX<-5*1.12,'灰狼の1マス移動を瞬間移動せず補間する');
  renderer.sync(entries,2.24);
  const advancedTorso=new THREE.Matrix4();torso.getMatrixAt(0,advancedTorso);
  assert.ok(advancedTorso.elements[12]>smoothX,'時間経過で歩行位置が進む');
  // When a new cell arrives on the exact frame boundary, its visual transform
  // and paws must continue from the old trajectory rather than teleporting.
  const frontPaw=scene.getObjectByName('CombatWorldObject_wolf_high_legFrontL');
  const pawBefore=new THREE.Matrix4(),pawAfter=new THREE.Matrix4();
  renderer.sync(entries,2.32);
  const beforeNextTile=new THREE.Matrix4();torso.getMatrixAt(0,beforeNextTile);
  frontPaw.getMatrixAt(0,pawBefore);
  entries[0].x=2;
  renderer.sync(entries,2.32);
  const atTileChange=new THREE.Matrix4();torso.getMatrixAt(0,atTileChange);
  assert.ok(Math.abs(atTileChange.elements[12]-beforeNextTile.elements[12])<.00001,
    '新しいマスを受け取った瞬間も胴体をテレポートさせない');
  renderer.sync(entries,2.36);
  const nextTilePosition=new THREE.Matrix4();torso.getMatrixAt(0,nextTilePosition);
  frontPaw.getMatrixAt(0,pawAfter);
  assert.ok(nextTilePosition.elements[12]>atTileChange.elements[12],
    '2マス目の直後も一定方向に歩き続ける');
  assert.notDeepEqual(pawBefore.elements,pawAfter.elements,'実際の移動距離に合わせて前足が動く');
  const jaw=scene.getObjectByName('CombatWorldObject_wolf_high_jaw');
  const stillJaw=new THREE.Matrix4(),attackingJaw=new THREE.Matrix4();
  renderer.sync(entries,4);
  jaw.getMatrixAt(0,stillJaw);
  entries[0].attackStartedAt=4;
  renderer.sync(entries,4.29);
  jaw.getMatrixAt(0,attackingJaw);
  assert.notDeepEqual(stillJaw.elements,attackingJaw.elements,'噛みつき動作で下顎の姿勢が変化する');
  const airborneLeg=scene.getObjectByName('CombatWorldObject_dragon_high_legFrontL');
  const airborneBefore=new THREE.Matrix4(),airborneAfter=new THREE.Matrix4();
  renderer.sync(entries,4.91);
  airborneLeg.getMatrixAt(0,airborneBefore);
  renderer.sync(entries,5.18);
  airborneLeg.getMatrixAt(0,airborneAfter);
  assert.notDeepEqual(airborneBefore.elements,airborneAfter.elements,
    '地上の脚運びを変更しても飛行中の古竜の脚は動き続ける');
  camera.position.set(0,10,120);
  renderer.sync(entries,3);
  assert.equal(renderer.detailStats().dragon.low,1,'遠方では軽量LOD');
  renderer.dispose();
  assert.equal(scene.children.length,0,'描画リソースを破棄できる');
  console.log('召喚獣・軍馬 全6種＋爆発物 / 立体骨格 / 2段階LOD / アニメーション / GPU描画 OK');
}else{
  console.log('召喚獣データ契約 OK（3D形状テストは Three.js のローカル導入時に実行）');
}
