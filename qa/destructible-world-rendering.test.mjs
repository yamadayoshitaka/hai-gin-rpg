import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeDestructibleWorld} from '../src/destructible-world.js';

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
for(const contract of ['describeDestructibleWorld(townInstances,bridges',
  'collapseRegisteredStructure(e.objectId)','destroyRaisedBridge(bridge',
  'buildingBatchStats.hideBuilding(b.model)','massWorker?.updateTerrain(nextWalkable'])
  assert.ok(html.includes(contract),`破壊された建物・橋のゲーム画面への反映: ${contract}`);
const fixture=describeDestructibleWorld([{data:{kind:'house',x:20,z:20,w:10,d:12}}],[],[]);
assert.equal(fixture[0].bounds.minZ,14);

const THREE=await import('three').catch(()=>null);
if(THREE){
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
