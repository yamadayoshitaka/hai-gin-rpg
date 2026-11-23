/**
 * v121-only anatomical adjustment editor. Non-destructive: all offsets are
 * recalculated from captured neutral GLB vertex buffers on every input.
 * No effect on legacy v119/v120, males, battle, or static master GLB.
 */
const CONTROLS = Object.freeze([
  ['eyes','目','間隔','上下','大きさ'],
  ['nose','鼻','左右','上下','大きさ'],
  ['mouth','口','左右','上下','大きさ'],
  ['brows','眉','間隔','上下','大きさ'],
  ['cheeks','頬','前後の厚み','高さ','ふくらみ'],
  ['chin','顎','左右幅','上下','丸み・大きさ']
]);
const AXES = ['x','y','size'];
const zeros=()=>Object.fromEntries(CONTROLS.map(([key])=>[
  key,{x:0,y:0,size:100}
]));
// Baseline uses the newly supplied 4-view bald female character sheet
// (front, 45 degrees, side and rear). These are manually calibrated,
// reversible morphological approximations, not an extracted 3D scan.
export const V121_REFERENCE_PRESET=Object.freeze({
  eyes:{x:-2,y:1,size:105},
  nose:{x:0,y:1,size:93},
  mouth:{x:0,y:1,size:108},
  brows:{x:-1,y:-5,size:104},
  cheeks:{x:1,y:0,size:102},
  chin:{x:0,y:1,size:100},
  philtrum:3
});
export const V121_REFERENCE_IMAGE='generated-natural-front-profile-reference-20261123';
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const fade=(x,lo,hi)=>{let t=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return t*t*(3-2*t)};
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const mirror=x=>x>=0?1:-1;

function transformPoint(x,y,z,state,kind){
  const e=state.eyes,n=state.nose,m=state.mouth,b=state.brows;
  const front=fade(z,.035,.115);
  const ax=Math.abs(x);
  let dx=0,dy=0,dz=0;
  const apply=(target,weight,cx,cy,symmetric)=>{
    const scale=target.size/100-1;
    dx+=weight*(target.x*.0008*(symmetric?mirror(x):1)+scale*(x-cx)*.84);
    dy+=weight*(target.y*.0008+scale*(y-cy)*.84);
  };
  if(kind==='eyes' || kind==='skin'){
    const weight=kind==='eyes'?1:
      bell(ax,.0415,.027)*bell(y,.310,.023)*front;
    apply(e,weight,mirror(x)*.0415,.310,true);
  }
  if(kind==='brows' || kind==='skin'){
    const weight=kind==='brows'?1:
      bell(ax,.041,.032)*bell(y,.352,.014)*front;
    apply(b,weight,mirror(x)*.041,.352,true);
  }
  if(kind==='nose' || kind==='skin'){
    const weight=kind==='nose'?1:
      bell(x,0,.040)*bell(y,.251,.040)*front;
    apply(n,weight,0,.251,false);
  }
  if(kind==='mouth' || kind==='skin'){
    // A mouth-size slider must not scale the jaw or pull the chin down:
    // the mouth mask is confined to the lips and fades before the menton.
    const weight=kind==='mouth'?1:
      (y>=.168?bell(x,0,.049)*bell(y,.232,.017)*front:0);
    apply(m,weight,0,.232,false);
  }
  if(kind==='skin'){
    // Smoothly modify cheek depth (especially side profile) and chin shape
    // without stretching the nose, lips or neck. Full strength stays inside
    // the malar / inferior-jaw region, tapering at every boundary.
    const cheek=bell(ax,.075,.032)*bell(y,.258,.039)*front;
    dz+=cheek*(state.cheeks.x*.00068+
               (state.cheeks.size-100)*.00012);
    dy+=cheek*state.cheeks.y*.00048;
    const chin=bell(ax,.037,.042)*bell(y,.157,.034)*fade(z,.035,.115);
    dx+=chin*((state.chin.size/100-1)*x*.78+
              mirror(x)*state.chin.x*.00030);
    dy+=chin*state.chin.y*.00058;
    // Additional adjustable center philtrum depth, from septum to upper lip.
    // Bounded to skin's forward-facing area and never a separate dark stripe.
    // Match the newly sculpted continuous nose-base-to-upper-lip path.
    // This must not create the previous circular hole at y≈.224.
    const f=fade(y,.235,.241)*(1-fade(y,.259,.267));
    dz-=state.philtrum*.00006*bell(x,0,.0057)*f*fade(z,.071,.116);
  }
  return [x+dx,y+dy,z+dz];
}

/**
 * @param {{neutral:THREE.Group, face:THREE.Mesh, three:typeof import('three'),
 *    onChange?:(change:boolean)=>void}} options
 */
export function attachV121FaceSliders({neutral,face,three,onChange=()=>{}}){
  if(!face||!neutral||face.geometry?.getAttribute('position')?.count!==13455)
    throw new Error('v121 anatomical sliders require the 13455-vertex neutral skin');
  const node=document.getElementById('v121-tune-sliders');
  if(!node)throw new Error('Missing v121 slider region');
  const state={...zeros(),philtrum:0};
  const data={};
  const vertexCount=face.geometry.getAttribute('position').count;
  const parts=[];
  const eyeGlobes=[];
  neutral.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry;
    const attribute=geometry?.getAttribute('position');
    if(!attribute)return;
    // Donor GLB node names may replace mesh names during GLTFLoader import.
    // The eye material is a reliable semantic identifier for both globes.
    if(/GLOBE_UV/.test(mesh.name)||
       /GLOBE_IRIS_PUPIL_UV/.test(mesh.material?.name||'')){
      eyeGlobes.push({mesh,position:mesh.position.clone(),scale:mesh.scale.clone()});
      return;
    }
    const name=mesh.name;
    const kind=mesh===face?'skin':
       /EYEBROW/.test(name)?'brows':
       /V121_ORAL_/.test(name)?'mouth':
       /EYELINER|LID_CREASE|EYELASHES/.test(name)?'eyes':null;
    if(!kind)return;
    parts.push({mesh,geometry,kind,base:new Float32Array(attribute.array)});
  });
  if(parts.length<6||eyeGlobes.length!==2)throw new Error('Missing GLB facial components');

  // The auto-generated DOM still uses explicit, labeled native range inputs
  // and is fully accessible to touch, keyboard and Playwright.
  node.innerHTML=CONTROLS.map(([key,title,horizontal,vertical,size])=>
    '<fieldset class="v121-tune-group" data-part="'+key+'"><legend>'+title+'</legend>'+
    [[ 'x',horizontal,-10,10,0],['y',vertical,-10,10,0],['size',size,80,120,100]]
     .map(([axis,label,min,max,value])=>
       '<label class="v121-slider-row"><span>'+label+
       '</span><input type="range" data-part="'+key+'" data-axis="'+axis+
       '" min="'+min+'" max="'+max+'" step="1" value="'+value+
       '" aria-label="'+title+' '+label+'"><output data-output="'+key+'-'+axis+
       '">'+(axis==='size'?'100%':'0')+'</output></label>').join('')+
    '</fieldset>').join('')+
    '<fieldset class="v121-tune-group"><legend>鼻の下（人中）</legend>'+
    '<label class="v121-slider-row"><span>溝の深さ</span>'+
    '<input type="range" data-part="philtrum" data-axis="depth" min="-50" max="50" step="1" value="0" aria-label="人中の溝の深さ">'+
    '<output data-output="philtrum-depth">0</output></label></fieldset>';
  const inputs=[...node.querySelectorAll('input[type="range"]')];
  const refreshLabels=()=>{
    inputs.forEach(input=>{
      const {part,axis}=input.dataset;
      const output=node.querySelector('[data-output="'+part+'-'+axis+'"]');
      if(output)output.textContent=axis==='size'?input.value+'%':
        (+input.value>0?'+':'')+input.value;
    });
  };
  function apply(){
    for(const item of parts){
      const position=item.geometry.getAttribute('position');
      const original=item.base;
      for(let i=0;i<original.length;i+=3){
        const v=transformPoint(original[i],original[i+1],original[i+2],
                               state,item.kind);
        position.array[i]=v[0];
        position.array[i+1]=v[1];
        position.array[i+2]=v[2];
      }
      position.needsUpdate=true;
      if(item.kind==='skin')item.geometry.computeVertexNormals();
      item.geometry.computeBoundingSphere();
      item.geometry.computeBoundingBox();
    }
    // Eye globe vertices are in their own local coordinates. Move/resize
    // both globe nodes together with the surrounding skin and liner.
    for(const {mesh,position,scale} of eyeGlobes){
      const sign=mirror(position.x);
      mesh.position.copy(position);
      mesh.position.x+=sign*state.eyes.x*.0008;
      mesh.position.y+=state.eyes.y*.0008;
      mesh.scale.copy(scale).multiplyScalar(state.eyes.size/100);
    }
    const changed=Object.values(state).some(v=>
      typeof v==='number'?v!==0:v.x!==0||v.y!==0||v.size!==100);
    document.documentElement.dataset.v121Tuned=changed?'true':'false';
    refreshLabels();
    onChange(changed);
  }
  const onInput=(input)=>{
    const {part,axis}=input.dataset;
    if(part==='philtrum')state.philtrum=Number(input.value);
    else if(state[part]&&AXES.includes(axis))state[part][axis]=Number(input.value);
    apply();
  };
  inputs.forEach(input=>input.addEventListener('input',()=>onInput(input)));
  function restore(values){
    for(const [key] of CONTROLS){
      const src=values[key]||{x:0,y:0,size:100};
      for(const axis of AXES){
        const input=inputs.find(i=>i.dataset.part===key&&i.dataset.axis===axis);
        if(!input)throw new Error('Missing '+key+' '+axis+' slider');
        const number=Number(src[axis]);
        input.value=String(clamp(number,Number(input.min),Number(input.max)));
        state[key][axis]=Number(input.value);
      }
    }
    const groove=inputs.find(i=>i.dataset.part==='philtrum');
    groove.value=String(clamp(Number(values.philtrum||0),
                             Number(groove.min),Number(groove.max)));
    state.philtrum=Number(groove.value);
    apply();
  }
  function reset(){restore({...zeros(),philtrum:0});}
  function applyReferencePreset(){restore(V121_REFERENCE_PRESET);}
  // A reference-like face is the requested default, yet the original,
  // untouched neutral master remains available with reset().
  applyReferencePreset();
  document.documentElement.dataset.v121Preset='reference';
  document.documentElement.dataset.v121Reference=V121_REFERENCE_IMAGE;
  return {
    state,
    reset,
    applyReferencePreset,
    isChanged:()=>document.documentElement.dataset.v121Tuned==='true',
    values:()=>JSON.parse(JSON.stringify(state)),
    count:vertexCount
  };
}
