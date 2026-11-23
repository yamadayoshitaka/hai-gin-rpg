/** v121 expression playback: drives native GLB morphs, no 2D face swapping. */
export const V121_EXPRESSIONS=[
  'blink','smile','laugh','angry','sad','mouthOpen',
  'vowelA','vowelI','vowelU','vowelE','vowelO'
];

export function attachV121Expressions({neutral,faceTune,onChange=()=>{}}){
  const meshes=[];
  const eyeballs=[];
  neutral.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(mesh.morphTargetInfluences?.length===V121_EXPRESSIONS.length &&
       V121_EXPRESSIONS.every(n=>Number.isInteger(mesh.morphTargetDictionary?.[n]))){
      meshes.push(mesh);
    }
    if(/GLOBE_UV/.test(mesh.name)||
       /GLOBE_IRIS_PUPIL_UV/.test(mesh.material?.name||'')){
      eyeballs.push({mesh,baseScale:mesh.scale.clone()});
    }
  });
  // The cavity now has two GLB primitives: the dark interior and a real
  // detachable rest-pose skin seal. GLTFLoader exposes each as one mesh.
  if(meshes.length!==11||eyeballs.length!==2)
    throw Error('v121 expressive GLB must have 11 morphable primitives including the new lower face and oral seal, and 2 intact globes');
  const current=Object.fromEntries(V121_EXPRESSIONS.map(n=>[n,0]));
  let mode='neutral',modeSince=performance.now(),last=performance.now();
  const segment=[
    ['neutral',.65],['smile',1.25],['laugh',1.4],['neutral',.6],
    ['angry',1.2],['sad',1.2],['neutral',.55],
    ['mouthOpen',.8],['vowelA',.52],['vowelI',.52],['vowelU',.52],
    ['vowelE',.52],['vowelO',.52],['neutral',.6]
  ];
  const total=segment.reduce((sum,x)=>sum+x[1],0);
  function setMode(next){
    if(!['neutral','blink','smile','laugh','angry','sad',
          'mouthOpen','talk','loop','vowelA','vowelI','vowelU','vowelE','vowelO'].includes(next))throw Error(next);
    mode=next;modeSince=performance.now();
    document.documentElement.dataset.v121ExpressionMode=mode;
    onChange(mode);
  }
  function loopMode(t){
    let v=((t-modeSince)/1000)%total;
    for(const [name,seconds] of segment){
      if(v<seconds)return name;
      v-=seconds;
    }
    return 'neutral';
  }
  function tick(now=performance.now()){
    const dt=Math.min(.1,Math.max(.001,(now-last)/1000));
    last=now;
    const t=(now-modeSince)/1000;
    const selected=mode==='loop'?loopMode(now):mode;
    const goal=Object.fromEntries(V121_EXPRESSIONS.map(n=>[n,0]));
    if(selected==='talk'){
      const vowel=['vowelA','vowelI','vowelU','vowelE','vowelO'][Math.floor(t*2.5)%5];
      goal[vowel]=.88;
    }else if(selected==='blink'){
      goal.blink=Math.max(0,Math.sin(Math.PI*Math.min(1,t/.75)));
      if(t>.75){mode='neutral';document.documentElement.dataset.v121ExpressionMode=mode;}
    }else if(selected!=='neutral'&&goal[selected]!==undefined){
      goal[selected]=1;
    }
    if(mode==='loop' && ((now-modeSince)/1000%3.8)<.32)
      goal.blink=Math.max(goal.blink,Math.sin(Math.PI*((now-modeSince)/1000%3.8)/.32)*.95);
    const alpha=1-Math.exp(-dt*11);
    for(const name of V121_EXPRESSIONS)
      current[name]+=(goal[name]-current[name])*alpha;
    for(const mesh of meshes)
      for(const name of V121_EXPRESSIONS)
        mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]]=current[name];
    // Shrink sclera only as the skin + eyelid lashes close. Slider scale is
    // respected, rather than overwriting the user's calibrated eye size.
    for(const {mesh,baseScale} of eyeballs){
      mesh.scale.y=baseScale.y*(faceTune.state.eyes.size/
        (100*(1.08)))*(1-.97*current.blink);
    }
  }
  setMode('neutral');
  return {setMode,tick,mode:()=>mode,meshes:meshes.length,
          weights:()=>({...current})};
}
