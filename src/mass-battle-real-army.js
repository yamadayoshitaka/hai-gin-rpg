import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Real-mesh crowd rendering. One existing, dressed seven-head character per
 * profession is baked in its current rig pose and its exact textured triangles
 * are drawn with GPU instancing. No primitive/synthetic body proxies are used.
 * Every instanced soldier independently interpolates poses captured from the
 * actual retargeted, clothed rig (walk A/B and attack). Draw calls remain
 * proportional to outfit materials, not to the number of animated soldiers.
 */
export async function createMassBattleRealArmy(scene, simulation, { actors, jobs, camera, getWorldPosition, isDetailed, onProgress }) {
  const instanceGroups=[];
  const prototypes=new Map();
  const inverse=new THREE.Matrix4();
  const relative=new THREE.Matrix4();
  const scratch=new THREE.Vector3();
  const tilt=new THREE.Quaternion(),rollAxis=new THREE.Vector3(0,0,1);
  let triangles=0,originalPartCount=0;
  const hiddenScale=new THREE.Vector3(0,0,0);
  const hiddenPos=new THREE.Vector3(0,-1000,0);
  const hiddenMatrix=new THREE.Matrix4().compose(hiddenPos,new THREE.Quaternion(),hiddenScale);

  function samplePositions(source, modelInverse) {
    const original=source.geometry;
    const positions=original.getAttribute('position');
    if (!positions) return null;
    const result=new Float32Array(positions.count*3);
    source.updateMatrixWorld(true);
    relative.multiplyMatrices(modelInverse,source.matrixWorld);
    for(let i=0;i<positions.count;i++){
      scratch.fromBufferAttribute(positions,i);
      if(source.isSkinnedMesh)source.applyBoneTransform(i,scratch);
      scratch.applyMatrix4(relative);
      const k=i*3;result[k]=scratch.x;result[k+1]=scratch.y;result[k+2]=scratch.z;
    }
    return result;
  }

  function snapshotGeometry(source, modelInverse) {
    const geometry=source.geometry.clone();
    const pose=samplePositions(source,modelInverse);
    if(!pose){geometry.dispose();return null;}
    geometry.setAttribute('position',new THREE.BufferAttribute(pose,3));
    // Normals must follow the pose; otherwise metal plates appear unlit.
    if(geometry.index)geometry.computeVertexNormals();
    else if(geometry.getAttribute('normal'))geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function useInstancedRigAnimation(material) {
    material.onBeforeCompile=shader=>{
      shader.vertexShader=`attribute vec3 crowdWalkA;\nattribute vec3 crowdWalkB;\nattribute vec3 crowdAttack;\nattribute vec3 crowdHit;\nattribute vec3 crowdDead;\nattribute float crowdPhase;\nattribute float crowdAction;\nattribute float crowdStrike;\n`+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
        vec3 transformed = position;
        float walking = step(0.5, crowdAction) * (1.0 - step(1.5, crowdAction));
        float attacking = step(1.5, crowdAction) * (1.0 - step(2.5, crowdAction));
        float hit = step(2.5, crowdAction) * (1.0 - step(3.5, crowdAction));
        float dead = step(3.5, crowdAction);
        float gait = 0.5 + 0.5 * sin(crowdPhase);
        transformed = mix(transformed, mix(crowdWalkA, crowdWalkB, gait), walking);
        transformed = mix(transformed, crowdAttack, attacking * crowdStrike);
        transformed = mix(transformed, crowdHit, hit);
        transformed = mix(transformed, crowdDead, dead);
      `);
    };
    material.customProgramCacheKey=()=> 'real-rig-crowd-v2';
    material.needsUpdate=true;
  }

  for(let jobIndex=0;jobIndex<jobs.length;jobIndex++){
    const job=jobs[jobIndex];
    const representative=actors.find(a=>a.job.name===job.name&&a.character&&a.outfit&&!a.outfitError);
    if(!representative){
      throw Error(`${job.name}の実物衣装モデルを読み込めません。簡易モデルへの切り替えは行いません。`);
    }
    representative.crowdSampling=true;
    const person=representative.character.object3D;
    await representative.character.play('idle');
    representative.character.update(0);
    representative.outfit.sync();
    representative.root.updateMatrixWorld(true);
    inverse.copy(representative.root.matrixWorld).invert();
    const partGroups=new Map();
    const sources=[];
    person.traverse(object=>{
      if(!(object.isMesh||object.isSkinnedMesh)||!object.geometry||!object.visible)return;
      let ancestor=object.parent;
      while(ancestor&&ancestor!==person){if(!ancestor.visible)return;ancestor=ancestor.parent;}
      // The underlying nude body can be hidden by the shared wardrobe runtime.
      const geometry=snapshotGeometry(object,inverse);
      if(!geometry)return;
      sources.push({object,geometry});
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
    // Sample the EXISTING animation binding instead of substituting a low-poly
    // or non-rigged proxy. Each soldier uses its own phase/action on the GPU.
    async function capture(state,delta,attribute,fallback){
      let ok=await representative.character.play(state);
      if(!ok&&fallback)ok=await representative.character.play(fallback);
      if(ok)representative.character.update(delta);
      representative.outfit.sync();representative.root.updateMatrixWorld(true);
      for(const {object,geometry} of sources){
        const pose=ok?samplePositions(object,inverse):null;
        geometry.setAttribute(attribute,new THREE.BufferAttribute(pose||geometry.getAttribute('position').array.slice(),3));
      }
      return ok;
    }
    await capture('walk',.18,'crowdWalkA','run');
    await capture('walk',.55,'crowdWalkB','run');
    await capture('attack',.27,'crowdAttack','skill');
    await capture('hit',.20,'crowdHit');
    await capture('dead',.70,'crowdDead');
    await representative.character.play('idle');
    representative.character.update(.01);representative.outfit.sync();
    const materialMeshes=[];
    for(const group of partGroups.values()){
      const merged=group.geometries.length>1?mergeGeometries(group.geometries,false):null;
      if(merged)group.geometries.forEach(g=>g.dispose());
      const geometries=merged?[merged]:group.geometries;
      for(const geometry of geometries){
        const original=group.material;
        const material=Array.isArray(original)?original.map(m=>m.clone()):original.clone();
        const mats=Array.isArray(material)?material:[material];
        for(const m of mats){m.depthWrite=!m.transparent;m.side=THREE.DoubleSide;useInstancedRigAnimation(m);}
        materialMeshes.push({geometry,material,name:group.name});
      }
    }
    const members=simulation.units.filter(u=>u.jobIndex===jobIndex&&!isDetailed(u));
    const layers=[];
    for(const part of materialMeshes){
      part.geometry.setAttribute('crowdPhase',new THREE.InstancedBufferAttribute(new Float32Array(members.length),1));
      part.geometry.setAttribute('crowdAction',new THREE.InstancedBufferAttribute(new Float32Array(members.length),1));
      part.geometry.setAttribute('crowdStrike',new THREE.InstancedBufferAttribute(new Float32Array(members.length),1));
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
    representative.crowdSampling=false;
    if(typeof requestAnimationFrame==='function')await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const matrices=new Map(),pos=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);
  const rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  const world={x:0,y:0,z:0};
  const visibleIds=new Set();
  const projection=new THREE.Matrix4(),frustum=new THREE.Frustum();
  const bounds=new THREE.Sphere(new THREE.Vector3(),2.5);
  function update(alpha=0){
    visibleIds.clear();
    if(camera){
      camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
    }
    for(const u of simulation.units){
      if(isDetailed(u))continue;
      getWorldPosition(u,world,alpha);
      bounds.center.set(world.x,world.y+1.1,world.z);
      if(camera&&!frustum.intersectsSphere(bounds))continue;
      pos.set(world.x,world.y+(u.alive&&u.action==='walk'?Math.sin(u.phase)*.012:0),world.z);
      rotation.setFromAxisAngle(up,Math.atan2(u.facingX||0,u.facingZ||1));
      if(!u.alive){tilt.setFromAxisAngle(rollAxis,Math.PI*.47);rotation.multiply(tilt);pos.y-=.3;}
      const transform=matrices.get(u.id)||new THREE.Matrix4();
      transform.compose(pos,rotation,scale);
      matrices.set(u.id,transform);
      visibleIds.add(u.id);
    }
    for(const {members,layers} of prototypes.values()){
      const visible=members.filter(u=>visibleIds.has(u.id));
      for(const layer of layers){
        layer.count=visible.length;
        const phases=layer.geometry.getAttribute('crowdPhase');
        const actions=layer.geometry.getAttribute('crowdAction');
        const strikes=layer.geometry.getAttribute('crowdStrike');
        for(let i=0;i<visible.length;i++){
          const u=visible[i];
          layer.setMatrixAt(i,matrices.get(u.id)||hiddenMatrix);
          phases.setX(i,u.phase+alpha*.38);
          actions.setX(i,!u.alive?4:u.hitFlash>0?3:u.action==='attack'?2:u.action==='walk'?1:0);
          const strikeTime=Math.min(1,(u.attackElapsed+alpha*.1)/.55);
          strikes.setX(i,Math.sin(Math.PI*strikeTime));
        }
        layer.instanceMatrix.needsUpdate=true;
        phases.needsUpdate=true;actions.needsUpdate=true;strikes.needsUpdate=true;
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
