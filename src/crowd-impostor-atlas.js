import * as THREE from 'three';

// The distant battle model is a render of the SAME live, dressed character
// used in the 50v50 battle. Rendering a reconstructed mesh list previously
// lost skin/garment transforms while still passing vertex-count assertions.
const TILE=192;
const GRID=4;
const RUN_FRAMES=4,ROWS=RUN_FRAMES+2;
const VIEWS=[[0,1],[1,0],[0,-1],[-1,0]];

function createImpostorMaterial(map){
  const material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,transparent:false,
    alphaTest:.12,depthWrite:true,depthTest:true,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`attribute float crowdDirection;\nattribute float crowdPhase;\nattribute float crowdAction;\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`
      #include <uv_vertex>
      #ifdef USE_MAP
        float walking=step(0.5,crowdAction)*(1.0-step(1.5,crowdAction));
        float striking=step(1.5,crowdAction)*(1.0-step(2.5,crowdAction));
        // Four REAL consecutive dash samples captured from the actual
        // 65-bone run clip. Two steps per loop, all four phases continuous.
        float phase=mod(crowdPhase,6.2831853);
        float runRow=1.0+min(3.0,floor(phase*0.63661977));
        float row=striking>0.5?5.0:(walking>0.5?runRow:0.0);
        vMapUv=(vMapUv+vec2(crowdDirection,row))*vec2(0.25,0.166666667);
      #endif
    `);
    // One atlas sample per pixel. No ghosted double-silhouette crossfades
    // and no additional draw calls even with four true animation frames.
  };
  material.customProgramCacheKey=()=> 'live-rig-character-impostor-v5-four-dash-frames';
  return material;
}

function verifyAtlasSilhouette(renderer,target,tileSize=TILE){
  const rgba=new Uint8Array(tileSize*tileSize*4);
  renderer.readRenderTargetPixels(target,0,0,tileSize,tileSize,rgba);
  let pixels=0,minX=tileSize,minY=tileSize,maxX=-1,maxY=-1;
  for(let y=0;y<tileSize;y++)for(let x=0;x<tileSize;x++){
    if(rgba[(y*tileSize+x)*4+3]<30)continue;
    pixels++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  // A valid atlas needs visible head-to-foot coverage. This catches an
  // entirely transparent/unrendered model, not just an allocated texture.
  if(pixels<Math.round(120*(tileSize/192)**2)||maxX-minX<tileSize*.063||maxY-minY<tileSize*.234)
    throw Error(`人体撮影LODが空・欠損: ${pixels}px, ${maxX-minX}x${maxY-minY}`);
  return {opaquePixels:pixels,width:maxX-minX+1,height:maxY-minY+1};
}

export async function captureCrowdImpostorAtlas(renderer,actor,{tileSize=TILE}={}){
  if(!renderer||!actor?.character?.object3D||!actor.outfit)return null;
  const target=new THREE.WebGLRenderTarget(tileSize*GRID,tileSize*ROWS,{
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
  const locomotion='run'; // Every battle job uses the dash clip, not slow walking.
  const attack=['魔法使い','僧侶','召喚士'].includes(actor.job.name)?'skill':'attack';
  const poses=[['idle',.01],...Array.from({length:RUN_FRAMES},()=>[locomotion,.016]),[attack,.27]];
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
      if(state==='run'){
        const clip=actor.character.diagnostics?.()?.clip??'';
        // v4.6.33 supplies real Running_* to every job. A running atlas
        // captured from Walking_A/idle makes thousands of soldiers skate.
        // Reject it and let the real 3D GPU mesh render instead.
        if(!played||!/^Running(?:_|$)/.test(clip))
          throw Error(`${actor.job.name}: RUNの実モーションではありません (${clip||'none'})`);
      }
      // A priest or summoner may have no independent skill clip. Non-run
      // gestures may use the recorded idle portrait; RUN may NEVER do so.
      if(!played&&state!=='idle')played=await actor.character.play('idle');
      if(!played)throw Error(`${actor.job.name}: 実モデルの${state}モーションを撮影できません`);
      // Match GPU's two genuine left/right footfall samples. The old atlas
      // advanced arbitrary clip seconds (.18/.55), so the distant 1000-person
      // formation visibly skated while the root moved by travelled tiles.
      // Independent real frames at 0°,90°,180°,270° of the dash cycle.
      actor.character.syncLocomotionPhase(row>=1&&row<=RUN_FRAMES?
        (row-1)*Math.PI*.5:null);
      actor.character.update(row>=1&&row<=RUN_FRAMES?0.016:delta);
      actor.outfit.sync();person.updateMatrixWorld(true);
      for(let column=0;column<VIEWS.length;column++){
        const [x,z]=VIEWS[column];
        camera.position.set(x*5,1.35,z*5);camera.lookAt(0,.95,0);camera.updateMatrixWorld();
        const left=column*tileSize,bottom=row*tileSize;
        renderer.setViewport(left,bottom,tileSize,tileSize);
        renderer.setScissor(left,bottom,tileSize,tileSize);
        renderer.clear(true,true,true);
        renderer.render(preview,camera);
      }
    }
    audit=verifyAtlasSilhouette(renderer,target,tileSize);
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
    actor.character.syncLocomotionPhase(null);
    await actor.character.play('idle');actor.character.update(.01);actor.outfit.sync();
  }
  return {target,material:createImpostorMaterial(target.texture),audit};
}
