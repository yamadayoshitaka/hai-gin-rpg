/**
 * Rendering-only LOD for individually rigged soldiers. Never changes combat
 * state, collision or the authoritative AI simulation for off-screen units.
 */
export function createBattleActorVisibility(THREE,camera){
  const frustum=new THREE.Frustum();
  const projection=new THREE.Matrix4();
  const bounds=new THREE.Sphere(new THREE.Vector3(),3.0);
  const cameraForward=new THREE.Vector3();
  let hasCameraForward=false;
  const states=new WeakMap();
  let frameTime=0,visible=0,culled=0,throttled=0;
  function beginFrame(now){
    frameTime=now;visible=0;culled=0;throttled=0;
    camera.updateMatrixWorld();
    hasCameraForward=typeof camera.getWorldDirection==='function';
    if(hasCameraForward)camera.getWorldDirection(cameraForward);
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
  }
  function sample(actor){
    let state=states.get(actor);
    if(!state){state={lastUpdate:frameTime,shadowEnabled:null,result:{visible:false,update:false,delta:0}};states.set(actor,state)}
    const result=state.result;
    bounds.center.set(actor.root.position.x,actor.root.position.y+1.05,actor.root.position.z);
    // Never lose an inspectable full-size human because the root-only
    // frustum probe barely clips the near plane during a camera zoom.
    const distance=camera.position.distanceTo(bounds.center);
    // A near-plane exception applies only to bodies genuinely IN FRONT of
    // the camera. Offscreen soldiers behind the player must remain culled.
    const inFront=hasCameraForward&&
      ((bounds.center.x-camera.position.x)*cameraForward.x+
       (bounds.center.y-camera.position.y)*cameraForward.y+
       (bounds.center.z-camera.position.z)*cameraForward.z)>0.15;
    const inFrame=frustum.intersectsSphere(bounds)||(distance<14&&inFront);
    actor.root.visible=inFrame;
    if(inFrame&&actor.hp>0&&!actor.crowdSampling&&actor.character?.object3D&&
       !actor.character.object3D.visible)actor.character.object3D.visible=true;
    if(!inFrame){culled++;result.visible=false;result.update=false;result.delta=0;return result}
    visible++;
    const tier=distance<28?0:distance<75?1:2;
    // Previously every moving soldier past 75m had their feet updated only
    // ten times per second while the body root interpolated every frame.
    // Keep idle soldiers at 10/20 Hz, but visible moving/striking bodies
    // require a 24/30 Hz motion budget to avoid sliding and T-pose holds.
    const moving=Boolean(actor.nextCell||actor.poseMoving||
      actor.massAnimation?.moving||(actor.attackPoseUntil>actor.battleTime));
    const interval=tier===0?0:moving?(tier===1?1/30:1/24):
      tier===1?1/20:1/10;
    const shadowEnabled=tier===0;
    if(state.shadowEnabled!==shadowEnabled){
      actor.model?.traverse(part=>{if(part.isMesh||part.isSkinnedMesh)part.castShadow=shadowEnabled});
      state.shadowEnabled=shadowEnabled;
    }
    const delta=frameTime-state.lastUpdate;
    if(interval>0&&delta<interval){throttled++;result.visible=true;result.update=false;result.delta=0;return result}
    state.lastUpdate=frameTime;
    result.visible=true;result.update=true;result.delta=Math.min(Math.max(0,delta),.25);return result;
  }
  return {beginFrame,sample,get stats(){return {visible,culled,throttled}}};
}
