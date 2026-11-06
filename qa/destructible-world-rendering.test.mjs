import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeDestructibleWorld,STRUCTURE_DURABILITY,STRUCTURE_BURN_RATE} from '../src/destructible-world.js';
import {structureEffectLayout,StructureCollapseVfx} from '../src/structure-collapse-vfx.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const contract of ['describeDestructibleWorld(townInstances,bridges',
  'collapseRegisteredStructure(e.objectId)','destroyRaisedBridge(bridge',
  'buildingBatchStats.hideBuilding(b.model)','massWorker?.updateTerrain(nextWalkable',
  'structureCollapseVfx.collapse(definition','structureCollapseVfx.ignite(definition',
  'getStructureDurabilityQA','massWorker.igniteStructure(id,options)'])
  assert.ok(html.includes(contract),`破壊された建物・橋のゲーム画面への反映: ${contract}`);
const fixture=describeDestructibleWorld([{data:{kind:'house',x:20,z:20,w:10,d:12}}],[],[]);
assert.equal(fixture[0].bounds.minZ,14);
assert.equal(fixture[0].hp,STRUCTURE_DURABILITY.house);
assert.equal(fixture[0].fireDamagePerSecond,STRUCTURE_BURN_RATE.house);
const layout=structureEffectLayout(fixture[0]);
assert.ok(layout.fireCount>=9&&layout.shardCount>=16,'建物は延焼と倒壊の両方の粒子構成を持つ');
assert.equal(layout.kind,'house');

const THREE=await import('three').catch(()=>null);
if(THREE){
  const scene=new THREE.Scene();
  const vfx=new StructureCollapseVfx(THREE,scene,{cellSize:1,terrainHeight:()=>0});
  const sample={...fixture[0],id:'qa-fire-structure'};
  vfx.ignite(sample,1,{burnUntil:24});
  assert.ok(scene.children.some(o=>o.name==='StructureBurningFlames'),'着火時に炎を表示');
  assert.ok(scene.children.some(o=>o.name==='StructureBurningSmoke'),'煙は炎と別のGPUインスタンス');
  let settled=0;
  vfx.collapse(sample,5,()=>{settled++});
  assert.ok(scene.children.some(o=>o.name==='StructureFallingRoofAndWalls'),'崩壊中は壁・屋根の破片が落ちる');
  vfx.update(8);
  assert.equal(settled,1,'崩落完了時に瓦礫を設置');
  assert.equal(scene.children.some(o=>o.name==='StructureFallingRoofAndWalls'),false,'落下中の破片は後片付け');
  assert.equal(vfx.active.size,0,'演出終了後に炎と煙を削除');
  const {batchStaticBuildingShells}=await import('../src/stage-building-instancing.js');
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial();
  const makeBuilding=x=>{
    const model=new THREE.Group();model.userData.catalogId='town_house_001';model.position.x=x;
    const walls=new THREE.Group();walls.name='walls';walls.add(new THREE.Mesh(geometry,material));
    model.add(walls);root.add(model);return {data:{x,z:12},model};
  };
  const a=makeBuilding(12),b=makeBuilding(17);
  const batch=batchStaticBuildingShells([a,b],root,THREE,{sectorCells:64});
  assert.equal(batch.instances,2);
  const shared=root.children.find(o=>o.name==='BatchedTownBuildingShell');
  const matrixA=new THREE.Matrix4(),matrixB=new THREE.Matrix4();
  shared.getMatrixAt(1,matrixB);
  assert.ok(matrixB.determinant()>0,'破壊前に2つ目の建物が描画される');
  assert.equal(batch.hideBuilding(a.model),true);
  assert.equal(a.model.visible,false);
  shared.getMatrixAt(0,matrixA);shared.getMatrixAt(1,matrixB);
  assert.equal(matrixA.determinant(),0,'破壊された家だけGPUインスタンスを非表示');
  assert.ok(matrixB.determinant()>0,'隣家は消えない');
  assert.equal(batch.hideBuilding(a.model),false,'二重崩壊しない');
  geometry.dispose();material.dispose();
}
console.log('建物・橋の実登録 / GPUバッチ個別崩壊 / 渡橋破壊の同期 契約 OK');
