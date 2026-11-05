/**
 * Rendering-only LOD for individually rigged soldiers. Never changes combat
 * state, collision or the authoritative AI simulation for off-screen units.
 */
export function createBattleActorVisibility(THREE,camera){
  const frustum=new THREE.Frustum();
  const projection=new THREE.Matrix4();
  const bounds=new THREE.Sphere(new THREE.Vector3(),2.4);
  const states=new WeakMap();
  let frameTime=0,visible=0,culled=0,throttled=0;
  function beginFrame(now){
    frameTime=now;visible=0;culled=0;throttled=0;
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
  }
  function sample(actor){
    let state=states.get(actor);
    if(!state){state={lastUpdate:frameTime,shadowEnabled:null};states.set(actor,state)}
    bounds.center.set(actor.root.position.x,actor.root.position.y+1.05,actor.root.position.z);
    const inFrame=frustum.intersectsSphere(bounds);
    actor.root.visible=inFrame;
    if(!inFrame){culled++;return {visible:false,update:false,delta:0}}
    visible++;
    const distance=camera.position.distanceTo(bounds.center);
    const tier=distance<28?0:distance<75?1:2;
    // Small distant soldiers retain their exact body/armour geometry, but use
    // 20/10 Hz animation and omit expensive dynamic shadow casters.
    const interval=tier===0?0:tier===1?1/20:1/10;
    const shadowEnabled=tier===0;
    if(state.shadowEnabled!==shadowEnabled){
      actor.model?.traverse(part=>{if(part.isMesh||part.isSkinnedMesh)part.castShadow=shadowEnabled});
      state.shadowEnabled=shadowEnabled;
    }
    const delta=frameTime-state.lastUpdate;
    if(interval>0&&delta<interval){throttled++;return {visible:true,update:false,delta:0}}
    state.lastUpdate=frameTime;
    return {visible:true,update:true,delta:Math.min(Math.max(0,delta),.25)};
  }
  return {beginFrame,sample,get stats(){return {visible,culled,throttled}}};
}
