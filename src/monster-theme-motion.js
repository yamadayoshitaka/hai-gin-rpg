/**
 * Family-specific authored motion overlays, after the underlying approved
 * idle/walk/run/attack/guard/roar/leap clip. No GPU allocation or geometry
 * change occurs during update. 50 species retain their original rig.
 */
export const MONSTER_THEME_MOTION_REVISION='50-theme-bone-poses-v1-20261121';
const PI=Math.PI;
const wave=p=>Math.sin(PI*Math.max(0,Math.min(1,p)));
const flex=(p,a,b,c)=>{
 const smooth=(x,y)=>{const v=Math.max(0,Math.min(1,(p-x)/(y-x)));return v*v*(3-2*v);};
 return smooth(a,b)*(1-smooth(b,c));
};
const add=(p,key,axis,amount)=>{
 const joint=p?.[key];if(joint?.rotation)joint.rotation[axis]+=amount;
};
function all(p,prefix,axis,amount){
 for(const [key,joint] of Object.entries(p||{}))
  if(key.toLowerCase().startsWith(prefix)&&joint?.rotation)
   joint.rotation[axis]+=amount;
}
const styles=Object.freeze({
 scent:'scent',pounce:'pounce',bite:'bite',howl:'howl',
 stalk:'stalk',claw:'claw',glide:'glide',wing:'wing',
 dive:'dive',bank:'bank',brace:'brace',tail:'tail',
 breath:'breath',charge:'charge',skitter:'skitter',
 web:'web',rise:'rise',cast:'cast',drain:'drain',
 stomp:'stomp',slam:'slam',grasp:'grasp',coil:'coil',
 signature:'signature',
});
/** Mild root and distinct moving pivots for non-humanoid, no new objects. */
export function applyMonsterThemeMotion(model,{tech,progress=0,time=0}={}){
 if(!model||!tech)return false;
 const p=model.userData?.pivots||{};
 const t=Math.max(0,Math.min(1,progress));
 const anticipation=flex(t,.02,.22,.43);
 const impact=flex(t,.29,.51,.81);
 const w=wave(t);
 const looping=!Number.isFinite(tech.duration);
 const breath=looping?.5+.5*Math.sin(time*1.7):w;
 const pose=tech.pose==='signature'?
  ({beast:'howl',feline:'claw',avian:'wing',reptile:'breath',
    insect:'charge',arachnid:'web',undead:'cast',golem:'slam',
    fiend:'cast',aquatic:'grasp'}[model.userData?.surfaceFamily]||'cast'):
  tech.pose;
 if(!styles[pose])return false;
 model.userData.themeAction=tech.id;
 model.userData.themePose=pose;
 model.userData.themeQualityRevision=MONSTER_THEME_MOTION_REVISION;
 switch(pose){
  case 'scent':
   add(p,'head','x',-.10*breath);add(p,'head','y',.10*Math.sin(time*1.1));
   add(p,'jaw','x',.08*breath);break;
  case 'stalk':
   add(p,'torso','x',.10);add(p,'head','x',-.09);
   all(p,'leg','x',.085*Math.sin(time*2.5));break;
  case 'pounce':
   add(p,'torso','x',.28*anticipation-.38*impact);
   add(p,'head','x',-.13*impact);
   all(p,'leg','x',-.20*anticipation+.30*impact);break;
  case 'bite':
   add(p,'head','x',-.21*impact);
   add(p,'jaw','x',.28*anticipation+.52*impact);
   all(p,'legfront','x',-.13*impact);break;
  case 'howl':
   add(p,'head','x',-.30*w);
   add(p,'jaw','x',.62*w);
   add(p,'torso','x',-.13*w);break;
  case 'claw':
   all(p,'arm','x',-.37*impact);
   add(p,'head','y',.13*impact);
   add(p,'torso','z',.11*w);break;
  case 'glide':
   all(p,'wing','z',.06*Math.sin(time*1.6));
   add(p,'torso','x',-.025*Math.sin(time*1.1));break;
  case 'wing':
   all(p,'wing','z',.35*w);
   all(p,'wingelbow','y',.14*w);
   add(p,'torso','x',-.10*impact);break;
  case 'dive':
   add(p,'torso','x',-.33*impact);
   all(p,'wing','z',-.15*impact);break;
  case 'bank':
   model.rotation.z+=.14*Math.sin(time*.9);
   all(p,'wing','z',.11*Math.sin(time*.9));break;
  case 'brace':
   add(p,'torso','x',.10*w);
   all(p,'leg','x',-.13*w);
   all(p,'arm','x',-.22*w);break;
  case 'tail':
   add(p,'tail','y',.62*impact);
   add(p,'tailMid','y',-.41*impact);
   add(p,'torso','y',.15*impact);break;
  case 'breath':
   add(p,'head','x',-.23*impact);
   add(p,'jaw','x',.54*w);
   add(p,'torso','x',-.08*anticipation);break;
  case 'charge':
   add(p,'head','x',.18*w);
   add(p,'torso','x',.20*w);
   all(p,'leg','x',.12*impact);break;
  case 'skitter':
   all(p,'leg','x',.14*Math.sin(time*11.0));
   add(p,'abdomen','z',.05*Math.sin(time*6));break;
  case 'web':
   add(p,'abdomen','x',-.26*w);
   all(p,'legfront','x',-.20*anticipation+.26*impact);
   add(p,'head','x',-.12*impact);break;
  case 'rise':
   add(p,'torso','x',.12*(1-breath));
   add(p,'head','x',-.14*breath);break;
  case 'cast':
   all(p,'arm','x',-.42*w);
   add(p,'head','x',-.08*impact);
   add(p,'torso','y',.10*w);break;
  case 'drain':
   all(p,'arm','x',-.34*impact);
   add(p,'torso','x',-.14*anticipation);
   add(p,'head','x',.12*impact);break;
  case 'stomp':
   all(p,'leg','x',-.34*anticipation+.52*impact);
   add(p,'torso','x',.18*impact);break;
  case 'slam':
   all(p,'arm','x',-.64*impact);
   add(p,'torso','x',.25*impact);break;
  case 'grasp':
   all(p,'tentacle','x',.35*impact);
   all(p,'tentacle','y',.18*Math.sin(time*4.2));
   add(p,'head','x',-.13*impact);break;
  case 'coil':
   add(p,'tail','y',.43*w);
   all(p,'tentacle','y',.33*w);
   model.rotation.y+=.12*w;break;
 }
 return true;
}
/** Canonical skinned humanoids: use existing bones, not a substitute mannequin. */
export function applyCanonicalMonsterThemeMotion(visual,{
 tech,progress=0,time=0
}={}){
 if(!visual||!tech)return false;
 const bones=visual.userData?.monsterThemeBones;
 if(!bones)return false;
 const p=Math.max(0,Math.min(1,progress)),w=wave(p);
 const pose=tech.pose==='signature'?
  ({undead:'cast',golem:'slam',fiend:'cast',avian:'wing'}[
   visual.userData.monsterThemeFamily]||'cast'):tech.pose;
 const reach=(pose==='claw'||pose==='slam'||pose==='stomp'||pose==='grasp');
 const magic=(pose==='cast'||pose==='drain'||pose==='breath'||pose==='web'||pose==='wing');
 const threaten=(pose==='howl'||pose==='rise'||pose==='charge');
 if(reach){
  if(bones.arms[0])bones.arms[0].rotation.x-=.20*w;
  if(bones.arms[1])bones.arms[1].rotation.x-=.42*w;
  if(bones.spine)bones.spine.rotation.x+=.12*w;
 }else if(magic){
  if(bones.arms[0])bones.arms[0].rotation.x-=.34*w;
  if(bones.arms[1])bones.arms[1].rotation.x-=.32*w;
  if(bones.spine)bones.spine.rotation.x-=.06*w;
 }else if(threaten){
  if(bones.head)bones.head.rotation.x-=.12*w;
  if(bones.spine)bones.spine.rotation.x-=.10*w;
 }else if(pose==='brace'){
  if(bones.arms[0])bones.arms[0].rotation.x-=.14*w;
  if(bones.arms[1])bones.arms[1].rotation.x-=.14*w;
 }else if(pose==='bank'||pose==='glide'){
  if(bones.spine)bones.spine.rotation.z+=.045*Math.sin(time*1.3);
 }else if(pose==='pounce'||pose==='dive'){
  if(bones.spine)bones.spine.rotation.x+=.16*w;
 }
 visual.userData.monsterThemeAction=tech.id;
 return true;
}
