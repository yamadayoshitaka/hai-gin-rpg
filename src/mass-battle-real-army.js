import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {captureCrowdImpostorAtlas} from './crowd-impostor-atlas.js';
import {crowdCardinalView,crowdProjectedHeight,useCrowdImpostor} from './crowd-lod-policy.js';

/**
 * Real-mesh crowd rendering. One existing, dressed seven-head character per
 * profession is baked in its current rig pose and its exact textured triangles
 * are drawn with GPU instancing. No primitive/synthetic body proxies are used.
 * Every instanced soldier independently interpolates poses captured from the
 * actual retargeted, clothed rig (walk A/B and attack). Draw calls remain
 * proportional to outfit materials, not to the number of animated soldiers.
 */
export async function createMassBattleRealArmy(scene, simulation, { actors, jobs, camera, renderer, getWorldPosition, isDetailed, onProgress }) {
  const instanceGroups=[];
  const impostorTargets=[];
  const prototypes=new Map();
  const inverse=new THREE.Matrix4();
  const relative=new THREE.Matrix4();
  const scratch=new THREE.Vector3();
  const tilt=new THREE.Quaternion(),rollAxis=new THREE.Vector3(0,0,1);
  let triangles=0,originalPartCount=0,sourceBodyVertices=0;
  const bodyCoverage=[];
  const gl=renderer?.getContext?.();
  const gpuVertexAttributeLimit=gl?.getParameter(gl.MAX_VERTEX_ATTRIBS)||16;
  let maxVertexAttributeSlots=0;
  const vertexAttributeBudget=[];

  // Imported GLTFs frequently allocate a new Material UUID for every rivet,
  // seam and armor piece even when the actual PBR finish is identical. Group
  // by the rendered finish to avoid thousands of redundant GPU draw calls.
  function visualMaterialKey(material){
    if(Array.isArray(material))return 'multi:'+material.map(m=>m.uuid).join(',');
    const numbers=['opacity','alphaTest','roughness','metalness','bumpScale',
      'clearcoat','clearcoatRoughness','transmission','ior','emissiveIntensity'];
    const flags=['type','side','transparent','depthWrite','depthTest','blending',
      'vertexColors','flatShading','wireframe','toneMapped'];
    const maps=['map','alphaMap','normalMap','bumpMap','metalnessMap','roughnessMap',
      'aoMap','emissiveMap','envMap','clearcoatMap'];
    return [
      ...flags.map(k=>String(material[k])),
      ...numbers.map(k=>Number.isFinite(material[k])?material[k].toFixed(5):''),
      material.color?.getHexString()||'',material.emissive?.getHexString()||'',
      ...maps.map(k=>material[k]?.uuid||''),JSON.stringify(material.defines||{})
    ].join('|');
  }

  function isInactiveHairLevel(object,person){
    // A hidden representative has never been through LOD.update(), so its
    // three hair assets are all flagged visible. Baking ALL three together
    // stacks scalp shells, hides eyes/skin and triples portrait draw calls.
    for(let parent=object.parent;parent&&parent!==person;parent=parent.parent){
      if(!parent.isLOD||!parent.levels?.length)continue;
      let child=object;
      while(child.parent&&child.parent!==parent)child=child.parent;
      if(child!==parent.levels[0].object)return true;
    }
    return false;
  }

  function stripUnusedVertexChannels(geometry,material){
    // Quaternius GLTF meshes may contain four TEXCOORD sets and two COLOR
    // sets. Standard/Physical materials read only the UV channels actually
    // selected by a texture (and COLOR_0 when vertexColors is enabled).
    // Those unused channels still occupy hardware attribute slots if kept in
    // an InstancedMesh, causing a whole body part to disappear on 16-slot GPUs.
    const materials=Array.isArray(material)?material:[material];
    const used=new Set(['position','normal','uv']);
    const textures=['map','alphaMap','normalMap','bumpMap','roughnessMap',
      'metalnessMap','aoMap','emissiveMap','displacementMap','lightMap',
      'clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap',
      'sheenColorMap','sheenRoughnessMap','specularColorMap','specularIntensityMap',
      'transmissionMap','thicknessMap','iridescenceMap','iridescenceThicknessMap'];
    for(const mat of materials){
      if(mat.vertexColors)used.add('color');
      if(mat.normalMap)used.add('tangent');
      for(const property of textures){
        const texture=mat[property];
        if(!texture)continue;
        const channel=texture.channel??0;
        used.add(channel===0?'uv':`uv${channel}`);
      }
    }
    for(const name of Object.keys(geometry.attributes)){
      if((/^uv\d*$/.test(name)||/^color(?:_\d+)?$/.test(name)||name==='tangent')&&!used.has(name))
        geometry.deleteAttribute(name);
    }
  }

  function samplePositions(source, modelInverse) {
    const original=source.geometry;
    const positions=original.getAttribute('position');
    if (!positions) return null;
    const result=new Float32Array(positions.count*3);
    source.updateMatrixWorld(true);
    relative.multiplyMatrices(modelInverse,source.matrixWorld);
    for(let i=0;i<positions.count;i++){
      // SkinnedMesh.getVertexPosition ALREADY applies skinning and morphs.
      // Applying applyBoneTransform here again would deform each joint twice
      // and create floating limbs after final GPU part consolidation.
      source.getVertexPosition(i,scratch);
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
    // Both skeleton and morph targets are now baked into pose attributes.
    // Leaving old morph targets in a static GPU instance can deform a garment
    // a second time or block compatible pieces from being merged.
    geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
    geometry.morphAttributes={};
    // Normals must follow the pose; otherwise metal plates appear unlit.
    if(geometry.index)geometry.computeVertexNormals();
    else if(geometry.getAttribute('normal'))geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function useInstancedRigAnimation(material) {
    material.onBeforeCompile=shader=>{
      // Four independent scalar attributes can exceed the 16-slot vertex
      // attribute limit on Android once a skinned body's UVs, vertex color,
      // five baked poses and four-column instanceMatrix are bound. A vec4
      // stores the same data in ONE slot, without lowering visual quality.
      shader.vertexShader=`attribute vec3 crowdWalkA;\nattribute vec3 crowdWalkB;\nattribute vec3 crowdAttack;\nattribute vec3 crowdHit;\nattribute vec3 crowdDead;\nattribute vec4 crowdMotion;\n`+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
        vec3 transformed = position;
        float walking = step(0.5, crowdMotion.y) * (1.0 - step(1.5, crowdMotion.y));
        // A soldier waiting for a one-tile gap must not freeze in the source
        // rig pose. Blend a small, continuous weight shift without moving feet
        // into an occupied cell or faking any displacement in the simulation.
        float waiting = step(1.1, crowdMotion.y) * walking;
        walking *= 1.0 - 0.78 * waiting;
        float attacking = step(1.5, crowdMotion.y) * (1.0 - step(2.5, crowdMotion.y));
        float hit = step(2.5, crowdMotion.y) * (1.0 - step(3.5, crowdMotion.y));
        float dead = step(3.5, crowdMotion.y);
        float gait = 0.5 + 0.5 * sin(crowdMotion.x);
        transformed = mix(transformed, mix(crowdWalkA, crowdWalkB, gait), walking);
        transformed = mix(transformed, crowdAttack, attacking * crowdMotion.z);
        transformed = mix(transformed, crowdHit, hit);
        // Hit recoil flows continuously into the captured real death pose.
        transformed = mix(transformed, mix(crowdHit, crowdDead, smoothstep(0.0, 1.0, crowdMotion.w)), dead);
      `);
    };
    material.customProgramCacheKey=()=> 'real-rig-crowd-packed-v4';
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
    let humanVertices=0,bodyTriangles=0;
    const humanBounds=new THREE.Box3();
    // Bake the complete underlying seven-head body together with its costume.
    // The older bone-weight face-only mask deleted whole thighs, shoulders and
    // trunks, producing disconnected outfits in distant instanced soldiers.
    try{
    person.traverse(object=>{
      if(!(object.isMesh||object.isSkinnedMesh)||!object.geometry||!object.visible||isInactiveHairLevel(object,person))return;
      let ancestor=object.parent;
      while(ancestor&&ancestor!==person){if(!ancestor.visible)return;ancestor=ancestor.parent;}
      // Keep every body triangle. A partial index mask cannot represent cloth
      // coverage reliably, and gaps are more damaging than minor intersections.
      const geometry=snapshotGeometry(object,inverse);
      if(!geometry)return;
      stripUnusedVertexChannels(geometry,object.material);
      let isHumanBody=false,bodyAncestor=object;
      while(bodyAncestor&&bodyAncestor!==person){
        if(bodyAncestor===representative.character.model){isHumanBody=true;break;}
        bodyAncestor=bodyAncestor.parent;
      }
      if(isHumanBody){
        humanVertices+=geometry.getAttribute('position').count;
        bodyTriangles+=geometry.index?geometry.index.count/3:geometry.getAttribute('position').count/3;
        humanBounds.expandByObject(new THREE.Mesh(geometry));
      }
      // The skinned human remains behind the separate real clothing meshes.
      sources.push({object,geometry});
      const original=object.material;
      const attributes=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b))
        .map(([key,value])=>key+':'+value.itemSize+':'+value.normalized+':'+value.array.constructor.name).join('|');
      // 同じ材質・UV・頂点属性の衣装パーツだけ結合する。テクスチャは一切変更しない。
      const canMerge=!Array.isArray(original)&&!Object.keys(geometry.morphAttributes).length;
      // A real anatomical body is a required independently audited layer.
      // Costume consolidation is allowed, but may never replace/absorb it.
      const groupKey=isHumanBody?'anatomy:'+object.uuid:canMerge?
        visualMaterialKey(original)+':'+Boolean(geometry.index)+':'+attributes:object.uuid;
      if(!partGroups.has(groupKey))partGroups.set(groupKey,{geometries:[],material:original,name:object.name||'character-part',isHumanBody});
      partGroups.get(groupKey).geometries.push(geometry);
      originalPartCount++;
      triangles+=geometry.index?geometry.index.count/3:geometry.getAttribute('position').count/3;
    });
    const bodyHeight=humanBounds.getSize(new THREE.Vector3()).y;
    if(humanVertices<5000||bodyTriangles<6000||bodyHeight<1.1){
      throw Error(`${job.name}: 人体メッシュが部品最適化の前に欠損 (${humanVertices}頂点/${Math.round(bodyTriangles)}面/高さ${bodyHeight.toFixed(2)}m)`);
    }
    sourceBodyVertices+=humanVertices;
    bodyCoverage.push({job:job.name,vertices:humanVertices,triangles:Math.round(bodyTriangles),height:+bodyHeight.toFixed(3)});
    // Sample the EXISTING animation binding instead of substituting a low-poly
    // or non-rigged proxy. Each soldier uses its own phase/action on the GPU.
    async function capture(state,delta,attribute,fallback){
      let ok=await representative.character.play(state);
      if(!ok&&fallback)ok=await representative.character.play(fallback);
      if(ok)representative.character.update(delta);
      representative.outfit.sync();representative.root.updateMatrixWorld(true);
      for(const {object,geometry} of sources){
        let pose=ok?samplePositions(object,inverse):null;
        const base=geometry.getAttribute('position').array;
        if(pose){
          let valid=pose.length===base.length,minY=Infinity,maxY=-Infinity;
          for(let i=0;i<pose.length&&valid;i+=3){
            if(!Number.isFinite(pose[i])||!Number.isFinite(pose[i+1])||!Number.isFinite(pose[i+2]))valid=false;
            else {minY=Math.min(minY,pose[i+1]);maxY=Math.max(maxY,pose[i+1]);}
          }
          // Broken bone retargeting used to put arms and body several metres
          // away from the suit. Fall back to the *same real idle body*, never
          // hide anatomy, if a captured motion contains impossible vertices.
          if(!valid||minY< -6||maxY>8)pose=null;
        }
        geometry.setAttribute(attribute,new THREE.BufferAttribute(pose||base.slice(),3));
      }
      return ok;
    }
    // The entire 65-bone human, helmet, hair, armor and equipped weapon are
    // captured together in every posture. Class-specific commands select the
    // same authored motion assignments as the action verification studio.
    const locomotion=job.speed>=3.2?'run':'walk';
    const attackAction=['魔法使い','僧侶','召喚士'].includes(job.name)?'skill':'attack';
    const defendAction=job.name==='盾戦士'?'guard':'hit';
    await capture(locomotion,.18,'crowdWalkA',locomotion==='run'?'walk':'run');
    await capture(locomotion,.55,'crowdWalkB',locomotion==='run'?'walk':'run');
    await capture(attackAction,.27,'crowdAttack',attackAction==='skill'?'attack':'skill');
    await capture(defendAction,.20,'crowdHit','hit');
    await capture('dead',.70,'crowdDead','hit');
    await representative.character.play('idle');
    representative.character.update(.01);representative.outfit.sync();
    }finally{
      representative.outfit.setBodyOcclusion?.(true);
    }
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
        materialMeshes.push({geometry,material,name:group.name,isHumanBody:group.isHumanBody});
      }
    }
    // The final material merge may combine clothing, but all anatomical
    // triangles must still have a GPU draw layer after consolidation.
    const retainedBodyVertices=materialMeshes.filter(p=>p.isHumanBody)
      .reduce((sum,p)=>sum+p.geometry.getAttribute('position').count,0);
    if(retainedBodyVertices!==humanVertices)throw Error(`${job.name}: 部品結合で人体が失われました (${humanVertices}→${retainedBodyVertices})`);
    bodyCoverage.at(-1).optimizedVertices=retainedBodyVertices;
    const members=simulation.units.filter(u=>u.jobIndex===jobIndex&&!isDetailed(u));
    // Photograph the same live rig as 50v50, not its reconstructed mesh list.
    // A correct vertex count cannot prove that the skin was rendered next to
    // its costume, as the screenshots of the old LOD demonstrated.
    let impostorAsset=null;
    if(renderer&&members.length){
      impostorAsset=await captureCrowdImpostorAtlas(renderer,representative);
      if(impostorAsset)impostorTargets.push(impostorAsset.target);
    }
    // Every outfit part in the same profession shares one set of GPU instance
    // buffers. Matrix/pose data is uploaded ONCE per profession per frame,
    // regardless of how many exact clothing meshes/materials it uses.
    const shared={
      matrix:new THREE.InstancedBufferAttribute(new Float32Array(members.length*16),16),
      motion:new THREE.InstancedBufferAttribute(new Float32Array(members.length*4),4)
    };
    for(const attr of Object.values(shared))attr.setUsage(THREE.DynamicDrawUsage);
    const layers=[],bodyLayers=[];
    for(const part of materialMeshes){
      const requiredSlots=Object.keys(part.geometry.attributes).length+1+4;
      maxVertexAttributeSlots=Math.max(maxVertexAttributeSlots,requiredSlots);
      if(requiredSlots>gpuVertexAttributeLimit){
        throw Error(`${job.name}のGPU頂点属性が上限超過: ${requiredSlots}/${gpuVertexAttributeLimit} (${Object.keys(part.geometry.attributes).join(',')})`);
      }
      vertexAttributeBudget.push({job:job.name,part:part.name,slots:requiredSlots});
      // Never allow the prototype's hidden-skin/alpha material state to be
      // baked into the army: every distant soldier needs its complete human.
      if(part.isHumanBody){
        const bodyMaterials=Array.isArray(part.material)?part.material:[part.material];
        for(const material of bodyMaterials){
          material.visible=true;material.opacity=1;material.transparent=false;
          material.alphaTest=0;material.alphaMap=null;material.colorWrite=true;
          material.depthTest=true;material.depthWrite=true;material.needsUpdate=true;
        }
      }
      part.geometry.setAttribute('crowdMotion',shared.motion);
      const instance=new THREE.InstancedMesh(part.geometry,part.material,members.length);
      instance.name=`real-army-${job.name}-${part.name}`;
      instance.frustumCulled=false;
      instance.castShadow=false;
      instance.receiveShadow=false;
      instance.instanceMatrix=shared.matrix;
      instance.count=0;
      if(part.isHumanBody){
        // Draw the opaque body before translucent cloth/hair and ensure all
        // visible members receive that body layer, not only their equipment.
        instance.renderOrder=-1;
        instance.userData.fullHumanBody=true;
        bodyLayers.push(instance);
      }
      scene.add(instance);
      layers.push(instance);
    }
    let impostor=null;
    if(impostorAsset){
      const farShared={
        matrix:new THREE.InstancedBufferAttribute(new Float32Array(members.length*16),16),
        phases:new THREE.InstancedBufferAttribute(new Float32Array(members.length),1),
        actions:new THREE.InstancedBufferAttribute(new Float32Array(members.length),1),
        directions:new THREE.InstancedBufferAttribute(new Float32Array(members.length),1)
      };
      for(const attr of Object.values(farShared))attr.setUsage(THREE.DynamicDrawUsage);
      const geometry=new THREE.PlaneGeometry(3.1,3.1);
      geometry.setAttribute('crowdPhase',farShared.phases);
      geometry.setAttribute('crowdAction',farShared.actions);
      geometry.setAttribute('crowdDirection',farShared.directions);
      const mesh=new THREE.InstancedMesh(geometry,impostorAsset.material,members.length);
      mesh.name=`real-body-armour-impostor-${job.name}`;
      mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
      mesh.instanceMatrix=farShared.matrix;mesh.count=0;
      scene.add(mesh);instanceGroups.push(mesh);
      impostor={mesh,shared:farShared};
    }
    if(!layers.length)throw Error(`${job.name}の実物メッシュが見つかりません`);
    if(!bodyLayers.length)throw Error(`${job.name}の人体描画レイヤーがありません（衣装だけの表示を禁止）`);
    prototypes.set(jobIndex,{members,layers,bodyLayers,shared,impostor,atlasAudit:impostorAsset?.audit});
    instanceGroups.push(...layers);
    onProgress?.(jobIndex+1,jobs.length,job.name);
    representative.crowdSampling=false;
    if(typeof requestAnimationFrame==='function')await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const transform=new THREE.Matrix4(),pos=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);
  const farScale=new THREE.Vector3(1,1,1),farTransform=new THREE.Matrix4();
  const rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  const world={x:0,y:0,z:0};
  const projection=new THREE.Matrix4(),frustum=new THREE.Frustum();
  const bounds=new THREE.Sphere(new THREE.Vector3(),2.5);
  const canvasSize=new THREE.Vector2();
  let visibleSoldiers=0,bodyVisibleSoldiers=0,impostorVisibleSoldiers=0,fullMeshVisibleSoldiers=0,blockedVisibleSoldiers=0;
  function update(alpha=0,extraTime=0,visualTime=simulation.time){
    visibleSoldiers=0;bodyVisibleSoldiers=0;impostorVisibleSoldiers=0;fullMeshVisibleSoldiers=0;blockedVisibleSoldiers=0;
    const viewportCssHeight=renderer?renderer.getSize(canvasSize).y:800;
    if(camera){
      camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
    }
    for(const {members,layers,bodyLayers,shared,impostor} of prototypes.values()){
      let visible=0,farVisible=0;
      for(const u of members){
        getWorldPosition(u,world,alpha);
        bounds.center.set(world.x,world.y+1.1,world.z);
        if(camera&&!frustum.intersectsSphere(bounds))continue;
        if(u.action==='blocked')blockedVisibleSoldiers++;
        const distance=camera?camera.position.distanceTo(bounds.center):0;
        const pixels=camera?crowdProjectedHeight(1.78,viewportCssHeight,camera.fov,distance):Infinity;
        const useFar=!!impostor&&useCrowdImpostor(pixels,u._crowdImpostor===true);
        u._crowdImpostor=useFar;
        const death=u.alive?0:simulation.getDeathProgress(u,alpha,extraTime);
        const eased=death*death*(3-2*death);
        const stepPhase=u.action==='blocked'?visualTime*1.4+(u.id%11)*.49:simulation.getStepPhase(u,alpha);
        if(useFar){
          const cameraDx=camera.position.x-world.x,cameraDz=camera.position.z-world.z;
          const cameraAngle=Math.atan2(cameraDx,cameraDz);
          pos.set(world.x,world.y+.95-.3*eased,world.z);
          rotation.setFromAxisAngle(up,cameraAngle);
          farTransform.compose(pos,rotation,farScale);
          impostor.shared.matrix.array.set(farTransform.elements,farVisible*16);
          impostor.shared.phases.array[farVisible]=stepPhase;
          impostor.shared.actions.array[farVisible]=!u.alive?4:(u.action==='attack'||u.action==='skill')?2:u.action==='walk'?1:u.action==='blocked'?1.25:0;
          impostor.shared.directions.array[farVisible]=crowdCardinalView(u.facingX||0,u.facingZ||1,cameraDx,cameraDz);
          farVisible++;
          continue;
        }
        pos.set(world.x,world.y+(u.alive&&u.action==='walk'?Math.sin(stepPhase)*.012:0)-.3*eased,world.z);
        rotation.setFromAxisAngle(up,Math.atan2(u.facingX||0,u.facingZ||1));
        if(!u.alive){tilt.setFromAxisAngle(rollAxis,Math.PI*.47*eased);rotation.multiply(tilt);}
        transform.compose(pos,rotation,scale);
        shared.matrix.array.set(transform.elements,visible*16);
        const motionOffset=visible*4;
        shared.motion.array[motionOffset]=stepPhase;
        shared.motion.array[motionOffset+1]=!u.alive?4:u.hitFlash>0?3:(u.action==='attack'||u.action==='skill')?2:u.action==='walk'?1:u.action==='blocked'?1.25:0;
        shared.motion.array[motionOffset+2]=Math.sin(Math.PI*Math.min(1,(u.attackElapsed+alpha*.1)/.55));
        shared.motion.array[motionOffset+3]=eased;
        visible++;
      }
      visibleSoldiers+=visible+farVisible;
      fullMeshVisibleSoldiers+=visible;
      impostorVisibleSoldiers+=farVisible;
      // Distance atlases contain the original complete body and costume.
      if(bodyLayers.length)bodyVisibleSoldiers+=visible+farVisible;
      for(const layer of layers)layer.count=visible;
      if(impostor)impostor.mesh.count=farVisible;
      // Only the visible portion of each profession's shared GPU buffer needs
      // uploading. Geometry/material quality and per-soldier poses are intact.
      for(const attr of Object.values(shared)){
        if(!visible)continue;
        if(typeof attr.clearUpdateRanges==='function'&&typeof attr.addUpdateRange==='function'){
          attr.clearUpdateRanges();
          attr.addUpdateRange(0,visible*attr.itemSize);
        }
        attr.needsUpdate=true;
      }
      if(impostor)for(const attr of Object.values(impostor.shared)){
        if(!farVisible)continue;
        if(typeof attr.clearUpdateRanges==='function'&&typeof attr.addUpdateRange==='function'){
          attr.clearUpdateRanges();attr.addUpdateRange(0,farVisible*attr.itemSize);
        }
        attr.needsUpdate=true;
      }
    }
  }
  update();
  return {
    update,drawMeshes:instanceGroups.length,sharedGpuBatches:prototypes.size,
    get visibleSoldiers(){return visibleSoldiers},
    get bodyVisibleSoldiers(){return bodyVisibleSoldiers},
    get impostorVisibleSoldiers(){return impostorVisibleSoldiers},
    get fullMeshVisibleSoldiers(){return fullMeshVisibleSoldiers},
    get blockedVisibleSoldiers(){return blockedVisibleSoldiers},
    impostorAtlases:impostorTargets.length,
    atlasSilhouettes:[...prototypes.values()].map(part=>part.atlasAudit).filter(Boolean),
    gpuVertexAttributeLimit,maxVertexAttributeSlots,vertexAttributeBudget,
    bodyDrawLayers:[...prototypes.values()].reduce((total,part)=>total+part.bodyLayers.length,0),
    sourceParts:originalPartCount,sourceBodyVertices,bodyCoverage,trianglesPerTenPrototypes:Math.round(triangles),
    dispose(){for(const layer of instanceGroups){scene.remove(layer);layer.geometry.dispose();
      if(Array.isArray(layer.material))layer.material.forEach(m=>m.dispose());else layer.material.dispose();layer.dispose();}
      for(const target of impostorTargets)target.dispose();}
  };
}
