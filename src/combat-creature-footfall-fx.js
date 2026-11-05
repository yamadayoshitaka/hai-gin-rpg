/**
 * Actual 3D mesh effects extracted from the user's Library model.glb.
 * A bounded shared InstancedMesh pool avoids creating one scene object per
 * soldier or quadruped step in the 1000v1000 battle.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const LIBRARY_FOOTFALL_FX=Object.freeze({
  dust:'003-dust-puff-dome/0',
  sparks:'004-spark-fan/0',
  water:'009-water-splash-crown/0',
  sand:'010-sand-kick-fan/0',
  snow:'011-snow-puff/0',
});

const EFFECT_LIMIT=60,MAX_AGE=.68;
const scratch=new THREE.Object3D();

export function createCreatureFootfallFx(scene,{camera=null,enabled=true}={}){
  const meshes=new Map(),pending=[];
  let disposed=false,ready=false;
  if(enabled&&typeof window!=='undefined'&&typeof document!=='undefined'){
    const file=new URL('../assets/creatures/ground-impact-library.glb',import.meta.url).href;
    new GLTFLoader().load(file,gltf=>{
      if(disposed){gltf.scene.traverse(node=>{if(node.isMesh){node.geometry.dispose();node.material.dispose();}});return;}
      gltf.scene.updateMatrixWorld(true);
      // GLTFLoader sanitizes slashes in node names ("dust/0" -> "dust0").
      const names=new Map(Object.entries(LIBRARY_FOOTFALL_FX).map(([kind,name])=>[
        THREE.PropertyBinding.sanitizeNodeName(name),kind]));
      gltf.scene.traverse(node=>{
        if(!node.isMesh||!names.has(node.name))return;
        const kind=names.get(node.name);
        const geometry=node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);
        const material=node.material.clone();
        material.transparent=true;material.opacity=kind==='sparks' ? .82 : .62;
        material.depthWrite=false;material.side=THREE.DoubleSide;
        const mesh=new THREE.InstancedMesh(geometry,material,EFFECT_LIMIT);
        mesh.name='LibraryCreatureFootfall_'+kind;mesh.count=0;
        mesh.visible=false;mesh.frustumCulled=false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        meshes.set(kind,mesh);scene.add(mesh);
      });
      // The InstancedMeshes own cloned resources; release loader temporaries.
      const originalGeometries=new Set(),originalMaterials=new Set();
      gltf.scene.traverse(node=>{if(node.isMesh){originalGeometries.add(node.geometry);
        for(const m of Array.isArray(node.material)?node.material:[node.material])originalMaterials.add(m);}});
      for(const geometry of originalGeometries)geometry.dispose();
      for(const material of originalMaterials)material.dispose();
      ready=meshes.has('dust')&&meshes.has('sand');
    },undefined,()=>{ready=false;});
  }
  function spawn(x,y,z,time,{kind='dust',scale=1,heading=0}={}){
    if(!ready||disposed||!meshes.has(kind)||!Number.isFinite(x+y+z+time))return false;
    if(camera){const dx=camera.position.x-x,dy=camera.position.y-y,dz=camera.position.z-z;
      if(dx*dx+dy*dy+dz*dz>55*55)return false;}
    if(pending.length>=EFFECT_LIMIT)pending.shift();
    pending.push({x,y,z,time,kind,scale,heading});
    return true;
  }
  function update(time){
    if(!ready||disposed)return;
    for(let i=pending.length-1;i>=0;i--)
      if(time-pending[i].time>MAX_AGE||time<pending[i].time)pending.splice(i,1);
    const counts=Object.fromEntries(meshes.keys().map(kind=>[kind,0]));
    for(const particle of pending){
      const mesh=meshes.get(particle.kind);
      if(!mesh)continue;
      const index=counts[particle.kind]++;
      const age=Math.max(0,Math.min(1,(time-particle.time)/MAX_AGE));
      scratch.position.set(particle.x,particle.y+age*.12*particle.scale,particle.z);
      scratch.rotation.set(0,particle.heading,0);
      const size=particle.scale*(1.35+1.2*Math.sin(Math.PI*Math.min(.93,age+.12)))*(1-.53*age);
      scratch.scale.setScalar(size);
      scratch.updateMatrix();mesh.setMatrixAt(index,scratch.matrix);
    }
    for(const [kind,mesh] of meshes){
      mesh.count=counts[kind];mesh.visible=mesh.count>0;
      if(mesh.count)mesh.instanceMatrix.needsUpdate=true;
    }
  }
  function dispose(){
    disposed=true;pending.length=0;
    for(const mesh of meshes.values()){
      scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
    }
    meshes.clear();
  }
  return {spawn,update,dispose,stats:()=>({ready,active:pending.length,loaded:meshes.size})};
}
