import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Real-mesh crowd rendering. One existing, dressed seven-head character per
 * profession is baked in its current rig pose and its exact textured triangles
 * are drawn with GPU instancing. No primitive/synthetic body proxies are used.
 * Animation of the crowd is a whole-body bob; detailed foreground characters
 * continue to use their own actual skeletons and motion controllers.
 */
export async function createMassBattleRealArmy(scene, simulation, { actors, jobs, camera, getWorldPosition, isDetailed, onProgress }) {
  const instanceGroups=[];
  const prototypes=new Map();
  const inverse=new THREE.Matrix4();
  const relative=new THREE.Matrix4();
  const scratch=new THREE.Vector3();
  let triangles=0,originalPartCount=0;
  const hiddenScale=new THREE.Vector3(0,0,0);
  const hiddenPos=new THREE.Vector3(0,-1000,0);
  const hiddenMatrix=new THREE.Matrix4().compose(hiddenPos,new THREE.Quaternion(),hiddenScale);

  function snapshotGeometry(source, modelInverse) {
    const original=source.geometry;
    const geometry=original.clone();
    const positions=geometry.getAttribute('position');
    if (!positions) { geometry.dispose(); return null; }
    source.updateMatrixWorld(true);
    relative.multiplyMatrices(modelInverse,source.matrixWorld);
    for(let i=0;i<positions.count;i++){
      scratch.fromBufferAttribute(positions,i);
      if(source.isSkinnedMesh)source.applyBoneTransform(i,scratch);
      scratch.applyMatrix4(relative);
      positions.setXYZ(i,scratch.x,scratch.y,scratch.z);
    }
    positions.needsUpdate=true;
    // Normals must follow the pose; otherwise metal plates appear unlit.
    if(geometry.index)geometry.computeVertexNormals();
    else if(geometry.getAttribute('normal'))geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  for(let jobIndex=0;jobIndex<jobs.length;jobIndex++){
    const job=jobs[jobIndex];
    const representative=actors.find(a=>a.job.name===job.name&&a.character&&a.outfit&&!a.outfitError);
    if(!representative){
      throw Error(`${job.name}の実物衣装モデルを読み込めません。簡易モデルへの切り替えは行いません。`);
    }
    const person=representative.character.object3D;
    representative.character.update(0);
    representative.outfit.sync();
    representative.root.updateMatrixWorld(true);
    inverse.copy(representative.root.matrixWorld).invert();
    const partGroups=new Map();
    person.traverse(object=>{
      if(!(object.isMesh||object.isSkinnedMesh)||!object.geometry||!object.visible)return;
      let ancestor=object.parent;
      while(ancestor&&ancestor!==person){if(!ancestor.visible)return;ancestor=ancestor.parent;}
      // The underlying nude body can be hidden by the shared wardrobe runtime.
      const geometry=snapshotGeometry(object,inverse);
      if(!geometry)return;
      const original=object.material;
      const attributes=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b))
        .map(([key,value])=>key+':'+value.itemSize+':'+value.normalized+':'+value.array.constructor.name).join('|');
      // 同じ材質・UV・頂点属性の衣装パーツだけ結合する。テクスチャは一切変更しない。
      const canMerge=!Array.isArray(original)&&!Object.keys(geometry.morphAttributes).length;
      const groupKey=canMerge?original.uuid+':'+Boolean(geometry.index)+':'+attributes:object.uuid;
      if(!partGroups.has(groupKey))partGroups.set(groupKey,{geometries:[],material:original,name:object.name||'character-part'});
      partGroups.get(groupKey).geometries.push(geometry);
      originalPartCount++;
      triangles+=geometry.index?geometry.index.count/3:geometry.getAttribute('position').count/3;
    });
    const materialMeshes=[];
    for(const group of partGroups.values()){
      const merged=group.geometries.length>1?mergeGeometries(group.geometries,false):null;
      if(merged)group.geometries.forEach(g=>g.dispose());
      const geometries=merged?[merged]:group.geometries;
      for(const geometry of geometries){
        const original=group.material;
        const material=Array.isArray(original)?original.map(m=>m.clone()):original.clone();
        const mats=Array.isArray(material)?material:[material];
        for(const m of mats){m.depthWrite=!m.transparent;m.side=THREE.DoubleSide;}
        materialMeshes.push({geometry,material,name:group.name});
      }
    }
    const members=simulation.units.filter(u=>u.jobIndex===jobIndex&&!isDetailed(u));
    const layers=[];
    for(const part of materialMeshes){
      const instance=new THREE.InstancedMesh(part.geometry,part.material,members.length);
      instance.name=`real-army-${job.name}-${part.name}`;
      instance.frustumCulled=false;
      instance.castShadow=false;
      instance.receiveShadow=false;
      instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for(let i=0;i<members.length;i++)instance.setMatrixAt(i,hiddenMatrix);
      instance.instanceMatrix.needsUpdate=true;
      instance.count=0;
      scene.add(instance);
      layers.push(instance);
    }
    if(!layers.length)throw Error(`${job.name}の実物メッシュが見つかりません`);
    prototypes.set(jobIndex,{members,layers});
    instanceGroups.push(...layers);
    onProgress?.(jobIndex+1,jobs.length,job.name);
    if(typeof requestAnimationFrame==='function')await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const matrices=new Map(),pos=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);
  const rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  const world={x:0,y:0,z:0};
  const visibleIds=new Set();
  const projection=new THREE.Matrix4(),frustum=new THREE.Frustum();
  const bounds=new THREE.Sphere(new THREE.Vector3(),2.5);
  function update(){
    visibleIds.clear();
    if(camera){
      camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
    }
    for(const u of simulation.units){
      if(isDetailed(u))continue;
      if(!u.alive){matrices.set(u.id,hiddenMatrix);continue;}
      getWorldPosition(u,world);
      bounds.center.set(world.x,world.y+1.1,world.z);
      if(camera&&!frustum.intersectsSphere(bounds))continue;
      pos.set(world.x,world.y+(u.action==='walk'?Math.sin(u.phase)*.055:0),world.z);
      rotation.setFromAxisAngle(up,u.team===0?Math.PI/2:-Math.PI/2);
      const transform=matrices.get(u.id)||new THREE.Matrix4();
      transform.compose(pos,rotation,scale);
      matrices.set(u.id,transform);
      visibleIds.add(u.id);
    }
    for(const {members,layers} of prototypes.values()){
      const visible=members.filter(u=>visibleIds.has(u.id));
      for(const layer of layers){
        layer.count=visible.length;
        for(let i=0;i<visible.length;i++)layer.setMatrixAt(i,matrices.get(visible[i].id)||hiddenMatrix);
        layer.instanceMatrix.needsUpdate=true;
      }
    }
  }
  update();
  return {
    update,drawMeshes:instanceGroups.length,sourceParts:originalPartCount,trianglesPerTenPrototypes:Math.round(triangles),
    dispose(){for(const layer of instanceGroups){scene.remove(layer);layer.geometry.dispose();
      if(Array.isArray(layer.material))layer.material.forEach(m=>m.dispose());else layer.material.dispose();layer.dispose();}}
  };
}
