/**
 * Shared battle VFX recipes and Kenney CC0 effect sprites in the outfit studio.
 * The combat rules remain in combat-action-runtime.js; this previews only
 * the matching visual/audio-free cues without dealing simulated damage.
 */
import {VFX_RECIPES,resolveVisualAssembly} from './visual-asset-catalog.js?v=107.0';
import {combatEffectDirective} from './combat-effect-directives.js';
import {getKenneyTexture} from './kenney-vfx-runtime.js';

const HERO_BATTLE_JOB=Object.freeze({
 knight:'knight',swordsman:'swordsman',shield:'knight',fighter:'monk',
 archer:'archer',ninja:'assassin',thief:'rogue',mage:'mage',
 cleric:'priest',summoner:'mage',farmer:'farmer'
});
export const STUDIO_BATTLE_ACTIONS=Object.freeze([
 {id:'idle',label:'待機',group:'movement'},
 {id:'walk',label:'歩く',group:'movement'},
 {id:'run',label:'走る',group:'movement'},
 {id:'attack',label:'攻撃',group:'combat'},
 {id:'guard',label:'防御',group:'combat'},
 {id:'cast',label:'魔法・スキル',group:'combat'},
 {id:'victory',label:'勝利',group:'combat'}
]);
export function effectRecipeForHeroineAction(jobId='swordsman',action='idle'){
 const visualJob=HERO_BATTLE_JOB[jobId]||'swordsman';
 const assembly=resolveVisualAssembly(visualJob);
 const base=VFX_RECIPES[assembly.attack]||VFX_RECIPES.slash;
 if(action==='attack'){
  return {texture:base.texture||'slash_02',
   shape:base.shape,life:base.life||.30,width:base.width||.88,
   color:assembly.accent,element:assembly.magic,kind:'attack'};
 }
 if(action==='cast'){
  const job=(jobId==='cleric'?'priest':jobId==='mage'?'mage':'summoner');
  const directive=combatEffectDirective({type:'skill',jobId:job,
   skillKind:job==='priest'?'heal':'damage',effect:assembly.magic,radius:1.0});
  return {texture:directive?.kind==='healArea'?'magic_01':'magic_04',
   shape:'ring',life:.95,width:.80,
   color:directive?.kind==='healArea'?'#81ffbf':assembly.accent,
   element:directive?.element||assembly.magic,kind:directive?.kind||'area'};
 }
 if(action==='guard')
  return {texture:'spark_05',shape:'block',life:.55,width:.78,
   color:'#e2eefb',element:'shield',kind:'guard'};
 if(action==='run'||action==='walk')
  return {texture:'smoke_03',shape:'dust',
   life:action==='run'?.50:.32,width:action==='run'?.26:.14,
   color:'#c4d1e5',element:'ground',kind:action};
 if(action==='victory')
  return {texture:'light_03',shape:'celebrate',life:1.20,width:.60,
   color:'#f7dfa2',element:'light',kind:'victory'};
 return null;
}

export function createHeroineBattleActionVfx({
 THREE,actorRoot,camera,loadTexture=(id)=>getKenneyTexture(THREE,id)
}={}){
 if(!THREE?.Sprite||!actorRoot?.isObject3D||!camera)
  throw Error('Battle VFX preview needs Three.js, the real actor and a camera');
 let disposed=false,triggerCount=0,time=0,recipe=null,activeTexture='';
 const materials=[],sprites=[];
 const makeSprite=(node,opacity=1)=>{
  const mat=new THREE.SpriteMaterial({
   color:0xffffff,transparent:true,opacity:0,depthWrite:false,
   depthTest:true,blending:THREE.AdditiveBlending
  });
  const sprite=new THREE.Sprite(mat);
  sprite.name='KENNEY_SHARED_BATTLE_VFX';
  sprite.visible=false;sprite.userData.baseOpacity=opacity;
  node.add(sprite);materials.push(mat);sprites.push(sprite);
  return sprite;
 };
 const bone=name=>{
  let result=null;
  actorRoot.traverse(o=>{if(o.isBone&&o.name.toLowerCase()===name)result=o});
  return result||actorRoot;
 };
 const spine=bone('spine_03'),rightHand=bone('hand_r'),
  leftHand=bone('hand_l'),leftFoot=bone('foot_l'),rightFoot=bone('foot_r');
 const main=makeSprite(rightHand);
 const second=makeSprite(leftHand,.65);
 const torso=makeSprite(spine,.72);
 const dustL=makeSprite(leftFoot,.43),dustR=makeSprite(rightFoot,.43);
 main.position.set(0,.12,.13);
 second.position.set(0,.09,.13);
 torso.position.set(0,.09,.30);
 dustL.position.set(0,.02,.08);
 dustR.position.set(0,.02,.08);
 const show=s=>{s.visible=true;s.material.opacity=0};
 const hideAll=()=>{for(const s of sprites){s.visible=false;s.material.opacity=0}};
 let loaded=0;
 function trigger(action,jobId){
  if(disposed)return null;
  recipe=effectRecipeForHeroineAction(jobId,action);
  hideAll();
  if(!recipe)return null;
  const requested=++loaded;
  time=0;triggerCount++;
  const chosen=recipe;
  if(chosen.shape==='dust'){show(dustL);show(dustR)}
  else if(chosen.shape==='ring'){show(main);show(second);show(torso)}
  else if(chosen.shape==='celebrate'){show(main);show(second);show(torso)}
  else if(chosen.shape==='block'){show(second);show(torso)}
  else show(main);
  for(const sprite of sprites){
   sprite.material.color.set(chosen.color);
   sprite.material.rotation=0;
  }
  Promise.resolve().then(()=>loadTexture(chosen.texture)).then(texture=>{
   if(disposed||requested!==loaded)return;
   activeTexture=chosen.texture;
   for(const mat of materials){mat.map=texture;mat.needsUpdate=true}
  }).catch(error=>{actorRoot.userData.studioVfxLoadError=String(error)});
  return {...recipe,source:'Kenney-CC0-combat-visual-BOM'};
 }
 function update(dt){
  if(disposed||!recipe)return;
  time+=Math.max(0,Math.min(.07,dt||0));
  if(time>=recipe.life){hideAll();recipe=null;return}
  const p=Math.min(1,time/recipe.life),fade=Math.sin(Math.PI*p);
  const w=recipe.width;
  for(let i=0;i<sprites.length;i++){
   const s=sprites[i];if(!s.visible)continue;
   const phase=i===0?0:i===1?.10:.18;
   const pulse=Math.max(0,Math.sin(Math.PI*Math.min(1,(p+phase))));
   s.material.opacity=pulse*fade*s.userData.baseOpacity;
   const scale=w*(.65+p*.55);
   s.scale.set(scale,scale,1);
   s.material.rotation=(i%2===0?1:-1)*p*1.8;
  }
  if(recipe.shape==='dust'){
   dustL.position.y=.02+p*.07;
   dustR.position.y=.02+p*.07;
  }
 }
 function dispose(){
  disposed=true;loaded++;
  hideAll();
  sprites.forEach(s=>s.removeFromParent());
  materials.forEach(m=>m.dispose());
 }
 return {
  trigger,update,dispose,
  getState:()=>({
   triggered:triggerCount,active:!!recipe,asset:activeTexture,
   action:recipe?.kind||null,usesExistingBattleRecipes:true,
   source:'Kenney-CC0-combat-visual-BOM',spriteCount:sprites.length,
   attachedToRealBones:true
  })
 };
}
