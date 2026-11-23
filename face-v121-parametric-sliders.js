/**
 * v121-only anatomical adjustment editor. Non-destructive: all offsets are
 * recalculated from captured neutral GLB vertex buffers on every input.
 * No effect on legacy v119/v120, males, battle, or static master GLB.
 */
const CONTROLS = Object.freeze([
  ['eyes','目','間隔','上下','大きさ'],
  ['nose','鼻','左右','上下','大きさ'],
  ['mouth','口','左右','上下','大きさ'],
  ['brows','眉','間隔','上下','大きさ']
]);
const AXES = ['x','y','size'];
const zeros=()=>Object.fromEntries(CONTROLS.map(([key])=>[
  key,{x:0,y:0,size:100}
]));
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
    const weight=kind==='mouth'?1:
      bell(x,0,.054)*bell(y,.198,.030)*front;
    apply(m,weight,0,.198,false);
  }
  if(kind==='skin'){
    // Additional adjustable center philtrum depth, from septum to upper lip.
    // Bounded to skin's forward-facing area and never a separate dark stripe.
    const f=fade(y,.207,.218)*(1-fade(y,.236,.247));
    dz-=state.philtrum*.00009*bell(x,0,.0075)*f*fade(z,.070,.123);
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
    if(/GLOBE_UV/.test(mesh.name)){
      eyeGlobes.push({mesh,position:mesh.position.clone(),scale:mesh.scale.clone()});
      return;
    }
    const name=mesh.name;
    const kind=mesh===face?'skin':
       /EYEBROW/.test(name)?'brows':
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
  function reset(){
    for(const input of inputs){input.value=input.dataset.axis==='size'?'100':'0';}
    const init=zeros();
    for(const [key,settings] of Object.entries(init))Object.assign(state[key],settings);
    state.philtrum=0;
    apply();
  }
  apply();
  return {
    state,
    reset,
    isChanged:()=>document.documentElement.dataset.v121Tuned==='true',
    values:()=>JSON.parse(JSON.stringify(state)),
    count:vertexCount
  };
}
