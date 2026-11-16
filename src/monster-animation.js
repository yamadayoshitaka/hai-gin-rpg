import {applyMonsterBiologicalMotion} from './monster-joint-motion.js?v=m001-soft-knee-v6-20261117';
import {monsterLeapPose,applyMonsterLeapMotion} from './monster-leap-kinematics.js?v=1';
/** Per-species, per-part procedural animation for bestiary inspection.
 * Separate head, jaws, limbs, wings and tentacles keep animation readable.
 */
const durations=Object.freeze({idle:Infinity,walk:Infinity,run:Infinity,attack:1.1,
  special:1.6,roar:1.3,dodge:.7,guard:.9,hit:.45,leap:1.25,defeat:1.15});
export const MONSTER_ACTIONS=Object.freeze([
 ['idle','待機'],['walk','歩行'],['run','疾走'],['attack','通常攻撃'],
 ['special','固有技'],['roar','威嚇'],['guard','防御'],['dodge','回避'],
 ['hit','被弾'],['leap','跳躍'],['defeat','倒れる'],
]);
export function startMonsterAction(model,action,time=0){
 if(!Object.prototype.hasOwnProperty.call(durations,action))throw Error('Unknown monster action: '+action);
 model.userData.action=action;model.userData.actionAt=time;
 return model;
}
export function animateMonsterModel(model,time=0){
 if(!model)return;
 const p=model.userData.pivots||{};
 let action=model.userData.action||'idle';
 const elapsed=Math.max(0,time-(model.userData.actionAt??0));
 // Defeat is a terminal pose; do not resurrect the model after 1.15s.
 if(elapsed>durations[action]&&action!=='defeat'){
   action='idle';model.userData.action='idle';model.userData.actionAt=time;
 }
 const d=durations[action],progress=Number.isFinite(d)?Math.min(1,elapsed/d):0;
 const pulse=Number.isFinite(d)?Math.sin(Math.PI*progress):0;
 const locomotion=action==='walk'||action==='run';
 // A defeated animal must not keep breathing, blinking, flexing its tail
 // or flapping at a time-dependent phase after its fall has ended.
 const motionTime=action==='defeat'?0:time;
 const speed=action==='run'?13:7,gait=motionTime*speed;
 const strike=action==='attack'?pulse:0;
 const special=action==='special'?pulse:0;
 const hit=action==='hit'?pulse:0;
 const dodge=action==='dodge'?pulse:0;
 const guard=action==='guard'?pulse:0;
 const leaping=action==='leap'?pulse:0;
 const leap=action==='leap'?monsterLeapPose(progress,model.userData.surfaceFamily):null;
 const dying=action==='defeat'?progress:0;
 const springBeast=['m001','m002','m003','m004'].includes(model.userData.speciesId);
 const sway=Math.sin(motionTime*2.1)*.027*(1-dying);
 // Rare, brief eye closure with a per-species offset. No random state,
 // material allocations or extra draw calls during the animation loop.
 const blinkClock=(motionTime+(model.userData.blinkOffset??
   ((Number(model.userData.speciesId?.slice(-3))||0)%7)*.37))%4.7;
 const blink=action==='defeat'?dying:
   Math.max(0,1-Math.abs(blinkClock-4.50)/.13);
 model.rotation.set(-(strike*.23+special*.12+hit*.16)+dying*.19+(leap?.pitch??0),
   dodge*Math.sin(progress*Math.PI)*.95,dying*.98+dodge*.25);
 // A canine's spine stays close to the ground when the paws are in
 // contact. Only genuine leap actions get full airborne displacement.
 // The former abs(sin)*.055 made every RUN look like floating in midair.
 const springLift=locomotion?
   (springBeast?(action==='run'?.014:.009)*(1-Math.cos(gait*2))*.5:
     Math.abs(Math.sin(gait))*.055):0;
 model.position.set(dodge*Math.sin(progress*Math.PI)*1.3,
   springLift-(springBeast&&action!=='leap'?.014:0)+
   (leap?.height??0)-dying*.48,0);
 model.scale.setScalar((model.userData.homeScale??1)*(1-.16*dying));
 for(const [name,part] of Object.entries(p)){
   part.rotation.set(0,0,0);
   // Joint lengths must be reversible when switching run -> idle.
   // Otherwise the previous compressed foot pose persists permanently.
   if(springBeast&&name.startsWith('leg'))
     part.scale.y=part.userData.restLengthScale??1;
   if(name.startsWith('eyelid')){
     part.position.y=(part.userData.restY??part.position.y)-
       (part.userData.blinkTravel??0)*blink;
     continue;
   }
   if(name==='head'){
     part.rotation.x=-strike*.27-special*.42+hit*.12+
       Math.sin(motionTime*1.7)*.025+dying*.12;
     part.rotation.y=dodge*.30+Math.sin(motionTime*.7)*.025;
   }else if(name==='jaw'){
     part.rotation.x=(action==='roar'?.55:pulse*.42)+
       Math.sin(motionTime*3)*.022+dying*.08;
   }else if(name==='tail'){
     part.rotation.y=Math.sin(motionTime*2.8)*.19+strike*.35+special*.58;
   }else if(name==='abdomen'){
     part.rotation.z=Math.sin(motionTime*2.2)*.06;
   }else if(name.startsWith('wing')){
     const side=name.includes('L')?-1:1;
     part.rotation.z=side*(.22+.23*Math.sin(motionTime*6.1)+
       special*.7+leaping*.6-dying*.16);
     part.rotation.x=.08*Math.sin(motionTime*3);
   }else if(name.startsWith('tentacle')){
     const n=Number(name.slice('tentacle'.length))||0;
     part.rotation.x=Math.sin(motionTime*4+n)*.21+strike*.35+special*.65;
     part.rotation.y=Math.cos(motionTime*2.5+n)*.23;
   }else if(name.startsWith('lower')||name.startsWith('hock')||
     name.includes('Patella')||name.includes('Tibia')){
     // Jointed limbs collapse into a stable pose instead of being left
     // rigidly extended while the body falls.
     part.rotation.x=.30*dying;
   }else if(name.startsWith('leg')||name.startsWith('arm')){
     const side=name.includes('L')?-1:1,number=Number(name.slice(-1))||0;
     const gaitOffset=side>0?Math.PI:0;
     part.rotation.x=(locomotion?Math.sin(gait+gaitOffset+number*.62)*(action==='run'?.62:.34):0)+
       strike*(name.startsWith('arm')?-.70:-.2)+special*(name.startsWith('arm')?-.95:-.29)+
       guard*(name.startsWith('arm')?-.90:-.06);
     part.rotation.z=side*(dodge*.19+hit*.14+dying*.15);
   }else if(name==='torso'){
     part.rotation.z=sway+hit*.16+dying*.10;
   }
 }
 // Preserve the existing action contracts, then use real extra joint pivots
 // for nonhumanoid anatomy. Human and humanlike rigs are excluded.
 if(action!=='defeat')applyMonsterBiologicalMotion(model,{
   time:motionTime,phase:gait,action,pulse:Math.max(strike,special,leaping),
   locomotion,run:action==='run'
 });
 // Independent upper and lower joints must not visually snap from a
 // planted stride into the ready crouch. Exponential time-step smoothing
 // preserves frame-rate independence while retaining actual knee flex.
 // The solver never scales the bones to fake a mechanical spring.
 if(model.userData.speciesId==='m001'&&(locomotion||action==='idle')){
   const prev=model.userData.m001GaitAngles||{};
   const last=model.userData.m001GaitTime;
   const dt=Number.isFinite(last)&&time>last?
     Math.min(.16,time-last):null;
   const stiffness=locomotion?(action==='run'?24:19):11;
   const alpha=dt==null?1:1-Math.exp(-stiffness*dt);
   const next={};
   for(const side of ['L','R'])for(const limb of ['front','rear']){
     const suffix=limb+side;
     for(const stem of ['leg','lower','beastHock','beastPastern','beastToe']){
       const key=stem+suffix,node=p[key];
       if(!node)continue;
       const target=node.rotation.x;
       const old=prev[key];
       const angle=Number.isFinite(old)?
         old+(target-old)*alpha:target;
       node.rotation.x=angle;next[key]=angle;
     }
   }
   model.userData.m001GaitAngles=next;
   model.userData.m001GaitTime=time;
 }else if(model.userData.speciesId==='m001'){
   model.userData.m001GaitAngles=null;
   model.userData.m001GaitTime=null;
 }
 // Existing jaw pivot continues its action animation; speech adds a
 // bounded jaw opening after the usual pose (no bones duplicated).
 if(leap)applyMonsterLeapMotion(p,leap,model.userData.surfaceFamily);
 if(action!=='defeat')model.userData.facialControls?.update?.(
   Math.max(0,Math.min(.1,time-(model.userData.facialLastTime??time-.075))));
 model.userData.facialLastTime=time;
 return {action,progress,...(leap?{leapPhase:leap.phase}:null)};
}
