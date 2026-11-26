// Three.js runtime helper for review models. Reject incompatible bind poses.
// Caller provides a GLTFLoader and URLs to the generated part package.
import * as THREE from 'three';
export async function createModularCharacter(loader, manifest, baseUrl){
  const core=manifest.parts.find(p=>p.kind==='core');
  if(!core)throw Error('missing body core');
  const url=p=>new URL(p.file,baseUrl).href;
  const body=await loader.loadAsync(url(core));const root=body.scene;
  root.updateMatrixWorld(true);
  const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
  if(!meshes.length)throw Error('core has no skin');
  const canonical=meshes[0].skeleton;const boneMap=new Map(canonical.bones.map((b,i)=>[b.name,{bone:b,inverse:canonical.boneInverses[i]}]));
  if(boneMap.size!==canonical.bones.length)throw Error('duplicate bone names');
  const active=new Map();
  async function add(id){
    if(active.has(id))return active.get(id);
    const p=manifest.parts.find(x=>x.id===id&&x.kind!=='core');
    if(!p||p.rigSignature!==manifest.rigSignature)throw Error('incompatible part');
    const g=await loader.loadAsync(url(p));g.scene.updateMatrixWorld(true);
    const pending=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)pending.push(o)});
    if(!pending.length)throw Error('part has no skin');
    for(const o of pending){
      const bones=o.skeleton.bones.map((b,i)=>{
        const q=boneMap.get(b.name);if(!q)throw Error('missing bone '+b.name);
        if(q.inverse.elements.some((x,k)=>Math.abs(x-o.skeleton.boneInverses[i].elements[k])>1e-5))throw Error('bind pose mismatch '+b.name);
        return q.bone;
      });
      const inverses=o.skeleton.boneInverses.map(x=>x.clone()),bind=o.bindMatrix.clone();
      root.attach(o);o.bind(new THREE.Skeleton(bones,inverses),bind);
    }
    active.set(id,pending);return pending;
  }
  function remove(id){const o=active.get(id);if(!o)return;for(const m of o)m.removeFromParent();active.delete(id);}
  async function equipRigid(id,overrideTransform){
    const p=manifest.rigidItems.find(x=>x.id===id);
    if(!p)throw Error('missing item');const s=manifest.sockets[p.socket],q=boneMap.get(s.bone);
    const t=overrideTransform||p.localTransform;if(!t)throw Error('item needs calibrated local transform');
    const g=await loader.loadAsync(url(p));remove(id);q.bone.add(g.scene);
    g.scene.position.fromArray(t.position);g.scene.quaternion.fromArray(t.quaternion);g.scene.scale.fromArray(t.scale||[1,1,1]);
    active.set(id,[g.scene]);return g.scene;
  }
  return {root,animations:body.animations,add,remove,equipRigid,active,manifest};
}
