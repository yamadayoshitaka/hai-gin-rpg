// 通常のゲームワールドに大軍を描くための共有ジオメトリ＋InstancedMesh。
// 近景の詳細GLTFキャラクターは game 側で描画し、ここでは重複表示しない。
export function createMassBattleGameLOD(THREE, scene, simulation, options) {
  const { jobs, getWorldPosition, isDetailed } = options;
  const count = simulation.units.length;
  const material = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,metalness:.08});
  const geometry = {
    torso:new THREE.CylinderGeometry(.39,.32,.83,6),
    head:new THREE.SphereGeometry(.26,7,5),
    limbs:new THREE.CylinderGeometry(.105,.11,.7,5),
    helmet:new THREE.SphereGeometry(.31,7,4,0,Math.PI*2,0,Math.PI/1.9),
    weapon:new THREE.BoxGeometry(.12,1.02,.12),
    shield:new THREE.BoxGeometry(.49,.67,.11),
    cloak:new THREE.BoxGeometry(.68,.86,.11)
  };
  function create(key,instances) {
    const obj=new THREE.InstancedMesh(geometry[key],material,instances);
    obj.frustumCulled=false;
    obj.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    obj.castShadow=false;obj.receiveShadow=false;
    scene.add(obj);
    return obj;
  }
  const meshes={
    torso:create('torso',count),head:create('head',count),
    arms:create('limbs',count*2),legs:create('limbs',count*2),
    helmet:create('helmet',count),weapon:create('weapon',count),
    shield:create('shield',count),cloak:create('cloak',count)
  };
  const skin=new THREE.Color(0xd9ae90),metal=new THREE.Color(0xaab4be);
  const blue=new THREE.Color(0x5d93df),red=new THREE.Color(0xc85e54);
  const scratchColor=new THREE.Color();
  for(const u of simulation.units){
    const job=jobs[u.jobIndex],teamColor=u.team===0?blue:red;
    const chest=scratchColor.setHex(job.color).clone().lerp(teamColor,.23);
    meshes.torso.setColorAt(u.id,chest);
    meshes.head.setColorAt(u.id,skin);
    meshes.helmet.setColorAt(u.id,metal);
    meshes.weapon.setColorAt(u.id,job.weapon==='staff'?new THREE.Color(0x967047):metal);
    meshes.shield.setColorAt(u.id,metal);
    meshes.cloak.setColorAt(u.id,chest.clone().multiplyScalar(.65));
    for(let limb=0;limb<2;limb++){
      meshes.arms.setColorAt(u.id*2+limb,chest);
      meshes.legs.setColorAt(u.id*2+limb,teamColor);
    }
  }
  Object.values(meshes).forEach(obj=>{if(obj.instanceColor)obj.instanceColor.needsUpdate=true});
  const mat=new THREE.Matrix4(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),rot=new THREE.Quaternion();
  const noRotation=new THREE.Quaternion();
  const up=new THREE.Vector3(0,1,0);
  function pose(obj,index,x,y,z,sx=1,sy=1,sz=1,yaw=0){
    pos.set(x,y,z);scale.set(sx,sy,sz);
    if(yaw)rot.setFromAxisAngle(up,yaw);else rot.copy(noRotation);
    mat.compose(pos,rot,scale);obj.setMatrixAt(index,mat);
  }
  const world={x:0,y:0,z:0};
  function update(){
    for(const u of simulation.units){
      const i=u.id,hidden=!u.alive||isDetailed(u);
      if(hidden){
        for(const [name,obj] of Object.entries(meshes)){
          const count=(name==='arms'||name==='legs')?2:1;
          for(let k=0;k<count;k++)pose(obj,i*count+k,0,-100,0,0,0,0);
        }
        continue;
      }
      getWorldPosition(u,world);
      const {x,y,z}=world,job=jobs[u.jobIndex];
      const motion=u.action==='walk'?Math.sin(u.phase)*.16:0;
      const armoured=['sword','shield','lancer'].includes(job.id);
      const robed=['mage','priest','summoner'].includes(job.id);
      const yaw=u.team===0?Math.PI/2:-Math.PI/2;
      pose(meshes.torso,i,x,y+1.10,z,1,1,1,yaw);
      pose(meshes.head,i,x,y+1.77,z,1,1,1,yaw);
      pose(meshes.helmet,i,x,y+1.83,z,armoured?1:0,armoured?1:0,armoured?1:0,yaw);
      pose(meshes.arms,i*2,x-.44,y+1.05+motion,z);
      pose(meshes.arms,i*2+1,x+.44,y+1.05-motion,z);
      pose(meshes.legs,i*2,x-.21,y+.34+motion,z);
      pose(meshes.legs,i*2+1,x+.21,y+.34-motion,z);
      pose(meshes.weapon,i,x+.55,y+1.12,z,job.weapon==='fist'?0:1,job.weapon==='fist'?0:job.weapon==='spear'?1.5:1,1);
      pose(meshes.shield,i,x-.58,y+1.15,z,job.weapon==='shield'?1:0,job.weapon==='shield'?1:0,job.weapon==='shield'?1:0);
      pose(meshes.cloak,i,x,y+.95,z-.28,robed?1:0,robed?1:0,robed?1:0);
    }
    for(const obj of Object.values(meshes))obj.instanceMatrix.needsUpdate=true;
  }
  function dispose(){
    for(const obj of Object.values(meshes)){scene.remove(obj);obj.dispose()}
    Object.values(geometry).forEach(g=>g.dispose());material.dispose();
  }
  update();
  return {update,dispose,drawMeshes:8};
}
