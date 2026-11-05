import * as THREE from 'three';

// A far soldier is NOT a procedural/low-poly replacement: these atlas frames
// are rendered once from the full real human, fitted costume, hair and weapon
// in four directions and four motion states. Small characters then cost only
// one textured quad instead of tens of thousands of shaded/skinned vertices.
const TILE=128;
const GRID=4;
const VIEWS=[[0,1],[1,0],[0,-1],[-1,0]];
const POSES=['position','crowdWalkA','crowdWalkB','crowdAttack'];

function stillMaterial(part){
  const clone=material=>{
    const result=material.clone();
    result.onBeforeCompile=()=>{};
    result.customProgramCacheKey=()=> 'crowd-capture-static-v1';
    result.side=THREE.DoubleSide;
    if(part.isHumanBody){
      result.visible=true;result.opacity=1;result.transparent=false;
      result.alphaTest=0;result.alphaMap=null;result.depthWrite=true;
    }
    return result;
  };
  return Array.isArray(part.material)?part.material.map(clone):clone(part.material);
}

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
        float row=striking>0.5?3.0:(walking>0.5?(sin(crowdPhase)>0.0?2.0:1.0):0.0);
        vMapUv=(vMapUv+vec2(crowdDirection,row))*0.25;
      #endif
    `);
  };
  material.customProgramCacheKey=()=> 'real-character-impostor-v1';
  return material;
}

export function captureCrowdImpostorAtlas(renderer,parts){
  if(!renderer||!parts?.length)return null;
  const target=new THREE.WebGLRenderTarget(TILE*GRID,TILE*GRID,{
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
    format:THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false
  });
  target.texture.colorSpace=THREE.SRGBColorSpace;
  target.texture.name='Full-body crowd LOD atlas';
  const preview=new THREE.Scene();
  preview.background=null;
  preview.add(new THREE.AmbientLight(0xffffff,.85));
  const mainLight=new THREE.DirectionalLight(0xffffff,2.0);
  mainLight.position.set(-3,6,5);preview.add(mainLight);
  const fill=new THREE.DirectionalLight(0xb6cfff,.65);
  fill.position.set(3,3,-4);preview.add(fill);
  const camera=new THREE.OrthographicCamera(-1.55,1.55,1.55,-1.55,.1,12);
  const meshes=[];
  for(const part of parts){
    const geometry=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv','uv1','uv2','color','tangent']){
      const attribute=part.geometry.getAttribute(name);
      if(attribute)geometry.setAttribute(name,attribute);
    }
    geometry.setIndex(part.geometry.getIndex());
    for(const group of part.geometry.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
    const mesh=new THREE.Mesh(geometry,stillMaterial(part));
    mesh.frustumCulled=false;
    preview.add(mesh);meshes.push({mesh,source:part.geometry});
  }
  const previousTarget=renderer.getRenderTarget();
  const previousViewport=renderer.getViewport(new THREE.Vector4());
  const previousScissor=renderer.getScissor(new THREE.Vector4());
  const previousScissorTest=renderer.getScissorTest();
  const previousClearColor=renderer.getClearColor(new THREE.Color());
  const previousClearAlpha=renderer.getClearAlpha();
  try{
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000,0);
    renderer.setScissorTest(true);
    for(let row=0;row<POSES.length;row++){
      for(const {mesh,source} of meshes){
        mesh.geometry.setAttribute('position',source.getAttribute(POSES[row])||source.getAttribute('position'));
      }
      for(let column=0;column<VIEWS.length;column++){
        const [x,z]=VIEWS[column];
        camera.position.set(x*5,1.35,z*5);
        camera.lookAt(0,.95,0);camera.updateMatrixWorld();
        const left=column*TILE,bottom=row*TILE;
        renderer.setViewport(left,bottom,TILE,TILE);
        renderer.setScissor(left,bottom,TILE,TILE);
        renderer.clear(true,true,true);
        renderer.render(preview,camera);
      }
    }
  }catch(error){
    target.dispose();throw error;
  }finally{
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.setClearColor(previousClearColor,previousClearAlpha);
    for(const {mesh} of meshes){
      mesh.geometry.dispose();
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      materials.forEach(material=>material.dispose());
    }
  }
  return {target,material:createImpostorMaterial(target.texture)};
}
