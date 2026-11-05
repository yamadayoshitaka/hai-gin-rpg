import * as THREE from 'three';

// The distant battle model is a render of the SAME live, dressed character
// used in the 50v50 battle. Rendering a reconstructed mesh list previously
// lost skin/garment transforms while still passing vertex-count assertions.
const TILE=192;
const GRID=4;
const VIEWS=[[0,1],[1,0],[0,-1],[-1,0]];

function createImpostorMaterial(map){
  const material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,transparent:false,
    alphaTest:.12,depthWrite:true,depthTest:true,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`attribute float crowdDirection;\nattribute float crowdPhase;\nattribute float crowdAction;\nvarying vec2 crowdNextUv;\nvarying float crowdWalkBlend;\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`
      #include <uv_vertex>
      #ifdef USE_MAP
        float walking=step(0.5,crowdAction)*(1.0-step(1.5,crowdAction));
        float striking=step(1.5,crowdAction)*(1.0-step(2.5,crowdAction));
        float row=striking>0.5?3.0:(walking>0.5?1.0:0.0);
        vec2 uv=vMapUv;
        vMapUv=(uv+vec2(crowdDirection,row))*0.25;
        crowdNextUv=(uv+vec2(crowdDirection,walking>0.5?2.0:row))*0.25;
        crowdWalkBlend=walking*(0.5+0.5*sin(crowdPhase));
      #endif
    `);
    shader.fragmentShader=`varying vec2 crowdNextUv;\nvarying float crowdWalkBlend;\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec4 firstFrame=texture2D(map,vMapUv);
        vec4 nextFrame=texture2D(map,crowdNextUv);
        diffuseColor *= mix(firstFrame,nextFrame,crowdWalkBlend);
      #endif
    `);
  };
  material.customProgramCacheKey=()=> 'live-rig-character-impostor-v3';
  return material;
}

function verifyAtlasSilhouette(renderer,target){
  const rgba=new Uint8Array(TILE*TILE*4);
  renderer.readRenderTargetPixels(target,0,0,TILE,TILE,rgba);
  let pixels=0,minX=TILE,minY=TILE,maxX=-1,maxY=-1;
  for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
    if(rgba[(y*TILE+x)*4+3]<30)continue;
    pixels++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  // A valid atlas needs visible head-to-foot coverage. This catches an
  // entirely transparent/unrendered model, not just an allocated texture.
  if(pixels<120||maxX-minX<12||maxY-minY<45)
    throw Error(`人体撮影LODが空・欠損: ${pixels}px, ${maxX-minX}x${maxY-minY}`);
  return {opaquePixels:pixels,width:maxX-minX+1,height:maxY-minY+1};
}

export async function captureCrowdImpostorAtlas(renderer,actor){
  if(!renderer||!actor?.character?.object3D||!actor.outfit)return null;
  const target=new THREE.WebGLRenderTarget(TILE*GRID,TILE*GRID,{
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
    format:THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false
  });
  target.texture.colorSpace=THREE.SRGBColorSpace;
  target.texture.name='Original live-rig body, clothing, hair and weapon atlas';
  const preview=new THREE.Scene();
  preview.background=null;
  preview.add(new THREE.AmbientLight(0xffffff,1.05));
  const key=new THREE.DirectionalLight(0xffffff,2.1);key.position.set(-3,6,5);preview.add(key);
  const fill=new THREE.DirectionalLight(0xc2d9ff,.8);fill.position.set(3,3,-4);preview.add(fill);
  const camera=new THREE.OrthographicCamera(-1.55,1.55,1.55,-1.55,.1,12);
  const person=actor.character.object3D;
  const parent=person.parent;
  if(!parent){target.dispose();throw Error('人体の親ノードがありません');}
  const previousVisible=person.visible;
  const oldPosition=person.position.clone(),oldQuaternion=person.quaternion.clone(),oldScale=person.scale.clone();
  const lodStates=[];
  person.traverse(node=>{
    if(!node.isLOD||!node.levels?.length)return;
    lodStates.push({node,autoUpdate:node.autoUpdate,visible:node.levels.map(level=>level.object.visible)});
    node.autoUpdate=false;
    node.levels.forEach((level,i)=>{level.object.visible=i===0;});
  });
  const previousTarget=renderer.getRenderTarget();
  const previousViewport=renderer.getViewport(new THREE.Vector4());
  const previousScissor=renderer.getScissor(new THREE.Vector4());
  const previousScissorTest=renderer.getScissorTest();
  const previousClearColor=renderer.getClearColor(new THREE.Color());
  const previousClearAlpha=renderer.getClearAlpha();
  const locomotion=actor.job.speed>=3.2?'run':'walk';
  const attack=['魔法使い','僧侶','召喚士'].includes(actor.job.name)?'skill':'attack';
  const poses=[['idle',.01], [locomotion,.18], [locomotion,.55], [attack,.27]];
  let audit;
  try{
    // Move ONLY the representative live rig temporarily into an isolated
    // studio scene; never re-skin or reassemble its triangles for the photo.
    preview.add(person);
    person.position.set(0,0,0);person.quaternion.identity();person.scale.set(1,1,1);
    person.visible=true;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000,0);
    renderer.setScissorTest(true);
    for(let row=0;row<poses.length;row++){
      const [state,delta]=poses[row];
      let played=await actor.character.play(state);
      if(!played&&state==='skill')played=await actor.character.play('attack');
      if(!played&&state==='run')played=await actor.character.play('walk');
      if(!played&&state==='walk')played=await actor.character.play('run');
      if(!played)throw Error(`${actor.job.name}: 実モデルの${state}モーションを撮影できません`);
      actor.character.update(delta);
      actor.outfit.sync();person.updateMatrixWorld(true);
      for(let column=0;column<VIEWS.length;column++){
        const [x,z]=VIEWS[column];
        camera.position.set(x*5,1.35,z*5);camera.lookAt(0,.95,0);camera.updateMatrixWorld();
        const left=column*TILE,bottom=row*TILE;
        renderer.setViewport(left,bottom,TILE,TILE);
        renderer.setScissor(left,bottom,TILE,TILE);
        renderer.clear(true,true,true);
        renderer.render(preview,camera);
      }
    }
    audit=verifyAtlasSilhouette(renderer,target);
  }catch(error){target.dispose();throw error;}
  finally{
    parent.add(person);
    person.position.copy(oldPosition);person.quaternion.copy(oldQuaternion);person.scale.copy(oldScale);
    person.visible=previousVisible;
    for(const state of lodStates){
      state.node.autoUpdate=state.autoUpdate;
      state.node.levels.forEach((level,i)=>{level.object.visible=state.visible[i];});
    }
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.setClearColor(previousClearColor,previousClearAlpha);
    await actor.character.play('idle');actor.character.update(.01);actor.outfit.sync();
  }
  return {target,material:createImpostorMaterial(target.texture),audit};
}
