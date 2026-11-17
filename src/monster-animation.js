import {applyMonsterBiologicalMotion} from './monster-joint-motion.js?v=m002-feline-motion-v4-20261117';
import {updateM001ActionEffects} from './m001-action-effects.js?v=m001-action-perf-v1-20261117';
import {updateReferenceBeastFx} from './beast-action-effects.js?v=ref-action-v1-20261117';
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
// Smooth action envelopes replace the old one-size-fits-all sine pulse.
const smooth=(a,b,t)=>{
 const u=Math.max(0,Math.min(1,(t-a)/(b-a)));
 return u*u*(3-2*u);
};
const accent=(t,a,b,c)=>smooth(a,b,t)*(1-smooth(b,c,t));
function animateWolfKingPerformance(p,action,progress,time,gait){
 const contact=action==='attack'||action==='special'?
   accent(progress,.26,.43,.69):0;
 const ready=action==='attack'||action==='special'?
   accent(progress,.02,.20,.43):0;
 const breath=action==='roar'?
   accent(progress,.13,.44,.87):0;
 // Crouch and gather the chest before the bite, then project the muzzle.
 // Delayed head/ear/jaw response carries weight and keeps teeth attached.
 if(p.torso){
   p.torso.rotation.x+=.075*ready-.137*contact;
   p.torso.rotation.z+=.009*Math.sin(time*1.5);
 }
 if(p.head){
   p.head.rotation.x+=.12*ready-.29*contact-.18*breath;
   p.head.rotation.y+=.028*Math.sin(time*.81);
 }
 if(p.jaw){
   if(action==='attack'||action==='special'){
     const preOpen=accent(progress,.045,.205,.45);
     const impactOpen=accent(progress,.35,.48,.64);
     p.jaw.rotation.x=.045+.42*preOpen+.12*impactOpen;
   }else if(action==='roar'){
     p.jaw.rotation.x=.06+.61*breath+
       .023*Math.sin(time*16)*breath;
   }
 }
 if(p.tail)p.tail.rotation.x-=.12*contact+.03*ready;
 for(const side of ['L','R']){
   const lead=side==='L'?1:.78;
   const leg=p['legfront'+side],elbow=p['lowerfront'+side],
     knee=p['lowerrear'+side];
   if(leg)leg.rotation.x-=lead*(.20*ready+.24*contact);
   if(elbow)elbow.rotation.x+=lead*(.15*ready+.20*contact);
   if(knee)knee.rotation.x-=.11*contact;
   const ear=p['ear'+side];
   if(ear)ear.rotation.x+=.25*contact+.18*breath;
 }
 if(action==='run'){
   const stride=Math.sin(gait*2-.35);
   if(p.torso)p.torso.rotation.x+=.028*stride;
   if(p.head)p.head.rotation.x-=.019*stride;
   if(p.tail)p.tail.rotation.y+=.035*Math.sin(gait*.53);
 }
}
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
 const sourceFeline=['m007','m008','m009','m010'].includes(model.userData.speciesId);
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
     sourceFeline?(action==='run'?.016:.008)*
       (1-Math.cos(gait*2))*.5:
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
 if(['m001','m002'].includes(model.userData.speciesId)&&
    action!=='defeat'){
   // m002 inherits the physically authored m001 anticipation, bite,
   // ear response and stride timing, not a stiff legacy spherical rig.
   animateWolfKingPerformance(p,action,progress,motionTime,gait);
   if(model.userData.speciesId==='m002'&&
      (action==='attack'||action==='special')&&p.jaw){
     // The m001 anticipation envelope closes before m002's late
     // flame-fang contact. Keep the physical jaw open THROUGH impact.
     p.jaw.rotation.x=Math.max(p.jaw.rotation.x,.08+.37*pulse);
   }
 }
 // Independent upper and lower joints must not visually snap from a
 // planted stride into the ready crouch. Exponential time-step smoothing
 // preserves frame-rate independence while retaining actual knee flex.
 // The solver never scales the bones to fake a mechanical spring.
 if(['m001','m002'].includes(model.userData.speciesId)&&
    (locomotion||action==='idle')){
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
   // Foot planting is solved from the same four fixed-length joint
   // segments in sagittal space; this never moves the hip socket, scales
   // bones, runs a full scene-graph traversal or allocates GPU geometry.
   // It gives the bent idle legs a grounded forward-weight crouch.
   const prevSettle=model.userData.m001BodySettleY;
   // Gallop uses level body suspension, not a full ground-planted
   // correction each airborne phase (which looks like pogo bouncing).
   let targetSettle=action==='run'?
     (Number.isFinite(prevSettle)?prevSettle:-.070):-.060;
   if(action!=='run'&&model.userData.detail!=='low'){
     const alongY=(joint,angle)=>joint.position.y*Math.cos(angle)-
       joint.position.z*Math.sin(angle);
     let lowest=Infinity;
     for(const side of ['L','R'])for(const limb of ['front','rear']){
       const id=limb+side;
       const upper=p['leg'+id],knee=p['lower'+id],
         hock=p['beastHock'+id],pastern=p['beastPastern'+id],
         toe=p['beastToe'+id];
       if(!upper||!knee||!hock||!pastern||!toe)continue;
       const a=upper.rotation.x,b=a+knee.rotation.x,
         c=b+hock.rotation.x,d=c+pastern.rotation.x;
       const height=upper.position.y+upper.scale.y*(
         alongY(knee,a)+alongY(hock,b)+alongY(pastern,c)+
         alongY(toe,d)-.034);
       lowest=Math.min(lowest,height);
     }
     if(Number.isFinite(lowest))
       targetSettle=Math.max(-.096,Math.min(-.043,.016-lowest));
   }
   const settleAlpha=dt==null?1:1-Math.exp(-11*dt);
   const settle=Number.isFinite(prevSettle)?
     prevSettle+(targetSettle-prevSettle)*settleAlpha:targetSettle;
   model.userData.m001BodySettleY=settle;
   model.position.y+=settle;
   model.userData.m001GaitTime=time;
 }else if(['m001','m002'].includes(model.userData.speciesId)){
   model.userData.m001GaitAngles=null;
   model.userData.m001GaitTime=null;
   model.userData.m001BodySettleY=null;
 }
 // Existing jaw pivot continues its action animation; speech adds a
 // bounded jaw opening after the usual pose (no bones duplicated).
 if(leap)applyMonsterLeapMotion(p,leap,model.userData.surfaceFamily);
 if(action!=='defeat')model.userData.facialControls?.update?.(
   Math.max(0,Math.min(.1,time-(model.userData.facialLastTime??time-.075))));
 model.userData.facialLastTime=time;
 if(model.userData.speciesId==='m001')
   updateM001ActionEffects(model,{action,progress,time:motionTime});
 if(['m002','m007','m008','m009','m010'].includes(
    model.userData.speciesId))
   updateReferenceBeastFx(model,{action,progress,time:motionTime});
 return {action,progress,...(leap?{leapPhase:leap.phase}:null)};
}
